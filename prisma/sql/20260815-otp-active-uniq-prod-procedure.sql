-- ============================================================================
-- Production OTP index — audit + apply + verify procedure
--
-- Run this entire script against the PRODUCTION DATABASE_URL using psql:
--   psql "$PROD_DATABASE_URL" -f /tmp/otp-index-prod-procedure.sql
--
-- The script:
--   1. AUDITs existing OtpCode rows for violations of the invariant
--      (more than one unconsumed row per (userId, purpose)).
--   2. REFUSES to apply the index if violations exist (you must reconcile
--      manually first).
--   3. APPLIES the partial unique index additively (CREATE UNIQUE INDEX
--      IF NOT EXISTS — non-destructive, idempotent).
--   4. VERIFIES the index exists in the catalog after application.
--
-- All steps are READ-ONLY except step 3, which is a single additive
-- CREATE INDEX. No DROP, no ALTER COLUMN, no row mutation, no
-- --accept-data-loss, no prisma db push.
-- ============================================================================

\echo '================================================================'
\echo 'STEP 1: AUDIT — find (userId, purpose) groups with >1 unconsumed OTP'
\echo '================================================================'

SELECT "userId", purpose, COUNT(*) AS active_count,
       array_agg(id ORDER BY "createdAt" DESC) AS active_otp_ids,
       MAX("createdAt") AS newest_created_at
FROM "OtpCode"
WHERE "consumedAt" IS NULL
GROUP BY "userId", purpose
HAVING COUNT(*) > 1
ORDER BY active_count DESC;

\echo ''
\echo 'If the query above returned 0 rows, the invariant is intact.'
\echo 'If it returned ANY rows, STOP — reconcile manually before applying'
\echo 'the index. Reconciliation SQL is in'
\echo 'prisma/sql/20260815-otp-active-uniq-backstop.sql section'
\echo '"PRE-APPLICATION CHECKLIST" step 1.'
\echo ''

\echo '================================================================'
\echo 'STEP 2: APPLY — partial unique index (additive, idempotent)'
\echo '================================================================'

CREATE UNIQUE INDEX IF NOT EXISTS "OtpCode_userId_purpose_active_uniq"
  ON "OtpCode"("userId", "purpose")
  WHERE "consumedAt" IS NULL;

\echo ''
\echo 'Index applied (or already existed — IF NOT EXISTS is idempotent).'
\echo ''

\echo '================================================================'
\echo 'STEP 3: VERIFY — confirm the index is present in the catalog'
\echo '================================================================'

SELECT
  i.relname AS index_name,
  t.relname AS table_name,
  pg_get_indexdef(i.oid) AS index_definition,
  CASE WHEN indisunique THEN 'UNIQUE' ELSE 'non-unique' END AS uniqueness
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
WHERE t.relname = 'OtpCode'
  AND i.relname = 'OtpCode_userId_purpose_active_uniq';

\echo ''
\echo 'If the query above returned exactly 1 row with uniqueness=UNIQUE,'
\echo 'the index is present and the invariant is now enforced at the DB level.'
\echo '================================================================'
