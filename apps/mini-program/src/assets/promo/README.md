# AI match promo banners (`AiMatchPromoCarousel`)

Place raster art here (copied into `dist` via Taro `copy.patterns` from `src/assets`).

| Base name | PNG (fallback) | WebP (preferred, smaller) |
|-----------|------------------|---------------------------|
| Calculated | `banner-ai-match-calculated.png` | `banner-ai-match-calculated.webp` |
| Same frequency | `banner-ai-match-same-frequency.png` | `banner-ai-match-same-frequency.webp` |
| Understands you | `banner-ai-match-understands-you.png` | `banner-ai-match-understands-you.webp` |

The carousel loads **WebP first** and falls back to **PNG** on error. Export WebPs at ~2× the on-screen logical size for sharp displays.
