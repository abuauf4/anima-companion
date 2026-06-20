# Task ID: premium-motion-upgrade
# Agent: full-stack-developer
# Task: Premium motion + Ingredients Reveal section + Plus Jakarta Sans font upgrade

## Files Modified
1. `src/app/layout.tsx` — Geist → Plus_Jakarta_Sans (weights 400-800, display swap, var `--font-jakarta`); added `font-sans` utility to body
2. `src/app/globals.css` — `--font-sans` → `var(--font-jakarta)` + system fallback chain; `--font-mono` → static system stack
3. `src/components/common/SectionHeader.tsx` — full rewrite: editorial 4px×1px line before eyebrow icon, `font-extrabold leading-[1.05] tracking-tight` title, `text-pretty` subtitle, hover translate-x on action wrapper, decorative `bg-primary/5 blur-3xl` blob top-left, spring transitions, `-100px` viewport margin (API identical)
4. `src/components/common/Reveal.tsx` — Stagger: `staggerChildren: 0.08 → 0.05` (50ms); StaggerItem + Reveal: cubic-bezier → spring `stiffness: 100, damping: 20`; viewport margin `-60/-80px → -100px`
5. `src/components/home/VetSection.tsx` — stats grid switched from `<Reveal delay={i * 0.1}>` to `<Stagger><StaggerItem>` pattern
6. `src/views/HomeView.tsx` — inserted `<IngredientsReveal />` between Shop by Benefit & New Arrivals; refactored `BestSellerCarousel` (per-card scale/opacity via new `CarouselCard` + `useMotionValue` + rAF scroll listener); extracted `PetTypeTiltCard` + `PET_CARDS` config (3D tilt + paw parallax); wrapped New Arrivals posters in `Stagger`/`StaggerItem`; removed unused `useScroll` import

## New Component Created
- `src/components/home/IngredientsReveal.tsx` (~380 lines) — the SHOWPIECE: 8 ingredient cards in 40/60 sticky-split layout, per-card scroll-driven opacity/scale/y via `useScroll`+`useTransform`, emoji parallax, sticky LEFT panel that updates active index/name/description via `useInView`, click-to-navigate to product detail, mobile-responsive (sticky hidden, compact panel above cards)

## Verification Results
- `bun run lint` → exit 0 (0 errors, 0 warnings) ✅
- `bun x tsc --noEmit` → exit 0 (0 type errors) ✅
- `curl /` → 200 OK ✅
- HTML scan: body className has `plus_jakarta_sans_..._variable font-sans` (Plus Jakarta Sans applied) ✅
- HTML scan: all 8 ingredient names present in DOM (Kolostrum, Prebiotik, Omega-3, Alpha-Casozepine, L-Lysine, L-Carnitine, Biotin, Active Charcoal) ✅
- HTML scan: section ordering correct — Shop by Benefit → "Diformulasikan dengan Sains" (Ingredients eyebrow) → New Arrivals ✅
- HTML scan: SectionHeader decorations present — `bg-primary/5 blur-3xl` (blob) + `h-px w-4 bg-primary` (editorial line) + `font-extrabold leading-[1.05] tracking-tight` (title) ✅
- dev.log: latest entries show `✓ Compiled in Nms` + `GET / 200 in Nms` — no fatal errors after final edits ✅

## Issues Encountered + Resolved
1. **ESLint `react-hooks/refs` flagged `useRef(...).current` pattern** in IngredientsReveal (handleActive). Fix: replaced with `useCallback((idx) => setActiveIdx(idx), [])` — same stable-callback semantics, no ref access during render.
2. **Unused `useScroll` import** in HomeView after refactor (CarouselCard uses useMotionValue/useTransform, not useScroll). Fix: removed from import.
3. **`position: sticky` inside `overflow: hidden`** would break sticky panel in some browsers (overflow-hidden creates a scroll container). Fix: changed IngredientsReveal section to `overflow-clip` — same visual clipping, doesn't create a scroll container, sticky works correctly.
4. **Transient `ReferenceError: PetTypeTiltCard is not defined` 500s in dev.log** — Fast Refresh race condition during editing (file partially saved mid-edit). Resolved itself after the file was fully written; all subsequent `GET /` requests returned 200.

## Mobile vs Desktop behavior notes
- **Ingredients Reveal**: mobile hides sticky LEFT panel; renders compact version (big number + name + description + pills + progress dots) above cards. Cards are 70vh mobile / 80vh desktop. Click-to-product works on both.
- **Best Sellers carousel**: scale/opacity motion works on both mobile (1 card per view) and desktop (3 cards per view). Edge cards always dim/scale down.
- **Pet Type 3D tilt**: desktop-only (mouse hover). On touch devices, cards stay flat — no degraded UX since touch users don't expect hover. Tap navigation works normally.
- **SectionHeader decorative blob**: visible on all sizes (subtle, doesn't intrude on mobile).
- **New Arrivals posters**: bento grid stacks vertically on mobile (1 big + 2 small), 1+2 layout on desktop. Stagger entrance applies on both.

## Stage Summary
- Plus Jakarta Sans applied globally (var `--font-jakarta`, weights 400-800, display swap)
- SectionHeader redesigned: editorial line + extrabold + text-pretty + hover translate-x + decorative blob
- NEW Ingredients Reveal component: 8 ingredient cards in 40/60 sticky-split layout with per-card scroll-driven opacity/scale/y, emoji parallax, sticky left panel that updates active index via useInView, click-to-navigate to product detail
- BestSellerCarousel: per-card scroll-position-driven scale (0.92→1) + opacity (0.5→1) via useMotionValue + rAF-throttled scroll listener, spring transition, no re-renders
- PetTypeTiltCard: 3D tilt (±8° rotateX/rotateY) + paw print parallax, spring-back on mouse leave, desktop-only
- Reveal/Stagger upgraded to spring + 50ms stagger + -100px viewport margin; applied to New Arrivals posters + VetSection stats
- All checklist items satisfied
