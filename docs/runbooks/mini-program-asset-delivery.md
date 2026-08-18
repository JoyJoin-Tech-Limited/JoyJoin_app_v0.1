# Mini-Program Asset Delivery Runbook

> Operational guide for adding, bundling, CDN-hosting, and troubleshooting static assets in `apps/mini-program`.
> Last updated: 2026-08-17

This runbook is the durable record of two back-to-back incidents that shipped the gathering-room feature to device with broken visuals, plus the protocol changes that prevent a repeat.

---

## 1. The two incidents (2026-08-17)

### 1.1 Gathering-room art was invisible on device

**Symptom:** The gathering-room scene rendered correctly in H5 / WeChat DevTools simulator, but on a real device the background was bare pink and absent-member avatars piled in a heap.

**Root cause chain:**

1. `room-composite-v1.webp` was copied into `dist/assets/gathering-room/` by the Taro static-copy config.
2. `project.config.json` `packOptions.include` is an **upload allow-list**. Because `assets/gathering-room/.*\.webp$` was not in the include list, `miniprogram-ci` silently dropped the file from the uploaded WeChat package.
3. The scene component loaded the art via `cdnAsset()` (CDN-first with local fallback). A transient CDN error put the path into the session-level `failedCdnPaths` negative cache, so the renderer tried the bundled fallback — which did not exist on device.
4. The component's "absent members wait at the door" polish then stacked 5 placeholder avatars at the door coordinate because there was no visible room art to anchor them.

**Fix:**

- Added `assets/gathering-room/.*\.webp$` to `packOptions.include` in `apps/mini-program/project.config.json`.
- Switched the room art to `localAsset()` — the 84 KB composite is bundled anyway, so CDN-first bought nothing but a failure mode.
- Removed the dimmed door-queue for absent members; they now render only a held-place name card at their seat anchor. Live arrivals walk from the door to the seat over 640 ms.
- Re-measured `SEAT_ANCHORS` against the actual delivered WebP (back 50,36 / mid 35,45 + 65,45 / front 33,59 + 50,69.5 + 67,59).

### 1.2 `cdnAsset()` double-wrapped URLs and broke persistent cache

**Symptom:** Mascot and other preloaded assets looked fine on first render, but the persistent asset cache (intended to give zero-network repeat reads) was silently warming nothing on device.

**Root cause chain:**

1. Several preload/persist callers (`onboardingPreload` Tier-4 targets, `routePreloadAssets`, `preloadAndPersistImages`) hand already-`cdnAsset()`-wrapped URLs to `persistentAssetCache.cacheAsset()`.
2. `cacheAsset()` internally re-wrapped the URL with `cdnAsset()`, producing strings like `https://cdn.joyjoinapp.com/statichttps://cdn.joyjoinapp.com/static/assets/…`.
3. Every `Taro.downloadFile` for those URLs 404'd. The cache logged a warning and fell through, so renders (single-wrapped) looked fine while repeat/offline reads stayed cold.
4. The bug is invisible when `TARO_APP_CDN_BASE_URL` is unset in local dev, because `cdnAsset()` is then an identity transform.

**Fix:**

- Made `cdnAsset()` idempotent for absolute `http(s)://` URLs — it now returns the input unchanged.
- Added a 5-case regression test in `apps/mini-program/src/lib/utils/cdnAssets.test.ts`.

---

## 2. What we did right

- **Bundled the room art locally.** Once the include pattern was fixed, the asset was guaranteed on-device and loaded instantly.
- **Added H5 screenshot gates for the gathering room.** The `npm run screenshot:gathering-room` probe caught the bare-scene layout on 375×812 and 360×640 viewports after the art was restored.
- **Added a regression test for `cdnAsset()` idempotency.** The test locks in wrap-safety for absolute URLs, bare paths, and already-prefixed CDN paths.
- **Re-measured anchors against real art.** Seat coordinates were no longer tuned blind; they now match the six zabuton cushions in the composite.
- **Kept the fix minimal.** No new dependencies, no redesign. The root causes were configuration and URL normalization.

---

## 3. What we did wrong / what to avoid

| Mistake | Why it hurts |
|---------|--------------|
| Added a new bundled asset directory without touching `packOptions.include` | `miniprogram-ci` silently drops it; H5/dev cannot catch this |
| Used `cdnAsset()` for an asset that is bundled anyway | Adds a network/CDN failure mode with zero package-size savings |
| Trusted H5 / DevTools as proof of asset delivery | The upload allow-list only affects the compressed package that WeChat receives |
| Let a utility re-wrap URLs without knowing if they were already wrapped | Produces invalid URLs that fail silently in caches and downloads |
| Let a CDN-failure negative cache fall back to a bundled path that was never uploaded | Users get stuck in a broken state until cache/session resets |
| Tuned avatar/seat anchors without the final art loaded | Layers float in wrong places; name cards detach from bodies |

---

## 4. Protocol and guidelines

### 4.1 Adding a new bundled asset directory

1. Place files in `apps/mini-program/src/assets/<new-dir>/`.
2. Add the copy pattern in `apps/mini-program/config/index.ts`.
3. **In the same PR**, add a `packOptions.include` regexp in `apps/mini-program/project.config.json`.
4. Reference the asset with `localAsset('/assets/<new-dir>/file.ext')`.
5. Run `npm run build:weapp -w mini-program` and confirm the files exist in `dist/assets/<new-dir>/`.
6. Prefer an actual upload / preview on device; H5 is **not** sufficient.

### 4.2 Choosing `cdnAsset()` vs `localAsset()`

| Use `cdnAsset()` | Use `localAsset()` |
|------------------|--------------------|
| CDN-only assets (large Lovart illustrations, archetype full bodies, interest taxonomy) | Anything copied into the package by `config/index.ts` |
| Assets with a bundled mirror used only as offline fallback | Tab icons, logos, fonts, empty states, bundled icon tiers |
| Paths declared in `cdn-asset-manifest.json` | The gathering-room composite scene (bundled) |

Rule of thumb: **if the file is in `dist/assets/` after build, load it with `localAsset()`**. CDN-first for a bundled file is a failure mode, not an optimization.

### 4.3 URL wrap-safety

- `cdnAsset()` is idempotent for absolute URLs. Do not add second-pass wrapping in cache/persist utilities.
- Utilities that accept either raw paths or already-resolved URLs must normalize before wrapping, or reject ambiguous input.
- When adding a new preload/persist caller, inspect the value you are passing. If it already came from `cdnAsset()` or another resolver, do not wrap it again.
- Lock wrap-safety behavior with unit tests (see `apps/mini-program/src/lib/utils/cdnAssets.test.ts`).

### 4.4 Negative-cache safety

- A failed CDN path that falls back to a bundled/local path must first verify that the local path exists in the uploaded package.
- Do not let a transient 404 permanently pin a session onto a missing fallback.
- Prefer `localAsset()` for bundled assets so there is no CDN failure path to cache.

### 4.5 Visual anchor discipline (room scenes, overlays, composite art)

- Do not finalize seat/object anchors until the final art asset is rendered by the code path that will ship.
- When art changes, re-measure anchors and update screenshot gates in the same PR.
- Keep absent/placeholder states anchored to the same coordinate system as live states; do not invent separate staging areas that read as bugs when art is missing.

---

## 5. Checklists

### Before adding any new bundled asset

- [ ] File placed under `src/assets/<dir>/`
- [ ] Copy pattern added in `config/index.ts`
- [ ] `packOptions.include` regexp added in `project.config.json`
- [ ] Loaded via `localAsset('/assets/<dir>/file.ext')`
- [ ] `npm run build:weapp` produces the file in `dist/assets/<dir>/`
- [ ] Screenshot or device upload verifies the asset is visible

### Before adding any new CDN asset

- [ ] File placed under `src/assets/<dir>/`
- [ ] Entry added to `scripts/cdn-asset-manifest.json`
- [ ] Loaded via `cdnAsset('/assets/<dir>/file.ext')`
- [ ] `npm run upload:cdn-assets` pushed the file (or the `Upload CDN Assets` workflow ran)
- [ ] CDN URL returns HTTP 200

### After changing a URL utility (`cdnAsset`, `localAsset`, persistent cache)

- [ ] Unit tests cover absolute URL, bare path, already-prefixed CDN path, and null/empty inputs
- [ ] `npm run test -w mini-program` passes
- [ ] `npm run guardrails` passes

---

## 6. References

- [`apps/mini-program/docs/ASSET_STRATEGY.md`](../apps/mini-program/docs/ASSET_STRATEGY.md) — two-tier bundled/CDN strategy, icon tiers, conversion rules
- [`docs/agent-context/mini-program-assets.md`](../agent-context/mini-program-assets.md) — implementation notes and recent gotchas
- [`docs/agent-context/gathering-room.md`](../agent-context/gathering-room.md) — gathering-room feature context and 2026-08-17 device fix
- [`AGENTS.md`](../../AGENTS.md) §3 — exact WeChat upload and CDN commands
- Source files:
  - `apps/mini-program/src/lib/utils/cdnAssets.ts`
  - `apps/mini-program/src/lib/utils/cdnAssets.test.ts`
  - `apps/mini-program/project.config.json`
  - `apps/mini-program/src/components/gathering-room/GatheringRoomScene.tsx`
