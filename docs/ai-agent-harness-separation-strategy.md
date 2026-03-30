# JoyJoin AI Agent Harness Separation Strategy

**Status:** Reference Architecture — Internal Engineering / Product Use  
**Last updated:** 2026-03-30  
**Scope:** AI product agent systems for Onboarding Discovery, Match Intelligence, and Event Momentum

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

> **Proposed files (to be created):** The `apps/server/src/services/` directory already exists (see `eventThemeTitleGenerator.ts`). The orchestrator files below are the recommended new additions:

```
apps/server/src/services/
  onboardingDiscoveryOrchestrator.ts   ← Separation Level 1 (v1) — proposed
  matchIntelligenceOrchestrator.ts     ← Separation Level 1–2 (v1) — proposed
  eventMomentumOrchestrator.ts         ← Separation Level 1 (v1) — proposed
```

> **Proposed files (to be created):** The `packages/shared/src/ai/` directory does not yet exist. Create it as part of Phase 0. Shared typed I/O contracts live there:

```
packages/shared/src/ai/
  onboarding.ts    ← input/output schemas for Onboarding Discovery — proposed
  matching.ts      ← input/output schemas for Match Intelligence — proposed
  icebreaker.ts    ← input/output schemas for Event Momentum — proposed
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

| Phase | System | Scope |
|---|---|---|
| **Phase 0** | All | Build shared harness infrastructure: `packages/shared/src/ai/` schemas, server AI client wrapper, logging/observability hooks, feature flags, fallback contract pattern. |
| **Phase 1** | Event Momentum | Deploy `eventMomentumOrchestrator`. Scope: structured game plan generation for 酒吧 and 饭局. Host-supervised delivery only. Curated fallback game library must be active before launch. |
| **Phase 2** | Onboarding Discovery | Deploy `onboardingDiscoveryOrchestrator`. Scope: question phrasing adaptation, low-signal detection, result explanation. Server-owned progression must be verified as unchanged. |
| **Phase 3** | Match Intelligence | Deploy `matchIntelligenceOrchestrator`. Scope: compatibility narratives, intro suggestions, bounded reranking of deterministic shortlist. A/B tested against deterministic baseline. |
| **Phase 4** | All | Cross-agent feedback loop: unify event outcome instrumentation, build evaluation dashboard, connect offline outcomes to per-system harness tuning. |

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

The following are reference schemas for `packages/shared/src/ai/`. These are not exhaustive; add fields as needed, but enforce schema validation before returning any output from the Policy Synthesizer stage.

### Onboarding Discovery Output (`onboarding.ts`)

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

### Match Intelligence Output (`matching.ts`)

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

### Event Momentum Output (`icebreaker.ts`)

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

| File | Relevance |
|---|---|
| `apps/server/src/poolMatchingService.ts` | Authoritative deterministic matching core; Match Intelligence agent wraps this, never replaces it |
| `apps/server/src/socialIcebreakerAIService.ts` | Existing AI integration point for Event Momentum; orchestrator should integrate here |
| `apps/server/src/routes/socialIcebreaker.ts` | Social Icebreaker phase lifecycle API; Event Momentum agent operates within this lifecycle |
| `packages/shared/src/personality/` | Canonical personality engine; Onboarding Discovery agent produces inputs for this, does not replace it |
| `apps/user-client/src/pages/PersonalityTestPageV4.tsx` | Client-side entry point for onboarding; agent outputs are rendered here, not computed here |
| `apps/server/src/routes.ts` | All API route registrations; new orchestrator routes register here |
| `packages/shared/src/schema.ts` | Database schema source of truth; agent services read but do not own schema definition |
| `docs/icebreaker-system.md` | Full technical reference for Social Icebreaker system |
| `docs/MATCHING_ALGORITHM_REFERENCE.md` | Matching algorithm documentation; cross-reference when scoping Match Intelligence evaluator |
| `docs/PERSONALITY_TEST_SYSTEM.md` | Personality test system documentation; cross-reference when scoping Onboarding Discovery |

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

---

*This document is intended as a durable engineering and product reference. Update the Decision Log and Recommended Separation Table when architecture decisions change.*
