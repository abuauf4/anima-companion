import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import {
  validateAdminVariants,
  deriveParentCacheFromVariants,
  type NormalizedVariantInput,
} from '@/lib/product-variants'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('products.manage')
    const { id } = await params
    const body = await req.json()
    const {
      name, sku, brand, price, salePrice, stock, weight,
      description, benefit, usage, ingredients, bpomNumber,
      isBestSeller, isNew, isActive, categoryId,
      petTypeIds, problemIds, images,
      // Variant fields (Phase: Variants)
      hasVariants, variants,
    } = body

    // ---- Variant validation / normalization (BEFORE the transaction) ----
    // Validation is pure and side-effect-free, so we do it outside the tx
    // to fail fast with a 400 before touching the DB.
    let normalizedVariants: NormalizedVariantInput[] | null = null

    if (hasVariants === true) {
      const result = validateAdminVariants(variants)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      normalizedVariants = result.variants
    }

    // ---- ATOMIC UPDATE ----
    // The ENTIRE product update + relation syncs + variant sync + parent
    // cache recompute happen in ONE Prisma transaction. This guarantees:
    //   - If variant sync fails, the parent Product fields are NOT updated
    //     either (no stale-cache window).
    //   - If any relation sync fails, the variants are NOT partially updated.
    //   - The parent cache is recomputed from the FINAL variant state
    //     (after creates/updates/deletes), not from a pre-computed value.
    //
    // Previous bug: the parent Product.update happened OUTSIDE the variant
    // sync transaction, so a failed variant sync would leave the parent
    // cache stale (written with pre-computed values that didn't match the
    // actual — unchanged — variants). This fix wraps everything in one tx.
    const updated = await db.$transaction(async (tx) => {
      // 1. Compute parent price/salePrice/stock.
      //    - For non-variant products: from the request body (as before).
      //    - For variant products: derived from the NEW variants (pre-sync
      //      computation — will be overwritten by the post-sync recompute
      //      in step 5 below, but we set it here so the Product row has a
      //      sensible value even if step 5 finds zero active variants
      //      after sync — though that case is blocked by validation).
      let parentPrice: number
      let parentSalePrice: number | null
      let parentStock: number

      if (hasVariants === true) {
        const derived = deriveParentCacheFromVariants(normalizedVariants!)
        parentPrice = derived.price
        parentSalePrice = derived.salePrice
        parentStock = derived.stock
      } else {
        parentPrice = parseInt(price)
        parentSalePrice = salePrice ? parseInt(salePrice) : null
        parentStock = parseInt(stock) || 0
      }

      // 2. Update parent Product row (identity + cache fields).
      //    NOTE: for variant products, the price/salePrice/stock written
      //    here will be OVERWRITTEN by the post-sync recompute in step 5
      //    (which derives from the actual post-sync variant state, not the
      //    pre-sync payload). Both computations should produce the same
      //    value in the success path, but the post-sync value is the
      //    authoritative one. Writing both is harmless and keeps the
      //    Product row consistent at every intermediate step inside the tx.
      const product = await tx.product.update({
        where: { id },
        data: {
          name, sku, brand: brand || 'Anima',
          price: parentPrice,
          salePrice: parentSalePrice,
          stock: parentStock,
          weight: weight || null,
          description, benefit, usage, ingredients,
          bpomNumber: bpomNumber || null,
          isBestSeller: !!isBestSeller,
          isNew: !!isNew,
          isActive: isActive !== false,
          hasVariants: hasVariants === true,
          categoryId,
        },
      })

      // 3. Sync petTypes and problems relations (within the same tx).
      if (petTypeIds !== undefined) {
        await tx.productPetType.deleteMany({ where: { productId: id } })
        if (petTypeIds.length) {
          await tx.productPetType.createMany({
            data: petTypeIds.map((pid: string) => ({ productId: id, petTypeId: pid })),
          })
        }
      }
      if (problemIds !== undefined) {
        await tx.productProblem.deleteMany({ where: { productId: id } })
        if (problemIds.length) {
          await tx.productProblem.createMany({
            data: problemIds.map((pid: string) => ({ productId: id, problemId: pid })),
          })
        }
      }
      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } })
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((url: string, i: number) => ({ productId: id, url, alt: name, order: i })),
          })
        }
      }

      // 4. Variant sync — only if the request explicitly included a
      //    `variants` field. This allows older callers (that don't know
      //    about variants) to PUT product fields without wiping variants.
      //
      //    Strategy:
      //      - Fetch existing variants.
      //      - For variants in the payload WITH an `id` that exists → UPDATE.
      //      - For variants in the payload WITHOUT an `id` (or unknown id) → CREATE.
      //      - For existing variants NOT in the payload:
      //          * If referenced by any OrderItem → soft-delete (isActive=false)
      //            to preserve order history. We log a warning via console.
      //          * Else → hard-delete (safe — no historical reference).
      if (variants !== undefined && hasVariants === true) {
        await syncProductVariantsInTx(tx, id, normalizedVariants!)
      } else if (hasVariants === false) {
        // Admin disabled variants. Soft-delete (don't hard-delete) any
        // existing variant rows — they may still be referenced by
        // historical OrderItems. The parent price/salePrice/stock are
        // now authoritative from the body (already written in step 2).
        await tx.productVariant.updateMany({
          where: { productId: id },
          data: { isActive: false },
        })
      }

      // 5. Recompute parent cache from the FINAL variant state.
      //    For variant products, this overwrites the pre-computed cache
      //    written in step 2 with the authoritative value derived from
      //    the actual post-sync variants. For non-variant products, this
      //    is a no-op (the body-supplied values from step 2 are correct).
      //
      //    This step is INSIDE the same transaction, so if it fails the
      //    entire PUT rolls back — no stale-cache window.
      if (hasVariants === true) {
        const finalVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { price: true, salePrice: true, stock: true, isActive: true, sortOrder: true },
        })
        const derived = deriveParentCacheFromVariants(finalVariants)
        await tx.product.update({
          where: { id },
          data: {
            price: derived.price,
            salePrice: derived.salePrice,
            stock: derived.stock,
          },
        })
      }

      return product
    })

    return NextResponse.json({ product: updated })
  } catch (e: any) {
    console.error('Update product error:', e)
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * Synchronize a product's variants with the admin-supplied payload,
 * INSIDE a caller-provided transaction.
 *
 * This function does NOT start its own transaction — it receives `tx` from
 * the caller (the PUT handler wraps the entire product update in one
 * `db.$transaction`). This ensures variant sync is atomic with the parent
 * Product update + relation syncs + parent cache recompute.
 *
 * Strategy (see PUT handler above for full docs):
 *   - UPDATE existing variants that are in the payload.
 *   - CREATE new variants (those without an id, or whose id doesn't exist).
 *   - For existing variants NOT in the payload:
 *       * If referenced by any OrderItem → soft-delete (isActive=false).
 *       * Else → hard-delete.
 *
 * NOTE: this function does NOT recompute the parent cache — that is the
 * caller's responsibility (done in step 5 of the PUT handler, AFTER this
 * function returns, so the recompute sees the final post-sync variant state).
 */
async function syncProductVariantsInTx(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  productId: string,
  normalized: NormalizedVariantInput[]
): Promise<void> {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    include: { _count: { select: { orderItems: true } } },
  })

  const existingMap = new Map(existing.map((v) => [v.id, v]))
  const payloadIds = new Set(normalized.filter((v) => v.id).map((v) => v.id!))

  // 1. Update existing variants that are in the payload
  for (const input of normalized) {
    if (input.id && existingMap.has(input.id)) {
      await tx.productVariant.update({
        where: { id: input.id },
        data: {
          name: input.name,
          price: input.price,
          salePrice: input.salePrice,
          stock: input.stock,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      })
    }
  }

  // 2. Create new variants (those without an id, or whose id doesn't exist)
  const toCreate = normalized.filter(
    (v) => !v.id || !existingMap.has(v.id)
  )
  if (toCreate.length > 0) {
    await tx.productVariant.createMany({
      data: toCreate.map((v, i) => ({
        productId,
        name: v.name,
        price: v.price,
        salePrice: v.salePrice,
        stock: v.stock,
        isActive: v.isActive,
        sortOrder: v.sortOrder ?? existing.length + i,
      })),
    })
  }

  // 3. Handle variants NOT in the payload (removed by admin)
  for (const existingVariant of existing) {
    if (!payloadIds.has(existingVariant.id)) {
      if (existingVariant._count.orderItems > 0) {
        // Soft-delete — preserve order history. Log so admin can see
        // why the variant is still visible (just inactive).
        console.warn(
          `[products/${productId}/PUT] Variant ${existingVariant.id} (${existingVariant.name}) ` +
            `has ${existingVariant._count.orderItems} order item(s) — soft-deleting instead of hard-delete.`
        )
        await tx.productVariant.update({
          where: { id: existingVariant.id },
          data: { isActive: false },
        })
      } else {
        // Safe to hard-delete — no historical reference.
        await tx.productVariant.delete({
          where: { id: existingVariant.id },
        })
      }
    }
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('products.manage')
    const { id } = await params
    await db.product.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
