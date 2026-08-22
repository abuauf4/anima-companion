import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'

/**
 * DELETE /api/admin/products/[id]/permanent
 *
 * HARD DELETE a product. Completely separate from the existing
 * `DELETE /api/admin/products/[id]` route, which is a SOFT delete
 * (sets `isActive: false`). That route's behavior is unchanged.
 *
 * Safety contract (per task brief):
 *
 *   1. BLOCK if the product has any historical / transactional data that
 *      must be preserved:
 *        - `OrderItem`  — any order line referencing this product.
 *                         (OrderItem.product has no `onDelete` clause,
 *                          so the DB would reject the delete anyway; we
 *                          check explicitly first to give a friendly error.)
 *        - `Review`     — any review referencing this product.
 *                         (Review.product is `onDelete: Cascade`, so the
 *                          DB would silently delete them — we MUST check
 *                          first to preserve review history.)
 *
 *   2. If the product is safe to hard-delete, we EXPLICITLY delete the
 *      child / junction rows that are safe to remove, then delete the
 *      Product row itself. Explicit deletion makes the destructive
 *      operation visible in code (instead of relying on cascade).
 *      Cascade-safe relations we explicitly clean up:
 *        - `CartItem`   — active cart references (no historical meaning).
 *        - `Wishlist`   — user wishlist references (no historical meaning).
 *        - `ProductImage`    — DB rows only. Physical image files in
 *                               Cloudinary / /public/products/ are NEVER
 *                               touched, because duplicate products
 *                               legitimately reuse the same image URLs.
 *        - `ProductPetType`  — junction rows.
 *        - `ProductProblem`  — junction rows.
 *
 *   3. The Product row is deleted LAST. After that, no orphan rows
 *      remain in any table.
 *
 *   4. No schema change, no migration. This route only uses existing
 *      fields/relations on the `Product` model.
 *
 * Auth: requires `products.manage` (same as create/update/delete).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('products.manage')
    const { id } = await params

    // ---- 1. Load product + counts of all dependent relations ----------
    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            orderItems: true,
            reviews: true,
            cartItems: true,
            wishlist: true,
            images: true,
            petTypes: true,
            problems: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    // ---- 2. Block if there is historical / transactional data ---------
    // OrderItem: order history must be preserved for accounting & reports.
    // Review: customer reviews must be preserved (review history).
    if (product._count.orderItems > 0 || product._count.reviews > 0) {
      const blockers: string[] = []
      if (product._count.orderItems > 0) {
        blockers.push(`${product._count.orderItems} order item(s)`)
      }
      if (product._count.reviews > 0) {
        blockers.push(`${product._count.reviews} review(s)`)
      }
      return NextResponse.json(
        {
          error:
            'Produk tidak bisa dihapus permanen karena memiliki data historis/transaksi. ' +
            'Silakan nonaktifkan produk saja. Data yang menghalangi: ' +
            blockers.join(', ') +
            '.',
          blockers,
          // Helpful hints for the UI
          canDeactivate: true,
          orderItemCount: product._count.orderItems,
          reviewCount: product._count.reviews,
        },
        { status: 409 }
      )
    }

    // ---- 3. Safe to hard-delete: clean up child/junction rows first ---
    // All of these have `onDelete: Cascade` on the Product relation, so
    // they would be auto-deleted by the DB anyway. We delete them
    // explicitly so the destructive operation is visible in code and so
    // we get a clean, predictable outcome regardless of any future
    // schema drift.
    //
    // Image URLs (Cloudinary / /public/products/*.webp) are NEVER
    // deleted from storage — duplicate products legitimately reuse the
    // same image URLs, and we have no way to know if any other product
    // (or any duplicate) still references them.

    // Active cart references — abandoned-cart cleanup, no historical meaning.
    await db.cartItem.deleteMany({ where: { productId: id } })

    // Wishlist references — users will simply lose the wishlist entry;
    // no historical record is destroyed.
    await db.wishlist.deleteMany({ where: { productId: id } })

    // Junction tables — pure relation rows, no business meaning.
    await db.productPetType.deleteMany({ where: { productId: id } })
    await db.productProblem.deleteMany({ where: { productId: id } })

    // ProductImage DB rows. Physical image files are left alone on
    // purpose — see comment above.
    await db.productImage.deleteMany({ where: { productId: id } })

    // ---- 4. Finally, delete the Product row itself --------------------
    await db.product.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      id,
      name: product.name,
    })
  } catch (e: any) {
    console.error('Permanent delete product error:', e)
    const authRes = handleAuthError(e)
    if (authRes) return authRes

    // Defense-in-depth: even though we check _count.orderItems first, a
    // race condition could in theory let an OrderItem be created between
    // our check and our delete. If that happens, Postgres will reject
    // the delete with a foreign-key violation (P2003). Surface it as a
    // friendly error rather than a raw 500.
    if (e?.code === 'P2003') {
      return NextResponse.json(
        {
          error:
            'Produk tidak bisa dihapus permanen karena masih direferensikan oleh data transaksi lain. ' +
            'Silakan nonaktifkan produk saja.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
