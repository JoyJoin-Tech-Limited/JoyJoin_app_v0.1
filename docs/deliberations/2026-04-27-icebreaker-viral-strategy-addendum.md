# Deliberation Addendum: 5 Critical Considerations for Implementation

**Date:** 2026-04-27  
**Parent:** `docs/deliberations/2026-04-27-icebreaker-viral-strategy.md`  
**Sprint Contract:** `.git/.orchestration/sprints/sprint-contract.icebreaker-q2-pilot.md`  
**Status:** Addendum — updates and extends the locked Sprint Contract

---

## Task Creator Summary

**Task:** Resolve 5 implementation-bound considerations before Q2 pilot execution: (1) phase modularity for post-match compilation, (2) game catalog selection, (3) session duration + mini_script presence, (4) operational flow (pre-gen vs in-session), (5) LLM-as-judge integration.

**What you really want:** An implementation plan that is not just "build the features" but "build the right architecture so the system can self-improve" — modular phases, dynamic flows, quality gates, and operational automation.

**Context:**
- Affected area: icebreaker / social-icebreaker-domain / AI infrastructure
- I expect to touch: `packages/shared` (phase types, run plan), `apps/server` (routes, AI service, quality gate), `apps/mini-program` (phase views), docs
- Sibling platform review needed: yes (mini-program primary)
- Harness tier: 3 (architectural boundary — phase modularity changes the core state machine contract)
- Sprint Contract required: yes (addendum to existing Q2 contract)

---

## Consideration 1: Phase Modularity for Post-Match Compilation

### Current State
Phases are **hardcoded** in `PHASE_ORDER` and enabled via server env flags (`SOCIAL_ICEBREAKER_ENABLE_AUCTION`, etc.). The `IcebreakerRunPlan` system exists (`packages/shared/src/icebreakerRunPlan.ts`) but is not yet wired to the live session execution.

### What Needs to Change
Each phase must become a **self-contained module** with a standard interface:

```typescript
// packages/shared/src/phaseModule.ts (new)
export interface PhaseModule {
  id: SocialIcebreakerPhase;
  name: string;
  nameEn: string;
  emoji: string;
  durationMinutes: number;           // nominal duration
  minPlayers: number;
  maxPlayers?: number;
  category: 'conversation' | 'game' | 'creative' | 'deduction' | 'narrative';
  energyArc: 'rising' | 'peak' | 'falling' | 'variable';
  requiresGeneration: boolean;       // does this phase need AI pre-generation?
  generationLeadTimeMinutes: number; // how long before event to pre-generate
  advanceGuard: (state: SocialSessionState) => boolean | string; // guard function ref
  cleanup: (state: SocialSessionState) => void; // cleanup function ref
  recapBuilder: (state: SocialSessionState) => string | null; // recap line builder
}
```

### Why This Matters
With modular phases, the **Game Design Agent** (post-match compiler) can:
1. Read the matched group's profile (size, archetypes, chemistry, event type)
2. Pick phases from the catalog that fit the group's "social DNA"
3. Compile an `IcebreakerRunPlan` with exact phase order and duration
4. The live session simply **executes the compiled plan** instead of following hardcoded `PHASE_ORDER`

### Q2 Scope
- **Design the `PhaseModule` interface** (schema, types, validation)
- **Refactor existing phases** into module shape (no behavior change, just extraction)
- **Wire `IcebreakerRunPlan` to session execution** — if a plan exists, use it; if not, fall back to `PHASE_ORDER`
- **Game Design Agent compiles plans** for 100% of matched groups (async, post-match)

### Q3 Scope
- **Dynamic phase selection** based on group archetype chemistry
- **A/B test compilation algorithms** (conservative vs. adventurous)
- **User feedback loop** ("this flow was too fast/too slow") informs future compilations

---

## Consideration 2: Game Catalog Selection (Deliberation)

### Delegate Proposals

**Alpha (Architect):** Ship only `quip_battle` and `undercover_word` in Q3. Each new phase adds ~8 files and 2 weeks of work. `group_mirror` is trivial but overlaps with `personality_dice`. `doodle_duel` and `traitor_town` are Q4+ at earliest.

**Beta (UX Visionary):** Ship `quip_battle`, `undercover_word`, AND `group_mirror` in Q3. The catalog needs breadth to feel like a "real game platform," not a single-game experience. `group_mirror` is the perfect "warmup" phase — low pressure, high intimacy.

**Gamma (Code Realist):** Ship `quip_battle` only in Q3. `undercover_word` shares the same API surface as `lie_detective` but needs a completely new AI prompt and word-pair bank. `group_mirror` needs voting UI that doesn't exist yet. One phase at a time.

### Deliberation Convergence

| Phase | Decision | Rationale |
|-------|----------|-----------|
| `quip_battle` | ✅ **Q3, P0** | Highest viral potential, no new UI primitives, AI-native |
| `undercover_word` | ✅ **Q3, P1** | Culturally proven in China, shares lie_detective API surface, but needs new prompt + word bank |
| `group_mirror` | ⚠️ **Q3, P2 (dev flag)** | Trivial to build but overlaps with personality_dice. Ship behind flag, A/B test against personality_dice as warmup alternative. |
| `doodle_duel` | ❌ **Q4+** | Requires Canvas drawing UI — new primitive, high UX risk |
| `traitor_town` | ❌ **Q4+** | Requires hidden role assignment + elimination logic — complex state machine, needs 5+ players |

**Final Catalog (Q3):** 7 phases total
```
warmup → micro_challenge → lie_detective → undercover_word (bar variant)
  → quip_battle (funny variant) → group_mirror (P2, dev flag)
  → personality_dice → mini_script → auction → recap
```

**Note:** `undercover_word` and `quip_battle` are **variant phases** — they replace `lie_detective` or `micro_challenge` in specific event types, not add to a longer flow. The Standard flow still has 4-5 phases max.

---

## Consideration 3: Session Duration + mini_script Presence

### The User's Challenge
> "Fix a duration of a standard session to 80 mins. How come mini_script is not present on more flows?"

### Deliberation

**Alpha:** 80 min Standard with mini_script requires either (a) shortening mini_script to 25 min, or (b) removing another phase. Shortening mini_script means a new "lite" variant with 2 acts instead of 3-5 — that's a new state machine branch.

**Beta:** 80 min is the right duration. Dinner events naturally run 90-120 min; 60 min feels rushed. mini_script is the most viral phase — it SHOULD be in Standard if we can make it fit.

**Gamma:** If Standard becomes 80 min, we need to timebox EVERY phase aggressively. warmup (8 min), micro_challenge (8 min), lie_detective (15 min), personality_dice (12 min), mini_script_lite (25 min), recap (5 min), buffer (7 min). The buffer is for host delays, AI generation lag, and social friction.

### Converged Decision

**Standard Event duration: 80 minutes (fixed).**

**Standard Flow ("Spark Night"):**
```
warmup (8 min) → micro_challenge (8 min) → lie_detective (15 min)
  → personality_dice (12 min) → mini_script_lite (25 min, 2-act) → recap (5 min)
  + 7 min buffer
```

**mini_script_lite spec:**
- 2 acts (not 3-5)
- 25 minutes total
- Pre-generated framework (not in-session)
- Simpler role assignment (archetype-mapped, not random)
- Single clue reveal per act (not multiple)
- Voting: one round, majority wins

**Why mini_script belongs in Standard:**
- It's the highest-scoring viral phase across all dimensions
- Without it, Standard is "conversation + games" — with it, Standard is "an experience"
- The "lite" variant preserves the core thrill (roles, clues, voting) while fitting the timebox

**Premium Event ("Mystery Night"):**
```
warmup (8 min) → micro_challenge (8 min) → lie_detective (12 min)
  → personality_dice (10 min) → mini_script_full (40 min, 3-act) → recap (5 min)
  + 7 min buffer
```

**Bar Scene ("Auction Night"):**
```
warmup (8 min) → micro_challenge (8 min) → undercover_word (12 min)
  → auction (20 min) → recap (5 min)
  + 7 min buffer
```

**Funny Mood ("Roast Night"):**
```
warmup (8 min) → quip_battle (18 min) → lie_detective (12 min)
  → personality_dice (10 min) → recap (5 min)
  + 7 min buffer
```

**All events: 80 minutes fixed.** The Game Design Agent compiles the phase subset that fits.

---

## Consideration 4: Operational Flow — Pre-Generation vs In-Session

### Current State (In-Session Generation)
| Phase | When Generated | Trigger | Risk |
|-------|---------------|---------|------|
| warmup topics | In-session | Host selects mood, POST /topics | Low — 25 curated fallbacks |
| micro_challenge | In-session | Auto on phase advance | Low — 8 curated fallbacks |
| lie_detective statements | In-session | Per-player POST /generate | Low — 3 curated fallback sets |
| personality_dice | In-session | Host POST /generate | Low — 36 curated dares |
| mini_script framework | In-session | Host POST /miniscript/generate | **HIGH** — 45 min generation wait, complex JSON |
| auction lots | In-session | Host POST /generate-lots | Medium — curated fallback lots |
| recap | In-session | GET /recap on demand | Low — template fallback |

### Problem
`mini_script` framework generation in-session is **friction-heavy**. Host must:
1. Pick style + genre
2. Wait for LLM to generate complex JSON (10-30 seconds)
3. Review framework quality
4. Assign roles
5. Only then start Act 1

This kills momentum. The deliberation already identified pre-generation as the fix.

### Operational Flow (Target)

```
POST-MATCH (T+0 to T+48h)
  │
  ▼
Game Design Agent compiles IcebreakerRunPlan
  ├── Phase selection (based on group archetypes, event type, venue)
  ├── Duration allocation (80 min total, per-phase timeboxes)
  └── Pre-generation queue for phases that need it
  │
  ▼
PRE-EVENT (T-24h to T-2h)
  │
  ├── mini_script framework → async generation (DeepSeek JSON)
  ├── quip_battle prompts → async generation (if funny mood)
  ├── undercover_word word pairs → async generation (if bar scene)
  ├── warmup topics → mood-filtered, 5 topics pre-generated
  ├── micro_challenge → 3 challenges pre-generated
  └── All content stored in session JSONB (ready to serve)
  │
  ▼
IN-SESSION (T+0)
  │
  ├── Host starts session → all content already loaded
  ├── Phase advances → content served from pre-generated cache
  ├── No AI calls on critical path (unless host requests regeneration)
  └── Recap → AI summary still in-session (lightweight, <2s)
```

### Gatekeepers

| Gate | Who/What | Action |
|------|----------|--------|
| Pre-generation complete? | Async job status | If incomplete at T-2h, fallback to in-session generation |
| Content quality pass? | LLM-as-judge (async) | If score < threshold, regenerate or use curated fallback |
| Host override? | Host taps "换一批" (refresh) | Triggers in-session regeneration for current phase only |
| Player drop-off? | Pulse-check < 2.0 | Xiaoyue adaptive suggestion: skip to next phase or inject energy boost |
| Time overrun? | Phase timer > 1.5× allocated | Auto-advance suggestion to host; host can override |

### Q2 Scope
- **Design** the pre-generation pipeline architecture (queue, workers, triggers)
- **Implement** for `mini_script_lite` only (highest-impact, highest-friction)
- **All other phases** remain in-session (proven, low-risk)

### Q3 Scope
- **Expand** pre-generation to `quip_battle` prompts and `undercover_word` word pairs
- **Implement** async job infrastructure (queue consumer, retry logic, monitoring)
- **Implement** host override ("refresh" button for pre-generated content)

---

## Consideration 5: LLM-as-Judge — Built But Not Wired

### The Surprising Truth
**The LLM-as-judge is FULLY IMPLEMENTED.** The code exists in:
- `apps/server/src/ai/aiQualityGate.ts` — 351 lines, full circuit breaker, scoring, refinement loops
- `apps/server/src/ai/qualityJudgePrompts.ts` — 603 lines, cultural framework, per-feature weights
- `apps/server/src/ai/__tests__/aiQualityGate.test.ts` — test coverage

It evaluates:
- 趣味性 (fun/engagement) — weighted per feature type
- brandAlignment — brand voice consistency
- appropriateness — safety hard line
- clarity — instruction comprehensibility

With thresholds:
- `FUN_SCORE_REFINEMENT_THRESHOLD = 6` — below this, content is refined (回炉重做)
- `FUN_SCORE_DISCARD_THRESHOLD = 4` — below this, content is discarded → fallback
- `APPROPRIATENESS_THRESHOLD = 7` — hard safety line

### Why It's Not Used
The module is **not imported or called** by:
- `apps/server/src/ai/socialModelRouter.ts` (no import)
- `apps/server/src/socialIcebreakerAIService.ts` (no import)
- `apps/server/src/routes/socialIcebreaker.ts` (no import)

The `QUALITY_GATE_ENABLED` env var defaults to `false`. Even if set to `true`, nothing calls `evaluateContent()` or `generateWithQualityGate()`.

### Integration Plan

**Q2 (Immediate — 1 day of work):**
1. Wire `evaluateContent()` into `socialIcebreakerAIService.ts` after each generation
2. Set `QUALITY_GATE_ENABLED=true` and `QUALITY_GATE_BLOCKING_ENABLED=false` (async/fire-and-forget only)
3. Set `QUALITY_GATE_SAMPLE_RATE=0.1` (10% sampling)
4. Store judge scores in `AITrace` metadata

**Q2 (Week 4 — after pilot launch):**
5. Enable `QUALITY_GATE_BLOCKING_ENABLED=true` for `mini_script` framework only (highest-stakes content)
6. If blocking judge fails, trigger refinement loop (max 2 attempts) then fallback

**Q3:**
7. Calibrate judge scores against human feedback (`social_icebreaker_ai_feedback` table)
8. Adjust thresholds based on calibration data
9. Expand blocking gate to `quip_battle` and `undercover_word` prompts

### Why This Was Deferred (Historical Context)
The deferred doc (`docs/ops/icebreaker-ai-llm-judge-deferred.md`) says:
> "Production implementation is not shipped. When prioritized: Run as a batch or queue worker only — never on the synchronous request path."

The intent was correct (don't block UX on judge completion), but the implementation went further — it supports BOTH async (fire-and-forget) AND blocking modes via env flags. The team simply never flipped the switch.

**Bottom line:** This is not a "build it" task. It's a "wire it and enable it" task. ~200 lines of integration code.

---

## Sprint Contract Addendum

### New In-Scope Items (Q2)

| Item | Week | Owner | Notes |
|------|------|-------|-------|
| PhaseModule interface design | 1 | Architect | Extracts existing phases into modular shape |
| IcebreakerRunPlan → session execution wiring | 2 | Backend | If plan exists, use it; else fallback to PHASE_ORDER |
| mini_script_lite spec (2-act, 25 min) | 2 | Game Design | New variant of existing phase |
| Pre-generation pipeline design (async job) | 3 | Architect | Queue consumer, trigger conditions, retry logic |
| mini_script pre-generation implementation | 4-5 | Backend + AI | Async framework generation before event |
| LLM-as-judge wiring | 1 (parallel) | Backend | Wire evaluateContent into socialIcebreakerAIService |
| Standard duration: 80 min fixed | 2 | Product | Update all timebox allocations |

### Removed from Q2 (Previously In-Scope)

| Item | Reason | New Timeline |
|------|--------|-------------|
| `quip_battle` dev-only build | Re-prioritized behind phase modularity + mini_script_lite | Q3 |
| `personality_dice` archetype dare bank | Still in scope but lower priority than mini_script_lite | Q2, Week 5-6 |

### Updated Q2 Priority

1. **Week 1:** Phase modularity interface + LLM-as-judge wiring (parallel)
2. **Week 2:** IcebreakerRunPlan execution wiring + mini_script_lite spec + 80-min timebox update
3. **Week 3:** Pre-generation pipeline design + Moment Card server render
4. **Week 4-5:** mini_script pre-generation implementation + Moment Card mini-program overlay
5. **Week 6:** Personality Dice v2 + Legacy atomic removal
6. **Week 7-8:** Pilot launch with instrumentation

### Hard Gates (Updated)

| Gate | Threshold | Why |
|------|-----------|-----|
| mini_script_lite completes in ≤25 min | 100% of sessions | Timebox is non-negotiable for 80-min Standard |
| Pre-generation success rate | ≥95% | If <95%, fallback to in-session must be seamless |
| LLM-as-judge coverage | ≥10% sampling, 0% blocking in pilot | Async only until calibrated against human feedback |
| Moment Card save rate | ≥20% (increased from 15%) | 80-min events are higher investment — share rate must reflect that |

---

## Architecture Decisions (Addendum)

| Decision | Rationale | Delegate Consensus |
|----------|-----------|-------------------|
| Standard duration = 80 min (was 60 min) | User mandate + mini_script inclusion requires more time | Beta championed; Alpha accepted with mini_script_lite constraint; Gamma accepted with aggressive timeboxing |
| mini_script in Standard (as "lite") | Highest viral phase must be in default flow, not Premium-only | Beta championed; Alpha accepted with 2-act constraint; Gamma accepted with pre-generation requirement |
| Phase modularity + IcebreakerRunPlan execution | Enables post-match Game Design Agent compilation | Alpha championed; Beta accepted; Gamma accepted with fallback requirement |
| Pre-generation only for mini_script in Q2 | Other phases have fast generation + strong fallbacks | Gamma championed; Alpha accepted; Beta accepted |
| LLM-as-judge: wire immediately, async only | Code exists, just not connected. Blocking mode deferred to calibration. | Gamma championed; Alpha accepted; Beta accepted |
| Game catalog: quip_battle + undercover_word in Q3; group_mirror P2 dev flag; doodle_duel + traitor_town Q4+ | One new phase per quarter maximum to manage complexity | Alpha championed; Beta accepted group_mirror compromise; Gamma accepted |

---

*This addendum extends `.git/.orchestration/sprints/sprint-contract.icebreaker-q2-pilot.md`. Any conflict between the original contract and this addendum is resolved in favor of this addendum.*
