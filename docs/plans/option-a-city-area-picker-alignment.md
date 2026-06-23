# Option A — City/Area Picker Alignment Plan

> **Status:** Implemented 2026-06-23.
> **Final audit scores:** Frontend Design 20/20, Completeness 44/44, Performance PASS (53/60).
> **Remaining work:** Capture WeChat DevTools screenshots on iPhone SE and iPhone 14 Pro as manual QA evidence.

## 1. Current-state audit

### Frontend design audit

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Brand Fidelity | 2/4 | `CityPickerSheet` uses two selection metaphors: hot tiles = `primary-light` bg + primary border, list rows = 5% primary tint + primary checkmark. `LocationFilterDrawer` already uses filled-primary, so the surfaces feel like different products. City picker also uses emoji glyphs (🔍, 🔥, ✓) for functional affordances. |
| State Completeness | 3/4 | City picker covers loading, empty, error, disabled, celebration; area drawer covers open/close, selected, pending, hover. City picker lacks a header close affordance and JS reduced-motion hook. |
| Token Discipline | 3/4 | Both mostly use `variables.scss`, but city picker uses `85vh` and hard-codes `rgba(255,255,255,0.96)` on the celebration overlay. |
| Platform Safety | 2/4 | `85vh` violates the no-`vh/vw` rule; city picker hot-grid gap is 8rpx; title uses `overflow-wrap: break-word` on CJK display text. Area drawer uses a fixed 1020rpx height that can overflow short phones. |
| Motion Hygiene | 3/4 | Animations use `transform`/`opacity` and brand easing, but city picker has no `useMiniRevealMotion` integration. |
| **Health Score** | **13/20** | **Acceptable** — fix before ship. |

### UI layout audit

**Layer inventory (city picker):** backdrop → sheet → handle → mascot/title/subtitle → search → hot cities → city list → footer CTA → celebration overlay.

**Layer inventory (area drawer):** backdrop → surface → handle → mascot/title/close → ScrollView → all-regions hero → cluster sections → 2-col district grid → safe-area spacer.

**Spacing:** City picker leans on 8rpx/16rpx gaps that feel tight vs. the 24rpx/40rpx rhythm elsewhere. Area drawer spacing is more generous (header 16/40/24, cluster margin-bottom 40rpx, grid gap 24rpx).

**Typography:** City picker title is `$font-size-lg` (36rpx); area drawer uses `type-heading` (40rpx). Unify to the same scale.

**Emoji scan:** City picker search 🔍, hot icon 🔥, and checkmark ✓ are functional glyphs. Area drawer uses 🌐 and a text ✓. Replace functional emojis with icon components where possible.

**Alignment / safe area:** Both use 32–40rpx horizontal margins and reserve `env(safe-area-inset-bottom)`.

**Visual coherence:** The dual selected-state language inside the city picker and across surfaces is the core coherence break; Option A fixes it.

## 2. Unified design spec (Option A)

### Shell

| Property | Value | Token |
|----------|-------|-------|
| Height | 1100rpx fixed (compute via `Taro.getSystemInfoSync()` if overflow risk) | — |
| Top radius | 40rpx / 40rpx / 0 / 0 | `$card-radius-lg` |
| Handle | 56rpx × 6rpx, `$color-divider`, margin 16rpx auto | — |
| Backdrop | `rgba(0,0,0,0.4)` | `$color-overlay` |
| Surface bg | `#FFFFFF` | `$color-surface` |
| Entrance | `translateY(100%) → 0`, 280ms `cubic-bezier(0.22, 1, 0.36, 1)` | — |
| Backdrop fade | opacity 0 → 1, 200ms ease-out | — |

### Header

| Element | City picker | Area drawer |
|---------|-------------|-------------|
| Mascot | `homeWelcome`, 56rpx | `coachGuide`, 56rpx |
| Title | `type-heading`, 40rpx, `$color-text-primary-warm` | `type-heading`, 40rpx, `$color-text-primary` |
| Subtitle | `$font-size-sm`, `$color-text-secondary`, line-height 1.5 | none |
| Close | Circular 88rpx tap target, `$color-bg` bg | keep existing |

### Tile (unified)

| Variant | Height | Radius | Gap | Padding | Font |
|---------|--------|--------|-----|---------|------|
| Compact (hot city / all regions) | min 96rpx | `$card-radius-sm` (24rpx) | 16rpx | 24rpx | `$font-size-base` semibold |
| Large (district) | min 136rpx | `$card-radius-sm` | 16rpx | 24rpx | `$font-size-base` bold |
| List row (city list) | min 88rpx | 0 | — | 24rpx 0 | `$font-size-base` normal |

**Selected state (all):** bg `$color-primary` (#8B5CF6), text `$color-text-white`, white checkmark 28rpx, no border, shadow `$shadow-primary-soft`.

**Unselected state (all):** bg `$color-bg`, border 2rpx solid transparent, text `$color-text-primary-warm`.

### Search bar (city picker only)

- Height 88rpx, radius `$radius-md` (16rpx), bg `$color-bg`, padding 0 24rpx.
- Replace emoji search icon with a non-emoji `JoyJoinIcon` search symbol.
- Placeholder color `$color-text-muted`.

### Footer CTA (city picker only)

- Height 96rpx, radius `$button-radius` (48rpx), bg `$color-primary`.
- Label `$font-size-md` semibold, white.
- Footer padding 16rpx 32rpx + `env(safe-area-inset-bottom)`.
- Disabled: `rgba($color-primary, 0.4)`; loading: opacity pulse 1.2s.

### Press / reduced-motion / safe-area

- Press feedback: `hoverClass` scale 0.97 + opacity 0.92 on every tile, CTA, and close button.
- Reduced motion: read via `useMiniRevealMotion`; add `picker-shell--reduce-motion` class that disables transitions/animations. Keep `@media (prefers-reduced-motion: reduce)` fallback.
- Safe area: footer and scroll-bottom spacer use `env(safe-area-inset-bottom)` with a 24rpx minimum.

## 3. Product guardrails (PM review additions)

### Interaction model preservation
The visual refactor must **not** change the underlying selection metaphors:
- **City picker (`CityPickerSheet`)**: single-select with explicit CTA confirm. User taps one city, sees filled-primary state, then taps footer CTA to register interest and close.
- **Area drawer (`LocationFilterDrawer`)**: multi-select / filter-by-cluster. User taps multiple districts; filters apply on selection or drawer close. No CTA required.
- `SelectableTile` must support both: single-select keeps a persistent checkmark; multi-select toggles checkmark on/off. Heat badges remain informational, not selection affordances.

### State-preservation contract
- Existing selected city/area must survive the refactor without loss.
- Reopening either picker restores the previously selected state.
- No analytics `select` event fires spuriously during state rehydration or on mount.

### Shell state ownership
- `PickerShell` owns chrome states: open/close animation, reduced-motion, safe-area, backdrop click, header/footer layout.
- Content states (empty, loading, error, celebration) remain owned by each consumer (`CityPickerSheet`, `LocationFilterDrawer`). Document this boundary in code comments.

### Short-phone height rule
- Replace vague "compute via `Taro.getSystemInfoSync()` if overflow risk" with a concrete rule:
  - Default shell height: `1100rpx`.
  - Cap at `min(1100rpx, windowHeight - 160rpx)` computed at runtime.
  - Scrollable content area uses `flex: 1` so the footer CTA never gets pushed off-screen.

### Analytics / launch-readiness
- Preserve byte-identical analytics payloads (`city_name`, `source`, `filter_type`, `selected_count`).
- Monitor `city_picker_confirm` → `city_unlock_interest` → `pool_list_view` funnels for 7 days post-ship.
- Include a rollback plan: revert PR; 24-hour smoke-test window before wider release.

## 4. Implementation plan

### New files

```text
apps/mini-program/src/components/discover/PickerShell.tsx
apps/mini-program/src/components/discover/PickerShell.scss
apps/mini-program/src/components/discover/SelectableTile.tsx
apps/mini-program/src/components/discover/SelectableTile.scss
```

`PickerShell` props:

```ts
interface PickerShellProps {
  visible: boolean
  onClose: () => void
  mascotExpression: 'homeWelcome' | 'coachGuide'
  title: string
  subtitle?: string
  showClose?: boolean
  reduceMotion: boolean
  children: ReactNode
  footer?: ReactNode
}
```

`SelectableTile` props:

```ts
interface SelectableTileProps {
  selected: boolean
  onClick: () => void
  label: string
  variant: 'compact' | 'large' | 'row'
  checkmark?: boolean
  children?: ReactNode
}
```

### Files to modify

- `CityPickerSheet.tsx/.scss` — adopt shell/tile, replace `85vh`, add header close, unify selected state, swap emoji search icon.
- `LocationFilterDrawer.tsx/.scss` — adopt shared shell/tile for header and district tiles; preserve heat badges and pending opacity.
- `apps/mini-program/src/styles/_variables.scss` — add `$picker-shell-height: 1100rpx` alias if desired.

### Refactoring order

1. Add any new SCSS tokens.
2. Build `PickerShell` + `SelectableTile` with reduced-motion and safe-area behavior in isolation.
3. Refactor `LocationFilterDrawer` first — lower risk and already close to target.
4. Refactor `CityPickerSheet` — larger visual change; verify search, hot grid, list, footer, and celebration.
5. Delete `CityUnlockBanner.tsx` and `CityUnlockBanner.scss` (orphaned; entry point is now `CityUnlockFeedCard`).
6. Run `npm run guardrails`, lint, type-check, and design audits.

### Analytics / haptics preservation

- City picker: keep `city_picker_open/close/search/select/confirm/success/error/offline_blocked`.
- Area drawer: keep `filter_open/select/close`.
- Keep `haptics('light')` on selection/close, `haptics('medium')` on confirm, `haptics('success')` on success.
- Keep city picker celebration overlay and timer cleanup.
- Keep area drawer `transitioningRef` guard and 150ms close delay.

### Dead-code cleanup

- Remove `components/discover/CityUnlockBanner.tsx` and `.scss`.
- Confirm no imports remain with `grep -R CityUnlockBanner apps/mini-program/src`.

## 5. Acceptance criteria / Sprint Contract input

1. Every selectable tile in both pickers renders the **filled-primary (#8B5CF6) selected state with a white checkmark**.
2. No `vh`/`vw`/`px` units appear in modified picker styles; shell height is expressed in rpx or computed in JS.
3. All tappable targets are ≥88rpx and have a visible pressed state.
4. City picker header gains a close affordance matching the area drawer.
5. No hard-coded hex colors in new/modified SCSS; colors resolve through existing tokens or newly added token variables.
6. Both pickers respect reduced motion via `useMiniRevealMotion` **and** `@media (prefers-reduced-motion: reduce)`.
7. City picker search bar no longer uses an emoji as its primary search icon.
8. `CityUnlockBanner.tsx/.scss` are deleted and no references remain.
9. All analytics events and haptics calls from the original components are preserved.
10. WeChat DevTools computed-layout screenshots attached for iPhone SE and iPhone 14 Pro.

### Verification plan

- **DevTools:** capture both pickers on iPhone SE and iPhone 14 Pro; verify tile heights, tap targets, safe-area padding, and selected-state color.
- **Re-audit:** re-run `frontend-design-audit` and `ui-layout-audit`; target health score ≥18/20.
- **CI gates:** `npm run guardrails`, `npm run check:full`, and mini-program build.
- **Manual:** smoke-test city picker search-to-select and area drawer cluster/district selection on a device/simulator.
- **Analytics fidelity:** compare pre/post event payloads for `city_picker_*` and `filter_*` events to ensure byte-identical props.
- **Launch:** 24-hour smoke-test window; 7-day conversion monitoring.
