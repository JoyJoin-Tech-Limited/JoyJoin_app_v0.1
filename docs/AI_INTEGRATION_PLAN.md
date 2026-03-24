# JoyJoin AI Integration Plan

> **Status:** Living document — last revised 2026-03-24  
> **Scope:** Phased AI roadmap for latent social compatibility modeling — from near-term experience enhancements through predictive learning to long-horizon latent intelligence.

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
2. [Phase 1 — AI-Enhanced Social Experience & Match Quality Infrastructure](#2-phase-1--ai-enhanced-social-experience--match-quality-infrastructure)
3. [Phase 2 — Predictive Compatibility Enrichment](#3-phase-2--predictive-compatibility-enrichment)
4. [Phase 3 — Latent Compatibility Intelligence](#4-phase-3--latent-compatibility-intelligence)
5. [Cross-Phase Data & Model Flow](#5-cross-phase-data--model-flow)
6. [Evaluation, Experimentation & Model Governance](#6-evaluation-experimentation--model-governance)
7. [Fairness, Safety & Multimodal Guardrails](#7-fairness-safety--multimodal-guardrails)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Key Source Files](#9-key-source-files)


---

## 1. Overview & Design Philosophy

### 1.1 Strategic Positioning

JoyJoin's matching system must be useful **today**, credible **next year**, and defensible **at scale**. The AI roadmap is therefore deliberately sequenced across three phases:

| Phase | Horizon | Primary AI Role |
|-------|---------|----------------|
| **Phase 1** | Q2–Q3 2026 | Harvest near-term experience wins; instrument the data foundation | Experience AI + Orchestration AI |
| **Phase 2** | Q4 2026–Q1 2027 | Add learned predictive signals conservatively, on top of the rule-based core | Predictive AI (bounded, confidence-aware) |
| **Phase 3** | Q2 2027+ | Build latent social compatibility intelligence from accumulated behavioral evidence | Latent compatibility modeling + multimodal enrichment |

This sequencing deliberately avoids two failure modes:

1. **Overclaiming:** JoyJoin cannot yet claim to predict deep human compatibility. At present the system operates on declared profile attributes and a hand-authored chemistry matrix. Treating an LLM score as validated prediction would be misleading and hard to recover from when it underperforms.
2. **Under-investing:** The core matching algorithm is rule-based and static. Without a deliberate path toward learned representations, JoyJoin's match quality will plateau as users scale.

### 1.2 Three Kinds of AI

The plan explicitly distinguishes:

| AI Type | Definition | JoyJoin Examples |
|---------|-----------|-----------------|
| **Orchestration / Experience AI** | Uses language models to shape the moment — framing, sequencing, narrative | Match reveal copy, icebreaker sequencing, event theme generation, XiaoYue commentary |
| **Explanatory AI** | Translates match outputs into human-readable reasoning | `matchExplanationService.ts`, `generatePairExplanation()`, connection point generation |
| **Predictive AI** | Learns from outcomes to forecast future compatibility | Feedback-calibrated chemistry scores, hybrid embedding similarity, lightweight outcome models |

LLMs are excellent **orchestration and explanation layers**. They should not be treated as the primary source of truth for compatibility scoring until that scoring has been empirically validated against real outcomes. This distinction is enforced throughout the roadmap.

### 1.3 Current State (as of 2026-03-24)

| Area | Feature | Status |
|------|---------|--------|
| Match scoring | Rule-based 6-dimension pair score | ✅ Live — `poolMatchingService.ts` |
| Atmosphere prediction | `predictAtmosphere()` rule engine | ✅ Live — `atmospherePrediction.ts` |
| Match explanation | DeepSeek pair explanations + icebreakers | ✅ Live — `matchExplanationService.ts` |
| Event theme title | AI-generated group theme title | ✅ Live — `eventThemeTitleGenerator.ts` |
| Weight learning | Thompson Sampling bandit | ✅ Available — `matchingWeightsService.ts` (admin evolution + `userMatchingService.ts`; not yet wired into `poolMatchingService.ts`) |
| Weight learning | Gradient descent | ⚠️ Legacy / experimental — `dynamicWeights.ts` (not active in current pool matching) |
| Interest matching | Static Jaccard + heat bonus | ✅ Live — `poolMatchingService.ts` |
| Temporal interest decay | Heat-weighted by recency | 🔲 Phase 1 |
| Archetype trajectory | Blended smoothing over 30-day shifts | 🔲 Phase 1 |
| Post-event feedback loop | Atmosphere + connection radar pipeline | 🔲 Phase 1 |
| Adaptive icebreaker sequencing | Phase-aware ordering by group energy | 🔲 Phase 1 |
| Hybrid embedding layer | Semantic cosine similarity dimension | 🔲 Phase 2 |
| Chemistry matrix calibration | Feedback-bounded empirical correction | 🔲 Phase 2 |
| Group role / energy balance | Pre-formation role composition scoring | 🔲 Phase 2 |
| Predictive compatibility scoring | Outcome-trained compatibility model | 🔲 Phase 2 |
| Latent user state modeling | Behavioral embeddings, contextual memory | 🔲 Phase 3 |
| Multimodal signal enrichment | Audio/visual cues with consent & fairness | 🔲 Phase 3 |

---

## 2. Phase 1 — AI-Enhanced Social Experience & Match Quality Infrastructure

### 2.1 Design Goals

Phase 1 has two parallel tracks:

- **Experience track:** Make the social moment richer and more resonant using AI orchestration and explanation — without waiting for learned signals.
- **Infrastructure track:** Instrument the data pipelines that Phase 2 and Phase 3 depend on. Phase 1 is the foundation; its measurement work is as important as its feature work.

### 2.2 Temporal Interest Heat Decay

**Problem:** The current interest score in `poolMatchingService.ts::calculateInterestScoreAsync()` treats all heat values as static. A user who was obsessed with hiking six months ago but has recently pivoted to jazz and city exploration is represented as equally interested in both.

**Proposal:** Replace the static `totalHeat` read with a **temporally decayed heat value** computed from the `user_interests` table's `updatedAt` timestamp and per-topic `heat`.

```typescript
// Proposed utility in poolMatchingService.ts or a new interestDecayUtils.ts
const HALF_LIFE_DAYS = 45; // interest heat halves every 45 days

// Pass nowMs from the caller to avoid repeated Date.now() calls during batch processing
function decayedHeat(rawHeat: number, lastUpdatedAt: Date, nowMs: number): number {
  const ageInDays = (nowMs - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return rawHeat * Math.pow(0.5, ageInDays / HALF_LIFE_DAYS);
}
```

**Integration point:** `apps/server/src/poolMatchingService.ts` — `calculateInterestScoreAsync()`. The `user_interests` table already stores `updatedAt`; this change only requires reading and using it.

**Why this matters:** Recency-weighted interests produce better conversations. Two people matched on their *current* obsessions are more likely to have live energy around a topic than two people matched on stale declared data.

### 2.3 Archetype Trajectory Tracking & Smoothing

**Problem:** Users who retake the personality test or whose archetype is reassigned experience a hard snap from one archetype to another. If a user shifted from 稳如龟 to 机智狐 two weeks ago, their chemistry scores abruptly change. This creates volatility.

**Proposal:** Track archetype transitions in a lightweight history log. When computing `calculateChemistryScore()`, blend the user's **current** and **previous** archetype using a time-decay weight.

```typescript
// Proposed: read from assessment_sessions, look for transitions in last 30 days
interface ArchetypeState {
  current: ArchetypeName;
  previous?: ArchetypeName;
  transitionDaysAgo?: number;
}

function blendedChemistryScore(
  a: ArchetypeState,
  b: ArchetypeState,
  matrix: ChemistryMatrix
): number {
  const BLEND_WINDOW_DAYS = 30;
  const blendWeight = (state: ArchetypeState) =>
    state.previous && state.transitionDaysAgo != null
      ? Math.max(0, 1 - state.transitionDaysAgo / BLEND_WINDOW_DAYS)
      : 0;

  const wa = blendWeight(a); // fraction of previous archetype A still active
  const wb = blendWeight(b);

  // Weighted blend of all four archetype-pair combinations.
  // wa and wb are only non-zero when previous is defined (guarded by blendWeight).
  // Explicit guards below prevent matrix access when wa/wb are zero (previous is undefined).
  const currentCurrent = matrix[a.current][b.current];
  const prevCurrent    = wa > 0 && a.previous ? matrix[a.previous][b.current] : currentCurrent;
  const currentPrev    = wb > 0 && b.previous ? matrix[a.current][b.previous] : currentCurrent;
  const prevPrev       = wa > 0 && wb > 0 && a.previous && b.previous
    ? matrix[a.previous][b.previous]
    : currentCurrent;

  return (
    (1 - wa) * (1 - wb) * currentCurrent +
    wa * (1 - wb) * prevCurrent +
    (1 - wa) * wb * currentPrev +
    wa * wb * prevPrev
  );
}
```

**Integration point:** `apps/server/src/poolMatchingService.ts::calculateChemistryScore()` and `apps/server/src/archetypeChemistry.ts`.
**Data source:** `packages/shared/src/schema.ts::assessmentSessions` — query the two most recent completed sessions per user.

### 2.4 Post-Event Feedback Loop Infrastructure

**Problem:** Neither the atmosphere temperature rating nor the connection radar data from the Social Icebreaker flow is currently wired into any matching signal. This is the largest instrumentation gap.

**Proposal:** Create a structured feedback aggregation pipeline.

**New DB table:** `event_group_outcomes`
```sql
CREATE TABLE event_group_outcomes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES event_pool_groups(id),
  event_id            UUID NOT NULL,
  submitted_by        UUID NOT NULL REFERENCES users(id),
  atmosphere_score    SMALLINT,          -- 1-5
  would_meet_again    BOOLEAN,
  connection_radar    JSONB,             -- {userId: strength_0_to_5} per respondent
  icebreaker_ratings  JSONB,             -- {questionId: helpful|neutral|awkward}
  free_text_signal    TEXT,              -- optional short reflection (not used for training directly)
  submitted_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Downstream consumers (Phase 1 — instrument only; Phase 2 — learn from):**
- `apps/server/src/matchingWeightsService.ts` — Thompson Sampling already needs `wouldMeetAgain`; wire it here
- `apps/server/src/dynamicWeights.ts` — legacy flow, same signal
- Future: Phase 2 chemistry calibration reads `atmosphere_score + would_meet_again` per archetype pair from this table

**Route:** `POST /api/event-pools/:poolId/group-outcome` — protected by `requireAuth`, validates group membership before writing.

### 2.5 AI-Enhanced Social Experience

These items use **orchestration and experience AI** only — no new predictive claims.

#### 2.5.1 Stronger Match Reveal Explanations

**Current:** `matchExplanationService.ts::generatePairExplanation()` generates a 50–80 character warm sentence. This is a good foundation.

**Upgrade:** Pass `atmospherePrediction` context alongside archetype pair data so the explanation is grounded in the group's predicted energy, not just the pair in isolation.

```typescript
// Extended signature
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember,
  groupContext?: {
    atmosphereType: AtmosphereType;
    groupSize: number;
    dominantArchetypes: string[];
  }
): Promise<string>
```

The context lets the model frame the connection as part of the group narrative: *"你和林晓的反差会在这次探索型小队里制造意外的火花"* rather than a generic *"你们兴趣相投"*.

#### 2.5.2 Adaptive Icebreaker Sequencing

**Current:** `generateIceBreakers()` returns a flat array with no ordering logic.

**Upgrade:** Introduce `phase` and `targetEnergy` metadata on each icebreaker, and order the sequence based on group atmosphere type.

```typescript
interface SequencedIceBreaker {
  question: string;
  phase: "warmup" | "depth" | "playful" | "reflect";
  targetEnergy: "high" | "medium" | "low";
}

export async function generateIceBreakers(
  members: MatchMember[],
  eventType: string,
  atmosphereType?: AtmosphereType
): Promise<SequencedIceBreaker[]>
```

**Sequencing rules:**
- `high_energy`: lead with `playful`, then `warmup`, then optionally `depth`
- `deep_connect` / `warm_cozy`: lead with `warmup`, fast-track to `depth`
- `balanced`: standard `warmup → depth → playful → reflect` arc
- `creative_spark`: similar to `balanced` but open with a divergent-thinking prompt before warmup — the creative atmosphere benefits from an unexpected first question that primes lateral thinking

**Integration:** `apps/server/src/matchExplanationService.ts` — modify `generateIceBreakers()`. The `AtmosphereType` enum in `packages/shared/src/atmospherePrediction.ts` has five valid values (`high_energy`, `warm_cozy`, `balanced`, `deep_connect`, `creative_spark`) — sequencing logic must only reference these values.

#### 2.5.3 Event Framing & Scenario Service

**Concept:** After group formation, an AI model synthesises group composition, venue type, event type (饭局/酒局), and predicted atmosphere to generate a structured **scenario brief** that feeds theme generation, icebreaker framing, and venue selection.

**Proposed new service:** `apps/server/src/services/eventScenarioService.ts`

```typescript
interface EventScenario {
  scenarioType: "deep_explorer" | "high_energy_mixer" | "creative_collision" | "warm_circle" | "balanced_gather";
  openingIcebreaker: string;
  conversationArc: string[];          // ordered prompts: warmup to depth to playful to reflect
  venueVibeHint: "quieter" | "standard" | "high_energy_ok";
  themeKeyword: string;               // feeds eventThemeTitleGenerator.ts
}

export async function generateEventScenario(
  members: MatchMember[],
  atmosphere: AtmospherePrediction,
  eventType: string
): Promise<EventScenario>
```

**Integration sequence:**
```
poolMatchingService.matchEventPool()
  -> groups formed
  -> [existing] generateGroupAnalysis()      -> pairExplanationsCache
  -> [NEW]      generateEventScenario()      -> eventPoolGroups.matchExplanation (extended JSON)
  -> [existing] generateAndSaveEventTheme()  -> uses themeKeyword from scenario
  -> [existing] assignVenuesToGroups()       -> uses venueVibeHint from scenario
```

### 2.6 Measurement & Instrumentation as Critical Foundation

Phase 1 must establish the measurement infrastructure that every subsequent phase depends on. Without this, Phase 2 and Phase 3 are building on sand.

**Required instrumentation by end of Phase 1:**

| Signal | Source | Used In |
|--------|--------|---------|
| `atmosphere_score` (1–5) | `event_group_outcomes` | Phase 2 chemistry calibration |
| `would_meet_again` (bool) | `event_group_outcomes` | Phase 2 weight bandit, chemistry calibration |
| `connection_radar` per pair | `event_group_outcomes` | Phase 2 pair-level outcome modeling |
| `icebreaker_ratings` per question | `event_group_outcomes` | Phase 2 icebreaker quality model |
| Interest `updatedAt` read rate | `user_interests` | Phase 1 decay validation |
| Archetype transition rate | `assessment_sessions` | Phase 1 smoothing validation |
| Match reveal engagement | Client analytics | Explanation quality proxy |

**Target by end of Phase 1:** 500+ complete `event_group_outcomes` records with `atmosphere_score` + `would_meet_again` filled.

---

## 3. Phase 2 — Predictive Compatibility Enrichment

### 3.1 Design Goals

Phase 2 introduces the first **genuinely predictive** signals into the matching pipeline. These are distinct from the orchestration and experience work in Phase 1:

- They operate on **learned representations**, not hand-crafted rules.
- They are introduced **conservatively**, with confidence gates and bounded influence.
- They are explicitly validated against the `event_group_outcomes` data collected in Phase 1 before their weights are raised.

**Minimum data prerequisite for Phase 2 launch:** 500+ outcome records collected in Phase 1 across at least 3 cities and 8+ archetype types.

### 3.2 Hybrid Embedding Layer

**Concept:** Encode each user's profile semantics — archetype, top interests, life stage, education tier — as a dense vector using an embedding model. Use cosine similarity between user vectors as an additional pair score dimension.

**Why:** The current 6-dimension pair score operates on structured categorical features. Embeddings capture **semantic proximity** that categorical matching misses. For example, a user whose interests center on "探索本地文化" and one who focuses on "发现城市角落宝藏" may not share any tagged interest category, but their embeddings will be close.

**Proposed architecture:**

```typescript
// New file: apps/server/src/ai/embeddingClient.ts (model pattern as per minimaxClient.ts)
// Extend existing: apps/server/src/inference/hybridSemantic.ts

export interface UserSemanticProfile {
  userId: string;
  vector: number[];             // e.g. 768-dim from embedding API
  vectorVersion: string;        // model version tag for cache invalidation
  computedAt: Date;
}

export async function buildUserSemanticProfile(user: User): Promise<UserSemanticProfile>
export function cosineSimilarity(a: number[], b: number[]): number // returns [0, 1]
```

**Profile text to embed** (concatenated Chinese string):
```
原型: {archetype} ({archetype_nickname})
核心兴趣: {top 5 interest labels}
人生阶段: {workMode / life stage label}
城市: {currentCity}
学历层次: {educationLevel}
```

**Integration point:** `apps/server/src/poolMatchingService.ts` — add `semanticSimilarity` as a **7th dimension** in the pair score formula.

```typescript
// Proposed initial weights (conservative Phase 2 introduction):
const WEIGHTS = {
  chemistry:           0.26,
  interest:            0.26,
  socialAffinity:      0.19,
  backgroundDiversity: 0.14,
  preference:          0.05,
  language:            0.04,
  semanticSimilarity:  0.06,  // NEW — Phase 2, raise once validated
};
```

**Feature flag:** The 7th dimension is controlled by an env var `ENABLE_SEMANTIC_SIMILARITY` (default `false`). When disabled, the original 6-dimension weights are used unchanged, providing a clean rollback path. The flag should only be enabled after offline backtesting confirms positive uplift.

**Caching:** Store vectors in a new `user_semantic_profiles` table. Invalidate on profile update or interest change. Recompute asynchronously in background — never at match time.

### 3.3 Feedback-Driven Chemistry Matrix Calibration

**Problem:** The chemistry matrix (`apps/server/src/archetypeChemistry.ts`) is entirely hand-authored and never self-corrects. If empirical data shows that a particular archetype pairing consistently underperforms its predicted score, the matrix has no mechanism to respond.

**Proposal:** Aggregate outcome feedback per archetype pair and apply **bounded empirical corrections**. This is calibrated statistical correction with safety thresholds — not reinforcement learning.

**New DB table:** `archetype_pair_feedback_stats`
```sql
CREATE TABLE archetype_pair_feedback_stats (
  archetype_a        VARCHAR(50) NOT NULL,
  archetype_b        VARCHAR(50) NOT NULL,
  sample_count       INTEGER DEFAULT 0,
  avg_meet_again     NUMERIC(4,3),    -- fraction saying yes (0.0-1.0)
  avg_atmosphere     NUMERIC(4,1),    -- 1.0-5.0 scale
  empirical_score    NUMERIC(5,1),    -- derived compatibility estimate (10-100)
  confidence         NUMERIC(4,3),    -- confidence from sample count
  last_updated_at    TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (archetype_a, archetype_b)
);
```

**Calibration rule:**
```typescript
const MIN_SAMPLES = 30;              // cold-start threshold
const MAX_DELTA_PER_BATCH = 2.0;     // maximum correction per feedback batch
const BOUNDS = { min: 10, max: 100 };

function empiricalScore(avgMeetAgain: number, avgAtmosphere: number): number {
  // avgMeetAgain (0-1) contributes 60 points — direct proxy for social success.
  // avgAtmosphere (1-5) is normalised to [0,1] via (avgAtmosphere - 1) / 4,
  // then contributes 40 points — event enjoyment proxy, weighted less because
  // it reflects event design as well as pair compatibility.
  return avgMeetAgain * 60 + ((avgAtmosphere - 1) / 4) * 40;
}

function calibratedChemistryScore(
  baseMatrixScore: number,
  stats: ArchetypePairFeedbackStats
): number {
  if (stats.sample_count < MIN_SAMPLES) return baseMatrixScore;
  const empirical = empiricalScore(stats.avg_meet_again, stats.avg_atmosphere);
  const delta = Math.sign(empirical - baseMatrixScore) *
    Math.min(Math.abs(empirical - baseMatrixScore) * 0.05, MAX_DELTA_PER_BATCH);
  return Math.max(BOUNDS.min, Math.min(BOUNDS.max, baseMatrixScore + delta));
}
```

**Integration point:** `apps/server/src/poolMatchingService.ts::calculateChemistryScore()` — check `archetype_pair_feedback_stats` first (5-min in-memory cache), fall back to static matrix when below sample threshold.

### 3.4 Group-Level Role Balance Scoring

**Problem:** The current group diversity score measures industry and gender diversity, and separately estimates energy balance from archetype energy levels. It does not assess **social role composition** — whether the group has a functional balance of initiators, depth contributors, and connectors.

**Proposal:** Add a **group role balance** scoring sub-dimension before finalising group formation.

```typescript
type SocialRole = "initiator" | "connector" | "depth_anchor" | "wild_card";

function inferSocialRole(archetype: ArchetypeName, energyLevel: number): SocialRole {
  if (energyLevel >= 75) return "initiator";
  if (energyLevel >= 55) return "connector";
  if (energyLevel >= 35) return "depth_anchor";
  return "wild_card";
}

function groupRoleBalanceScore(members: MatchMember[]): number {
  const roles = members.map(m => inferSocialRole(m.archetype, ARCHETYPE_ENERGY[m.archetype]));
  const hasInitiator = roles.includes("initiator");
  const hasDepthAnchor = roles.includes("depth_anchor");
  // Use > half (strict) to avoid false positives on odd-sized groups.
  // e.g. for 5 members, 3+ initiators = dominance risk; 2 initiators is acceptable.
  const dominanceRisk = roles.filter(r => r === "initiator").length > members.length / 2;
  let score = 50;
  if (hasInitiator) score += 20;
  if (hasDepthAnchor) score += 20;
  if (!dominanceRisk) score += 10;
  return score;
}
```

**Integration point:** `apps/server/src/poolMatchingService.ts::calculateGroupDiversity()` — add `roleBalance` as a fourth sub-dimension.

### 3.5 Lightweight Predictive Compatibility Scoring

**Concept:** Train a simple outcome prediction model on accumulated `event_group_outcomes` data. The model predicts `atmosphere_score` and `would_meet_again` from pair-level feature vectors, without replacing the existing rule-based scoring — it adds a **confidence-aware reranking** layer.

**Target labels:**
- `atmosphere_score >= 4` (event enjoyment)
- `would_meet_again = true` (perceived mutual interest)
- `connection_radar_strength >= 3` for at least 2 pairs (conversational quality)

**Feature vector per pair:**
```
chemistry_score, interest_score, social_affinity_score,
background_diversity_score, semantic_similarity (Phase 2),
archetype_pair_key, event_type, group_size, city
```

**Model approach:** Start with gradient-boosted trees (LightGBM) or logistic regression for interpretability. Deep learning is not warranted until Phase 3 data volumes.

**Confidence-aware rollout:**
```typescript
const predictedScore = compatibilityModel.predict(pairFeatures);
const confidence = compatibilityModel.confidence(pairFeatures);
const CONFIDENCE_THRESHOLD = 0.70;

const finalScore = confidence >= CONFIDENCE_THRESHOLD
  ? overallScore * 0.85 + predictedScore * 0.15  // conservative blend
  : overallScore;                                  // fall back to rule-based
```

**Governance:** Model retrained at most monthly. Each retraining requires offline backtesting before production deployment. See Section 6.

---

## 4. Phase 3 — Latent Compatibility Intelligence

### 4.1 Design Goals

Phase 3 shifts from *feature engineering on declared attributes* to *learning latent representations of social compatibility from behavioral evidence*. The goal is not to replace the Phase 1/2 scoring system but to enrich it with signals that users cannot easily declare and that the rule-based system cannot compute.

**Key principle:** Phase 3 must continue to distinguish explanatory AI from predictive AI. Latent embeddings may improve match quality, but they must not be presented to users as proof of deep compatibility — they are probabilistic signals.

### 4.2 Latent User State Modeling

**Concept:** Build a dynamic user representation that captures not just *who the user is* (declared profile) but *how they show up socially* — based on behavioral traces accumulated across events.

**Behavioral signals to harvest (with consent):**

| Signal | Source | Behavioral Inference |
|--------|--------|---------------------|
| Icebreaker engagement depth | Social Icebreaker phase durations | Preference for warmup vs depth questions |
| Connection radar distribution | `event_group_outcomes.connection_radar` | Pair vs group bonding tendency |
| Repeat attendance patterns | Event RSVP history | Social stamina, novelty-seeking |
| Response time in lie detective | Social Icebreaker timestamps | Decision pacing, confidence |
| Archetype trajectory | `assessment_sessions` | Identity stability vs evolution |
| Interest decay rate | `user_interests` + timestamp analysis | Active vs passive interest engagement |

**Proposed table:** `user_latent_state`
```sql
CREATE TABLE user_latent_state (
  user_id                  UUID PRIMARY KEY REFERENCES users(id),
  latent_vector            JSONB NOT NULL,       -- e.g. {dim: 64, values: [...]}
  vector_version           VARCHAR(30),
  behavioral_signals_used  JSONB,                -- audit log of contributing signals
  computed_at              TIMESTAMP NOT NULL,
  next_recompute           TIMESTAMP             -- scheduled refresh window
);
```

### 4.3 Contextual Pair / Group Memory

**Concept:** For users who have attended multiple JoyJoin events, the system accumulates a **relational memory** — not just profile attributes, but interaction history with specific other users. This contextual memory can influence future group formation.

**Proposal:**
- Add a `prior_group_encounters` lookup during `matchEventPool()`: if users A and B have previously been in a group with `atmosphere_score >= 4`, give a small boost to future pairings. If a prior encounter had `atmosphere_score <= 2`, apply a small penalty.
- Source: `event_group_outcomes` table — the pair-level `connection_radar` already captures this signal.

**Constraint:** Only applied after 3+ prior events in the same city. Below this threshold, prior encounter data is too sparse to be reliable.

### 4.4 LLM-Powered Personalized Match Explanations (Evolved)

In Phase 3, the match explanation shifts from generic archetype-pair descriptions to **narratively personalized reasoning** grounded in the user's behavioral history.

**Inputs to explanation generation:**
- Declared profile (archetype, interests, life stage)
- Latent state vector — translated into human-readable behavioral tendencies
- Prior event history (if any)
- Group composition context

**Output framing:**
Explanations must be positioned as *AI-assisted reasoning*, not *compatibility proof*:
- Use language like "根据你们过去的互动模式推测" (inferred from your past interaction patterns)
- Avoid definitive claims like "你们一定合得来"
- Surface the reasoning: "你倾向于在小圈子里深度连接，而小明在群体中擅长打开话题 — 这种组合在过去的探索型活动中通常表现不错"

**Integration point:** Extended `matchExplanationService.ts` — add `generatePersonalizedExplanation(member, groupContext, latentState)`.

### 4.5 Optional Multimodal Signal Enrichment (多模态能力)

**Long-term capability:** As LLM multimodal capabilities (多模态能力) mature — and as MiniMax's `minimax-m2.7` model evolves — JoyJoin can optionally enrich compatibility signals with non-text modalities, subject to strict user consent and fairness safeguards (see Section 7).

**Potential multimodal signals:**

| Modality | Signal | Use Case |
|----------|--------|----------|
| **Voice** (audio intro) | Speech pace, energy level, tonal warmth | Infer social energy style |
| **Photo** (optional) | Scene context, aesthetic style | Cultural/lifestyle affinity proxy |
| **Short video introduction** | Gesture cadence, speaking style | Communication style fingerprint |

**Guardrails (non-negotiable before launch):**
- All multimodal enrichment is **opt-in**, with explicit per-modality consent UI.
- No physical appearance scoring. Models must be constrained to extract behavioral and contextual signals only.
- Fairness audit required before any multimodal feature enters production scoring (see Section 7).
- Users can request deletion of all multimodal data independently of their core profile.

**Architecture:** Multimodal inputs are processed via `apps/server/src/ai/minimaxClient.ts` (MiniMax `minimax-m2.7`, already integrated) or a dedicated multimodal embedding model, producing a latent vector that supplements the behavioral latent state from Section 4.2.

---

## 5. Cross-Phase Data & Model Flow

```
DECLARED DATA
  users (DB)                    users.archetype, interests, workMode, education
  user_interests (DB)           heat-weighted topic selections + updatedAt
  assessment_sessions (DB)      archetype trajectory (last 2 completed sessions)

PHASE 1: EXPERIENCE + INSTRUMENTATION
  atmospherePrediction.ts       predictAtmosphere(archetypes[])
    -> energyScore, vibeType, suggestedTopics (5 atmosphere types)
  matchExplanationService.ts
    -> generateGroupAnalysis()  -> pairExplanationsCache, iceBreakersCache
    -> generateIceBreakers() -> string[]                        // current implementation
    -> generateIceBreakers(atmosphereType) -> SequencedIceBreaker[]  // planned Phase 1 upgrade
  eventScenarioService.ts (new)
    -> generateEventScenario()  -> themeKeyword -> eventThemeTitleGenerator.ts
                                -> venueVibeHint -> venueAssignmentService.ts
  event_group_outcomes (new table)
    -> atmosphere_score, would_meet_again, connection_radar

PHASE 2: PREDICTIVE ENRICHMENT
  hybridSemantic.ts (extended)
    -> buildUserSemanticProfile() -> user semantic vector -> 7th pair dimension
  archetype_pair_feedback_stats (new table)
    -> calibratedChemistryScore() -> bounded correction of CHEMISTRY_MATRIX
  poolMatchingService.ts (extended)
    -> groupRoleBalanceScore()  -> added to calculateGroupDiversity()
  compatibilityModel (lightweight trained model)
    -> confidence-aware reranking on top of overallScore
  matchingWeightsService.ts
    -> Thompson Sampling bandit <- would_meet_again from event_group_outcomes

PHASE 3: LATENT INTELLIGENCE
  user_latent_state (new table)
    -> behavioral signal embeddings -> contextual pair/group memory
    -> supplements semantic vector from Phase 2
  matchExplanationService.ts (extended)
    -> generatePersonalizedExplanation() -> history-grounded, positioned as reasoning
  multimodal enrichment (opt-in, Phase 3 only)
    -> minimaxClient.ts multimodal -> modality vector -> latent state supplement
```

---

## 6. Evaluation, Experimentation & Model Governance

### 6.1 Outcome Labels Hierarchy

JoyJoin must define a **multi-horizon outcome label set** rather than relying on a single `wouldMeetAgain` signal. Social fit is multidimensional, and a single label will optimise for the wrong thing.

| Label | Horizon | Source | Notes |
|-------|---------|--------|-------|
| `atmosphere_score` (1–5) | Immediate | Post-event survey | Event enjoyment proxy |
| `would_meet_again` (bool) | Immediate | Post-event survey | Perceived mutual interest |
| `connection_radar_strength` | Immediate | Connection radar per pair | Conversational quality |
| `icebreaker_helpfulness` | Immediate | Per-question rating | Experience quality signal |
| Follow-up event RSVP | 7 days | Event RSVP table | Behavioral intent signal |
| Repeat attendance | 30 days | RSVP history | Retention impact |
| Platform retention | 90 days | Session + RSVP history | Long-term value proxy |

**Warning:** Not wanting to meet again may reflect timing, romantic misalignment, or event fatigue — not poor match quality. Models trained on `wouldMeetAgain` alone risk optimising for pleasant but shallow groupings. Use multi-label outcomes wherever data allows.

### 6.2 Experimentation Framework

All predictive features from Phase 2 onward must pass the following validation pipeline before influencing production scoring:

1. **Offline backtesting:** Train on outcomes before a cutoff date; evaluate AUC-ROC and precision@k on held-out events.
2. **Shadow scoring:** Run new model in parallel with production, logging both scores, without affecting group formation.
3. **A/B test:** Route a portion of pool matchings to the new model. Compare outcome labels between arms over 4+ weeks.
4. **Calibration check:** Verify model confidence scores are calibrated (e.g. events scored 0.8 confidence should produce the primary label ~80% of the time).
5. **Promotion gate:** Promote from shadow to live only when uplift is statistically significant (p < 0.05) and no fairness regression is detected.

### 6.3 Model Governance Policy

| Policy | Requirement |
|--------|-------------|
| **Model versioning** | All models tagged with version; previous versions retained for rollback |
| **Retraining cadence** | At most monthly; offline validation required before promotion |
| **Confidence gates** | Phase 2 predictive model only influences scoring above `confidence >= 0.70` |
| **Drift monitoring** | Alert when AUC-ROC drops > 0.05 from baseline over rolling 30-day window |
| **Weight ceilings** | No single AI dimension may exceed 20% of `overallScore` until validated by 1000+ outcome events |
| **Human override** | Admin portal retains the ability to override or disable any AI scoring layer per event pool |

---

## 7. Fairness, Safety & Multimodal Guardrails

### 7.1 Core Principle

JoyJoin's AI must **optimise for meaningful connection, not desirability ranking**. Popularity bias, demographic confounding, and extrovert preference are genuine risks in social matching systems. Every Phase 2+ model must be evaluated for these biases before production launch.

### 7.2 Known Bias Risks

| Risk | Description | Mitigation |
|------|-------------|-----------|
| **Popularity bias** | High-energy, socially active users generate stronger positive signals, compounding their advantage | Normalise outcome labels by activity level; cap influence of high-frequency users in training data |
| **Extrovert bias** | `atmosphere_score` may reward high-energy groups and penalise introverts who prefer `deep_connect` events | Stratify evaluation by `AtmosphereType`; ensure Phase 2 models are evaluated per atmosphere type separately |
| **Demographic confounding** | Features like city, education, and industry correlate with demographics; models may proxy demographic signals | Audit feature importance for demographic proxies; apply fairness constraints during model training |
| **Survivorship bias** | Outcome data only exists for users who attended; churned users are underrepresented | Weight training data to correct for attendance selection; monitor model performance for at-risk cohorts |
| **Archetype over-reliance** | Over-weighting archetypes risks reducing users to a stylised type | Archetypes are one feature family among many; Phase 2+ models must not have archetype as the dominant feature dimension |

### 7.3 Multimodal Safety Requirements

Before any multimodal enrichment feature (Section 4.5) enters production:

- [ ] Consent UI designed and user-tested — explicit opt-in per modality with clear explanation of use
- [ ] Model audit completed — verify that the multimodal model does not extract appearance-based proxies (skin tone, attractiveness, physical characteristics)
- [ ] Fairness audit completed — compare match outcomes across demographic cohorts for users with and without multimodal enrichment
- [ ] Data retention policy defined — multimodal data deleted on account deletion; independently deletable on request
- [ ] Minimal data principle applied — extract only the behavioral signal needed; do not retain raw audio/video beyond the processing window unless explicitly opted in

### 7.4 User Dignity Commitment

The system must not produce or surface any ranking that implies a user is "less desirable" or "harder to match." Match explanations must be framed positively and contextually — presenting the match as a probabilistic prediction, not a verdict on a person's worth.

---

## 8. Implementation Roadmap

### Phase 1 — AI-Enhanced Experience & Data Infrastructure (Q2–Q3 2026)

| Task | Priority | Files Affected |
|------|----------|----------------|
| Add temporal interest heat decay to `calculateInterestScoreAsync()` | P1 | `apps/server/src/poolMatchingService.ts` |
| Add archetype trajectory blending to `calculateChemistryScore()` | P1 | `apps/server/src/poolMatchingService.ts`, `archetypeChemistry.ts` |
| Create `event_group_outcomes` table and POST endpoint | P1 | `packages/shared/src/schema.ts`, `apps/server/src/routes.ts` |
| Wire `wouldMeetAgain` + `atmosphereScore` to `matchingWeightsService.ts` | P1 | `apps/server/src/matchingWeightsService.ts`, `routes.ts` |
| Add `atmosphereType` param to `generateIceBreakers()`, implement sequencing | P2 | `apps/server/src/matchExplanationService.ts` |
| Extend `generatePairExplanation()` with group context input | P2 | `apps/server/src/matchExplanationService.ts` |
| Create `eventScenarioService.ts`, integrate with theme + venue services | P2 | New file, `eventThemeTitleGenerator.ts`, `venueAssignmentService.ts` |
| Expose `AtmospherePrediction` in match reveal UI | P2 | `BlindBoxEventDetailPage.tsx`, `SquadUnboxingFlow.tsx` |
| Outcome instrumentation dashboard (admin portal) | P3 | `apps/admin-client/src/` |

### Phase 2 — Predictive Compatibility Enrichment (Q4 2026–Q1 2027)

| Task | Prerequisite | Files Affected |
|------|-------------|----------------|
| Implement `embeddingClient.ts`; build user semantic profiles | Phase 1 data (500+ events) | New `apps/server/src/ai/embeddingClient.ts`, `inference/hybridSemantic.ts` |
| Add `semanticSimilarity` as 7th pair score dimension | Embedding client live | `apps/server/src/poolMatchingService.ts` |
| Create `archetype_pair_feedback_stats` table + calibration logic | Phase 1 feedback pipeline | `packages/shared/src/schema.ts`, `poolMatchingService.ts`, `archetypeChemistry.ts` |
| Add group role balance scoring to `calculateGroupDiversity()` | None | `apps/server/src/poolMatchingService.ts` |
| Train first lightweight predictive compatibility model | 500+ labeled outcomes | New `apps/server/src/models/compatibilityModel/` directory |
| Implement confidence-aware reranking in `matchEventPool()` | Trained model | `apps/server/src/poolMatchingService.ts` |
| Offline backtest framework + A/B test infrastructure | Phase 1 data pipeline | New `apps/server/src/experiments/` directory |

### Phase 3 — Latent Compatibility Intelligence (Q2 2027+)

| Task | Prerequisite | Files Affected |
|------|-------------|----------------|
| Define `user_latent_state` schema + behavioral signal pipeline | Phase 2 stable | `packages/shared/src/schema.ts`, new `latentStateService.ts` |
| Build latent vector computation from behavioral signals | 1000+ outcome records | `apps/server/src/latentStateService.ts`, `poolMatchingService.ts` |
| Add contextual pair/group memory to group formation | `user_latent_state` live | `apps/server/src/poolMatchingService.ts` |
| Implement `generatePersonalizedExplanation()` with latent state context | Latent state live | `apps/server/src/matchExplanationService.ts` |
| Design and ship multimodal opt-in consent UI | Fairness audit complete | `apps/user-client/src/pages/` |
| Multimodal signal extraction (MiniMax 多模态) | Consent UI + audit done | `apps/server/src/ai/minimaxClient.ts`, new `multimodalEnrichmentService.ts` |

---

## 9. Key Source Files

| File | Purpose | Phase |
|------|---------|-------|
| `packages/shared/src/atmospherePrediction.ts` | Rule-based atmosphere prediction; `AtmosphereType` enum (5 values: `high_energy`, `warm_cozy`, `balanced`, `deep_connect`, `creative_spark`) | 1 |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Canonical chemistry matrix (shared reference, used by analytics + clients) | 1, 2 |
| `apps/server/src/archetypeChemistry.ts` | Live chemistry matrix at match time; `ARCHETYPE_ENERGY` map (30–95 scale, 12 archetypes) | 1, 2 |
| `apps/server/src/poolMatchingService.ts` | Core matching algorithm — `matchEventPool()`, `calculateGroupPairScore()`, `calculateGroupDiversity()`, 6-dimension pair weights | 1, 2, 3 |
| `apps/server/src/matchExplanationService.ts` | Orchestration + explanation AI — `generateGroupAnalysis()`, `generateIceBreakers()`, `generatePairExplanation()` | 1, 3 |
| `apps/server/src/services/eventThemeTitleGenerator.ts` | AI event theme title generation (gated by `ENABLE_EVENT_THEME_TITLE_GENERATION`) | 1 |
| `apps/server/src/eventThemeGeneratorService.ts` | Orchestrates `generateAndSaveEventTheme()` | 1 |
| `apps/server/src/venueAssignmentService.ts` | Venue-to-group assignment logic | 1 |
| `apps/server/src/dynamicWeights.ts` | Legacy gradient descent weight update (blind-box flow) | 1, 2 |
| `apps/server/src/matchingWeightsService.ts` | Thompson Sampling bandit for pool flow weight learning | 1, 2 |
| `apps/server/src/inference/hybridSemantic.ts` | DeepSeek-assisted semantic attribute inference (low-confidence attribute validation; not embedding similarity) | 2 |
| `apps/server/src/ai/minimaxClient.ts` | MiniMax client (`minimax-m2.7`); also used for multimodal in Phase 3 | 1, 3 |
| `apps/server/src/ai/socialModelRouter.ts` | Routes social AI calls to MiniMax or DeepSeek based on `SOCIAL_AI_PROVIDER` env | 1, 2 |
| `apps/server/src/ai/creativeModelRouter.ts` | Routes creative AI calls (themes, scenarios) | 1 |
| `apps/server/src/socialIcebreakerAIService.ts` | AI service for Social Icebreaker phases | 1 |
| `packages/shared/src/schema.ts` | Drizzle DB schema — all tables referenced above | All |
| `apps/user-client/src/hooks/useInviteData.ts` | `useMatchExplanations()` — client fetch for AI explanations | 1 |
