# JoyJoin Icebreaker System Overhaul — Master Execution Plan

> **Version:** 1.0 · **Date:** 2026-05-01  
> **Status:** Approved for Execution  
> **Owner:** Kickoff Planner → Handoff to Supervisor for Sprint 0 launch  
> **Timeline:** 8–9 weeks total (5 Sprints)

---

## Executive Summary

### Mission in One Sentence

**Replace hardcoded tier run plans with a dynamic Game Design Agent, wire all 8 non-core phases into the session flow, boost every phase to composite ≥ 8.0 through shared infrastructure (Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync), and deliver a polished tier+vibe selection UX in the mini-program — all behind feature flags with zero regression.**

### What Must Be True When We Stop

1. Host selects tier (`breeze`/`glow`/`blaze`) + vibe (`chat`/`balanced`/`game`) → `compileAgentRunPlan()` produces a valid `IcebreakerRunPlan` dynamically
2. All 8 non-core phases are playable in the mini-program session flow (behind feature flags)
3. Lie Detective V2 (`LIE_DETECTIVE_MODE=v2`) is operational with user-tag input + AI fake injection + V1 degrade
4. Speed-Friending phase exists as a 15min Aron's 36 Questions + archetype-pairing experience
5. 7 of 10 phases score ≥ 8.0 on the boost rubric; no phase regresses
6. 4 shared infra systems (Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync) are integrated into ≥ 5 phases
7. `npm run guardrails` + `npm run test -w @joyjoin/server` pass; all wiring behind feature flags (default OFF)
8. Tier manifest (`resolveTierDisplay`) is wired to both client and server; legacy `standard`/`premium`/`bar` mapped

### Total Timeline

```
Sprint 0: Field Clearing     (Week 1–2)   ← IMMEDIATE BOTTLENECK
Sprint 1: Tier+Vibe + Agent  (Week 3–4)
Sprint 2: Lie Detective V2   (Week 5–6)
Sprint 3: Speed-Friending    (Week 7–8)
Sprint 4: Batch Boost        (Week 9–10)
Sprint 5: QA + Launch        (Week 11)
```

### Deliverables

| Sprint | Deliverable | Gate |
|--------|------------|------|
| S0 | 3 wired phases + DB migration + run plan reconciliation + IceBreakerScrollCards port + LLM-as-judge wired + tier type widened + mini_script splice logic | `guardrails` + `test` pass |
| S1 | Tier+vibe selector UI + `compileAgentRunPlan()` + `/start` + `/set-tier` acceptance + backward compat | Agent compiles valid plans for all 3 tiers |
| S2 | Lie Detective V2: tag input → AI expansion → vote → reveal + V1 degrade + dynamic difficulty | V2 E2E playable; V1 regression-free |
| S3 | Speed-Friending phase + Reveal Engine 3 components + Gesture Kit 3 primitives + Context Injector Phase 1 + Optimistic Sync | 4 shared infra systems operational |
| S4 | 5 phases boosted: personality_dice, group_mirror, micro_challenge, undercover_word, quip_battle, auction shared-infra lift | 7 of 10 phases ≥ 8.0 |
| S5 | 3-rater scoring, integration tests for all phases, release notes, rollback plan, feature flag audit | Go/no-go from Launch Readiness Agent |

---

## Validated Codebase State

| Gap | Status | Detail |
|-----|:------:|--------|
| quip_battle / undercover_word / group_mirror phase modules | ✅ Code exists | phaseRegistry.ts, server config, advance guards, AI prompts, pre-gen worker, tests — but no mini-program UI views, no feature flag gating wired through session flow |
| LLM-as-judge (603 lines) | ✅ Code exists | `qualityJudgePrompts.ts` + `preGenerationWorker.ts` — wired for warmup, lie_detective, personality_dice, auction, quip_battle but NOT mini_script blocking mode |
| lie_truths DB columns | ✅ Schema updated | `is_ai BOOLEAN` + `source_tag TEXT` already in schema.ts. Migration may still need `db:generate` + `db:rebuild-journal` + `db:migrate` |
| socialIcebreakerTierManifest.ts | ✅ Exists | Correct breeze/glow/blaze mapping + `resolveTierDisplay()`. NOT wired to client or server — both still use `standard`/`premium`/`bar` |
| IceBreakerScrollCards | ✅ Web only | `apps/user-client/src/components/IceBreakerScrollCards.tsx` — NOT ported to mini-program |
| eventTier type | ❌ String | `SocialSessionState.eventTier?: 'standard' \| 'premium' \| 'bar'` — needs `'breeze' \| 'glow' \| 'blaze'` union |
| compileAgentRunPlan() | ❌ Missing | Does not exist anywhere — needs rule engine + LLM prompt + orchestration |
| mini_script bonus splice | ❌ Missing | Phase module exists but no post-phase 悦仔 prompt, no splice logic, no recap time shift |
| speed_friending | ❌ Missing | Zero code, zero schema, zero prompts — full implementation needed |
| socialIcebreakerRunPlans.ts | ⚠️ Active | Contains dual BREEZE/GLOW/BLAZE + DEFAULT_STANDARD/DEFAULT_PREMIUM plans. Needs reconciliation into phaseRegistry.ts |

### Reference Documents (Canonical Specs)

| Document | Covers | When to Consult |
|----------|--------|-----------------|
| `docs/unified-icebreaker-system.md` | Tier definitions, agent compilation rules, phase buckets, game pool, back compat, file map | Sprint 1 (agent engine), any tier-related work |
| `docs/mini-program-icebreaker-prd.md` | Tier+vibe selector UI spec tokens, phase navigation, per-phase UI specs with Reveal/Gesture integration, state/error management | Sprint 1 (UI), Sprint 3 (Reveal/Gesture), Sprint 4 (boost) |
| `docs/proposals/spot-the-bot-game-design.md` | Lie Detective V2: type definitions, DB, API endpoints, AI prompt design, difficulty, fallbacks, client UI specs | Sprint 2 (Lie Detective V2) |
| `.git/.orchestration/plans/boost-all-games-to-8.md` | Scoring rubric, current scores, shared infra specs, target scorecard, risk register | Sprint 3–5 (boost rollout, QA scoring) |
| `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md` | Tier naming finalization (transcript) | Sprint 1 (tier wiring) |
| `AGENTS.md`, `DEVELOPER_QUICK_REFERENCE.md`, `PRODUCT_REQUIREMENTS.md` | Active vs legacy, monorepo rules, commands, architecture | All sprints (guardrails reference) |

---

## Sprint 0: Field Clearing & Infrastructure

> **Duration:** 2 weeks (Week 1–2)  
> **Critical Path:** YES — blocks Sprint 1 shared infra and Sprint 2 Lie Detective V2  
> **Bottleneck:** 3 unreachable phases preventing any boost work + tier type blocking agent engine  
> **Recommended Model:** Opus 4.6 (multi-file coordination, cross-cutting contracts, DB migration risk)

### S0 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S0.1** | Wire quip_battle into session flow | Backend Engineer + Game Development Agent | Add `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` feature flag gating; wire advance guard to session state machine; ensure phaseRegistry entry routes correctly; add cleanup on phase exit. Client: add `QuipBattlePhase` view to mini-program `phaseViews.tsx` | Phase playable behind flag; advance guard functional; integration test passes | — | Required |
| **S0.2** | Wire undercover_word into session flow | Backend Engineer + Game Development Agent | Add `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` flag gating; wire advance guard; ensure player word distribution works; add cleanup. Client: add `UndercoverWordPhase` view to `phaseViews.tsx` | Phase playable behind flag; word secrecy preserved | — | Required |
| **S0.3** | Wire group_mirror into session flow | Backend Engineer + Game Development Agent | Add `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` flag gating; wire advance guard; ensure anonymous voting works; add cleanup. Client: add `GroupMirrorPhase` view to `phaseViews.tsx` | Phase playable behind flag; anonymous voting functional | — | Required |
| **S0.4** | Wire LLM-as-judge to mini_script blocking mode | Backend Engineer + AI Engineer | Modify `preGenerationWorker.ts` mini_script path to use blocking LLM-as-judge (currently fire-and-forget only for warmup/lie_detective/etc). Add `qualityJudgePrompts.ts` judge type for `'icebreaker_mini_script'`. Gate behind quality score threshold | Bad mini_script content caught before delivery; quality gate log entry | S0.1–S0.3 | Required |
| **S0.5** | DB migration: lie_truths columns | Database Schema & Migration Auditor | Schema already has `is_ai` + `source_tag` columns in `packages/shared/src/schema.ts`. Run `db:generate` → review SQL → `db:rebuild-journal` → `db:migrate`. Verify with `db:verify` | Migration applied; columns exist in live DB; CI gate passes | — | Required |
| **S0.6** | Reconcile socialIcebreakerRunPlans.ts → phaseRegistry.ts | Backend Engineer | Move BREEZE/GLOW/BLAZE plan constants into `phaseRegistry.ts` as canonical. Mark `socialIcebreakerRunPlans.ts` as `@deprecated`. Keep LEGACY_TIER_MAP for backward-compat read path. Remove DEFAULT_STANDARD/DEFAULT_PREMIUM references. Add `getRunPlanForTier()` that dispatches old keys (frozen) vs new keys (agent-compiled) | `phaseRegistry.ts` is single source of truth; old file deprecated; no import breakage | — | Required |
| **S0.7** | Port IceBreakerScrollCards to mini-program | Taro Migration Specialist → Taro Mini-Program Frontend Engineer | Clone `apps/user-client/src/components/IceBreakerScrollCards.tsx` to `apps/mini-program/src/components/IceBreakerScrollCards/`. Adapt to Taro: `ScrollView` horizontal, touch events, 8rpx spacing. Preserve topic card horizontal scroll UX | Component functional in mini-program; WeChat DevTools verified | — | Required |
| **S0.8** | Add mini_script post-phase prompt + splice logic | Backend Engineer + Miniscript Story Agent | After last agent-selected phase completes, before recap: insert 悦仔 prompt "🎭 要不要加开迷你剧本杀？(+25分钟)". Host accepts → `mini_script` spliced into `runPlan.segments[]` before recap. recap's timeline shifts +25min. Host declines → proceed to recap | Bonus flow functional; splice preserves plan integrity; time calculation correct | S0.6 | Required |
| **S0.9** | Widen eventTier type + wire resolveTierDisplay() to client/server | Backend Engineer + Taro Mini-Program Frontend Engineer | Change `SocialSessionState.eventTier` from `'standard' \| 'premium' \| 'bar'` to `'breeze' \| 'glow' \| 'blaze'`. Add `LEGACY_TIER_MAP` for backward-compat reads. Wire `resolveTierDisplay()` into server tier display code AND mini-program tier selection UI. Replace hardcoded `标准局`/`Premium局`/`酒吧局` with manifest calls | `eventTier` is typed union; display names resolved from manifest; legacy sessions mapped | S0.6 | Required |

### S0 Gate

```bash
npm run guardrails      # Must pass: no legacy identifiers, no cross-app imports
npm run db:verify       # Must pass: schema vs live DB consistent
npm run test -w @joyjoin/server  # Must pass: all existing tests + new integration tests
```

### S0 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| Backend Engineer | S0.1–S0.4, S0.6, S0.8, S0.9 (server side) | ~5 days |
| Game Development Agent | S0.1–S0.3 (client views + phase registry wiring) | ~2 days |
| AI Engineer | S0.4 (LLM-as-judge blocking mode) | ~0.5 days |
| Database Schema & Migration Auditor | S0.5 (DB migration) | ~0.5 days |
| Taro Migration Specialist | S0.7 (port scaffold) | ~0.5 days |
| Taro Mini-Program Frontend Engineer | S0.7 (polish), S0.9 (client wire) | ~1.5 days |
| Miniscript Story Agent | S0.8 (bonus prompt design) | ~0.5 days |

### S0 Success Criteria

- [ ] `quip_battle`, `undercover_word`, `group_mirror` playable in mini-program behind feature flags (all OFF by default)
- [ ] Each newly-wired phase has ≥ 1 integration test
- [ ] LLM-as-judge blocks bad mini_script content (verified with synthetic bad input)
- [ ] `lie_truths` has `is_ai` + `source_tag` columns in migration journal
- [ ] `phaseRegistry.ts` is canonical; `socialIcebreakerRunPlans.ts` is `@deprecated`
- [ ] IceBreakerScrollCards renders correctly in WeChat DevTools
- [ ] mini_script bonus prompt appears after last phase; splice works
- [ ] `eventTier` is `'breeze' | 'glow' | 'blaze'`; `resolveTierDisplay()` called from server + client
- [ ] All guardrails pass

### S0 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S0.1–S0.3 (phase wiring) | Opus 4.6 | Cross-cutting: session state machine, advance guards, feature flags, client views. Mistakes break the session flow. |
| S0.4 (LLM-as-judge wiring) | Sonnet 4.6 | Narrow surface, well-defined integration point. |
| S0.5 (DB migration) | Opus 4.6 | Data integrity. Schema changes are high-blast-radius. |
| S0.6 (run plan reconciliation) | Opus 4.6 | Architecture decision — deprecation + migration of constants. Multi-file coordination. |
| S0.7 (component port) | GPT-5.4 xhigh | Bounded technical task. Taro adaptation patterns are known. |
| S0.8 (mini_script splice) | Sonnet 4.6 | Moderate complexity; well-specified by PRD. |
| S0.9 (tier type widening) | Opus 4.6 | Cross-cutting type change affecting server + client + legacy compat. |

---

## Sprint 1: Tier + Vibe Selector + Agent Engine

> **Duration:** 2 weeks (Week 3–4)  
> **Critical Path:** YES — blocks Lie Detective V2 (mode stored in session state)  
> **Bottleneck:** `compileAgentRunPlan()` is the single point of intelligence for the entire system  
> **Recommended Model:** Opus 4.6 for agent engine; GPT-5.4 xhigh for UI

### S1 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S1.1** | Build polished tier+vibe selection UI | Taro Mini-Program Frontend Engineer | Implement tier+vibe selector page per `docs/mini-program-icebreaker-prd.md` §1 spec tokens. Three tier cards (破冰局/畅聊局/狂欢局) with emoji, duration, game count. Three vibe chips (聊天感/混合感/竞技感). Default selection: 畅聊局 + 混合感. 悦仔 personalized line fade-in. All states: no selection, selected, submitting, error. CTA disabled until tier selected. `localStorage` persistence | Page renders in WeChat DevTools; matches spec tokens exactly; all states handled | S0.9 | Required |
| **S1.2** | Build compileAgentRunPlan() — Rule Engine (Priority) | Backend Engineer + Game Design Agent | Implement deterministic rule engine per `docs/unified-icebreaker-system.md` §5.2: core first (warmup+micro always), pick N games from pool of eligible 8, prioritize by archetype match (High-O/A/X groups → different preferences), sort by energy arc (rising→peak→falling), no consecutive same-category phases, time budget enforcement, recap close. Output: valid `IcebreakerRunPlan` | Function returns valid run plan for all 3 tiers; 100 test permutations pass | S0.6 | Required |
| **S1.3** | Build compileAgentRunPlan() — LLM Game Selection (Enhancement) | AI Engineer + Game Design Agent | Add LLM enhancement layer: when `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION=true`, call DeepSeek to rank game suitability per archetype mix + warmup mood + commonGround + completion rate. 3s timeout → fallback to rule engine baseline (S1.2). Prompt version: `social-game-selection-v1`. AITrace logging | LLM selection enriches rule engine output; 3s timeout not exceeded; fallback works | S1.2 | Optional |
| **S1.4** | Wire vibe to run plan compilation | Backend Engineer + Game Design Agent | Vibe (`chat`/`balanced`/`game`) influences game selection weights: `chat` → prefer personality_dice, group_mirror; `balanced` → even distribution; `game` → prefer undercover_word, quip_battle, auction. Integration into S1.2 rule engine | vibe parameter changes run plan composition measurably | S1.2 | Required |
| **S1.5** | Server-side `/start` and `/set-tier` endpoints | Backend Engineer | `POST /api/social-icebreaker/start` accepts `{ tier: 'breeze'\|'glow'\|'blaze', vibe: 'chat'\|'balanced'\|'game', lieDetectiveMode?: 'v1'\|'v2' }`. Triggers `compileAgentRunPlan()`. `POST /api/social-icebreaker/:id/set-tier` accepts same tier payload; only during warmup; re-runs compilation. Legacy input (`standard`/`premium`/`bar`) rejected at write path — server maps to new tier via `LEGACY_TIER_MAP` | Endpoints functional; validation correct; warmup-only guard enforced | S1.2, S0.9 | Required |
| **S1.6** | Backward compat: LEGACY_TIER_MAP | Backend Engineer | Implement `LEGACY_TIER_MAP: { standard→glow, premium→blaze, bar→breeze }`. Old sessions (frozen JSONB): replay as-is, no migration. `resolveTierDisplay()` accepts legacy aliases → maps to correct display. `getRunPlanForTier()`: old key → frozen run plan, new key → agent-compiled | Old sessions replay without error; display names correct; no data migration | S0.9 | Required |
| **S1.7** | Server tests for tier+vibe flow | Backend Engineer + QA Agent | Add tests for: `/start` with all tier+vibe combos, `/set-tier` during warmup, `/set-tier` after warmup (rejected), legacy tier input mapping, agent compilation output validation, vibe weight verification | ≥ 15 test cases pass | S1.5 | Required |

### S1 Gate

```bash
npm run test -w @joyjoin/server  # Must pass all new tier+vibe tests
# Manual: compileAgentRunPlan() returns valid plans for all 3 tiers × 3 vibes = 9 permutations
# Manual: WeChat DevTools — tier+vibe selector page renders with spec tokens
```

### S1 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| Taro Mini-Program Frontend Engineer | S1.1 | ~2 days |
| Backend Engineer | S1.2, S1.4, S1.5, S1.6 | ~3.5 days |
| Game Design Agent | S1.2, S1.3, S1.4 (compilation rules + weights) | ~2 days |
| AI Engineer | S1.3 | ~1 day |
| QA Agent | S1.7 | ~0.5 days |

### S1 Success Criteria

- [ ] Tier+vibe selector renders per spec tokens; all states (no selection, selected, submitting, error) functional
- [ ] `compileAgentRunPlan()` returns valid `IcebreakerRunPlan` for breeze (warmup+micro+1 game+recap), glow (warmup+micro+3 games+recap), blaze (warmup+micro+5–6 games+recap)
- [ ] Vibe parameter measurably changes game selection (chat → more reflection games; game → more competitive games)
- [ ] `/start` accepts `{ tier, vibe }` and returns session with compiled run plan
- [ ] `/set-tier` only works during warmup; rejects after
- [ ] Legacy `standard`/`premium`/`bar` sessions display correct tier names and replay without error
- [ ] All server tests pass

### S1 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S1.1 (tier+vibe UI) | GPT-5.4 xhigh | Well-specified by PRD with exact tokens. Bounded frontend work. |
| S1.2 (rule engine) | Opus 4.6 | Core intelligence of the system. Must be correct across all tier permutations. Architecture-level. |
| S1.3 (LLM game selection) | Sonnet 4.6 | Enhancement layer. Well-defined prompt structure. Fallback guarantees safety. |
| S1.4 (vibe wiring) | GPT-5.4 xhigh | Configuration-level work on top of S1.2 engine. |
| S1.5 (endpoints) | Opus 4.6 | Auth, validation, state mutation. One mistake breaks the session flow. |
| S1.6 (backward compat) | Opus 4.6 | Data integrity across old sessions. Cross-cutting. |
| S1.7 (tests) | GPT-5.4 xhigh | Mechanical test writing based on defined acceptance criteria. |

---

## Sprint 2: Lie Detective V2

> **Duration:** 2 weeks (Week 5–6)  
> **Critical Path:** Partial — V2 is a vertical slice on top of wired lie_detective phase  
> **Bottleneck:** AI prompt quality for fake statement generation  
> **Recommended Model:** Opus 4.6 for prompt design + server logic; GPT-5.4 xhigh for UI

### S2 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S2.1** | V2 prompt branching in buildLieDetectivePrompt | AI Engineer + Lie Detective Icebreaker Agent | Implement `buildV2Prompt()` per `docs/proposals/spot-the-bot-game-design.md` §7. Modify `buildLieDetectivePrompt` to branch by `mode: 'v1' \| 'v2'`. V2 prompt: user tags → AI expansion + 1 fake insertion. Dynamic difficulty injection. Prompt version: `social-lie-detective-v2` | V2 prompt generates 3 statements with exactly 1 `isAI: true` | S0.5 (DB columns) | Required |
| **S2.2** | Tag input UI (mini-program) | Taro Mini-Program Frontend Engineer | Implement V2 tag submission screen per spec §9.1. Two input fields (2–20 chars each). Character counters. Voice input affordance (`wx.startRecord` if scope available). Submit disabled until both valid. States: empty, filling, submitting ("悦仔正在编假话…"), submitted ✅, error. Profanity keyword check (client-side duplicate of server) | UI matches spec; all states render; input validation works | S1.1, S0.7 | Required |
| **S2.3** | V2 reveal animation | Taro Mini-Program Frontend Engineer | Implement V2 reveal per spec §9.3: CardFlip (non-AI statements get ✅ badge, AI statement gets 🤖 badge + emerald glow), vote count animation (spring, 400ms), personal result slide-up, special messages for 0% / 100% correct. Prefers-reduced-motion gate | Animation timeline correct; reduced-motion fallback functional | S2.2 | Required |
| **S2.4** | Dynamic difficulty + lieDetectiveRevealHistory | Backend Engineer + AI Engineer | Implement `getDynamicDifficulty()` per spec §7. Adjusts `easy`/`medium`/`hard` based on last 2 rounds' correct-rate. Target: 40–60% detection. Store `lieDetectiveRevealHistory` in session state for recap use | Difficulty adapts after round 2; target range achieved in ≥ 80% of sessions | S2.1 | Required |
| **S2.5** | V2 → V1 degrade on AI failure | Backend Engineer + AI Engineer | Implement 4-tier fallback per spec §8.2: V2 prompt → V2 fallback sets (20 curated) → V1 prompt → V1 hardcoded sets. All AITraced. Client renders whatever server returns | V2 degrades gracefully; no white screen; no session break | S2.1 | Required |
| **S2.6** | V2 fallback pool (20 curated sets) | Game Design Agent + Lie Detective Icebreaker Agent | Write 20 curated `LieDetectiveStatementV2[][]` sets covering all 12 archetypes per spec §8.3. Store in `packages/shared/src/lieDetectiveFallback.ts` (extend existing file). Each set: 2 true statements (with sourceTag) + 1 AI fake (isAI=true). Ensure variety, no offensive content, personality-appropriate | 20 valid sets; covers all 12 archetypes; passes profanity check | — | Required |
| **S2.7** | Recap V2 data builder | Backend Engineer | Build recap V2 data per spec §10: `aiWinRate` (AI wins if correct-rate < 50%), `hardestRound` (displayName of round with lowest correct-rate), `fooledEveryone` (count of rounds with 0 correct votes). Store in recap segment data for Phase 3 Recap V2 integration | Recap data computed correctly; all fields populated for V2 sessions | S2.4 | Required |
| **S2.8** | Server + client tests for V2 | QA Agent + Verifier | Server tests: tag validation, V2 prompt output shape, isAI secrecy, V1→V2 degrade chain, dynamic difficulty recalibration, V1 regression. Client tests: tag input validation states, V2 reveal with aiStatementIndex, 0%/100% edge messages, V1 fallback rendering | ≥ 12 server test cases; ≥ 6 client test cases | S2.5 | Required |

### S2 Gate

```bash
npm run test -w @joyjoin/server  # V2 test suite passes
# Manual: V2 E2E flow — host creates session with lieDetectiveMode=v2 → all players submit tags → AI generates → vote → reveal → advance
# Manual: V1 regression — LIE_DETECTIVE_MODE=v1 sessions play identically to pre-V2
```

### S2 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| AI Engineer | S2.1, S2.4, S2.5 | ~2.5 days |
| Lie Detective Icebreaker Agent | S2.1, S2.6 | ~1.5 days |
| Taro Mini-Program Frontend Engineer | S2.2, S2.3 | ~3 days |
| Backend Engineer | S2.4, S2.5, S2.7 | ~2 days |
| Game Design Agent | S2.6 | ~1 day |
| QA Agent + Verifier | S2.8 | ~1 day |

### S2 Success Criteria

- [ ] V2 prompt generates 3 statements with exactly 1 `isAI: true` in ≥ 95% of calls
- [ ] `isAI` stored in `lie_truths` table; NOT leaked to client session state
- [ ] Tag input: both fields accept 2–20 chars; submit disabled until both valid; profanity caught
- [ ] V2 reveal: AI badge + emerald glow on correct statement; 0%/100% edge messages render
- [ ] Dynamic difficulty adapts after round 2; 40–60% target hit rate ≥ 80%
- [ ] V2 → V1 degrade chain works end-to-end for simulated AI failures
- [ ] V1 sessions play identically (regression-free)
- [ ] Recap V2 data available for Phase 3 integration
- [ ] All tests pass; `LIE_DETECTIVE_MODE=v2` in `.env.example`

### S2 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S2.1 (V2 prompt) | Opus 4.6 | Prompt design — needs adversarial thinking, cultural nuance, Chinese social context. |
| S2.2 (tag input UI) | GPT-5.4 xhigh | Well-specified UI with exact states. Bounded. |
| S2.3 (reveal animation) | GPT-5.4 xhigh | Animation implementation per spec. Known patterns. |
| S2.4 (dynamic difficulty) | Sonnet 4.6 | Moderate algorithmic complexity. Well-defined thresholds. |
| S2.5 (degrade chain) | Opus 4.6 | Resilience architecture — multi-tier fallback, state consistency across failures. |
| S2.6 (fallback pool) | GPT-5.4 xhigh | Content writing — creative but bounded scope. |
| S2.7 (recap builder) | GPT-5.4 xhigh | Data aggregation. Mechanical. |
| S2.8 (tests) | GPT-5.4 xhigh | Test writing per acceptance criteria. |

---

## Sprint 3: Speed-Friending + Shared Infrastructure

> **Duration:** 2 weeks (Week 7–8)  
> **Critical Path:** YES — shared infra must exist before Sprint 4 batch boost  
> **Bottleneck:** Reveal Engine component creation + mini-program animation performance  
> **Recommended Model:** Opus 4.6 for engine architecture; GPT-5.4 xhigh for phase implementation

### S3 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S3.1** | Speed-Friending: prompt + state machine + server routes | Backend Engineer + AI Engineer | Implement 15min phase per Aron's 36 Questions + archetype pairing. Server: `POST /api/social-icebreaker/:id/speed-friending/start` → `generateSpeedFriendingPairs()` (pair users by complementary archetypes) → generate 3 question rounds per pair → state machine (pairing → round1 → round2 → round3 → rotate). `advanceSpeedFriendingGuard`. Timer per round (5min). Prompt version: `social-speed-friending-v1` | Phase playable; pairs generated correctly; rounds advance | S0.1–S0.3 (phase wiring pattern) | Required |
| **S3.2** | Speed-Friending: mini-program UI | Taro Mini-Program Frontend Engineer | Pair reveal screen: "你和 [name] 一组" with archetype match insight. Question card with timer. "下一题" button. Pair rotation animation. Completion: "你们聊了X分钟" + connection summary. Emoji reactions (`TapReaction`) | UI matches JoyJoin brand; all states handled; timer visible | S3.1 | Required |
| **S3.3** | Reveal Engine: CardFlip | Taro Mini-Program Frontend Engineer | CSS `transform: rotateY()` 3D flip component per `docs/mini-program-icebreaker-prd.md` §4. Props: `front`, `back`, `flipped`, `duration` (default 400ms). Gate: check `backface-visibility` compatibility. `prefers-reduced-motion` → static reveal (no flip, show back content directly). Export from `apps/mini-program/src/components/RevealEngine/CardFlip.tsx` | Component renders on iOS + Android WeChat; reduced-motion fallback works | — | Required |
| **S3.4** | Reveal Engine: IdentityReveal | Taro Mini-Program Frontend Engineer | Spotlight overlay + opacity 0→1 reveal. Props: `identity` (emoji + label), `color`, `onComplete`. Duration 300ms. `prefers-reduced-motion` → immediate reveal. Export from `apps/mini-program/src/components/RevealEngine/IdentityReveal.tsx` | Component renders; spotlight animation smooth on target devices | — | Required |
| **S3.5** | Reveal Engine: ParticleBurst | Taro Mini-Program Frontend Engineer | Canvas-based particle system. Props: `type` (confetti/coin/rose), `count` (max 60), `duration` (max 500ms). Cap at 60 particles on low-end (`wx.getSystemInfoSync().platform === 'android' && benchmarkLevel < 20`). `prefers-reduced-motion` → static sparkle image. Export from `apps/mini-program/src/components/RevealEngine/ParticleBurst.tsx` | Particles render; count capped; reduced-motion fallback works | — | Required |
| **S3.6** | Gesture Kit: SwipeCard | Taro Mini-Program Frontend Engineer | `touchstart`/`touchmove`/`touchend` + CSS `translateX`. Physics: spring-back at <40% threshold, snap-off at >60%. Scroll-safe — no ScrollView parent conflicts. Props: `onSwipeLeft`, `onSwipeRight`, `threshold`, `disabled`. Export from `apps/mini-program/src/components/GestureKit/SwipeCard.tsx` | Gesture works on iOS + Android; no ScrollView conflicts on 3 test devices | — | Required |
| **S3.7** | Gesture Kit: TapReaction + TapRhythm | Taro Mini-Program Frontend Engineer | `TapReaction`: static emoji row, tap → scale + opacity feedback. Props: `emojis`, `onReact`. `TapRhythm`: counter + CSS scale pulse per tap. Props: `onTap`, `maxTaps`. Both: degrade to basic tap if touch events unavailable. Export from GestureKit directory | Components functional; no gesture conflicts with WeChat long-press | — | Required |
| **S3.8** | Context Injector Phase 1 | Backend Engineer + AI Engineer | `buildArchetypeContext(state)` — aggregates group archetype mix into ≤100 char string. Inject into all `build*Prompt` functions: warmup, micro_challenge, personality_dice, lie_detective, recap. No privacy risk (aggregate only). Feature flag: `CONTEXT_INJECTOR_ENABLED` (default OFF in Sprint 3, ON in Sprint 4) | Archetype mix appears in prompt logs; prompt token budget unchanged (≤100 chars) | S1.2 | Required |
| **S3.9** | Optimistic Sync: vote + answer submission | Backend Engineer | `useOptimisticSocialAction` hook: local ✅ on vote/answer → server POST → on reject: fade to 50% opacity + toast + restore. Applies to: voting (all phases), answer submission (quip_battle, undercover_word). NOT: auction bids, challenge completion, state machine transitions. Gate behind `OPTIMISTIC_SYNC_ENABLED` (default OFF, ON in Sprint 4) | Optimistic UI visible; rollback not jarring; server-rejected state restores correctly | S0.1–S0.3 (phases wired) | Required |
| **S3.10** | Shared infra integration tests | QA Agent | Verify: Reveal Engine renders in at least 2 phases (lie_detective V2 + personality_dice). Gesture Kit used in ≥ 2 phases. Context Injector injects correct archetype mix. Optimistic Sync rollback works. `prefers-reduced-motion` fallback for all components | Integration tests pass; accessibility gate verified | S3.3–S3.9 | Required |

### S3 Gate

```bash
npm run test -w @joyjoin/server  # Shared infra server tests pass
# Manual: WeChat DevTools — Reveal Engine components render; Gesture Kit gestures work
# Manual: Context Injector output visible in AI prompt logs (debug mode)
# Manual: Optimistic Sync rollback simulated (server reject → gray + toast + restore)
```

### S3 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| Backend Engineer | S3.1, S3.8, S3.9 | ~3 days |
| AI Engineer | S3.1, S3.8 | ~1.5 days |
| Taro Mini-Program Frontend Engineer | S3.2, S3.3, S3.4, S3.5, S3.6, S3.7 | ~5 days |
| QA Agent | S3.10 | ~1 day |

### S3 Success Criteria

- [ ] Speed-Friending phase: pairs generated by complementary archetype; 3 question rounds per pair; timer enforced
- [ ] Speed-Friending UI: pair reveal → question display → timer → rotation → completion summary
- [ ] CardFlip: 3D flip works; reduced-motion fallback: static reveal
- [ ] IdentityReveal: spotlight overlay + opacity transition; reduced-motion: immediate reveal
- [ ] ParticleBurst: ≤ 60 particles; capped on low-end Android; reduced-motion: static image
- [ ] SwipeCard: spring-back <40%, snap-off >60%; no ScrollView conflicts on tested devices
- [ ] TapReaction + TapRhythm: functional; no WeChat long-press conflicts
- [ ] Context Injector: archetype mix ≤ 100 chars; injected into 5 prompt builders
- [ ] Optimistic Sync: vote + answer submission show local ✅; rollback fades to gray + toast
- [ ] All 4 shared infra systems used by ≥ 2 phases

### S3 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S3.1 (Speed-Friending server) | Opus 4.6 | New phase — state machine, routes, pairing algorithm, prompt design. Full-vertical. |
| S3.2 (Speed-Friending UI) | GPT-5.4 xhigh | UI implementation per established patterns. |
| S3.3 (CardFlip) | Sonnet 4.6 | CSS 3D transforms — moderate complexity, well-known technique. |
| S3.4 (IdentityReveal) | GPT-5.4 xhigh | Simple overlay + opacity transition. |
| S3.5 (ParticleBurst) | Sonnet 4.6 | Canvas particle system — moderate complexity, device cap logic. |
| S3.6 (SwipeCard) | Opus 4.6 | Touch gesture physics + ScrollView conflict resolution + multi-device testing. High interaction complexity. |
| S3.7 (TapReaction + TapRhythm) | GPT-5.4 xhigh | Simple touch handlers. Bounded. |
| S3.8 (Context Injector) | Sonnet 4.6 | String aggregation + prompt injection. Well-defined integration points. |
| S3.9 (Optimistic Sync) | Opus 4.6 | State consistency — rollback logic, server rejection handling, race condition awareness. |
| S3.10 (integration tests) | GPT-5.4 xhigh | Mechanical verification. |

---

## Sprint 4: Batch Game Boost Rollout

> **Duration:** 2 weeks (Week 9–10)  
> **Critical Path:** Partial — lifts scores on wired phases using shared infra  
> **Bottleneck:** Undercover word + auction visual/interaction overhaul (largest gaps)  
> **Recommended Model:** GPT-5.4 xhigh for most boosts; Opus 4.6 for auction overhaul

### S4 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S4.1** | personality_dice V2 boost | Taro Mini-Program Frontend Engineer + Personality Dice Icebreaker Agent | Implement per `.git/.orchestration/plans/boost-all-games-to-8.md` Track A: 3D dice roll animation (`CardFlip` variant) + archetype-colored `ParticleBurst` on completion + `SwipeCard` to accept challenge + `TapReaction` for spectator emoji throws + `ContextInjector` influencing dare selection + `OptimisticSync` for completion | Composite: Visual 8.0, Interaction 8.0, Engagement 8.0, Technical 8.0 | S3.3–S3.9 (shared infra) | Required |
| **S4.2** | group_mirror + micro_challenge boost | Taro Mini-Program Frontend Engineer + AI Engineer | **group_mirror:** `IdentityReveal` spotlight on "most likely" winner + `TapReaction` throw rose/tomato + AI-personalized questions via `ContextInjector` + `OptimisticSync` voting. **micro_challenge:** Team progress bar + completion `ParticleBurst` + group `TapRhythm` + contextual challenges via `ContextInjector` + `OptimisticSync` progress | group_mirror Composite ≥ 8.0; micro_challenge Composite ≥ 8.0 | S4.1 | Required |
| **S4.3** | undercover_word + quip_battle boost | Taro Mini-Program Frontend Engineer + AI Engineer | **undercover_word:** `IdentityReveal` for dramatic unveil + `SwipeCard` to vote for elimination + round-by-round tension via `ContextInjector` + `OptimisticSync` round sync. **quip_battle:** Answer card stack via `SwipeCard` + upvote `ParticleBurst` + AI "best of" reel via `ContextInjector` + `OptimisticSync` upvote | undercover_word Composite ≥ 8.1; quip_battle Composite ≥ 8.1 | S4.2 | Required |
| **S4.4** | auction shared-infra lift | Taro Mini-Program Frontend Engineer + Icebreaker Auction Phase Agent | **Visual:** `ParticleBurst` coin shower on winning bid. **Interaction:** `TapRhythm` for cheer/boo reactions. Deferred: dedicated bid mechanics + leaderboard redesign (post-V2). Composite target: ≥ 6.0 (from 3.2) — shared infra only | auction Visual ≥ 6.0, Interaction ≥ 5.0 (lift from 3.0/3.0) | S4.3 | Required |
| **S4.5** | Recap V2 data integration | Backend Engineer | Consume V2 data from S2.7: `aiWinRate`, `hardestRound`, `fooledEveryone`. Inject into recap summary. Comic strip layout (4-panel session arc overview). Shareable social card generation | Recap shows V2 stats for V2 sessions; comic strip renders | S2.7 | Optional |

### S4 Gate

```bash
# Manual: 3 independent raters score all 10 phases against rubric
# Manual: 7 of 10 phases ≥ 8.0 composite; no phase regresses in any dimension
```

### S4 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| Taro Mini-Program Frontend Engineer | S4.1–S4.4 | ~5 days |
| Personality Dice Icebreaker Agent | S4.1 (dare bank + prompt refresh) | ~1 day |
| AI Engineer | S4.2 (prompts), S4.3 (prompts) | ~2 days |
| Icebreaker Auction Phase Agent | S4.4 (coin shower + reactions) | ~1 day |
| Backend Engineer | S4.5 | ~0.5 days |

### S4 Success Criteria

- [ ] personality_dice: composite ≥ 8.0 (Visual 8.0, Interaction 8.0, Engagement 8.0, Technical 8.0)
- [ ] group_mirror: composite ≥ 8.0
- [ ] micro_challenge: composite ≥ 8.0
- [ ] undercover_word: composite ≥ 8.1
- [ ] quip_battle: composite ≥ 8.1
- [ ] auction: composite ≥ 6.0 (shared-infra lift only; dedicated redesign deferred)
- [ ] Recap shows V2 stats + comic strip for V2 sessions
- [ ] No phase regresses below S0 baseline in any dimension
- [ ] All boosts verified in WeChat DevTools

### S4 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S4.1 (personality_dice) | Sonnet 4.6 | Integration of existing shared infra into known phase. Moderate coordination. |
| S4.2 (group_mirror + micro_challenge) | GPT-5.4 xhigh | Two phases, bounded integration work. Shared infra does the heavy lifting. |
| S4.3 (undercover_word + quip_battle) | GPT-5.4 xhigh | Bounded integration — shared infra already proven in S4.1–S4.2. |
| S4.4 (auction lift) | Opus 4.6 | Auction is the lowest-scoring phase. Coin shower + reactions must be flawless. Blaze-tier differentiator. |
| S4.5 (recap V2) | GPT-5.4 xhigh | Data aggregation + UI integration. Mechanical. |

---

## Sprint 5: QA + Launch Readiness

> **Duration:** 1 week (Week 11)  
> **Critical Path:** YES — gates the entire overhaul  
> **Bottleneck:** 3-rater independent scoring + integration test coverage  
> **Recommended Model:** GPT-5.4 xhigh for verification; Opus 4.6 for launch readiness audit

### S5 Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **S5.1** | Score all 10 phases against rubric (3 independent raters) | QA Agent (lead) + Verifier + Product Manager | Three raters (product, engineering, design) score independently per boost plan rubric. Use median per dimension. Any gap > 1.5 between raters → discuss and rescore. Calculate composite for all 10 phases | Scorecard with median scores; inter-rater agreement report | S4 | Required |
| **S5.2** | Integration tests for all 10 phases | QA Agent | Write + run integration tests: session creation → phase entry → core interaction → advance → next phase → recap. Cover: all 3 tiers × all 3 vibes = 9 paths. mini_script splice. Lie Detective V2 path. Speed-Friending path. Feature flag ON/OFF permutations | ≥ 30 integration test cases; ≥ 90% pass rate | S5.1 | Required |
| **S5.3** | Release notes + rollback plan | Launch Readiness Agent + Product Manager | Draft release notes: what's new (tier+vibe selector, dynamic agent compilation, Lie Detective V2, Speed-Friending, 7/10 phases ≥ 8.0), what's behind flags, known limitations. Rollback plan: disable feature flags → sessions revert to V1 behavior. Backward compat audit | Release notes in `docs/releases/icebreaker-v2.0.md`; rollback playbook | S5.2 | Required |
| **S5.4** | Feature flag audit + Go/No-Go | Launch Readiness Agent | Audit all feature flags: correct defaults, kill-switch semantics, env documentation parity. Run `npm run guardrails` + `npm run check:full`. Consolidate launch risks. Produce go/no-go recommendation | Feature flag audit report; go/no-go recommendation with evidence | S5.3 | Required |

### S5 Gate

```bash
npm run check:full  # guardrails + lint + tests + build — ALL must pass
npm run harness:gate  # 5-pillar quality gate
```

### S5 Agent Assignment Summary

| Agent | Tasks | Workload |
|-------|-------|:--------:|
| QA Agent | S5.1 (coordination), S5.2 | ~2.5 days |
| Verifier | S5.1 (scoring) | ~0.5 days |
| Product Manager | S5.1 (scoring), S5.3 | ~0.5 days |
| Launch Readiness Agent | S5.3, S5.4 | ~2 days |

### S5 Success Criteria

- [ ] 7 of 10 phases ≥ 8.0 composite per 3-rater independent scoring
- [ ] No phase regresses below S0 baseline
- [ ] ≥ 30 integration tests pass at ≥ 90% rate
- [ ] Release notes complete with feature flags documented
- [ ] Rollback plan documented and tested (disable all new flags → sessions revert to V1)
- [ ] `npm run check:full` passes
- [ ] `npm run harness:gate` passes
- [ ] Go/no-go recommendation from Launch Readiness Agent is "GO" with ≤ 2 low-severity risks

### S5 Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| S5.1 (3-rater scoring) | GPT-5.4 xhigh | Structured evaluation against defined rubric. Bounded judgment. |
| S5.2 (integration tests) | GPT-5.4 xhigh | Mechanical test execution. Large surface but well-defined. |
| S5.3 (release notes) | GPT-5.4 xhigh | Documentation synthesis from completed work. |
| S5.4 (go/no-go audit) | Opus 4.6 | High-stakes decision — launching or blocking the entire overhaul. Requires architectural judgment. |

---

## Full Dependency Graph

```
Sprint 0: Field Clearing
  ├── S0.1 quip_battle wire ──────────────────────────────┐
  ├── S0.2 undercover_word wire ───────────────────────────┤
  ├── S0.3 group_mirror wire ──────────────────────────────┤
  ├── S0.4 LLM-as-judge wire ───── (after S0.1–S0.3) ─────┤
  ├── S0.5 DB migration lie_truths ────────────────────────┤── S0 gate
  ├── S0.6 reconcile runPlans → phaseRegistry ─────────────┤
  ├── S0.7 port IceBreakerScrollCards ─────────────────────┤
  ├── S0.8 mini_script splice ──── (after S0.6) ───────────┤
  └── S0.9 widen eventTier ─────── (after S0.6) ───────────┘
       │
       ▼
Sprint 1: Tier+Vibe + Agent Engine
  ├── S1.1 tier+vibe UI ────────── (after S0.9) ──────────┐
  ├── S1.2 compileAgentRunPlan() ─ (after S0.6) ───────────┤
  ├── S1.3 LLM game selection ──── (after S1.2) ───────────┤── S1 gate
  ├── S1.4 vibe wiring ─────────── (after S1.2) ───────────┤
  ├── S1.5 /start + /set-tier ──── (after S1.2, S0.9) ────┤
  ├── S1.6 backward compat ─────── (after S0.9) ───────────┤
  └── S1.7 server tests ────────── (after S1.5) ───────────┘
       │
       ├────────────────────────────────────────────────────┐
       ▼                                                    ▼
Sprint 2: Lie Detective V2                          Sprint 3: Speed-Friending + Shared Infra
  ├── S2.1 V2 prompt ─── (after S0.5) ─┐                ├── S3.1 SF server ────── (after S0.1–S0.3) ─┐
  ├── S2.2 tag input UI ───────────────┤                ├── S3.2 SF UI ────────── (after S3.1) ────┤
  ├── S2.3 V2 reveal ──────────────────┤                ├── S3.3 CardFlip ────────────────────────┤
  ├── S2.4 dynamic difficulty ─────────┤── S2 gate      ├── S3.4 IdentityReveal ──────────────────┤── S3 gate
  ├── S2.5 V2→V1 degrade ─────────────┤                ├── S3.5 ParticleBurst ───────────────────┤
  ├── S2.6 fallback pool ──────────────┤                ├── S3.6 SwipeCard ───────────────────────┤
  ├── S2.7 recap V2 builder ───────────┤                ├── S3.7 TapReaction + TapRhythm ─────────┤
  └── S2.8 V2 tests ───────────────────┘                ├── S3.8 Context Injector ─ (after S1.2) ┤
       │                                                 ├── S3.9 Optimistic Sync ─── (after wired) ┤
       │                                                 └── S3.10 infra tests ─────────────────────┘
       │                                                    │
       └────────────────────┬───────────────────────────────┘
                            ▼
                 Sprint 4: Batch Boost
                   ├── S4.1 personality_dice ── (after S3.3–S3.9) ──┐
                   ├── S4.2 group_mirror + micro ────────────────────┤── S4 gate
                   ├── S4.3 undercover + quip ───────────────────────┤
                   ├── S4.4 auction lift ────────────────────────────┤
                   └── S4.5 recap V2 ───────── (after S2.7) ─────────┘
                            │
                            ▼
                 Sprint 5: QA + Launch
                   ├── S5.1 3-rater scoring ── (after S4) ──┐
                   ├── S5.2 integration tests ───────────────┤── S5 gate → GO/NO-GO
                   ├── S5.3 release notes ───────────────────┤
                   └── S5.4 flag audit + go/no-go ───────────┘
```

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Sprint |
|---|------|:----------:|:------:|------------|:------:|
| **R1** | Taro animation perf on low-end Android | High | High | ParticleBurst capped at 60; `prefers-reduced-motion` gate; test on real Xiaomi/OPPO before S3 close | S3 |
| **R2** | SwipeCard gesture conflicts with ScrollView | Medium | High | Test on 5 Android variants; if >1 shows conflict, degrade to TapReaction | S3 |
| **R3** | Context Injector token bloat breaks prompts | Medium | Medium | Archetype mix ≤ 100 chars — no budget issue. Highlights Phase 2 capped at 300 chars | S3 |
| **R4** | Optimistic Sync rollback feels jarring | Medium | Medium | Fade-to-gray + toast; only self-state reverts; group state unchanged | S3 |
| **R5** | 3 newly-wired phases (S0) regress existing flow | Low | High | All behind feature flags (default OFF); 1 integration test each before enabling | S0 |
| **R6** | 11-week timeline slips | Medium | High | Cut S4.5 (recap V2 integration) + S1.3 (LLM game selection) if behind by week 8. S5 is fixed 1-week gate — never compressed. | All |
| **R7** | V2 fallback pool curation takes >1.5 days | Medium | Low | Pool is 20 sets (not 36). Degrade to V1 if insufficient | S2 |
| **R8** | Warmup inline tag collection (deferred) blocks V2 pre-gen | Low | Low | Phase-start collection works; pre-gen is nice-to-have, not blocker | S2 |
| **R9** | Personality Dice dice roll animation complex | Medium | Low | Degrade to CardFlip with dice face image; ship, iterate | S4 |
| **R10** | compileAgentRunPlan() produces invalid plans | Medium | High | 100 test permutations; all 3 tiers × 3 vibes validated before S1 gate. 3s LLM timeout + rule engine fallback | S1 |
| **R11** | Speed-Friending archetype pairing produces poor matches | Low | Medium | Use complementary pairs from personality chemistry matrix. Manual review of 20 generated pairs before S3 gate | S3 |
| **R12** | Legacy tier backward compat breaks old sessions | Low | High | LEGACY_TIER_MAP tested with frozen JSONB sessions. `resolveTierDisplay()` aliases verified | S0, S1 |

---

## Feature Flags Register

| Flag | Sprint Added | Default | Default-ON Sprint | Controls |
|------|:-----------:|:-------:|:-----------------:|----------|
| `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` | S0 | OFF | S4 | quip_battle phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` | S0 | OFF | S4 | undercover_word phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` | S0 | OFF | S2 | group_mirror phase visibility (glow tier) |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Existing | OFF | S4 | auction phase visibility (blaze tier) |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | Existing | OFF | S1 | mini_script bonus phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | Existing | ON | — | personality_dice phase visibility |
| `LIE_DETECTIVE_MODE` | S2 | v1 | Post-S2 (4-week A/B) | `v1` = AI fabricates · `v2` = user tags + AI |
| `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION` | S1 | OFF | Post-S1 (after rule engine proven) | LLM-enhanced game selection |
| `CONTEXT_INJECTOR_ENABLED` | S3 | OFF | S4 | Archetype mix injection into prompts |
| `OPTIMISTIC_SYNC_ENABLED` | S3 | OFF | S4 | Optimistic vote + answer submission |
| `SOCIAL_ICEBREAKER_ENABLE_SPEED_FRIENDING` | S3 | OFF | Post-S3 | Speed-Friending phase visibility |

---

## Agent Portfolio Utilization

| Agent | S0 | S1 | S2 | S3 | S4 | S5 | Total Involvement |
|-------|:--:|:--:|:--:|:--:|:--:|:--:|:-----------------:|
| **Backend Engineer** | ✅ | ✅ | ✅ | ✅ | ✅ | — | 5 sprints |
| **Taro Mini-Program Frontend Engineer** | ✅ | ✅ | ✅ | ✅ | ✅ | — | 5 sprints |
| **AI Engineer** | ✅ | ✅ | ✅ | ✅ | ✅ | — | 5 sprints |
| **Game Design Agent** | — | ✅ | ✅ | — | — | — | 2 sprints |
| **Game Development Agent** | ✅ | — | — | — | — | — | 1 sprint |
| **Lie Detective Icebreaker Agent** | — | — | ✅ | — | — | — | 1 sprint |
| **Personality Dice Icebreaker Agent** | — | — | — | — | ✅ | — | 1 sprint |
| **Icebreaker Auction Phase Agent** | — | — | — | — | ✅ | — | 1 sprint |
| **Miniscript Story Agent** | ✅ | — | — | — | — | — | 1 sprint |
| **Database Schema & Migration Auditor** | ✅ | — | — | — | — | — | 1 sprint |
| **Taro Migration Specialist** | ✅ | — | — | — | — | — | 1 sprint |
| **QA Agent** | — | ✅ | ✅ | ✅ | — | ✅ | 4 sprints |
| **Verifier** | — | — | ✅ | — | — | ✅ | 2 sprints |
| **Product Manager** | — | — | — | — | — | ✅ | 1 sprint |
| **Launch Readiness Agent** | — | — | — | — | — | ✅ | 1 sprint |

---

## Recommended First Handoff

After user approval of this plan, the first handoff is:

> **Supervisor** — launches Sprint 0 with 6 parallel agents:
> 1. **Backend Engineer** → S0.1 + S0.2 + S0.3 (phase wiring, highest priority)
> 2. **Database Schema & Migration Auditor** → S0.5 (DB migration, no dependency)
> 3. **Backend Engineer** (second instance) → S0.6 (run plan reconciliation, no dependency)
> 4. **Taro Migration Specialist** → S0.7 (component port scaffold, no dependency)
> 5. **Miniscript Story Agent** → S0.8 (bonus prompt design, after S0.6)
> 6. **AI Engineer** + **Backend Engineer** → S0.4 (LLM-as-judge, after S0.1–S0.3)

Supervisor coordinates parallel S0.1–S0.7 work, sequences S0.8 after S0.6, consolidates turn reports, runs S0 gate.

---

## Deterministic Checks

At every sprint gate, run:

```bash
npm run guardrails          # Legacy identifiers, cross-app imports, secrets
npm run test -w @joyjoin/server  # Unit + integration tests
npm run db:verify           # Schema vs live DB consistency (S0 only)
```

At final Sprint 5 gate, run:

```bash
npm run check:full          # guardrails + lint + tests + build
npm run harness:gate        # 5-pillar quality gate
```

---

## Model Recommendation for Execution

| Sprint | Recommended Model | Justification | Est. Premium Cost |
|:------:|-------------------|---------------|:-----------------:|
| **S0** | **Opus 4.6** | Multi-file coordination, DB migration, cross-cutting contracts, deprecation. High blast radius. | ~3.0x for 2 weeks |
| **S1** | **Opus 4.6** (engine) + **GPT-5.4 xhigh** (UI) | Engine is core intelligence of the system; UI is well-specified. Split tier saves cost on bounded work. | ~2.0x blended for 2 weeks |
| **S2** | **Opus 4.6** (prompt) + **GPT-5.4 xhigh** (UI + tests) | V2 prompt needs adversarial thinking. UI is bounded. | ~1.5x blended for 2 weeks |
| **S3** | **Opus 4.6** (SwipeCard, Optimistic Sync, Speed-Friending) + **GPT-5.4 xhigh** (remaining components) | Gesture physics + state consistency are complex. Remaining components are mechanical. | ~1.5x blended for 2 weeks |
| **S4** | **GPT-5.4 xhigh** (most boosts) + **Opus 4.6** (auction) | Integration of proven shared infra. Auction is the exception — lowest score, needs quality. | ~1.0x blended for 2 weeks |
| **S5** | **GPT-5.4 xhigh** (verification) + **Opus 4.6** (go/no-go) | Verification is mechanical; go/no-go is high-stakes. | ~1.0x blended for 1 week |

**Overall estimated premium cost:** ~10.5x across 11 weeks (mixed tier strategy saves ~40% vs all-Opus).

### Escalation Triggers

- If `compileAgentRunPlan()` produces invalid plans in >5% of test permutations → escalate to **Opus 4.7** for redesign
- If SwipeCard conflicts appear on >1 Android variant → escalate Gesture Kit architecture review to **Opus 4.7**
- If 3-rater scoring shows < 7 phases ≥ 8.0 → escalate S4 boost strategy to **Opus 4.7** for replanning
- If `npm run harness:gate` fails at S5 gate → full Harness Runtime Controller deliberation before go/no-go

---

## Reference Index

| Document | Path | Key Sections for Implementation |
|----------|------|--------------------------------|
| Unified Icebreaker System | `docs/unified-icebreaker-system.md` | §2 (tier definitions), §4 (game pool), §5 (agent compilation rules), §8 (backward compat), §10 (files to touch) |
| Mini-Program Icebreaker PRD | `docs/mini-program-icebreaker-prd.md` | §1 (tier+vibe selector spec tokens), §2 (phase navigation), §3 (per-phase UI specs), §4 (Reveal Engine), §5 (Gesture Kit), §6 (state/error management) |
| Lie Detective V2 Design | `docs/proposals/spot-the-bot-game-design.md` | §4 (type definitions), §5 (DB), §6 (API endpoints), §7 (AI prompt design), §8 (fallback & edge cases), §9 (client UI specs) |
| Boost Plan | `.git/.orchestration/plans/boost-all-games-to-8.md` | Scoring rubric, current scores, shared infra specs §1–4, target scorecard, risk register |
| Tier Naming Deliberation | `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md` | Final tier naming consensus |
| Agent Manifest | `.github/agents/manifest.json` | Agent capabilities, skills, handoff patterns |
| Model Catalog | `.github/agents/MODEL_CATALOG.md` | Model pricing, suitability heuristics, escalation ladder |
| Developer Quick Reference | `DEVELOPER_QUICK_REFERENCE.md` | Active vs legacy, monorepo commands, architecture rules |
| Product Requirements | `PRODUCT_REQUIREMENTS.md` | Product canon, terminology |

---

*End of Master Execution Plan. Approved plan triggers Supervisor handoff for Sprint 0 launch.*
