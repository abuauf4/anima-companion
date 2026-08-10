#!/usr/bin/env python3
"""
Phase 2 — Migrate Felcover+ product images to the new static structure.

Source: /home/z/my-project/work/anima-companion/public/products/Felcover+{,2,3,4}.webp
Target: /home/z/my-project/work/anima-companion/public/products/felcover-plus-immune-stimulant/0{1,2,3,4}.webp

This is the ONLY product in the seed that has real image assets already in the repo.
The other 7 products (sioren-*, forevet-*) have no real images — they are reported
as missing assets to the owner. Their seed entries will reference local paths
`/products/<slug>/01.webp` that don't exist yet; when the owner drops real images
into those directories, they'll start working without any code/DB change.

Optimization:
- Re-encode as WebP at quality=82 (visually lossless for product photography).
- Cap the longest edge at 1200px (down from any larger original).
- Preserve aspect ratio.
- Strip metadata.
"""

import sys
from pathlib import Path
from PIL import Image, ImageOps

REPO = Path("/home/z/my-project/work/anima-companion")
SRC_DIR = REPO / "public" / "products"
TARGET_SLUG = "felcover-plus-immune-stimulant"
TARGET_DIR = SRC_DIR / TARGET_SLUG

# (source filename, target filename) — order = image order in the gallery
MIGRATIONS = [
    ("Felcover+.webp",  "01.webp"),  # main product image (largest)
    ("Felcover+2.webp", "02.webp"),
    ("Felcover+3.webp", "03.webp"),
    ("Felcover+4.webp", "04.webp"),
]

MAX_LONGEST_EDGE = 1200
WEBP_QUALITY = 72  # visually fine for product photos, matches next.config.ts qualities


def human_size(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    return f"{num_bytes / (1024 * 1024):.2f} MB"


def optimize_image(src: Path, dst: Path) -> tuple[int, int, str, str]:
    """Open src, resize if needed, re-encode as WebP, save to dst. Return (src_size, dst_size, src_dim, dst_dim)."""
    src_size = src.stat().st_size
    with Image.open(src) as img:
        # Auto-orient (EXIF rotation) and strip metadata
        img = ImageOps.exif_transpose(img)
        src_dim = f"{img.width}x{img.height}"

        # Convert palette/palletted modes to RGB for WebP encoding
        if img.mode in ("P", "L", "LA"):
            img = img.convert("RGBA" if img.mode == "LA" else "RGB")
        if img.mode == "RGBA":
            # WebP supports alpha, but we want a white background for product photos
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg

        # Downscale if longest edge exceeds cap — preserves aspect ratio
        longest = max(img.width, img.height)
        if longest > MAX_LONGEST_EDGE:
            scale = MAX_LONGEST_EDGE / longest
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.LANCZOS)

        dst_dim = f"{img.width}x{img.height}"
        # quality=82, method=6 (slowest/best compression), lossless=False
        img.save(dst, "WEBP", quality=WEBP_QUALITY, method=6, lossless=False)
    dst_size = dst.stat().st_size
    return src_size, dst_size, src_dim, dst_dim


def main() -> int:
    if not TARGET_DIR.exists():
        TARGET_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[mkdir] Created {TARGET_DIR}")

    print(f"\nPhase 2 — Felcover+ image migration\n" + "=" * 60)
    print(f"Source dir : {SRC_DIR}")
    print(f"Target dir : {TARGET_DIR}")
    print(f"Max edge   : {MAX_LONGEST_EDGE}px")
    print(f"WebP qual  : {WEBP_QUALITY}\n")

    total_src = 0
    total_dst = 0
    for src_name, dst_name in MIGRATIONS:
        src = SRC_DIR / src_name
        dst = TARGET_DIR / dst_name
        if not src.exists():
            print(f"  [MISS] {src_name} — source file not found, skipping")
            continue
        src_size, dst_size, src_dim, dst_dim = optimize_image(src, dst)
        total_src += src_size
        total_dst += dst_size
        delta = (dst_size - src_size) / src_size * 100
        sign = "+" if delta > 0 else ""
        print(
            f"  {src_name:20s} {src_dim:>10s} {human_size(src_size):>8s}"
            f"  →  {dst_name:8s} {dst_dim:>10s} {human_size(dst_size):>8s}  ({sign}{delta:+.1f}%)"
        )

    print("\n" + "=" * 60)
    total_delta = (total_dst - total_src) / total_src * 100 if total_src else 0
    sign = "+" if total_delta > 0 else ""
    print(
        f"  Total: {human_size(total_src)} → {human_size(total_dst)}  ({sign}{total_delta:+.1f}%)"
    )
    print(f"\nDone. Files written to {TARGET_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
