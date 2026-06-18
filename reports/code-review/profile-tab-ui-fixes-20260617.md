# Code Review — Profile Tab UI Fixes

**Surface:** JoyJoin WeChat Mini-Program Profile tab and sub-screens  
**Reviewer:** Code Review Agent  
**Date:** 2026-06-17  
**Sprint Contract:** `.git/.orchestration/sprints/sprint-contract.profile-ui-fixes.20260617.md`  
**QA Report:** `reports/qa/profile-tab-ui-fixes-verification.md`

---

## Overall Verdict: **Approve**

The PR cleanly fixes the stated problems: Profile menu icons now route through the shared `JoyJoinIcon` / `ui` tier with local bundled assets, the scroll container uses a bounded flex shell, the archetype avatar has a resilient fallback chain, and the four sub-screens converge on shared mixins and tokens. All deterministic gates pass. No blocking correctness or security issues were found.

Caveat: actual WeChat DevTools / on-device visual verification is still required, as noted in the QA report.

---

## Deterministic Checks Re-run

| Check | Command | Result |
|---|---|---|
| Mini-program typecheck | `npm run typecheck -w mini-program` | ✅ Pass |
| Shared tests | `npm run test -w @joyjoin/shared` | ✅ Pass (292/292) |
| Mini-program tests | `npm run test -w mini-program` | ✅ Pass (355/355, 1 skipped) |
| Guardrails | `npm run guardrails` | ✅ Pass |
| Design audit | `node scripts/devtools/design-audit.mjs` | ✅ Clean (0 errors, 0 warnings) |
| Harness gate | `npm run harness:gate` | ⚠️ CONCERN (91/100) — only pre-existing unrelated issues |

The Harness gate's concerns (`apps/server/src/routes/domains/shell.ts` pagination, `apps/mini-program/src/pages/blind-box-payment/index.tsx` size, `packages/shared/src/api.ts` size, `packages/shared/src/constants.ts` Chinese string) are unrelated to the changed files and were already present.

---

## Per-File Findings

### `apps/mini-program/src/pages/profile/index.tsx`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Replaced direct `Image` / `localAsset` icon imports with `JoyJoinIcon` + emoji/`tier='ui'` mapping, centralizing asset resolution. | 56–64, 939–947, 1128–1134 | — |
| ✅ Good | Removed `enhanced` from `ScrollView`, eliminating a known WeChat scroll-interference prop. | 814–821 | — |
| ✅ Good | `tabEntranceClass` is now gated by `consumeTabEntrance()`, so the entrance animation only fires on genuine tab switches. | 106, 812 | — |
| ✅ Good | `ArchetypeHead` receives `fallbackText={displayName}`, giving users without an archetype a branded initial instead of a raw placeholder. | 832–837 | — |
| ⚠️ Concern | `UI_ICON_MAP` maps both `📤` (share-card) and `👥` (stat) to `icon-people`. The reuse is intentional and visually distinct by row context, but a future maintainer may assume the mapping is 1:1. | `packages/shared/src/iconSystem/emojiToIconMap.ts:190, 194` | Add a short comment in `UI_ICON_MAP` explaining that `📤` deliberately reuses `icon-people` because no dedicated share-card asset exists. |

### `apps/mini-program/src/pages/profile/index.scss`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Replaced `@include viewport-min-height` with explicit `min-height: 100vh` + `min-height: 100dvh` fallback, matching the updated AGENTS.md guidance. | 6–10 | — |
| ✅ Good | `&__scroll` now has `flex: 1; min-height: 0; height: 100%`, which prevents the lower-viewport flex-collapse trap. | 41–45 | — |
| ✅ Good | Menu icon well removed `opacity: 0.9` so the rendered icon is fully opaque; explicit `40rpx` sizing keeps the asset crisp. | 670–674 | — |
| ✅ Good | Dark-mode and reduced-motion overrides remain intact; degradation-tier gating is preserved. | 955–1043 | — |
| Nit | The file still defines many page-scoped CSS custom properties rather than using global tokens. This is pre-existing and not a regression, but increases maintenance surface. | 12–38 | Consider migrating to global tokens in a future refactor. |

### `apps/mini-program/src/components/mascot/ArchetypeHead.tsx`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Added a CDN WebP fallback when the local bundled head fails to load, then a text-initial fallback when both fail. | 42–45, 61–70, 84–87 | — |
| ✅ Good | Keeps bare filenames (no `@3x` suffix), avoiding the WeChat `@3x@3x` bug documented in AGENTS.md. | 27–40 | — |
| ✅ Good | Sets `lazyLoad={false}` for the local asset, matching the recommended eager-load behavior for bundled icons. | 95 | — |
| Nit | `HEAD_PATHS` is typed as `Record<string, string>`. An invalid archetype key silently yields `undefined` and falls back to the initial placeholder, which is safe, but a more constrained type would catch typos at compile time. | 27 | Consider `Record<ArchetypeV4Id, string>` if the 12 keys are exported from the shared package. |

### `packages/shared/src/iconSystem/emojiToIconMap.ts`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Added `'ui'` to the `IconTier` union, `TIER_MAPS`, `ICON_FOLDER_MAP`, and the bundled-local comment block; **not** added to `CDN_ICON_TIERS`. | 24, 223, 289, 262–275 | — |
| ✅ Good | `UI_ICON_MAP` entries include `fallbackEmoji` and a `tint`, so `JoyJoinIcon` can render a placeholder while the asset loads. | 186–195 | — |
| ⚠️ Concern | `UI_ICON_MAP` is not merged into the flat `EMOJI_TO_ICON_MAP`. This is consistent with how `REACTION_MAP`, `REVEAL_MAP`, etc. are handled, but it means `hasIconMapping('✏️')` returns `false`. All current callers pass an explicit `tier='ui'`, so this is safe. | 201–208 | Document the intentional omission with a one-line comment, or add `UI_ICON_MAP` to the flat map if future global lookups are desired. |

### `packages/shared/src/iconSystem/__tests__/iconTiers.test.ts`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Added `'ui'` to the local-tiers invariant test, locking in the bundled-local resolution. | 15 | — |

### `apps/mini-program/src/pages/edit-profile/index.scss`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Switched to `@include page-gradient-bg` and `min-height: 0` on the scroll container, matching the profile-page flex-shell pattern. | 5–13 | — |
| ✅ Good | `&__section-title` now uses `type-heading`; intent-card styles align with the existing JSX structure (`__intent-icon`, `__intent-text`, `__intent-check`). | 33–36, 201–287 | Verified that `edit-profile/index.tsx` already renders the new structure; no mismatch. |
| ✅ Good | Removed `overflow-wrap: anywhere` usage. | — | — |

### `apps/mini-program/src/pages/rewards/index.scss`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Hero and section titles now use `type-title` / `type-heading` shared mixins. | 33–36, 142–145 | — |
| ⚠️ Concern | Status-badge backgrounds still use hardcoded `rgba(...)` values (e.g., `rgba(46, 204, 113, 0.12)`). `design-audit` passes, but they drift from the token system. | 181, 186, 191 | Migrate to existing status-color tokens (`$color-success`, `$color-warning`, etc.) with opacity helpers in a follow-up. |

### `apps/mini-program/src/pages/invite/index.scss`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Titles use `type-title` / `type-heading`; `overflow-wrap: anywhere` replaced with `overflow-wrap: normal` for CJK safety. | 41–44, 86, 138, 167, 175 | — |
| ✅ Good | `page-gradient-bg` is applied. | 6 | — |
| Nit | Several rules are collapsed onto single lines (e.g., `.invite-page__code-label`), which hurts readability. This is pre-existing. | 59–61 | Reformat to multi-line when touching this file next. |

### `apps/mini-program/src/pages/terms/index.tsx`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Removed `enhanced` from `ScrollView`, matching the profile-page fix. | 24–29 | — |

### `apps/mini-program/src/pages/terms/index.scss`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Now uses `@include page-gradient-bg` and `@include safe-area-bottom-padding(padding-bottom, 80rpx)`. | 5–7 | — |
| ✅ Good | Title uses `type-heading`. | 26–29 | — |
| Nit | The safe-area mixin override depends on declaration order because the shorthand `padding: $container-padding` is declared first. It works, but explicit `padding-top/right/left` would be clearer. | 6–7 | Refactor to `padding: $container-padding $container-padding 0; @include safe-area-bottom-padding(padding-bottom, 80rpx);` for clarity. |

### `AGENTS.md`

| Severity | Finding | Line | Recommendation |
|---|---|---|---|
| ✅ Good | Updated bundled-assets list to include the `ui` tier and refreshed the `CDN_ICON_TIERS` pitfall date. | 274–275 | — |
| ✅ Good | Documented `lazyLoad` prop and eager-load default for local bundled icons. | 314 | — |
| ✅ Good | Added `100vh` fallback guidance before `100dvh` for stand-alone loaders. | 333 | — |
| Nit | Contains several other doc-sync updates (tab bar debounce, drawer `catchMove`, heat-badge tokens). They appear accurate but are outside the PR scope; confirm they reflect already-merged code. | 289, 396, 398 | None — routine doc-sync. |

---

## Harness Engineering Framework Verdicts

| Pillar | Verdict | Notes |
|---|---|---|
| **Reliability** | ✅ Pass | Icon fallback chain is 4-tier (mapping → require → load → emoji) for `JoyJoinIcon` and 3-tier (local → CDN → initial) for `ArchetypeHead`. Scroll container uses bounded flex shell with `min-height: 0`. Offline handling on Profile is preserved. |
| **Scalability** | ✅ Pass | No new network round-trips for the hot path; `ui` icons are bundled locally and load eagerly. Shared mapping is in `packages/shared`, reusable by future surfaces. No unbounded lists or queries added. |
| **Security** | ✅ Pass | No secrets, API URLs, or debug flags introduced. Auth gating unchanged. Analytics events remain whitelisted. |
| **Observability** | ✅ Pass | Existing analytics events (`profile_menu_tap`, `profile_stat_tap`, `profile_view`, etc.) remain wired. No new failure paths added without existing error handling. |
| **Maintainability** | ✅ Pass (minor concerns) | Sub-screen SCSS now shares `page-gradient-bg`, `type-heading`, `type-title`, and spacing/radius tokens. The only remaining drift is a few hardcoded rgba values in `rewards/index.scss` and the `UI_ICON_MAP` semantic overlap noted above. |

---

## Regression Risk

| Risk | Assessment |
|---|---|
| Menu icons fail to render | Low. Assets exist, are copied to `dist`, map is tested, and `JoyJoinIcon` falls back to emoji. |
| Profile scroll trap returns | Low. The flex shell (`min-height: 100vh/dvh`, `flex: 1`, `min-height: 0`, `height: 100%`) is the canonical fix. |
| Archetype head missing | Low. Local→CDN→initial fallback covers cache misses and stale subpackage updates. |
| Sub-screen visual breakage | Low. Only SCSS tokens/mixins changed; JSX structure is unchanged. |
| Dark mode / reduced motion | Low. Both `@media` blocks are preserved. |

---

## Recommended Next Steps

1. **Visual sign-off in WeChat DevTools** (required before merge per `mini-program-frontend-excellence` Full-tier checklist): verify menu icons, scroll reachability on short/tall devices, all 12 archetype heads, and dark-mode appearance.
2. Address the two **concern**-level comments above (add a comment for the `📤`/`👥` → `icon-people` reuse; consider clarifying `terms-page` padding).
3. Optional follow-up: migrate remaining hardcoded rgba values in `rewards/index.scss` to tokens.

---

## Sign-off

**Approve** — no blocking issues. The PR meets the sprint contract acceptance criteria and the JoyJoin repo conventions.
