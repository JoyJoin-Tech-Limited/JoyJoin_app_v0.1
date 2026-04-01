# UI/UX Improvements: Matching & Reveal Flow

> **Updated 2026-04-01** — expanded to document the full matching-state UI architecture including `MatchingStateLayout`, `MatchingWaitingScreen`, and the remaining matching-state screen family (PRs #387–#391).

## Overview
This document covers the polished matching-state UX and reveal experience for the JoyJoin pool matching flow, including the shared layout abstraction, the premium waiting screen, and the post-match ArchetypeOrbit reveal.

---

## Part 1 — Matching-State Architecture (PRs #387–#391)

### Shared Layout: `MatchingStateLayout`
**File**: `apps/user-client/src/components/matching/MatchingStateLayout.tsx`

All **full-screen** matching-status pages use this shared layout shell. It provides:
- The canonical dark background (`apps/user-client/src/assets/matching/shared/matching-bg.svg`)
- A readability scrim overlay
- Safe-area-aware header (optional back button + title)
- Composition slots: `hero`, `copy`, `cta`, `footer`

**New full-screen matching-status pages must extend `MatchingStateLayout`** — do not recreate the dark background or reimplement the layout shell for each screen-level page.

### `MatchingWaitingScreen` — Premium Blind-Pool Waiting UI
**File**: `apps/user-client/src/components/MatchingWaitingScreen.tsx`

A dark-mode premium waiting screen rendered via `MatchingStateLayout`. Supports three fill states:
- `waiting` — pool has fewer than `minGroupSize` confirmed seats
- `can_form` — pool has enough to form a group, final confirmation pending
- `full` — pool is at capacity, matching imminent

Props: `poolTitle`, `filledCount`, `minGroupSize` (default 4), `maxGroupSize` (default 6), `onRefresh`, `onWithdraw`, and optional `refreshIntervalSeconds`.

### Full-Screen Matching-State Screens

| Component | State | Location |
|-----------|-------|----------|
| `MatchingWaitingScreen` | Blind-pool waiting | `components/MatchingWaitingScreen.tsx` |
| `NoMatchScreen` | No match found | `components/matching/NoMatchScreen.tsx` |

### Join-Sheet Interstitial Screens

These components are used inside `JoinEventPoolSheet.tsx`. They reuse the same canonical background asset directly, but they are **not** full-screen pages and do not wrap themselves in `MatchingStateLayout`.

| Component | State | Location |
|-----------|-------|----------|
| `JoinErrorScreen` | Registration/join error | `components/matching/JoinErrorScreen.tsx` |
| `ExtendedDataEmptyScreen` | Insufficient profile data | `components/matching/ExtendedDataEmptyScreen.tsx` |
| `TestIncompleteScreen` | Personality test not done | `components/matching/TestIncompleteScreen.tsx` |

### Post-Match Reveal Components

These are part of the reveal / celebration experience, not `MatchingStateLayout` page shells:

| Component | Role | Location |
|-----------|------|----------|
| `SurpriseMatchReveal` | Cinematic match reveal overlay | `components/matching/SurpriseMatchReveal.tsx` |
| `MatchPointsDisplay` | Match points renderer used inside reveal/details surfaces | `components/matching/MatchPointsDisplay.tsx` |

### Trigger-Based State Wiring

`MatchingStatusPage.tsx` maps real app state (event status, pool fill count, WebSocket events) to the appropriate screen component. No placeholder timers or mocked transitions. Recovery / re-entry must be correct — a user who returns to the page after a refresh should land in the right state.

### Asset Organisation

```
apps/user-client/src/assets/matching/
├── shared/matching-bg.svg       ← canonical; imported by MatchingStateLayout
├── waiting/matching-waiting-hero.svg
├── no-match/no-match-hero.svg
├── join-error/join-error-hero.svg
└── extended-data-empty/extended-data-empty-hero.svg
```

---

## Part 2 — Post-Match Reveal (ArchetypeOrbit)

## Changes Made

### 1. New Component: ArchetypeOrbit
**File**: `apps/user-client/src/components/ArchetypeOrbit.tsx`

A reusable component that displays the JoyJoin logo at the center with orbiting archetype PNG images.

**Features**:
- **Logo wake-up animation**: Smooth scale and fade-in effect
- **Staggered fly-in**: Archetype images appear with 0.1s delays
- **Three sizes**: small (h-40), medium (h-56), large (h-72)
- **Configurable animation**: Can be static or animated
- **Graceful fallback**: Handles unknown archetype names
- **Asset mapping**: Maps 12 archetype names to their transparent PNG assets

**Archetype Assets Mapped**:
- 开心柯基 → `开心柯基_transparent_1.png`
- 机智狐 → `机智狐_transparent_2.png`
- 暖心熊 → `暖心熊_transparent_3.png`
- 织网蛛 → `织网蛛_transparent_4.png`
- 夸夸豚 → `夸夸豚_transparent_5.png`
- 太阳鸡 → `太阳鸡_transparent_6.png`
- 淡定海豚 → `淡定海豚_transparent_7.png`
- 沉思猫头鹰 → `沉思猫头鹰_transparent_8.png`
- 稳如龟 → `稳如龟_transparent_9.png`
- 隐身猫 → `隐身猫_transparent_10.png`
- 定心大象 → `定心大象_transparent_11.png`
- 灵感章鱼 → `灵感章鱼_transparent_12.png`

**Usage**:
```tsx
<ArchetypeOrbit
  archetypes={["开心柯基", "机智狐", "暖心熊", "织网蛛"]}
  size="medium"
  animated={true}
  onAnimationComplete={() => console.log("Done!")}
/>
```

### 2. Updated MatchingStatusPage
**File**: `apps/user-client/src/pages/MatchingStatusPage.tsx`

**Key Changes**:
1. **Group members fetching**: On POOL_MATCHED event, fetches member details from `/api/pool-groups/:groupId` before starting reveal
2. **Reveal animation overlay**: Full-screen overlay with animated ArchetypeOrbit and member archetypes
3. **Animation sequence**:
   - Progress bar reaches 100%
   - 1 second transition delay
   - Reveal overlay appears with ArchetypeOrbit animation
   - Logo wake-up (0.5s)
   - Archetype PNGs fly in with stagger (0.6s + delays)
   - User can click to continue
   - Transitions to MatchCelebrationOverlay
4. **Post-match UI**: After match, shows ArchetypeOrbit in the main card (static)
5. **Enhanced CTAs**:
   - Primary: "查看小组详情" (View group details)
   - Secondary: "准备破冰话题 💬" (Prepare icebreaker topics) - shown when venue unlocked
6. **Safe-area padding**: Added `safe-area-bottom` class for mobile devices

**Animation Flow**:
```
POOL_MATCHED event received
  ↓
Fetch /api/pool-groups/:groupId (wait for response)
  ↓
1 second visual transition (progress → 100%)
  ↓
Reveal overlay appears with animated ArchetypeOrbit
  ↓
User clicks anywhere
  ↓
MatchCelebrationOverlay (existing)
  ↓
Navigate to PoolGroupDetailPage
```

### 3. Updated PoolGroupDetailPage
**File**: `apps/user-client/src/pages/PoolGroupDetailPage.tsx`

**Key Changes**:
1. **Reveal section**: Added ArchetypeOrbit at top with all group member archetypes
2. **Simplified layout**:
   - Badge with group number (#{groupNumber}组)
   - ArchetypeOrbit with member archetypes (medium size, static)
   - Event title and date/time
   - Match score badge (if available)
3. **Card-stack aesthetic**: Maintains clean, focused design with archetype orbit as hero element
4. **"Reveal already happened" posture**: Static (non-animated) ArchetypeOrbit to show group is already formed
5. **Safe-area padding**: Added `safe-area-bottom` class
6. **Bottom nav gradient**: Added gradient overlay above BottomNav for smooth visual transition

**Before vs After**:
- **Before**: Simple list of members with basic info
- **After**: Hero section with archetype orbit, followed by streamlined member cards

### 4. CSS Enhancements
**File**: `apps/user-client/src/index.css`

**Added**:
```css
/* Bottom nav gradient transition */
.bottom-nav-gradient {
  background: linear-gradient(to top, hsl(var(--background)), transparent);
}
```

**Existing safe-area classes** (already present):
- `.safe-area-pb` - Bottom padding with safe-area-inset
- `.safe-area-bottom` - Generic safe-area bottom padding
- `.safe-area-bottom-with-padding` - Safe-area with additional 1rem padding

### 5. Bottom Nav Integration
**File**: `apps/user-client/src/components/BottomNav.tsx` (no changes needed)

Both pages now properly integrate with BottomNav:
- Pages use `safe-area-bottom` class for proper spacing
- PoolGroupDetailPage has gradient overlay above nav (20px height, z-40)
- Content doesn't visually clash with fixed nav bar

## Testing

### Manual Testing Steps

1. **Test ArchetypeOrbit component**:
   - Navigate to `/test/archetype-orbit` (requires login)
   - Verify logo wake-up animation
   - Verify staggered archetype fly-in
   - Test different sizes (small, medium, large)
   - Test with 4-6 archetypes

2. **Test MatchingStatusPage reveal**:
   - Register for an event pool
   - Wait for POOL_MATCHED websocket event
   - Verify progress bar reaches 100%
   - Verify 1-second transition delay
   - Verify reveal overlay appears with animated orbit
   - Click anywhere to continue
   - Verify transition to MatchCelebrationOverlay

3. **Test PoolGroupDetailPage**:
   - Navigate to a matched pool group
   - Verify ArchetypeOrbit displays all member archetypes
   - Verify static (non-animated) orbit
   - Verify clean card-stack layout
   - Verify gradient transition above BottomNav
   - Verify safe-area padding on mobile

### Key User Flows

**Flow 1: New Match (Happy Path)**
```
User waits in MatchingStatusPage
  ↓
POOL_MATCHED event received
  ↓
Fetch member data from /api/pool-groups/:groupId
  ↓
Progress bar animates to 100%
  ↓
1 second delay
  ↓
Reveal overlay with animated ArchetypeOrbit
  ↓
User clicks
  ↓
MatchCelebrationOverlay
  ↓
Navigate to PoolGroupDetailPage
  ↓
See static ArchetypeOrbit with all members
```

**Flow 2: View Existing Group**
```
User navigates to PoolGroupDetailPage
  ↓
See ArchetypeOrbit with all member archetypes (static)
  ↓
Scroll to see member cards and event details
  ↓
No animation (reveal already happened)
```

## Assets Used

### JoyJoin Logo
- `JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png` (center element)

### Archetype PNGs (all 12 transparent variants)
- All assets located in `apps/user-client/src/assets/`
- Naming pattern: `{archetype}_transparent_{number}.png`
- File sizes: ~120KB - 300KB each
- Format: PNG with transparency

## API Integration

### Endpoint Used
**GET** `/api/pool-groups/:groupId`

**Returns**:
```typescript
{
  group: {
    id: string;
    groupNumber: number;
    memberCount: number;
    matchScore: number | null;
    matchExplanation: string | null;
    venueName: string | null;
    venueAddress: string | null;
    finalDateTime: string | null;
    status: string;
  };
  pool: {
    id: string;
    title: string;
    description: string | null;
    eventType: string;
    city: string;
    district: string | null;
    dateTime: string;
  };
  members: AttendeeData[];
}
```

**Used for**:
- Fetching member archetypes after POOL_MATCHED event
- Populating ArchetypeOrbit with group member archetypes

## Performance Considerations

1. **Asset loading**: All 12 archetype PNGs are imported at build time (~2-3MB total). Future optimization: conditional loading of only used archetypes.
2. **Animation performance**: CSS animations with `transform` and `opacity` for 60fps
3. **WebSocket handling**: Fetches group data only after POOL_MATCHED event
4. **Loading states**: Shows loading indicator while fetching group data
5. **Memory**: All archetype assets are bundled; selective tree-shaking is a potential future optimization

## Accessibility

- All images have `alt` attributes with archetype names
- Click/tap targets meet minimum size requirements (44x44px)
- Safe-area padding ensures content is visible on all devices
- Animations are always enabled in the current implementation; integration with user's motion preferences (e.g. CSS `@media (prefers-reduced-motion)`) is planned as a future improvement

## Mobile Optimization

- **Safe-area support**: All pages respect iOS notch and Android navigation bars
- **Touch targets**: Minimum 44x44px touch targets
- **Gradient transition**: Smooth visual blend into BottomNav
- **Responsive sizing**: ArchetypeOrbit scales appropriately on small screens
- **Portrait-first**: Layout optimized for mobile portrait orientation

## Future Enhancements

1. **Haptic feedback**: Add vibration on reveal animation start
2. **Sound effects**: Optional sound for logo wake-up and fly-in
3. **Confetti**: Add confetti effect on reveal (optional)
4. **Skip animation**: Add "Skip" button for impatient users
5. **Archetype details**: Tap on archetype to see brief description
6. **Group photo**: Add optional group photo in PoolGroupDetailPage

## Known Issues

None at this time.

## Breaking Changes

None. All changes are additive.

## Migration Guide

No migration needed. Existing functionality is preserved.
