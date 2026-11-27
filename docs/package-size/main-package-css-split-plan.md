# Main-package CSS split (WeChat 80200 fix)

> Status: **executed 2026-10-29.** `dist/common.wxss` 259,727 B → **105,106 B**
> (target ≤128,443 B → ~23 KiB margin). Written 2026-10-29 after the icon-resize attempt
> (`997ac1777`) was proven not to affect WeChat's accounting; the sections below are kept as
> the measurement record, and `## Executed design` replaces the original plan where the
> build behaved differently from what was predicted.

## Problem

WeChat rejects the upload:

```
errcode 80200: main package source size 2182KB exceed max limit 2048KB
```

`build-weapp` runs `miniprogram-ci get-compiled-result` +
`scripts/check-compiled-package-source-size.mjs`, which reports:

```
[compiled-package-size] main source 2016.2 KiB
  (WeChat-equivalent 2176.2 KiB incl. 160.0 KiB accounting overhead);
  WeChat headroom -128.2 KiB
```

That number was **byte-identical** before and after `997ac1777` (53 icons resized,
373.0 → 132.3 KB). WeChat counts **compiled JS/WXSS/WXML/JSON only**; bundled images are
dropped by miniprogram-ci's unused-file analysis. Image work cannot move this number.

**Budget:** allowed main source = 2048 − 160 = **1888 KiB**. Current **2016.2 KiB**.
**Must cut ≥ 131,277 B (128.2 KiB).** The repo's own safety target needs **160 KiB**.

## Root cause

`src/pages/alang/flash.scss` is 124,222 B and is pulled in by **9 `pages/alang`
subpackage pages**. Taro/Vite hoists any CSS module reached by **≥2 page entries** into the
root `common.wxss`, which ships in the **main package**.

Taro **does** emit `sub-common.wxss` — corrected 2026-10-29. The earlier "verified: no
sub-common" reading was wrong: `config/miniProgramChunks.ts` routes modules shared *inside one
subpackage* to `<pkg>/sub-common`, and Taro writes a matching `<pkg>/sub-common.wxss`. No page
JSON or stylesheet ever imports that chunk, so any SCSS that rides it is **dead** — this is the
2026-08-17 blank-UI trap, and the guard now fails on any non-empty `sub-common.wxss`.
Consequence: CSS shared by two pages of the *same* subpackage still escalates to the main
package (or dies in `sub-common`); the only safe escape is Sass-level inlining into each
consuming page's own WXSS, which duplicates the bytes inside the subpackage.

## Measured attribution

`common.wxss` = 259,720 B, 1,819 selectors, 252,868 B inside rule blocks.
Rules reachable from the 6 main-package pages: 70,189 B.
**Unreachable from main: 182,679 B (178.4 KiB).** Unattributed remainder 8,426 B.

| KiB | owning source file |
|---|---|
| **92.1** | `src/pages/alang/flash.scss` |
| **18.8** | `src/components/ProfessionChatOverlay.scss` |
| 9.7 | `alang/story-unit/LaterActStoryExperience.scss` |
| 9.2 | `alang/story-unit/AlangFirstActExperience.scss` |
| 6.7 | `alang/story-unit/ShiqiFirstActExperience.scss` |
| 6.1 | `alang/story-unit/AtuanLaterActExperience.scss` |
| 5.5 | `alang/story-unit/FirstActAtuanTemplateExperience.scss` |
| 4.8 | `alang/story-unit/MomoFirstActExperience.scss` |
| 3.8 | `src/components/loading/OnboardingLoadingShell.scss` |
| 2.1 | `alang/story-unit/FirstActDialogueChrome.scss` |
| 1.8 | `src/components/ui/Chip.scss` |
| 1.7 | `src/components/intent/IntentCard.scss` |
| 1.4 | `src/components/mascot/XiaoyueChatBubble.scss` |
| 1.3 | `alang/story-unit/FirstActHighlightOverlay.scss` |
| 0.8 | `alang/story-unit/LiziFirstActExperience.scss` |
| ~3.5 | 6 misc files (AIContentReportButton, ContentBlockedError, ParticleBurst, ConnectionPointPill, AIGCLabel, CheckBadge, CelebrationSparkle) |

Subtotals: **Alang `flash.scss` 92.1**, **Alang story-unit 46.2** (9 files),
**non-Alang easy levers 27.5**.

## `flash.scss` internal profile (cumulative compiled bytes)

Compiled with `sass` `style:'compressed'` at each top-level block boundary.

| cumulative | section | delta |
|---|---|---|
| 16,441 B | shell: `page`, `.flash-visually-hidden`, `.flash-page`, `.flash-npc-portrait`, `.flash-scene-backdrop`, `.flash-button`, `.flash-state`, `.flash-location-consent`, `.flash-online-*`, `.flash-task-*`, `.flash-intro`, `.flash-finale*`, `.flash-empty-card` (ends L739) | **16.4 KiB** |
| 28,364 B | `.flash-radar` (L740–869) | **11.9 KiB** — search page only |
| 34,252 B | `.flash-dialogue` (L871–1042) | **5.9 KiB** |
| 104,730 B | L1044–EOF: `.flash-dialogue--story`, story-unit hooks, `.flash-preferences` (L3495), radar/offer keyframes (L3514–3580), `.flash-interaction` (L3868) | **70.4 KiB** |

File is **4,236 lines** with **607 `&`** nesting occurrences.

### The interleaving problem

The L1044–EOF region is *not* one feature. It contains three different owners:

- `.flash-preferences` (L3495) → `pages/alang/preferences` only
- `@keyframes flash-radar-*` / `flash-offer-paper-*` (L3514–3580) → the `.flash-radar` block at L740
- everything else (`.flash-dialogue--story`, `.flash-story-v2__*`, `.flash-interaction*`,
  `flash-story-*` keyframes) → the two dialogue pages only

So the split must be **4-way**, not 2-way.

## Page entry graph (why it hoists)

| page entry | alang components reached |
|---|---|
| `pages/alang/{result,archive,event-detail,search,finale,companion,preferences}` | `FlashUi.tsx` only (1) |
| `pages/alang/dialogue` | 18 — `FlashUi` + full story-unit system + `FlashStoryV2Stage` + `FlashStoryInteractionStage` |
| `pages/alang-story/dialogue` | same 18 (re-exports `FlashDialoguePage` from `../../alang/dialogue`) |
| `pages/alang/event` | 0 |

Both dialogue routes are live: `src/lib/onboarding/onboardingRoutes.ts:50-51`
(`alangDialogue`, `alangLaterDialogue`). They cannot be merged.

`pages/discover/index.tsx:53` imports `AlangDiscoverCard`, which imports only its own SCSS —
**not** the hoist cause.

## Binding constraint: subpackage headroom

`pages/alang` compiled = **1769.1 KiB, headroom 118.9 KiB**.
Current Alang page WXSS ≈ 123.5 KiB, of which `preferences/index.wxss` is **101.9 KiB**
because `preferences/index.scss:1` does `@import '../flash';` (a Sass inline) *on top of*
the same rules already sitting in `common.wxss`.

A naive 8× duplication of the 16.4 KiB shell would cost ~131 KiB and blow the ceiling.

## Executed design

`flash.scss` is now a **shell** plus three extracted partials, and the two dialogue routes own
physically duplicated story stylesheets.

1. **`flash.scss` (shell)** — 39,670 B src / 33,756 B compiled. Keeps `page`,
   `.flash-visually-hidden`, `.flash-page`, `.flash-npc-portrait`, `.flash-scene-backdrop`,
   `.flash-button`, `.flash-state`, `.flash-location-consent`, `.flash-online-*`,
   `.flash-task-*`, `.flash-intro`, `.flash-finale*`, `.flash-empty-card`. Still JS-imported by
   the 8 `pages/alang` pages, and additionally imported from the `pages/alang-story` dialogue
   wrapper so it is reached from two different subpackages and lands in root `common.wxss`
   instead of the dead `pages/alang/sub-common.wxss`. `verify-flash-package.mjs` asserts
   `.flash-page` exists in `dist/common.wxss`.
2. **`flash-story.scss`** — 67,658 B src / 56,114 B compiled: L1044–EOF minus
   `.flash-preferences` and the radar/offer keyframes.
3. **`flash-radar.scss`** — 13,401 B compiled: `.flash-radar` + `@keyframes flash-radar-*` /
   `flash-offer-paper-*`. `@import`ed by `pages/alang/search/index.scss`.
4. **`flash-preferences.scss`** — 1,462 B compiled. `@import`ed by
   `pages/alang/preferences/index.scss`, which *still* also does `@import '../flash'` (the shell
   is globally available from `common.wxss`, so that line is ~33.7 KiB of duplicate WXSS inside
   the tightest subpackage). Removing it is a documented follow-up, deliberately not done in
   this change.
5. **story-unit component SCSS** — the side-effect `import './X.scss'` lines were removed from
   the story-unit components and the partials are `@use`d from the two dialogue page SCSS files.
   The `.scss` files stay on disk: `AtuanLaterActExperience.test.tsx:18`,
   `LaterActStoryExperience.test.tsx:23`/`:34` and `FlashFirstActContract.test.ts:104`/`:115`
   `readFileSync` them by path.
6. **Non-Alang levers** — side-effect SCSS imports removed from `ProfessionChatOverlay.tsx`,
   `Chip.tsx`, `IntentCard.tsx`, `OnboardingLoadingShell.tsx`, `XiaoyueChatBubble.tsx`; each
   owning page SCSS gained the `@use`. New `src/pages/onboarding/onboarding/index.scss`
   co-compiles `OnboardingLoadingShell.scss` for `OnboardingEntryPage`.

### Three behaviours the plan got wrong

- **A shared page module hoists its CSS.** Both dialogue routes render `FlashDialoguePage`, so
  the `.flash-dialogue` block (5.9 KiB) escalated to `common.wxss` even after extraction. Fix:
  the page module became CSS-free `src/pages/alang/dialogue/FlashDialoguePage.tsx`; each route
  keeps a thin `index.tsx` wrapper that imports its own stylesheet.
- **Two pages importing the same partial also hoists** (module reached by ≥2 page entries), so
  the two wrappers could not share `flash-story.scss`. Fix: `scripts/build-flash-story-styles.mjs`
  generates two physically distinct `story.scss` copies (one per dialogue page) from the source
  partials. `npm run check:flash-story-styles` is a `--check` drift gate and runs inside
  `build:weapp` before `taro build`.
- **Byte-identical generated stylesheets collapse onto one page.** With both copies identical,
  `dist/pages/alang/dialogue/` shipped with **no `.wxss` at all** while `pages/alang-story/dialogue`
  got the only copy. Fix: each generated file appends an inert page-identity token
  (`.flash-story-route--<routeId> { --flash-story-route: <routeId> }`) that styles nothing and
  keeps the two assets distinct.

### Result

| lever | compiled bytes off `common.wxss` |
|---|---|
| flash story rules | 56,114 |
| flash radar | 13,401 |
| story-unit component SCSS | ~46.2 KiB |
| non-Alang components | ~27.5 KiB |
| `.flash-dialogue` (page-module extraction) | 5.9 KiB |
| **total** | **~154,621 B** |

`dist/common.wxss`: 259,727 B → **105,106 B** (−151.0 KiB), target ≤128,443 B.

Post-build: `pages/alang/dialogue/index.wxss` 105,543 B, `pages/alang-story/dialogue/index.wxss`
105,555 B, no non-empty `sub-common.wxss`, main zip 1.33 MB / 2.00 MB, Alang 1.65 MB / 1.80 MB,
Alang Story 1.40 MB / 1.80 MB.

## Guard updates (done)

- `scripts/verify-subpackage-styles.mjs`: the six `flash-interaction__{goal,track,waypoint,
  region,confirm,hint}{` selectors now assert against **both** dialogue page WXSS
  (`pages/alang/dialogue/index.wxss`, `pages/alang-story/dialogue/index.wxss`), not
  `common.wxss`. The `Chip` entry moved from `common.wxss` to
  `pages/profile-linked/edit-profile/index.wxss` — `Chip.scss` is no longer side-effect
  imported, and edit-profile is the only page that passes `heat`. The gate also fails on any
  non-empty `sub-common.wxss`.
- `scripts/verify-flash-package.mjs`: story-viewport assertions retargeted to the two dialogue
  page WXSS; `.flash-page` in `dist/common.wxss` still asserted.
- `scripts/build-flash-story-styles.mjs --check` is wired into `build:weapp` as
  `check:flash-story-styles`, so editing a story partial without regenerating fails the build.
- The staged rename of the dialogue page module surfaced two pre-existing `✦` dingbats
  (`FlashDialoguePage.tsx`), which the repo's inline-emoji guardrail blocks on full staged-file
  content. They are now a CSS-drawn spark (`.flash-dialogue__choice-mark--spark`, rotated
  rounded square, `background: currentColor` so the per-panel `color` overrides still apply) —
  same approach as `profile/index.scss` `&__archive-spark`.

## Verification loop

CI's compiled-size number is only visible in the `build-weapp` job log (it needs the CI-only
upload key + `get-compiled-result`). Local proxy, all green on 2026-10-29:

```bash
npm run build:weapp -w mini-program            # PASS (verify-flash-package, check:package-size, verify:upload-assets)
wc -c apps/mini-program/dist/common.wxss       # 105,106 B (baseline 259,727 B; target ≤128,443 B)
npm run verify:subpackage-styles -w mini-program   # PASS, 20 entries, no non-empty sub-common.wxss
npm run check:flash-story-styles -w mini-program   # up to date
npm run typecheck -w mini-program              # clean
npm run guardrails                             # 0 errors / 12 pre-existing warnings
```

Then push and read `[compiled-package-size] main source …` from the `build-weapp` log.

### CI result (2026-10-29, authoritative)

`a727ca953` → `Deploy Staging` run `40830575293` success (incl. `Mini Program Tests`) →
`Build Taro WeChat Mini-Program` run `40831578266` success (`build-weapp` + `upload-weapp`).

```
[compiled-package-size] main source 1865.2 KiB
  (WeChat-equivalent 2025.2 KiB incl. 160.0 KiB accounting overhead); WeChat headroom 22.8 KiB
```

The 80200 rejection (WeChat reported 2182 KB) is cleared, and the 开发版 uploaded:
`version 1.0.20261029.0653`, `desc Auto-deploy (staging): a727ca9`, upload zip 6,512,804 B,
`✅ WeChat upload complete (synchronous, output verified)`.
（2026-11-27 起该成功行改为 `✅ WeChat upload complete (direct HTTP path, response errCode checked)`：
`--use-cos=false` 在 miniprogram-ci ≤2.1.48 是无效参数，上传已改走 JS API 直连路径，见 AGENTS.md。）

Two things this leaves open:

- **Headroom is thin.** 22.8 KiB under WeChat's real 2048 KiB ceiling, and the internal rail
  (`JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES` = 1856 KiB) now only *warns* — it is exceeded by
  9.2 KiB. Any new main-package JS/WXSS re-breaks 80200. With `common.wxss` down to 105,106 B
  (~103 KiB of the 1865.2 KiB main source) the bulk of what remains is JS — the upload log
  already shows `common.js` crossing Babel's 500 KB deopt threshold — so the next reduction has
  to come from JS; do not expect another CSS split to buy room.
- **`pages/alang` is now the tightest subpackage**: 1806.5 KiB raw / 1966.5 KiB
  WeChat-equivalent / 81.5 KiB headroom, because `pages/alang/preferences/index.scss` still
  `@import`s `../flash` alongside its `flash-preferences` partial (~33.7 KiB duplicate). Not
  touched here because it was outside the 80200 fix; `pages/alang-story` sits at 370.7 KiB
  headroom so the split has room to absorb a follow-up.

## Risk

Subpackage style-splitting has blanked UI on device three times
(2026-07-21 my-image stage, 2026-08-03 flow-animation intro, 2026-08-17 icebreaker-session
phase views). Every extracted partial must be `@use`d from the owning page SCSS with the
component's side-effect import removed — the pattern in
`docs/runbooks/mini-program-asset-delivery.md` §1.3 / §4.6.

**WeChat DevTools and real-device verification are mandatory before shipping.**
