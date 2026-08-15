-- ============================================================================
-- Admin Realm V1 — Developer RBAC
-- Date: 2026-08-16
-- Reference: prisma/schema.prisma (AdminUser, AdminPermission models)
-- ============================================================================
--
-- PURPOSE:
--   Separate the internal admin identity realm from the customer/member
--   registry (User). Admins no longer authenticate via `User.role = ADMIN`
--   + `anima_session`. Instead they use `AdminUser` + `anima_admin_session`.
--
--   This file is a PAPER-TRAIL reference of the DDL that `prisma db push`
--   applies to bring a target database in sync with the schema. It is NOT
--   a Prisma migration — this project uses the schema-push workflow (see
--   the long comment at the top of prisma/schema.prisma). To apply:
--
--     bun run db:push
--
--   Or replay this SQL by hand against a database if `db push` cannot be
--   run for operational reasons.
--
-- SAFETY:
--   - ADDITIVE ONLY — no DROP, no ALTER COLUMN TYPE that loses data, no
--     DELETE of existing rows.
--   - Does NOT touch the `User` table. Customer registry is preserved.
--   - Does NOT drop the `role` column on `User` (legacy admin path is
--     DEPRECATED but kept for V1 cutover safety — see worklog).
--
-- VERIFICATION (operator-side):
--   After applying, verify:
--     SELECT to_regclass('AdminUser');       -- must return 'AdminUser'
--     SELECT to_regclass('AdminPermission'); -- must return 'AdminPermission'
--     SELECT indexname FROM pg_indexes WHERE tablename = 'AdminPermission';
--     -- must include the (adminUserId, permissionKey) unique index
-- ============================================================================

-- ==================== AdminUser ====================
CREATE TABLE "AdminUser" (
    "id"                  TEXT           NOT NULL,
    "username"            TEXT           NOT NULL,
    "passwordHash"        TEXT           NOT NULL,
    "displayName"         TEXT           NOT NULL,
    "systemRole"          TEXT           NOT NULL DEFAULT 'ADMIN',
    "isActive"            BOOLEAN        NOT NULL DEFAULT true,
    "mustChangePassword"  BOOLEAN        NOT NULL DEFAULT true,
    "sessionVersion"      INTEGER        NOT NULL DEFAULT 0,
    "createdByAdminId"    TEXT,
    "lastLoginAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE INDEX "AdminUser_createdByAdminId_idx" ON "AdminUser"("createdByAdminId");

ALTER TABLE "AdminUser"
    ADD CONSTRAINT "AdminUser_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ==================== AdminPermission ====================
CREATE TABLE "AdminPermission" (
    "id"             TEXT           NOT NULL,
    "adminUserId"    TEXT           NOT NULL,
    "permissionKey"  TEXT           NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPermission_adminUserId_permissionKey_key"
    ON "AdminPermission"("adminUserId", "permissionKey");
CREATE INDEX "AdminPermission_adminUserId_idx" ON "AdminPermission"("adminUserId");

ALTER TABLE "AdminPermission"
    ADD CONSTRAINT "AdminPermission_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
