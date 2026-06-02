# JoyJoin Mini-Program Asset Strategy

> Canonical reference for how static assets are managed in the mini-program build.
> Last updated: 2026-06-02

---

## Overview

The JoyJoin mini-program uses a **two-tier asset strategy**:

1. **Bundled locally** — Critical/frequently-used assets copied into the WeChat package.
2. **CDN-hosted** — Large or infrequently-used assets served from `https://joyjoinapp.com/static`.

This split keeps the main package under WeChat's 2MB compressed limit while ensuring first-impression assets are instant.

---

## Package Budget

| Limit | Current (v1.1.4) | Headroom |
|-------|-----------------|----------|
| 2.0 MB compressed | ~1.48 MB | ~520 KB |

**Budget rule of thumb:** every 100KB of raw assets ≈ 25-35KB compressed.

---

## What's Bundled Locally

Assets copied by `vite-plugin-static-copy` in `config/index.ts`.

### Critical UI (always bundled)
| Asset | Path | Size | Why |
|-------|------|------|-----|
| Tab icons | `assets/tab-icons/` | ~52KB | Native tab bar — must exist before first paint |
| Tab bar notch | `assets/tab-bar-notch-bg.png` | ~3KB | Custom tab bar background |
| Brand logos | `assets/joyjoin-logo.webp`, `assets/joyjoin-logo-tab.png` | ~112KB | Loading screens, tab bar |

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
| Phase icons (6) | `assets/landing-phase-icons/` | ~69KB | Landing page game preview grid |
| Xiaoyue welcome | `assets/xiaoyue-expressions/xiaoyue-home-welcome.webp` | ~49KB | Landing + center-hub header |
| Xiaoyue loading | `assets/xiaoyue-expressions/xiaoyue-loading-system.webp` | ~39KB | Loading screen fallback |

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

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `cdnAsset()` for a bundled asset | Works on first load, fails on repeat (cache) or slow network | Switch to `localAsset()` |
| Missing copy config entry | Image fails silently, shows fallback/placeholder | Add to `config/index.ts` |
| Clean step removes bundled dir | Icons show as emojis instead of proprietary assets | Remove directory from clean script |
| `@2x`/`@3x` not bundled | Icons look blurry on retina devices | Add icon dir to copy config |
| CDN path mismatch | 404 in WeDevTools Network tab | Verify `cdnAsset()` path matches CDN server |

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
