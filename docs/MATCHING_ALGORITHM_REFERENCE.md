# JoyJoin Matching Algorithm Reference

> **Status:** Living document — last updated 2026-04-29  
> **Scope:** Covers all three matching layers: (1) Personality archetype assignment, (2) Pair compatibility scoring, (3) Group formation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layer 1 — Personality Assessment & Archetype Assignment (MatcherV2)](#2-layer-1--personality-assessment--archetype-assignment-matcherv2)
3. [Layer 2 — Pair Compatibility Scoring (Pool Matching)](#3-layer-2--pair-compatibility-scoring-pool-matching)
4. [Layer 3 — Group Formation Algorithm](#4-layer-3--group-formation-algorithm)
5. [Supporting Matrices & Data](#5-supporting-matrices--data)
6. [Hard Constraints (Pre-filter)](#6-hard-constraints-pre-filter)
   - [6.5 AI Group Analysis](#65-ai-group-analysis)
   - [6.7 Predictive Reranking Experiment](#67-predictive-reranking-experiment)
7. [Key Source Files](#7-key-source-files)
8. [Glossary](#8-glossary)

---

## 1. System Overview

JoyJoin's matching pipeline runs in three sequential layers:

```
User completes personality quiz
          │
          ▼
┌─────────────────────────────────┐
│  Layer 1: MatcherV2             │
│  Quiz traits → Archetype        │
│  (primaryArchetype +            │
│   secondaryArchetype)           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Layer 2: Pair Scoring          │
│  6-dimensional compatibility    │
│  score for every user pair      │
│  in an event pool               │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Layer 3: Group Formation       │
│  Greedy + quality-threshold     │
│  algorithm → MatchGroup[]       │
└─────────────────────────────────┘
```

**Primary service:** `apps/server/src/poolMatchingService.ts`  
**Archetype assignment:** `packages/shared/src/personality/matcherV2.ts`  
**Chemistry matrix:** `apps/server/src/archetypeChemistry.ts` / `packages/shared/src/personality/archetypeCompatibility.ts`

> **Updated 2026-04-07 — execution timing boundary**
> - Matching is **not** strictly post-deadline. The backend supports registration-triggered realtime scans and scheduled scans.
> - Discovery-layer helpers such as `PoolForecastStrip` are deterministic client guidance only; they are not inputs to deterministic matching.

---

## 2. Layer 1 — Personality Assessment & Archetype Assignment (MatcherV2)

### 2.1 Six Trait Dimensions (ACEOXP)

| Key | Name | Description |
|-----|------|-------------|
| `A` | 亲和力 (Affinity) | Warmth, empathy, agreeableness |
| `C` | 尽责性 (Conscientiousness) | Reliability, structure, discipline |
| `E` | 情绪稳定性 (Emotional Stability) | Calm, resilience under pressure |
| `O` | 开放性 (Openness) | Curiosity, creativity, novelty-seeking |
| `X` | 外向性 (Extraversion) | Sociability, energy, talkativeness |
| `P` | 正能量 (Positivity) | Tolerance, deliberateness, steady pace |

All traits are scored on a **0–100 scale** from the V4 Adaptive Assessment. Total question count is config-driven: the active standard-question range comes from `AssessmentConfig`, and 2 interactive closing questions are then appended before scoring final secondary signals.

### 2.2 The 12 Social Archetypes

| Archetype | Emoji | Energy Level | Core Traits |
|-----------|-------|-------------|-------------|
| 气氛组柯基 | 🐕 | Very High | High X + High A |
| 情绪稳定鸡 | 🐔 | Very High | High X + High P |
| 捧场王仓鼠 | 🐹 | High | High A + High O |
| 探宝雷达狐 | 🦊 | High | High O + High C |
| 读空气海豚 | 🐬 | Medium | Balanced, High E |
| 社交裁缝蛛 | 🕷 | Medium | High C + High O |
| 情绪树洞考拉 | 🐨 | Medium-Low | High A + High E |
| 脑洞喷泉章鱼 | 🐙 | Medium | High O, creative burst |
| 追问猫头鹰 | 🦉 | Low-Medium | High C + High O, introspective |
| 定海神针大象 | 🐘 | Low-Medium | High A + High E, stabilizer |
| 慢半拍龟 | 🐢 | Low | High P + High E |
| 静音模式猫 | 🐱 | Very Low | Low X, quiet companion |

### 2.3 MatcherV2 Algorithm (v2.4-opposite-pole)

**File:** `packages/shared/src/personality/matcherV2.ts`  
**Class:** `PrototypeMatcher`

#### Step 1 — Weighted Manhattan Similarity

```typescript
baseSimilarity = weightedManhattanSimilarity(correctedTraits, prototype.traitProfile, weights)
```

Trait weights per archetype are derived from `PROTOTYPE_SOUL_TRAITS`:
- **Primary soul traits** → higher weight
- **Secondary traits** → medium weight  
- **Avoid traits** → negative / penalty weight

#### Step 2 — Overshoot Penalty

Penalizes users whose trait scores *exceed* the archetype's prototype significantly:

```typescript
penaltyFactor = calculateOvershootPenalty(correctedTraits, prototype)
// Logistic decay: penalty grows as excess SD increases
logisticTraitScore(diff, steepness = 0.08) = 1 / (1 + exp(steepness × diff))
```

#### Step 3 — Asymmetric Avoid-Trait Penalty (V2.3)

For traits flagged as `avoid` in `PROTOTYPE_SOUL_TRAITS`, violations are penalised more harshly to prevent cross-pole mismatches (e.g. very high X should block 静音模式猫).

```typescript
asymmetricPenaltyFactor = calculateAsymmetricPenalty(userTraits, prototype)
```

#### Step 4 — Signal Trait Alignment

```typescript
signalTraitAlignment = Σ max(0, 1 − |userScore − protoScore| / 50)
                       ─────────────────────────────────────────────
                              uniqueSignalTraits.length
```

#### Step 5 — Secondary Bonus

Tiebreaker using non-trait secondary differentiator data collected from the V4 interactive closing questions:

```typescript
secondaryBonus = f(conflictPosture)  // populated from Q_PLAYFUL_EMOJI
// Max contribution: ~+8 points
```

**Active wiring (as of PR #352):**

| `UserSecondaryData` field | Source question | Captured by |
|---|---|---|
| `conflictPosture` | `Q_PLAYFUL_EMOJI` (emoji_tap) | `SECONDARY_QUESTION_MAP` in `secondaryQuestionMap.ts` |
| `motivationDirection` | *(no active question)* | Not currently captured |

`SECONDARY_QUESTION_MAP` is the single source of truth for how closing question answers map to `UserSecondaryData` fields. Only `Q_PLAYFUL_EMOJI` is listed — `Q_PLAYFUL_SLIDER` is trait-scoring only and intentionally absent.

The assembled `UserSecondaryData` is passed to `getFinalResult()` in `adaptiveEngine.ts`, which passes it to the V2 Matcher. The secondary bonus fires whenever `conflictPosture` is present — it is no longer dead code.

#### Step 6 — Final Score

```typescript
finalScore = clamp(
  (baseSimilarity × penaltyFactor × asymmetricPenaltyFactor) + secondaryBonus,
  0, 100
)
```

#### Step 7 — Veto Rules (Multi-phase, V2.4)

Applied after scoring all 12 archetypes:

| Phase | Rule Type | Description |
|-------|-----------|-------------|
| 0 | Opposite-pole conflict gate | Disqualifies archetypes that are a qualitative mismatch (e.g. max-extraversion user → block 静音模式猫) |
| 1 | Signature thresholds | Trait-based pre-filter bonuses/penalties |
| 2 | Archetype veto rules + confusion pair gates | Hard-caps via `ARCHETYPE_VETO_RULES` map |

#### Tie-Breaking

If top-2 scores are within a close gap, `breakTie()` uses secondary differentiators to resolve. The only active secondary differentiator in the current question bank is `conflictPosture` (from `Q_PLAYFUL_EMOJI`). `motivationDirection` is defined in `UserSecondaryData` but is not currently captured by any question.

### 2.4 V4 Adaptive Assessment Engine

**File:** `packages/shared/src/personality/adaptiveEngine.ts`

- **Base questions:** 8–16 adaptive anchor/disambiguation questions
- **Closing questions:** 2 fixed interactive questions (`Q_PLAYFUL_SLIDER`, `Q_PLAYFUL_EMOJI`) appended after adaptive phase stops
- **Confusable pairs** (CONFUSABLE_ARCHETYPE_PAIRS) drive adaptive question selection
- MatcherV2 is enabled by default (`ENABLE_MATCHER_V2_DEFAULT = true`)

---

## 3. Layer 2 — Pair Compatibility Scoring (Pool Matching)

**File:** `apps/server/src/poolMatchingService.ts`  
**Function:** `calculatePairScore(user1, user2): Promise<number>`

### 3.0 Execution Modes

Group formation is owned by the server and can be triggered in two ways:

1. **Realtime scan** — a registration event invokes `poolRealtimeMatchingService.ts`
2. **Scheduled scan** — `scanPoolAndMatch(poolId, "scheduled", ...)` revisits pools later

Both execution modes use the same deterministic pair-scoring and group-formation pipeline; the difference is only **when** the scan runs, not **how** pair scores are computed.

### 3.1 Active Weights (Feature-Flagged 6D / 7D)

```typescript
// Default (ENABLE_SEMANTIC_SIMILARITY=false)
pairScore =
  chemistry           × 0.28 +
  interest            × 0.28 +
  socialAffinity      × 0.20 +
  backgroundDiversity × 0.15 +
  preference          × 0.05 +
  language            × 0.04;

// Flagged rollout (ENABLE_SEMANTIC_SIMILARITY=true)
pairScore =
  chemistry           × 0.26 +
  interest            × 0.26 +
  socialAffinity      × 0.19 +
  backgroundDiversity × 0.14 +
  preference          × 0.05 +
  language            × 0.04 +
  semanticSimilarity  × 0.06;

// Adaptive weights rollout (ENABLE_ADAPTIVE_WEIGHTS=true)
// When the adaptive weights flag is enabled, Thompson Sampling fetches live
// bandit weights once per matching run and passes them to pair scoring.
// Custom weights override the hardcoded defaults above; normalization ensures
// the total still sums to 1.0. See §3.3.

```

`semanticSimilarity` is a bounded, cached semantic-profile score built from existing deterministic
profile fields plus `user_interests` topic/heat data. It is rollout-gated so the disabled path
preserves the exact legacy 6-dimensional formula.

### 3.2 Dimension Detail

#### 3.2.1 Chemistry Score (性格化学反应) — 26% (7D) / 28% (6D)

- **Archetype compatibility** (70%): Reads from the **12×12 Chemistry Matrix** (`archetypeChemistry.ts`), weighted blend of primary (70%) + secondary cross (15% × 2).
- **vibeVector similarity** (30%): 5D continuous personality vector cosine similarity (`{energy, conversation_style, initiative, novelty, humor}` each 0–1). Falls back to pure archetype scoring when vibeVector data is missing.

```typescript
archetypeScore =
  CHEMISTRY_MATRIX[primary1][primary2]   × 0.70
+ CHEMISTRY_MATRIX[primary1][secondary2] × 0.15
+ CHEMISTRY_MATRIX[secondary1][primary2] × 0.15

vibeSim = cosineSimilarity(vibeVector1, vibeVector2)  // 0–1
vibeScore = vibeSim × 100

chemistry = hasVibe
  ? archetypeScore × 0.70 + vibeScore × 0.30
  : archetypeScore  // fallback when vibeVector missing
```

#### 3.2.2 Interest Score (兴趣重叠度) — 28%

**Source:** `user_interests` table (async lookup), with heat-weighted Jaccard scoring.

```typescript
// Step 1 — Base Jaccard
jaccardRatio = commonTopics.length / union.size
baseScore = round(jaccardRatio × 85 + 15)   // Range: 15–100

// Step 2 — Heat Level Bonus (capped at +20)
heatBonus += 15  // both users level-3 (heat=25) on same topic
heatBonus += 10  // one level-3 + one level-2 (heat=10)
heatBonus += 8   // both level-2
heatBonus += 3   // both have any heat > 0

interestScore = min(100, baseScore + heatBonus)
```

Heat levels: `5` (level 1 / casual), `10` (level 2 / active), `25` (level 3 / passionate)

Default when one or both users have no interest data:
- Both missing → 70 (neutral)
- One missing → 30 (low)

> **Architectural boundary (enforced, PR #379):** `user_interest_signals` are **NOT** used in
> deterministic pair-score computation. The `calculateSignalAlignmentBonus()` function and
> `loadInterestSignalLookup()` have been removed from `poolMatchingService.ts`.
> `calculateInterestScoreAsync` reads **only** from `user_interests` (topic overlaps + heat levels).
> Changing or omitting `user_interest_signals` data does not affect pair scores or group formation.
> This invariant is verified by `apps/server/src/__tests__/interestSignalBoundary.test.ts`.
>
> `user_interest_signals` feed AI enrichment layers only (match explanation connection points and
> icebreaker topic generation prompts). See `docs/interest-signal-boost.md` for full details.

**Interest model note:** Temporal heat decay was evaluated and rejected. The active model uses **stable declared interests** kept fresh by two explicit mechanisms: (1) an editable interest carousel at `/profile/edit/interests` (`EditInterestsCarouselPage`), and (2) a post-event interest nudge step in `EventFeedbackFlow` that bumps heat for relevant topics. `user_interests.updated_at` reflects intentional engagement, not time since signup. See `docs/AI_INTEGRATION_PLAN.md §2.2` for rationale.

#### 3.2.3 Social Affinity Score (社交同频度) — 20%

Average of up to 3 sub-signals (equal weight per present factor):

| Sub-signal | Source | Notes |
|-----------|--------|-------|
| Life stage affinity | `LIFE_STAGE_AFFINITY` 7×7 matrix | Asymmetric — averaged both directions |
| Education affinity | Ordinal distance (`EDUCATION_ORDINAL`) | Same level = 100, each step apart = −20 |
| Hometown affinity | `hometownRegionCity` matching | Only when **both** users opt in (`hometownAffinityOptin = true`) |
| Age preference affinity | `ageMatchPreference` | Same = 100, "都可以" compatible = 75, complementary ("偏年轻"+"偏成熟") = 70, conflicting = 40 |
| Table vibe affinity | `tableVibePreference` | Same = 100, compatible (light_fun+natural_chat) = 75, deep_talk+natural_chat = 65, clash (deep_talk+light_fun) = 30 |

**Life Stage Matrix keys:** `founder`, `self_employed`, `employed`, `student`, `transitioning`, `caregiver_retired`, `successor`

**Age preference values:** `同龄人`, `偏年轻`, `偏成熟`, `都可以`

**Table vibe values:** `light_fun`, `natural_chat`, `deep_talk`

**Life Stage Matrix keys:** `founder`, `self_employed`, `employed`, `student`, `transitioning`, `caregiver_retired`, `successor`

**Education Ordinal:**
```
高中及以下 = 0
职业培训 = 1 (same tier as 大专)
大专 = 1
本科 = 2
硕士 = 3
博士 = 4
```

**Note:** Education is an *affinity* signal (same/nearby = better) — it is explicitly **not** a diversity signal.

#### 3.2.4 Background Diversity Score (背景多样性) — 15%

Rewards *difference* (higher score when users are different):

| Signal | Different | Same |
|--------|-----------|------|
| Industry niche (`industryNiche`) | 70 | 30 |
| Gender | 70 | 30 |

```typescript
backgroundDiversity = mean(industryScore, genderScore)
```

#### 3.2.5 Preference Score (活动偏好) — 5%

Event-type aware sub-scores:

| Event Type | Signals |
|-----------|---------|
| 酒局 (bar) | Bar theme overlap + alcohol comfort overlap |
| 饭局 (dining) | Social goal overlap only |
| Both | Dietary restriction compatibility |

**Diet compatibility**: when both users have restrictions, uses shared/all-diet overlap ratio. When only one side has restrictions, scores 100 (no conflict). Default when no preference data: 70.

#### 3.2.6 Language Score (语言沟通) — 4%

- Uses `preferredLanguages` from event pool registration
- Binary scoring: any shared language → 100; no overlap → 30; one/both missing → 70 (default)
- **Scope: pair-level only.** Language is intentionally kept as a lightweight pair signal (4%). Group-level social dynamics are captured by Energy Balance (§4.1) which uses archetype energy, not language.
- Low discriminative power in current Mandarin-dominant pools — retained as a safety net for genuine multilingual mismatches.

#### 3.2.7 Semantic Similarity Score (语义相似度) — 6% *(feature-flagged)*

> Active only when `ENABLE_SEMANTIC_SIMILARITY=true`. Disabled path is identical to 6D scoring.

**Purpose:** Captures semantic proximity that categorical matching misses — two users whose
interests share no tagged topic but are conceptually adjacent (e.g., "探索本地文化" vs "发现城市角落宝藏")
will have similar hash-embedded vectors.

**Implementation file:** `apps/server/src/matchingSemantic.ts`

**Profile inputs (deterministic — no AI signals):**

| Field | Weight | Source |
|-------|--------|--------|
| `archetype` | 2.5 | `users` |
| `secondaryArchetype` | 1.25 | `users` |
| `workMode` | 1.5 | `users` |
| `educationLevel` | 1.25 | `users` |
| `industryNiche` | 1.25 | `users` |
| `hometown` | 0.75 | `users` |
| `preferredLanguages[]` | 0.75 each | registration |
| `eventIntent[]` / `userIntent[]` | 1.0 each | registration / `users` |
| `barThemes[]` | 0.75 each | registration (酒局 events only) |
| `alcoholComfort[]` | 0.5 each | registration (酒局 events only) |
| Top-10 interest topics | 1.0 – 2.0 heat-scaled | `user_interests` |

> **Signal boundary:** `user_interest_signals` is **never** read. This invariant is shared with
> the interest score boundary (`interestSignalBoundary.test.ts`).

**Vector construction:** 64-dimension feature-hashing vector. Each token is hashed to a primary
and secondary bucket with 2:1 weighting, then L2-normalised.

**Cosine similarity → score mapping:**
```
similarity ∈ [0, 1] (cosine)
semanticScore = clamp(35 + similarity × 65, 35, 100)
```

**Fallback values:**

| Condition | Score | Notes |
|-----------|-------|-------|
| Both profiles **absent from cache** | 50 (neutral) | User data not available at matching time |
| One profile **absent from cache** | 45 (slight penalty) | Asymmetric data — partial comparison |
| Both profiles **present but empty** (zero weighted features after construction) | 50 (neutral) | User exists but has no scoreable profile fields |
| One profile **present but empty** | 45 (slight penalty) | One side has no scoreable features |

**Weight shift:** When semantic scoring is enabled, existing weights are reduced conservatively:

| Dimension | 6D weight | 7D weight | Change |
|-----------|-----------|-----------|--------|
| chemistry | 28% | 26% | −2% |
| interest | 28% | 26% | −2% |
| socialAffinity | 20% | 19% | −1% |
| backgroundDiversity | 15% | 14% | −1% |
| preference | 5% | 5% | 0% |
| language | 4% | 4% | 0% |
| **semanticSimilarity** | — | **6%** | +6% |

Maximum score shift from enabling: ≤3.9 points (6% weight × 65-point semantic score range). Observed pair-score deltas typically fall in the 1–4 point range, bounded by the weight redistribution across dimensions.

**Admin visibility:** Metrics are exposed via:
- Admin dashboard `/admin` → 🧠 语义匹配观测 card (average score, pair-delta range, flag status)
- Prometheus endpoint `GET /api/metrics` → `joyjoin_matching_semantic_similarity_score` histogram
  and `joyjoin_matching_semantic_pair_score_delta` histogram

**Semantic profile document** (generated via `userSemanticProfileService.ts`): Neutral embedding document stripped to unique free-text fields not already scored by existing dimensions. Only `bio`, `socialTag`, `favoriteRestaurantReason`, and top/deep interest labels are included. Archetype, city, education, industry, workMode, hometown, languages, intent, and table vibe are excluded (already measured with higher precision by specialized dimensions).

### 3.2.8 Match History Anti-Repetition (Hard Constraint)

When `matchHistory` records exist for a user pair:

- **`wouldMeetAgain === false`**: The pair is hard-skipped — `calculatePairScore` returns `-1` (sentinel). `calculateGroupPairScore` excludes `-1` scores from averaging. The greedy seed selection naturally places these pairs at the bottom of the sorted list.
- **`wouldMeetAgain === true`**: A flat **+5 bonus** is applied to the pair score — capped at 100.

This operates as a pre-filter and post-bonus alongside the 6D/7D weighted scoring. It does not change dimension weights.

### 3.3 Adaptive Weights (Feature-Flagged Thompson Sampling)

> Active only when `ENABLE_ADAPTIVE_WEIGHTS=true`. Disabled path uses static weights from §3.1.

**File:** `apps/server/src/matchingSemantic.ts`, `apps/server/src/matchingWeightsService.ts`

**Purpose:** Uses Thompson Sampling (Beta-distribution bandit) to dynamically adjust pair-scoring dimension weights based on post-event outcome data. Weights are bounded to move no more than 3% per update cycle.

**How it works:**

1. `matchingWeightsService.getActiveWeights()` returns the latest bandit-selected weights (cached, 60s TTL).
2. `matchEventPool()` fetches these weights once per matching run when the flag is ON.
3. `calculateWeightedPairScore()` accepts an optional `customWeights` parameter; when present, it overrides hardcoded defaults.
4. Weights are consumed in percentage form (e.g., `chemistryWeight: 28`) and normalized to decimals at runtime.
5. If weight fetch fails, the system falls back to hardcoded defaults without crashing.

**Weight key format (supports both naming conventions for backward compatibility):**

| Key (long) | Key (short) | Default |
|---|---|---|
| `chemistryWeight` | `chemistry` | 28 |
| `interestWeight` | `interest` | 28 |
| `socialAffinityWeight` | `socialAffinity` | 20 |
| `backgroundDiversityWeight` | `backgroundDiversity` | 15 |
| `preferenceWeight` | `preference` | 5 |
| `languageWeight` | `language` | 4 |

**Cache key:** Pair score caches include `|adaptive` segment only when custom weights are active, preserving backward compatibility with pre-populated caches.

**Rollback:** Set `ENABLE_ADAPTIVE_WEIGHTS=false`, restart server. No DB migration required.

---

## 4. Layer 3 — Group Formation Algorithm

**File:** `apps/server/src/poolMatchingService.ts`  
**Function:** `matchEventPool(poolId): Promise<MatchGroup[]>`

### 4.1 Group Score Formula

```typescript
overallScore = round(
  avgPairScore         × 0.60 +   // Pair compatibility (similarity)
  diversityScore       × 0.25 +   // Group diversity (richness)
  communicationBalance × 0.15     // Energy balance (social dynamics harmony)
)
```

#### Group Diversity Score Components

Evaluates 4 diversity axes equally weighted:
```typescript
diversityScore =
  (uniqueIndustries / groupSize) × 25 +
  (uniqueGenders    / groupSize) × 25 +
  (uniqueArchetypes / groupSize) × 25 +
  (uniqueLifeStages / groupSize) × 25
// Clamped to [0, 100]
```

#### Energy Balance Score (能量平衡)

Measures whether the group has a healthy distribution of social energy levels, using
`ARCHETYPE_ENERGY` constants from `apps/server/src/archetypeChemistry.ts`.

Two equally-weighted components:

| Component | Ideal | Penalty |
|-----------|-------|---------|
| **avgScore** — mean energy of group | 50–70 (energised but not chaotic) | −2 pts per unit outside ideal band |
| **harmonyScore** — energy std deviation | stdDev ≤ 20 (natural mix) — no penalty | −2.5 pts per SD unit beyond 20 |

```typescript
// Energy lookup (from ARCHETYPE_ENERGY in archetypeChemistry.ts):
// 气氛组柯基: 95, 情绪稳定鸡: 90, 捧场王仓鼠: 85, 探宝雷达狐: 82,
// 读空气海豚: 75, 社交裁缝蛛: 72, 情绪树洞考拉: 70, 脑洞喷泉章鱼: 68,
// 追问猫头鹰: 55, 定海神针大象: 52, 慢半拍龟: 38, 静音模式猫: 30

avgScore     = avgEnergy in [50,70] ? 100 : max(0, 100 − |avgEnergy − nearest boundary| × 2)
harmonyPenalty = max(0, stdDev − 20)   // no penalty for natural spread (stdDev ≤ 20)
harmonyScore = max(0, 100 − harmonyPenalty × 2.5)
energyBalance = round((avgScore + harmonyScore) / 2)
```

**Why this matters:**
- All-high-energy groups (4× 气氛组柯基/情绪稳定鸡): exhausting, loud, everyone talking at once
- All-low-energy groups (4× 慢半拍龟/静音模式猫): awkward silences, low engagement
- Ideal mix: 1–2 energisers (气氛组柯基/情绪稳定鸡) + 2–3 mid-range + 1 anchor (定海神针大象/慢半拍龟)

> **DB note:** Stored in `event_pool_groups.energy_balance` (integer column). The TypeScript interface field `communicationBalance` maps to this column — the name is a legacy alias from a prior renaming.

### 4.2 Algorithm Steps

```
1. LOAD pool config + all pending registrations
2. JOIN user profiles (archetype, interests, workMode, education, etc.)
3. FILTER by hard constraints → eligibleUsers[]
4. BUILD invitation pairs map (inviter–invitee relationships)
5. COMPUTE all N×(N-1)/2 pair scores
   - Invitation-linked pairs get a score bonus (+boost)
   - Sort descending by score
6. GREEDY GROUP FORMATION:
   a. Take highest-scoring unpaired pair as group seed
   b. Iteratively add best-fit candidate:
      - Score = avg(pairScore(candidate, existing_members))
      - Minimum quality threshold: avgScore ≥ 60
   c. Stop when targetGroupSize reached or no candidate ≥ 60
   d. Only commit group if size ≥ minGroupSize
7. REPEAT until targetGroups reached or pool exhausted
8. SCORE each final group (avgPairScore, diversity, commBalance, overall)
9. SAVE results → DB
10. PROCESS invitation rewards for matched pairs
```

### 4.3 Pool Configuration Parameters

| Parameter | Field | Description |
|-----------|-------|-------------|
| Target group size | `pool.maxGroupSize` | Default: 6 |
| Minimum group size | `pool.minGroupSize` | Default: 4 |
| Target group count | `pool.targetGroups` | Stops formation when reached |
| Member quality gate | hardcoded `≥ 60` | Minimum avg pair score to add candidate |

### 4.4 MatchGroup Output Shape

```typescript
interface MatchGroup {
  members: UserWithProfile[];
  avgPairScore: number;         // Mean of all pair compatibility scores
  avgChemistryScore: number;    // Mean of chemistry sub-scores only
  diversityScore: number;       // Group diversity (4-axis)
  communicationBalance: number; // Energy balance score (0-100) — social energy distribution health
  overallScore: number;         // Weighted composite (60/25/15)
  temperatureLevel: string;     // Qualitative label from overallScore
}
```

### 4.5 Redistribution Pass (Adaptive Weights Only)

> Executed only when `ENABLE_ADAPTIVE_WEIGHTS=true` and custom weights were successfully fetched.

After the greedy formation completes, some users may remain unmatched (stranded). The redistribution pass attempts to place them in three phases:

**Phase 1 — Fill existing groups:**
- Collect stranded users (not assigned to any group).
- For each stranded user, score against all existing groups with `members.length < maxGroupSize`.
- Place into the best-fitting group if average pair score ≥ 50.
- Recalculate group stats after each placement.

**Phase 2 — Form remainder groups:**
- If remaining stranded users ≥ `minGroupSize`, form new group(s) from them using the same greedy logic.
- Only commit if the new group meets the `minGroupSize` threshold.

**Phase 3 — Absorb singleton overflow:**
- If stranded users < `minGroupSize` (i.e., 1–3 users left), find the best-fitting existing group.
- Allow one member overflow (up to `maxGroupSize + 1`) to absorb the stranded user(s).
- This prevents leaving users unmatched while keeping group sizes reasonable.

**Rationale:** The adaptive-weights path can produce different group boundaries than the static-weight path, sometimes leaving high-quality users stranded. The redistribution pass is a safety net — it does not lower the quality threshold (min score 50) but allows flexible group sizing to capture good matches that the initial greedy pass missed.

---

## 5. Supporting Matrices & Data

### 5.1 Chemistry Matrix

**Source of truth:** `packages/shared/src/personality/archetypeCompatibility.ts`  
**Server usage:** `apps/server/src/archetypeChemistry.ts` (imports from shared)  
**Shape:** 12×12 symmetric matrix, scores 0–100

Score bands:
| Range | Label |
|-------|-------|
| 90–100 | 最佳搭档 (Perfect complement) |
| 70–89 | 好搭档 (Good match) |
| 50–69 | 可搭档 (Moderate) |
| 30–49 | 需要磨合 (Challenging) |
| 0–29 | 差异较大 (High conflict risk) |

### 5.2 Life Stage Affinity Matrix (7×7, Asymmetric)

**Location:** `LIFE_STAGE_AFFINITY` constant in `poolMatchingService.ts`  

Sample values (row = user1, col = user2 — score reflects how much row wants to meet col):
```
founder    →  founder: 90,  self_employed: 80,  employed: 60,  student: 40
successor  →  founder: 85,  successor: 90,  employed: 55,  student: 45
```

Final pair score = `(matrix[a][b] + matrix[b][a]) / 2`

### 5.3 Archetype Energy Levels

**Source:** `ARCHETYPE_ENERGY` constant in `apps/server/src/archetypeChemistry.ts`  
**Used by:** `calculateEnergyBalance()` in `poolMatchingService.ts` — feeds the 15% group-level energy balance component of `overallScore`

| Archetype | Energy | Band |
|-----------|--------|------|
| 气氛组柯基 | 95 | Very High |
| 情绪稳定鸡 | 90 | Very High |
| 捧场王仓鼠 | 85 | High |
| 探宝雷达狐 | 82 | High |
| 读空气海豚 | 75 | Medium-High |
| 社交裁缝蛛 | 72 | Medium-High |
| 情绪树洞考拉 | 70 | Medium |
| 脑洞喷泉章鱼 | 68 | Medium |
| 追问猫头鹰 | 55 | Low-Medium |
| 定海神针大象 | 52 | Low-Medium |
| 慢半拍龟 | 38 | Low |
| 静音模式猫 | 30 | Very Low |

Ideal group mean energy: **50–70** (balanced, energised but not chaotic).  
Default fallback when archetype is missing: **60** (mid-range neutral).

### 5.4 Bounded Empirical Chemistry Calibration

**File:** `apps/server/src/archetypeChemistryCalibration.ts`

The chemistry calibration layer applies a small, evidence-bounded correction to archetype-pair base scores based on aggregated post-event outcome data. It is designed to converge cautiously — never overwriting hand-authored matrix values with raw empirical averages.

**How it works:**

1. After events, users submit outcomes through the protected `event_group_outcomes` route using payload fields such as `wouldMeetAgain` and `atmosphereScore`.
2. The chemistry calibration aggregation reads from `match_history` (`would_meet_again`, `connection_quality`) and rolls those results up per archetype pair into `archetype_pair_feedback_stats`.
3. If a pair has **≥ 30 samples**, an empirical chemistry score is computed:
   ```
   empiricalScore = (avgWouldMeetAgain × 60) + ((avgConnectionQuality − 1) / 4 × 40)
   ```
4. The calibrated score applies a dampened delta (factor: 0.05) capped to ±2 points:
   ```
   appliedDelta = clamp(
     (empiricalScore − baseScore) × DAMPENING_FACTOR,   // 0.05
     −CHEMISTRY_CALIBRATION_MAX_DELTA,                  // −2
     +CHEMISTRY_CALIBRATION_MAX_DELTA                   // +2
   )
   calibratedScore = clamp(baseScore + appliedDelta, 10, 100)
   ```
5. With fewer than 30 samples, the base score is returned unchanged (`hasSufficientSamples = false`).

**Constants:**

| Constant | Value | Meaning |
|---|---|---|
| `CHEMISTRY_CALIBRATION_MIN_SAMPLES` | 30 | Minimum samples before calibration applies |
| `CHEMISTRY_CALIBRATION_MAX_DELTA` | 2 | Hard cap: empirical correction cannot exceed ±2 points |
| `CHEMISTRY_CALIBRATION_DAMPENING_FACTOR` | 0.05 | Slows convergence — requires persistent evidence to move the score |

**Admin visibility:** The admin dashboard exposes a chemistry calibration inspection panel showing per-pair breakdown (`baseScore`, `empiricalScore`, `appliedDelta`, `calibratedScore`, `sampleCount`) for all 78 archetype pairs (including same-archetype pairs).

**Cache:** The calibration map is cached in-process with a 5-minute TTL. Concurrent requests share a single in-flight refresh (`inFlightRefresh` guard).

---

## 6. Hard Constraints (Pre-filter)

Applied in `meetsHardConstraints()` before any scoring.  
Users failing constraints are excluded from pool matching entirely.

Current hard constraints include:
- **Budget range** (L1 hard constraint — added 2025)
- Pool-level gender / industry / seniority restrictions (if configured)
- Registration status must be `"pending"`

---

## 6.5 AI Group Analysis

After groups are formed and saved, an AI analysis surface provides human-readable compatibility explanations.

### 6.5.1 Shared Contract

**File:** `packages/shared/src/types/groupAnalysis.ts`  
**Import:** `import type { GroupAnalysisResponse } from '@shared/types/groupAnalysis'`

```typescript
interface GroupAnalysisResponse {
  groupId: string;
  overallChemistry: 'fire' | 'warm' | 'mild' | 'cold';  // mean chemistryScore: fire≥85, warm≥70, mild≥55, cold<55
  groupDynamics: string;                 // 1-2 sentence prose description of the group dynamic (Chinese)
  pairExplanations: PairExplanation[];   // one per user pair (sorted pairKey)
  iceBreakers: string[];                 // 3-5 personalised conversation starters
  fromCache: boolean;                    // true if served from cached analysis
  generatedAt: string;                   // ISO-8601 timestamp of last generation
  myPairs?: PairExplanation[];           // optional: pairs involving the requesting user
}

interface PairExplanation {
  pairKey: string;          // sorted([userId1, userId2]).join('-')
  explanation: string;      // 2-3 sentence warm personalised explanation (Chinese)
  chemistryScore: number;   // 0-100, from chemistry matrix (deterministic)
  sharedInterests: string[];
  connectionPoints: string[];
}
```

### 6.5.2 API Endpoint

```
GET /api/pool-groups/:groupId/analysis
Authorization: requireAuth
```

- Returns `GroupAnalysisResponse` immediately from cache after the first generation (7-day TTL per group roster)
- On cache miss: calls `generateGroupAnalysis()` in `matchExplanationService.ts`, which fans out pair explanation calls and generates icebreakers in parallel via `socialModelRouter` (MiniMax preferred, DeepSeek fallback)
- Rate limited via `aiEndpointLimiter`

### 6.5.3 Client Surfaces

| Surface | File | How it uses group analysis |
|---|---|---|
| `useGroupAnalysis` hook | `apps/user-client/src/hooks/useGroupAnalysis.ts` | TanStack Query wrapper for the `/analysis` endpoint; returns `{ data, isLoading }` |
| `PostMatchEventCard` | `apps/user-client/src/components/PostMatchEventCard.tsx` | Rich AI analysis panel showing pair explanations, icebreakers, group dynamics |
| `SquadUnboxingFlow` | `apps/user-client/src/pages/SquadUnboxingFlow.tsx` | Cinematic progressive reveal: member cards → chemistry score → pair explanations → icebreakers |

### 6.5.4 SquadUnboxingFlow Reveal Sequence

`SquadUnboxingFlow` (route: accessed from group detail) delivers a cinematic squad reveal:

1. **Member reveal** — member archetype cards animate in one by one
2. **Chemistry reveal** — overall chemistry level shown with temperature label
3. **Pair explanation reveal** — each pair explanation fades in sequentially
4. **Icebreaker reveal** — personalised conversation starters presented as swipeable cards
5. **Share/action CTA** — group share or event registration prompt

The flow uses `useGroupAnalysis` to poll the `/analysis` endpoint and waits for data before advancing beyond the loading state.

---

## 6.7 Predictive Reranking Experiment

**File:** `apps/server/src/predictiveRerankingService.ts`  
**Status:** Experimented — supports both shadow-only (control) and gated live reranking (treatment) depending on configuration and experiment arm.

### What it does

After `poolMatchingService.ts` forms groups deterministically, the predictive reranking service evaluates an alternate ordering decision:

1. Computes a predicted outcome score for each group in-process via `buildMatchingShadowExperiment(groups, calibration)`; it does **not** read predictions from `matching_shadow_experiments`.
2. Attempts to reorder groups so higher predicted-outcome groups appear earlier, subject to confidence thresholds and `predictiveRerankMaxPositionShift`.
3. Returns `PredictiveRerankDecision.groups`; `poolRealtimeMatchingService.ts` always assigns `groups = predictiveDecision.groups` before persistence.
4. In the **control / shadow** path (feature disabled, pool ineligible, confidence too low, auto-disabled, or assigned control arm), the returned order stays deterministic and only the summary / audit metadata is persisted alongside matched groups.
5. In the **treatment** path, bounded live reranking can change the persisted group order before `saveMatchResults()` writes the final `event_pool_groups` rows.

### Experiment design

| Concept | Value |
|---|---|
| Rollout pool (tri-state override) | `event_pools.predictive_rerank_enabled_override`: `true` = force-eligible, `false` = disabled, `null` = follow global config |
| Exposure percent | Configurable — pool-level hash bucket determines arm assignment (`control` vs `treatment`) |
| Max position shift | Configurable — bounds how far a group's rank may move from the deterministic baseline |
| Confidence threshold | Configurable — predictions below threshold stay on the deterministic order even in treatment |
| Auto-disable | Automatically disables treatment if treatment positive rate falls > 5 pp below control |

### Admin visibility

- `GET /api/admin/predictive-rerank-status` — shadow pool count, outcome metrics, current config
- `GET /api/admin/matching-shadow-experiments` — paginated experiment records
- Domain module: `apps/server/src/routes/domains/adminMatchingShadow.ts`

---

| File | Role |
|------|------|
| `packages/shared/src/personality/matcherV2.ts` | Personality archetype assignment algorithm |
| `packages/shared/src/personality/adaptiveEngine.ts` | V4 adaptive quiz engine |
| `packages/shared/src/personality/secondaryQuestionMap.ts` | Maps closing question answers → `UserSecondaryData` fields |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Chemistry matrix (single source of truth) |
| `packages/shared/src/personality/prototypes.ts` | Archetype prototype trait profiles |
| `packages/shared/src/types/groupAnalysis.ts` | `GroupAnalysisResponse` shared contract |
| `apps/server/src/poolMatchingService.ts` | Pair scoring + group formation (primary matching service) |
| `apps/server/src/poolRealtimeMatchingService.ts` | Realtime + scheduled pool scan orchestration (`scanPoolAndMatch`) |
| `apps/server/src/archetypeChemistry.ts` | Server-side chemistry helpers (imports from shared) |
| `apps/server/src/archetypeChemistryCalibration.ts` | Bounded empirical chemistry calibration (±2 pts, ≥30 samples required) |
| `apps/server/src/matchingSemantic.ts` | Feature-flagged 7th scoring dimension — 64-dim feature-hash vector + cosine similarity |
| `apps/server/src/matchingMetrics.ts` | Matching-specific Prometheus metrics (`joyjoin_matching_semantic_similarity_score`, `joyjoin_matching_semantic_pair_score_delta`) |
| `apps/server/src/embeddingClient.ts` | Embedding API client (OpenAI preferred / DeepSeek fallback) for async semantic profile pipeline |
| `apps/server/src/predictiveRerankingService.ts` | Predictive reranking A/B experiment; primarily shadow, but under gated config realtime matching can apply reordered groups to live ordering |
| `apps/server/src/matchExplanationService.ts` | AI pair explanations + icebreakers + `generateGroupAnalysis()` |
| `apps/user-client/src/hooks/useGroupAnalysis.ts` | Client hook for `GET /api/pool-groups/:groupId/analysis` |
| `apps/server/src/userMatchingService.ts` | Legacy 6-dimensional user matching (used for admin lab / older flows) |
| `apps/server/src/personalityMatchingV2.ts` | V8 hybrid (Euclidean + cosine) scoring utilities |
| `apps/admin-client/src/pages/admin/AdminMatchingLabPage.tsx` | Admin UI for testing matching weights |
| `apps/admin-client/src/pages/PoolGroupDetailPage.tsx` | Group result visualization |
| `docs/architecture/connection-points-system.md` | Unified architecture doc for 契合点系统 (connection points + spark predictions) |

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Pair score** | 6- or 7-dimensional compatibility score (0–100) between two users. 6D is the default; 7D is enabled when `ENABLE_SEMANTIC_SIMILARITY=true`. Adaptive weights (Thompson Sampling) further customize dimension weights when `ENABLE_ADAPTIVE_WEIGHTS=true`. |
| **Chemistry score** | Archetype-to-archetype compatibility from the 12×12 matrix; may be adjusted by bounded empirical calibration (±2 pts) |
| **Social affinity** | Same-frequency resonance signals (life stage + education + hometown) |
| **Background diversity** | Rewards different industry & gender within a pair |
| **avgPairScore** | Mean of all pairwise pair scores within a group |
| **overallScore** | Weighted group quality: avgPairScore×0.6 + diversity×0.25 + commBalance×0.15 |
| **MatcherV2** | The archetype assignment algorithm using weighted Manhattan distance + veto rules |
| **primaryArchetype** | The top-matching archetype for a user (used at 70% weight in chemistry) |
| **secondaryArchetype** | The second-best archetype (used at 15% weight in chemistry cross-scoring) |
| **Heat level** | Interest intensity: level 1 (heat=5), level 2 (heat=10), level 3 (heat=25) |
| **Life stage** | User's `workMode` value — the "人生阶段" used in social affinity scoring |
| **Hard constraint** | Pre-filter rule that excludes a user from a pool entirely (e.g. budget mismatch) |
| **Soft signal** | Scoring dimension that influences rank but never blocks a match (e.g. language, preference) |
| **communicationBalance** | Field name in `MatchGroup` interface and DB alias for `energy_balance` column. Currently stores the Energy Balance score (social energy distribution) — name is a legacy alias. |
| **energyBalance** | Group-level score (0–100) measuring health of social energy distribution using `ARCHETYPE_ENERGY`. Replaces the former language-based `communicationBalance` calculation. |
| **ARCHETYPE_ENERGY** | Constant in `archetypeChemistry.ts` mapping all 12 archetypes to social energy levels (30–95). Used by `calculateEnergyBalance()`. |
| **UserSecondaryData** | Non-trait differentiators (`conflictPosture`, `motivationDirection`) assembled from closing question answers and fed to the V2 Matcher tiebreaker. Only `conflictPosture` is actively captured via `Q_PLAYFUL_EMOJI`. |
| **SECONDARY_QUESTION_MAP** | Lookup table in `secondaryQuestionMap.ts` mapping closing question IDs and answer values to `UserSecondaryData` fields. `Q_PLAYFUL_SLIDER` is absent — it is trait-scoring only. |
| **GroupAnalysisResponse** | Shared TypeScript contract for the AI group analysis returned by `GET /api/pool-groups/:groupId/analysis`. Includes pair explanations, icebreakers, `groupDynamics` summary, overall chemistry level, and cache metadata (`fromCache`, `generatedAt`, optional `myPairs`). |
| **conflictPosture** | Secondary differentiator with values `approach` / `mediate` / `avoid`, derived from `Q_PLAYFUL_EMOJI` answer. Used in `secondaryBonus` tiebreaker step of MatcherV2. |
| **semanticSimilarity** | Feature-flagged 7th pair-scoring dimension. 64-dim feature-hash vector built from deterministic profile fields + interest topics; L2-normalised; cosine similarity mapped to [35, 100]. Active only when `ENABLE_SEMANTIC_SIMILARITY=true`. |
| **user_semantic_profiles** | DB table storing neural embedding-based semantic profiles for the async similarity pipeline. Kept in sync when a user's profile fields or interest heat changes. Not yet consumed by live pair scoring, which currently builds in-memory feature-hash profiles. |
| **empirical chemistry calibration** | Post-event feedback-bounded correction applied to archetype-pair chemistry scores. Delta is capped to ±2 points with a 0.05 dampening factor; only applied when ≥30 outcome samples are available for a pair. |
| **predictive reranking** | A/B experiment that always computes an alternate ordering, persists audit metadata with matched groups, and can apply bounded live reordering only when the feature is enabled, the pool is eligible, and the pool falls into the treatment arm. |
| **event_group_outcomes** | DB table capturing per-member post-event outcome submissions (`wouldMeetAgain`, `atmosphereScore`, `connectionRadar`). Feeds admin outcome analytics directly and informs downstream outcome datasets used by chemistry calibration. |
