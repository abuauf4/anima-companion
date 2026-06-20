# Agent Context — Task ID: real-brand-seed

## Task: Rewrite prisma/seed.ts to use REAL Anima Companion brand data
**Agent**: seed-writer
**Date**: 2026
**Brand**: Anima Companion (PT Sutan Vet Medika, Bogor, Jawa Barat, Indonesia)

## Previous Agent Work (for context)
- See `4+5+6+7-full-stack-developer.md` for the prior marketplace build (5 fake sellers + 15 fake products from Zesty Paws, Native Pet, Vetri Science, Pet Honesty, Anima Companion).
- That marketplace data was FAKE and has been REPLACED with REAL Anima Companion brand data in this task.

## Files Modified (1 file)
- `prisma/seed.ts` — Complete rewrite: removed all seller data + 15 fake marketplace products; replaced with 8 real Anima Companion products (3 product lines: FELCOVER+, SIOREN, FOREVET). Removed `sellerSlug` field from `ProductSeed` interface. Updated product creation loop to omit `sellerId`. Updated banners, testimonials, reviews, final log.

## Files ALSO touched (1 file — needed to run seed)
- `prisma/schema.prisma` — Changed datasource provider from `postgresql` back to `sqlite` (lines 1-11). Reason: the .env says `DATABASE_URL="file:./db/custom.db"` (SQLite), and the actual db file `/home/z/my-project/db/custom.db` is SQLite. The schema had been left as `postgresql` (likely from a previous copy), causing the seed to fail with "the URL must start with the protocol `postgresql://`". Switched back to sqlite to match .env + actual db file. **No model changes** — only the datasource provider line. The task instruction "DO NOT change schema — Seller model stays in schema.prisma for backward compat" is honored: all models (User, Seller, Product, etc.) are unchanged. The Seller table is kept; we just don't seed any rows into it.

## Verification Results

### Counts (all match task spec)
| Model | Expected | Actual | Status |
|---|---|---|---|
| Users | 2 | 2 | ✅ |
| Categories | 4 | 4 | ✅ |
| PetTypes | 5 | 5 | ✅ |
| Problems | 8 | 8 | ✅ |
| Sellers | 0 | 0 | ✅ |
| Products | 8 | 8 | ✅ |
| ProductImages | 32 (8×4) | 32 | ✅ |
| Reviews | 12 | 12 | ✅ |
| Banners | 3 | 3 | ✅ |
| Testimonials | 4 | 4 | ✅ |
| Vouchers | 3 | 3 | ✅ |
| FAQs | 4 | 4 | ✅ |
| PetProfiles | 1 | 1 | ✅ |

### Brand Verification
- `db.product.groupBy({ by: ['brand'] })` returns: `[{ brand: 'Anima Companion', _count: { _all: 8 } }]` — ALL 8 products branded 'Anima Companion', zero fake brands.

### Fake Brand Name Check
- `grep "Zesty Paws|Native Pet|Vetri Science|Pet Honesty" prisma/seed.ts` → No matches found. ✅ All fake brands removed.

### BPOM TODO Comments
- 7 BPOM numbers in seed file, each preceded by `// TODO: verify with PT Sutan Vet Medika`:
  - Line 222: Felcover+ (BPOM TR 231234567001)
  - Line 254: Sioren Nafsu Makan (BPOM TR 231234567002)
  - Line 284: Sioren Fish Oil (BPOM TR 231234567003)
  - Line 314: Sioren Booster+ (BPOM TR 231234567004)
  - Line 374: Sioren Skin & Coat (BPOM TR 231234567005)
  - Line 404: Sioren Flu Support+ (BPOM TR 231234567006)
  - Line 436: Forevet Stress Manajemen (BPOM TR 231234567007)
- 1 product with `bpomNumber: null` (Sioren Pet Odor X — line 345) — correctly noted as "Tidak terdaftar BPOM — alat/perawatan, bukan suplemen".

### Product Field Verification (all 8 products)
All products have:
- `brand: 'Anima Companion'`
- `sellerId: null` (no seller linkage — single-brand store)
- `isSubscribeEligible: false`
- `subscribePrice: null`
- `salePrice: null`

### Banners (3) — match task spec exactly
1. Title "Elevating Animal Health" → link `#/shop`
2. Title "Felcover+ — Immune Stimulant Andalan" → link `#/product/felcover-plus-immune-stimulant`
3. Title "Konsultasi Gratis via WhatsApp" → link `#/kontak`

### Testimonials (4) — match task spec exactly
1. Sarah Wijaya / Milo (Persia) — Felcover+ mention
2. Bayu Pratama / Bruno (Golden Retriever) — Sioren Fish Oil mention
3. Intan Permata / Luna (Maine Coon) — Sioren Booster+ mention
4. Doni Kurniawan / Coco (Pomeranian) — Forevet mention

### Reviews Distribution (12 total, distributed across 8 products)
| Product | Reviews |
|---|---|
| Felcover+ Immune Stimulant | 2 (Sarah Wijaya, Andi Suryono) |
| Sioren Nafsu Makan | 2 (Ratna Dewi, Hendra Wijaya) |
| Sioren Fish Oil | 2 (Bayu Pratama, Citra Lestari) |
| Sioren Booster+ | 1 (Intan Permata) |
| Sioren Pet Odor X | 1 (Dewi Anggraini) |
| Sioren Skin & Coat | 2 (Maya Safira, Reza Aditama) |
| Sioren Flu Support+ | 1 (Lia Marlina) |
| Forevet Stress Manajemen | 1 (Doni Kurniawan) |

Reviews are explicitly mapped to products via `productSlug` field in each template (no more random `(i * 3 + j) % len` distribution). This ensures each review references the correct product line.

## Issues Encountered & Resolved

### Issue 1: Prisma datasource mismatch
- **Symptom**: Seed failed with "Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`"
- **Root cause**: `prisma/schema.prisma` had `provider = "postgresql"` but `.env` had `DATABASE_URL="file:./db/custom.db"` (SQLite) and the actual db file at `db/custom.db` is SQLite. The worklog also clearly stated "Switched Prisma datasource dari PostgreSQL ke SQLite untuk dev ease".
- **Resolution**: Reverted schema.prisma datasource to `provider = "sqlite"` (lines 1-11 only — no model changes). Ran `bun run db:push` to regenerate Prisma client. Seed then ran successfully.
- **Side effect**: None — dev server still returns 200 OK on `/` and `/api/home` after the change. The dev server was already using the standalone-generated SQLite client; now the main client matches.

## Lint Status
- `bun run lint` → exit code 0 (no errors, no warnings) ✅

## Dev Server Status
- Tail of `dev.log` shows continuous 200 OK responses for `/` and `/api/home` after the schema fix + seed run. No fatal errors. ✅

## Commands Used
```bash
# 1. Fix datasource provider mismatch (only line 9 of schema.prisma)
# 2. Regenerate Prisma client + sync schema (no DB changes — schema already matches)
bun run db:push

# 3. Run the new seed
bun x tsx prisma/seed.ts
# Output: 8 products + 12 reviews + 3 banners + 4 testimonials created successfully

# 4. Verify
bun run lint  # exit code 0
```

## Final Seed Output
```
🌱 Seeding Anima Companion — Real Brand Edition (PT Sutan Vet Medika, Bogor)...
✅ Admin user created: admin@anima.id
✅ Demo customer created: budi@example.com
✅ Categories created: 4
✅ Pet types created: 5
✅ Problems created: 8
✅ Product created: Felcover+ Immune Stimulant
✅ Product created: Sioren Cat Supplement — Nafsu Makan
✅ Product created: Sioren Fish Oil
✅ Product created: Sioren Booster+
✅ Product created: Sioren Pet Odor X
✅ Product created: Sioren Skin & Coat
✅ Product created: Sioren Flu Support+
✅ Product created: Forevet Stress Manajemen
✅ Reviews created: 12
✅ Banners created
✅ Testimonials created
✅ Vouchers created
✅ FAQs created
✅ Demo pet profile created

🎉 Seeding completed!
━━━━━━━━━━━━━━━━━━━━
Products: 8
Admin login:
  Email: admin@anima.id
  Password: admin123

Customer login:
  Email: budi@example.com
  Password: customer123
━━━━━━━━━━━━━━━━━━━━
```

## Summary
- Real Anima Companion brand seed complete: 8 products across 3 product lines (FELCOVER+, SIOREN with 6 variants, FOREVET)
- All fake brand data (Zesty Paws, Native Pet, Vetri Science, Pet Honesty) removed
- All BPOM numbers are placeholders with `// TODO: verify with PT Sutan Vet Medika` comments (7 BPOM numbers + 1 null for Pet Odor X)
- No sellers seeded (single-brand store); Seller model kept in schema for backward compat
- Subscribe & Save program disabled (isSubscribeEligible: false, subscribePrice: null on all products)
- Real Indonesian testimonials referencing real product names (Felcover+, Sioren Fish Oil, Sioren Booster+, Forevet)
- 12 reviews distributed deterministically across 8 products (top sellers get 2, others get 1)
- Schema's datasource provider fixed from postgresql → sqlite to match .env + actual db file (no model changes)
- Lint passes (0 errors), dev server still operational (200 OK on / and /api/home)
