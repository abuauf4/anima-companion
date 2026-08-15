// ============================================================================
// Admin Permission Keys — V1 RBAC.
//
// Authoritative list of permission keys for ADMIN users. DEVELOPER bypasses
// all permission checks (see src/lib/admin-auth.ts → requirePermission);
// ADMIN gets only the keys present in their AdminPermission rows.
//
// WHY A TS CONSTANT (not a DB enum):
//   - An enum/check-constraint per key is brittle to evolve — adding a new
//     key requires a migration. A TS const lets us add keys by editing one
//     file; the create/update-admin API rejects unknown keys before writing.
//   - The const is imported by both the lib (requirePermission) and the
//     tests (test-admin-realm.ts), so there is ONE source of truth.
//
// KEYS ARE DERIVED FROM THE ACTUAL ADMIN MENU (AdminLayout.NAV_ITEMS) +
// the actual /api/admin/** routes — no invented features.
//
// Naming convention: <resource>.<action>
//   .view   — read-only access (GET)
//   .manage — write access (POST / PATCH / DELETE)
//
// To add a new permission key:
//   1. Add it to PERMISSION_KEYS below.
//   2. Use it in the relevant /api/admin/** route via requirePermission('...').
//   3. (Optional) Surface it in the developer's "Setting User Admin" UI.
// No DB migration required.
// ============================================================================

export const PERMISSION_KEYS = [
  // === Dashboard (read-only stats) ===
  'dashboard.view',

  // === Products ===
  'products.view',
  'products.manage',

  // === Categories ===
  'categories.view',
  'categories.manage',

  // === Orders ===
  'orders.view',
  'orders.manage',

  // === Customers ===
  'customers.view',
  'customers.export',

  // === Banners ===
  'banners.view',
  'banners.manage',

  // === Testimonials ===
  'testimonials.view',
  'testimonials.manage',

  // === FAQs ===
  'faqs.view',
  'faqs.manage',

  // === Vouchers ===
  'vouchers.view',
  'vouchers.manage',

  // === Site Settings ===
  'settings.view',
  'settings.manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

/**
 * Set of valid permission keys for O(1) membership check.
 * Used by the create/update-admin API to reject unknown keys.
 */
export const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS)

/**
 * Returns true iff `key` is a known permission key.
 * Casts unknown string → boolean; never throws.
 */
export function isValidPermissionKey(key: unknown): key is PermissionKey {
  return typeof key === 'string' && PERMISSION_KEY_SET.has(key)
}

// ============================================================================
// systemRole constants — DEVELOPER | ADMIN.
//
// DEVELOPER: highest privilege. Bypasses ALL permission checks. Can manage
//   AdminUser records. Created ONLY by the env-var-driven bootstrap seed
//   (no public API can create a DEVELOPER).
// ADMIN: must be granted explicit AdminPermission rows. Cannot manage
//   AdminUser records (the Setting User Admin menu is hidden from them
//   AND the /api/admin/users/** API returns 403).
// ============================================================================
export const SYSTEM_ROLE_DEVELOPER = 'DEVELOPER' as const
export const SYSTEM_ROLE_ADMIN = 'ADMIN' as const

export type SystemRole = typeof SYSTEM_ROLE_DEVELOPER | typeof SYSTEM_ROLE_ADMIN

export function isDeveloper(role: unknown): role is typeof SYSTEM_ROLE_DEVELOPER {
  return role === SYSTEM_ROLE_DEVELOPER
}

export function isValidSystemRole(role: unknown): role is SystemRole {
  return role === SYSTEM_ROLE_DEVELOPER || role === SYSTEM_ROLE_ADMIN
}
