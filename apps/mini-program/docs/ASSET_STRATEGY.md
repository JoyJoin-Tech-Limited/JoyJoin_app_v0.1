# JoyJoin Mini-Program Asset Strategy

> Canonical reference for how static assets are managed in the mini-program build.
> Last updated: 2026-06-18

---

## Overview

The JoyJoin mini-program uses a **two-tier asset strategy**:

1. **Bundled locally** — Critical/frequently-used assets copied into the WeChat package.
2. **CDN-hosted** — Large or infrequently-used assets served from `https://joyjoinapp.com/static`.

This split keeps the main package under WeChat's 2MB compressed limit while ensuring first-impression assets are instant.

### Build-time CDN URL guarantee

`config/index.ts` now defaults `TARO_APP_CDN_BASE_URL` to `https://joyjoinapp.com/static` in production builds. The CI workflow (`.github/workflows/taro-weapp-build.yml`) also falls back to the same value. This guarantees that production builds never ship with an undefined CDN base, preventing broken CDN asset URLs in release builds.

- Local dev: set `TARO_APP_CDN_BASE_URL=https://joyjoinapp.com/static` in `apps/mini-program/.env.local` to load production CDN assets during development.
- Custom CDN: override `TARO_APP_CDN_BASE_URL` before building (e.g. `https://static.joyjoinapp.com`).
- Never hardcode CDN hostnames in source code; always route through `cdnAsset()` so the build-time base applies uniformly.

---

## Package Budget

| Limit | Current (post-2026-06-16 cleanup) | Headroom |
|-------|-----------------------------------|----------|
| 2.0 MB source (WeChat hard limit) | ~1.88 MB zip | ~120 KB |
| 1.8 MB zip (guideline) | ~1.88 MB | ⚠️ close to guideline |

**Recent wins (2026-06-18):**
- Bundled only **6 core Xiaoyue mascot sprite states** (~235 KB) instead of all 20; remaining 14 states are CDN-primary.
- Stripped `@3x` variants from bundled `status-icons`, `info-labels` (semantic), and `ui` tiers at build time, saving ~100 KB+ compressed.
- Moved **48 interest illustrations** to CDN; the canonical `imageUrl` lives in `packages/shared/src/interests.ts` and resolves via `cdnAsset()`.

**Budget rule of thumb:** every 100KB of raw assets ≈ 25-35KB compressed.

**Critical:** `check-package-size.mjs` measures **zip-compressed** size, which is what `miniprogram-ci` uploads. WeChat's 2MB limit is on the uploaded zip. Stay well under 1.8MB zip to guarantee upload success.

---

## What's Bundled Locally

Assets copied by `vite-plugin-static-copy` in `config/index.ts`.

### Critical UI (always bundled)
| Asset | Path | Size | Why |
|-------|------|------|-----|
| Tab icons | `assets/tab-icons/` | ~52KB | Native tab bar — must exist before first paint |
| Tab bar notch | `assets/tab-bar-notch-bg.png` | ~3KB | Custom tab bar background |
| Brand logos | `assets/joyjoin-logo.png`, `assets/joyjoin-logo-tab.png` | ~58KB | Loading screens, tab bar |

### Icon System

| Tier | Path | Resolution | Hosting | Used in |
|------|------|------------|---------|---------|
| **Mood** | `icons/mood-icons/` | @1x/@2x/@3x | Bundled locally | Icebreaker atmosphere selector |
| **Chemistry** | `icons/chemistry-badges/` | @1x/@2x/@3x | Bundled locally | Matching status indicators |
| **Status** | `icons/status-icons/` | @1x/@2x (bundled); @3x CDN fallback | Bundled locally | Host crown, waiting spinner, notification bell, check/close states, alarm/bar-chart meta labels |
| **Category** | `icons/category-icons/` | @1x/@2x/@3x | Bundled locally | Interest category headers |
| **Intent** | `icons/intent-icons/` | @1x/@2x/@3x | Bundled locally | Social intent selection grid |
| **Expression / rating faces** | `icons/rating-faces/` | @1x/@2x/@3x | Bundled locally | Event-feedback 5-step rating selector |
| **Semantic / info labels** | `icons/info-labels/` | @1x/@2x (bundled); @3x CDN fallback | Bundled locally | Calendar, location, people, target inline labels |
| **UI** | `icons/ui/` | @1x/@2x (bundled); @3x CDN fallback | Bundled locally | Profile/settings list icons, event meta icons |
| **Archetype heads** | `icons/archetype/` | bare `.webp` (@1x implicit) | Bundled locally + CDN fallback | Profile avatars (`ArchetypeHead.tsx`) |
| **Reaction** | `icons/reaction-icons/` | @1x/@2x/@3x | **CDN** | Icebreaker phase reactions |
| **Reveal** | `icons/reveal-icons/` | @1x/@2x/@3x | **CDN** | Matching common-ground reveals |
| **Achievement** | `icons/achievement-badges/` | @1x/@2x/@3x | **CDN** | Personality test milestones |
| **Phase emblems** | `icons/phase-icons/` | @1x/@2x/@3x | **CDN** (full set) + 6 bundled landing variants | Phase toasts, icebreaker session |

> **Retina strategy:** `JoyJoinIcon` always requests the bare `@1x` filename; WeChat's runtime auto-resolves `@2x`/`@3x` variants based on device `pixelRatio`. Hardcoding `@3x` in `src` causes the `@3x@3x` double-suffix 404 bug (see Common Mistakes).
>
> **CDN resolution:** Tiers in `CDN_ICON_TIERS` (`phase`, `reaction`, `reveal`, `achievement`) are wrapped with `cdnAsset()` by `JoyJoinIcon`. All other tiers are wrapped with `localAsset()` and must have a copy pattern in `config/index.ts`.
>
> **2026-06-18 Lovart 5×5 integration:** A single 2048×2048 Lovart status/UI grid was cropped into `status-icons` (⏰📣📊⚠️🚫🪞🔓🌟✕✓🔔), `ui` (🎁🔍📝), and `info-labels` (✈️🌆🌏🌐🗺️), plus six new `reaction-icons` (💰😏😎💜😅😈). The new mappings are registered in `packages/shared/src/iconSystem/emojiToIconMap.ts`. `status`/`ui`/`semantic` tiers are bundled locally; `reaction` remains CDN-primary with the same `reaction-icons/` folder mirrored locally so `cdnAsset()` can fall back when `TARO_APP_CDN_BASE_URL` is unset.

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
| Phase icons (6) | `assets/landing-phase-icons/` | ~139KB | Landing page `PhaseIconCarousel` — 3D turntable with auto-rotate, swipe gesture, organic random intervals, direction randomization, and cycle shuffle. The carousel is the mandatory default experience; reduced-motion media query disables transitions/animations; low-end gating not implemented. Per-icon error placeholders remain. **Performance:** `box-shadow` (not `drop-shadow`) for GPU-composited depth; `backface-visibility: hidden` + `translateZ(0)` forced compositing; `will-change` gated to active playback only. |
| Xiaoyue welcome | `assets/xiaoyue-expressions/xiaoyue-home-welcome.webp` | ~63KB | Landing + center-hub header |
| Xiaoyue loading | `assets/xiaoyue-expressions/xiaoyue-loading-system.webp` | ~47KB | Loading screen fallback |

### Mascot Sprite Fallback
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Xiaoyue mascot sprite sheets (core 6) | `assets/mascot/` | ~235KB | `XiaoyueSpriteAnimator` across the app. Only the 6 core first-session states are bundled locally (`welcome`, `idle`, `coach`, `loading`, `listening`, `thinking`); the remaining 14 states are CDN-primary. Local copies act as offline / stale-CDN fallback. The app-launch preloader (`preloadOnboardingAssets`) warms only the bundled core set on capable devices to avoid launch regression. |

### Support
| Asset | Path | Size | Used in |
|-------|------|------|---------|
| Customer service QR | `assets/qr/` | ~11KB | Event detail + coordination pages |

---

## What's on CDN Only

These are **NOT** copied to `dist/assets/` by the build. They must exist on the CDN server and be declared in `scripts/cdn-asset-manifest.json`.

| Category | Path pattern | Size (total) | Used in |
|----------|-------------|--------------|---------|
| **Archetype full-body images** | `assets/personality/archetypes/archetype-*.webp` | ~285KB | `ArchetypeGlyph`, profile poster, result card |
| **Archetype PNG fallback** | `assets/personality/archetypes/archetype-*.png` | ~700KB | Canvas `drawImage` fallback when WebP is rejected |
| **Archetype head fallback** | `assets/icons/archetype/archetype-*-head.webp` | ~96KB | CDN fallback for `ArchetypeHead.tsx` when local bundle misses |
| **Xiaoyue expressions** (other 18) | `assets/personality/xiaoyue/xiaoyue-*.webp` | ~1.1MB | Mascot across all screens |
| **Xiaoyue sprites** | `assets/mascot/xiaoyue-*.webp` | ~746KB | Sprite animator (CDN primary; local bundled fallback copies exist for offline / stale-CDN cases) |
| **Lovart generic** | `assets/lovart/lovart-generic-*.webp` | ~97KB | Empty/error states |
| **Icebreaker backgrounds** | `assets/lovart/icebreaker/backgrounds/*.jpg` | ~450KB | Challenge card backgrounds |
| **Celebration images** | `assets/lovart/icebreaker/celebrations/*.png` | ~770KB | Post-phase celebration overlays |
| **Lovart illustrations** | `assets/lovart/lovart-*.webp` | ~130KB | Empty/error states |
| **Matching heroes** | `assets/matching/matching-*.webp` | ~157KB | Matching status page |
| **Promo banners** | `assets/promo/banner-*.webp` | ~175KB | Source copies of promo banners for CDN upload. The active Discover hero banner is bundled locally at `assets/promo-local/banner-hero-lovart-v1.webp` and falls back to this CDN path on `onError`. |
| **Personality emojis** | `assets/lovart/personality-emojis/*.png` | ~170KB | Personality test emoji choices |
| **Phase emblems** | `assets/icons/phase-icons/phase-*.webp` | ~120KB | Phase toasts, icebreaker session (full set; 6 landing variants are bundled) |
| **Reaction icons** | `assets/icons/reaction-icons/*.webp` | ~120KB | Icebreaker phase reactions |
| **Reveal icons** | `assets/icons/reveal-icons/*.webp` | ~156KB | Matching common-ground reveals |
| **Achievement badges** | `assets/icons/achievement-badges/*.webp` | ~144KB | Personality test milestones |
| **Ceremony heroes** | `assets/ceremony/*.webp` | ~363KB | Batch C + v0.1 gap-fill ceremony moments |
| **Milestone badges** | `assets/badges/*.webp` | ~300KB | Batch D collectible milestone badges |
| **Miniscript heroes** | `assets/miniscript/*-hero.webp` | ~590KB | Mini-script phase selection |
| **Interest illustrations** | `images/interests/*.webp` | ~850KB | 48 interest cards across 6 macro categories (`InterestChipCloud`, extended-data picker, profile-review) |
| **Category icons (refreshed)** | `images/icons/category-icons/*.webp` | ~38KB | 4 refreshed bundled category icons + CDN fallback copies |
| **Alimama full font** | `assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2` | ~621KB | Chinese display font (deferred 500ms load) |

---

## How It Works

### Build flow
```
1. Taro build → compiles JS/WXSS/WXML
2. vite-plugin-static-copy → copies patterns from config/index.ts to dist/
3. clean:cdn-assets → removes CDN-only directories from `dist/assets/`
4. miniprogram-ci upload → compresses and uploads to WeChat
```

**Local-first promo banner exception:** `promo-local/` is copied into the package by `config/index.ts` and is **not** removed by `clean:cdn-assets`. The original `promo/` source directory remains CDN-only.

### Clean step (`npm run clean:cdn-assets`)
Removes these directories from `dist/assets/` to keep package small:
```
personality/       # Xiaoyue expressions (CDN)
lovart/            # Lovart illustrations (CDN)
matching/          # Matching heroes (CDN)
promo/             # Promo banner sources for CDN upload (NOT bundled)
promo-local/       # Discover hero banner bundled locally; CDN fallback stays in promo/
icons/phase-icons/ # Phase icons (CDN, except landing-phase-icons)
```

The `clean:cdn-assets` step also strips `@3x` variants from bundled `status-icons`, `info-labels`, and `ui` directories to save package size. The source `@3x` files remain in `src/assets/` for CDN upload / fallback purposes.

**Do NOT add copy patterns for these directories** unless you also update the clean step.

### Icon density resolution (`JoyJoinIcon`)
```
Taro.getSystemInfoSync().pixelRatio
  ≈ 1 → load @1x (e.g., reaction-celebrate.webp)
  ≈ 2 → load @2x (e.g., reaction-celebrate@2x.webp)
  ≈ 3 → load @3x (e.g., reaction-celebrate@3x.webp)
```

Fallback chain: if `@3x` fails → `@2x` → `@1x` → native emoji.

### App-launch preloading
`apps/mini-program/src/lib/utils/onboardingPreload.ts` runs once at app launch and warms onboarding-critical raster assets in staggered tiers so the first paint never blocks:

| Tier | Delay | Assets | Gating |
|------|-------|--------|--------|
| 1 (critical) | 0ms | Intro animation + welcome mascot | Runs unless skipped by network |
| 2 (test phase) | ~400ms | Test expressions, personality emoji icons, intent icons, milestone badge, welcome-back ceremony hero | Runs unless skipped by network |
| 3 (heavy) | ~1200ms | Curated core mascot sprite sheets (welcome, idle, coach, loading, listening, thinking) | Skipped on 2G/offline **and** on low-end devices (`benchmarkLevel <= 15`) |

- The preloader is **one-shot** and cancels pending timers if reset (test hook: `__resetOnboardingPreloadGuard`).
- Heavy bundles use `preloadImages(..., concurrency)` to avoid decoder saturation.
- Archetype full-body images and the slot-machine spritesheet are **not** preloaded at app launch; they are handled by the onboarding subpackage pages when the user actually enters them.

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

### Correct workflow for converting source → bundled WebP

```bash
# 1. Identify the source (must be from assets-source/)
SOURCE="apps/mini-program/assets-source/personality/xiaoyue/xiaoyue-home-welcome.png"

# 2. Convert with ImageMagick to WebP (resize first, optimize quality/size)
convert "$SOURCE" -resize 360x360 -quality 80 -define webp:method=6 \
  apps/mini-program/src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp

# 3. VISUALLY VERIFY — open both files and compare

# 4. Add copy entry in config/index.ts if new asset

# 5. Check package size
npm run build:weapp --workspace=mini-program
node apps/mini-program/scripts/check-package-size.mjs

# 6. If CDN asset, add to cdn-asset-manifest.json and run:
npm run upload:cdn-assets
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `cdnAsset()` for a bundled asset | Works on first load, fails on repeat (cache) or slow network | Switch to `localAsset()` |
| Missing copy config entry | Image fails silently, shows fallback/placeholder | Add to `config/index.ts` |
| Clean step removes bundled dir | Icons show as emojis instead of proprietary assets | Remove directory from clean script |
| `@2x`/`@3x` not bundled | Icons look blurry on retina devices | Add icon dir to copy config |
| Hard-coding `@3x` in `<Image src>` | Network tab shows `...@3x@3x.webp` 404s | Pass the bare `@1x` filename; let WeChat auto-resolve density |
| CDN path mismatch | 404 in WeDevTools Network tab | Verify `cdnAsset()` path matches CDN server |
| Wrong tier in `CDN_ICON_TIERS` | CDN 404 + native emoji fallback for a tier that should be bundled (or vice versa) | Update `packages/shared/src/iconSystem/emojiToIconMap.ts` and `cdn-asset-manifest.json`; keep subpackage-critical chrome local |
| Converting from `.webp` instead of source PNG | Visible banding, posterization, dithering noise | Use `assets-source/` originals |
| Using Pillow `quantize(64)` | Massive quality degradation on gradients | Use ImageMagick with 256 colors |
| Not checking package size before push | Upload fails with "main package source size exceed max limit" | Run `check-package-size.mjs` before every upload |

---

## Asset Directory Map

```
src/assets/
├── icons/
│   ├── achievement-badges/    ❌ CDN (source kept for upload, not bundled)
│   ├── archetype/             ✅ bundled (local) + CDN fallback copies
│   ├── category-icons/        ✅ bundled (local)
│   ├── chemistry-badges/      ✅ bundled (local)
│   ├── info-labels/           ✅ bundled (local) [semantic / info labels]; @3x stripped at build
│   ├── intent-icons/          ✅ bundled (local)
│   ├── phase-icons/           ❌ CDN (full set); 6 landing variants + custom-tier-icon bundled
│   ├── rating-faces/          ✅ bundled (local) [expression / rating faces]
│   ├── reaction-icons/        ❌ CDN (source kept for upload, not bundled)
│   ├── reveal-icons/          ❌ CDN (source kept for upload, not bundled)
│   ├── status-icons/          ✅ bundled (local); @3x stripped at build
│   └── ui/                    ✅ bundled (local); @3x stripped at build
├── personality/
│   ├── archetypes/            ❌ CDN (WebP + PNG; source kept for upload, not bundled)
│   └── xiaoyue/               ❌ CDN (except loading-system + home-welcome + coach-guide)
├── mascot/                    ❌ CDN (with bundled .webp fallback)
├── lovart/                    ❌ CDN (except auction coin icons, bundled)
├── matching/                  ❌ CDN (source kept for upload, not bundled)
├── promo/                     ❌ CDN (source kept for upload, not bundled)
├── illustrations/             ❌ CDN (source kept for upload, not bundled)
├── miniscript/                ❌ CDN (source kept for upload, not bundled)
├── archetypes/                ❌ CDN (legacy source; not bundled)
├── ceremony/                  ❌ CDN (source kept for upload, not bundled)
├── badges/                    ❌ CDN (source kept for upload, not bundled)
├── empty-state/               ✅ bundled (local)
├── qr/                        ✅ bundled (local)
├── fonts/                     ✅ bundled (local) [Quicksand + minimal Alimama subset]
├── tab-icons/                 ✅ bundled (local)
└── joyjoin-logo*.webp/png     ✅ bundled (local)
```
