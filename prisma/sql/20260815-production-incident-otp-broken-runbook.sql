-- ============================================================================
-- PRODUCTION INCIDENT RUNBOOK — verification OTP broken (20260815)
--
-- Symptom (user-facing):
--   Register succeeds → /verify-email loads.
--   No OTP email arrives.
--   Clicking "Kirim ulang kode" → toast "Terjadi kesalahan server".
--
-- Most likely root cause (code-based analysis — see final report):
--   Production PostgreSQL is still on V1 schema (Verified Identity V1,
--   commit 454620e and earlier). The V2 code at HEAD (commit 1c2cf3b)
--   calls `db.otpCode.*` and `db.user.findUnique({ select: { sessionVersion } })`
--   in `requireAuth`/`issueOtp`. If the production DB is missing the
--   `OtpCode` table OR the `User.sessionVersion` column, those calls
--   throw PrismaClientKnownRequestError (P2021 "table does not exist" /
--   P2009 "column does not exist").
--
--   In src/app/api/auth/register/route.ts the `issueOtp` call is wrapped
--   in a try/catch that swallows the error → user is still registered and
--   redirected to /verify-email, but no OTP email is sent (matches
--   symptom #2).
--
--   In src/app/api/auth/verify-email/send-otp/route.ts the `issueOtp`
--   call is OUTSIDE the inner try/catch (only `sendOtpEmail` is inner-
--   caught). If `issueOtp` throws, the outer catch returns HTTP 500 with
--   `{ error: 'Terjadi kesalahan server' }`. The frontend `handleResend`
--   falls through to `toast.error(data.error)` → "Terjadi kesalahan
--   server" (matches symptom #3).
--
--   The V2 code itself is CORRECT for a V2 schema DB (verified by the
--   QA suite at qa-v2/). The fix is to bring production to V2 schema
--   parity additively, then verify the email env vars are configured.
--
-- THIS FILE IS A SINGLE OPERATOR-RUNNABLE PROCEDURE.
-- It is purely ADDITIVE: no DROP, no ALTER COLUMN TYPE, no row mutation,
-- no --accept-data-loss, no blind prisma db push. Every write step is
-- guarded by IF NOT EXISTS / DO-conditional blocks so re-running is
-- safe. The DDL is byte-identical to prisma/sql/20260815-account-recovery-v2.sql
-- (the reviewed V2 reference) — only idempotency guards have been added.
--
-- RUN AGAINST PRODUCTION:
--   psql "$PROD_DATABASE_URL" -f prisma/sql/20260815-production-incident-otp-broken-runbook.sql
--
--   Use the DIRECT (non-pooled) connection string for DDL — see .env.example
--   notes on DIRECT_URL. DDL over PgBouncer pooled connections can fail
--   on some transaction modes.
--
-- OPERATOR WORKFLOW:
--   1. Run STEP 1 (audit) — review output. If anything is missing,
--      continue to STEP 3. If everything is already present, skip to
--      STEP 4 (partial unique index).
--   2. Run STEP 2 (duplicate active OTP audit) — MUST return 0 rows
--      before running STEP 4. If it returns ANY rows, reconcile manually
--      using the SQL in prisma/sql/20260815-otp-active-uniq-backstop.sql
--      "PRE-APPLICATION CHECKLIST" step 1, then re-run STEP 2.
--   3. Run STEP 3 (apply V2 additive DDL) — idempotent.
--   4. Run STEP 4 (apply partial unique index) — idempotent.
--   5. Run STEP 5 (verify schema parity) — read-only, confirms the
--      final state matches Prisma V2.
--   6. Run STEP 6 (verify partial unique index) — read-only.
--
--   Each step is bracketed by \echo markers so the operator can see
--   progress in psql output. Steps 1, 2, 5, 6 are READ-ONLY. Steps 3, 4
--   are ADDITIVE WRITES (IF NOT EXISTS / DO-conditional).
--
-- IF THE OPERATOR PREFERS TO USE PRISMA INSTEAD:
--   1. Generate the minimal diff:
--        bunx prisma migrate diff \
--          --from-url "$PROD_DATABASE_URL" \
--          --to-schema-datamodel prisma/schema.prisma \
--          --script > /tmp/v2-diff.sql
--   2. Review /tmp/v2-diff.sql — it MUST contain ONLY additive statements
--      (CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX, ADD CONSTRAINT).
--      If it contains any DROP, STOP — the production schema has drifted
--      in a way that requires manual reconciliation.
--   3. Apply /tmp/v2-diff.sql via psql (NOT `prisma db push`):
--        psql "$PROD_DATABASE_URL" -f /tmp/v2-diff.sql
--   4. Then run STEP 4 of this file (the partial unique index — Prisma
--      cannot express partial unique indexes in its schema language, so
--      it must always be applied via raw SQL).
--
--   The choice between the inline DDL in STEP 3 below vs the
--   `prisma migrate diff` approach is up to the operator — both produce
--   the same final schema state. The inline DDL is provided for
--   environments where the operator has psql but not the repo / bun.
-- ============================================================================


\echo '================================================================'
\echo 'STEP 1: SCHEMA AUDIT (read-only) — current V2 parity state'
\echo '================================================================'
\echo 'Checks for: User.sessionVersion, OtpCode table + all columns,'
\echo 'PasswordResetGrant table + all columns.'
\echo 'Rows where present=true are already in place; present=false are missing.'
\echo ''

-- User.sessionVersion column
SELECT
  'User.sessionVersion' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'sessionVersion'
  ) THEN true ELSE false END AS present,
  (SELECT data_type FROM information_schema.columns
     WHERE table_name = 'User' AND column_name = 'sessionVersion') AS data_type,
  (SELECT column_default FROM information_schema.columns
     WHERE table_name = 'User' AND column_name = 'sessionVersion') AS column_default;

-- OtpCode table existence
SELECT
  'OtpCode (table)' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'OtpCode'
  ) THEN true ELSE false END AS present,
  NULL AS data_type,
  NULL AS column_default;

-- OtpCode columns (only checked if the table exists)
SELECT
  'OtpCode.' || column_name AS object,
  true AS present,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'OtpCode'
  AND column_name IN (
    'id', 'userId', 'purpose', 'codeHash', 'attempts',
    'maxAttempts', 'expiresAt', 'consumedAt', 'lastSentAt', 'createdAt'
  )
ORDER BY column_name;

-- OtpCode indexes
SELECT
  'OtpCode index ' || indexname AS object,
  true AS present,
  NULL AS data_type,
  NULL AS column_default
FROM pg_indexes
WHERE tablename = 'OtpCode';

-- PasswordResetGrant table existence
SELECT
  'PasswordResetGrant (table)' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'PasswordResetGrant'
  ) THEN true ELSE false END AS present,
  NULL AS data_type,
  NULL AS column_default;

-- PasswordResetGrant columns (only checked if the table exists)
SELECT
  'PasswordResetGrant.' || column_name AS object,
  true AS present,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'PasswordResetGrant'
  AND column_name IN (
    'id', 'userId', 'grantHash', 'expiresAt', 'consumedAt', 'createdAt'
  )
ORDER BY column_name;

-- PasswordResetGrant indexes
SELECT
  'PasswordResetGrant index ' || indexname AS object,
  true AS present,
  NULL AS data_type,
  NULL AS column_default
FROM pg_indexes
WHERE tablename = 'PasswordResetGrant';


\echo ''
\echo '================================================================'
\echo 'STEP 2: DUPLICATE ACTIVE OTP AUDIT (read-only) — pre-index safety'
\echo '================================================================'
\echo 'Returns (userId, purpose) groups with MORE THAN ONE unconsumed OTP.'
\echo 'MUST return 0 rows before running STEP 4. If any rows appear,'
\echo 'reconcile manually using the SQL in'
\echo 'prisma/sql/20260815-otp-active-uniq-backstop.sql section'
\echo '"PRE-APPLICATION CHECKLIST" step 1, then re-run this step.'
\echo 'If the OtpCode table does not exist yet (STEP 1 reported it missing),'
\echo 'this query will fail with "relation does not exist" — that is'
\echo 'expected; run STEP 3 first, then re-run this step.'
\echo ''

SELECT "userId", purpose, COUNT(*) AS active_count,
       array_agg(id ORDER BY "createdAt" DESC) AS active_otp_ids,
       MAX("createdAt") AS newest_created_at
FROM "OtpCode"
WHERE "consumedAt" IS NULL
GROUP BY "userId", purpose
HAVING COUNT(*) > 1
ORDER BY active_count DESC;


\echo ''
\echo '================================================================'
\echo 'STEP 3: APPLY V2 ADDITIVE DDL (idempotent)'
\echo '================================================================'
\echo 'All statements use IF NOT EXISTS / DO-conditional guards so this'
\echo 'step is safe to re-run. No DROP, no ALTER COLUMN TYPE, no row'
\echo 'mutation. The DDL is byte-identical to'
\echo 'prisma/sql/20260815-account-recovery-v2.sql — only idempotency'
\echo 'guards have been added.'
\echo ''

-- ---------------------------------------------------------------------------
-- (3.1) User.sessionVersion — additive column, default 0 (backwards-compat).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'sessionVersion'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added column User.sessionVersion';
  ELSE
    RAISE NOTICE 'Column User.sessionVersion already exists — skipping';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- (3.2) OtpCode table — 6-digit one-time passwords.
--   Stores HMAC-SHA-256(6-digit-code, AUTH_SECRET) — never the raw code.
--   Idempotent: CREATE TABLE IF NOT EXISTS + DO-conditional constraints/indexes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OtpCode" (
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

-- OtpCode indexes (idempotent)
CREATE INDEX IF NOT EXISTS "OtpCode_userId_purpose_idx" ON "OtpCode"("userId", "purpose");
CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx"       ON "OtpCode"("expiresAt");

-- OtpCode FK to User (idempotent — guarded by pg_constraint lookup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OtpCode_userId_fkey'
  ) THEN
    ALTER TABLE "OtpCode"
      ADD CONSTRAINT "OtpCode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Added constraint OtpCode_userId_fkey';
  ELSE
    RAISE NOTICE 'Constraint OtpCode_userId_fkey already exists — skipping';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- (3.3) PasswordResetGrant table — short-lived single-use reset grants.
--   Stores SHA-256(32-byte-CSPRNG-grant) — never the raw grant.
--   Idempotent: CREATE TABLE IF NOT EXISTS + DO-conditional constraints/indexes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PasswordResetGrant" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "grantHash"  TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetGrant_pkey" PRIMARY KEY ("id")
);

-- PasswordResetGrant indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetGrant_grantHash_key"
  ON "PasswordResetGrant"("grantHash");
CREATE INDEX IF NOT EXISTS "PasswordResetGrant_userId_idx"
  ON "PasswordResetGrant"("userId");

-- PasswordResetGrant FK to User (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetGrant_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordResetGrant"
      ADD CONSTRAINT "PasswordResetGrant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Added constraint PasswordResetGrant_userId_fkey';
  ELSE
    RAISE NOTICE 'Constraint PasswordResetGrant_userId_fkey already exists — skipping';
  END IF;
END$$;


\echo ''
\echo '================================================================'
\echo 'STEP 4: APPLY PARTIAL UNIQUE INDEX (idempotent)'
\echo '================================================================'
\echo 'Defense-in-depth backstop for the OTP issuance concurrency invariant:'
\echo 'at most ONE unconsumed OTP per (userId, purpose).'
\echo ''
\echo 'REQUIRES: STEP 2 returned 0 rows. If STEP 2 returned ANY rows,'
\echo 'STOP and reconcile manually first.'
\echo ''

CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_userId_purpose_active_uniq"
  ON "OtpCode"("userId", "purpose")
  WHERE "consumedAt" IS NULL;


\echo ''
\echo '================================================================'
\echo 'STEP 5: VERIFY SCHEMA PARITY (read-only) — V2 must be 100% present'
\echo '================================================================'
\echo 'Confirms every V2 object exists. Any row with present=false means'
\echo 'STEP 3 failed for that object — re-run STEP 3 and investigate.'
\echo ''

-- Expected V2 objects checklist — each row is (object_name, present).
-- Uses UNION ALL of small EXISTS checks so the query is easy to read
-- and easy to extend. Order is grouped by table for readability.
SELECT 'User.sessionVersion' AS object_name,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='User' AND column_name='sessionVersion') AS present
UNION ALL SELECT 'OtpCode (table)',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='OtpCode')
UNION ALL SELECT 'OtpCode.id',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='id')
UNION ALL SELECT 'OtpCode.userId',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='userId')
UNION ALL SELECT 'OtpCode.purpose',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='purpose')
UNION ALL SELECT 'OtpCode.codeHash',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='codeHash')
UNION ALL SELECT 'OtpCode.attempts',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='attempts')
UNION ALL SELECT 'OtpCode.maxAttempts',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='maxAttempts')
UNION ALL SELECT 'OtpCode.expiresAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='expiresAt')
UNION ALL SELECT 'OtpCode.consumedAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='consumedAt')
UNION ALL SELECT 'OtpCode.lastSentAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='lastSentAt')
UNION ALL SELECT 'OtpCode.createdAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='OtpCode' AND column_name='createdAt')
UNION ALL SELECT 'OtpCode_userId_purpose_idx',
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='OtpCode' AND indexname='OtpCode_userId_purpose_idx')
UNION ALL SELECT 'OtpCode_expiresAt_idx',
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='OtpCode' AND indexname='OtpCode_expiresAt_idx')
UNION ALL SELECT 'OtpCode_userId_purpose_active_uniq',
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='OtpCode' AND indexname='OtpCode_userId_purpose_active_uniq')
UNION ALL SELECT 'OtpCode_userId_fkey',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='OtpCode_userId_fkey')
UNION ALL SELECT 'PasswordResetGrant (table)',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='PasswordResetGrant')
UNION ALL SELECT 'PasswordResetGrant.id',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='id')
UNION ALL SELECT 'PasswordResetGrant.userId',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='userId')
UNION ALL SELECT 'PasswordResetGrant.grantHash',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='grantHash')
UNION ALL SELECT 'PasswordResetGrant.expiresAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='expiresAt')
UNION ALL SELECT 'PasswordResetGrant.consumedAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='consumedAt')
UNION ALL SELECT 'PasswordResetGrant.createdAt',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='PasswordResetGrant' AND column_name='createdAt')
UNION ALL SELECT 'PasswordResetGrant_grantHash_key',
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='PasswordResetGrant' AND indexname='PasswordResetGrant_grantHash_key')
UNION ALL SELECT 'PasswordResetGrant_userId_idx',
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename='PasswordResetGrant' AND indexname='PasswordResetGrant_userId_idx')
UNION ALL SELECT 'PasswordResetGrant_userId_fkey',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PasswordResetGrant_userId_fkey')
ORDER BY 1;


\echo ''
\echo '================================================================'
\echo 'STEP 6: VERIFY PARTIAL UNIQUE INDEX (read-only)'
\echo '================================================================'
\echo 'Confirms the index is present, UNIQUE, and has the correct predicate.'
\echo ''

SELECT
  i.relname AS index_name,
  t.relname AS table_name,
  pg_get_indexdef(i.oid) AS index_definition,
  CASE WHEN indisunique THEN 'UNIQUE' ELSE 'non-unique' END AS uniqueness,
  CASE WHEN indpred IS NOT NULL THEN pg_get_expr(indpred, indrelid) ELSE '(none)' END AS predicate
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
WHERE t.relname = 'OtpCode'
  AND i.relname = 'OtpCode_userId_purpose_active_uniq';

\echo ''
\echo '================================================================'
\echo 'RUNBOOK COMPLETE'
\echo '================================================================'
\echo 'If STEP 5 reports every object present=true AND STEP 6 returns 1 row'
\echo 'with uniqueness=UNIQUE and predicate = (consumedAt IS NULL),'
\echo 'production schema is at V2 parity. Proceed to email env var'
\echo 'configuration and the smoke test (see final incident report).'
\echo '================================================================'
