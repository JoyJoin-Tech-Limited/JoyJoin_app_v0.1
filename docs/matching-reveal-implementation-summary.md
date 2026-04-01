# Matching & Reveal Flow Implementation Summary

> **Updated 2026-04-01** to reflect the shared `MatchingStateLayout` abstraction (PRs #387–#391) and the full matching-state screen family.

## Overview
This document summarises the implementation of the archetype-based reveal experience and the wider matching-state screen family for the JoyJoin pool matching flow.

---

## Matching-State Architecture (PRs #387–#391)

### Shared Layout Abstraction — `MatchingStateLayout`

**Location:** `apps/user-client/src/components/matching/MatchingStateLayout.tsx`

All full-screen matching-status pages share a single layout shell that provides:
- The canonical dark background (`apps/user-client/src/assets/matching/shared/matching-bg.svg`) with a readability scrim
- Safe-area-aware header with optional back button and title
- Centred content container exposing **hero / copy / CTA / footer** composition slots

```tsx
<MatchingStateLayout
  hero={<img src={heroSvg} />}
  copy={<HeadlineAndBadge />}
  cta={<PrimaryButton />}
  footer={<ReassuranceText />}
/>
```

**Guardrail:** New full-screen matching-status pages **must** extend `MatchingStateLayout` rather than reimplementing their own dark background or layout shell. Duplicating `matching-bg.svg` is explicitly discouraged.

### Full-Screen Matching-State Screen Family

| Component | State | Asset |
|-----------|-------|-------|
| `MatchingWaitingScreen` | Premium dark-mode blind-pool waiting (fill states: waiting / can_form / full) | `matching/waiting/matching-waiting-hero.svg` |
| `NoMatchScreen` | No match found for this pool round | `matching/no-match/no-match-hero.svg` |

### Join-Sheet Interstitial Screens

These are shown inside `JoinEventPoolSheet.tsx`, not as standalone full-screen pages:

| Component | State | Asset |
|-----------|-------|-------|
| `JoinErrorScreen` | Registration / join error | `matching/join-error/join-error-hero.svg` |
| `ExtendedDataEmptyScreen` | Profile data insufficient for matching | `matching/extended-data-empty/extended-data-empty-hero.svg` |
| `TestIncompleteScreen` | Personality test not completed | `matching/test-incomplete/…` |

### Post-Match Reveal Components

| Component | Role | Asset |
|-----------|------|-------|
| `SurpriseMatchReveal` | Cinematic surprise match reveal overlay | (inline animation) |
| `MatchPointsDisplay` | Match points and compatibility summary renderer | (inline) |

These screens live under `apps/user-client/src/components/matching/`, except `MatchingWaitingScreen`, which is at `apps/user-client/src/components/MatchingWaitingScreen.tsx`.

### Trigger-Based State Wiring

`MatchingStatusPage.tsx` maps **real app state** (registration status, event status, fill counts, WebSocket events) to the appropriate matching-state screen. No placeholder timers or mocked state transitions. Recovery / re-entry correctness is enforced — a user returning to the page after a forced refresh should land in the correct state.

### Asset Organisation (PR #390)

```
apps/user-client/src/assets/matching/
├── shared/                  ← single canonical background (used by MatchingStateLayout)
│   └── matching-bg.svg
├── waiting/
│   └── matching-waiting-hero.svg
├── no-match/
│   └── no-match-hero.svg
├── join-error/
│   └── join-error-hero.svg
├── extended-data-empty/
│   └── extended-data-empty-hero.svg
└── test-incomplete/
```

---

## Post-Match Reveal Flow (ArchetypeOrbit)

### ArchetypeOrbit Component
**Location**: `apps/user-client/src/components/ArchetypeOrbit.tsx`

Reusable component that renders:
- JoyJoin logo at center
- 4-6 orbiting archetype PNGs
- Configurable sizes (small/medium/large)
- Animated or static mode
- Maps 12 JoyJoin archetypes to transparent PNG assets

**Key Features**:
- Logo wake-up animation (0.5s)
- Staggered archetype fly-in (0.6s + 0.1s delays)
- Graceful fallback for unknown archetypes
- Only calls `onAnimationComplete` in animated mode
- Resets states when `animated` prop changes

## Pages Updated

### MatchingStatusPage
**Changes**:
1. Fetches group members from `/api/pool-groups/:groupId` after POOL_MATCHED event
2. Shows full-screen reveal overlay with animated ArchetypeOrbit
3. Separates animation completion from user interaction:
   - Animation completes → enables click
   - User clicks → dismisses overlay → shows celebration
4. Fallback handling if group data fetch fails
5. Added safe-area padding for mobile

**Flow**:
```
POOL_MATCHED event → Fetch member data → Progress to 100%
  ↓ (1s delay)
Reveal overlay with animated orbit
  ↓ (animation completes ~2.3s)
"点击任意位置继续" becomes active
  ↓ (user clicks)
Hide reveal → Show MatchCelebrationOverlay → Navigate
```

### PoolGroupDetailPage
**Changes**:
1. Added hero section with static ArchetypeOrbit
2. Shows all group member archetypes
3. Fixed matchScore check to handle 0 values (`!= null` instead of truthy)
4. Added gradient overlay above BottomNav
5. Added safe-area padding for mobile

## Test Page

### TestArchetypeOrbit
**Location**: `apps/user-client/src/pages/TestArchetypeOrbit.tsx`

- Route: `/test/archetype-orbit` (dev-only, gated by `NODE_ENV !== "production"`)
- Reveals overlay now gated behind button click
- Allows testing different sizes and animation modes

## Documentation Updated

### Performance & Accessibility
Updated `docs/ui-matching-reveal-improvements.md` to accurately reflect:
- All 12 archetype PNGs imported at build time (~2-3MB total)
- No current tree-shaking of unused archetypes
- Reduced-motion support planned as future improvement (not currently implemented)

## Bug Fixes

1. **Reveal overlay dismissal**: Now properly sets `showRevealAnimation` to false
2. **Fallback handling**: Added fallback path if group data fetch fails
3. **Animation state reset**: ArchetypeOrbit resets states when `animated` prop changes
4. **Static mode callback**: Removed `onAnimationComplete` call in static mode
5. **Match score display**: Fixed to show score of 0 (changed from truthy to null check)
6. **Dual triggers**: Separated animation completion from user interaction
7. **Test page overlay**: Gated behind button click to allow normal page interaction
8. **Production route**: Test route only available in non-production environments

## Key Improvements

- **Better UX**: Users can't skip animation, must wait for completion
- **Clearer feedback**: UI shows "正在加载..." until animation completes, then "点击任意位置继续"
- **More robust**: Handles fetch failures gracefully
- **More predictable**: Animation states reset properly on prop changes
- **Production-ready**: Test routes excluded from production builds

## Technical Details

**Assets Used**:
- JoyJoin logo: `JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png`
- 12 archetype PNGs: `{archetype}_transparent_{1-12}.png`

**API Integration**:
- Endpoint: `GET /api/pool-groups/:groupId`
- Called after: POOL_MATCHED websocket event
- Returns: Group info, pool info, and member data with archetypes

**CSS Utilities**:
- `.bottom-nav-gradient`: Gradient transition above BottomNav
- `.safe-area-bottom`: iOS notch/Android nav bar padding

## Status

✅ All feedback addressed
✅ TypeScript compilation successful
✅ No breaking changes
✅ Backward compatible
