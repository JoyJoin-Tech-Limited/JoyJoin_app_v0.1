# JoyJoin AI Agent Harness Separation Strategy

**Status:** Current-State + Next-State Architecture — Internal Engineering / Product Use  
**Last updated:** 2026-04-02  
**Scope:** AI product agent systems for Onboarding Discovery, Match Intelligence, and Event Momentum

> **Read this first for current shipped AI behavior.** Pair it with `docs/AI_INTEGRATION_PLAN.md` only when planning future phases or reviewing rollout gates; the roadmap document is not authority for what is live today.

> **Audit note (2026-03-30):** This document has been revised from a forward-looking reference memo
> to a current-state + next-state architecture guide. Sections now distinguish between **✅ Active today**,
> **⚡ Partially implemented / adjacent patterns already in repo**, and **🔲 Still proposed / future work**.
> See §0 for the current implementation map and §11–12 for codified architectural invariants.

---

## 0. Current Implementation Map

This section maps the three agent systems to what is **actually shipped in the repository today**. Use it as the ground truth when scoping new AI work or reviewing PRs.

### 0.1 What is Active Today

| System | Shipped component | Key file(s) | Notes |
|---|---|---|---|
| **Event Momentum** | Curated fallback content libraries | `apps/server/src/socialIcebreakerAIService.ts` | `FALLBACK_WARMUP_TOPICS`, `FALLBACK_MICRO_CHALLENGES`, `FALLBACK_LIE_DETECTIVE_STATEMENTS` — activated automatically when model output is invalid |
| **Event Momentum** | Live/fallback generation for all MVP phases | `apps/server/src/socialIcebreakerAIService.ts` | `generateWarmupTopics()`, `generateMicroChallenges()`, `generateLieDetectiveStatements()`, `generateRecapSummary()`, `generatePersonalityDiceChallenges()` |
| **Event Momentum** | Server-driven phase lifecycle with env-flag feature gates | `apps/server/src/socialIcebreakerPhaseConfig.ts`, `apps/server/src/routes/socialIcebreaker.ts` | `getServerEnabledPhases()` resolves active phases from env vars; `/advance` uses `getNextEligiblePhase()` — the server, not the client, owns phase transitions |
| **Event Momentum** | Beta phase scaffolding (auction, mini_script_beta) | `packages/shared/src/socialIcebreaker.ts`, `apps/server/src/socialIcebreakerPhaseConfig.ts` | Phases defined and gate-controlled; off by default (`SOCIAL_ICEBREAKER_ENABLE_AUCTION`, `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` env flags) |
| **Match Intelligence** | AI pair explanations + icebreakers with cache | `apps/server/src/matchExplanationService.ts` | `generatePairExplanation()`, `generateIceBreakers()` — composed via `generateGroupAnalysis()` and cached in `eventPoolGroups.pairExplanationsCache` / `iceBreakersCache`; `generatedAt` timestamp returned |
| **Match Intelligence** | Group analysis AI endpoint (full pipeline) | `apps/server/src/matchExplanationService.ts` | `generateGroupAnalysis()` — implements cache → AI generation → fallback → structured output pipeline; returns `fromCache: boolean`, `generatedAt` |
| **Match Intelligence** | Shared typed contract for group analysis | `packages/shared/src/groupAnalysis.ts`, `packages/shared/src/types/groupAnalysis.ts` | `MatchExplanationContract`, `GroupAnalysisContract`, `GroupAnalysisResponse` — consumed by both server and `user-client` |
| **Match Intelligence** | Interest signal boost for icebreakers / conversation topics | `apps/server/src/matchExplanationService.ts` (l.104+), `apps/server/src/conversationTopicsService.ts` | `MatchMember.interestSignals[]` — loaded via `loadInterestSignalsByUserIds()` in `routes.ts`; used to enrich prompts for group analysis and blind-box conversation topics; does **not** affect `poolMatchingService.ts` pair scores |
| **Match Intelligence** | Dual-provider LLM routing (social + creative) | `apps/server/src/ai/socialModelRouter.ts`, `apps/server/src/ai/creativeModelRouter.ts` | `callSocialAI()` MiniMax-first + DeepSeek fallback; `getClientForFunction()` per-function routing; logs `provider=` + `latency=ms` on every call |
| **Match Intelligence** | Embedding client (background semantic profiles) | `apps/server/src/embeddingClient.ts` | `EmbeddingClient` class; resolves provider from `OPENAI_API_KEY` (preferred) or `DEEPSEEK_API_KEY`; used by the async semantic profile pipeline; not routed through social/creative model routers |
| **Onboarding Discovery** | Canonical adaptive V4 personality engine (deterministic) | `packages/shared/src/personality/` | Authoritative — AI layer must not replace this |
| **Onboarding Discovery** | Server-driven onboarding state via `nextStep` | `apps/server/src/routes.ts`, `apps/user-client/src/App.tsx` | All progression flags (`hasCompletedPersonalityTest`, `profileEssentialComplete`, etc.) are server-owned; client reads only |
| **Onboarding Discovery** | Shared AI onboarding contract | `packages/shared/src/ai/onboarding.ts` | Exports `ProfileTaglineResponse`; consumed by `profileTaglineService.ts` and the client hook |

### 0.2 Adjacent Patterns Already in Repo (Partially Realized)

These components exhibit patterns from the strategy's three-role model but were not built under the formal orchestrator abstraction. They serve as de facto reference implementations.

| Pattern | Where it lives | What it implements |
|---|---|---|
| Generator → Evaluator → Policy Synthesizer (sequential) | `apps/server/src/socialIcebreakerAIService.ts` | Each `generate*()` function: calls model, validates response shape, falls back to curated content on rejection — this IS the three-stage pattern at Level 1 |
| Generator → cache → structured output | `apps/server/src/matchExplanationService.ts` | `generateGroupAnalysis()` applies cache-check → AI call → shape validation → fallback → returns typed `GroupAnalysis` with `fromCache`, `generatedAt`, `provider`, `fallbackUsed`, and `promptVersion` metadata |
| Shared typed I/O contract | `packages/shared/src/groupAnalysis.ts`, `packages/shared/src/types/groupAnalysis.ts` | Replaces the abstract `packages/shared/src/ai/` proposal for Match Intelligence — the actual contract lives here |
| Observability fields on AI output | `packages/shared/src/types/groupAnalysis.ts`, `packages/shared/src/types/aiMeta.ts` | `GroupAnalysisResponse` now carries `fromCache`, `generatedAt`, `provider`, `fallbackUsed`, and `promptVersion`, with optional `meta: AIResponseMeta` for normalized consumers |
| Per-call provider + latency logging | `apps/server/src/ai/socialModelRouter.ts` | `[socialAI] {callerTag} provider={minimax|deepseek} latency={n}ms` on every `callSocialAI()` call |

### 0.3 Still Proposed / Not Yet Built

| Item | Status | Notes |
|---|---|---|
| `apps/server/src/services/onboardingDiscoveryOrchestrator.ts` | 🔲 Proposed | No file exists; Onboarding Discovery has no dedicated AI layer yet |
| `apps/server/src/services/matchIntelligenceOrchestrator.ts` | 🔲 Proposed | No file exists; `matchExplanationService.ts` is the de facto adjacent implementation |
| `apps/server/src/services/eventMomentumOrchestrator.ts` | 🔲 Proposed | No file exists; `socialIcebreakerAIService.ts` is the de facto implementation |
| `packages/shared/src/ai/onboarding.ts` | ✅ Shipped | File exists at `packages/shared/src/ai/onboarding.ts`; exports `ProfileTaglineResponse` contract |
| `packages/shared/src/ai/matching.ts` | 🔲 Proposed | Actual contract is in `packages/shared/src/groupAnalysis.ts` + `packages/shared/src/types/groupAnalysis.ts` |
| `packages/shared/src/ai/icebreaker.ts` | 🔲 Proposed | No dedicated shared contract; schema lives inline in `socialIcebreakerAIService.ts` |
| Prompt version tagging on all model calls | ⚡ Core shipped, rollout ongoing | Implemented on the live `matchExplanationService.ts` and `socialIcebreakerAIService.ts` paths; creative and legacy AI callers still need normalization |
| Evaluator rejection reason in observability output | ⚡ Core shipped, rollout ongoing | Core match and icebreaker services now emit structured fallback/error reasons via `logAITrace()` and `AIResponseMeta`; remaining legacy callers still vary |
| `callLLMForInference()` (attribute inference fallback) | ⚡ Shadow telemetry active | `apps/server/src/inference/llmFallbackInference.ts` — shadow-only; currently focused on low-confidence `career` / `expectation` fields, with additional dimensions scheduled when prior insights exist and allowed by `INFERENCE_RUNTIME_LLM_FALLBACK_APPROVED_FIELDS`; `llm_fallback_inference_*` Prometheus metrics active; no live callers yet |
| Thompson Sampling weight learning in pool matching | ⚡ Primary adaptive-weight path, implemented but not wired | `apps/server/src/matchingWeightsService.ts` — now the only documented adaptive-weight route; legacy `dynamicWeights.ts` gradient-descent path is deprecated |

---

## 1. Overview

JoyJoin's AI layer is designed around **three main product agent systems**, not a single general-purpose AI assistant. Each system operates as a constrained, server-side orchestration service composed of three internal functional roles:

| Internal Role | Responsibility |
|---|---|
| **Generator** | Produce candidate outputs using a language model (questions, match narratives, game plans, etc.) |
| **Evaluator** | Score, validate, or flag generated outputs against quality, safety, and policy criteria |
| **Policy Synthesizer** | Finalize the result deterministically by enforcing business rules, hard constraints, and fallback logic |

This gives a conceptual total of **9 roles across 3 systems**, but in v1 these roles do not each need to map to a fully autonomous agent process. A single orchestration service can implement all three roles for its system, sequentially, before externalizing them as deployment matures.

---

## 2. The Three Product Agent Systems

### 2.1 Onboarding Discovery Agent

**Domain:** Personality test experience and early user profiling  
**Canonical server integration:** `packages/shared/src/personality/`, `apps/server/src/routes.ts` (assessment routes), `apps/user-client/src/pages/PersonalityTestPageV4.tsx`

**What this system does:**

- Adapts question selection, phrasing, and tone during the V4 personality assessment
- Detects low-signal or inconsistent answers
- Generates user-facing interpretation summaries (post-test)
- Produces structured trait hypotheses alongside the deterministic adaptive engine

**What this system must never do:**

- Own or mutate onboarding state flags (`hasCompletedPersonalityTest`, `nextStep`, etc.)
- Replace the server-driven `nextStep` routing contract
- Introduce or consume deprecated registration fields (`hasCompletedRegistration`, legacy `registration_sessions` table)
- Bypass the canonical personality engine in `packages/shared/src/personality/`

**Role breakdown:**

| Role | Function |
|---|---|
| Generator | Produces candidate next-question variants, tone adjustments, and result explanation text |
| Evaluator | Scores variant quality, checks phrasing safety, detects inconsistency signals |
| Policy Synthesizer | Applies deterministic adaptive engine constraints; selects final `nextQuestionId`; falls back to canonical engine if generator output is invalid |

---

### 2.2 Match Intelligence Agent

**Domain:** Group matching, compatibility scoring, and match narrative generation  
**Canonical server integration:** `apps/server/src/poolMatchingService.ts`

**What this system does:**

- Generates compatibility narratives and conversation starters for matched users
- Optionally applies bounded reranking on a deterministic shortlist
- Produces grouping rationale for event-specific compositions
- Surfaces confidence tiers and friction-point warnings

**What this system must never do:**

- Override hard matching constraints (budget, gender restrictions, industry restrictions, age range)
- Replace the deterministic 6-dimension pair-scoring algorithm as the primary ranking authority
- Produce opaque ranking decisions that cannot be audited
- Generate fabricated profile facts not present in the user's actual data

**Role breakdown:**

| Role | Function |
|---|---|
| Generator | Produces compatibility narratives, intro angles, and optional rerank score adjustments within a bounded delta |
| Evaluator | Validates factual grounding, checks for unsafe content, confirms narrative consistency with source profile data |
| Policy Synthesizer | Enforces final score floor/ceiling from deterministic engine; applies safety policy; selects between AI-reranked and deterministic output based on confidence |

**Note:** The Match Intelligence system has the **highest requirement for role separation** (see Section 5). Errors here directly affect real-world social outcomes and trust.

---

### 2.3 Event Momentum Agent

**Domain:** Real-time offline social facilitation (酒吧, 饭局)  
**Canonical server integration:** `apps/server/src/socialIcebreakerAIService.ts`, `apps/server/src/routes/socialIcebreaker.ts`

**What this system does:**

- Generates structured icebreaker and facilitation game plans based on event context
- Adapts output to venue type, group energy, personality distribution, and event stage
- Produces host scripts, player instructions, and fallback variants
- Supports the multi-phase Social Icebreaker session lifecycle (`warmup → micro_challenge → lie_detective → recap`)

**What this system must never do:**

- Generate freeform output delivered directly to end users without schema enforcement
- Propose games that require unavailable materials, exceed timing constraints, or assume emotional intimacy too early
- Bypass the Social Icebreaker phase lifecycle managed by the server
- Expose raw model reasoning to attendees

**Role breakdown:**

| Role | Function |
|---|---|
| Generator | Produces candidate game plans, host scripts, player instructions, and adaptation variants |
| Evaluator | Scores feasibility, safety, timing, venue fit, and group suitability |
| Policy Synthesizer | Enforces operational constraints (no props unless flagged, max explanation time, stranger-appropriate tone, Chinese-language UX); activates fallback game library on failure |

---

## 3. Separation Level Definitions

The following levels describe how independently each role operates at runtime. Higher levels provide stronger isolation, independent scalability, and cleaner evaluation — but add operational complexity.

| Level | Name | Description |
|---|---|---|
| **0** | **Fully Merged** | All three roles run inside a single function or service call with no boundary between them. No independent testing or deployment. |
| **1** | **Sequential Stages** | Generator, Evaluator, and Policy Synthesizer are distinct code modules called in sequence within a single orchestration service. Deployable as one unit; roles are independently testable. |
| **2** | **Isolated Services** | Each role is a separate internal service or class with its own schema contract, callable independently. Deployed together but independently versioned and mockable. |
| **3** | **Runtime-Separated Processes** | Each role runs as a distinct server-side process or worker. Independent scaling, independent failure domains, async handoff possible. Increases operational overhead. |
| **4** | **Fully Autonomous Agents** | Each role is a self-directing agent with its own tool access, memory, and planning horizon. Suitable only for mature, high-trust agent surfaces with strong eval infrastructure. |

---

## 4. v1 Architecture Recommendation

In v1, implement **3 orchestration services** — one per product agent system. **Onboarding Discovery** and **Event Momentum** should start at **Separation Level 1** (sequential Generator → Evaluator → Policy Synthesizer stages inside one orchestration service). **Match Intelligence is the deliberate v1 exception:** it should still be orchestrated as one product system, but with stronger internal separation from day one, targeting **Level 1–2 for the Generator** and **Level 2 for the Evaluator and Policy Synthesizer**.

> **Adjacency note (2026-03-30):** The formal orchestrator files below have not yet been created. However,
> `apps/server/src/socialIcebreakerAIService.ts` (Event Momentum) and `apps/server/src/matchExplanationService.ts`
> (Match Intelligence) already implement the three-role pipeline at Separation Level 1. New orchestrator work should
> **extend these existing services deliberately** rather than duplicating logic under new files with vague boundaries.
> The "Phase 0" infrastructure work (shared contracts, observability hooks) is partially realized — see §0.2 and §0.3.

> **🔲 Proposed files (to be created):** The `apps/server/src/services/` directory already exists (see `eventThemeTitleGenerator.ts`). The orchestrator files below are the recommended new additions:

```
apps/server/src/services/
  onboardingDiscoveryOrchestrator.ts   ← Separation Level 1 (v1) — proposed
  matchIntelligenceOrchestrator.ts     ← Separation Level 1–2 (v1) — proposed
  eventMomentumOrchestrator.ts         ← Separation Level 1 (v1) — proposed
```

> **🔲 Proposed files (to be created):** The `packages/shared/src/ai/` directory does not yet exist.
> For **Match Intelligence**, the actual shared contract already exists at `packages/shared/src/groupAnalysis.ts`
> and `packages/shared/src/types/groupAnalysis.ts` — extend those rather than creating a duplicate.
> For the other two systems, create the `packages/shared/src/ai/` directory as part of Phase 0:

```
packages/shared/src/ai/
  onboarding.ts    ← input/output schemas for Onboarding Discovery — proposed
  icebreaker.ts    ← input/output schemas for Event Momentum — proposed
  (matching.ts omitted — use packages/shared/src/groupAnalysis.ts + types/groupAnalysis.ts instead)
```

Each orchestrator implements the same structural stages:

1. Input normalization and context assembly
2. Prompt construction (versioned)
3. Generator call (model)
4. Evaluator stage (schema validation + quality/safety scoring)
5. Policy Synthesizer (deterministic business rule enforcement)
6. Fallback activation if evaluator rejects output
7. Structured output return + logging and observability metadata emission

---

## 5. Recommended Separation Table

The following table covers all 9 conceptual roles across the three systems. Each row specifies the v1 separation level, recommended v2+ upgrade path, and rationale.

| System | Role | v1 Separation Level | v2+ Upgrade Path | Rationale |
|---|---|---|---|---|
| **Onboarding Discovery** | Generator | Level 1 (sequential stage) | Level 2 (isolated service) | Onboarding volume is moderate; sequential staging is sufficient for initial eval. Move to Level 2 when A/B testing question variants at scale. |
| **Onboarding Discovery** | Evaluator | Level 1 (sequential stage) | Level 2 (isolated service) | Safety risk is low (no hard social outcomes). Rule-based evaluation inline is acceptable in v1. |
| **Onboarding Discovery** | Policy Synthesizer | Level 1 (deterministic inline) | Level 1–2 | Must remain strongly tied to canonical personality engine; independent deployment adds little value. |
| **Match Intelligence** | Generator | Level 1–2 (isolated class, same service) | Level 3 (separate process) | Match narrative generation benefits from early isolation to allow independent prompt versioning and evaluation against ground-truth match outcomes. |
| **Match Intelligence** | Evaluator | Level 2 (isolated service) | Level 3 (separate process) | Evaluator needs to run independently against real match outcome data. Factual grounding checks and safety checks for matching are higher-stakes than onboarding. |
| **Match Intelligence** | Policy Synthesizer | Level 2 (isolated service) | Level 2 | Policy is complex (6-dimension scoring, hard constraint enforcement). Keep deterministic and independently testable from v1 onwards. Must never be merged back into the generator. |
| **Event Momentum** | Generator | Level 1 (sequential stage) | Level 2 (isolated service) | Live event generation volume is low in v1; sequential is sufficient. Isolate when hosts request regeneration at high frequency or when multiple venues are served in parallel. |
| **Event Momentum** | Evaluator | Level 1 (sequential stage) | Level 2 (isolated service) | Feasibility/safety checks can be inline in v1. Move to Level 2 before enabling automated regeneration without host review. |
| **Event Momentum** | Policy Synthesizer | Level 1 (deterministic inline) | Level 1–2 | Constraint set is finite and stable (venue type, timing, group size, stranger-appropriateness). Deterministic inline is correct and sufficient. |

### Why Matching Requires the Strongest Separation

Match Intelligence has the highest requirement for role separation for three reasons:

1. **Direct social trust impact.** Match outcomes affect real-world human interactions and trust in the platform. A match narrative that is factually wrong or tonally off is not recoverable in the moment.
2. **Hard constraint auditability.** The 6-dimension scoring algorithm (`poolMatchingService.ts`) must remain the authoritative ranking authority. The Evaluator and Policy Synthesizer must be independently verifiable as enforcing this guarantee — not as post-hoc wrappers.
3. **Evaluation feedback loop.** Improving match quality requires tying evaluator signals to downstream outcomes (match acceptance rate, event satisfaction). This loop is only tractable if the Evaluator role is independently addressable as a testable service.

Onboarding and Event Momentum can start lighter because:

- **Onboarding** errors are recoverable (personality test retake is low-cost) and the downstream consequence is bounded to question UX quality.
- **Event Momentum** operates under live host supervision, so a bad game plan can be discarded before reaching attendees.

---

## 6. Implementation Guidance

### 6.1 What Should Be Deterministic vs. Model-Based

| Concern | Approach |
|---|---|
| Onboarding state transitions (`nextStep`, completion flags) | **Deterministic always.** Never delegate to a model. |
| Personality question selection logic | **Deterministic by default.** Model suggests; canonical engine approves. |
| Match hard constraints (budget, gender, industry, age range) | **Deterministic always.** Policy Synthesizer enforces before returning any result. |
| Match pair scoring (6-dimension algorithm) | **Deterministic always.** AI reranking is bounded adjustment on shortlisted candidates only. |
| Match narrative and intro text | **Model-based.** Structured output schema enforced by Evaluator. |
| Icebreaker game plan content | **Model-based.** Operational constraints enforced by Policy Synthesizer. |
| Icebreaker fallback game library | **Deterministic always.** Activated when evaluator rejects generator output. |
| Schema validation of all agent outputs | **Deterministic always.** Never trust model output as structurally valid without validation. |

### 6.2 What Not to Do in v1

- **Do not give any agent direct write access to onboarding flags.** All state writes go through existing server routes with their own validation.
- **Do not expose raw model reasoning or internal chain-of-thought to end users.** All user-facing content must pass through the Policy Synthesizer output schema.
- **Do not skip the Evaluator stage to reduce latency.** If latency is a concern, pre-generate and cache, but never bypass evaluation.
- **Do not merge the Policy Synthesizer into the Generator.** This is the most common way to accidentally let the model override business rules.
- **Do not use legacy onboarding fields** (`registration_sessions`, `hasCompletedRegistration`) as input context for any agent.
- **Do not make matching Agent the primary ranking authority.** It is a bounded explainer and optional soft reranker. `poolMatchingService.ts` remains authoritative.
- **Do not launch Event Momentum with automated attendee delivery.** In v1, all generated content should pass through host review before reaching attendees.

### 6.3 Rollout Phases

> **Status update (2026-03-30):** Several Phase 0 infrastructure primitives are already realized in the repo.
> The table below reflects current state.

| Phase | System | Scope | Status |
|---|---|---|---|
| **Phase 0** | All | Build shared harness infrastructure: `packages/shared/src/ai/` schemas, server AI client wrapper, logging/observability hooks, feature flags, fallback contract pattern. | ⚡ **Partially realized.** Dual-provider routing (`socialModelRouter.ts`, `creativeModelRouter.ts`) is live. Match Intelligence shared contract is live (`packages/shared/src/groupAnalysis.ts`). Curated fallback libraries are active. Core prompt-version tagging and structured fallback-rejection observability are live on `matchExplanationService.ts` and `socialIcebreakerAIService.ts`; creative and legacy surfaces are still being normalized. |
| **Phase 1** | Event Momentum | Deploy `eventMomentumOrchestrator`. Scope: structured game plan generation for 酒吧 and 饭局. Host-supervised delivery only. Curated fallback game library must be active before launch. | ⚡ **Core functionality live** in `socialIcebreakerAIService.ts` at Level 1. Formal `eventMomentumOrchestrator.ts` wrapper is 🔲 still proposed. |
| **Phase 2** | Onboarding Discovery | Deploy `onboardingDiscoveryOrchestrator`. Scope: question phrasing adaptation, low-signal detection, result explanation. Server-owned progression must be verified as unchanged. | 🔲 **Not yet started.** Canonical engine in `packages/shared/src/personality/` is deterministic only. |
| **Phase 3** | Match Intelligence | Deploy `matchIntelligenceOrchestrator`. Scope: compatibility narratives, intro suggestions, bounded reranking of deterministic shortlist. A/B tested against deterministic baseline. | ⚡ **Explanation layer live** in `matchExplanationService.ts`. Formal orchestrator wrapper + bounded reranking are 🔲 still proposed. |
| **Phase 4** | All | Cross-agent feedback loop: unify event outcome instrumentation, build evaluation dashboard, connect offline outcomes to per-system harness tuning. | 🔲 **Not yet started.** `matchingWeightsService.ts` (Thompson Sampling) is implemented but not wired into `poolMatchingService.ts`. |

### 6.4 KPI Implications by Separation Level

As role separation increases, the following product metrics become more measurable and improvable:

| Separation Level | KPI Visibility | Notes |
|---|---|---|
| **Level 0** | Minimal. Overall product metrics only; impossible to attribute to specific AI roles. | Avoid for production. |
| **Level 1** | Stage-level logging possible. Can distinguish generator failures from policy failures in structured logs. | Recommended v1 baseline. |
| **Level 2** | Independent evaluation rate, fallback activation rate, and output quality scores per role. Can A/B test generator variants independently. | Recommended for Match Intelligence from v1. |
| **Level 3** | Per-role latency SLAs, independent scaling metrics, async evaluation against delayed outcome signals. | Recommended for Match Intelligence Evaluator in v2. |
| **Level 4** | Full agent-level attribution to downstream business outcomes. Requires mature eval infrastructure and outcome data pipeline. | Not recommended until Phase 4 learning loop is established. |

Specific KPIs per system to track from Phase 1 onwards:

| System | Leading KPIs | Lagging KPIs |
|---|---|---|
| Onboarding Discovery | Completion rate, skip rate, median time-to-finish | Retest consistency, satisfaction with result explanation |
| Match Intelligence | Match view-through rate, first-message initiation rate | Post-event mutual rating, complaint rate |
| Event Momentum | Host usage rate, regeneration rate, activity completion rate | Post-event NPS, repeat event participation |

---

## 7. Shared Output Contract Shapes

The following are reference schemas. Enforce schema validation before returning any output from the Policy Synthesizer stage.

> **Match Intelligence contract status (2026-03-30):** The Match Intelligence output contract is **✅ already live**.
> Do not create a separate `packages/shared/src/ai/matching.ts` — use and extend the existing contracts:
> - `packages/shared/src/groupAnalysis.ts` — `MatchExplanationContract`, `GroupAnalysisContract`
> - `packages/shared/src/types/groupAnalysis.ts` — `GroupAnalysisResponse` (includes `fromCache`, `generatedAt`, `myPairs`)
>
> The Onboarding Discovery and Event Momentum contracts below are still 🔲 proposed.

### Onboarding Discovery Output (`packages/shared/src/ai/onboarding.ts`) — 🔲 Proposed

```typescript
interface OnboardingDiscoveryOutput {
  nextQuestionId: string;
  questionText: string;
  questionTone: 'neutral' | 'warm' | 'playful' | 'reflective';
  answerOptions: Array<{ id: string; text: string }>;
  traitHypotheses: Partial<Record<TraitKey, number>>;
  confidence: number; // 0–1
  lowSignalWarning: boolean;
  userFacingSummary?: string; // shown post-answer if present
  internalNotes?: string;    // never exposed to client
}
```

### Match Intelligence Output — ✅ Active (use existing contracts)

```typescript
// packages/shared/src/groupAnalysis.ts — MatchExplanationContract (active)
export interface MatchExplanationContract {
  pairKey: string;
  explanation: string;
  chemistryScore: number;
  sharedInterests: string[];
  connectionPoints: string[];
}

// packages/shared/src/types/groupAnalysis.ts — GroupAnalysisResponse (active)
export interface GroupAnalysisResponse {
  groupId: string;
  groupDynamics: string;
  fromCache: boolean;      // ✅ observability field: active
  generatedAt: string;     // ✅ observability field: active
  myPairs?: PairExplanation[];
  // ... see full definition in packages/shared/src/types/groupAnalysis.ts
}
```

> Note: `fallbackUsed` and `policyFlags` from the reference schema below are not yet present on the live
> `GroupAnalysisResponse`. Add them when the formal orchestrator is built.

### Match Intelligence Output — Reference schema for orchestrator expansion (`matching.ts`) — 🔲 Proposed additions

```typescript
interface MatchIntelligenceOutput {
  candidateId: string;
  compatibilityNarrative: string;
  conversationStarter: string;
  sharedStrengths: string[];
  possibleFrictionPoints: string[];
  confidence: number; // 0–1
  rerankAdjustmentDelta: number; // bounded; must not exceed policy-configured max
  policyFlags: string[];
  fallbackUsed: boolean;
}
```

### Event Momentum Output (`packages/shared/src/ai/icebreaker.ts`) — 🔲 Proposed

```typescript
interface EventMomentumOutput {
  gameTitle: string;
  goal: string;
  durationMinutes: number;
  materialsNeeded: string[]; // empty array if props-free
  idealGroupSize: { min: number; max: number };
  hostScript: string;
  playerInstructions: string;
  fallbackIfLowEnergy: string;
  fallbackIfTooNoisy: string;
  safetyNotes: string;
  suitableForVenueType: Array<'bar' | 'dinner' | 'outdoor' | 'other'>;
  suitableForStage: Array<'warmup' | 'mid' | 'deep' | 'closing'>;
  fallbackUsed: boolean;
}
```

---

## 8. Guardrail Structure (All Systems)

Every orchestrator service should implement the same 7-stage structural pipeline:

```
1. Input normalization
     Validate and normalize incoming request against input schema.
     Reject or sanitize malformed inputs before reaching the model.

2. Context assembly
     Gather only the data the generator is permitted to see.
     Do not expose deprecated fields or cross-system data without explicit need.

3. Prompt construction (versioned)
     Use version-tagged prompt templates.
     Log prompt version alongside every model call.

4. Generator call (model)
     Bounded tool access only.
     Temperature and max_tokens constrained to output schema requirements.

5. Evaluator stage
     Validate output against typed schema.
     Score quality and safety.
     Flag or reject outputs that fail minimum thresholds.

6. Policy Synthesizer
     Apply deterministic business rules.
     Enforce hard constraints.
     Activate fallback if evaluator rejected output.

7. Structured output return + logging and observability
     Return only the Policy Synthesizer-approved structured output.
     Log: prompt version, model version, input context hash, output schema validity, latency, fallback usage.
     Do not log PII or sensitive user content in unencrypted form.
```

---

## 9. Related Files

| File | Status | Relevance |
|---|---|---|
| `apps/server/src/poolMatchingService.ts` | ✅ Active | Authoritative deterministic matching core; Match Intelligence agent wraps this, never replaces it |
| `apps/server/src/matchExplanationService.ts` | ✅ Active | De facto Match Intelligence Level-1 orchestration: `generateGroupAnalysis()`, `generateGroupExplanations()`, `generateGroupIceBreakers()`; cache + retry + fallback |
| `apps/server/src/socialIcebreakerAIService.ts` | ✅ Active | De facto Event Momentum Level-1 orchestration: curated fallback libraries + model generation for all phase types |
| `apps/server/src/socialIcebreakerPhaseConfig.ts` | ✅ Active | Server-owned phase feature-flag resolution via `getServerEnabledPhases()`; beta phase scaffolding |
| `apps/server/src/routes/socialIcebreaker.ts` | ✅ Active | Social Icebreaker phase lifecycle API; Event Momentum agent must operate within this lifecycle |
| `apps/server/src/ai/socialModelRouter.ts` | ✅ Active | Unified dual-provider social AI router (`callSocialAI()`); per-function MiniMax/DeepSeek routing; logs provider + latency |
| `apps/server/src/ai/creativeModelRouter.ts` | ✅ Active | Provider resolver for creative/identity generation functions (tags, themes, event titles) |
| `packages/shared/src/groupAnalysis.ts` | ✅ Active | Shared typed contract for Match Intelligence: `MatchExplanationContract`, `GroupAnalysisContract` |
| `packages/shared/src/types/groupAnalysis.ts` | ✅ Active | `GroupAnalysisResponse` — client-facing contract; includes `fromCache`, `generatedAt` observability fields |
| `packages/shared/src/personality/` | ✅ Active | Canonical personality engine; Onboarding Discovery agent produces inputs for this, does not replace it |
| `apps/user-client/src/pages/PersonalityTestPageV4.tsx` | ✅ Active | Client-side entry point for onboarding; agent outputs are rendered here, not computed here |
| `apps/server/src/routes.ts` | ✅ Active | All API route registrations; new orchestrator routes register here; `loadInterestSignalsByUserIds()` defined here |
| `packages/shared/src/schema.ts` | ✅ Active | Database schema source of truth; agent services read but do not own schema definition |
| `apps/server/src/inference/llmFallbackInference.ts` | ⚡ Implemented, not wired | Attribute inference fallback via direct DeepSeek; `callLLMForInference()` has no runtime callers yet |
| `apps/server/src/matchingWeightsService.ts` | ⚡ Primary adaptive-weight path, implemented but not wired | Thompson Sampling weight learning; not yet connected to `poolMatchingService.ts` |
| `docs/icebreaker-system.md` | ✅ Active | Full technical reference for Social Icebreaker system |
| `docs/MATCHING_ALGORITHM_REFERENCE.md` | ✅ Active | Matching algorithm documentation; cross-reference when scoping Match Intelligence evaluator |
| `docs/PERSONALITY_TEST_SYSTEM.md` | ✅ Active | Personality test system documentation; cross-reference when scoping Onboarding Discovery |
| `docs/interest-signal-boost.md` | ✅ Active | Interest signal boost feature reference; signals flow into icebreaker/explanation prompts, not pair scoring |
| `docs/AI_INTEGRATION_PLAN.md` | ✅ Active | Phased AI roadmap including LLM provider architecture (§1.4); complementary to this document |

---

## 10. Decision Log

| Decision | Rationale |
|---|---|
| 3 systems, not 1 general agent | Each domain has distinct data access, safety requirements, and evaluation metrics. A shared agent would conflate concerns and make evaluation impossible. |
| 9 conceptual roles, not 9 deployed agents in v1 | Operational complexity of 9 independent deployments before eval infrastructure exists is not justified. Sequential staging inside 3 services provides role clarity without that overhead. |
| Matching has the strongest separation requirement | Trust, auditability, and downstream social impact are highest in matching. Evaluator must be independently testable against outcome data. |
| Policy Synthesizer is always deterministic | Generative components must not own the final policy decision. Deterministic enforcement is required for auditability and safety. |
| Fallback is mandatory before launch | Live user-facing surfaces must not degrade to raw model failure. Fallback to rule-based outputs is required for all three systems before any production launch. |
| Shared schemas in `packages/shared/src/ai/` | Consistent with repository principle that schema is the source of truth. Enables typed contracts across server and any future client that consumes agent outputs. |
| Match Intelligence contract already lives in `packages/shared/src/groupAnalysis.ts` | The formal `packages/shared/src/ai/matching.ts` was never created because a real typed contract emerged organically during group analysis implementation. Do not duplicate — extend the existing contract. |
| Adjacency over greenfield orchestration | Where existing services already behave as proto-orchestrators (`matchExplanationService.ts`, `socialIcebreakerAIService.ts`), extend them deliberately rather than duplicating logic under new files. |
| Interest signals flow into icebreaker prompts, not pair scoring | `user_interest_signals` are a soft enrichment signal for explanation quality, not a matching filter. This keeps `poolMatchingService.ts` as the single authoritative scoring authority. |
| Server owns phase lifecycle; AI generates phase content | `getServerEnabledPhases()` and `/advance` transitions are deterministic server operations. AI content generation operates within the resolved phase, never decides what phase comes next. |

---

## 11. Architecture Invariants

These are non-negotiable rules that must be preserved by all future AI work. Reviewers should reject PRs that violate them.

### 11.1 Deterministic Core is Always Authoritative

- `poolMatchingService.ts` 6-dimension pair scoring is the authoritative ranking source. AI may explain or softly rerank a deterministic shortlist, but must never produce the primary ranking.
- `packages/shared/src/personality/` adaptive engine selects personality questions deterministically. AI may suggest variants; the canonical engine approves the final selection.
- Social Icebreaker phase transitions are resolved by `getServerEnabledPhases()` + `getNextEligiblePhase()`. AI generates content within a phase; it does not determine which phase comes next.
- Onboarding state flags (`nextStep`, `hasCompletedPersonalityTest`, `profileEssentialComplete`, etc.) are server-owned. No AI layer may write or mutate these flags.

### 11.2 Shared Typed Contracts Come Before Client Exposure

- Any AI output that reaches a client must be typed by a shared contract in `packages/shared/`. Do not ship AI-to-client payloads without a TypeScript interface in the shared package.
- For Match Intelligence, the contract is `packages/shared/src/groupAnalysis.ts` + `packages/shared/src/types/groupAnalysis.ts`. Extend it; do not create parallel types.
- New AI surfaces must define their shared contract before writing the route handler.

### 11.3 Curated Fallback Libraries are Required, Not Optional

- Every user-facing AI surface must have a curated deterministic fallback library that activates when the model returns an invalid response, times out, or is unavailable.
- The pattern established in `socialIcebreakerAIService.ts` (`FALLBACK_WARMUP_TOPICS`, `FALLBACK_MICRO_CHALLENGES`, `FALLBACK_LIE_DETECTIVE_STATEMENTS`) is the canonical example. All future AI surfaces must follow it.
- Fallback must be exercised in tests before the surface ships.

### 11.4 Server-Driven Lifecycle; AI Generates Content Within Phases

- The server owns all state machines and progression logic. AI may generate content within a phase; it must not invent phases, add routes, or mutate lifecycle state directly.
- This applies equally to: Social Icebreaker phases, onboarding `nextStep`, matching pipeline steps, and any future AI-adjacent lifecycle.

### 11.5 Observability Fields on All AI Outputs

All **new or modified** structured AI outputs returned to a client or stored in the database must include:
- `fromCache: boolean` — whether the result was served from cache
- `generatedAt: string` (ISO timestamp) — when the content was generated
- `provider: string` (optional but strongly recommended) — which LLM produced the output

Existing shipped AI endpoints that do not yet include these fields (e.g. some Social Icebreaker and conversation topic endpoints listed in §0) are treated as **backlog to migrate** to this format; do not assume they are compliant today.
Future AI outputs should also add:
- `promptVersion: string` — the version tag of the prompt template used
- `fallbackUsed: boolean` — whether the curated fallback was activated
- `evaluatorRejectionReason?: string` — reason if the evaluator rejected a generator output

**Do not log raw PII or user message content in observability fields.**

### 11.6 No Legacy Onboarding Fields in AI Context

No AI service may use `registration_sessions`, `hasCompletedRegistration`, or any other field documented as legacy in `copilot-instructions.md` as input context. Use only active schema fields from `packages/shared/src/schema.ts`.

### 11.7 Interest Signals Enrich Prompts; They Do Not Score Matches

`user_interest_signals` (enthusiasm level, discussion style, conversation depth) are loaded via `loadInterestSignalsByUserIds()` in `routes.ts` and passed as `MatchMember.interestSignals[]` to explanation and icebreaker generation. They are **not** inputs to `poolMatchingService.ts` pair scoring. This distinction must be preserved to keep the scoring algorithm auditable and the explanation layer independently tunable.

---

## 12. What Future AI Changes Must Not Do

This section serves as a reviewer checklist for any PR that touches AI surfaces.

### Matching system

- ❌ Must not give AI output write access to `poolMatchingService.ts` ranking results
- ❌ Must not bypass hard matching constraints (budget, gender, industry, age range) by any AI reranking
- ❌ Must not produce match explanations that reference facts not present in the user's actual profile data
- ❌ Must not create a parallel pair-scoring path that competes with the 6-dimension algorithm
- ❌ Must not remove or weaken the `fromCache` / `generatedAt` observability fields from `GroupAnalysisResponse`

### Onboarding system

- ❌ Must not allow any AI output to write `nextStep`, `hasCompletedPersonalityTest`, or any other onboarding flag
- ❌ Must not reconstruct onboarding flow client-side based on AI predictions
- ❌ Must not replace the deterministic adaptive engine in `packages/shared/src/personality/` with a model-driven question selector
- ❌ Must not add new `nextStep` values without a corresponding server-side flag and switch case in `App.tsx`

### Event Momentum system

- ❌ Must not deliver AI-generated game content directly to attendees without passing through host review or a curated fallback gate
- ❌ Must not allow AI to add, remove, or reorder Social Icebreaker phases by mutating `enabledPhases` — only `getServerEnabledPhases()` may resolve active phases
- ❌ Must not remove curated fallback libraries from `socialIcebreakerAIService.ts`
- ❌ Must not expose raw model chain-of-thought or internal reasoning to end users

### All AI surfaces

- ❌ Must not ship a new AI-to-client payload without a shared TypeScript contract in `packages/shared/`
- ❌ Must not skip schema validation on model output before returning it from any route handler
- ❌ Must not use legacy fields (`registration_sessions`, `hasCompletedRegistration`, deprecated `interestsTop`) as AI context
- ❌ Must not use `console.warn` as the only signal for evaluator rejection — structured `fallbackUsed` must be returned in the response
- ❌ Must not introduce a new DeepSeek or MiniMax client without evaluating whether `socialModelRouter.ts` or `creativeModelRouter.ts` is the right integration point

---

*This document is intended as a durable engineering and product reference. Update the Decision Log, Architecture Invariants, and What Future AI Changes Must Not Do sections when architecture decisions change.*
