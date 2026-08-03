# 契合点系统架构文档 (Connection Points System)

> **Status:** Implemented — last updated 2026-04-29  
> **Scope:** Unified architecture for server-side connection points and client-side spark predictions  
> **Related:** `docs/systems/MATCHING_ALGORITHM_REFERENCE.md`, `docs/systems/interest-signal-boost.md`

---

## 1. System Overview

The 契合点系统 is **two related subsystems** that share a brand name but serve different purposes:

```
┌─────────────────────────────────────────────────────────────┐
│                    契合点系统 (Connection Points)              │
├─────────────────────────────┬───────────────────────────────┤
│  Server: findConnectionPoints │  Client: SparkPrediction      │
│  (matchExplanationService)    │  (attendeeAnalytics)          │
├─────────────────────────────┼───────────────────────────────┤
│  • Plain string[]             │  • { text, rarity }[]         │
│  • Feeds AI prompt            │  • Drives visual energy ring  │
│  • No rarity scoring          │  • Quality tier + fill %      │
│  • Deterministic rules        │  • Client-side inference      │
└─────────────────────────────┴───────────────────────────────┘
```

**Design principle:** The server owns truth (what attributes two users actually share). The client owns presentation (how those shared attributes are visualized with rarity, color, and animation).

---

## 2. Server-Side: `findConnectionPoints`

**File:** `apps/server/src/matchExplanationService.ts` (lines 545–634)

### 2.1 What It Does

Generates plain-text connection points by comparing two user profiles. These strings are fed into the AI match-explanation prompt and returned in the `PairExplanation` API response.

### 2.2 Connection Point Types

| Type | Condition | Example Output |
|------|-----------|---------------|
| **同乡** | `hometown` equal | `同乡（上海）` |
| **同行** | `industry` equal | `同行业（互联网）` |
| **同学历** | `educationLevel` equal | `同学历（本科）` |
| **同状态** | `relationshipStatus` equal (not "不透露") | `同为单身贵族` |
| **同领域同模式** | `workMode` + `industryCategory` equal | `同在科技·创业者` |
| **同频** | Same archetype energy band | `同频` |
| **性格互补** | Chemistry score > 85 | `性格互补（corgi×koala）` |
| **同款人格** | Exact same archetype | `同款人格（corgi）` |
| **老乡+同行** | Hometown + industry category both match | `老乡+同行（上海·互联网）` |
| **深度同好** | ≥3 shared interests at heat ≥2 | `深度同好（5个共同深度兴趣）` |
| **同款聊法** | Same `discussionStyle` on shared interest | `「美食」同款聊法（随便聊聊）` |
| **话题深度相近** | `conversationDepth` diff ≤ 1 | `「美食」话题深度相近` |

### 2.3 Data Sources

| Source | Table/Field | Used For |
|--------|-------------|----------|
| User profile | `users.hometown`, `users.educationLevel`, etc. | Basic connection points |
| Interest signals | `user_interest_signals.discussionStyle`, `.conversationDepth` | 同款聊法 / 话题深度相近 |
| Interest heat | `user_interests.heat` | 深度同好 threshold check |
| Chemistry matrix | `archetypeCompatibility.ts` | 性格互补 threshold (>85) |

> **Architectural boundary:** `user_interest_signals` are **never** used in deterministic pair scoring (`poolMatchingService.ts`). They are valid **only** for AI prompt enrichment and connection point generation. See `docs/systems/interest-signal-boost.md` §1.

### 2.4 API Contract

Connection points travel in `PairExplanation`:

```typescript
// packages/shared/src/types/groupAnalysis.ts
interface PairExplanation {
  pairKey: string;
  explanation: string;
  chemistryScore: number;
  sharedInterests: string[];
  connectionPoints: string[];  // ← findConnectionPoints output
  introAngle?: string;
}
```

Cached in `event_pool_groups.pair_explanations_cache` (JSONB).

---

## 3. Client-Side: `SparkPrediction`

**Files:**
- `apps/user-client/src/lib/attendeeAnalytics.ts`
- `apps/admin-client/src/lib/attendeeAnalytics.ts` (identical copy)

### 3.1 What It Does

Generates rarity-tagged predictions **independently on the client** by comparing the current user's profile against another attendee. Drives visual "energy ring" and match-quality scoring.

### 3.2 Rarity Tiers

| Tier | Weight | Color | Visual Boost | Examples |
|------|--------|-------|-------------|----------|
| **common** | 1 | Grey `#6B7280` | +5% | 同城, 同行, 年龄相近, 同性别 |
| **rare** | 3 | Purple `#8B5CF6` | +10% | 老乡, 同频, 都有海外经历, 硕士学历 |
| **epic** | 6 | Gold `#F59E0B` | +15% | 同款人格, 老乡+同行, 博士学历, 同为创业者 |

### 3.3 `calculateMatchQuality` Scoring

```typescript
// Weighted score based on rarity
score = Σ weights[rarity]   // common=1, rare=3, epic=6

// Energy ring fill (6 points = 100%)
fillPercent = min(connectionPoints.length / 6 * 100, 100)

// Quality tier = highest rarity present
qualityTier = hasEpic ? 'epic' : hasRare ? 'rare' : 'common'
```

### 3.4 Visual System: `EnergyRing`

**File:** `apps/user-client/src/components/EnergyRing.tsx`

An animated SVG ring with tier-specific effects:

| Tier | Ring Style | Animation |
|------|-----------|-----------|
| Common | Grey segmented ring | Slow breath (3s cycle) |
| Rare | Purple gradient ring | Faster breath (2.5s), stronger glow |
| Epic | Gold gradient ring | Fast breath (2s), flowing light trail, orbiting particles |

**Parameters:**
- `percentage`: ring fill (0–100)
- `qualityTier`: determines color + animation intensity
- `visualBoost`: additive bonus to fill percentage (5%/10%/15%)
- `size`: 120px default

---

## 4. Data Flow

```
User A profile ──┐
                 ├──→ findConnectionPoints ──→ AI prompt ──→ PairExplanation.connectionPoints
User B profile ──┘                                    │
                                                      │ API
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client (Web / Mini-Program)                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Web: SquadUnboxingFlow  │  │ Web: UserConnectionCard             │  │
│  │ • Shows plain pills     │  │ • EnergyRing (animated SVG)         │  │
│  │ • Server-driven rarity  │  │ • calculateMatchQuality             │  │
│  │   (connectionPointsWithRarity)│ • MysteryBadge reveal game          │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Mini-Program: matching-status (Unified Reveal)                     │ │
│  │ • composeUnifiedReveal: merges chemistryPayoff + connectionPoints  │ │
│  │ • UnifiedRevealCard: single card with spotlight pair + group body  │ │
│  │ • hasRevealed flag via Taro storage                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.5 Unified Reveal Pattern

**File:** `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.ts`

The Unified Reveal fuses the **group-level chemistry narrative** (`chemistryPayoff`) with **pair-level connection point evidence** (`connectionPointsWithRarity`) into a single presentational object. This is a pure client-side transform — **no server or API changes**.

### 4.5.1 `composeUnifiedReveal()`

```typescript
function composeUnifiedReveal(
  chemistryPayoff: ChemistryPayoff,
  connectionPointsWithRarity: ConnectionPointRarity[],
  spotlightPair: PairExplanation,
  memberName: string
): UnifiedRevealTokens {
  return {
    headline: string;        // e.g. "命运的红线"
    body: string;            // spotlight pair.explanation (priority) or chemistryPayoff.chemistryLine
    subtitle: string;        // group-level chemistry payoff body (when spotlight overrides)
    groupTags: string[];     // chemistryPayoff.tags
    spotlight: {
      memberName: string;
      chemistryScore: number;
      connectionPointsWithRarity: { text: string; rarity: 'common'|'rare'|'epic' }[];
      rarityTier: 'common'|'rare'|'epic';
    }
  };
}
```

**Priority rule:** `spotlightPair.explanation` overrides `chemistryPayoff.chemistryLine` for the `body`. When this happens, `chemistryPayoff.body` falls back to `subtitle` so the group-level narrative is not lost.

**Legacy normalization:** If the input only provides `connectionPoints: string[]` (no rarity), the function normalizes each entry to `{ text, rarity: 'common' }`.

### 4.5.2 `UnifiedRevealCard.tsx`

**File:** `apps/mini-program/src/pages/matching-status/UnifiedRevealCard.tsx`

Renders the fused output:
- **Headline** — chemistry payoff title (large, brand accent)
- **Body** — spotlight pair explanation (overrides group chemistry line when present)
- **Subtitle** — group chemistry body (shown only when body was overridden)
- **Group tags** — chemistry payoff tags as small pills
- **Spotlight** — member name, chemistry score, and tiered connection point pills with rarity colors

### 4.5.3 Reveal State (`hasRevealed`)

**File:** `apps/mini-program/src/pages/matching-status/useMatchingStatusController.ts`

The reveal is a one-time, per-group interaction. `hasRevealed` is persisted via Taro storage:

```typescript
Taro.setStorageSync('jj_revealed_' + groupId, true);
const hasRevealed = Taro.getStorageSync('jj_revealed_' + groupId) === true;
```

### 4.5.4 Lifecycle Safety

Timer leak fixes in the matching-status screen:
- `mountedRef` guards setState callbacks against unmounted components
- `useDidHide` pauses active timers when the mini-program page is hidden

### 4.5.5 Test Coverage

12 regression tests in `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.test.ts` covering:
- Spotlight override priority
- Legacy `string[]` normalization
- Empty / missing chemistry payoff fallbacks
- Rarity tier computation from connection points

---

## 5. Platform Parity Analysis

### Current State

| Feature | Web (`user-client`) | Mini-Program | Admin |
|---------|-------------------|--------------|-------|
| Receive `connectionPointsWithRarity` from API | ✅ | ✅ | ✅ |
| Display as tiered rarity pills | ✅ | ✅ | ✅ |
| `generateSparkPredictions` (deleted) | ❌ | ❌ | ❌ |
| `calculateMatchQuality` | ✅ | ✅ | ✅ |
| `EnergyRing` component | ✅ | ❌ | ❌ |
| `UserConnectionCard` | ✅ | ❌ | ❌ |
| `MysteryBadge` reveal game | ✅ | ❌ | ❌ |
| Unified Reveal (`composeUnifiedReveal`) | ❌ | ✅ | ❌ |

### Gap Assessment

**What the mini-program is missing:**
1. ~~Rarity inference~~ — ✅ **Resolved**: server now returns `connectionPointsWithRarity`
2. ~~Match quality scoring~~ — ✅ **Resolved**: mini-program uses shared `calculateMatchQuality` from `packages/shared/src/ui/connectionPointCompat.ts`
3. **Energy ring visualization** — no animated ring component (intentional; tiered pills are the mini-program design language)
4. **Mystery badge reveal** — no interactive reveal game

**What the mini-program already has (and is arguably better):**
- Xiaoyue mascot + blind box shake animation
- Progressive card reveal with staggered timing
- Archetype avatar + archetype badge
- Chemistry score + pair explanation
- Connection point pills with tiered rarity colors

### What Was Built

**Phase 1: Server-driven rarity** — `findConnectionPoints` now returns `{ text: string, rarity: 'common'|'rare'|'epic' }[]`. Both fields (`connectionPoints` and `connectionPointsWithRarity`) are emitted for backward compatibility.

**Phase 2: Mini-program tiered pills** — `MatchingStatusSections` and `squad-unboxing` now render rarity-colored pills (common = grey, rare = purple, epic = gold) using the server-provided `connectionPointsWithRarity` field. On `squad-unboxing` (2026-07-16), a card without a viewer connection point falls back to the member's top interest in a neutral-outline pill (`buildInterestHookText`), so every dealt card carries a row-4 hook — connection points always win the slot when present.

**Phase 3: Web client** — EnergyRing unchanged; compat shim in `packages/shared` pipes server-driven rarity into existing ring props. Legacy `generateSparkPredictions` deleted from both user-client and admin-client in this sprint.

**Phase 4: Unified Reveal (2026-04-29)** — Mini-program matching-status screen now fuses `chemistryPayoff` with `connectionPointsWithRarity` into a single `UnifiedRevealCard`. Adds `composeUnifiedReveal` pure function, `hasRevealed` Taro storage flag, and timer leak fixes (`mountedRef`, `useDidHide`). No server/API changes.

**Remaining cleanup:** See `docs/tech-debt/connection-points-cleanup.md` (TECH-DEBT-001).

---

## 6. Key Source Files

| Purpose | File |
|---------|------|
| Server connection point generation | `apps/server/src/matchExplanationService.ts` (lines 545–634) |
| Server pair explanation API | `apps/server/src/matchExplanationService.ts` (lines 683–760) |
| Chemistry score lookup | `apps/server/src/archetypeChemistryCalibration.ts` |
| Client spark predictions | `apps/user-client/src/lib/attendeeAnalytics.ts` (lines 387–520) |
| Client match quality scoring | `apps/user-client/src/lib/attendeeAnalytics.ts` (lines 308–350) |
| Energy ring component | `apps/user-client/src/components/EnergyRing.tsx` |
| Connection card UI | `apps/user-client/src/components/UserConnectionCard.tsx` |
| Shared type contract | `packages/shared/src/types/groupAnalysis.ts` |
| Shared constants | `packages/shared/src/constants.ts` (lines 198–254) |
| Mini-program squad unboxing | `apps/mini-program/src/pages/squad-unboxing/index.tsx` |
| Mini-program matching status | `apps/mini-program/src/pages/matching-status/MatchingStatusSections.tsx` |
| Mini-program unified reveal VM | `apps/mini-program/src/pages/matching-status/viewModels/matchingStatusViewModels.ts` |
| Mini-program unified reveal card | `apps/mini-program/src/pages/matching-status/components/UnifiedRevealCard.tsx` |
| Mini-program reveal state hook | `apps/mini-program/src/pages/matching-status/hooks/useMatchingStatus.ts` |
| Mini-program reveal VM tests | `apps/mini-program/src/pages/matching-status/viewModels/matchingStatusViewModels.test.ts` |
| Interest signal system | `docs/systems/interest-signal-boost.md` |

---

## 7. Open Questions

1. ~~Should `findConnectionPoints` return rarity tags?~~ ✅ **Resolved** — `connectionPointsWithRarity` field added; server now produces both fields for backward compatibility.

2. ~~Should the EnergyRing remain web-only?~~ ✅ **Resolved** — Mini-program uses tiered pills as its native design language; EnergyRing remains web-only.

3. ~~What's the fate of `generateSparkPredictions`?~~ ✅ **Resolved** — Deleted from both user-client and admin-client in the `connection-points-mini-program` sprint (2026-04-29). Server-driven rarity is the replacement.

4. **Should `attendeeAnalytics.ts` be moved to `packages/shared`?** ⚠️ **Pending cleanup** — It currently exists in 2 identical copies (user-client + admin-client). The shared `connectionPointCompat.ts` already holds server-driven rarity logic. Full deduplication is tracked in TECH-DEBT-001.

---

## 8. Appendix: Connection Point Type Registry

```typescript
// packages/shared/src/constants.ts
export const CONNECTION_POINT_TYPES = {
  // Common
  SAME_CITY:        { id: "same_city", label: "同城", emoji: "🏙️", tier: "common" },
  SAME_INDUSTRY:    { id: "same_industry", label: "同行", emoji: "💼", tier: "common" },
  SAME_EDUCATION:   { id: "same_education", label: "同学历", emoji: "🎓", tier: "common" },
  SAME_RELATIONSHIP:{ id: "same_relationship", label: "同状态", emoji: "💫", tier: "common" },

  // Rare
  SAME_HOMETOWN:    { id: "same_hometown", label: "老乡", emoji: "🏠", tier: "rare" },
  SAME_ARCHETYPE_BAND: { id: "same_archetype_band", label: "同频", emoji: "🎵", tier: "rare" },
  SAME_WORK_INDUSTRY:  { id: "same_work_industry", label: "同领域同模式", emoji: "🤝", tier: "rare" },
  COMPLEMENTARY_ARCHETYPE: { id: "complementary_archetype", label: "性格互补", emoji: "🧩", tier: "rare" },

  // Epic
  EXACT_ARCHETYPE:  { id: "exact_archetype", label: "同款人格", emoji: "✨", tier: "epic" },
  HOMETOWN_INDUSTRY_COMPOUND: { id: "hometown_industry", label: "老乡+同行", emoji: "🔥", tier: "epic" },
  DEEP_INTEREST_OVERLAP: { id: "deep_interest_overlap", label: "深度同好", emoji: "💎", tier: "epic" },
};
```

Note: The `id` values in this registry are **not currently used** by `findConnectionPoints` (which uses `getConnectionPointRarity()` for runtime assignment). They exist as a typed catalog. A future refactor should derive `CONNECTION_POINT_RARITY_RULES` from this registry for single-source-of-truth.
