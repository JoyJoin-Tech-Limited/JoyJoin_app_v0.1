# JoyJoin Mini-Program Asset Strategy

> Canonical reference for how static assets are managed in the mini-program build.
> Last updated: 2026-06-03

---

## Overview

The JoyJoin mini-program uses a **two-tier asset strategy**:

1. **Bundled locally** — Critical/frequently-used assets copied into the WeChat package.
2. **CDN-hosted** — Large or infrequently-used assets served from `https://joyjoinapp.com/static`.

This split keeps the main package under WeChat's 2MB compressed limit while ensuring first-impression assets are instant.

---

## Package Budget

| Limit | Current (v1.1.4+20260603) | Headroom |
|-------|---------------------------|----------|
| 2.0 MB source (WeChat hard limit) | ~1.84 MB | ~160 KB |
| 1.8 MB source (guideline) | ~1.84 MB | ⚠️ slightly over |

**Budget rule of thumb:** every 100KB of raw assets ≈ 25-35KB compressed.

**Critical:** WeChat measures **source size** (uncompressed), not zip size. Our `check-package-size.mjs` measures zip; actual upload may be ~300-500KB larger. Stay well under 1.8MB zip to guarantee upload success.

---

## What's Bundled Locally

Assets copied by `vite-plugin-static-copy` in `config/index.ts`.

### Critical UI (always bundled)
| Asset | Path | Size | Why |
|-------|------|------|-----|
| Tab icons | `assets/tab-icons/` | ~52KB | Native tab bar — must exist before first paint |
| Tab bar notch | `assets/tab-bar-notch-bg.png` | ~3KB | Custom tab bar background |
| Brand logos | `assets/joyjoin-logo.png`, `assets/joyjoin-logo-tab.png` | ~58KB | Loading screens, tab bar |

### Icon System (all tiers bundled with @1x/@2x/@3x)
| Tier | Path | @1x | All densities | Used in |
|------|------|-----|--------------|---------|
| **Mood** | `icons/mood-icons/` | ~2KB | ~2KB | Icebreaker atmosphere selector |
| **Chemistry** | `icons/chemistry-badges/` | ~8KB | ~8KB | Matching status indicators |
| **Status** | `icons/status-icons/` | ~3KB | ~3KB | Host crown, waiting spinner |
| **Category** | `icons/category-icons/` | ~4KB | ~13KB | Interest category headers |
| **Intent** | `icons/intent-icons/` | ~5KB | ~17KB | Social intent selection grid |
| **Reaction** | `icons/reaction-icons/` | ~11KB | ~38KB | Icebreaker phase reactions |
| **Reveal** | `icons/reveal-icons/` | ~17KB | ~62KB | Matching common-ground reveals |
| **Achievement** | `icons/achievement-badges/` | ~14KB | ~51KB | Personality test milestones |
| **Archetype heads** | `icons/archetype/` | ~45KB | ~45KB | Profile avatars |

> **Retina strategy:** `JoyJoinIcon` detects device `pixelRatio` at mount and loads `@2x` or `@3x` variants. All three densities are bundled.

### Game & Empty States
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Auction coins | `assets/auction-icons/` | ~23KB | Auction phase bid UI |
| Empty states | `assets/empty-state/` | ~12KB | Center-hub empty page |

### Brand Fonts
| Font | Path | Size | Load strategy |
|------|------|------|---------------|
| Alimama minimal | `fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2` | ~68KB | Instant (bundle) |
| Quicksand | `fonts/Quicksand/Quicksand-VariableFont_wght.ttf` | ~127KB | Instant (bundle) |
| Alimama full | `fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2` | ~636KB | **CDN** (deferred 500ms) |

### Onboarding Subpackage
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Archetype spritesheet | `pages/onboarding/assets/archetypes/` | ~20KB | Personality test slot animation |

### Landing Page (critical first impression)
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Phase icons (6) | `assets/landing-phase-icons/` | ~139KB | Landing page game preview grid |
| Xiaoyue welcome | `assets/xiaoyue-expressions/xiaoyue-home-welcome.png` | ~63KB | Landing + center-hub header |
| Xiaoyue loading | `assets/xiaoyue-expressions/xiaoyue-loading-system.png` | ~47KB | Loading screen fallback |

### Support
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Customer service QR | `assets/qr/` | ~11KB | Event detail + coordination pages |

---

## What's on CDN Only

These are **NOT** copied to `dist/assets/` by the build. They must exist on the CDN server.

| Category | Path pattern | Size (total) | Used in |
|----------|-------------|--------------|---------|
| **Archetype full-body images** | `assets/archetypes/archetype-*.webp` | ~260KB | ArchetypeGlyph, profile |
| **Xiaoyue expressions** (other 18) | `assets/personality/xiaoyue/xiaoyue-*.webp` | ~1.1MB | Mascot across all screens |
| **Lovart generic** | `assets/lovart/lovart-generic-*.webp` | ~97KB | Empty/error states |
| **Xiaoyue sprites** | `assets/mascot/xiaoyue-*.webp` | ~746KB | Sprite animator |
| **Icebreaker backgrounds** | `assets/lovart/icebreaker/backgrounds/*.jpg` | ~450KB | Challenge card backgrounds |
| **Celebration images** | `assets/lovart/icebreaker/celebrations/*.png` | ~770KB | Post-phase celebration overlays |
| **Lovart illustrations** | `assets/lovart/lovart-*.webp` | ~130KB | Empty/error states |
| **Matching heroes** | `assets/matching/matching-*.webp` | ~157KB | Matching status page |
| **Promo banners** | `assets/promo/banner-*.webp` | ~110KB | Discover carousel |
| **Personality emojis** | `assets/lovart/personality-emojis/*.png` | ~170KB | Personality test emoji choices |
| **UI icons** | `assets/icons/ui/*.webp` | ~81KB | Various UI surfaces |
| **Miniscript heroes** | `assets/miniscript/*-hero.webp` | ~590KB | Mini-script phase selection |

---

## How It Works

### Build flow
```
1. Taro build → compiles JS/WXSS/WXML
2. vite-plugin-static-copy → copies patterns from config/index.ts to dist/
3. clean:cdn-assets → removes CDN-only directories from dist/assets/
4. miniprogram-ci upload → compresses and uploads to WeChat
```

### Clean step (`npm run clean:cdn-assets`)
Removes these directories from `dist/assets/` to keep package small:
```
personality/       # Xiaoyue expressions (CDN)
lovart/            # Lovart illustrations (CDN)
matching/          # Matching heroes (CDN)
promo/             # Promo banners (CDN)
icons/phase-icons/ # Phase icons (CDN, except landing-phase-icons)
```

**Do NOT add copy patterns for these directories** unless you also update the clean step.

### Icon density resolution (`JoyJoinIcon`)
```
Taro.getSystemInfoSync().pixelRatio
  ≈ 1 → load @1x (e.g., reaction-celebrate.webp)
  ≈ 2 → load @2x (e.g., reaction-celebrate@2x.webp)
  ≈ 3 → load @3x (e.g., reaction-celebrate@3x.webp)
```

Fallback chain: if `@3x` fails → `@2x` → `@1x` → native emoji.

---

## Adding a New Asset

### If it should be bundled locally:
1. Place file in `src/assets/<appropriate-folder>/`
2. Add copy pattern in `config/index.ts`:
   ```ts
   {
     from: 'src/assets/your-folder',
     to: 'dist/assets/your-folder',
   },
   ```
3. Reference in code with `localAsset('/assets/your-folder/file.webp')`
4. **Verify** the clean step doesn't remove your directory
5. Run `npm run build:weapp` and check `dist/assets/`

### If it should be CDN-only:
1. Place file in `src/assets/<appropriate-folder>/`
2. Add entry to `scripts/cdn-asset-manifest.json`:
   ```json
   {
     "localPath": "assets/your-folder/file.webp",
     "cdnPath": "assets/your-folder/file.webp"
   }
   ```
3. Reference in code with `cdnAsset('/assets/your-folder/file.webp')`
4. Run `npm run upload:cdn-assets` to push to server

---

## Size Checklist (before every release)

- [ ] `npm run build:weapp` succeeds
- [ ] `dist/assets/` contains all expected local assets
- [ ] Clean step doesn't remove any bundled directories
- [ ] Compressed upload size < 2MB
- [ ] New CDN assets uploaded (`npm run upload:cdn-assets`)

---

## Image Conversion Quality Rules (CRITICAL)

**The 2026-06-03 incident:** We converted locally-bundled WebP files to PNG8 using Pillow's `quantize(colors=64)` and the **already-compressed WebP files as source**. This created massive quality degradation (banding, posterization, dithering artifacts) that was visible on real devices. The root cause was a **double-compression penalty**: lossy WebP → 64-color PNG8.

### The Golden Rules

1. **Always use the ORIGINAL source**
   - Original high-quality PNGs live in `apps/mini-program/assets-source/`
   - **NEVER** convert from `src/assets/*.webp` — those are already lossy-compressed
   - If no source PNG exists, use the highest-quality file available (usually the `.webp` original, but expect some loss)

2. **Use the RIGHT tool**
   - ✅ **ImageMagick** with 256 colors: `convert source.png -resize 360x360 -colors 256 -quality 95 output.png`
   - ❌ **Pillow `quantize()`** with 64 colors — creates visible banding on gradients
   - ✅ **oxipng** for lossless compression after generation: `oxipng -o 4 --strip all output.png`
   - ❌ `cwebp` → PNG conversion chain — introduces artifacts

3. **Resolution vs. quality tradeoff**
   - If package size is tight, **reduce resolution** before reducing colors
   - 360×360 @ 256 colors looks better than 480×480 @ 128 colors
   - Loading screen images can use 128 colors (less noticeable during brief display)

4. **Visual verification is mandatory**
   - Always open the generated file and compare side-by-side with the source
   - Check for: banding on gradients, dithering noise, color shifts, lost detail
   - Test on a real device, not just DevTools simulator

5. **Package size check BEFORE commit**
   ```bash
   npm run build:weapp
   node apps/mini-program/scripts/check-package-size.mjs
   ```
   If over 1.8MB, move non-critical assets to CDN rather than degrading quality.

### What went wrong (2026-06-03)

| Wrong approach | Result | Size | Quality |
|----------------|--------|------|---------|
| `PIL.Image.quantize(colors=64)` from `.webp` | Mascot had visible posterization | 38KB | ❌ Terrible |
| `convert source.png -colors 256` from `assets-source/` | Smooth gradients, crisp detail | 104KB | ✅ Good |
| `convert source.png -resize 360x360 -colors 256` | Good quality, smaller size | 63KB | ✅ Good |
| `convert source.png -resize 360x360 -colors 128` | Slightly softer, acceptable for loading | 47KB | ⚠️ Acceptable |

### Correct workflow for converting source → bundled PNG

```bash
# 1. Identify the source (must be from assets-source/)
SOURCE="apps/mini-program/assets-source/personality/xiaoyue/xiaoyue-home-welcome.png"

# 2. Convert with ImageMagick (resize first, then quantize)
convert "$SOURCE" -resize 360x360 -colors 256 -quality 95 \
  apps/mini-program/src/assets/personality/xiaoyue/xiaoyue-home-welcome.png

# 3. Optional: losslessly compress with oxipng
oxipng -o 4 --strip all \
  apps/mini-program/src/assets/personality/xiaoyue/xiaoyue-home-welcome.png

# 4. VISUALLY VERIFY — open both files and compare

# 5. Check package size
npm run build:weapp --workspace=mini-program
node apps/mini-program/scripts/check-package-size.mjs
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `cdnAsset()` for a bundled asset | Works on first load, fails on repeat (cache) or slow network | Switch to `localAsset()` |
| Missing copy config entry | Image fails silently, shows fallback/placeholder | Add to `config/index.ts` |
| Clean step removes bundled dir | Icons show as emojis instead of proprietary assets | Remove directory from clean script |
| `@2x`/`@3x` not bundled | Icons look blurry on retina devices | Add icon dir to copy config |
| CDN path mismatch | 404 in WeDevTools Network tab | Verify `cdnAsset()` path matches CDN server |
| Converting from `.webp` instead of source PNG | Visible banding, posterization, dithering noise | Use `assets-source/` originals |
| Using Pillow `quantize(64)` | Massive quality degradation on gradients | Use ImageMagick with 256 colors |
| Not checking package size before push | Upload fails with "main package source size exceed max limit" | Run `check-package-size.mjs` before every upload |

---

## Asset Directory Map

```
src/assets/
├── icons/
│   ├── achievement-badges/    ✅ bundled (local)
│   ├── archetype/             ✅ bundled (local)
│   ├── category-icons/        ✅ bundled (local)
│   ├── chemistry-badges/      ✅ bundled (local)
│   ├── intent-icons/          ✅ bundled (local)
│   ├── mood-icons/            ✅ bundled (local)
│   ├── phase-icons/           ❌ CDN (except landing-phase-icons)
│   ├── reaction-icons/        ✅ bundled (local)
│   ├── reveal-icons/          ✅ bundled (local)
│   ├── status-icons/          ✅ bundled (local)
│   └── ui/                    ❌ CDN
├── personality/
│   ├── archetypes/            ❌ CDN
│   └── xiaoyue/               ❌ CDN (except loading-system + home-welcome)
├── mascot/                    ❌ CDN
├── lovart/                    ❌ CDN
├── matching/                  ❌ CDN
├── promo/                     ❌ CDN
├── illustrations/             ❌ CDN
├── miniscript/                ❌ CDN
├── empty-state/               ✅ bundled (local)
├── qr/                        ✅ bundled (local)
├── fonts/                     ✅ bundled (local)
├── tab-icons/                 ✅ bundled (local)
└── joyjoin-logo*.webp/png     ✅ bundled (local)
```
