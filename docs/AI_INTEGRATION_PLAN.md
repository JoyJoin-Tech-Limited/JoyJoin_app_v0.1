# JoyJoin AI Integration Plan

> **Status:** Living document — last revised 2026-03-30  
> **Scope:** Phased AI roadmap for latent social compatibility modeling — from near-term experience enhancements through predictive learning to long-horizon latent intelligence.

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
   - [1.4 LLM Provider Architecture](#14-llm-provider-architecture)
2. [Phase 1 — AI-Enhanced Social Experience & Match Quality Infrastructure](#2-phase-1--ai-enhanced-social-experience--match-quality-infrastructure)
3. [Phase 2 — Predictive Compatibility Enrichment](#3-phase-2--predictive-compatibility-enrichment)
4. [Phase 3 — Latent Compatibility Intelligence](#4-phase-3--latent-compatibility-intelligence)
5. [Cross-Phase Data & Model Flow](#5-cross-phase-data--model-flow)
6. [Evaluation, Experimentation & Model Governance](#6-evaluation-experimentation--model-governance)
7. [Fairness, Safety & Multimodal Guardrails](#7-fairness-safety--multimodal-guardrails)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Key Source Files](#9-key-source-files)
10. [Budget-Optimized Execution Plan](#10-budget-optimized-execution-plan)
    - [10.1 Revised v1 Scope — Narrowed for Practical Delivery](#101-revised-v1-scope--narrowed-for-practical-delivery)
    - [10.2 Budget & Latency Guidance](#102-budget--latency-guidance)
    - [10.3 Tightened Phased Rollout (Phases A–E)](#103-tightened-phased-rollout-phases-ae)
    - [10.4 Admin / Ops Visibility Requirements](#104-admin--ops-visibility-requirements)
    - [10.5 Success Gating](#105-success-gating)


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

### 1.3 Current State (as of 2026-03-26)

| Area | Feature | Status |
|------|---------|--------|
| Match scoring | Rule-based 6-dimension pair score | ✅ Live — `poolMatchingService.ts` |
| Atmosphere prediction | `predictAtmosphere()` rule engine | ✅ Live — `atmospherePrediction.ts` |
| Match explanation | MiniMax/DeepSeek pair explanations + icebreakers (via `socialModelRouter`) | ✅ Live — `matchExplanationService.ts` |
| Group analysis | AI group analysis endpoint + client hook | ✅ Live — `GET /api/pool-groups/:groupId/analysis`, `useGroupAnalysis` |
| Group analysis UI | Rich AI analysis in `PostMatchEventCard` | ✅ Live — `PostMatchEventCard.tsx` |
| Squad reveal | Cinematic progressive reveal of group analysis | ✅ Live — `SquadUnboxingFlow.tsx` |
| Event theme title | AI-generated group theme title | ✅ Live — `eventThemeTitleGenerator.ts` |
| Weight learning | Thompson Sampling bandit | ✅ Available — `matchingWeightsService.ts` (admin evolution + `userMatchingService.ts`; not yet wired into `poolMatchingService.ts`) |
| Weight learning | Gradient descent | ⚠️ Legacy / experimental — `dynamicWeights.ts` (not active in current pool matching) |
| Interest matching | Static Jaccard + heat bonus | ✅ Live — `poolMatchingService.ts` |
| Temporal interest decay | Heat-weighted by recency | ❌ Dropped — see §2.2 |
| Interest profile editability | User can revisit and update full interest carousel | ✅ Shipped — `EditInterestsCarouselPage` |
| Post-event interest nudge | Micro-update interests after each event | ✅ Shipped — `EventFeedbackFlow` interestRefresh step |
| Archetype trajectory | Blended smoothing over 30-day shifts | 🔲 Phase 1 |
| Post-event feedback loop | Atmosphere + connection radar pipeline | 🔲 Phase 1 |
| Adaptive icebreaker sequencing | Phase-aware ordering by group energy | 🔲 Phase 1 |
| Hybrid embedding layer | Semantic cosine similarity dimension | 🔲 Phase 2 |
| Chemistry matrix calibration | Feedback-bounded empirical correction | 🔲 Phase 2 |
| Group role / energy balance | Pre-formation role composition scoring | 🔲 Phase 2 |
| Predictive compatibility scoring | Outcome-trained compatibility model | 🔲 Phase 2 |
| Latent user state modeling | Behavioral embeddings, contextual memory | 🔲 Phase 3 |
| Multimodal signal enrichment | Audio/visual cues with consent & fairness | 🔲 Phase 3 |

### 1.4 LLM Provider Architecture

JoyJoin runs a **dual-provider LLM layer** that is live in production today. Both providers share an OpenAI-compatible interface; for router-managed AI functions, routing is controlled by environment variables so the preferred provider for those functions can be changed without a code deploy. Some services (e.g. inline DeepSeek callers) still instantiate a provider client directly and must be updated in code if their provider needs to change.

#### Provider Overview

| Provider | Model | Env var | Base URL | Client file |
|---|---|---|---|---|
| **MiniMax** | `minimax-m2.7` (overridable via `MINIMAX_MODEL`) | `MINIMAX_API_KEY` | `https://api.minimax.chat/v1` (overridable via `MINIMAX_BASE_URL`) | `apps/server/src/ai/minimaxClient.ts` |
| **DeepSeek** | `deepseek-chat` | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | Instantiated inline in each service |

**MiniMax client details** (`minimaxClient.ts`):
- Lazy-initialized singleton; returns `null` when `MINIMAX_API_KEY` is not set — no error at module load
- Timeout: 15 000 ms (overridable via `MINIMAX_TIMEOUT_MS`)
- `maxRetries: 2`
- Exports: `getMiniMaxClient()`, `isMiniMaxAvailable()`, `getMinimaxModel()`, `MINIMAX_MODEL`, `MINIMAX_DEFAULT_MODEL`, `isMinimaxEnabled` (alias for `isMiniMaxAvailable`), `getMinimaxClient` (alias), `minimaxClient` (module-load-time singleton)

**DeepSeek client details**:
- No single shared client module — each service manages its own `OpenAI` DeepSeek client
- **`socialModelRouter.ts`**: lazy-initialized singleton using a `'dummy-key-for-fallback'` so the router can be safely imported in MiniMax-only environments; real DeepSeek calls still require `DEEPSEEK_API_KEY`
- **Some services** (e.g. certain analytics/explanation helpers): create module-load-time singletons with a dummy key, mirroring the MiniMax pattern so that import is cheap but real calls still check `DEEPSEEK_API_KEY` before use
- **Other services** (e.g. `apps/server/src/matchExplanationService.ts`, `apps/server/src/inference/llmFallbackInference.ts`): instantiate `new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY })` at module load with no dummy key / no lazy init — these require `DEEPSEEK_API_KEY` to be set in any environment where the module is executed
- New DeepSeek usage should generally prefer the lazy/dummy-key patterns (as in `socialModelRouter.ts`) to avoid hard failures on import in MiniMax-only deployments

#### Three Routing Layers

**Layer 1 — `socialModelRouter.ts`: Social experience functions**

Controlled by env var `SOCIAL_AI_PROVIDER`:

| Value | Behaviour |
|---|---|
| `hybrid` *(default)* | MiniMax for designated functions; DeepSeek for the rest |
| `minimax` | All social functions use MiniMax |
| `deepseek` | All social functions use DeepSeek |

Key exports:
- `getClientForFunction(fn: SocialFunction): ClientSelection` — returns `{ client, model, provider }` for a given function
- `callSocialAI(params): Promise<SocialAICallResult>` — unified call interface; MiniMax-first with automatic DeepSeek fallback on any error; returns `{ content, provider, latencyMs }`

`SocialFunction` values: `generateWarmupTopics`, `generateXiaoYueComment`, `generateRecapSummary`, `generateLieDetectiveStatements`, `generateMicroChallenges`, `generatePersonalityDiceChallenges`, `generatePairExplanation`, `generateIceBreakers`, `analyzeComplexSemantics`.

In **`hybrid` mode** (default when `SOCIAL_AI_PROVIDER` is not set), `MINIMAX_DESIGNATED_FUNCTIONS` pins six functions to MiniMax:

| Function | Hybrid-mode provider |
|---|---|
| `generateWarmupTopics` | **MiniMax** |
| `generateXiaoYueComment` | **MiniMax** |
| `generateRecapSummary` | **MiniMax** |
| `generateLieDetectiveStatements` | **MiniMax** |
| `generatePairExplanation` | **MiniMax** |
| `generateIceBreakers` | **MiniMax** |
| `generateMicroChallenges` | DeepSeek |
| `generatePersonalityDiceChallenges` | DeepSeek |
| `analyzeComplexSemantics` | **DeepSeek** (forced — structured JSON inference) |

`callSocialAI` logs `[socialAI] {callerTag} provider={minimax|deepseek} latency={n}ms` on every call for observability.

---

**Layer 2 — `creativeModelRouter.ts`: Creative / identity generation functions**

Three-level resolution order per function:
1. Function-level env override (e.g. `CREATIVE_AI_TAGS_PROVIDER=deepseek`)
2. Global override `CREATIVE_AI_PROVIDER=minimax|deepseek`
3. Auto-default: MiniMax if `MINIMAX_API_KEY` is set, otherwise DeepSeek

Exported resolver functions and their callers:

| Resolver | Env override | Consumed by |
|---|---|---|
| `getTagGenerationProvider()` | `CREATIVE_AI_TAGS_PROVIDER` | `tagGenerationService.ts` |
| `getThemeLLMProvider()` | `CREATIVE_AI_THEME_PROVIDER` | `themeLLMService.ts` |
| `getEventThemeTitleProvider()` | `CREATIVE_AI_TITLE_PROVIDER` | `eventThemeTitleGenerator.ts` |

Service-level resilience:
- `themeLLMService.ts`: validate-and-retry up to 3 attempts; falls back to a deterministic rule-based theme if all LLM attempts fail or produce invalid output
- `tagGenerationService.ts`: content-moderation blacklist validation on every generated tag before returning; falls back to rule-based tags if all LLM-generated tags fail validation

---

**Layer 3 — Direct DeepSeek: Attribute inference fallback (implemented, not yet wired)**

`apps/server/src/inference/llmFallbackInference.ts` defines a **direct DeepSeek client** (not routed through either router above) with `callLLMForInference()` intended to trigger when:
- Rule matching fails (no regex hit)
- Confidence < 0.5 after 2+ questions
- `career` or `expectation` dimensions have confidence < 0.6
- Semantic conflict detected in extracted attributes

Configuration: `temperature: 0.3`, `max_tokens: 500`. Returns structured JSON `{ insights[], confidence, reasoning? }`.

> **Note:** `callLLMForInference()` and `checkLLMFallbackNeeded()` are implemented in this file but currently have no callers in the runtime flow. This layer is planned for activation in Phase 1 attribute inference work.

#### Full Per-Function Routing Table (Production)

| Function / Service | Preferred Provider | Fallback | Router | Env Override |
|---|---|---|---|---|
| `generateWarmupTopics` | MiniMax | DeepSeek | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| `generateXiaoYueComment` | MiniMax | DeepSeek | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| `generateRecapSummary` | MiniMax | DeepSeek | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| `generateLieDetectiveStatements` | MiniMax | DeepSeek | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| `generatePairExplanation` | **MiniMax** | DeepSeek | `socialModelRouter` (via `matchExplanationService.ts`) | `SOCIAL_AI_PROVIDER` |
| `generateIceBreakers` | **MiniMax** | DeepSeek | `socialModelRouter` (via `matchExplanationService.ts`) | `SOCIAL_AI_PROVIDER` |
| `analyzeComplexSemantics` | DeepSeek (forced) | — | `socialModelRouter` (via `hybridSemantic.ts`) | `SOCIAL_AI_PROVIDER` |
| `generateMicroChallenges` | DeepSeek | — | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| `generatePersonalityDiceChallenges` | DeepSeek | — | `socialModelRouter` | `SOCIAL_AI_PROVIDER` |
| Social tag generation (`generateSocialTags`) | MiniMax (if set) | DeepSeek | `creativeModelRouter` | `CREATIVE_AI_TAGS_PROVIDER` |
| Event theme LLM (`generateThemeWithLLM`) | MiniMax (if set) | DeepSeek | `creativeModelRouter` | `CREATIVE_AI_THEME_PROVIDER` |
| Event theme title (`generateEventThemeTitle`) | MiniMax (if set) | DeepSeek | `creativeModelRouter` | `CREATIVE_AI_TITLE_PROVIDER` |
| Planned attribute inference fallback (experimental, `callLLMForInference`) | DeepSeek (planned) | — | Direct — planned, not yet wired; no router | — |

#### Phase Evolution of the Provider Layer

| Phase | Provider layer change |
|---|---|
| **Phase 1 (current)** | Both providers active as described above. Phase 1 feature work (icebreaker sequencing, scenario service, group-context explanations) slots into the existing routing with no changes to the provider layer. |
| **Phase 2** | `embeddingClient.ts` (new file, modelled after `minimaxClient.ts`) added as a **third provider slot** dedicated to vector embedding API calls. Embedding calls are not routed through `socialModelRouter` or `creativeModelRouter` — they are a separate background compute path consumed by `hybridSemantic.ts`. |
| **Phase 3** | `minimaxClient.ts` is extended for multimodal input processing (`minimax-m2.7` already supports this natively). No new infrastructure client is needed — multimodal is an additional call pattern on the existing MiniMax client, gated by consent UI and fairness audit. |

---

## 2. Phase 1 — AI-Enhanced Social Experience & Match Quality Infrastructure

### 2.1 Design Goals

Phase 1 has two parallel tracks:

- **Experience track:** Make the social moment richer and more resonant using AI orchestration and explanation — without waiting for learned signals.
- **Infrastructure track:** Instrument the data pipelines that Phase 2 and Phase 3 depend on. Phase 1 is the foundation; its measurement work is as important as its feature work.

### 2.2 Interest Profile Freshness — Editable Carousel + Post-Event Nudge

**Architectural decision (2026-03-24):** Temporal heat decay was evaluated and rejected for JoyJoin's interest model. See rationale below.

#### Why decay was dropped

JoyJoin's 56-topic interest carousel captures **identity-level passions** (hiking, jazz, entrepreneurship, philosophy) — not ephemeral preferences. These are self-concept signals that change over years, not weeks. Applying a 45-day half-life decay to onboarding data would:

1. Silently penalise loyal users purely for time spent on the platform (the more established a user, the worse their interest score)
2. Decay all topics equally because `user_interests.updated_at` is a **row-level onboarding timestamp** — there was no user-facing mechanism to update it per-topic
3. Optimise for a user behaviour (frequent interest updates) that the product didn't support and users were never asked to do

The correct model is: **stable declared identity, with two deliberate freshness mechanisms:**

#### Mechanism 1 — Editable Interest Carousel (profile layer)

Users can revisit and update their full 56-topic heat carousel from `/profile/edit` → 兴趣偏好 at any time.

**Implementation:**
- `apps/user-client/src/pages/EditInterestsCarouselPage.tsx` — edit-mode wrapper for `InterestCarousel`
- Pre-populates selections from `GET /api/user/interests`
- Saves via `POST /api/user/interests` (existing upsert endpoint, with `updatedAt = new Date()` on update)
- Route: `/profile/edit/interests` (restored in `EditProfilePage.tsx`)

When a user saves the carousel from the edit page, `user_interests.updated_at` updates to now. This makes `updated_at` a meaningful signal: it reflects intentional engagement, not just signup date.

#### Mechanism 2 — Post-Event Interest Nudge (behavioral layer)

After each event, the `EventFeedbackFlow` includes a new `"interestRefresh"` step that presents 6-8 topic chips relevant to the event type and asks: *"今晚点燃了哪些兴趣？"*

Selected topics have their heat level bumped by +1 (capped at L3) via `PATCH /api/user/interests/nudge`. This:
- Keeps interest data fresh without burdening users with manual profile updates
- Creates a natural post-event re-engagement moment
- Allows per-topic granularity: a user who loves food can bump food topics after a 饭局 without resetting unrelated interests
- Feeds a genuine behavioral signal into `user_interests.updated_at` — the timestamp now reflects when a user last confirmed/updated a topic, not just when they signed up

**API:** `PATCH /api/user/interests/nudge` — `{ boostTopicIds: string[], eventId: string }`

#### Note on event-scoped topic excitement

Per-event topic enthusiasm (e.g. *"I loved tonight's wine tasting"*) is a different signal from core identity interests. It is handled at the behavioral layer (nudge bump) and event registration layer (`preferredLanguages`, event-specific interests captured during pool registration). It should **not** be conflated with the declared profile heat model.

#### Phase 2 downstream

With `updated_at` now carrying genuine signal value, Phase 2's latent user state modeling (`user_latent_state`) can use it as a behavioral indicator: the **frequency and recency of interest nudge interactions** after events indicates active vs passive interest engagement — a richer signal than raw time decay. This is listed in §4.2 behavioral signals table ("Interest refresh engagement rate | `user_interests` + nudge API | Active vs passive interest engagement").

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

#### 2.5.0 Group Analysis & Squad Reveal (Shipped — PRs #339–344)

The group analysis surface is **live**. After pool groups are formed, users can access an AI-generated compatibility analysis via two surfaces:

**API endpoint:**
```
GET /api/pool-groups/:groupId/analysis
```
Returns `GroupAnalysisResponse` (defined in `packages/shared/src/types/groupAnalysis.ts`). Results are cached for 7 days per group roster (cache key based on group member IDs). First call generates all pair explanations in parallel via `socialModelRouter` (MiniMax preferred, DeepSeek fallback).

**Client hook:**
```typescript
// apps/user-client/src/hooks/useGroupAnalysis.ts
const { data: groupAnalysis, isLoading } = useGroupAnalysis(groupId);
// groupAnalysis: GroupAnalysisResponse | undefined
```

**PostMatchEventCard** (`apps/user-client/src/components/PostMatchEventCard.tsx`): displays pair explanations, shared interests, connection points, and icebreakers inline.

**SquadUnboxingFlow** (`apps/user-client/src/pages/SquadUnboxingFlow.tsx`): cinematic progressive reveal sequence:
1. Member archetype cards animate in
2. Overall chemistry level + label
3. Pair explanation cards fade in sequentially
4. Icebreaker cards (swipeable)
5. Group share / event action CTA

Both surfaces use `useGroupAnalysis` and wait for analysis data before advancing past a loading state.

#### 2.5.1 Stronger Match Reveal Explanations

**Current:** `matchExplanationService.ts::generatePairExplanation()` generates a 50–80 character warm sentence. This is a good foundation.

**Upgrade:** Pass `atmospherePrediction` context alongside archetype pair data so the explanation is grounded in the group's predicted energy, not just the pair in isolation.

**Current signature:**
```typescript
// apps/server/src/matchExplanationService.ts — current implementation
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember
): Promise<MatchExplanation>

// MatchExplanation return type:
// { pairKey: string; explanation: string; chemistryScore: number;
//   sharedInterests: string[]; connectionPoints: string[] }
```

**Proposed upgrade** (Phase 1):
```typescript
// Add optional groupContext parameter; extend MatchExplanation with context-aware framing
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember,
  groupContext?: {
    atmosphereType: AtmosphereType;
    groupSize: number;
    dominantArchetypes: string[];
  }
): Promise<MatchExplanation>
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
| Interest `updatedAt` read rate | `user_interests` | Phase 1 freshness validation |
| Interest carousel edit rate | `user_interests.updatedAt` post-edit | Phase 1 interest freshness baseline |
| Post-event interest nudge completion rate | `EventFeedbackFlow` analytics | User engagement with interest refresh |
| Post-event topic boost distribution | `PATCH /api/user/interests/nudge` | Which topic categories resonate per event type |
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
| Interest refresh engagement rate | `user_interests.updatedAt` + nudge API call log | Active vs passive interest engagement |

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
| Restore interest carousel as editable profile section | P1 | `apps/user-client/src/pages/EditInterestsCarouselPage.tsx` (new), `EditProfilePage.tsx`, `InterestCarousel.tsx`, `App.tsx` |
| Add post-event interest nudge step to EventFeedbackFlow | P1 | `apps/user-client/src/pages/EventFeedbackFlow.tsx`, `apps/server/src/routes.ts` |
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
| `apps/server/src/services/eventThemeTitleGenerator.ts` | Core AI event theme title generation logic (prompting + model call) | 1 |
| `apps/server/src/eventThemeTitleGenerator.ts` | Async assign/broadcast wrapper; env gating + provider routing for theme titles (gated by `ENABLE_EVENT_THEME_TITLE_GENERATION`) | 1 |
| `apps/server/src/eventThemeGeneratorService.ts` | Orchestrates `generateAndSaveEventTheme()` | 1 |
| `apps/server/src/venueAssignmentService.ts` | Venue-to-group assignment logic | 1 |
| `apps/server/src/dynamicWeights.ts` | Legacy gradient descent weight update (blind-box flow) | 1, 2 |
| `apps/server/src/matchingWeightsService.ts` | Thompson Sampling bandit weight learning — available (used in admin evolution + `userMatchingService.ts`); wiring into `poolMatchingService.ts` is a Phase 1 task | 1, 2 |
| `apps/server/src/inference/hybridSemantic.ts` | DeepSeek-assisted semantic attribute inference (low-confidence attribute validation; not embedding similarity) | 2 |
| `apps/server/src/ai/minimaxClient.ts` | MiniMax client (`minimax-m2.7`); also used for multimodal in Phase 3 | 1, 3 |
| `apps/server/src/ai/socialModelRouter.ts` | Routes social AI calls to MiniMax or DeepSeek based on `SOCIAL_AI_PROVIDER` env | 1, 2 |
| `apps/server/src/ai/creativeModelRouter.ts` | Routes creative AI calls (themes, scenarios) | 1 |
| `apps/server/src/socialIcebreakerAIService.ts` | AI service for Social Icebreaker phases | 1 |
| `packages/shared/src/schema.ts` | Drizzle DB schema — all tables referenced above | All |
| `apps/user-client/src/hooks/useInviteData.ts` | `useMatchExplanations()` — client fetch for AI explanations | 1 |

---

## 10. Budget-Optimized Execution Plan

> **Purpose:** This section supersedes the high-level phase table in §8 with a tighter, execution-focused plan that constrains scope, cost, and complexity for initial rollout. The strategic phases (1–3) in §§2–4 remain the authoritative long-horizon roadmap; this section governs *what ships first and in what order*.

### 10.1 Revised v1 Scope — Narrowed for Practical Delivery

The v1 scope deliberately avoids AI ownership of critical decision paths. AI in v1 is a **presentation and assist layer only**; deterministic server logic remains the source of truth for all matching decisions and policy.

#### Onboarding v1

| Capability | In Scope | Out of Scope |
|---|---|---|
| AI-enhanced wording | ✅ Improve question phrasing and option labels via prompt templates | ❌ Dynamic question generation or AI-driven branching |
| Lightweight scenario adaptation | ✅ Adjust summary copy tone based on declared archetype (rule-triggered prompt variant) | ❌ Real-time archetype inference during the assessment |
| Final summary generation | ✅ Generate a short, personalised 2–3 sentence result blurb after test completion | ❌ Full profile narrative, compatibility predictions, or "AI coaching" copy |

**Guiding constraint:** Onboarding AI calls must complete within the existing page render budget. Async generation is preferred; block only on final summary (user is already reading results).

#### Matching v1

| Capability | In Scope | Out of Scope |
|---|---|---|
| Deterministic shortlist preservation | ✅ `poolMatchingService.ts` output is the authoritative group list; AI cannot modify it | ❌ Any live AI reranking of groups in production |
| AI-generated match explanations | ✅ Pair explanation copy via `matchExplanationService.ts` (already live, extend with group context) | ❌ AI-authored compatibility scores presented to users |
| Intro angles | ✅ Per-pair opening conversation suggestions grounded in shared interests + archetype chemistry | ❌ Personalised advice based on prior event history (Phase 3) |
| Shadow-mode bounded reranking | ✅ Run AI rerank in shadow mode, log deltas, measure lift before any live exposure | ❌ Live rerank in v1; gated to Phase D after metrics prove uplift |

**Guiding constraint:** AI matching calls must be async and cached. No AI call may sit in the critical path of `matchEventPool()`.

#### Icebreaker v1

| Capability | In Scope | Out of Scope |
|---|---|---|
| Admin/host-assist only | ✅ AI suggestions are surfaced in the admin/host console, not pushed automatically to users | ❌ Auto-injected AI icebreakers in user-facing Social Icebreaker flow |
| Structured activity suggestions | ✅ Host receives 3–5 structured activity options (type, energy level, time estimate) with rationale | ❌ Sequenced full-event AI facilitation |
| Curated fallback templates | ✅ Static fallback library of 25+ categorised templates; AI picks from this library rather than free-generating | ❌ Fully generative icebreaker creation without fallback containment |

**Guiding constraint:** Icebreaker AI in v1 is advisory, not autonomous. Hosts review and select; the system never auto-applies an AI suggestion to a live event session.

---

### 10.2 Budget & Latency Guidance

AI features without explicit cost and latency budgets will expand silently until they degrade user experience or blow the operating budget. Each feature shipped must declare its budget upfront.

#### Per-Feature Latency Targets

| Feature | Target P95 Latency | Generation Mode |
|---|---|---|
| Onboarding final summary | ≤ 2,000 ms | Synchronous (user is waiting) |
| Onboarding wording variants | ≤ 500 ms | Pre-generated at session start |
| Match explanation (pair) | ≤ 3,000 ms per pair | Async, cached 7 days |
| Match intro angles | ≤ 3,000 ms per pair | Async, piggybacked on explanation call |
| Icebreaker host suggestions | ≤ 4,000 ms | Async, host-triggered on demand |
| Shadow rerank (Phase D) | No user-visible latency | Background batch job, post-formation |

#### Per-Feature AI Cost Targets

Define a monthly token budget per feature category before enabling in production. Suggested initial allocation:

| Category | Monthly Token Budget | Primary Model Tier |
|---|---|---|
| Onboarding summaries | Low (< 5K calls/month at launch scale) | DeepSeek `deepseek-chat` (sufficient for short copy) |
| Match explanations | Medium (cached; effective call rate << raw group count) | MiniMax (already default via `socialModelRouter`) |
| Icebreaker host assist | Low (host-triggered, admin portal only) | DeepSeek `deepseek-chat` |
| Shadow rerank scoring | Medium (batch, not real-time) | DeepSeek `deepseek-chat` |
| Personalized explanations (Phase 3) | High — defer until Phase 3 | MiniMax or future model |

#### Model Tiering Principles

1. **Use DeepSeek for structured output and short-copy tasks** where JSON extraction, list generation, or concise prose is the goal. Cost-per-token is lower; latency is acceptable.
2. **Use MiniMax for tonal, expressive copy** where warmth, narrative quality, and Chinese social register matter (match reveals, pair explanation copy, XiaoYue commentary).
3. **Do not route structured inference (attribute extraction, schema validation) through MiniMax.** Keep `analyzeComplexSemantics` and `callLLMForInference` on DeepSeek (already enforced in `socialModelRouter.ts`).
4. **Gate expensive models behind feature flags.** No new MiniMax usage ships without a budget sign-off; default new feature calls to DeepSeek unless tonal quality is the primary success criterion.

#### Evaluator Usage Policy

Running an evaluator (quality-check LLM call) on every generation step doubles cost and latency without proportional benefit at early scale. Apply evaluators **conditionally**:

- **Evaluate on sampling (1–5% of calls)** for features already in production with stable prompts (match explanations, icebreaker suggestions).
- **Evaluate on all calls only during initial prompt validation** (first 200 production calls on a new prompt template), then switch to sampled mode.
- **Never evaluate in the user-facing critical path.** Evaluator calls must be async, logged, and non-blocking.
- Log evaluator outputs to the admin trace viewer (see §10.4) for prompt quality monitoring.

#### Caching & Async Generation Policy

| Rule | Rationale |
|---|---|
| Cache match explanations for 7 days keyed by group roster hash | Group composition is stable; regeneration wastes budget |
| Pre-generate onboarding wording variants at session start (not per question) | Eliminates per-question latency; variants are a finite set |
| Generate icebreaker host suggestions on explicit host request, not on event creation | Avoids waste when hosts never open the console |
| Shadow rerank scores computed as a batch job after group formation completes | Keeps match formation latency deterministic |
| Never call AI synchronously in `matchEventPool()` | Matching SLA must not depend on AI provider uptime |

#### Policy Synthesis Stays Deterministic and Server-Owned

AI outputs (explanation copy, suggestion text, shadow rerank deltas) are **presentation and instrumentation data only**. The following decisions are always made by deterministic server logic and are never delegated to AI output:

- Group formation and shortlist
- Score thresholds and pass/fail gates
- Hard constraint filtering (budget, gender, industry restrictions)
- Feature flag state
- User-facing permission or eligibility decisions

If an AI output would need to be trusted as a policy decision, that is a sign the feature scope has drifted and should be re-scoped.

---

### 10.3 Tightened Phased Rollout (Phases A–E)

The phases below map onto the long-horizon phases in §8 but provide a narrower, delivery-focused sequence with explicit entry and exit criteria.

```
Phase A  ──▶  Phase B  ──▶  Phase C  ──▶  Phase D (gated)  ──▶  Phase E
Foundation    Onboarding v1  Matching v1    Matching v1.5         Event
+ Infra                      + Shadow       Bounded Rerank        Momentum v1
```

#### Phase A — Foundation, Shared Contracts, Logging, Feature Flags, Admin Trace Viewer MVP

**Goal:** Make all subsequent AI work safe to ship, observable, and reversible.

| Deliverable | Notes |
|---|---|
| Feature flag system for AI features | Server-side flags; each AI feature has an explicit `ENABLE_*` env var; defaults to off |
| Shared AI call logging contract | Every AI call logs: `feature`, `model`, `provider`, `latencyMs`, `tokens`, `cacheHit`, `evaluatorUsed` |
| Per-feature budget counters | Prometheus-style counters (or simple DB-backed rolling totals) per feature per day |
| Admin trace viewer MVP | Minimal UI: searchable log of recent AI calls with latency, token usage, model, feature tag; accessible at `/admin/ai-trace` |
| Prompt registry (v1) | Flat file or DB table: `{ promptId, version, template, feature, createdAt, notes }` — enables rollback without code deploy |
| Fallback coverage audit | Verify every AI-calling code path has an explicit deterministic fallback; document gaps |

**Exit criteria:** All Phase B AI calls will emit structured logs readable in the trace viewer. Feature flags verified working (AI off → deterministic fallback in effect).

#### Phase B — Onboarding v1

**Goal:** Ship AI-enhanced onboarding wording and final summary without blocking the core onboarding funnel.

| Deliverable | Notes |
|---|---|
| AI-enhanced question wording variants | Pre-generated at session start; stored in session cache; no per-question AI call |
| Lightweight archetype-triggered scenario adaptation | Rule selects prompt variant based on early archetype signal; AI fills copy within template |
| Final summary generation | Async call on test completion; user sees result screen while summary generates; fallback = static archetype description |
| Prompt registry entries for all onboarding prompts | Version-tagged; reviewable in admin trace viewer |
| Onboarding AI metrics in trace viewer | Calls, latency distribution, fallback rate, token usage |

**Exit criteria:** Onboarding completion rate unchanged or improved vs. baseline. Summary generation fallback rate < 5%. P95 latency ≤ 2,000 ms.

#### Phase C — Matching v1 with Shadow Rerank

**Goal:** Extend live match explanations with intro angles; start instrumented shadow reranking without any live influence.

| Deliverable | Notes |
|---|---|
| Pair explanation + intro angle (combined call) | Extend `generatePairExplanation()` with intro angle output; single model call; cached |
| Group context passed to explanation (§2.5.1) | `atmosphereType`, `groupSize`, `dominantArchetypes` |
| Shadow rerank batch job | Post-formation: score groups with AI rerank signal, log delta vs. deterministic order; no user impact |
| Shadow rerank dashboard in admin trace viewer | Table: group ID, deterministic rank, shadow rank, delta, explanation; admin-only |
| Matching AI metrics in trace viewer | Explanation cache hit rate, latency, token usage per pool |

**Exit criteria:** Explanation cache hit rate ≥ 80% within 2 weeks of a pool forming. Shadow rerank logs accumulate across ≥ 10 events with measurable delta distribution before Phase D begins.

#### Phase D — Matching v1.5 Bounded Rerank (Metrics-Gated)

**Gate:** Phase D only begins when shadow rerank data across ≥ 10 events shows statistically measurable positive lift (atmosphere_score or would_meet_again improvement, p < 0.05).

**Goal:** Introduce bounded live AI reranking with hard safeguards.

| Deliverable | Notes |
|---|---|
| Bounded rerank live (feature-flagged) | AI rerank delta capped at ±2 position shifts; deterministic score preserved as primary key |
| A/B test infrastructure | Route a fraction of pools to bounded rerank arm; compare outcome labels over 4+ weeks |
| Rollback trigger | If outcome metrics regress > 5% from baseline in any 2-week window, auto-disable flag |
| Admin override | Admin portal can disable bounded rerank per pool or globally without code change |

**Exit criteria:** A/B test shows positive lift. No fairness regression detected. Admin portal rollback verified functional.

#### Phase E — Event Momentum v1 (Admin/Host Only)

**Goal:** Deliver AI-assisted event facilitation tools to admins and hosts. No autonomous AI actions visible to users.

| Deliverable | Notes |
|---|---|
| Host icebreaker suggestion console | Admin/host portal UI; AI suggests 3–5 structured activities; host selects and applies manually |
| Curated fallback template library | 25+ templates categorised by energy level and event type; AI selection prefers from this library |
| Event momentum metrics | Host selection rate, activity completion rate, icebreaker ratings; visible in admin event console |
| XiaoYue commentary assist (optional) | Host can trigger AI-drafted XiaoYue comment for a phase; host edits before sending |

**Exit criteria:** Host console used in ≥ 50% of events. Icebreaker selection-to-delivery rate ≥ 70% (hosts who see suggestions actually use them).

---

### 10.4 Admin / Ops Visibility Requirements

Operational visibility must be available **before** AI features reach users, not after. The admin portal trace viewer and console modules are **Phase A deliverables**, not Phase E nice-to-haves.

#### Core Admin Portal Modules

| Module | Purpose | Phase |
|---|---|---|
| **AI Operations Dashboard** | Top-level: daily AI call volume, total token spend, provider breakdown (MiniMax vs DeepSeek), P95 latency per feature, fallback rate per feature | A |
| **Trace Viewer** | Searchable log of individual AI calls: feature, prompt version, model, provider, latency, tokens, cache hit, evaluator result; full prompt/response on expand | A |
| **Prompt / Experiment Registry** | CRUD interface for prompt templates; version history; associate prompts with feature flags; diff view across versions | A |
| **Onboarding Intelligence Console** | Onboarding AI funnel: summary generation rate, fallback rate, wording variant distribution, completion rate by archetype; prompt quality from sampled evaluator logs | B |
| **Match Intelligence Console** | Per-pool AI explanation coverage, cache performance, intro angle quality distribution, shadow rerank delta table, bounded rerank A/B arm status | C |
| **Event Momentum Console** | Host console activity: suggestions generated, suggestions applied, icebreaker ratings, event phase AI usage; XiaoYue comment assist usage | E |
| **Feature Flag Control Panel** | Enable/disable any AI feature per environment; override model tier per feature; view active flag state; no code deploy required for AI kill-switch | A |

#### Module Ownership and Boundaries

Each module has an explicit owner and a data boundary:

- **AI Ops Dashboard + Trace Viewer + Prompt Registry:** Platform/infra team — reads from the shared AI call log; no domain-specific logic.
- **Onboarding Intelligence Console:** Onboarding team — reads from onboarding session + AI call logs filtered to `feature=onboarding_*`.
- **Match Intelligence Console:** Matching team — reads from pool matching logs, explanation cache, shadow rerank log.
- **Event Momentum Console:** Event ops team — reads from host console interaction logs + icebreaker ratings.
- **Feature Flag Control Panel:** Platform/infra team — writes to feature flag store; all other modules read-only.

Modules must **not** share mutable state. Each console reads its domain's data from dedicated log tables or filtered views. No console can modify matching algorithm state or user data directly.

#### Trace Viewer MVP Requirements

The trace viewer must be available as a minimal implementation before any Phase B AI feature ships. Minimum viable trace record:

```typescript
interface AICallTrace {
  id: string;
  timestamp: Date;
  feature: string;          // e.g. 'onboarding_summary', 'match_explanation'
  promptId: string;         // references prompt registry
  promptVersion: string;
  model: string;            // e.g. 'minimax-m2.7', 'deepseek-chat'
  provider: string;         // 'minimax' | 'deepseek'
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
  evaluatorScore?: number;  // populated when sampled evaluator ran
  userId?: string;          // nullable — some calls are not user-scoped
  groupId?: string;         // nullable — for match explanation calls
  error?: string;           // populated on failure
}
```

This schema must be agreed across all team members before Phase A concludes. Downstream consoles depend on it.

---

### 10.5 Success Gating

**Principle:** Deeper AI ownership — higher AI influence on user experience, more model calls in the critical path, higher token spend — must follow demonstrated KPI lift, not precede it. Architectural complexity should track proven ROI.

#### Gate Definitions

| Gate | Condition | Unlocks |
|---|---|---|
| **G1 — Onboarding AI baseline** | Onboarding completion rate unchanged or ↑ vs. pre-AI baseline; P95 summary latency ≤ 2,000 ms; fallback rate < 5% | Continued onboarding AI investment; Phase B deemed stable |
| **G2 — Explanation quality baseline** | Explanation cache hit rate ≥ 80%; user-facing explanation engagement rate (taps on pair explanation cards) ↑ vs. baseline | Extend explanation scope to intro angles + group context |
| **G3 — Shadow rerank signal confirmed** | ≥ 10 events with logged shadow rerank deltas; delta distribution is non-trivial (AI is not reproducing deterministic order exactly); positive correlation with `atmosphere_score` detectable | Enables Phase D (live bounded rerank A/B test) |
| **G4 — Bounded rerank lift confirmed** | A/B test over ≥ 4 weeks shows `atmosphere_score` or `would_meet_again` uplift, p < 0.05; no fairness regression | Raises bounded rerank influence cap; enables weight learning integration |
| **G5 — Host console adoption** | Host console used in ≥ 50% of events over a 4-week period; icebreaker selection-to-delivery ≥ 70% | Extends icebreaker AI to participant-visible surfaces (Phase 3 territory) |

#### Complexity Budget

The following **must not happen** before the corresponding gate is passed:

- ❌ Live AI reranking in `matchEventPool()` before G3 + G4
- ❌ AI-authored compatibility scores surfaced to users before G4
- ❌ Auto-injected AI icebreakers in user-facing Social Icebreaker flow before G5
- ❌ Personalized explanations using behavioral history (Phase 3) before G4 + 1,000+ `event_group_outcomes` records
- ❌ Any new MiniMax model calls in the critical render path before a latency budget analysis is documented and approved

Each gate is a documented checkpoint reviewed by the product and engineering leads. Gate passage is logged in this document's revision history.
