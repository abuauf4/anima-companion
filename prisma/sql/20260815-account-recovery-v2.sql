-- ============================================================================
-- Account Recovery & Verification V2 — SQL reference for the schema changes
-- introduced by the OTP / password-reset / sessionVersion foundation.
--
-- *** THIS IS NOT A PRISMA MIGRATION. ***
--
-- The project uses the schema-push workflow (`prisma db push`), NOT the
-- migration workflow (`prisma migrate`). See the header comment in
-- `prisma/schema.prisma` for the full strategy documentation.
--
-- This file exists purely as a paper-trail / audit reference: it documents
-- the DDL that `prisma db push` would apply to a PostgreSQL database that
-- is on the V1 schema (commit 454620e and earlier — Verified Identity V1
-- + Member Registry V1 + Sonner V1) to bring it up to the V2 schema.
--
-- DO NOT RUN THIS BLINDLY IN PRODUCTION. The authoritative way to apply
-- these changes is `bunx prisma db push` against the target DATABASE_URL,
-- which lets Prisma compute the minimal diff against the actual current
-- state of the DB. This SQL is provided so an operator can:
--   (a) review what changed structurally without running anything,
--   (b) replay the DDL by hand in a disaster-recovery / audit scenario
--       where `prisma db push` cannot be used (e.g. the target DB is
--       behind a strict firewall and only psql is allowed).
--
-- SOURCE OF TRUTH: prisma/schema.prisma. If this SQL file and the schema
-- file ever disagree, the SCHEMA FILE IS RIGHT and this SQL file is
-- stale.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) User table: add sessionVersion column
-- ---------------------------------------------------------------------------
-- `sessionVersion` is a monotonically-increasing version number for the
-- user's session authority. Encoded into the HMAC session cookie at sign
-- time and re-checked at every `getCurrentUser()` call. Bumped on
-- password reset so all sessions issued before the bump are immediately
-- invalid — the user must re-authenticate with the new credentials.
--
-- Defaults to 0 so existing rows are backwards-compatible (existing
-- sessions with no `sessionVersion` claim are treated as version 0).
-- ---------------------------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- (2) OtpCode table — 6-digit one-time passwords
-- ---------------------------------------------------------------------------
-- Stores HMAC-SHA-256(6-digit-code, AUTH_SECRET) — never the raw code.
-- See the SECURITY CONTRACT in prisma/schema.prisma for the full
-- rationale of why HMAC (not plain SHA-256) is mandatory for a 6-digit
-- code space.
--
-- Indexes:
--   - (userId, purpose) — for lookup-by-user-and-purpose (the common
--     case in the verify path).
--   - (expiresAt) — for cleanup queries (DELETE WHERE expiresAt < now()).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- (3) PasswordResetGrant table — short-lived single-use reset grants
-- ---------------------------------------------------------------------------
-- Stores SHA-256(32-byte-CSPRNG-grant). SHA-256 is sufficient here
-- (unlike the 6-digit OTP) because the input is 32 bytes of CSPRNG
-- entropy — already brute-force-infeasible.
--
-- `grantHash` is UNIQUE so the same grant can never be issued twice
-- (defense-in-depth; the CSPRNG makes collisions astronomically
-- unlikely, but the unique constraint is a cheap safety net).
-- ---------------------------------------------------------------------------

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
