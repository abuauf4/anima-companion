-- ============================================================================
-- Verified Identity V1 — SQL reference for the schema changes introduced
-- by commit 61983c8 (feat(identity): Verified Identity V1 — Google Sign-In
-- + email verification).
--
-- *** THIS IS NOT A PRISMA MIGRATION. ***
--
-- The project uses the schema-push workflow (`prisma db push`), NOT the
-- migration workflow (`prisma migrate`). See the header comment in
-- `prisma/schema.prisma` for the full strategy documentation.
--
-- This file exists purely as a paper-trail / audit reference: it documents
-- the DDL that `prisma db push` would apply to a PostgreSQL database that
-- is on the PRE-V1 schema (commit bbcb3ae and earlier) to bring it up to
-- the V1 schema (commit 61983c8 and later).
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
-- stale. Regenerate via:
--   bunx prisma migrate diff \
--     --from-empty \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
-- (then trim to just the V1-related DDL — this file intentionally only
--  documents the V1 delta, not the entire schema.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) User table: add identity-provider + verification columns
-- ---------------------------------------------------------------------------
-- `provider` defaults to 'PASSWORD' so existing rows are backwards-compatible.
-- `providerSubject` is the stable Google `sub` claim — unique when set, NULL
--   for PASSWORD users.
-- `emailVerifiedAt` is the authoritative email-verification timestamp;
--   NULL means unverified. Existing rows have NULL (unverified) by default,
--   which is the safe default — operators can backfill verified customers
--   explicitly if they have prior knowledge.
-- ---------------------------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN "provider"        TEXT NOT NULL DEFAULT 'PASSWORD',
  ADD COLUMN "providerSubject" TEXT,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_providerSubject_key"
  ON "User"("providerSubject")
  WHERE "providerSubject" IS NOT NULL;
-- Note: Prisma emits the unique constraint as a partial index (NULLs not
--       considered equal in PostgreSQL by default — but Prisma's @unique
--       on a nullable column is implemented as a unique index that allows
--       multiple NULLs, which is the partial-index form above). Adjust
--       if your Postgres version / Prisma engine emits a different shape.

-- ---------------------------------------------------------------------------
-- (2) EmailVerificationToken table — single-use, time-limited tokens
-- ---------------------------------------------------------------------------
-- `tokenHash` is the SHA-256 hex of the raw 32-byte CSPRNG token. The raw
--   token is NEVER stored — a DB compromise does not reveal active tokens.
-- `expiresAt` is 24h after creation.
-- `consumedAt` is NULL until the token is consumed by the verify route.
--   Once non-NULL the token can never be used again.
-- `userId` FK references User(id) with ON DELETE CASCADE — if the user is
--   deleted, their tokens are deleted too (no orphans).
-- ---------------------------------------------------------------------------

CREATE TABLE "EmailVerificationToken" (
  "id"         TEXT                  NOT NULL,
  "userId"     TEXT                  NOT NULL,
  "tokenHash"  TEXT                  NOT NULL,
  "expiresAt"  TIMESTAMP(3)          NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key"
  ON "EmailVerificationToken"("tokenHash");

CREATE INDEX "EmailVerificationToken_userId_idx"
  ON "EmailVerificationToken"("userId");

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- (3) Seed updates (NOT DDL — informational only)
-- ---------------------------------------------------------------------------
-- prisma/seed.ts sets provider='PASSWORD' + emailVerifiedAt=now() on the
-- demo admin / demo customer / bootstrap admin. This means dev/demo users
-- are pre-verified. Production users created via /api/auth/register start
-- with emailVerifiedAt=NULL and must verify via the email flow. Google
-- users created via the OAuth callback get emailVerifiedAt=now() at
-- creation time (Google's email_verified claim is the trusted authority).
-- ---------------------------------------------------------------------------
