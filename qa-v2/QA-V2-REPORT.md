# Account Recovery & Verification V2 — QA + Schema Audit Report

**Baseline commit:** `02ead45` (`test(auth-v2): stage 9 — final audit`)
**QA run date:** 2026-08-15
**QA database:** PostgreSQL 17.10 on `127.0.0.1:5433/qa_db` (local, dedicated — NOT production)
**QA records:** 3 dedicated QA users (`qa-v2-verify@example.com`, `qa-v2-reset@example.com`, `qa-v2-legacy@example.com`). No production user/order/product data was touched.

---

## 1. Production Schema Drift Audit

### 1.1 What V2 adds (relative to V1 baseline `454620e`)

The V2 work at commits `041b5f2..02ead45` introduces exactly **three** schema
additions. All three are documented in `prisma/sql/20260815-account-recovery-v2.sql`
and are present in `prisma/schema.prisma`.

| # | Object | Type | Additive? | Destructive? |
|---|--------|------|-----------|--------------|
| 1 | `User.sessionVersion` | `INTEGER NOT NULL DEFAULT 0` column | ✅ ADD COLUMN | ❌ No (default 0 backfills existing rows) |
| 2 | `OtpCode` table + 2 indexes + 1 FK | new table | ✅ CREATE TABLE | ❌ No |
| 3 | `PasswordResetGrant` table + 2 indexes + 1 FK | new table | ✅ CREATE TABLE | ❌ No |

**No existing column is dropped, renamed, or type-changed.**
**No existing index or constraint is dropped.**
**No existing row is modified** (the `ADD COLUMN ... DEFAULT 0` is a
catalog-only update in PostgreSQL 11+; it does not rewrite the table).

### 1.2 Exact additive DDL (V1 → V2)

This is the EXACT SQL that `prisma db push` would apply to a production
database currently on the V1 schema, to bring it up to V2. It is
identical to the contents of `prisma/sql/20260815-account-recovery-v2.sql`.

```sql
-- (1) User.sessionVersion
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- (2) OtpCode table
CREATE TABLE "OtpCode" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "purpose"     TEXT NOT NULL,
    "codeHash"    TEXT NOT NULL,
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "consumedAt"  TIMESTAMP(3),
    "lastSentAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpCode_userId_purpose_idx" ON "OtpCode"("userId", "purpose");
CREATE INDEX "OtpCode_expiresAt_idx"       ON "OtpCode"("expiresAt");
ALTER TABLE "OtpCode"
  ADD CONSTRAINT "OtpCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- (3) PasswordResetGrant table
CREATE TABLE "PasswordResetGrant" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "grantHash"  TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetGrant_grantHash_key"
  ON "PasswordResetGrant"("grantHash");
CREATE INDEX "PasswordResetGrant_userId_idx"
  ON "PasswordResetGrant"("userId");
ALTER TABLE "PasswordResetGrant"
  ADD CONSTRAINT "PasswordResetGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

### 1.3 Pre-deploy verification procedure (NO `db push` blindly)

The operator MUST run these commands against the **production** DATABASE_URL
before running `prisma db push`. None of these commands mutate the database —
they only compute and print the diff.

```bash
# (A) Confirm what db push WOULD apply (production DB → schema).
#     Expected output: the three additive DDL statements above.
#     If this output contains ANY DROP / ALTER COLUMN / RENAME,
#     STOP and investigate — it means production has drifted from V1.
bunx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# (B) Inverse diff (schema → production DB).
#     Expected output: empty (or only the inverse of the additive DDL above).
#     If this output contains CREATE TABLE / ADD COLUMN for objects NOT
#     in the V2 spec, production has extra objects that the schema
#     doesn't know about — investigate before pushing.
bunx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-url "$PROD_DATABASE_URL" \
  --script

# (C) Drift summary (human-readable).
bunx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma
```

### 1.4 Specific confirmations requested by the operator

The operator asked to "specifically confirm" the following objects exist
in `prisma/schema.prisma` (and therefore would be created by `db push`
if missing in production):

| Object | Confirmed in schema? | Location |
|--------|----------------------|----------|
| `User.sessionVersion` | ✅ Yes | `prisma/schema.prisma:105` — `sessionVersion Int @default(0)` |
| `OtpCode` model | ✅ Yes | `prisma/schema.prisma:206-234` |
| `OtpCode` indexes | ✅ Yes | `@@index([userId, purpose])` + `@@index([expiresAt])` at lines 232-233 |
| `PasswordResetGrant` model | ✅ Yes | `prisma/schema.prisma:264-276` |
| `PasswordResetGrant` indexes | ✅ Yes | `@unique` on `grantHash` (line 268) + `@@index([userId])` (line 275) |

All four requested objects are present in the Prisma schema and map 1:1
to the QA database state (verified via `\d "User"`, `\d "OtpCode"`,
`\d "PasswordResetGrant"` against `qa_db` — see `qa-v2/output/00-seed.log`
for the schema-push output confirming "Your database is now in sync with
your Prisma schema").

### 1.5 Apply procedure (after verification)

Once the operator has confirmed the diff in §1.3 is purely additive,
the changes can be applied with:

```bash
# Apply the additive V2 schema to production.
# Prisma will compute the minimal diff and apply it in a single transaction.
# This is SAFE because the diff is purely additive (verified in §1.3).
bunx prisma db push --accept-data-loss=false
```

**DO NOT** use `--accept-data-loss`. The `--accept-data-loss` flag is
required only when Prisma detects a destructive operation; if §1.3
confirmed the diff is purely additive, `--accept-data-loss` is NOT
needed and MUST NOT be used.

**DO NOT** use `prisma migrate reset` — that would drop and recreate
the database, destroying all production users/orders/products.

**DO NOT** use `bun run db:reset` — same as above.

**DO NOT** run `prisma/seed.ts` against production — it creates demo
users and would pollute the production user table.

---

## 2. Concurrency QA Results

All tests run against **real PostgreSQL 17.10** (not SQLite, not mocks).
The test scripts call the SAME lib functions (`consumeOtp`, `issueOtp`,
`issueResetGrant`, `getCurrentUser`, `hashPassword`, `comparePassword`)
that the production HTTP routes call — so the transaction semantics
are identical to what production will experience.

Raw test logs: `qa-v2/output/0[1-5]-test-*.log`.

### 2.1 Test 1 — OTP invalid attempts (20 parallel invalid) ✅ PASS

**Spec:** 20 parallel invalid submissions → MAX 5 attempts accepted/countable
→ challenge locked → remaining requests rejected.

**Result:**

| Outcome | Count | Expected | Pass |
|---------|-------|----------|------|
| `WRONG_CODE` (attempt incremented) | 5 | 5 | ✅ |
| `NOT_FOUND_OR_EXPIRED` (rejected, locked) | 15 | 15 | ✅ |
| `OK` (should never happen with wrong code) | 0 | 0 | ✅ |
| `ALREADY_CONSUMED` | 0 | 0 | ✅ |

**Final OTP row state:** `attempts=5, maxAttempts=5, consumedAt=NULL` —
challenge is LOCKED but not consumed (correct: lockout ≠ consumption).

**Bonus:** A subsequent submission of the CORRECT code is rejected with
`NOT_FOUND_OR_EXPIRED` (because `attempts >= maxAttempts` triggers the
NOT_FOUND_OR_EXPIRED branch in `consumeOtp`). ✅

**Conclusion:** The max-5-attempts cap is enforced atomically via
`updateMany WHERE id = row.id AND attempts < maxAttempts`. Under
PostgreSQL's READ COMMITTED, the 20 concurrent increments serialize on
the row lock; the first 5 succeed (count=1), the next 15 see
`attempts >= maxAttempts` in their re-evaluated WHERE clause and get
count=0 → NOT_FOUND_OR_EXPIRED. The cap is hard.

### 2.2 Test 2 — OTP resend (10 parallel) ⚠️ FAIL on Run A, PASS on Run B

**Spec:** 10 parallel resend requests → at most ONE succeeds → only one
fresh active challenge remains → cooldown enforced for the rest.

**Result (Run A — pure parallel, mimics 10 concurrent HTTP requests):**

| Metric | Observed | Expected | Pass |
|--------|----------|----------|------|
| Issuances succeeded | **7** | ≤ 1 | ❌ FAIL |
| Cooldown rejects | 3 | 9 | ❌ FAIL |
| Final unconsumed OTP count | **2** | 1 | ❌ FAIL |
| Cooldown enforced for next request | ✅ yes | yes | ✅ |

**Result (Run B — serial, mimics requests spaced ≥60ms apart):**

| Metric | Observed | Expected | Pass |
|--------|----------|----------|------|
| Issuances succeeded | 1 | 1 | ✅ |
| Cooldown rejects | 9 | 9 | ✅ |
| Final unconsumed OTP count | 1 | 1 | ✅ |

**Root cause of Run A failure (race condition in `issueOtp`):**

`src/lib/otp.ts:233-250` uses the array-form `$transaction([updateMany, create])`:

```ts
await db.$transaction([
  db.otpCode.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: now, attempts: maxAttempts },
  }),
  db.otpCode.create({ data: { ... } }),
])
```

The array form runs `updateMany` then `create` **sequentially within one
transaction**, but the transaction itself uses PostgreSQL's default
**READ COMMITTED** isolation. Two concurrent `issueOtp` transactions
can both run their `updateMany` BEFORE either has committed its `create`:

```
T1: BEGIN → updateMany (matches 0 rows: nothing exists yet) → create OTP_A → COMMIT
T2: BEGIN → updateMany (matches 0 rows: T1 hasn't committed OTP_A yet) → create OTP_B → COMMIT
Final: OTP_A (consumedAt=NULL), OTP_B (consumedAt=NULL) — TWO active challenges. ❌
```

This is reproducible: ~1 in 5 runs of Test 2 leaves 2 active OTPs.
The other ~4 in 5 runs leave 1 active OTP (lucky scheduling where
T2's `updateMany` ran after T1's `create` committed).

**Reproduction rate:** ~20% of pure-parallel runs (5 runs: 4 passed,
1 failed with 2 active OTPs; 7 issuances / 3 rejects).

**Security impact:**

- The "only one fresh active challenge remains" invariant is VIOLATED
  under tight parallel load. An attacker who fires 10 parallel
  forgot-password requests can cause 2+ active OTPs to exist for the
  same (userId, purpose).
- However, the PRACTICAL impact is limited:
  - All active OTPs share the same `expiresAt` (10 min TTL).
  - All active OTPs are valid for verification — `consumeOtp`'s
    `findFirst ORDER BY createdAt DESC` picks the NEWEST one. So the
    "older" active OTP is shadowed by the newer one for verification
    purposes (a valid code from the older OTP would still verify if
    the user submits it, because findFirst picks newest and the older
    OTP's code differs).
  - The attacker does NOT gain additional brute-force budget: each
    active OTP has its own `maxAttempts=5` cap, but the user's email
    still only receives N emails (one per issuance), and the 60s
    cooldown IS enforced for the NEXT request after the burst.
- The bigger concern is **email spam**: 7 of 10 parallel requests
  trigger 7 OTP emails to the user's inbox within ~40ms. This is a
  UX/abuse issue, not a credential-compromise issue.

**Recommended fix (NOT applied — operator decision):**

Pick ONE of the following. Each is a 5-line change to `src/lib/otp.ts`
`issueOtp` + the resend-cooldown check in the HTTP routes.

1. **Per-(userId, purpose) advisory lock** (preferred — surgical):
   ```ts
   await db.$transaction(async (tx) => {
     // Acquire a transaction-scoped advisory lock keyed on (userId, purpose).
     // This serializes issuances per (userId, purpose) — concurrent
     // issuances for DIFFERENT users are NOT blocked.
     const key = Buffer.from(`${userId}:${purpose}`).readInt32BE(0) // or hash
     await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId} || ':' || ${purpose}))`
     // ... existing updateMany + create ...
   })
   ```

2. **Unique partial index** (defense-in-depth — DB-level invariant):
   ```sql
   CREATE UNIQUE INDEX "OtpCode_userId_purpose_active_uniq"
     ON "OtpCode"("userId", "purpose")
     WHERE "consumedAt" IS NULL;
   ```
   This makes the DB REJECT any second active OTP for the same
   (userId, purpose). The application must catch the unique-violation
   error and retry the cooldown check. This is the strongest guarantee
   because it holds even if the application logic has a bug.

3. **SELECT ... FOR UPDATE on the User row** (heavier contention):
   ```ts
   await db.$transaction(async (tx) => {
     await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
     // ... existing updateMany + create ...
   })
   ```
   This serializes ALL per-user operations (including unrelated ones
   like cart updates). Heavier than option 1 but requires no schema
   change.

**Recommendation:** Apply option 1 (advisory lock) AND option 2
(unique partial index). Option 1 prevents the race; option 2 catches
it if option 1 is ever bypassed.

**This is a BLOCKER for production deployment.** The spec explicitly
requires "only one fresh active challenge remains" under parallel load.

### 2.3 Test 3 — Concurrent valid OTP verify (5 parallel) ✅ PASS

**Spec:** 2+ concurrent submissions of same valid OTP → one claim wins
→ emailVerifiedAt set once → others rejected/idempotent.

**Result:**

| Outcome | Count | Expected | Pass |
|---------|-------|----------|------|
| `OK` (claim won) | 1 | 1 | ✅ |
| `ALREADY_CONSUMED` (lost race, saw consumed row) | 1 | part of 4 | ✅ |
| `NOT_FOUND_OR_EXPIRED` (lost race, findFirst saw committed consume) | 3 | part of 4 | ✅ |
| OK winners that also wrote emailVerifiedAt (count=1) | 1 | 1 | ✅ |

**Final state:**
- `User.emailVerifiedAt` = set (exactly once, via idempotent
  `User.updateMany WHERE emailVerifiedAt IS NULL`).
- `OtpCode.consumedAt` = set (single-use enforced).
- `OtpCode.attempts` = 0 (no wrong-code increments — all callers
  submitted the same valid code).

**Note on loser outcome variance:** Under READ COMMITTED, the 4 losers
split between `ALREADY_CONSUMED` (their `findFirst` ran before the
winner's commit, so they saw the row, proceeded to `updateMany`, lost
the row-lock race, got `count=0`) and `NOT_FOUND_OR_EXPIRED` (their
`findFirst` ran after the winner's commit, so the `consumedAt IS NULL`
filter excluded the row, returning null). BOTH outcomes are correct
"lost the race" results. The HTTP route surfaces them differently
(`ALREADY_CONSUMED` → 200 idempotent, `NOT_FOUND_OR_EXPIRED` → 404),
but neither violates the security invariant.

**Conclusion:** The atomic `updateMany WHERE consumedAt IS NULL AND
expiresAt > now AND attempts < maxAttempts` claim inside the interactive
transaction correctly serializes concurrent verifies. Exactly one wins,
the rest lose idempotently. ✅

### 2.4 Test 4 — Password reset E2E ✅ PASS

**Spec:** issue known reset OTP → verify OTP → receive valid reset grant
→ reset password → old password fails → new password succeeds → grant
reuse fails → old session becomes invalid after sessionVersion bump.

**Result (all 7 steps + 1 bonus):**

| Step | Description | Result |
|------|-------------|--------|
| 1 | Issue `PASSWORD_RESET` OTP via `issueOtp` | ✅ |
| 2 | Verify OTP via `consumeOtp` → `issueResetGrant` | ✅ grant issued |
| 3 | Reset password via atomic tx (claim grant + set bcrypt password + bump sessionVersion + invalidate OTPs) | ✅ OK |
| 4 | `comparePassword(OLD, hash)` returns `false` | ✅ old password fails |
| 5 | `comparePassword(NEW, hash)` returns `true` | ✅ new password works |
| 6 | Grant reuse → `GRANT_CONSUMED` | ✅ single-use enforced |
| 7 | `User.sessionVersion` bumped `0 → 1` | ✅ |
| Bonus | All unconsumed OTPs for user invalidated (count=0) | ✅ |

**Conclusion:** The full password-reset flow works end-to-end. The
atomic interactive transaction in `src/app/api/auth/reset-password/route.ts`
correctly commits all four mutations (grant claim, password update,
sessionVersion bump, OTP invalidation) as a single unit — if any
throws, the entire transaction rolls back. The old password is
invalidated by the bcrypt overwrite; the old session is invalidated
by the sessionVersion bump (verified explicitly in Test 5). ✅

### 2.5 Test 5 — Legacy session compatibility ✅ PASS

**Spec:** Existing pre-V2 session token without `sessionVersion` field
must behave according to the intended migration policy when DB
`sessionVersion=0`. After reset increments to 1, that legacy/v0
session must fail.

**Migration policy (encoded in `src/lib/auth.ts:245-250`):**
- A legacy cookie (no `sessionVersion` claim) is treated as
  `sessionVersion = 0`.
- The DB's `User.sessionVersion` defaults to `0` (existing rows
  created before V2 are backwards-compatible).
- So legacy cookie vs DB v0 → MATCH → session valid.
- After password reset bumps DB to v1 → legacy cookie (still v0)
  vs DB v1 → MISMATCH → session INVALID.

**Result (all 6 steps):**

| Step | Description | Result |
|------|-------------|--------|
| 1 | Sign legacy cookie (no `sessionVersion` field) | ✅ |
| 2 | Confirm DB `sessionVersion = 0` | ✅ |
| 3 | `getCurrentUser()` with legacy cookie vs DB v0 → returns user | ✅ legacy session valid |
| 4 | Perform password reset → DB `sessionVersion = 1` | ✅ |
| 5 | `getCurrentUser()` with SAME legacy cookie vs DB v1 → returns `null` | ✅ legacy session INVALID |
| 6 | `getCurrentUser()` with NEW cookie (v1) vs DB v1 → returns user | ✅ new session valid |

**Conclusion:** The V2 migration policy is correctly implemented.
Pre-V2 session cookies continue to work against DB v0 (backwards
compatible). A password reset bumps the DB to v1, which immediately
invalidates all legacy cookies (they're treated as v0, which ≠ v1).
The user must re-authenticate, which issues a new v1 cookie. ✅

---

## 3. Resend Real Inbox E2E — PENDING

**Status: PENDING**

The Resend integration (`src/lib/email.ts`) was audited in stage 9
(commit `02ead45`) and the adapter wiring is correct. However, the
operator explicitly requires a REAL inbox delivery test before
marking this as passed.

**What's still needed:**
1. Configure `RESEND_API_KEY` in the deployment environment
   (Coolify / Vercel project env vars).
2. Configure `EMAIL_FROM` to a verified sender domain in Resend.
3. Trigger a real forgot-password request from a real email address.
4. Confirm the OTP email arrives in the actual inbox (not just the
   Resend API response).
5. Confirm the 6-digit code in the email matches what `consumeOtp`
   accepts (i.e. the HMAC round-trip works for a real delivered code).

**Do NOT mark Resend E2E as passed until steps 1-5 are complete.**

---

## 4. Summary & Recommendations

### 4.1 Test summary

| Test | Description | Result |
|------|-------------|--------|
| 1 | OTP invalid attempts (20 parallel) | ✅ PASS |
| 2 | OTP resend (10 parallel) | ❌ FAIL (race condition — see §2.2) |
| 3 | OTP verify concurrent (5 parallel valid) | ✅ PASS |
| 4 | Password reset E2E | ✅ PASS |
| 5 | Legacy session compatibility | ✅ PASS |
| - | Resend real inbox E2E | ⏳ PENDING (credentials not configured) |

### 4.2 Schema audit summary

- V2 schema is **purely additive** relative to V1.
- All three additions (`User.sessionVersion`, `OtpCode`, `PasswordResetGrant`)
  are confirmed present in `prisma/schema.prisma` and in the QA database.
- No destructive operations (no DROP, no ALTER COLUMN type, no RENAME).
- Existing users/orders/products are preserved.
- Pre-deploy verification procedure documented in §1.3.

### 4.3 Recommendations

1. **BLOCKER — Fix the OTP resend race condition (§2.2) before production
   deployment.** The spec requires "only one fresh active challenge
   remains" under parallel load; the current implementation violates
   this ~20% of the time. Recommended fix: per-(userId, purpose)
   advisory lock + unique partial index on `(userId, purpose) WHERE
   consumedAt IS NULL`. This is a ~5-line change to `src/lib/otp.ts`
   and a 1-line SQL migration — NOT a feature, a correctness fix.

2. **PENDING — Configure Resend credentials and verify real inbox
   delivery (§3).** Do NOT mark Resend E2E as passed until a real OTP
   email arrives in a real inbox.

3. **Pre-deploy — Run the `prisma migrate diff` commands in §1.3
   against production BEFORE running `prisma db push`.** Confirm the
   output is purely additive. Do NOT use `--accept-data-loss`.

4. **Post-deploy — Run `qa-v2/seed-qa.ts` + `qa-v2/test-*.ts` against
   a staging database (NOT production) to confirm the V2 schema and
   OTP semantics work end-to-end in a production-like environment.**
   The QA scripts are safe to re-run (they use dedicated QA users and
   clean up after themselves).

---

## Appendix A — QA artifacts

| File | Purpose |
|------|---------|
| `qa-v2/seed-qa.ts` | Creates 3 dedicated QA users in the QA database. Idempotent. |
| `qa-v2/test-1-otp-invalid-attempts.ts` | 20 parallel invalid OTP submissions. |
| `qa-v2/test-2-otp-resend.ts` | 10 parallel + 10 serial resend requests. |
| `qa-v2/test-3-otp-verify-concurrent.ts` | 5 concurrent valid OTP verifies. |
| `qa-v2/test-4-password-reset-e2e.ts` | Full password reset success path. |
| `qa-v2/test-5-legacy-session.ts` | Legacy session compatibility (pre-V2 cookie vs DB v0/v1). |
| `qa-v2/output/00-seed.log` | Seed run log. |
| `qa-v2/output/01-test-1.log` | Test 1 run log. |
| `qa-v2/output/02-test-2.log` | Test 2 run log (shows the race failure). |
| `qa-v2/output/03-test-3.log` | Test 3 run log. |
| `qa-v2/output/04-test-4.log` | Test 4 run log. |
| `qa-v2/output/05-test-5.log` | Test 5 run log. |
| `qa-v2/QA-V2-REPORT.md` | This file. |

## Appendix B — How to reproduce the QA

```bash
# 1. Stand up a local PostgreSQL (any method; the QA scripts assume
#    postgresql://qa@127.0.0.1:5433/qa_db).
createdb -h 127.0.0.1 -p 5433 -U qa qa_db

# 2. Apply the V2 schema to it.
cd /home/z/my-project/anima-companion
DATABASE_URL="postgresql://qa@127.0.0.1:5433/qa_db?schema=public" \
DIRECT_URL="postgresql://qa@127.0.0.1:5433/qa_db?schema=public" \
bunx prisma db push

# 3. Seed QA users.
DATABASE_URL="..." DIRECT_URL="..." AUTH_SECRET="qa-test-secret" \
bun run qa-v2/seed-qa.ts

# 4. Run each test (each is independent; tests 1-3 share the
#    qa-v2-verify user, so re-run seed-qa between tests 1/2/3 if
#    you want a clean slate — though each test cleans up its own
#    OTP rows at the start).
for t in 1 2 3 4 5; do
  DATABASE_URL="..." DIRECT_URL="..." AUTH_SECRET="qa-test-secret" \
  bun run qa-v2/test-${t}-*.ts
done
```
