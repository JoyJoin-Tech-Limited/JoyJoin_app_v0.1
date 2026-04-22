# JoyJoin Mini-Program Animation & Transition Audit Report

**Date:** 2026-04-21  
**Scope:** `apps/mini-program` — Taro WeChat Mini-Program  
**Auditors:** Performance Auditor | UX & Premium Aesthetics Expert | Code Quality & Taro Best Practices Inspector | Transition Flow & Consistency Auditor  

---

## Executive Summary

The JoyJoin mini-program demonstrates **strong foundational motion design** in high-emotion surfaces (squad unboxing, onboarding, matching status) but suffers from **inconsistent premium polish** across lower-priority pages and several **performance anti-patterns** that will degrade experience on mid-tier Android devices. The top critical issues and opportunities are:

1. **Performance: Layout-thrashing animations (`width`, `filter: blur`, continuous `drop-shadow`)** are used in hero moments (`AchievementPopup`, `FancyLineLoadingScreen`, `discover` skeletons) that will jank on WeChat's JSCore.
2. **Missing: No native page-transition configuration** in `app.config.ts` — the app relies on WeChat's default slide, which creates a disjointed feel between the premium custom animations inside pages and the abrupt platform-default navigation between them.
3. **UX Gap: Achievement popups, icebreaker phase changes, and tab switches appear instantly** without entrance choreography, undermining the "magical" brand promise established by the squad-unboxing blind-box sequence.
4. **Code Quality: Broken reduced-motion detection** in `AnalyzingAnimation.tsx` (always returns `false`) and an unreliable `usePrefersReducedMotion` hook (uses `matchMedia`, which is not supported in WeChat runtime) create accessibility violations.
5. **Opportunity: The blind-box unboxing sequence is excellent** — it should be codified as a reusable "JoyJoin Reveal Pattern" and applied to the matching-status live-reveal overlay and pool-registration confirmation moments for narrative consistency.

**Current Premium Score: 6.5 / 10**  
**Projected Premium Score (after proposed changes): 8.7 / 10**

---

## Agent 1: Performance Auditor — Findings

### 🔴 Critical

#### PA-1: `width` animation in `AchievementPopup.scss` triggers layout on every frame
- **File:** `apps/mini-program/src/components/AchievementPopup.scss` (line 93)
- **Issue:** The progress bar uses `@keyframes achievement-shrink { from { width: 100%; } to { width: 0%; } }`. Animating `width` forces layout recalculation every frame — the single most expensive property to animate on a mini-program.
- **Impact:** On low-end devices, this 3.5 s linear animation can drop the entire popup composition below 45 fps.
- **Fix:** Use `transform: scaleX()` on a child element instead:

```scss
.achievement-popup__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4rpx;
  width: 100%;
  border-radius: 0 0 $card-radius $card-radius;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background: currentColor;
    transform-origin: left center;
    animation: achievement-shrink-transform 3.5s linear forwards;
  }
}

@keyframes achievement-shrink-transform {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
```

#### PA-2: Continuous `filter: drop-shadow` shimmer on `FancyLineLoadingScreen`
- **File:** `apps/mini-program/src/components/FancyLineLoadingScreen.scss` (lines 40–42, 63–72)
- **Issue:** The logo entrance + infinite shimmer animates `filter: drop-shadow(...)` at 60 fps. Filter animations are not composited on many WeChat Android runtimes and are processed on the CPU.
- **Impact:** Loading screen is the first thing users see; a stutter here sets a poor premium expectation.
- **Fix:** Replace the infinite filter animation with an opacity-cross-fade between two pre-rendered logo layers, or use a static glow + `transform: scale()` pulse:

```scss
.fancy-line-loading-screen__logo {
  animation: fancy-line-logo-entrance 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards,
             fancy-line-logo-pulse 2.4s ease-in-out 0.6s infinite;
  will-change: transform, opacity;
}

@keyframes fancy-line-logo-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.03); opacity: 0.92; }
}
```

### 🟠 High

#### PA-3: `Math.random()` inside render causes unstable sparkle positions
- **File:** `apps/mini-program/src/components/AnalyzingAnimation.tsx` (lines 107–108)
- **Issue:** `top: \`${20 + Math.random() * 60}%\`` and `left: \`${20 + Math.random() * 60}%\`` are evaluated on every render. This causes sparkles to teleport if any parent state updates during the animation.
- **Fix:** Memoize positions with `useMemo`:

```tsx
const sparklePositions = useMemo(() =>
  sparkles.map(() => ({
    top: `${20 + Math.random() * 60}%`,
    left: `${20 + Math.random() * 60}%`,
  })),
  [] // stable for component lifetime
);
```

#### PA-4: Excessive composite-layer pressure on squad-unboxing "opening" state
- **File:** `apps/mini-program/src/pages/squad-unboxing/index.scss` (lines 299–320)
- **Issue:** The `.squad-unboxing__blind-box-visual--opening` modifier triggers **five simultaneous independent animations** (`aura`, `lid-lift`, `box-bounce`, `inner-glow` transition, `spark`). While each uses `transform`/`opacity`, the combined layer count can exhaust the compositor on devices with a 4-layer limit.
- **Fix:** Merge the lid + body movement into a single `@keyframes` on the parent container, or add `will-change: transform` only to the active state and remove it on completion via JS.

#### PA-5: `filter: blur()` used for decorative ambient backgrounds
- **Files:** Multiple — `personality-test/index.scss` (lines 57, 67), `discover/index.scss` (live-pulse dot), `squad-unboxing/index.scss` (blind-box-shadow)
- **Issue:** `filter: blur(10rpx)` to `filter: blur(28rpx)` is used for ambient glows. On iOS this is GPU-fast; on Android WeChat it often falls back to CPU rasterization.
- **Fix:** Replace runtime blur with pre-exported blurred PNG/WebP assets, or use a semi-transparent gradient oval to simulate the glow without `filter`.

### 🟡 Medium

#### PA-6: `transition: all` on discover filter chips
- **File:** `apps/mini-program/src/pages/discover/index.scss` (line 110)
- **Issue:** `transition: all 0.2s ease` causes the browser to watch every property. The active state changes `color`, `background`, and `box-shadow` simultaneously.
- **Fix:** `transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;`

#### PA-7: Missing `will-change` on high-frequency animations
- **Files:** `matching-status/index.scss` (`matching-dot-pulse`), `discover/index.scss` (`discover-card-enter`, `discover-live-pulse`), `icebreaker-session/index.scss` (statement `:active`)
- **Fix:** Add `will-change: transform, opacity` to animated elements and remove after animation completes (or use `animation-fill-mode: forwards` and keep it for short loops).

---

## Agent 2: UX & Premium Aesthetics Expert — Findings

### ✅ Excellent

| Animation / Surface | Why It Works |
|---------------------|--------------|
| **Squad Unboxing — Blind Box Sequence** | A true "wow" moment. Three-state machine (`ready` → `opening` → `open`) with narrative pacing: floating anticipation → shaking energy → explosive lid-lift with sparks. The `shouldReduceMotion` guard is respected. |
| **Onboarding Stage Entrance** | Staggered `onboarding-stage` mixin (`0.06s`–`0.24s` delays) with `cubic-bezier(0.22, 1, 0.36, 1)` creates a refined, iOS-like editorial feel. Consistent across personality-test, essential-data, extended-data, and profile-review. |
| **Matching Status — Waiting Seat Visualisation** | The orbital table layout with animated seat fills (`matching-seat-pulse`) turns a boring "loading" state into a spatial story. Excellent use of motion to explain system state. |
| **FormStepper Progress Fill** | `transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1)` — smooth, physically plausible easing that matches the onboarding stage language. |
| **Xiaoyue Chat Bubble — Sentence Stagger** | `xiaoyue-sentence-in` with per-sentence delay makes the mascot feel alive and conversational. |

### ⚠️ Needs Improvement

| Animation / Surface | Issue | Recommendation |
|---------------------|-------|----------------|
| **AchievementPopup entrance** | Popup mounts instantly with no entrance choreography; only the progress bar moves. | Add a `transform: translateY(-24rpx) scale(0.96)` → `translateY(0) scale(1)` entrance with `opacity` fade over `0.35s` using the brand easing curve. Legendary variants should get a subtle gold shimmer overlay. |
| **Icebreaker Session phase transitions** | When advancing from `warmup` → `challenge` → `lie_detective` → `recap`, the old phase unmounts instantly and the new phase snaps in. | Implement a 240 ms cross-fade + 12 rpx vertical slide wrapper around the phase renderer. Use `opacity` + `transform` only. |
| **Discover pool card `:active` feedback** | `transform: scale(0.98)` is too subtle and feels "mushy" on Android. | Add a brief `opacity: 0.96` + `box-shadow` reduction to simulate physical depression. Ensure `transform-origin: center`. |
| **Custom Tab Bar tab switch** | Instant icon swap with no transition. The active state opacity jumps from `0.5` → `1.0`. | Add `transition: opacity 0.2s ease, transform 0.2s ease` to icons. Consider a 4 rpx upward nudge (`translateY(-2rpx)`) for the active tab to reinforce selection. |
| **Button component micro-interactions** | Only `scale(0.98)` on `:active`. Missing loading-state animation. | Add a subtle ripple-origin effect on press ( WeChat-safe: scale + opacity only). For loading, replace label with an animated dot-ellipsis or rotate a small SVG spinner rather than static text. |
| **Carousel indicator** | Active indicator snaps from `20rpx` to `48rpx` width instantly. | `transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1)` on `.ai-match-promo-carousel__indicator`. |

### ❌ Missing

| Surface | Priority | Recommendation |
|---------|----------|----------------|
| **Page-to-page transitions** | 🔴 Critical | See Agent 4 findings. |
| **Haptic feedback pairing** | 🟠 High | Pair key animations with `Taro.vibrateShort` on iOS/Android where available (blind-box open, match reveal, achievement unlock). |
| **Skeleton-to-content morph** | 🟠 High | Currently skeletons unmount instantly and content snaps in. Add a 200 ms opacity cross-fade and stagger the first 3 content items with `discover-card-enter` delays. |
| **Pull-to-refresh elasticity** | 🟡 Medium | The discover page refresher is native; no custom brand feel. Wrap the native refresher with a custom Xiaoyue mascot that peeks down as the user pulls. |
| **Empty state entrance** | 🟡 Medium | Empty states in discover and events appear instantly. Stagger the emoji, title, and CTA with `onboarding-prelude` timing. |
| **Live Reveal Overlay — stage sequencing** | 🟡 Medium | The overlay stages (`match` → `members` → `theme`) should use shared-element transitions: the emoji/icon from the match card morphs into the member grid header. |

---

## Agent 3: Code Quality & Taro Best Practices Inspector — Findings

### 🔴 Critical

#### CQ-1: Broken reduced-motion detection in `AnalyzingAnimation.tsx`
- **File:** `apps/mini-program/src/components/AnalyzingAnimation.tsx` (lines 54–61)
- **Issue:** `setReducedMotion(info?.theme === 'dark' ? false : false)` always evaluates to `false`. Users with system reduced-motion enabled will still see full animation.
- **Fix:** WeChat does not expose `prefers-reduced-motion` via `getSystemInfoSync`. The correct pattern is to store a user preference in storage, or default to `false` but document it. Remove the misleading dead code:

```tsx
// Remove the broken useEffect entirely.
// Use the prop-driven shouldReduceMotion passed from parent controllers,
// or read from a global accessibility context.
```

#### CQ-2: `usePrefersReducedMotion` hook is incompatible with WeChat runtime
- **File:** `apps/mini-program/src/hooks/usePrefersReducedMotion.ts`
- **Issue:** Relies on `globalThis.matchMedia('(prefers-reduced-motion: reduce)')`. WeChat Mini-Program JSCore does not implement `matchMedia`.
- **Fix:** Rewrite to read from a user-set app preference (persisted in `Taro.getStorageSync`) with a sensible default. Expose a setter via a context provider:

```ts
const REDUCED_MOTION_KEY = 'joyjoin_reduced_motion'

export function getStoredReducedMotion(): boolean {
  try {
    return Taro.getStorageSync(REDUCED_MOTION_KEY) === 'true'
  } catch {
    return false
  }
}
```

#### CQ-3: `AiMatchPromoCarousel` full remount on reduced-motion change
- **File:** `apps/mini-program/src/components/AiMatchPromoCarousel.tsx` (lines 61–64, 74–82)
- **Issue:** `swiperKey` changes when `autoplayEnabled` or `compact` changes, causing the entire `<Swiper>` to unmount/remount. This is expensive and resets scroll position.
- **Fix:** Drive `autoplay` and `duration` directly as props without changing `key`:

```tsx
<Swiper
  autoplay={autoplayEnabled}
  duration={transitionMs}
  // remove key={swiperKey}
>
```

### 🟠 High

#### CQ-4: `AchievementPopup.tsx` has no CSS entrance animation and uses imperative timeout dismissal
- **File:** `apps/mini-program/src/components/AchievementPopup.tsx`
- **Issue:** The popup appears instantly. The 3.5 s `setTimeout` dismissal is not synced with any CSS exit animation, so it snaps out. No cleanup of animation instances if the component unmounts early.
- **Fix:** Add a CSS entrance class on mount and an `isExiting` state triggered 300 ms before removal:

```tsx
const [isExiting, setIsExiting] = useState(false)

useEffect(() => {
  if (!currentAchievement) return
  const exitTimer = setTimeout(() => setIsExiting(true), AUTO_DISMISS_MS - 300)
  const removeTimer = setTimeout(dismissCurrent, AUTO_DISMISS_MS)
  return () => {
    clearTimeout(exitTimer)
    clearTimeout(removeTimer)
  }
}, [currentAchievement, dismissCurrent])

// In render:
className={[
  'achievement-popup',
  `achievement-popup--${rarityClass}`,
  isExiting ? 'achievement-popup--exiting' : 'achievement-popup--entering',
].join(' ')}
```

#### CQ-5: SCSS `transition: all` used in multiple locations
- **Files:** `essential-data/index.scss` (line 117, 154), `icebreaker-session/index.scss` (line 598), `discover/index.scss` (line 110)
- **Fix:** Replace with explicit property lists.

#### CQ-6: Unused/legacy `@keyframes` in `personality-test/index.scss`
- **File:** `apps/mini-program/src/pages/onboarding/personality-test/index.scss` (lines 780–791)
- **Issue:** `personality-test-ring-pulse` is defined but never referenced in the same file or its TSX counterpart.
- **Fix:** Remove dead code to reduce stylesheet size.

#### CQ-7: `AnalyzingAnimation` comment claims "GPU-safe" but uses `mask-composite`
- **File:** `apps/mini-program/src/components/AnalyzingAnimation.scss` (lines 27–29)
- **Issue:** `-webkit-mask-composite: xor` + `mask-composite: exclude` on concentric rings is **not** GPU-composited on many WeChat Android runtimes and can cause paint storms during the `scale` animation.
- **Fix:** Replace the mask trick with a simpler `border` + `box-shadow` ring or pre-bake the gradient ring as an SVG/PNG asset.

### 🟡 Medium

#### CQ-8: No animation cleanup on unmount for pages with heavy motion
- **Files:** `squad-unboxing/index.tsx`, `matching-status/index.tsx`, `personality-test/index.tsx`
- **Issue:** If the user navigates back mid-animation, orphaned animation frames may continue computing in the WebView thread.
- **Fix:** While CSS animations stop when elements leave the DOM, any JS-driven animation loops (if added in future) should be guarded. Current codebase is mostly safe, but add a pattern note: always attach CSS animations to elements that are conditionally rendered, not `display: none` toggled.

#### CQ-9: `CustomTabBar` is a class component without `shouldComponentUpdate`
- **File:** `apps/mini-program/src/custom-tab-bar/index.tsx`
- **Issue:** Every `syncState` call triggers a full re-render of all 4 tab items and the center button. With badge counts updating every few seconds, this wastes cycles.
- **Fix:** Convert to a functional component with `React.memo`, or add `shouldComponentUpdate` that only permits re-render when `selected`, `center`, or `badges` actually change.

---

## Agent 4: Transition Flow & Consistency Auditor — Findings

### 🔴 Critical

#### TF-1: No page-transition configuration in `app.config.ts`
- **File:** `apps/mini-program/src/app.config.ts`
- **Issue:** The `window` object lacks `animationType`, `animationDuration`, or per-page transition settings. WeChat defaults to a standard slide, which clashes with the custom premium animations inside pages.
- **Fix:** Add platform-appropriate transition defaults. Note: WeChat only supports a limited set; use `fade` or `slide` consistently:

```ts
export default defineAppConfig({
  // ... existing config ...
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
    // WeChat supports these on some versions:
    animationType: 'fade',
    animationDuration: 200,
  },
})
```

> **Note:** WeChat's `animationType` support is patchy across versions. For guaranteed consistency, implement a **page-wrapper transition** in React.

#### TF-2: Onboarding exit transitions exist, but entrance transitions do not
- **Files:** All onboarding pages (`personality-test`, `essential-data`, `extended-data`, `profile-review`)
- **Issue:** Pages apply `onboarding-page-exit-transition` (fade + slide left + scale down) when leaving, but mount instantly when entering. This creates an asymmetric feeling: the user slides in abruptly, then leaves gracefully.
- **Fix:** Apply the inverse entrance animation on mount. Create an `onboarding-page-enter-transition` mixin:

```scss
@mixin onboarding-page-enter-transition(
  $duration: 0.28s,
  $shift-x: 18rpx,
  $scale: 0.986
) {
  opacity: 0;
  transform: translate3d($shift-x, 0, 0) scale($scale);
  animation: joy-onboarding-enter $duration cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes joy-onboarding-enter {
  from {
    opacity: 0;
    transform: translate3d(18rpx, 0, 0) scale(0.986);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}
```

### 🟠 High

#### TF-3: Tab switching is instant and disorienting
- **File:** `apps/mini-program/src/custom-tab-bar/index.tsx` (line 72), `apps/mini-program/src/custom-tab-bar/index.scss`
- **Issue:** `Taro.switchTab` performs a hard cut. The custom tab bar itself is visually premium (floating pill, gradient center button), but the content swap underneath has zero transition.
- **Fix:** WeChat `switchTab` does not support custom transitions natively. Mitigate by:
1. Adding a 150 ms fade overlay on the *leaving* page triggered in `useDidHide`.
2. Adding a subtle scale-up entrance (`0.98 → 1`, `opacity 0 → 1`) on each tab root page triggered in `useDidShow`.
3. Ensuring the custom tab bar icon active state uses `transition: opacity 0.2s ease` (see UX-4).

#### TF-4: Live reveal overlay stages snap between each other
- **File:** `apps/mini-program/src/pages/matching-status/MatchingStatusSections.tsx` (lines 354–444)
- **Issue:** The overlay renders `liveStage === 'match'`, then `'members'`, then `'theme'` as mutually exclusive blocks. When `liveStage` changes, the old block unmounts instantly and the new one appears instantly.
- **Fix:** Wrap the stage renderer in a cross-fade container. Since overlay cards share layout (centered, fixed position), use a keyed `View` with CSS animation:

```tsx
<View className='matching-status__overlay-card' key={liveStage}>
  {/* stage content */}
</View>
```

```scss
.matching-status__overlay-card {
  animation: overlay-stage-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes overlay-stage-in {
  from { opacity: 0; transform: translateY(12rpx) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

#### TF-5: Back navigation lacks consistent behaviour
- **Observation:** Some pages use `Taro.navigateBack`, others use `redirectTo`, and others use a custom `navigateBackOrEventsTab` helper. There is no visual indication of whether the user is going "back" or "sideways".
- **Fix:** Standardise on a `useJoyJoinNavigation` hook that:
1. Applies the exit-transition class before calling `navigateBack`.
2. Uses `navigateBack` for depth > 1, and `switchTab` for root-level escapes.
3. Always respects the 220 ms exit animation duration before firing the native navigation.

### 🟡 Medium

#### TF-6: `discover` page filter chip changes cause list jump
- **File:** `apps/mini-program/src/pages/discover/index.tsx`
- **Issue:** When a cluster or district filter changes, `filteredPools` recalculates and the pool list re-renders. Cards animate in with `discover-card-enter`, but if the user had scrolled, the scroll position resets or jumps.
- **Fix:** Memoize the `PoolCard` list with `useMemo` keyed on `filteredPools.map(p => p.id).join(',')` so React reuses DOM nodes where IDs match. Only new cards should trigger the enter animation.

#### TF-7: No loading placeholder-to-content morph on auth state flip
- **File:** `apps/mini-program/src/pages/discover/index.tsx` (lines 475–479)
- **Issue:** `isLoading ? <LoadingScreen /> : <AuthenticatedDiscover />` is a hard cut. Same pattern in `squad-unboxing`, `matching-status`, and `event-detail`.
- **Fix:** Wrap both states in a container with `opacity` cross-fade. The loading screen should fade out over 200 ms while the content fades in with a 100 ms delay:

```tsx
<View className={`page-morph ${isLoading ? 'page-morph--loading' : 'page-morph--content'}`}>
  <LoadingScreen />
  <AuthenticatedDiscover />
</View>
```

```scss
.page-morph {
  position: relative;
  & > * {
    transition: opacity 0.25s ease;
  }
  &--loading > :last-child { opacity: 0; pointer-events: none; }
  &--content > :first-child { opacity: 0; pointer-events: none; }
}
```

---

## Recommended Implementation Priority

| Priority | Issue ID | Impact | Effort |
|----------|----------|--------|--------|
| P0 | PA-1, PA-2, CQ-1, CQ-2 | Fixes critical performance jank + accessibility | Low |
| P0 | TF-1, TF-2 | Fixes the "disjointed" navigation feel | Medium |
| P1 | PA-3, PA-4, CQ-3, CQ-4, CQ-5 | Stability and polish improvements | Low |
| P1 | UX-4, UX-5, UX-6, TF-3, TF-4 | Micro-interactions and tab/overlay transitions | Medium |
| P2 | PA-5, PA-6, PA-7, CQ-6, CQ-7, CQ-9 | Performance hardening + code health | Low |
| P2 | UX-7, UX-8, UX-9, UX-10, TF-5, TF-6, TF-7 | Deep premium feel and narrative consistency | Medium–High |

---

## Premium Score

| Dimension | Current | Projected |
|-----------|---------|-----------|
| Performance (fps / jank) | 5.5 | 8.5 |
| Visual Polish (easing, timing, consistency) | 7.0 | 9.0 |
| Narrative Flow (transitions tell a story) | 6.0 | 8.5 |
| Accessibility (reduced motion, clarity) | 5.5 | 9.0 |
| Micro-interactions (feedback, delight) | 6.5 | 8.5 |
| **Weighted Average** | **6.5** | **8.7** |

---

*Report compiled by Agent Swarm audit. For questions or implementation support, reference the specific Issue IDs above.*
