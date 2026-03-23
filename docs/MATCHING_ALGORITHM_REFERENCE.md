# JoyJoin Matching Algorithm Reference

> **Status:** Living document — last updated 2026-03-23 11:21:30  
> **Scope:** Covers all three matching layers: (1) Personality archetype assignment, (2) Pair compatibility scoring, (3) Group formation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layer 1 — Personality Assessment & Archetype Assignment (MatcherV2)](#2-layer-1--personality-assessment--archetype-assignment-matcherv2)
3. [Layer 2 — Pair Compatibility Scoring (Pool Matching)](#3-layer-2--pair-compatibility-scoring-pool-matching)
4. [Layer 3 — Group Formation Algorithm](#4-layer-3--group-formation-algorithm)
5. [Supporting Matrices & Data](#5-supporting-matrices--data)
6. [Hard Constraints (Pre-filter)](#6-hard-constraints-pre-filter)
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
| `P` | 耐心 (Patience) | Tolerance, deliberateness, steady pace |

All traits are scored on a **0–100 scale** from the V4 Adaptive Assessment (16+4 questions).

### 2.2 The 12 Social Archetypes

| Archetype | Emoji | Energy Level | Core Traits |
|-----------|-------|-------------|-------------|
| 开心柯基 | 🐕 | Very High | High X + High A |
| 太阳鸡 | 🐔 | Very High | High X + High P |
| 夸夸豚 | 🐬 | High | High A + High O |
| 机智狐 | 🦊 | High | High O + High C |
| 淡定海豚 | 🐬 | Medium | Balanced, High E |
| 织网蛛 | 🕷 | Medium | High C + High O |
| 暖心熊 | 🐻 | Medium-Low | High A + High E |
| 灵感章鱼 | 🐙 | Medium | High O, creative burst |
| 沉思猫头鹰 | 🦉 | Low-Medium | High C + High O, introspective |
| 定心大象 | 🐘 | Low-Medium | High A + High E, stabilizer |
| 稳如龟 | 🐢 | Low | High P + High E |
| 隐身猫 | 🐱 | Very Low | Low X, quiet companion |

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

For traits flagged as `avoid` in `PROTOTYPE_SOUL_TRAITS`, violations are penalised more harshly to prevent cross-pole mismatches (e.g. very high X should block 隐身猫).

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

Optional tiebreaker using non-trait data:

```typescript
secondaryBonus = f(motivationDirection, conflictPosture, riskTolerance)
// Max contribution: ~+8 points
```

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
| 0 | Opposite-pole conflict gate | Disqualifies archetypes that are a qualitative mismatch (e.g. max-extraversion user → block 隐身猫) |
| 1 | Signature thresholds | Trait-based pre-filter bonuses/penalties |
| 2 | Archetype veto rules + confusion pair gates | Hard-caps via `ARCHETYPE_VETO_RULES` map |

#### Tie-Breaking

If top-2 scores are within a close gap, `breakTie()` uses secondary differentiators (motivationDirection, conflictPosture, riskTolerance) to resolve.

### 2.4 V4 Adaptive Assessment Engine

**File:** `packages/shared/src/personality/adaptiveEngine.ts`

- **Base questions:** 16 anchor questions (balanced across 6 traits)
- **Adaptive supplement:** Up to 4 targeted questions for confusable archetype pairs
- **Confusable pairs** (CONFUSABLE_ARCHETYPE_PAIRS) drive adaptive question selection
- MatcherV2 is enabled by default (`ENABLE_MATCHER_V2_DEFAULT = true`)

---

## 3. Layer 2 — Pair Compatibility Scoring (Pool Matching)

**File:** `apps/server/src/poolMatchingService.ts`  
**Function:** `calculatePairScore(user1, user2): Promise<number>`

### 3.1 Active Weights (6 Dimensions)

```typescript
pairScore =
  chemistry           × 0.28 +   // 性格化学反应
  interest            × 0.28 +   // 兴趣重叠度
  socialAffinity      × 0.20 +   // 社交同频度
  backgroundDiversity × 0.15 +   // 背景多样性
  preference          × 0.05 +   // 活动偏好
  language            × 0.04;    // 语言沟通
```

### 3.2 Dimension Detail

#### 3.2.1 Chemistry Score (性格化学反应) — 28%

- Reads from the **12×12 Chemistry Matrix** (`archetypeChemistry.ts`)
- Weighted blend of primary + secondary archetypes:

```typescript
chemistry =
  CHEMISTRY_MATRIX[primary1][primary2]   × 0.70
+ CHEMISTRY_MATRIX[primary1][secondary2] × 0.15
+ CHEMISTRY_MATRIX[secondary1][primary2] × 0.15
```

- Matrix scores: 0–100 (90–100 = perfect complement, 0–29 = high conflict risk)
- Default fallback: 50 if archetype is unknown

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

#### 3.2.3 Social Affinity Score (社交同频度) — 20%

Average of up to 3 sub-signals (equal weight per present factor):

| Sub-signal | Source | Notes |
|-----------|--------|-------|
| Life stage affinity | `LIFE_STAGE_AFFINITY` 7×7 matrix | Asymmetric — averaged both directions |
| Education affinity | Ordinal distance (`EDUCATION_ORDINAL`) | Same level = 100, each step apart = −20 |
| Hometown affinity | `hometownRegionCity` matching | Only when **both** users opt in (`hometownAffinityOptin = true`) |

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

Matches event-level preferences from registration:
- Event intent / activity type alignment
- Bar preferences, cuisine preferences (for bar/dining events)
- Light signal — limited differentiation in current event types

#### 3.2.6 Language Score (语言沟通) — 4%

- Uses `preferredLanguages` from event pool registration
- Binary scoring: any shared language → 100; no overlap → 30; one/both missing → 70 (default)
- **Scope: pair-level only.** Language is intentionally kept as a lightweight pair signal (4%). Group-level social dynamics are captured by Energy Balance (§4.1) which uses archetype energy, not language.
- Low discriminative power in current Mandarin-dominant pools — retained as a safety net for genuine multilingual mismatches.

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
| **harmonyScore** — energy std deviation | Low–moderate spread (natural dynamics) | −2.5 pts per SD unit |

```typescript
// Energy lookup (from ARCHETYPE_ENERGY in archetypeChemistry.ts):
// 开心柯基: 95, 太阳鸡: 90, 夸夸豚: 85, 机智狐: 82,
// 淡定海豚: 75, 织网蛛: 72, 暖心熊: 70, 灵感章鱼: 68,
// 沉思猫头鹰: 55, 定心大象: 52, 稳如龟: 38, 隐身猫: 30

avgScore     = avgEnergy in [50,70] ? 100 : max(0, 100 − |avgEnergy − nearest boundary| × 2)
harmonyScore = max(0, 100 − stdDev × 2.5)
energyBalance = round((avgScore + harmonyScore) / 2)
```

**Why this matters:**
- All-high-energy groups (4× 开心柯基/太阳鸡): exhausting, loud, everyone talking at once
- All-low-energy groups (4× 稳如龟/隐身猫): awkward silences, low engagement
- Ideal mix: 1–2 energisers (开心柯基/太阳鸡) + 2–3 mid-range + 1 anchor (定心大象/稳如龟)

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
| 开心柯基 | 95 | Very High |
| 太阳鸡 | 90 | Very High |
| 夸夸豚 | 85 | High |
| 机智狐 | 82 | High |
| 淡定海豚 | 75 | Medium-High |
| 织网蛛 | 72 | Medium-High |
| 暖心熊 | 70 | Medium |
| 灵感章鱼 | 68 | Medium |
| 沉思猫头鹰 | 55 | Low-Medium |
| 定心大象 | 52 | Low-Medium |
| 稳如龟 | 38 | Low |
| 隐身猫 | 30 | Very Low |

Ideal group mean energy: **50–70** (balanced, energised but not chaotic).  
Default fallback when archetype is missing: **60** (mid-range neutral).

---

## 6. Hard Constraints (Pre-filter)

Applied in `meetsHardConstraints()` before any scoring.  
Users failing constraints are excluded from pool matching entirely.

Current hard constraints include:
- **Budget range** (L1 hard constraint — added 2025)
- Pool-level gender / industry / seniority restrictions (if configured)
- Registration status must be `"pending"`

---

## 7. Key Source Files

| File | Role |
|------|------|
| `packages/shared/src/personality/matcherV2.ts` | Personality archetype assignment algorithm |
| `packages/shared/src/personality/adaptiveEngine.ts` | V4 adaptive quiz engine |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Chemistry matrix (single source of truth) |
| `packages/shared/src/personality/prototypes.ts` | Archetype prototype trait profiles |
| `apps/server/src/poolMatchingService.ts` | Pair scoring + group formation (primary matching service) |
| `apps/server/src/archetypeChemistry.ts` | Server-side chemistry helpers (imports from shared) |
| `apps/server/src/userMatchingService.ts` | Legacy 6-dimensional user matching (used for admin lab / older flows) |
| `apps/server/src/personalityMatchingV2.ts` | V8 hybrid (Euclidean + cosine) scoring utilities |
| `apps/admin-client/src/pages/admin/AdminMatchingLabPage.tsx` | Admin UI for testing matching weights |
| `apps/admin-client/src/pages/PoolGroupDetailPage.tsx` | Group result visualization |

---

## 8. Glossary

| Term | Definition |
|------|------------|
| **Pair score** | 6-dimensional compatibility score (0–100) between two users |
| **Chemistry score** | Archetype-to-archetype compatibility from the 12×12 matrix |
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