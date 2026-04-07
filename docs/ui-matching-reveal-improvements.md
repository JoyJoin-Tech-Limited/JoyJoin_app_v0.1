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

### Join-Sheet / Pre-Entry Interstitial Screens

These components are used either inside `JoinEventPoolSheet.tsx` or as a pre-entry gate on `DiscoverPage`. They reuse the same canonical background asset directly when needed, but they are **not** full-screen pages and do not wrap themselves in `MatchingStateLayout`.

| Component | State | Location |
|-----------|-------|----------|
| `JoinErrorScreen` | Registration/join error | `components/matching/JoinErrorScreen.tsx` |
| `ExtendedDataEmptyScreen` | Insufficient profile data | `components/matching/ExtendedDataEmptyScreen.tsx` |
| `TestIncompleteScreen` | Personality test incomplete pre-entry gate on `DiscoverPage` | `components/matching/TestIncompleteScreen.tsx` |

### Post-Match Reveal Components

These are part of the reveal / celebration experience, not `MatchingStateLayout` page shells:

| Component | Role | Location |
|-----------|------|----------|
| `MatchRevealSequenceV2` | **V2 cinematic, member-first reveal orchestrator** (active) | `components/matching/MatchRevealSequenceV2.tsx` |
| `SurpriseMatchReveal` | Legacy rarity-first reveal overlay (superseded by V2) | `components/matching/SurpriseMatchReveal.tsx` |
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

## Part 2 — Post-Match Reveal V2 (MatchRevealSequenceV2)

> **Updated 2026-04-07** — Part 2 now documents the V2 reveal system. The original ArchetypeOrbit-only reveal is preserved (ArchetypeOrbit.tsx remains) but is now composed inside the V2 orchestrator rather than called directly from the page.

### V2 Reveal Flow

The V2 reveal centers the hero moment on **members and chemistry** rather than a rarity card. It runs a staged sequence:

```
lock_in  →  prelude  →  member_entrance  →  formation  →  chemistry  →  celebration
```

| Stage | Description | Duration |
|-------|-------------|----------|
| `lock_in` | Match progress completion beat | 900 ms |
| `prelude` | JoyJoin-branded logo/sparkle moment with Xiaoyue copy | 1 200 ms |
| `member_entrance` | Staggered archetype fly-in via `ArchetypeOrbit` (animated) | ~2 300 ms |
| `formation` | Group formation hero tableau (static orbit, group count) | 1 500 ms |
| `chemistry` | Personalised chemistry payoff card — user must tap CTA | User-driven |
| `celebration` | Fires `onComplete` → hands off to `MatchCelebrationOverlay` | Instant |

When `prefers-reduced-motion` is active the sequence collapses: `lock_in` runs for 100 ms then jumps directly to `chemistry`, skipping all animated stages.

### New Files

| File | Purpose |
|------|---------|
| `apps/user-client/src/components/matching/MatchRevealSequenceV2.tsx` | V2 reveal orchestrator |
| `apps/user-client/src/lib/chemistryPayoff.ts` | Deterministic chemistry copy generator |
| `apps/user-client/src/lib/revealHaptics.ts` | Staged haptic helpers with no-op fallback |
| `apps/user-client/src/lib/__tests__/chemistryPayoff.test.ts` | Unit tests (21) for payoff helper |

### Chemistry Payoff Helper (`chemistryPayoff.ts`)

Generates a `{ headline, chemistryLine, tags }` object deterministically from available client-side group data.

Priority order:
1. **Shared interests** (≥ 2 members share an interest key) → interest-based line with Chinese labels
2. **Archetype energies** (mapped to short energy words) → "活力 × 探索 × 温暖" style label
3. **Editorial fallback** → warm, generic but not robotic copy

```typescript
const payoff = generateChemistryPayoff(members, currentUser);
// { headline: "小悦凑齐了这一桌有趣的灵魂", chemistryLine: "你们都爱旅行和音乐…", tags: ["旅行","音乐"] }
```

### Haptics Helper (`revealHaptics.ts`)

Four restrained patterns — all no-ops when `navigator.vibrate` is unavailable:

| Function | Pattern | Stage |
|----------|---------|-------|
| `hapticTick()` | 10 ms | Prelude / member arrival |
| `hapticPulse()` | 25 ms | Stage transition |
| `hapticDoublePulse()` | 30/60/30 ms | Group formation |
| `hapticCelebrate()` | 40/80/40/80/80 ms | Chemistry CTA / celebration |

### Updated Components

**`MatchCelebrationOverlay.tsx`**
Now accepts `chemistryLine?: string` and `groupSize?: number`. When `chemistryLine` is provided (forwarded from the V2 reveal) it replaces the random Xiaoyue message with the same personalised line, making the celebration feel like a continuation of the reveal rather than a reset.

**`MatchingStatusPage.tsx`**
- Replaced `MatchSuccessSheet` render with `MatchRevealSequenceV2` (both the pending-state overlay and the matched-state overlay).
- Added `revealChemistryLine` state to forward the generated chemistry line to `MatchCelebrationOverlay`.
- All existing websocket trigger logic, group fetch flow, fallback behavior, and navigation remain unchanged.

### ArchetypeOrbit (still used, unchanged)

`ArchetypeOrbit.tsx` is reused inside `MatchRevealSequenceV2` for both the `member_entrance` (animated) and `formation` (static) stages. It continues to power the static orbit in `PoolGroupDetailPage` as before.

### Fallback Behavior (preserved)

When group data fetch fails, `MatchingStatusPage` still falls back directly to `MatchCelebrationOverlay` (no V2 reveal). This path is identical to the pre-V2 behavior.

## Testing

### Unit Tests

Run with:
```bash
cd apps/user-client && npx vitest run src/lib/__tests__/chemistryPayoff.test.ts
```

21 tests cover: `pickHeadline`, `findCommonInterests`, `buildArchetypeChemistryLabel`, and `generateChemistryPayoff` (happy path, reduced-motion fallback, groups of 3–6, no data fallback, determinism).

### Manual Testing Steps

1. **Happy path reveal (V2)**:
   - Wait for `POOL_MATCHED` websocket event while on `MatchingStatusPage`
   - Verify staged sequence: lock_in → prelude (sparkle) → member archetype fly-in → formation hero → chemistry payoff card
   - Verify chemistry card shows a headline, a warm personalised line, and optional tags
   - Tap "开始认识伙伴" CTA to proceed
   - Verify `MatchCelebrationOverlay` shows the same chemistry line (continued narrative)
   - Navigate to `PoolGroupDetailPage`

2. **Reduced-motion mode**:
   - Enable "Reduce Motion" in OS accessibility settings (or DevTools)
   - Trigger a match reveal
   - Verify the sequence collapses: only `lock_in` beat → chemistry payoff card; no animated stages
   - Verify all content (headline, chemistry line, CTA) is still visible and readable

3. **Group fetch failure fallback**:
   - Simulate a failing `/api/pool-groups/:groupId` fetch (network tab block or 500 response)
   - Verify no V2 reveal appears
   - Verify `MatchCelebrationOverlay` appears directly (fallback path unchanged)

4. **Groups of different sizes (3–6 members)**:
   - Trigger match reveals for groups with 3, 4, 5, and 6 members
   - Verify ArchetypeOrbit renders all archetypes
   - Verify chemistry payoff text adapts appropriately

5. **No vibration support**:
   - Test on a browser/device where `navigator.vibrate` is undefined
   - Verify no JS errors; reveal proceeds normally

6. **Re-entry / refresh correctness**:
   - Navigate away and return to a matched `MatchingStatusPage`
   - Verify no spurious V2 reveal appears (trigger is websocket-only, not re-entry)
   - Verify static `ArchetypeOrbit` shows in the main card

### Key User Flows

**Flow 1: New Match V2 (Happy Path)**
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
MatchRevealSequenceV2: lock_in → prelude → member_entrance → formation → chemistry
  ↓
User taps CTA
  ↓
MatchCelebrationOverlay (with forwarded chemistryLine)
  ↓
Navigate to PoolGroupDetailPage
  ↓
See static ArchetypeOrbit with all members
```

**Flow 2: Fallback (Group Fetch Fails)**
```
POOL_MATCHED event → group fetch fails
  ↓
No V2 reveal
  ↓
MatchCelebrationOverlay (direct, generic Xiaoyue message)
  ↓
Navigate to PoolGroupDetailPage
```

**Flow 3: View Existing Group**
```
User navigates to PoolGroupDetailPage
  ↓
See static ArchetypeOrbit with all member archetypes
  ↓
Scroll to see member cards and event details
  ↓
No V2 animation (reveal already happened)
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
- **V2: `prefers-reduced-motion` is fully supported** — when active, the reveal collapses to a single chemistry payoff card with no animated stages
- All animated stages use only `transform` and `opacity` — no layout-triggering properties

## Mobile Optimization

- **Safe-area support**: All pages respect iOS notch and Android navigation bars
- **Touch targets**: Minimum 44x44px touch targets
- **Gradient transition**: Smooth visual blend into BottomNav
- **Responsive sizing**: ArchetypeOrbit scales appropriately on small screens
- **Portrait-first**: Layout optimized for mobile portrait orientation
- **V2 haptics**: Stage-based vibration patterns (10–150 ms total); no-op on unsupported devices

## Future Enhancements

1. **Sound effects**: Optional ambient sound for logo wake-up and formation beat
2. **Skip animation**: Add "Skip" button for users who have already seen the reveal
3. **Archetype details**: Tap on orbiting archetype to see brief description
4. **Share card**: Screenshot-worthy match card CTA at chemistry payoff stage
5. **Group photo**: Optional group photo in PoolGroupDetailPage

## Known Issues

None at this time.

## Breaking Changes

None. All changes are additive.

## Migration Guide

No migration needed. Existing functionality is preserved.
