# JoyJoin AI Integration Plan

> **Status:** Living document — created 2026-03-23  
> **Scope:** Three-tier AI roadmap for the matching pipeline — pre-match prediction, in-match event intelligence, and post-match learning loop.

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
2. [Tier 1 — AI Group Vibe Prediction (Pre-Match)](#2-tier-1--ai-group-vibe-prediction-pre-match)
3. [Tier 2 — AI Event Matching Intelligence (In-Match)](#3-tier-2--ai-event-matching-intelligence-in-match)
4. [Tier 3 — Post-Match Learning Loop](#4-tier-3--post-match-learning-loop)
5. [Cross-Tier Data Flow](#5-cross-tier-data-flow)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Key Source Files](#7-key-source-files)

---

## 1. Overview & Design Philosophy

JoyJoin's AI integration targets three distinct pipeline moments:

```
User registers for event pool
          │
          ▼
┌──────────────────────────────────┐
│  TIER 1: Pre-Match               │
│  AI enriches group vibe signal   │
│  BEFORE groups are formed        │
└──────────────┬───────────────────┘
               │  group formed
               ▼
┌──────────────────────────────────┐
│  TIER 2: In-Match Event Intel    │
│  AI personalises the event       │
│  scenario itself (theme, venue,  │
│  icebreaker, group narrative)    │
└──────────────┬───────────────────┘
               │  event completes
               ▼
┌──────────────────────────────────┐
│  TIER 3: Post-Match Loop         │
│  Real feedback → weight tuning   │
│  → better future matches         │
└──────────────────────────────────┘
```

### Current State (as of 2026-03-23)

| Tier | Feature | Status |
|------|---------|--------|
| Tier 1 | Rule-based `predictAtmosphere()` | ✅ Live |
| Tier 1 | AI-enriched vibe scoring during group formation | 🔲 Planned |
| Tier 2 | DeepSeek pair explanations + icebreakers | ✅ Live (post-match reveal) |
| Tier 2 | AI event theme title generator | ✅ Live |
| Tier 2 | AI-driven event scenario optimisation | 🔲 Planned |
| Tier 3 | `dynamicWeights.ts` gradient descent | ✅ Live (legacy flow) |
| Tier 3 | `matchingWeightsService.ts` Thompson Sampling bandit | ✅ Live (pool flow) |
| Tier 3 | Feedback → chemistry matrix refinement | 🔲 Planned |

---

## 2. Tier 1 — AI Group Vibe Prediction (Pre-Match)

### 2.1 What Exists Today

**Rule-based engine:** `packages/shared/src/atmospherePrediction.ts`  
**Interface:**
```typescript
export interface AtmospherePrediction {
  type: AtmosphereType;       // "party_mode" | "warm_cozy" | "high_energy" | "deep_connect" | "creative_spark" | "balanced"
  title: string;              // e.g. "动静结合型"
  description: string;        // e.g. "有人暖场有人走心，节奏刚刚好"
  energyScore: number;        // mean ARCHETYPE_ENERGY of group members
  energyVariance: number;     // std deviation (diversity signal)
  highlight: string;          // dynamic highlight sentence
  suggestedTopics: string[];  // 3 topic recommendations
  dominantArchetypes: string[]; // top archetype names in group
}
```

**Called from:** `generateNotificationCopy()` and `generateReminderCopy()` — used in push notification text only. The `predictAtmosphere()` output is **not currently fed into `overallScore`** during group formation.

### 2.2 The Gap

`predictAtmosphere()` uses hard-coded archetype energy thresholds and rule-based branching. It cannot learn, and it only describes — it does not optimise. The matching algorithm (`poolMatchingService.ts`) ignores atmosphere type entirely during group selection.

### 2.3 Planned: AI-Enriched Vibe Scoring in Group Formation

**Concept:** Before `formOptimalGroups()` finalises group assignments, an AI model evaluates candidate group compositions and adds a **vibeScore** on top of the existing `overallScore`. This vibeScore captures qualitative patterns the rule engine misses — e.g. "this mix of archetypes historically generates great conversations about food culture" based on feedback patterns.

**Proposed integration point:** `apps/server/src/poolMatchingService.ts` — inside `matchEventPool()`, after `calculateGroupPairScore()` and `calculateGroupDiversity()` are computed, before final group selection.

**Proposed new field in `MatchGroup`:**
```typescript
export interface MatchGroup {
  // ... existing fields ...
  vibeScore?: number;           // AI-predicted group vibe quality (0-100), optional until feature ships
  vibeType?: string;            // predicted atmosphere type from AtmospherePrediction.type
  vibeConfidence?: number;      // model confidence (0-1)
}
```

**Proposed scoring integration:**
```typescript
// When vibeScore is available, blend into overallScore
const vibeWeight = 0.10; // initially conservative
const adjustedOverallScore = vibeScore != null
  ? overallScore * (1 - vibeWeight) + vibeScore * vibeWeight
  : overallScore;
```

**Why 10% initially:** The existing `overallScore` formula (60% pair compatibility + 25% diversity + 15% energy balance) is already well-calibrated. AI vibe scoring adds a soft qualitative layer — it should nudge, not dominate. The weight can increase as the model accumulates feedback validation.

**AI model options (in order of preference):**
1. **DeepSeek call** — extend `matchExplanationService.ts` with a new `predictGroupVibeScore(members: MatchMember[]): Promise<number>` function using the existing DeepSeek client, with archetype compositions + shared interests as context
2. **Local heuristic upgrade** — extend `atmospherePrediction.ts::predictAtmosphere()` with a feedback-weighted scoring layer, consuming `wouldMeetAgain` + `atmosphereScore` aggregate patterns per archetype combination
3. **Embedding similarity** — compute cosine similarity of member interest embeddings (future, requires embedding API)

**Input context for the AI call:**
```typescript
const vibePrompt = `你是社交氛围分析专家。请预测以下${members.length}人组合的社交氛围质量分数（0-100）。
成员组合：
${members
  .map(m => {
    // 注意：这里的兴趣来自 user_interests 表（预先查询并挂载到 m.userInterests）
    const topFromPriorities =
      m.userInterests?.topPriorities?.slice(0, 3).map(t => t.label) ?? [];
    const topFromSelections =
      topFromPriorities.length > 0
        ? topFromPriorities
        : m.userInterests?.selections?.slice(0, 3).map(s => s.label) ?? [];
    const interestDisplay =
      topFromSelections.length > 0 ? topFromSelections.join('、') : '未知';
    return `- 原型: ${m.archetype}, 兴趣: ${interestDisplay}, 行业: ${
      m.industry || '未知'
    }`;
  })
  .join('\n')}
化学反应矩阵均分: ${avgChemistryScore}
能量方差: ${energyVariance}
请只返回一个0-100的整数分数，不要解释。`;
```

**Caching strategy:** Cache per group composition hash (sorted member archetype+interest fingerprint) in Redis or DB. TTL: 24h. This avoids redundant API calls for identical compositions across pools.

**Fallback:** If AI call fails or times out (>2s), use `predictAtmosphere().energyScore` as a proxy vibeScore. No hard dependency on AI availability.

### 2.4 Vibe Prediction as User-Facing Signal

The `AtmospherePrediction` output already drives push notification copy (`generateNotificationCopy`, `generateReminderCopy`). The planned upgrade: surface the **vibe type and highlight** directly in the match reveal UI.

**Current flow (notification only):**
```
matchEventPool() → group formed → generateNotificationCopy(archetypes) → push notification text
```

**Planned flow (UI-facing):**
```
matchEventPool() → group formed → predictAtmosphere(archetypes) → store in eventPoolGroups.matchExplanation
                                                                 → surface in BlindBoxEventDetailPage
                                                                 → surface in SquadUnboxingFlow as vibe badge
```

**DB field:** `eventPoolGroups.matchExplanation` (text column, already exists) — currently stores the template string from `generateGroupExplanation()`. Proposal: JSON-encode both the template string and the `AtmospherePrediction` result.

---

## 3. Tier 2 — AI Event Matching Intelligence (In-Match)

### 3.1 What Exists Today

**Match Explanation Service:** `apps/server/src/matchExplanationService.ts`

Capabilities:
- `generatePairExplanation(member1, member2)` — DeepSeek call, 50-80 Chinese chars, warm tone, explains why two people may connect
- `generateGroupAnalysis(groupId, members, eventType)` — orchestrates pair explanations + icebreakers, caches to `eventPoolGroups.pairExplanationsCache` (JSONB) and `eventPoolGroups.iceBreakersCache` (JSONB)
- `generateIceBreakers(members, eventType)` — generates 3-5 tailored conversation starters

**Router bypass note:** The client fetches AI explanations via:
```
GET /api/blind-box-events/:eventId/match-explanations
```
See: `apps/user-client/src/hooks/useInviteData.ts::useMatchExplanations()`

This route bypasses the pool group lookup — it serves explanations keyed by `blindBoxEventId`, not `groupId`. In the current implementation, `poolMatchingService.ts::matchEventPool()` does **not** call `generateGroupAnalysis()`. Instead, the `/api/blind-box-events/:eventId/match-explanations` route lazily calls `matchExplanationService.generateGroupAnalysis()` on demand when the client requests explanations, and that service is responsible for persisting/caching results to the `eventPoolGroups` JSONB fields for subsequent requests. New AI generation for match explanations should follow this lazy, on-request pattern unless there is a strong reason to pre-compute during matching.

**Event Theme Generator:** `apps/server/src/services/eventThemeTitleGenerator.ts`  
**Caller:** `generateAndSaveEventTheme()` in `apps/server/src/eventThemeGeneratorService.ts`  
**Called from:** `poolMatchingService.ts` after groups are formed and saved

### 3.2 The Gap

Current AI event intelligence is **post-hoc and descriptive** — it explains what was matched, not what the event should be shaped around. Opportunities:

1. **Dynamic event scenario shaping** — AI decides the event's conversational angle based on group composition (e.g. for a group heavy in 机智狐+灵感章鱼: suggest a "creative challenge" format vs. a standard dinner)
2. **Personalised venue-group matching** — AI interprets group vibe type to influence `venueAssignmentService.ts` venue scoring
3. **Adaptive icebreaker sequencing** — current icebreakers are a flat list; AI should sequence them based on group energy (open with high-energy openers for 开心柯基-heavy groups, start reflective for 稳如龟/沉思猫头鹰 groups)

### 3.3 Planned: AI Event Scenario Optimisation

**Concept:** After a group is formed, AI synthesises group composition, venue type, event type (饭局/酒局), and predicted atmosphere to generate a **scenario brief** — a short structured output that guides:
- The event theme (currently generated by `generateEventThemeTitle()` independently)
- The icebreaker opening question sequence
- The match explanation framing

**Proposed new service:** `apps/server/src/services/eventScenarioService.ts`

```typescript
interface EventScenario {
  scenarioType: string;           // e.g. "deep_explorer" | "high_energy_mixer" | "creative_collision"
  openingIcebreaker: string;      // The first icebreaker question (most important)
  conversationArc: string[];      // Ordered list: warm-up → depth → playful → reflect
  venueVibeHint: string;          // Hint to venueAssignmentService: "prefer quieter venue" | "high-energy space ok"
  themeKeyword: string;           // Feeds eventThemeTitleGenerator as context
}

export async function generateEventScenario(
  members: MatchMember[],
  atmospherePrediction: AtmospherePrediction,
  eventType: string
): Promise<EventScenario>
```

**Integration sequence:**
```
poolMatchingService.matchEventPool()
  → groups formed
  → [existing] generateGroupAnalysis()     → pairExplanationsCache
  → [NEW]      generateEventScenario()     → eventPoolGroups.matchExplanation (extended JSON)
  → [existing] generateAndSaveEventTheme() → uses themeKeyword from scenario as hint
  → [existing] assignVenuesToGroups()      → uses venueVibeHint from scenario
```

**Schema change needed:** Add `scenarioCache` JSONB column to `event_pool_groups` table (new DB migration), or extend existing `matchExplanation` text field to store JSON blob. The latter is simpler (no migration): store `JSON.stringify({ templateText, scenario, atmospherePrediction })`.

### 3.4 Planned: Adaptive Icebreaker Sequencing

Currently `generateIceBreakers()` returns a flat array of 5-8 questions with no ordering logic. The upgrade:

**Proposed change to `matchExplanationService.ts::generateIceBreakers()`:**
```typescript
interface SequencedIceBreaker {
  question: string;
  phase: "warmup" | "depth" | "playful" | "reflect";
  targetEnergy: "high" | "medium" | "low";  // Which archetype energy range this suits
}

export async function generateIceBreakers(
  members: MatchMember[],
  eventType: string,
  atmosphereType?: AtmosphereType  // NEW: from predictAtmosphere()
): Promise<SequencedIceBreaker[]>
```

**Sequencing logic:**
- For `high_energy` / `party_mode` atmosphere: lead with `playful` phase questions
- For `deep_connect` / `warm_cozy` atmosphere: lead with `warmup` then fast-track to `depth`
- For `balanced` / `creative_spark`: standard `warmup → depth → playful → reflect` arc

---

## 4. Tier 3 — Post-Match Learning Loop

### 4.1 What Exists Today

**Legacy flow (blind-box events):** `apps/server/src/dynamicWeights.ts`
- Gradient descent weight update on each feedback submission
- Fields updated: `energyWeight`, `interestWeight`, `backgroundWeight`, `personalityWeight`
- Triggered by: `POST /api/blind-box-events/:id/feedback`

**Pool flow:** `apps/server/src/matchingWeightsService.ts`
- Status: Implemented in isolation, **not yet wired** to any API endpoint
- Thompson Sampling multi-armed bandit
- Maintains Beta distribution per weight configuration (α, β updated per `wouldMeetAgain` signal)
- Planned trigger (not yet implemented): `POST /api/event-pools/:poolId/feedback`

### 4.2 The Gap

Both existing systems tune **numeric dimension weights** but do not update the **chemistry matrix** (`packages/shared/src/personality/archetypeCompatibility.ts`). The chemistry matrix is hand-authored and static. If user feedback consistently shows that, e.g., 机智狐+探索者 pairings underperform their predicted chemistry score, the matrix is never corrected.

### 4.3 Planned: Feedback → Chemistry Matrix Refinement

**Concept:** Aggregate `wouldMeetAgain` + `atmosphereScore` feedback per archetype pair. When a pair's empirical score diverges significantly from the matrix value, apply a bounded adjustment.

**Proposed new table:** `archetype_pair_feedback_stats`
```sql
CREATE TABLE archetype_pair_feedback_stats (
  archetype_a        VARCHAR(50) NOT NULL,
  archetype_b        VARCHAR(50) NOT NULL,
  sample_count       INTEGER DEFAULT 0,
  avg_meet_again     NUMERIC(4,3),   -- 0.0–1.0 (fraction saying yes)
  avg_atmosphere     NUMERIC(4,1),   -- 1.0–5.0
  last_updated_at    TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (archetype_a, archetype_b)
);
```

**Update rule:**
```typescript
// On each feedback event where wouldMeetAgain is known:
const empiricalScore = (wouldMeetAgain ? 1 : 0) * 60 + (atmosphereScore / 5) * 40;
const currentMatrixScore = CHEMISTRY_MATRIX[archetypeA][archetypeB];
const delta = (empiricalScore - currentMatrixScore) * LEARNING_RATE; // LEARNING_RATE = 0.02
const newScore = Math.max(10, Math.min(100, currentMatrixScore + delta));
```

**Why bounded (10–100):** Prevents runaway drift. Minimum 10 ensures no archetype pair is ever completely excluded by the model.

**Persistence strategy:** Store adjusted scores in `archetype_pair_feedback_stats`. At matching time, `calculateChemistryScore()` checks this table first (with a DB lookup or in-memory cache refreshed every 5 min), falling back to the static matrix when sample count < 10 (cold-start threshold).

**Cold-start handling:** When `sample_count < 10`, use the static matrix value unchanged. This prevents noise from small samples distorting early results.

---

## 5. Cross-Tier Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW OVERVIEW                               │
│                                                                         │
│  user_interests (DB)  ──────────────────────────────────────────────┐  │
│  assessment_sessions (DB) ─────────────────────────────────────┐   │  │
│                                                                 │   │  │
│  TIER 1: atmospherePrediction.ts                                │   │  │
│    predictAtmosphere(archetypes[])                              │   │  │
│      └─ energyScore, vibeType ──────────────────────────────┐  │   │  │
│                                                              │  │   │  │
│  TIER 1 (planned): AI vibeScore                             │  │   │  │
│    predictGroupVibeScore(members[]) ────────────────────┐   │  │   │  │
│                                                         │   │  │   │  │
│  poolMatchingService.ts::matchEventPool()               │   │  │   │  │
│    overallScore = 60% pairScore + 25% diversity +       │   │  │   │  │
│                   15% energyBalance                     │   │  │   │  │
│    [+ 10% vibeScore blend when available] ◄─────────────┘   │  │   │  │
│                                                              │  │   │  │
│  TIER 2: matchExplanationService.ts                          │  │   │  │
│    generateGroupAnalysis(groupId, members, eventType)        │  │   │  │
│      └─ pairExplanationsCache (JSONB) ──► event reveal UI    │  │   │  │
│      └─ iceBreakersCache (JSONB) ───────► event reveal UI    │  │   │  │
│    generateIceBreakers(members, eventType, atmosphereType) ◄─┘  │   │  │
│                                                                  │   │  │
│  TIER 2 (planned): eventScenarioService.ts                       │   │  │
│    generateEventScenario(members, atmospherePrediction, type)    │   │  │
│      └─ themeKeyword ──► eventThemeTitleGenerator.ts             │   │  │
│      └─ venueVibeHint ─► venueAssignmentService.ts               │   │  │
│                                                                  │   │  │
│  TIER 3: feedback ingestion                                      │   │  │
│    wouldMeetAgain + atmosphereScore ─────────────────────────────┘   │  │
│      └─ matchingWeightsService.ts (Thompson Sampling) ───────────────┘  │
│      └─ archetype_pair_feedback_stats (planned) ─► CHEMISTRY_MATRIX     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Roadmap

### Phase 1 — Foundation (Q2 2026)

| Task | Owner | Files Affected |
|------|-------|----------------|
| Expose `AtmospherePrediction` in match reveal UI | Frontend | `BlindBoxEventDetailPage.tsx`, `SquadUnboxingFlow.tsx` |
| Store `predictAtmosphere()` result in `eventPoolGroups.matchExplanation` as JSON | Backend | `poolMatchingService.ts`, `matchExplanationService.ts` |
| Add `atmosphereType` param to `generateIceBreakers()` | Backend | `matchExplanationService.ts` |
| Implement `SequencedIceBreaker` return type | Backend | `matchExplanationService.ts` |

### Phase 2 — AI Vibe Scoring (Q3 2026)

| Task | Owner | Files Affected |
|------|-------|----------------|
| Implement `predictGroupVibeScore()` in `matchExplanationService.ts` | Backend | `matchExplanationService.ts` |
| Integrate vibeScore into `matchEventPool()` scoring | Backend | `poolMatchingService.ts` |
| Add `vibeScore`, `vibeType`, `vibeConfidence` to `MatchGroup` interface | Shared | `packages/shared/src/schema.ts` or `poolMatchingService.ts` types |
| Implement composition-hash caching for vibeScore | Backend | New cache utility or extend existing |

### Phase 3 — Event Scenario Service (Q3 2026)

| Task | Owner | Files Affected |
|------|-------|----------------|
| Create `apps/server/src/services/eventScenarioService.ts` | Backend | New file |
| Integrate scenario output into `eventThemeTitleGenerator.ts` | Backend | `eventThemeTitleGenerator.ts`, `eventThemeGeneratorService.ts` |
| Pass `venueVibeHint` to venue assignment | Backend | `venueAssignmentService.ts` |

### Phase 4 — Chemistry Matrix Learning (Q4 2026)

| Task | Owner | Files Affected |
|------|-------|----------------|
| Create `archetype_pair_feedback_stats` table | Backend | `packages/shared/src/schema.ts` (Drizzle) |
| Update feedback handler to write to new table | Backend | `apps/server/src/routes.ts` (feedback endpoints) |
| Update `calculateChemistryScore()` to check learned scores | Backend | `apps/server/src/poolMatchingService.ts` |
| Add 5-min cache for learned chemistry scores | Backend | `poolMatchingService.ts` or new cache module |

---

## 7. Key Source Files

| File | Purpose | Tier |
|------|---------|------|
| `packages/shared/src/atmospherePrediction.ts` | Rule-based atmosphere prediction | 1 |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Chemistry matrix (static, shared reference data for clients & analytics) | 1, 3 |
| `apps/server/src/archetypeChemistry.ts` | Live chemistry matrix used at match time (`chemistryMatrix` for scoring & explanations) | 1, 2 |
| `apps/server/src/poolMatchingService.ts` | Core matching algorithm — `matchEventPool()`, `calculateGroupPairScore()`, `calculateGroupDiversity()` | 1, 2 |
| `apps/server/src/matchExplanationService.ts` | DeepSeek pair explanations + icebreakers — `generateGroupAnalysis()`, `generateIceBreakers()`, `generatePairExplanation()` | 2 |
| `apps/server/src/services/eventThemeTitleGenerator.ts` | AI event theme title generation | 2 |
| `apps/server/src/eventThemeGeneratorService.ts` | Orchestrates `generateAndSaveEventTheme()` | 2 |
| `apps/server/src/venueAssignmentService.ts` | Venue-to-group assignment logic | 2 |
| `apps/server/src/dynamicWeights.ts` | Legacy gradient descent weight update | 3 |
| `apps/server/src/matchingWeightsService.ts` | Thompson Sampling bandit for pool weights | 3 |
| `apps/user-client/src/hooks/useInviteData.ts` | `useMatchExplanations()` — client fetch for AI explanations | 2 |
| `packages/shared/src/schema.ts` | Drizzle DB schema — `eventPoolGroups`, `users`, `assessmentSessions` | All |
