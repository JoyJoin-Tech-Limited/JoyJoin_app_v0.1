# JoyJoin Matching Algorithm Reference

> **Status:** Living document — last updated 2026-07-09  
> **Scope:** Covers all three matching layers: (1) Personality archetype assignment, (2) Pair compatibility scoring, (3) Group formation.
>
> **命名（2026-08-03）：** 匹配算法系统的内部工程名称为 **磁场引擎（Magnetism Engine）**；配对分 = **同频指数（Resonance Index）**；后置加成族 = **缘分加成**（双向 romance +5 子名 **引力加成**）；用户侧可视化为同频雷达。桥接线：磁场是看不见的因，同频是遇见时的果，缘分是算不出来的那一部分。命名体系、 uplift 路线图与命名纪律见 [`MAGNETISM_ENGINE.md`](./MAGNETISM_ENGINE.md)。代码标识符不重命名。

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
| 社牛柯基 | 🐕 | Very High | High X + High A |
| 小太阳鸡 | 🐔 | Very High | High X + High P |
| 夸夸仓鼠 | 🐹 | High | High A + High O |
| 寻宝狐 | 🦊 | High | High O + High C |
| 机灵海豚 | 🐬 | Medium | Balanced, High E |
| 人脉蛛 | 🕷 | Medium | High C + High O |
| 树洞考拉 | 🐨 | Medium-Low | High A + High E |
| 脑洞章鱼 | 🐙 | Medium | High O, creative burst |
| 好奇猫头鹰 | 🦉 | Low-Medium | High C + High O, introspective |
| 靠谱大象 | 🐘 | Low-Medium | High A + High E, stabilizer |
| 慢热龟 | 🐢 | Low | High P + High E |
| 小透明猫 | 🐱 | Very Low | Low X, quiet companion |

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

For traits flagged as `avoid` in `PROTOTYPE_SOUL_TRAITS`, violations are penalised more harshly to prevent cross-pole mismatches (e.g. very high X should block 小透明猫).

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
| 0 | Opposite-pole conflict gate | Disqualifies archetypes that are a qualitative mismatch (e.g. max-extraversion user → block 小透明猫) |
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
  (The former vibeVector 5D cosine blend was removed 2026-08: it was a dead branch — no production
  writer of `users.vibeVector`, and bot/test writers used mismatched keys. Chemistry is now the
  archetype blend only.)

```typescript
chemistry =
  CHEMISTRY_MATRIX[primary1][primary2]   × 0.70
+ CHEMISTRY_MATRIX[primary1][secondary2] × 0.15
+ CHEMISTRY_MATRIX[secondary1][primary2] × 0.15
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

Heat levels: `3` (level 1 / casual), `10` (level 2 / active), `25` (level 3 / passionate)

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
> icebreaker topic generation prompts). See `docs/systems/interest-signal-boost.md` for full details.

**Interest model note:** Temporal heat decay was evaluated and rejected. The active model uses **stable declared interests** kept fresh by two explicit mechanisms: (1) an editable interest carousel at `/profile/edit/interests` (`EditInterestsCarouselPage`), and (2) a post-event interest nudge step in `EventFeedbackFlow` that bumps heat for relevant topics. `user_interests.updated_at` reflects intentional engagement, not time since signup. See `docs/ai/AI_INTEGRATION_PLAN.md §2.2` for rationale.

#### 3.2.3 Social Affinity Score (社交同频度) — 20%

Average of up to 3 sub-signals (equal weight per present factor):

| Sub-signal | Source | Notes |
|-----------|--------|-------|
| Life stage affinity | `LIFE_STAGE_AFFINITY` 5×5 matrix | Asymmetric — averaged both directions |
| Education affinity | Ordinal distance (`EDUCATION_ORDINAL`) | Piecewise: distance 0/1/2/≥3 → 100/75/50/25 |
| Hometown affinity | `hometownRegionCity` matching | Only when **both** users opt in (`hometownAffinityOptin = true`) |
| Age preference affinity | `ageMatchPreference` | Same = 100, "都可以" compatible = 75, complementary ("偏年轻"+"偏成熟") = 70, conflicting = 40 |
| Table vibe affinity | `tableVibePreference` | Same = 100, compatible (light_fun+natural_chat) = 75, deep_talk+natural_chat = 65, clash (deep_talk+light_fun) = 30 |

**Life Stage Matrix keys:** `学生党`, `职场新人`, `职场老手`, `创业中`, `自由职业`

**Age preference values:** `同龄人`, `偏年轻`, `偏成熟`, `都可以`

**Table vibe values:** `light_fun`, `natural_chat`, `deep_talk`

**Life Stage Matrix keys:** `学生党`, `职场新人`, `职场老手`, `创业中`, `自由职业`

**Education Ordinal:**
```
高中及以下 = 0
中专 = 1 (same tier as 大专)
大专 = 1
本科 = 2
硕士 = 3
博士 = 4
```

**Scoring formula (piecewise, not linear −20 per step):**
```
distance = |ord1 − ord2|
distance = 0 → 100 (same level)
distance = 1 → 75
distance = 2 → 50
distance ≥ 3 → 25
```

**Note:** Education is an *affinity* signal (same/nearby = better) — it is explicitly **not** a diversity signal. 中专 and 大专 are treated as the same tier (distance = 0) because they represent parallel vocational/associate tracks at a comparable academic level.

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
| `lifeStage` | 1.5 | `users` |
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

### 3.2.9 Mutual Romance Tension Bonus (2026-08-03)

When **both** pair members indicated the `romance` intent (via `eventIntent` → `userIntent` fallback), a flat **+5 bonus** is applied to the pair score — post-weight additive, capped at 100, same pattern as the `wouldMeetAgain` bonus. One-sided romance receives nothing; dimension weights are unchanged. Rationale: JoyJoin is activity-first but not romance-blind — mutual romantic openness is allowed to add "一点浪漫张力" without turning the pipeline into a dating matcher. Decision trail: `docs/deliberations/2026-08-03-romance-intent-option-reinstatement.md`.

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

### 3.4 Weight Profile V2 (Feature-Flagged, 2026-08-03 惊艳开局包)

**Flag:** `magnetismWeightProfileV2Enabled` (env `MAGNETISM_WEIGHT_PROFILE_V2_ENABLED`, default `false`). When off, v1 tables are used and scoring is byte-identical to before. Adaptive `customWeights` and Match Compass strictness weights still short-circuit ahead of the default table; partial `customWeights` missing-key fallbacks stay pinned to **v1** values (the bandit was tuned against v1).

| Dimension | 6D v1 | 6D v2 | 7D v1 | 7D v2 | Rationale |
|---|---|---|---|---|---|
| chemistry | 28 | **20** | 26 | **19** | Hand-authored prior without empirical validation (Finkel et al. 2012) |
| interest | 28 | **32** | 26 | **30** | Strongest evidence leg (Montoya et al. 2008, r=.47) + 搭子 precision |
| socialAffinity | 20 | **23** | 19 | **21** | Homophily (McPherson et al. 2001) |
| backgroundDiversity | 15 | 15 | 14 | 14 | Optimal-distinctiveness "spice", unchanged |
| preference | 5 | 5 | 5 | 5 | Unchanged |
| language | 4 | **5** | 4 | **5** | Dialect/Mandarin comfort hygiene factor |
| semanticSimilarity | — | — | 6 | 6 | Unchanged |

Both v2 tables sum to 100 (test-locked in `matchingWeightProfiles.test.ts`). Pair-score cache keys gain a `|v2` segment when active so v1/v2 runs never cross-read.

### 3.5 Group Composition Rules (Feature-Flagged, 2026-08-03 惊艳开局包)

**Flag:** `magnetismGroupRulesEnabled` (env `MAGNETISM_GROUP_RULES_ENABLED`, default `false`). When off, formation is behavior-identical. Theory-first rules (no data dependency); see `docs/systems/MAGNETISM_ENGINE.md` for the psychological grounding.

- **R1 无孤立者 (no-isolate)** — commit gate: every member must have ≥1 intra-group pair score ≥ 60 (the system's existing "compatible" bar). Groups failing are rejected and members released (standard release path).
- **R2 能量编排 (energizer presence)** — commit gate: ≥1 member with `ARCHETYPE_ENERGY ≥ 75` (corgi 95 / rooster 90 / hamster_praise 85 / fox 82 / dolphin_calm 75). Pool-level exemption: skipped entirely when no eligible user in the pool qualifies (prevents zero-formation deadlock).
- **R3 话题锚点 (topic anchor)** — commit gate, skipped when any member has empty interests (cold-start safety): pass if some macro category has ≥1 topic from EVERY member, OR some single topic is shared by ≥ ⌈n/2⌉ members (any heat).
- **R4 新奇分散 (novelty dispersion)** — expansion ranking only: a candidate with `explore` intent joining a group that already has an explore-intent member gets −8 to their ranking score (argmax nudge, not a ban; cached pair scores untouched).

**Enforcement points (2026-08-03 fix):** R1–R3 are evaluated by `magnetismRulesSatisfiedFor()` in `runGreedyPoolMatchingCore` at the formation commit gate **and again in all three §4.5 redistribution phases** — every candidate placement into an existing group (fill / absorb-singleton-overflow) and every remainder-group commit is checked before acceptance. Redistribution itself runs only when `hasExplicitCustomWeights || allowOverflow` (adaptive weights or Match Compass strictness ≤ 0); when the flag is off the helper returns `true` unconditionally, so default behavior is byte-identical.

Validation: synthetic-pool dual-run (rules on vs off, fresh caches) in `magnetismDualRun.test.ts`; promotion gate = formation-rate regression ≤15% with 100% rule conformance.

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
// 社牛柯基: 95, 小太阳鸡: 90, 夸夸仓鼠: 85, 寻宝狐: 82,
// 机灵海豚: 75, 人脉蛛: 72, 树洞考拉: 70, 脑洞章鱼: 68,
// 好奇猫头鹰: 55, 靠谱大象: 52, 慢热龟: 38, 小透明猫: 30

avgScore     = avgEnergy in [50,70] ? 100 : max(0, 100 − |avgEnergy − nearest boundary| × 2)
harmonyPenalty = max(0, stdDev − 20)   // no penalty for natural spread (stdDev ≤ 20)
harmonyScore = max(0, 100 − harmonyPenalty × 2.5)
energyBalance = round((avgScore + harmonyScore) / 2)
```

**Why this matters:**
- All-high-energy groups (4× 社牛柯基/小太阳鸡): exhausting, loud, everyone talking at once
- All-low-energy groups (4× 慢热龟/小透明猫): awkward silences, low engagement
- Ideal mix: 1–2 energisers (社牛柯基/小太阳鸡) + 2–3 mid-range + 1 anchor (靠谱大象/慢热龟)

> **DB note:** Stored in `event_pool_groups.energy_balance` (integer column). The TypeScript interface field `communicationBalance` maps to this column — the name is a legacy alias from a prior renaming.

### 4.2 Algorithm Steps

```
1. LOAD pool config + all pending registrations
2. JOIN user profiles (archetype, interests, lifeStage, education, etc.)
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

### 4.2.1 Per-Pool Gender-Balance Enforcement (wired 2026-07-14)

Four previously inert `event_pools` columns are now live. `genderRestriction="女性"` (all-female) remains the strongest control; it implies balance mode `none` and disables the fields below.

| Mode (`genderBalanceMode`) | Effect |
|---|---|
| `none` | No gender logic (default for non-mixed pools) |
| `soft` (default) | Post-clamp bonus in `calculateGroupDiversity` for exact male/female balance, capped by `genderBalanceBonusPoints` (0–100). Group formation is never blocked. |
| `hard` | Floor gate: every committed group must contain ≥ `minFemaleCount` disclosed females and ≥ `minMaleCount` disclosed males (each 0–20, default 0). A group that fails its pool's floor is discarded and its members returned to the candidate pool. |

- Floors are **hard-mode-only**; soft mode never rejects a group.
- The floor is checked at the commit gate (step 6d) and again in **all three** redistribution phases (§4.5).
- Undisclosed gender (`preferNotToSay` / `保密`) counts toward **neither** floor and does not block exact-balance detection.
- Bonus is symmetric (1:1 target); there is no "reject for perfect balance" path.
- Operator surface: admin portal pool create/edit (`性别平衡` section). POST (`insertEventPoolSchema.extend`) and PATCH (`updateEventPoolSchema`) enforce identical enum/int-range validation; PATCH changes are audit-logged (`admin_audit_logs`).
- Decision trail: Sprint Contract `sprint_20260714_gender_ratio_enforcement` (`.git/.orchestration/sprints/`).

### 4.3 Pool Configuration Parameters

| Parameter | Field | Description |
|-----------|-------|-------------|
| Target group size | `pool.maxGroupSize` | Default: 6 |
| Minimum group size | `pool.minGroupSize` | Default: 4 |
| Target group count | `pool.targetGroups` | Stops formation when reached |
| Member quality gate | hardcoded `≥ 60` | Minimum avg pair score to add candidate |
| Gender balance mode | `pool.genderBalanceMode` | `none` / `soft` (default) / `hard` — see §4.2.1 |
| Gender bonus cap | `pool.genderBalanceBonusPoints` | Soft-mode bonus points, 0–100 |
| Gender floors | `pool.minFemaleCount` / `pool.minMaleCount` | Hard-mode minimums per group, 0–20 (default 0) |

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

> **Feature-gate interactions:** when `magnetismGroupRulesEnabled` is on, every Phase 1/Phase 3 placement and every Phase 2 commit is additionally checked against R1–R3 via `magnetismRulesSatisfiedFor()` (§3.5) — a placement that would break a rule is rejected and the stranded user stays in the pool. Hard-mode gender floors (§4.2.1) are likewise re-checked here, so redistribution can never bypass a commit gate the main pass enforces.

**Rationale:** The adaptive-weights path can produce different group boundaries than the static-weight path, sometimes leaving high-quality users stranded. The redistribution pass is a safety net — it does not lower the quality threshold (min score 50) but allows flexible group sizing to capture good matches that the initial greedy pass missed.

### 4.6 Operator Review Gate (Feature-Flagged)

> Active only when `matchingOperatorReviewEnabled` is `true`. Disabled path preserves the existing auto-match behavior.

When the operator-review gate is enabled, `poolMatchingService.ts` holds algorithmically formed groups in a pending operator-review state instead of immediately committing post-match side effects:

- `event_pools.operatorReviewStatus` is set to `pending`
- `event_pool_groups.operatorReviewStatus` is set to `pending`
- Registrations stay in `matchStatus = "pending"`; users continue to see the normal waiting flow
- No venue assignment, no notifications, no blind-box event creation side effects are triggered

An operator (or super_admin) reviews the formed groups in the admin portal (`/admin/matching-reviews`) and chooses to approve or reject:

- **Approve** (`POST /api/admin/matching-reviews/pools/:id/approve`): marks the pool and groups as `approved`, runs `executePostMatchCommitSideEffects`, creates events/blind-box events, assigns venues (if enabled), and notifies users.
- **Reject** (`POST /api/admin/matching-reviews/pools/:id/reject`): marks the pool and groups as `rejected`, deletes any events/eventAttendance/blindBoxEvents created during the match run, and leaves users in the waiting state for a future match run.

Race-condition guards: both endpoints use conditional DB updates that require the current `operatorReviewStatus = 'pending'`. If the state changed concurrently, the request returns the current state without duplicating side effects or deleting approved groups.

This feature intentionally keeps the user-facing mini-program unchanged; users see the standard matching-status pending flow until operator approval.

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

### 5.2 Life Stage Affinity Matrix (5×5, Asymmetric)

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
| 社牛柯基 | 95 | Very High |
| 小太阳鸡 | 90 | Very High |
| 夸夸仓鼠 | 85 | High |
| 寻宝狐 | 82 | High |
| 机灵海豚 | 75 | Medium-High |
| 人脉蛛 | 72 | Medium-High |
| 树洞考拉 | 70 | Medium |
| 脑洞章鱼 | 68 | Medium |
| 好奇猫头鹰 | 55 | Low-Medium |
| 靠谱大象 | 52 | Low-Medium |
| 慢热龟 | 38 | Low |
| 小透明猫 | 30 | Very Low |

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
- All stored and served pair explanations are normalized plain text via `normalizePairExplanationText`, applied at the generation (`parsePairExplanationContent`), persist (`savePairExplanationsCache`), and serve (`generateGroupAnalysis` — legacy cached rows cleaned on read) boundaries; malformed LLM JSON never reaches the client, and generation-boundary salvage is logged via `logger.warn('[MatchExplanation] recovered malformed explanation payload', { kind, recoveredLength })` (2026-07-13)
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
| `apps/admin-client/src/pages/admin/PoolGroupDetailPage.tsx` | Group result visualization |
| `apps/admin-client/src/pages/admin/AdminMatchingReviewsPage.tsx` | Admin operator review queue for formed groups |
| `apps/server/src/routes/domains/adminMatchingReview.ts` | Admin matching review endpoints (list, approve, reject) |
| `apps/server/src/lib/matchingPostMatchEffects.ts` | Shared post-match side-effect runner used by approve and auto-match |
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
| **Heat level** | Interest intensity: level 1 (heat=3), level 2 (heat=10), level 3 (heat=25) |
| **Life stage** | User's `lifeStage` value — the "人生阶段" used in social affinity scoring. `workMode` is retained as a read-only fallback during the migration period. |
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
| **operatorReviewStatus** | State column on `event_pools` and `event_pool_groups`: `none` (auto-match path), `pending` (awaiting operator review), `approved` (operator approved; side effects committed), `rejected` (operator rejected; artifacts cleaned up). |
| **matchingOperatorReviewEnabled** | DB-backed feature flag (env `MATCHING_OPERATOR_REVIEW_ENABLED`, default `true`) that gates the operator-review flow. |
| **executePostMatchCommitSideEffects** | Shared helper that creates events, assigns venues, and sends notifications after a match run is approved. |
