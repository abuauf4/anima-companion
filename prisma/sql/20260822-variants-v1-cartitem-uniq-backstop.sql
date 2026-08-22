-- ============================================================================
-- Product Variants V1 — CartItem unique-index migration.
--
-- *** THIS IS NOT A PRISMA MIGRATION. ***
--
-- This file documents + provides the DDL for the CartItem unique-constraint
-- change required by the Product Variants phase.
--
-- BACKGROUND
-- ----------
-- The previous CartItem schema had:
--     @@unique([cartId, productId])
-- which enforced "one cart line per product per cart". With variants, the
-- same product can appear in the cart multiple times with different
-- `variantId` values (e.g. one line for "10 kapsul" and another for
-- "30 kapsul" of the same product). The Prisma schema now declares:
--     @@unique([cartId, productId, variantId])
-- which `prisma db push` will translate to a composite unique index.
--
-- HOWEVER — Postgres treats NULLs as DISTINCT in unique indexes. This means
-- two non-variant cart items (variantId IS NULL) for the same (cartId,
-- productId) would NOT collide at the DB level — the unique constraint
-- would let both rows coexist. The app-level `addItem` merge logic in
-- `src/lib/store.ts` is the primary guard that prevents this for non-variant
-- products, but a DB-level backstop is desirable for defense-in-depth
-- (matches the pattern used by `20260815-otp-active-uniq-backstop.sql`).
--
-- HOW TO APPLY
-- ------------
-- Run this against your target database AFTER `prisma db push` has created
-- the new composite unique index. The composite index created by db push
-- is a "normal" unique index that allows multiple NULLs — this partial
-- index is the strict backstop for the NULL case.
--
--     psql "$DIRECT_URL" -f prisma/sql/20260822-variants-v1-cartitem-uniq-backstop.sql
--
-- SAFETY
-- ------
-- This script includes a built-in duplicate pre-check (lines 60-80) that
-- ABORTS the script with a clear error message if the existing CartItem
-- data has duplicates among non-variant rows. If you see the abort
-- message, run this query to find the offending rows:
--
--     SELECT cartId, productId, COUNT(*)
--     FROM "CartItem"
--     WHERE "variantId" IS NULL
--     GROUP BY cartId, productId
--     HAVING COUNT(*) > 1;
--
-- Fix the duplicates (merge quantities into one row, delete the others),
-- then re-run this script.
-- ============================================================================

-- Drop the legacy composite unique constraint if it still exists (db push
-- would have already dropped it when the schema-level @@unique changed, but
-- this is idempotent safety).
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_productId_key";

-- The composite (cartId, productId, variantId) unique index is created by
-- `prisma db push` from the @@unique declaration in schema.prisma. We do
-- NOT recreate it here — db push handles it.

-- ---- Duplicate pre-check (ABORTS on failure) ----
-- Before creating the partial unique index, verify that no duplicate
-- non-variant cart items exist. If duplicates are found, abort with a
-- clear error so the operator can fix the data first — otherwise the
-- CREATE UNIQUE INDEX below would fail with a less helpful message.
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT cartId, productId
    FROM "CartItem"
    WHERE "variantId" IS NULL
    GROUP BY cartId, productId
    HAVING COUNT(*) > 1
  ) AS dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'ABORTING: found % groups of duplicate non-variant cart items. '
      'Run this query to find them: '
      'SELECT cartId, productId, COUNT(*) FROM "CartItem" '
      'WHERE "variantId" IS NULL GROUP BY cartId, productId HAVING COUNT(*) > 1; '
      'Fix the duplicates (merge quantities, delete extras), then re-run this script.',
      dup_count
      USING ERRCODE = '23000';  -- integrity_constraint_violation
  END IF;
END $$;

-- Partial unique index: for NON-variant cart items (variantId IS NULL),
-- enforce that there is at most ONE row per (cartId, productId). This is
-- the strict backstop that the composite index cannot express because of
-- Postgres NULL-distinct semantics.
--
-- This index is NON-CONFLICTING with the Prisma-generated composite unique
-- index "CartItem_cartId_productId_variantId_key" because:
--   1. Different name (suffix "_null_backstop" vs "_key").
--   2. Different scope (partial WHERE variantId IS NULL vs full table).
--   3. Different column list ((cartId, productId) vs (cartId, productId, variantId)).
-- Postgres allows multiple unique indexes on overlapping column sets as
-- long as they have different names or different definitions.
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_variantId_null_backstop"
  ON "CartItem" ("cartId", "productId")
  WHERE "variantId" IS NULL;

-- ============================================================================
-- Idempotency note:
--   * `DROP CONSTRAINT IF EXISTS` is safe to re-run.
--   * `DO $$ ... $$` block is safe to re-run (it just re-checks; if no
--     duplicates, it's a no-op).
--   * `CREATE UNIQUE INDEX IF NOT EXISTS` is safe to re-run.
--
-- Conflict note:
--   * This script does NOT create or drop the composite unique index
--     "CartItem_cartId_productId_variantId_key" — that is Prisma's
--     responsibility via `prisma db push`. Running this script before
--     or after db push is safe; the recommended order is db push FIRST
--     (so the variantId column exists), then this script.
-- ============================================================================
