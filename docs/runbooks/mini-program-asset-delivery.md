# Mini-Program Asset & Style Delivery Runbook

> Operational guide for adding, bundling, CDN-hosting, and troubleshooting static assets **and styles** in `apps/mini-program`.
> Last updated: 2026-10-15

This runbook is the durable record of back-to-back incidents that shipped mini-program features to device with broken visuals, plus the protocol changes that prevent a repeat.

---

## 1. The incidents (2026-08-17 – 2026-08-18)

### 1.1 Gathering-room art was invisible on device

**Symptom:** The gathering-room scene rendered correctly in H5 / WeChat DevTools simulator, but on a real device the background was bare pink and absent-member avatars piled in a heap.

**Root cause chain:**

1. `room-composite-v1.webp` was copied into `dist/assets/gathering-room/` by the Taro static-copy config.
2. `project.config.json` `packOptions.include` is an **upload allow-list**. Because `assets/gathering-room/.*\.webp$` was not in the include list, `miniprogram-ci` silently dropped the file from the uploaded WeChat package. (Note: the active art is now `room-composite-v2.webp` — repaired 2026-08-27 for window panel mis-registration; v1 retained for rollback. The include regexp moved with the files on 2026-10-15 — it is `pages/gathering-room/assets/.*\.webp$` now, see §1.4.)
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

### 1.3 Icebreaker phase views rendered unstyled on device (sub-common.wxss stranding)

**Symptom:** The social-icebreaker session page (`/pages/icebreaker-session/index`) looked correct in H5 / WeChat DevTools simulator, but on a real device every phase-hero view, the warmup card family, and the recap view were partially or fully unstyled — bare text on a pink background, misaligned buttons, missing cards. The screenshot from the bug report shows the "迷你剧本杀" phase card collapsed into a plain block with no foil frame, status rail, or action styling.

**Root cause chain:**

1. Commit `b7be2757f` introduced a per-subpackage `manualChunks` rule (`apps/mini-program/config/miniProgramChunks.ts`) that routes modules shared only inside one subpackage to `<subpackage>/sub-common.js`.
2. When commit `899761a5f` (2026-08-12, "page extraction") moved the phase JSX into `SessionPhaseViews.tsx` and the action handlers into `hooks/useSocialActions.ts`, the importer graph changed: many phase/component modules now had multiple importers inside the `icebreaker-session` subpackage.
3. Taro/Vite attaches the SCSS side-effect imports (`import './X.scss'`) to those modules, so the stylesheets also followed the modules into `pages/icebreaker-session/sub-common.wxss`.
4. WeChat applies **only** the page's own WXSS plus the app-level WXSS chain; it never loads `sub-common.wxss`. The styles were therefore present in the build output but invisible on device.
5. The regression was masked in local H5/DevTools because those environments load all generated WXSS files, and was masked on one agent's first build because a stale `dist/` from before the chunking change still had the styles in `common.wxss`.

**Fix:**

- In `pages/icebreaker-session/index.scss`, `@use` every phase, component, and shared gesture/reveal stylesheet whose rules must land in the page WXSS.
- Remove the matching `import './X.scss'` side-effect imports from the TSX files so the styles are not duplicated into `sub-common.wxss`.
- Apply the same pattern to `BoxJourneySpine` and `PersonalityTestAnswerArea` in the onboarding subpackage.
- Harden `apps/mini-program/scripts/verify-subpackage-styles.mjs` so that **any non-empty `sub-common.wxss` fails the build**, turning a silent device-only regression into a CI failure.
- Extend `phaseStyleBundling.test.ts` to assert all 25 `@use` entries are present.

### 1.4 The 开发版 upload was rejected — main package source size over 2 MB (errcode `80200`)

**Symptom:** `Build Taro WeChat Mini-Program` failed on two consecutive pushes (`70a1585b7`, `444210f2b`) in the upload step, after `[upload by cos multi version] running async task...`: `errcode: 80200, errmsg: main package source size 2063KB exceed max limit 2048KB` (then `2064KB`). Every other job — build, `check:package-size`, `verify:subpackage-styles`, the compiled-package check — was green.

**Root cause chain:**

1. WeChat's upload accounting ("main package source size") counts ~154 KiB more than `scripts/check-compiled-package-source-size.mjs` measures on miniprogram-ci's compiled bundle. The guard compared its number straight to the 2048 KB ceiling, so it reported **138.9 KiB of headroom** for a package WeChat rejected, and the last accepted upload had only ~5 KB of real slack.
2. The two gathering-room composites (`room-composite-v1.webp` 84,420 B + `room-composite-v2.webp` 94,588 B = 174.8 KiB) were still bundled in the **main** package under `src/assets/gathering-room/`, even though only `pages/gathering-room` (a subpackage) renders them.
3. The batch's net growth (~20 KiB across several features) was enough to tip the package over once the real headroom was near zero.

**Fix (commit `346845773`):**

- Moved both composites to `src/pages/gathering-room/assets/` (copy pattern + `packOptions.include` regexp `pages/gathering-room/assets/.*\.webp$` + `verify-upload-assets.mjs` expectation + `repair-gathering-room-composite.mjs` all repointed). The two **CDN manifest entries were dropped** rather than repointed: the scene loads the art package-direct via `localAsset()`, so no CDN consumer remains — and a `pages/…` `localPath` can never auto-publish anyway (§4.1 / checklist note).
- Relaxed `localAsset()`'s path guard to accept both bundled forms: `BUNDLED_ASSET_PATH_PATTERN = /^\/(?:assets\/|pages\/[^/]+\/assets\/)/`.
- Recalibrated the guard: `WECHAT_SOURCE_SIZE_OVERHEAD_BYTES = 160 KiB`, `JOYJOIN_MAIN_PACKAGE_HEADROOM_MARGIN_BYTES = 32 KiB`, `JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES = 1856 KiB`; the CLI now prints the WeChat-equivalent size and a remediation hint, and the guard test locks the accounting identity.
- Kept `room-composite-v1.webp` as the rollback copy (the gathering-room subpackage is ~235 KiB, far under its own 1.8 MB limit).

### 1.5 The CDN auto-publish job failed on push — its artifact was dispatch-only

**Symptom:** on the 2026-10-15 asset-move push, `Upload CDN Assets` → `Upload assets to CVM CDN` failed after 12 s with `Unable to download artifact(s): Artifact not found for name: cdn-weapp-dist`, while the `Validate CDN assets` job was green.

**Root cause:** commit `4392f1ffa` (2026-10-14) removed the `workflow_dispatch`-only gate from the **upload job** so push runs auto-publish manifest changes, but the `Preserve compiled assets for upload` step kept `if: github.event_name == 'workflow_dispatch'`. Any push whose diff matched a manifest entry therefore started the upload job with no artifact to download. It stayed invisible because every earlier push run matched nothing and skipped the upload job entirely.

**Fix:** the artifact step now packs on `workflow_dispatch || steps.changes.outputs.should_upload == 'true'`, matching the upload job's gate exactly. The two now-dead gathering-room manifest entries were dropped in the same pass (§1.4).

### 1.6 The size guard blocked the upload on a basis that cannot see the whole package

**Symptom:** after the gathering-room art moved into its subpackage (§1.4), the next `Build Taro WeChat Mini-Program` run failed in `Verify compiled mini-program output`: `check-compiled-package-source-size.mjs compiled-check` printed `main source 1909.5 KiB (WeChat-equivalent 2069.5 KiB …); WeChat headroom -21.5 KiB` and exited 1. `upload-weapp` needs the artifact that step produces, so **no 开发版 upload ran at all** — the question §1.4 was supposed to answer could not even be asked.

**Root cause:** `get-compiled-result` returns miniprogram-ci's **compiler output**, not the uploaded `dist/`, and the compiler only emits what it can reach statically. An asset referenced solely from a JS string constant — `localAsset('/pages/gathering-room/assets/room-composite-v2.webp')` bound as `src={…}` — is never emitted. Measured side by side on the same build:

| tree | `pages/gathering-room` | main package |
|------|------------------------|--------------|
| `dist/` (what gets uploaded) | 235.2 KiB | (CI zip-basis report: 1.61 MB) |
| `compiled-check` (what the guard measured) | 61.6 KiB — code only | 1909.5 KiB — **byte-identical to the pre-move run** |

So the 175 KB relocation was invisible to the guard, and the fixed 160 KiB overhead constant from §1.4 then over-reported by exactly the omitted bytes. A ceiling verdict on this basis is unreliable in both directions: unadjusted it under-reports (§1.4's false PASS), adjusted it over-reports (this incident).

**Fix (2026-10-15):** the size verdicts became `::warning::` annotations that exit 0. `evaluateCompiledPackageSizes()` now returns `{ warnings, failures }`; only basis-independent defects — a main-package chunk `require()`-ing a subpackage chunk — stay fatal. The full per-package table is still printed on every run, and the authoritative number is WeChat's server-side "main package source size" for the real upload, which `upload-weapp` runs immediately after. Hard local gates that remain: `check:package-size` (dist zip basis, fails the main package over 2.00 MB), `verify-upload-assets` (asset classification), `verify:subpackage-styles`, and the compiled-tree asset assertions (Flash contract marker + 34 Street Blind Box files).

**Rule:** never calibrate a size ceiling from a derived tree. Recalibrate from a real `80200` message — it reports WeChat's exact figure (`main package source size 2063KB exceed max limit 2048KB`).

---

## 2. What we did right

- **Bundled the room art locally.** Once the include pattern was fixed, the asset was guaranteed on-device and loaded instantly.
- **Added H5 screenshot gates for the gathering room.** The `npm run screenshot:gathering-room` probe caught the bare-scene layout on 375×812 and 360×640 viewports after the art was restored.
- **Added a regression test for `cdnAsset()` idempotency.** The test locks in wrap-safety for absolute URLs, bare paths, and already-prefixed CDN paths.
- **Re-measured anchors against real art.** Seat coordinates were no longer tuned blind; they now match the six zabuton cushions in the composite.
- **Kept the fix minimal.** No new dependencies, no redesign. The root causes were configuration and URL normalization.
- **Used the existing `verify-subpackage-styles.mjs` gate as ground truth.** Rather than trusting H5 or a single local build, we let the purpose-built regression gate tell us whether required selectors were present in the page WXSS.
- **Did a staged-tree build + test pass before push.** We verified the exact files that would be committed, not just the working tree, so no WIP leaked into the commit.
- **Hardened the gate to fail on any non-empty `sub-common.wxss`.** This turned a device-only silent failure into a build-time assertion, preventing the same class of regression in every subpackage.
- **Partial-staged the onboarding WIP files.** Only the `@use` / import-removal hunks were committed; the user's ongoing personality-test refactor stayed in the working tree.

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
| Relied on a stale `dist/` or H5 preview to prove styles were bundled | `sub-common.wxss` and simulator-only loads can hide real device regressions |
| Left `import './X.scss'` in a component that is consumed inside a subpackage | Taro chunks the SCSS into `sub-common.wxss`, which WeChat never loads |
| Moved/re-exported page-owned components without re-checking `@use` coverage | A page extraction changes the chunk graph and can strand styles silently |
| Registered an icon mapping in `emojiToIconMap.ts` without committing the webp + CDN manifest entry in the same window (2026-10-14) | Mapping existed 2026-07-21, asset landed 2026-08-05 with no manifest entry, and the `Upload CDN Assets` workflow **skipped** upload jobs on push events (dispatch-only gating), so `JoyJoinIcon`'s local→CDN retry 404'd and devices rendered the fallback 🎯 emoji for 尝鲜体验 |
| Kept subpackage-only art in the main package until the 2 MB source ceiling was reached (2026-10-15) | The upload failed with `errcode 80200` while every local size command passed — the guard under-measured WeChat's accounting by ~154 KiB (§1.4). Decide the owning package **before** adding art; moving it later costs a release cycle |
| Calibrated a size ceiling from a derived tree (`get-compiled-result`) instead of from the uploaded package (2026-10-15) | The compiler omits assets referenced only from JS string literals, so after the art move the guard still measured the pre-move main size and blocked every upload — a false FAIL computed on an incomplete tree (§1.6). Keep derived-tree numbers advisory; gate on the uploaded package or WeChat's own verdict |

---

## 4. Protocol and guidelines

### 4.1 Adding a new bundled asset directory

1. **Decide the owning package first.** If only one subpackage page renders the asset, put it in that subpackage: `src/pages/<pkg>/assets/<new-dir>/` → `dist/pages/<pkg>/assets/<new-dir>/`, referenced as `localAsset('/pages/<pkg>/assets/<new-dir>/file.ext')`. Main-package room is scarce — WeChat's real source ceiling leaves roughly 1.86 MB of estimated budget (§1.4; the 1856 KiB figure is an estimate, §1.6). Subpackages carry the same 2 MB cap each, so check the per-package table the size guard prints before adding heavy art anywhere.
2. Otherwise place files in `apps/mini-program/src/assets/<new-dir>/`.
3. Add the copy pattern in `apps/mini-program/config/index.ts`.
4. **In the same PR**, add a `packOptions.include` regexp in `apps/mini-program/project.config.json` matching the **dist** path (`assets/<new-dir>/.*\.ext$` or `pages/<pkg>/assets/<new-dir>/.*\.ext$`). This is mechanically enforced: `verify-upload-assets.mjs` fails the build for any dist asset with no include pattern.
5. Reference the asset with `localAsset('/assets/<new-dir>/file.ext')` (or the `pages/<pkg>/…` form).
6. Run `npm run build:weapp -w mini-program` and confirm the files exist in the expected `dist/` location.
7. Add/update the assertion in `apps/mini-program/scripts/verify-upload-assets.mjs` for the new dist path **only if losing this asset would blank a shipped surface** — that list is the "file went missing from `dist/`" detector. The include-pattern requirement is enforced automatically now (see below).
8. Prefer an actual upload / preview on device; H5 is **not** sufficient.

**New invariant (2026-10-15): every asset in `dist/` must be deliberately classified.** `verify-upload-assets.mjs` no longer only checks the hand-written critical list — it enumerates every media/font file the build produced (196 at the time of writing) and fails unless each one is either include-covered (ships on purpose) or ignore-matched (excluded on purpose). Two consequences:

- Adding a bundled asset directory without a `packOptions.include` pattern now fails `npm run build:weapp` locally and CI's build job, instead of silently depending on whether WeChat honours its own allow-list.
- An ignore rule that is too broad (e.g. a new `suffix .png` rule) fails too, because every asset it swallows must be listed in `INTENTIONALLY_EXCLUDED` inside the gate script. That list currently holds exactly the two superseded `pool-registration/assets/ceremony/*.png` masters.

The check is strict on purpose: the two possible readings of `packOptions.include` disagree (`miniprogram-ci@2.1.31` computes `isIgnoredByRules = !isFileIncluded && isFileIgnored`, while this repo's incidents consistently behaved as if it were an allow-list). Requiring an explicit decision per asset is correct under either reading, and the fix for a failure is one line in `project.config.json`.

**Per-package ceilings (2026-10-15):** WeChat caps **each** package at 2 MB, not just the main one. `scripts/check-compiled-package-source-size.mjs` totals every declared subpackage root on the compiled bundle basis, prints the full table with WeChat-equivalent sizes and headroom, and **warns** (never fails — see §1.6) for any root over the same 1856 KiB estimate. `pages/alang` is the tightest (1604 KiB of incompressible art + 273 KiB code → ≈1713 KiB compiled → ≈1873 KB WeChat-equivalent, ~175 KB of real headroom) — an easy place to accidentally re-break the upload.

### 4.7 Icon-system CDN fallback coverage (2026-10-14 incident)

Every `(tier, assetKey)` pair in `packages/shared/src/iconSystem/emojiToIconMap.ts` must satisfy BOTH:

1. A committed bundle file at `apps/mini-program/src/assets/icons/<folder>/<assetKey>.webp`.
2. A `{ localPath, cdnPath }` entry in `apps/mini-program/scripts/cdn-asset-manifest.json`, so the **Upload CDN Assets** workflow publishes the CDN mirror that `JoyJoinIcon.tsx` retries (local → CDN → emoji) before falling back to the native emoji.

**Why both, even for bundled tiers:** `JoyJoinIcon` treats the CDN as its first retry when a bundled local path fails to load (upload allow-list stripping, partial WeChat caches). A missing CDN entry silently turns "icon degraded" into "icon renders as a generic emoji" — the 🎯 dart-target 尝鲜体验 incident.

**Enforcement (2026-10-14):** `scripts/check/check-cdn-icon-coverage.mjs` runs inside `npm run guardrails` and fails any mapping missing its bundle file or manifest entry. 94 unique pairs were verified; do not bypass it.

**Publishing semantics (also fixed 2026-10-14):** the workflow's `upload-assets` job runs on `workflow_dispatch` **or** on any push to `main` whose diff matches the manifest itself or a manifest-listed asset (`needs.validate-assets.outputs.should_upload == 'true'`). A push that only edits other files skips the CVM upload intentionally. If a push events run shows "Upload assets to CVM CDN — skipped", check the validate job's diff decision before assuming the file shipped.

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

### 4.6 Subpackage style-splitting / WXSS stranding

The per-subpackage `manualChunks` rule in `apps/mini-program/config/miniProgramChunks.ts` routes modules shared only inside one subpackage to `<subpackage>/sub-common.js`. Any SCSS imported as a side effect (`import './X.scss'`) from those modules is emitted into `pages/<subpackage>/sub-common.wxss`, which **no page ever loads**. The result is styled H5 / DevTools, unstyled device.

**Correct pattern:**

1. In the consuming **page SCSS**, `@use` the component/partial stylesheet:
   ```scss
   @use './phases/AuctionHeroView';
   @use './components/WarmupActionBar';
   @use '../../components/reveal/CardFlip.scss' as *;
   ```
2. Remove the matching `import './X.scss'` from the component TSX:
   ```ts
   // BAD: strands the SCSS into sub-common.wxss
   import './AuctionHeroView.scss'

   // GOOD: rules are co-compiled into the page WXSS
   ```
3. If the component is consumed by **multiple pages**, either:
   - keep the side-effect import and accept that the component must live in a chunk every consumer loads (rare), or
   - `@use` the component SCSS from every consuming page SCSS (the rule used inside subpackages).
4. After `npm run build:weapp`, run `npm run verify:subpackage-styles`. The gate fails if any required selector is missing from a page WXSS **or** if any `sub-common.wxss` is non-empty.

**When to apply this pattern:**

- Any component that defines its own `.scss` and is imported from a subpackage page.
- Any page-extraction/refactor that moves JSX from a page file into a sibling module inside the same subpackage.
- Any shared primitive (`components/gesture/*`, `components/reveal/*`, etc.) whose only registered consumers live inside one subpackage.

---

## 5. Checklists

### Before adding any new bundled asset

- [ ] Owning package decided — subpackage-only art goes to `src/pages/<pkg>/assets/<dir>/` (main-package budget: §1.4)
- [ ] File placed under the chosen `src/…/assets/<dir>/`
- [ ] Copy pattern added in `config/index.ts`
- [ ] `packOptions.include` regexp added in `project.config.json` (matches the **dist** path prefix) — `verify-upload-assets.mjs` fails the build if any dist asset has no include pattern
- [ ] Loaded via `localAsset(...)` with the matching root-relative path
- [ ] `verify-upload-assets.mjs` expectation updated to the new dist path **if the asset is surface-critical** (losing it would blank a page); otherwise the catch-all classification already covers it
- [ ] `npm run build:weapp` produces the file in the expected `dist/` location
- [ ] Screenshot or device upload verifies the asset is visible

### Before adding any new CDN asset

- [ ] File placed under `src/assets/<dir>/` — the workflow's push trigger (`apps/mini-program/src/assets/**`) and its `should_upload` diff match (`apps/mini-program/src/${localPath}`) both assume this prefix, so a `pages/…` entry validates but never auto-publishes
- [ ] Entry added to `scripts/cdn-asset-manifest.json`
- [ ] Loaded via `cdnAsset('/assets/<dir>/file.ext')`
- [ ] `npm run upload:cdn-assets` pushed the file (or the `Upload CDN Assets` workflow ran)
- [ ] CDN URL returns HTTP 200
- [ ] If it is an icon-system mapping: bundle file committed **and** manifest entry added before merge
      (§4.7; `npm run guardrails` blocks otherwise), and the CDN URL verified with a HEAD request

### After changing a URL utility (`cdnAsset`, `localAsset`, persistent cache)

- [ ] Unit tests cover absolute URL, bare path, already-prefixed CDN path, and null/empty inputs
- [ ] `npm run test -w mini-program` passes
- [ ] `npm run guardrails` passes

### Before adding or moving a styled component inside a subpackage

- [ ] Component has a matching `.scss` file
- [ ] The consuming page SCSS `@use`s the component SCSS
- [ ] The component TSX no longer imports its own `.scss` as a side effect
- [ ] `npm run build:weapp -w mini-program` completes
- [ ] `npm run verify:subpackage-styles -w mini-program` passes with no non-empty `sub-common.wxss`
- [ ] Device or uploaded preview verifies the component is still styled

---

## 6. References

- [`apps/mini-program/docs/ASSET_STRATEGY.md`](../apps/mini-program/docs/ASSET_STRATEGY.md) — two-tier bundled/CDN strategy, icon tiers, conversion rules
- [`docs/agent-context/mini-program-assets.md`](../agent-context/mini-program-assets.md) — implementation notes and recent gotchas
- [`docs/agent-context/gathering-room.md`](../agent-context/gathering-room.md) — gathering-room feature context and 2026-08-17 device fix
- [`AGENTS.md`](../../AGENTS.md) §3 — exact WeChat upload and CDN commands
- [`AGENTS.md`](../../AGENTS.md) §7 — subpackage style-splitting guardrail
- [`docs/agent-context/mini-program-patterns.md`](../agent-context/mini-program-patterns.md) — cross-cutting mini-program patterns
- Source files:
  - `apps/mini-program/src/lib/utils/cdnAssets.ts`
  - `apps/mini-program/src/lib/utils/cdnAssets.test.ts`
  - `apps/mini-program/project.config.json`
  - `apps/mini-program/src/components/gathering-room/GatheringRoomScene.tsx`
  - `apps/mini-program/config/miniProgramChunks.ts`
  - `apps/mini-program/scripts/verify-subpackage-styles.mjs`
  - `apps/mini-program/src/pages/icebreaker-session/index.scss`
