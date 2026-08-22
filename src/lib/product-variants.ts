/**
 * Product variant helpers.
 *
 * Single source of truth for:
 *   - Deriving parent Product price/salePrice/stock from active variants.
 *   - Validating admin-supplied variant payloads.
 *   - Computing the public-facing "lowest price" / "Mulai Rp..." value.
 *
 * Used by:
 *   - admin product create/update routes (recompute parent cache on save)
 *   - checkout (recompute parent cache after stock decrement)
 *   - duplicate route (clone variants)
 *   - public APIs (no derivation needed there — parent cache is already
 *     kept in sync by the writers above; we only read it)
 *   - frontend ProductCard / ProductDetailView (display logic)
 *
 * INVARIANTS:
 *   - When `Product.hasVariants = false`, parent price/salePrice/stock are
 *     authoritative and these helpers are NOT called.
 *   - When `Product.hasVariants = true`, parent price/salePrice/stock are
 *     a derived cache. The derivation rules are:
 *       * Winner variant = the ACTIVE variant with the LOWEST effective
 *                         selling price (salePrice if set & < price, else
 *                         price). Ties broken by lowest `sortOrder` for
 *                         determinism. The winner is what the storefront
 *                         shows as the "Mulai Rp..." price.
 *       * `price`     = the WINNER's NORMAL `price` (NOT its effective /
 *                       discounted price). This is critical: the parent
 *                       `price` must always be the un-discounted regular
 *                       price of the winning variant so the storefront's
 *                       strikethrough + discount % math works.
 *       * `salePrice` = the WINNER's `salePrice` (may be null if the winner
 *                       has no active discount). This pairs with `price`
 *                       above so `discountPercent(price, salePrice)` returns
 *                       the correct discount %.
 *       * `stock`     = sum of variant.stock across ALL ACTIVE variants
 *                       (regardless of which variant won the price race).
 *   - If a product has `hasVariants = true` but ZERO active variants
 *     (edge case — admin deactivated all), the parent cache is set to
 *     `price = 0, salePrice = null, stock = 0`. The product will appear
 *     "out of stock" on the public site. The admin UI must prevent saving
 *     a variant product with zero active variants.
 */

/**
 * Effective selling price for a variant: salePrice if set AND less than
 * price, else price. Mirrors `effectivePrice` in lib/format.ts but operates
 * on the variant shape so we don't have a circular import.
 */
export function variantEffectivePrice(variant: {
  price: number
  salePrice: number | null
}): number {
  return variant.salePrice && variant.salePrice < variant.price
    ? variant.salePrice
    : variant.price
}

/**
 * Input shape for the derivation function. Accepts either the Prisma
 * ProductVariant row or a leaner variant-like object — both work as long
 * as the four fields below are present.
 */
export interface VariantLike {
  price: number
  salePrice: number | null
  stock: number
  isActive: boolean
  sortOrder: number
}

/**
 * Derive the parent Product's compatibility-cache fields
 * (price / salePrice / stock) from its active variants.
 *
 * Returns `{ price: 0, salePrice: null, stock: 0 }` if `activeVariants`
 * is empty — callers should ensure this doesn't happen for variant
 * products (admin UI must enforce at least one active variant).
 *
 * The function is PURE — it does not touch the DB. Callers must fetch
 * the variants themselves and pass them in.
 */
export function deriveParentCacheFromVariants(
  allVariants: VariantLike[]
): { price: number; salePrice: number | null; stock: number } {
  const active = allVariants.filter((v) => v.isActive)
  if (active.length === 0) {
    return { price: 0, salePrice: null, stock: 0 }
  }

  // Stock = sum of ALL active variants' stock (regardless of which variant
  // has the lowest price).
  const stock = active.reduce((sum, v) => sum + (v.stock || 0), 0)

  // Pick the winner: ACTIVE variant with the LOWEST effective selling price
  // (salePrice if set & < price, else price). Ties broken by lowest sortOrder
  // for determinism. The winner defines what the storefront shows as the
  // "Mulai Rp..." price.
  const sorted = [...active].sort((a, b) => {
    const pa = variantEffectivePrice(a)
    const pb = variantEffectivePrice(b)
    if (pa !== pb) return pa - pb
    return a.sortOrder - b.sortOrder
  })
  const winner = sorted[0]

  // CRITICAL: parent.price = winner's NORMAL price (not its effective /
  // discounted price). The parent `salePrice` carries the discount.
  // If we stored the effective price in `price`, then `price === salePrice`
  // for discounted winners, which makes `discountPercent(price, salePrice)`
  // return 0 and the UI shows "Hemat 0%" — the exact bug we're fixing.
  //
  // If the winner has a salePrice that is in effect (i.e. < its price),
  // parent.salePrice = winner.salePrice so the discount badge + strikethrough
  // show correctly. Otherwise (winner's salePrice is null OR >= price),
  // the parent has no active sale — set salePrice to null.
  const salePrice =
    winner.salePrice && winner.salePrice < winner.price
      ? winner.salePrice
      : null

  return { price: winner.price, salePrice, stock }
}

// =====================================================
// Admin payload validation
// =====================================================

/**
 * Admin-supplied variant payload shape (POST/PUT /api/admin/products).
 * `id` is optional — present when editing an existing variant, absent
 * when creating a new one.
 */
export interface AdminVariantInput {
  id?: string
  name: string
  price: number | string
  salePrice?: number | string | null
  stock: number | string
  isActive?: boolean
  sortOrder?: number
}

/**
 * Validation result. On success, returns the normalized variants array
 * (with `id` preserved for existing rows, all numbers coerced from
 * strings — the admin form sends strings because <Input type="number">
 * returns string values). On failure, returns a friendly Indonesian
 * error message.
 */
export type VariantValidationResult =
  | { ok: true; variants: NormalizedVariantInput[] }
  | { ok: false; error: string }

export interface NormalizedVariantInput {
  id?: string
  name: string
  price: number
  salePrice: number | null
  stock: number
  isActive: boolean
  sortOrder: number
}

/**
 * Validate an array of admin-supplied variant inputs.
 *
 * Rules enforced:
 *   1. At least 1 variant required when hasVariants=true.
 *   2. At least 1 variant must have isActive=true (otherwise the product
 *      would be invisible on the public site).
 *   3. Variant name must be non-empty (trimmed).
 *   4. Variant names must be unique (case-insensitive after trim).
 *   5. price must be a positive integer (> 0).
 *   6. salePrice (if provided) must be a positive integer AND < price.
 *   7. stock must be a non-negative integer (>= 0).
 *   8. sortOrder defaults to the variant's position in the array.
 *
 * The function is PURE — no DB access.
 */
export function validateAdminVariants(
  inputs: AdminVariantInput[] | undefined | null
): VariantValidationResult {
  if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: 'Produk varian harus memiliki minimal 1 varian' }
  }

  const normalized: NormalizedVariantInput[] = []
  const seenNames = new Set<string>()

  for (let i = 0; i < inputs.length; i++) {
    const v = inputs[i]

    // Name
    const name = (v?.name ?? '').toString().trim()
    if (!name) {
      return { ok: false, error: `Varian #${i + 1}: nama varian wajib diisi` }
    }
    const nameKey = name.toLowerCase()
    if (seenNames.has(nameKey)) {
      return { ok: false, error: `Varian #${i + 1}: nama varian "${name}" sudah digunakan` }
    }
    seenNames.add(nameKey)

    // Price
    const price = typeof v.price === 'string' ? parseInt(v.price, 10) : v.price
    if (!Number.isInteger(price) || price <= 0) {
      return { ok: false, error: `Varian #${i + 1} (${name}): harga harus lebih besar dari 0` }
    }

    // Sale price
    let salePrice: number | null = null
    if (v.salePrice !== undefined && v.salePrice !== null && v.salePrice !== '') {
      const sp =
        typeof v.salePrice === 'string' ? parseInt(v.salePrice, 10) : v.salePrice
      if (!Number.isInteger(sp) || sp <= 0) {
        return { ok: false, error: `Varian #${i + 1} (${name}): harga diskon harus lebih besar dari 0` }
      }
      if (sp >= price) {
        return { ok: false, error: `Varian #${i + 1} (${name}): harga diskon harus lebih kecil dari harga normal` }
      }
      salePrice = sp
    }

    // Stock
    const stock = typeof v.stock === 'string' ? parseInt(v.stock, 10) : v.stock
    if (!Number.isInteger(stock) || stock < 0) {
      return { ok: false, error: `Varian #${i + 1} (${name}): stok tidak boleh negatif` }
    }

    normalized.push({
      id: v.id || undefined,
      name,
      price,
      salePrice,
      stock,
      isActive: v.isActive !== false, // default true
      sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : i,
    })
  }

  // At least one active variant
  if (!normalized.some((v) => v.isActive)) {
    return { ok: false, error: 'Minimal satu varian harus aktif' }
  }

  return { ok: true, variants: normalized }
}
