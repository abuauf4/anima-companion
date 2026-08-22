import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'

/**
 * POST /api/admin/products/[id]/duplicate
 *
 * Creates a NEW product as an inactive draft, copying all editable fields,
 * images, petTypes, and problems from the source product.
 *
 * Hard guardrails (per task brief):
 *   - Source product is NEVER modified (we only read it).
 *   - Duplicate is always created with `isActive: false` — it never appears
 *     on the public homepage until an admin edits it and re-activates.
 *   - Slug and SKU are guaranteed unique by appending a short timestamp-based
 *     suffix and an extra collision-counter retry loop.
 *   - No schema change, no migration. This route only uses fields/relations
 *     that already exist on the `Product` model.
 *
 * Auth: requires `products.manage` (same permission as create/update).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('products.manage')
    const { id } = await params

    // ---- 1. Load source product with all copyable relations ------------
    const source = await db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: 'asc' } },
        petTypes: true,
        problems: true,
      },
    })

    if (!source) {
      return NextResponse.json(
        { error: 'Produk sumber tidak ditemukan' },
        { status: 404 }
      )
    }

    // ---- 2. Generate unique slug + SKU ---------------------------------
    // Strategy:
    //   base-slug = sluggified product name + "-copy" suffix.
    //   On each retry we append a short timestamp + counter so collisions
    //   (even with a duplicate made seconds ago) are impossible.
    //
    //   SKU mirrors the same pattern: source SKU + "-COPY" + suffix.
    //
    //   We loop at most 10 times — if all 10 fail (extremely unlikely),
    //   we give up with a 500 and a clear error so the admin can retry.
    const baseName = `${source.name} (Salinan)`
    const baseSlug =
      baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'copy'
    const baseSku = `${source.sku}-COPY`

    let slug = `${baseSlug}-${Date.now().toString(36)}`
    let sku = `${baseSku}-${Date.now().toString(36).toUpperCase()}`
    let attempt = 0
    let slugOk = false
    let skuOk = false

    while (attempt < 10 && !(slugOk && skuOk)) {
      if (!slugOk) {
        const existingSlug = await db.product.findUnique({ where: { slug } })
        if (existingSlug) {
          attempt++
          slug = `${baseSlug}-${Date.now().toString(36)}-${attempt}`
        } else {
          slugOk = true
        }
      }
      if (!skuOk) {
        const existingSku = await db.product.findUnique({ where: { sku } })
        if (existingSku) {
          attempt++
          sku = `${baseSku}-${Date.now().toString(36).toUpperCase()}-${attempt}`
        } else {
          skuOk = true
        }
      }
      // Safety: if we exhausted attempts on one of them, bail.
      if (attempt >= 10) break
    }

    if (!slugOk || !skuOk) {
      return NextResponse.json(
        { error: 'Gagal membuat slug/SKU unik setelah 10 percobaan. Coba lagi.' },
        { status: 500 }
      )
    }

    // ---- 3. Create the duplicate as inactive draft ---------------------
    const duplicate = await db.product.create({
      data: {
        // Identity — new
        name: baseName,
        slug,
        sku,
        brand: source.brand,
        sellerId: source.sellerId,

        // Pricing & stock — copied as-is. Admin can adjust later in edit dialog.
        price: source.price,
        salePrice: source.salePrice,
        subscribePrice: source.subscribePrice,
        stock: source.stock,
        weight: source.weight,

        // Content — copied verbatim
        description: source.description,
        benefit: source.benefit,
        usage: source.usage,
        ingredients: source.ingredients,
        bpomNumber: source.bpomNumber,

        // Flags — copied verbatim EXCEPT isActive is forced false
        isBestSeller: source.isBestSeller,
        isNew: source.isNew,
        isSubscribeEligible: source.isSubscribeEligible,

        // Rating/reviewCount are NOT copied — duplicate starts at default
        // (5.0 / 0) so it doesn't inherit fake social proof. The schema's
        // @default handles this automatically.

        // ALWAYS inactive on creation — admin must explicitly activate
        isActive: false,

        // Relation — same category as source
        categoryId: source.categoryId,

        // Relations — copy images (new rows, same URLs/order), petTypes, problems
        images: source.images.length
          ? {
              create: source.images.map((img, i) => ({
                url: img.url,
                alt: img.alt,
                // Re-index to be safe — source images are already sorted by order,
                // so i === img.order in practice, but we re-sequence to guarantee
                // a clean 0..n-1 ordering on the new product.
                order: i,
              })),
            }
          : undefined,
        petTypes: source.petTypes.length
          ? {
              create: source.petTypes.map((pt) => ({ petTypeId: pt.petTypeId })),
            }
          : undefined,
        problems: source.problems.length
          ? {
              create: source.problems.map((pp) => ({ problemId: pp.problemId })),
            }
          : undefined,
      },
      include: {
        category: true,
        images: true,
        petTypes: true,
        problems: true,
      },
    })

    return NextResponse.json({ product: duplicate }, { status: 201 })
  } catch (e: any) {
    console.error('Duplicate product error:', e)
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
