# Agent Context — Task 4+5+6+7

## Task: Zesty Paws Marketplace Enhancement for Anima Companion

This directory holds per-task work records for the Anima Companion project.

### Files Modified in This Task
- `prisma/seed.ts` — Multi-brand marketplace data (5 sellers + 15 products + 12 reviews)
- `src/app/api/home/route.ts` — Extended with subscribeProducts, sellers, petTypes, saleCountdown
- `src/app/api/products/route.ts` — Extended filters (brand/pet aliases, subscribe, sort popular/rating)
- `src/hooks/use-fetch.ts` — Added Seller, SaleCountdown, HomeData types; extended Product interface
- `src/components/product/ProductCard.tsx` — Seller link, star rating, subscribe badge
- `src/views/HomeView.tsx` — Full Zesty Paws-style rewrite (12 sections)
- `src/components/layout/Navbar.tsx` — 3-column mega-menu for "Belanja" + mobile drill-down
- `src/views/ShopView.tsx` — Brand sidebar filter + URL query handling + 6 sort options

### Key Decisions
1. **Subscribe price helper**: `Math.round(price * 0.85 / 1000) * 1000` — 15% off, rounded to nearest Rp 1.000
2. **Prisma filter on join-table relations**: For `PetType._count.products`, filter is `where: { product: { isActive: true } }` (nested through join). For `Seller._count.products`, filter is `where: { isActive: true }` (direct relation).
3. **URL query aliases**: `pet` ↔ `petType`, `brand` ↔ `seller` — both supported in /api/products and ShopView for ease of linking from mega-menu
4. **Mega-menu uses static data**: PET_TYPES_MENU, BENEFITS_MENU, BRANDS_MENU arrays inline in Navbar.tsx — no extra fetch needed
5. **FilterPanel extraction**: Pulled out of ShopView component body to avoid `react/no-unstable-nested-components` lint error
6. **setState-in-effect**: Used targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` comments for legit URL-sync patterns (search input sync, loading flag set before fetch)

### Testing Performed
- `bun run db:push` — schema already in sync, no migration needed
- `bun x tsx prisma/seed.ts` — runs cleanly, all 5 sellers + 15 products + 12 reviews created
- API endpoints tested with curl:
  - `GET /api/home` → 200, returns all 9 data sections (5 bestSellers, 3 newProducts, 8 subscribeProducts, 8 problems, 4 testimonials, 5 sellers, 5 petTypes, saleCountdown.endsAt, 3 banners)
  - `GET /api/products?brand=zesty-paws` → 200, 7 products
  - `GET /api/products?pet=kucing` → 200, 7 products
  - `GET /api/products?problem=imunitas` → 200, 8 products
  - `GET /api/products?subscribe=1` → 200, 12 products
  - `GET /api/products?bestSeller=1` → 200, 5 products
  - `GET /api/products?sort=price-desc` → 200, Vetri Science GlycoFlex (Rp 220k) first
  - `GET /api/products?slug=zesty-paws-probiotic-bites-dogs` → 200, includes seller relation + 4 related products
- `bun run lint` — modified files: 0 errors, 0 warnings. Total: 33 problems (26 errors are in untouched admin views + duplicate anima-companion/ subdirectory + pre-existing ContactView/ProblemDetailView/ProductDetailView/ProfileView)

### Login Credentials (preserved)
- Admin: admin@anima.id / admin123
- Customer: budi@example.com / customer123

### Schema Notes
The Prisma schema (`prisma/schema.prisma`) already had the marketplace models ready (Seller with verified flag, Product.sellerId, Product.subscribePrice, Product.isSubscribeEligible, Product.rating, Product.reviewCount). No schema changes were needed — just data population and frontend/API integration.
