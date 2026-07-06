# Asset/CDN Migration Plan — JoyJoin Mini Program Package Size

**Status:** Phase 1 implemented (2026-07-06)  
**Goal:** Bring the WeChat main package under the 2.00 MB compressed hard limit with sustainable headroom.  
**Date:** 2026-07-06  
**Stakeholders:** PM, Taro/FE Engineer, DevOps/Release  

---

## 1. Current snapshot

```
Core framework:        1.26 MB
Main pages:            509.1 KiB
Shared assets:         1.36 MB
─────────────────────────────────
Main package (raw):    3.12 MB
Main package (zip):    1.82 MB (limit: 2.00 MB)
Onboarding            506.3 KiB (limit: 1.80 MB)
Profile Linked        24.7 KiB
Icebreaker Session    31.2 KiB
Matching Status       28.1 KiB
Pool Registration     646.9 KiB
Custom tab-bar:        14.3 KiB
─────────────────────────────────
Total (zip):           3.04 MB (limit: 20.00 MB)
```

The package-size gate measures `dist/assets` plus core JS/framework. After Phase 1, the main package has a **180 KB buffer** under the 2.00 MB WeChat hard limit.

### Pre-implementation snapshot (for reference)

```
Core framework:        1.29 MB
Main pages:            509.2 KiB
Shared assets:         1.54 MB
─────────────────────────────────
Main package (raw):    3.33 MB
Main package (zip):    2.00 MB (limit: 2.00 MB)
```

---

## 2. Root-cause findings

### 2.1 Source-to-dist leakage

`apps/mini-program/config/index.ts` uses Taro `copy.patterns` to decide what lands in `dist/`. Several patterns copy entire source directories that contain non-shipping files:

| Directory | What is copied | Problem | Estimated waste |
|-----------|----------------|---------|-----------------|
| `src/assets/lovart/puzzle` | Entire folder | Contains a 1.1 MB `_contact-sheet.png` source file and 6 PNG fallbacks (~400 KB) that the config comment claims are stripped, but the copy pattern copies everything. | **~1.4 MB uncompressed** |

**Fix:** narrow the puzzle copy pattern to the 6 `.webp` pieces only and move `_contact-sheet.png` to `assets-source/`.

### 2.2 Duplicate pool-registration hero fallbacks

Pool-registration ceremony heroes live in the subpackage (`pages/pool-registration/assets/`) and are **also** copied into the main package as `dist/assets/pool-heroes/` (~207 KB uncompressed). The subpackage is preloaded on the landing page, so the main-package fallback is likely redundant.

**Fix:** remove the main-package fallback copies; rely on subpackage + CDN fallback.

### 2.3 Too many bundled Xiaoyue expressions

Currently 3 expressions are bundled (`loading-system`, `coach-guide`, `home-welcome`) = ~131 KB uncompressed. `coach-guide` is used in later flows and can be CDN-only; `loading-system` and `home-welcome` are first-paint critical.

**Fix:** move `xiaoyue-coach-guide.webp` to CDN-only.

### 2.4 CDN manifest / build config URL mismatch

`cdn-asset-manifest.json` uses `https://cdn.joyjoinapp.com/static`, while `config/index.ts` and AGENTS.md use `https://joyjoinapp.com/static`. If both are live, uploads may land in one place while runtime resolves to another. This must be aligned before any new CDN migration.

---

## 3. Migration candidates (ranked by ROI)

| # | Asset / change | Current location | Proposed destination | Est. uncompressed savings | Risk | Effort |
|---|----------------|------------------|----------------------|---------------------------|------|--------|
| 1 | Puzzle `_contact-sheet.png` + PNG fallbacks | `src/assets/lovart/puzzle/` | Move source to `assets-source/`; copy only 6 webp pieces to dist | **~1.3 MB** | Very low | 30 min |
| 2 | Pool-registration hero main-package fallback | `dist/assets/pool-heroes/` | Remove; use subpackage path + CDN | **~207 KB** | Low | 30 min |
| 3 | `xiaoyue-coach-guide.webp` | `dist/assets/xiaoyue-expressions/` | CDN-only | **~45 KB** | Low | 15 min |
| 4 | `flow-icons` (center-hub / connections) | `dist/assets/icons/flow-icons/` | CDN-primary with local fallback | **~60 KB** | Low-medium | 1 h |
| 5 | `rating-faces` (event feedback) | `dist/assets/icons/rating-faces/` | CDN-primary with local fallback | **~60 KB** | Low-medium | 1 h |
| 6 | Discover promo banner (`banner-hero-lovart-v1.webp`) | `dist/assets/promo-local/` | CDN-only (it already has CDN fallback) | **~64 KB** | Medium (first paint) | 30 min |
| 7 | `info-labels` icons | `dist/assets/icons/info-labels/` | CDN-primary with local fallback | **~40 KB** | Medium (used everywhere) | 1.5 h |
| 8 | `ui` icons | `dist/assets/icons/ui/` | CDN-primary with local fallback | **~81 KB** | Medium-High (used everywhere, subpackage lazy-load issues) | 2 h |

**Phase 1 alone (items 1–3, plus the in-scope promo banner move) saves ~1.5 MB uncompressed** and gives immediate CI relief plus a safe buffer.

### Phase 1 completion checklist

- [x] Narrow puzzle copy pattern to the 6 shipped `.webp` pieces; move `_contact-sheet.png` + PNG masters to `assets-source/lovart/puzzle/`.
- [x] Remove main-package duplicate pool-registration heroes; rely on subpackage + CDN.
- [x] Move `xiaoyue-coach-guide.webp` to CDN-only.
- [x] Align CDN base URL to `https://joyjoinapp.com/static` across `config/index.ts`, `cdn-asset-manifest.json`, workflows, and helper comments.
- [x] Move Discover promo banner to CDN-only (originally Phase 3; required to clear the 2.00 MB ceiling).
- [x] Add all newly CDN-only assets to `cdn-asset-manifest.json`.
- [x] Update `apps/mini-program/AGENTS.md` bundled-asset policy notes.

---

## 4. Product/PM recommendations

### 4.1 Must stay bundled (do not move)

| Asset | Why |
|-------|-----|
| Tab icons + tab-bar logo + notch bg | Native custom tab bar renders before app JS; cannot depend on CDN. |
| Alimama minimal font (66 KB) | First-paint Chinese brand typography on landing/onboarding. |
| Quicksand font (14 KB) | English brand numerals/labels; tiny and critical. |
| Archetype head/grid icons (~88 KB) | Avatars appear across tab pages and subpackages; local avoids emoji fallback in subpackages. |
| Landing phase icons (~80 KB) | First screen of the app; CDN failure would break the visual promise. |
| Xiaoyue `loading-system` + `home-welcome` (~83 KB) | Cold-start / landing first impression. |
| 6-core mascot sprite fallback (~235 KB) | Required fallback when CDN sprite sheets fail; already trimmed to minimum. |
| Empty-state illustrations (~12 KB) | Tiny; keep local for offline grace. |
| QR code (~12 KB) | Support surface; must work offline. |

### 4.2 Safe to move to CDN-only or CDN-primary

- Puzzle pieces (item 1) — only used during matching-status live reveal; network is available at that point.
- Pool-registration hero fallback (item 2) — subpackage already carries the asset; CDN covers edge cases.
- `xiaoyue-coach-guide` (item 3) — used in coaching moments, not first paint.
- `flow-icons` / `rating-faces` (items 4–5) — non-critical UI accents; emoji fallback acceptable if mapping is preserved.
- Promo banner (item 6) — already CDN-primary conceptually; first-paint trade-off is acceptable if a solid placeholder/color wash exists.

### 4.3 Phased rollout recommendation

**Phase 1 — Implemented (2026-07-06)**
- Fix puzzle copy-pattern leak (item 1).
- Remove pool-hero main-package fallback (item 2).
- Move `xiaoyue-coach-guide` to CDN (item 3).
- Align CDN base URL in manifest vs config.
- Move Discover promo banner to CDN-only (item 6; brought forward from Phase 3 because it was required to stay under the 2.00 MB ceiling).
- Target achieved: main package **1.82 MB** compressed (stretch goal was ≤ 1.80 MB).

**Phase 2 — Sustainable diet (next sprint)**
- Move `flow-icons` and `rating-faces` to CDN-primary with local fallback (items 4–5).
- Audit `src/assets/` for any other source-to-dist leaks.
- Target: main package ≤ 1.65 MB compressed.

**Phase 3 — Optional polish**
- ~~Evaluate promo banner CDN-only (item 6)~~ Completed in Phase 1.
- Re-evaluate `ui` / `info-labels` only if new features push us near the limit again.

### 4.4 Offline / degraded-network strategy

- For CDN-only assets, ensure a non-asset fallback: solid color background, placeholder icon, or cached previous load.
- `JoyJoinIcon` already has a 4-tier fallback chain ending in native emoji for icon tiers.
- `XiaoyueSpriteAnimator` already falls back to bundled core states for mascot sprites.
- Add a runtime metric / analytics event for CDN asset load failures so we can detect regressions.

### 4.5 Success metrics

| Metric | Target |
|--------|--------|
| `npm run check:package-size` | PASS with ≥ 150 KB buffer under 2.00 MB | PASS (180 KB buffer) |
| Main package compressed | ≤ 1.80 MB (stretch) / ≤ 1.85 MB (accepted) | 1.82 MB |
| Cold-start first paint | No regression vs baseline | To be measured |
| CDN asset error rate | < 0.5% of impressions | To be measured |
| Offline empty-state / error surfaces | All render without CDN assets |

---

## 5. Technical implementation notes

### 5.1 Files to change

1. `apps/mini-program/config/index.ts`
   - Replace the broad `src/assets/lovart/puzzle` copy pattern with explicit per-file `.webp` copies.
   - Remove the two `src/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-*.webp` main-package fallback copies.
   - Remove the `xiaoyue-coach-guide.webp` copy pattern.

2. `apps/mini-program/scripts/cdn-asset-manifest.json`
   - Add entries for the newly CDN-only assets (puzzle webp if not already, coach-guide, pool-registration heroes if they aren't already).
   - Fix `cdnBaseUrl` to match `config/index.ts` (`https://joyjoinapp.com/static`).

3. `apps/mini-program/src/lib/utils/cdnAssets.ts`
   - Verify `cdnAsset()` uses the same base URL as the manifest.

4. Source cleanup
   - Move `apps/mini-program/src/assets/lovart/puzzle/_contact-sheet.png` to `assets-source/lovart/puzzle/`.
   - Delete the 6 PNG puzzle pieces from `src/assets/lovart/puzzle/` if they are no longer needed (canvas uses PNG? confirm first).

5. Runtime references
   - Search for any code referencing `localAsset('/assets/pool-heroes/...')` and switch to subpackage or CDN path.
   - Search for `xiaoyue-coach-guide` references and ensure they use `cdnAsset()`.

### 5.2 Validation steps

1. Run `npm run build:weapp --workspace=mini-program`.
2. Run `npm run check:package-size -w mini-program`.
3. Inspect `dist/assets/` to confirm no PNG/contact-sheet leakage.
4. Run WeChat DevTools smoke test on:
   - Landing page (promo banner, phase icons, mascot welcome)
   - Matching-status live reveal (puzzle pieces)
   - Pool-registration success screen (hero)
   - Any screen using `xiaoyue-coach-guide`
5. Test offline/airplane mode to confirm graceful degradation.

### 5.3 Risk mitigations

| Risk | Mitigation |
|------|------------|
| CDN asset 404 | Add all new CDN entries to `cdn-asset-manifest.json` and run `npm run upload:cdn-assets`. |
| Subpackage local asset fails | Keep subpackage copy of pool-registration heroes; remove only the main-package duplicate. |
| Canvas needs PNG | Verify puzzle pieces are only used via `<Image>`; if canvas needs them, keep a single tiny PNG or use webp. |
| WeChat DevTools cache hides issue | Clean dist + DevTools cache before smoke test. |
| CDN URL mismatch | Align `cdn-asset-manifest.json`, `config/index.ts`, and `cdnAsset()` helper to one canonical base URL. |

---

## 6. Decision log

| Decision | Rationale |
|----------|-----------|
| Do not move tab bar / fonts / core mascot fallback | These are on the critical render path or required for offline resilience. |
| Move puzzle source/contact sheet out of `src/assets` | It is a build/source artifact, not a runtime asset. |
| Remove pool-hero main-package fallback | Subpackage + CDN provides sufficient redundancy; duplicate is wasteful. |
| Keep `promo-local` banner bundled for now | ~~First-paint sensitivity; revisit in Phase 3 with LCP data.~~ **Updated 2026-07-06:** moved to CDN-only during Phase 1 because the main package could not fit under 2.00 MB otherwise. Skeleton/gradient overlay preserves first-paint experience. |
| Move `xiaoyue-coach-guide` to CDN-only | Used in coaching moments, not cold-start first paint. |
| Align CDN URL before any migration | Prevents uploads from landing on the wrong origin. |

---

## 7. Next step

Phase 1 is complete. The Sprint Contract is accepted and the changes are in `main`. Proceed to Phase 2 when the product roadmap allows: move `flow-icons` and `rating-faces` to CDN-primary with local fallback, and audit `src/assets/` for any remaining source-to-dist leaks.

### Phase 1 verification commands

```bash
npm run build:weapp --workspace=mini-program
npm run check:package-size -w mini-program
find apps/mini-program/dist/assets/lovart/puzzle -type f   # expect 6 .webp files
find apps/mini-program/dist/assets/pool-heroes -type f     # expect empty/absent
find apps/mini-program/dist/assets/xiaoyue-expressions -type f  # expect loading-system + home-welcome only
find apps/mini-program/dist/assets/promo-local -type f     # expect empty/absent
```
