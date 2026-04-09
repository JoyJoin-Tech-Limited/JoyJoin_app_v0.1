# Matching & Reveal Flow Implementation Summary

> **Updated 2026-04-01** to reflect the shared `MatchingStateLayout` abstraction (PRs #387–#391) and the full matching-state screen family.

## Overview
This document summarises the implementation of the archetype-based reveal experience and the wider matching-state screen family for the JoyJoin pool matching flow.

---

## Matching-State Architecture (PRs #387–#391)

> **Updated 2026-04-07** — `TestIncompleteScreen` now belongs to the Discover-page pre-entry interception path. `ExtendedDataEmptyScreen` remains sheet-owned, and `MatchRevealSequenceV2` is still the canonical reveal orchestrator.

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

### Join-Sheet / Pre-Entry Interstitial Screens

These are shown either inside `JoinEventPoolSheet.tsx` or as a pre-entry gate on `DiscoverPage`, not as standalone full-screen pages:

| Component | State | Asset |
|-----------|-------|-------|
| `JoinErrorScreen` | Registration / join error | `matching/join-error/join-error-hero.svg` |
| `ExtendedDataEmptyScreen` | Optional extended-profile nudge shown inside `JoinEventPoolSheet` | `matching/extended-data-empty/extended-data-empty-hero.svg` |
| `TestIncompleteScreen` | Personality test incomplete pre-entry gate on `DiscoverPage` before the join sheet opens | `matching/test-incomplete/…` |

### Post-Match Reveal Components

| Component | Role | Asset |
|-----------|------|-------|
| `MatchRevealSequenceV2` | **V2 cinematic reveal orchestrator** (active) — stages: lock_in → prelude → member_entrance → formation → chemistry → celebration | (inline, Framer Motion + ArchetypeOrbit) |
| `SurpriseMatchReveal` | Legacy rarity-first reveal overlay (superseded by V2, preserved) | (inline animation) |
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

## Post-Match Reveal Flow V2 (MatchRevealSequenceV2)

> **Updated 2026-04-07** — V2 replaces the direct `MatchSuccessSheet` call with a staged, member-first cinematic reveal. `ArchetypeOrbit` is composed inside the new orchestrator rather than called directly from the page.

### MatchRevealSequenceV2
**Location**: `apps/user-client/src/components/matching/MatchRevealSequenceV2.tsx`

Member-first staged reveal orchestrator. Sequence:

```
lock_in → prelude → member_entrance → formation → chemistry → celebration
```

- **lock_in**: Faint group icon, haptic pulse (900 ms)
- **prelude**: Sparkle icon + Xiaoyue copy, light haptic tick (1 200 ms)
- **member_entrance**: Animated `ArchetypeOrbit` flies in all archetypes (2 300 ms)
- **formation**: Static orbit hero shot + member count (1 500 ms) + double-pulse haptic
- **chemistry**: Personalised payoff card (user-driven CTA) — forwards chemistryLine to celebration
- **celebration**: Fires `onComplete` callback instantly; hapticCelebrate fires once

`prefers-reduced-motion`: the sequence jumps from `lock_in` directly to `chemistry` with no animated stages. All content is preserved.

### chemistryPayoff Helper
**Location**: `apps/user-client/src/lib/chemistryPayoff.ts`

Deterministic helper that generates `{ headline, chemistryLine, tags }` from member data:
1. Shared interests (≥ 2 members) → localised Chinese interest-based line
2. Archetype energies → "活力 × 探索" style label
3. Editorial fallback

21 unit tests in `src/lib/__tests__/chemistryPayoff.test.ts`.

### revealHaptics Helper
**Location**: `apps/user-client/src/lib/revealHaptics.ts`

4 restrained vibration functions (`hapticTick`, `hapticPulse`, `hapticDoublePulse`, `hapticCelebrate`). All no-ops when `navigator.vibrate` is unavailable.

### ArchetypeOrbit (unchanged, reused)
**Location**: `apps/user-client/src/components/ArchetypeOrbit.tsx`

Used inside `MatchRevealSequenceV2`:
- `member_entrance` stage: `animated={true}` with `onAnimationComplete` callback
- `formation` stage: `animated={false}` static hero tableau

Continues to power the static orbit in `PoolGroupDetailPage`.

## Pages Updated

### MatchingStatusPage
**V2 changes**:
1. Replaced `MatchSuccessSheet` with `MatchRevealSequenceV2` (both pending-state and matched-state overlays)
2. Added `revealChemistryLine` state — generated via `generateChemistryPayoff` in `handleRevealContinue` and forwarded to `MatchCelebrationOverlay`
3. `MatchCelebrationOverlay` now receives `chemistryLine` and `groupSize` props for a continued narrative

**Flow**:
```
POOL_MATCHED event → Fetch member data → Progress to 100%
  ↓ (1s delay)
MatchRevealSequenceV2 (lock_in → … → chemistry)
  ↓ (user taps CTA)
Hide reveal → Generate chemistryLine → Show MatchCelebrationOverlay → Navigate
```

**Preserved**:
- Websocket trigger and group fetch flow unchanged
- Fallback: if group fetch fails, `MatchCelebrationOverlay` fires directly
- Navigation to group detail, theme reveal follow-up, re-entry correctness all unchanged

### MatchCelebrationOverlay
**V2 changes**:
- New optional props: `chemistryLine?: string`, `groupSize?: number`
- When `chemistryLine` is provided, replaces random Xiaoyue message with the personalised line (continued reveal narrative)
- `groupSize` renders "{N} 位活动小伙伴已就位" instead of "活动小伙伴已就位"

### PoolGroupDetailPage
No changes in V2. Static `ArchetypeOrbit` hero remains as before.

## Documentation Updated

### Performance & Accessibility
- V2 reveal uses only `transform`/`opacity` animations — no layout-triggering properties
- `prefers-reduced-motion` fully implemented in V2 (was previously planned only)

## Status

✅ V2 reveal orchestrator implemented  
✅ Chemistry payoff helper with 21 unit tests  
✅ Staged haptics with graceful no-op  
✅ `prefers-reduced-motion` supported  
✅ Fallback behavior preserved  
✅ TypeScript type-checks pass (no new errors)  
✅ No breaking changes to existing websocket/state architecture
