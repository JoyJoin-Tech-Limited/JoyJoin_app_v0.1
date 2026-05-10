# JoyJoin Icebreaker System Overhaul — Master Execution Plan

> **Version:** 1.1 · **Date:** 2026-05-07  
> **Status:** In Progress — Sprint 1 Core Complete; Sprint 0 Resumed  
> **Owner:** Supervisor  
> **Timeline:** 10–11 weeks total (6 Sprints)

---

## Executive Summary

### Mission in One Sentence

**Replace hardcoded tier run plans with a dynamic Game Design Agent, wire all 8 non-core phases into the session flow, boost every phase to composite ≥ 8.0 through shared infrastructure (Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync), and deliver a polished tier+vibe selection UX in the mini-program — all behind feature flags with zero regression.**

### State of Play

| Item | Status | Detail |
|------|:------:|--------|
| `compileAgentRunPlan()` Rule Engine | ✅ **COMPLETE** | `packages/shared/src/runPlanCompiler.ts` — deterministic rule engine with 159 passing tests. Energy-arc sorting, category spacing, proportional time allocation. |
| `/start` + `/set-tier` wired to compiler | ✅ **COMPLETE** | `apps/server/src/routes/socialIcebreaker.ts` calls `compileForSession()` from `runPlanService.ts`. Fallback to hardcoded plans on error. |
| `docs/unified-icebreaker-system.md` | ✅ **CREATED** | 12-section canonical spec consolidating tier definitions, game pool, compilation rules, REST surface, backward compat. |
| `socialIcebreakerTierManifest.ts` | ✅ **WIRED** | `breeze`/`glow`/`blaze` machine IDs + `resolveTierDisplay()` active server-side and in mini-program tier selector. |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | ✅ **ENABLED** | `.env` flag set to `true`. `mini_script` is playable as bonus phase. |
| `quip_battle` / `undercover_word` / `group_mirror` wiring | ❌ **NOT DONE** | Server stubs exist in `socialIcebreaker.ts` (advance guards, routes). Mini-program references exist in `phaseUtils.tsx`. **Not wired into `getServerEnabledPhases()` — unreachable.** |
| `socialIcebreakerRunPlans.ts` deprecation | ❌ **NOT DONE** | Still exports `BREEZE_RUN_PLAN`, `GLOW_RUN_PLAN`, `BLAZE_RUN_PLAN` as fallback. Not marked `@deprecated`. |
| `lie_truths` DB migration | ❌ **NOT DONE** | Schema has `is_ai` + `source_tag` columns in `_definitions.ts`. Migration not generated (`db:generate` + `db:rebuild-journal` pending). |
| LLM game selection enhancement | ⚠️ **FLAG ONLY** | `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION` documented in `.env.example`. Implementation deferred. |
| Vibe parameter | ⚠️ **TYPE ONLY** | `CompilationContext.vibe` exists but compilation ignores it (weights not implemented). |
| Archetype mix at session start | ❌ **NOT DONE** | Not collected; `Context Injector` (Sprint D) depends on this. |
| `eventTier` type widening | ❌ **NOT DONE** | `SocialSessionState.eventTier` still `'standard' \| 'premium' \| 'bar'`. |

### What Must Be True When We Stop

1. Host selects tier (`breeze`/`glow`/`blaze`) + vibe (`chat`/`balanced`/`game`) → `compileAgentRunPlan()` produces a valid `IcebreakerRunPlan` dynamically ✅ *partial — compilation works, vibe ignored*
2. All 8 non-core phases are playable in the mini-program session flow (behind feature flags) ❌ *3 phases not wired*
3. Lie Detective V2 (`LIE_DETECTIVE_MODE=v2`) is operational with user-tag input + AI fake injection + V1 degrade ❌
4. Speed-Friending phase exists as a 15min Aron's 36 Questions + archetype-pairing experience ❌
5. 7 of 10 phases score ≥ 8.0 on the boost rubric; no phase regresses ❌
6. 4 shared infra systems (Reveal Engine, Gesture Kit, Context Injector, Optimistic Sync) are integrated into ≥ 5 phases ❌
7. `npm run guardrails` + `npm run test -w @joyjoin/server` pass; all wiring behind feature flags (default OFF) ⚠️ *passes today; must continue passing*
8. Tier manifest (`resolveTierDisplay`) is wired to both client and server; legacy `standard`/`premium`/`bar` mapped ✅ *server-side wired; client-side needs verification*

### Total Timeline (Re-sequenced)

```
Sprint A: Field Clearing (Resumed)  (Week 1)     ← IMMEDIATE BOTTLENECK
Sprint B: Tier+Vibe Completion      (Week 2–3)
Sprint C: Lie Detective V2          (Week 4–5)
Sprint D: Speed-Friending + Infra   (Week 6–7)
Sprint E: Batch Boost               (Week 8–9)
Sprint F: QA + Launch               (Week 10)
```

*Rationale for re-sequencing:* Sprint 1 core (`compileAgentRunPlan()`) was completed ahead of Sprint 0. The 3 unwired phases are now the critical path blocker for all boost work. Sprint A completes the original S0 scope before Sprint B finishes the remaining S1 work.

---

## Validated Codebase State

| Gap | Status | Detail |
|-----|:------:|--------|
| quip_battle / undercover_word / group_mirror phase modules | ⚠️ Partial | Server route stubs exist (advance guards, AI prompts, some routes). Mini-program `phaseUtils.tsx` references them. **Not in `getServerEnabledPhases()` — unreachable.** |
| LLM-as-judge (603 lines) | ✅ Code exists | `qualityJudgePrompts.ts` + `preGenerationWorker.ts` — wired for warmup, lie_detective, personality_dice, auction, quip_battle but NOT mini_script blocking mode |
| lie_truths DB columns | ⚠️ Schema only | `is_ai BOOLEAN` + `source_tag TEXT` in `_definitions.ts`. **Migration not generated.** |
| socialIcebreakerTierManifest.ts | ✅ Wired | Correct breeze/glow/blaze mapping + `resolveTierDisplay()`. Wired to server; client wiring needs verification |
| IceBreakerScrollCards | ✅ Web only | `apps/user-client/src/components/IceBreakerScrollCards.tsx` — NOT ported to mini-program |
| eventTier type | ❌ String | `SocialSessionState.eventTier?: 'standard' \| 'premium' \| 'bar'` — needs `'breeze' \| 'glow' \| 'blaze'` union |
| compileAgentRunPlan() | ✅ **COMPLETE** | Deterministic rule engine with tier budgets, energy-arc sorting, category spacing, proportional time allocation. 159 tests passing. |
| mini_script bonus splice | ❌ Missing | Phase module exists but no post-phase 悦仔 prompt, no splice logic, no recap time shift |
| speed_friending | ❌ Missing | Zero code, zero schema, zero prompts — full implementation needed |
| socialIcebreakerRunPlans.ts | ⚠️ Active fallback | Contains BREEZE/GLOW/BLAZE constants. Used as compiler fallback. Needs `@deprecated` + migration guide |

### Reference Documents (Canonical Specs)

| Document | Covers | When to Consult |
|----------|--------|-----------------|
| `docs/icebreaker/icebreaker-system.md` | Canonical architecture: session lifecycle, phase registry, REST surface, AI boundaries | All sprints |
| `docs/icebreaker/icebreaker-execution-plan.md` | This document — master execution plan with sprint breakdown | All sprints |
| `docs/unified-icebreaker-system.md` | Tier system, game pool, compilation rules, backward compat | Sprint B |
| `.git/.orchestration/deliberation/2026-04-30-icebreaker-tier-unification.md` | Tier definitions (breeze/glow/blaze), phase composition, backward compat rules | Sprint A–B |
| `packages/shared/src/phaseRegistry.ts` | Phase module registry — game pool, energy arcs, durations, categories | Sprint A |
| `packages/shared/src/runPlanCompiler.ts` | `compileAgentRunPlan()`, `CompilationContext`, deterministic rule engine | Sprint B |
| `docs/mini-program-icebreaker-prd.md` | Tier+vibe selector UI spec tokens, phase navigation, per-phase UI specs with Reveal/Gesture integration, state/error management | Sprint B (UI), Sprint D (Reveal/Gesture), Sprint E (boost) |
| `docs/proposals/spot-the-bot-game-design.md` | Lie Detective V2: type definitions, DB, API endpoints, AI prompt design, difficulty, fallbacks, client UI specs | Sprint C |
| `.git/.orchestration/plans/boost-all-games-to-8.md` | Scoring rubric, current scores, shared infra specs, target scorecard, risk register | Sprint D–F |
| `AGENTS.md`, `DEVELOPER_QUICK_REFERENCE.md`, `PRODUCT_REQUIREMENTS.md` | Active vs legacy, monorepo rules, commands, architecture | All sprints |

---

## Sprint A: Field Clearing (Resumed)

> **Duration:** 1 week (Week 1)  
> **Critical Path:** YES — blocks all boost work and remaining S1 completion  
> **Bottleneck:** 3 unreachable phases preventing shared infra integration  
> **Recommended Model:** DeepSeek V4 Pro (bounded multi-file; no architecture changes)

### Why This Sprint Exists

The original Sprint 0 (Field Clearing) was partially executed out of order. `compileAgentRunPlan()` (original Sprint 1 task) was completed first because it was the highest-leverage deliverable. Now we must return to complete Sprint 0's unfinished wiring before any boost work or shared infra integration can proceed.

### SA Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **SA.1** | Wire quip_battle into session flow | Backend Engineer | Add `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` to `getServerEnabledPhases()` in `socialIcebreakerPhaseConfig.ts`; verify advance guard at line ~1571 works; ensure `phaseUtils.tsx` mapping routes correctly; add cleanup on phase exit. | Phase playable behind flag; advance guard functional; integration test passes | — | Required |
| **SA.2** | Wire undercover_word into session flow | Backend Engineer | Add `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` to `getServerEnabledPhases()`; verify advance guard at line ~563 works; ensure cleanup fires. | Phase playable behind flag; word secrecy preserved | — | Required |
| **SA.3** | Wire group_mirror into session flow | Backend Engineer | Add `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` to `getServerEnabledPhases()`; verify advance guard at line ~572 works; ensure anonymous voting works; add cleanup. | Phase playable behind flag; anonymous voting functional | — | Required |
| **SA.4** | Deprecate socialIcebreakerRunPlans.ts | Backend Engineer | Add `@deprecated` JSDoc to file. Add migration comment: "Use `compileAgentRunPlan()` from `@shared/runPlanCompiler` for new code." Keep exports as compiler fallback — do NOT delete. | File marked deprecated; no import breakage; compiler remains fallback | — | Required |
| **SA.5** | DB migration: lie_truths columns | Database Schema & Migration Auditor | Run `npm run db:generate` → review SQL → `npm run db:rebuild-journal` → apply with `psql` (Neon direct endpoint). Verify with `npm run db:verify` | Migration in journal; columns exist in live DB; CI gate passes | — | Required |
| **SA.6** | Add 3 env vars to `.env.example` | Backend Engineer | Document `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE`, `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD`, `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` with descriptions and default OFF | `.env.example` has all 3 flags | — | Required |
| **SA.7** | Integration tests for 3 newly-wired phases | QA Agent + Backend Engineer | One test per phase: session creation → phase entry → core interaction → advance. All behind feature flags (default OFF in test env). | ≥ 3 integration tests pass | SA.1–SA.3 | Required |

### SA Gate

```bash
npm run guardrails      # Must pass: no legacy identifiers, no cross-app imports
npm run db:verify       # Must pass: schema vs live DB consistent
npm run test -w @joyjoin/server  # Must pass: all existing tests + new integration tests
```

### SA Success Criteria

- [ ] `quip_battle`, `undercover_word`, `group_mirror` playable in mini-program behind feature flags (all OFF by default)
- [ ] Each newly-wired phase has ≥ 1 integration test
- [ ] `lie_truths` has `is_ai` + `source_tag` columns in migration journal and live DB
- [ ] `socialIcebreakerRunPlans.ts` is marked `@deprecated` with migration guide comment
- [ ] `.env.example` documents all 3 new feature flags
- [ ] All guardrails pass
- [ ] `compileAgentRunPlan()` still returns valid plans (no regression)

### SA Model Recommendation

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| SA.1–SA.3 (phase wiring) | DeepSeek V4 Pro | Bounded, well-defined integration points. No new architecture. |
| SA.4 (deprecation) | DeepSeek V4 Flash | Single-file comment + JSDoc. |
| SA.5 (DB migration) | DeepSeek V4 Pro | Data integrity. Must verify Neon DDL. |
| SA.6 (env docs) | DeepSeek V4 Flash | Documentation only. |
| SA.7 (tests) | DeepSeek V4 Pro | Test wiring based on existing patterns. |

---

## Sprint B: Tier + Vibe Completion

> **Duration:** 2 weeks (Week 2–3)  
> **Critical Path:** YES — completes remaining Sprint 1 work  
> **Bottleneck:** Vibe weight implementation in compiler; tier+vibe selector UI polish  
> **Recommended Model:** DeepSeek V4 Pro (compiler); GPT-5.4 xhigh (UI)

### SB Task Breakdown

| ID | Task | Agent | Description | Expected Output | Depends On | Approval |
|:--:|------|-------|-------------|-----------------|:----------:|:--------:|
| **SB.1** | Build polished tier+vibe selection UI | Taro Mini-Program Frontend Engineer | Implement tier+vibe selector page per `docs/mini-program-icebreaker-prd.md` §1 spec tokens. Three tier cards (破冰局/畅聊局/狂欢局) with emoji, duration, game count. Three vibe chips (聊天感/混合感/竞技感). Default selection: 畅聊局 + 混合感. 悦仔 personalized line fade-in. All states: no selection, selected, submitting, error. CTA disabled until tier selected. `localStorage` persistence | Page renders in WeChat DevTools; matches spec tokens exactly; all states handled | SA | Required |
| **SB.2** | Wire vibe to run plan compilation | Backend Engineer | Vibe (`chat`/`balanced`/`game`) influences game selection weights in `compileAgentRunPlan()`: `chat` → prefer personality_dice, group_mirror; `balanced` → even distribution; `game` → prefer undercover_word, quip_battle, auction. | vibe parameter changes run plan composition measurably | SA | Required |
| **SB.3** | LLM game selection enhancement | AI Engineer | When `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION=true`, call DeepSeek to rank game suitability per archetype mix + warmup mood. 3s timeout → fallback to rule engine baseline. Prompt version: `social-game-selection-v1`. AITrace logging. | LLM selection enriches rule engine output; 3s timeout not exceeded; fallback works | SB.2 | Optional |
| **SB.4** | Backward compat: LEGACY_TIER_MAP | Backend Engineer | Implement `LEGACY_TIER_MAP: { standard→glow, premium→blaze, bar→breeze }`. Old sessions (frozen JSONB): replay as-is, no migration. `resolveTierDisplay()` accepts legacy aliases → maps to correct display. `getRunPlanForTier()`: old key → frozen run plan, new key → agent-compiled | Old sessions replay without error; display names correct; no data migration | SA | Required |
| **SB.5** | Widen eventTier type | Backend Engineer | Change `SocialSessionState.eventTier` from `'standard' \| 'premium' \| 'bar'` to `'breeze' \| 'glow' \| 'blaze'`. Add `LEGACY_TIER_MAP` for backward-compat reads. Wire `resolveTierDisplay()` into server tier display code AND mini-program tier selection UI. | `eventTier` is typed union; display names resolved from manifest; legacy sessions mapped | SA | Required |
| **SB.6** | Server tests for tier+vibe flow | QA Agent + Backend Engineer | Add tests for: `/start` with all tier+vibe combos, `/set-tier` during warmup, `/set-tier` after warmup (rejected), legacy tier input mapping, agent compilation output validation, vibe weight verification | ≥ 15 test cases pass | SB.2, SB.5 | Required |

### SB Gate

```bash
npm run test -w @joyjoin/server  # Must pass all new tier+vibe tests
# Manual: compileAgentRunPlan() returns valid plans for all 3 tiers × 3 vibes = 9 permutations
# Manual: WeChat DevTools — tier+vibe selector page renders with spec tokens
```

### SB Success Criteria

- [ ] Tier+vibe selector renders per spec tokens; all states functional
- [ ] `compileAgentRunPlan()` returns valid `IcebreakerRunPlan` for breeze/glow/blaze with chat/balanced/game
- [ ] Vibe parameter measurably changes game selection (chat → more reflection games; game → more competitive games)
- [ ] `/start` accepts `{ tier, vibe }` and returns session with compiled run plan
- [ ] `/set-tier` only works during warmup; rejects after
- [ ] Legacy `standard`/`premium`/`bar` sessions display correct tier names and replay without error
- [ ] All server tests pass

---

## Sprint C: Lie Detective V2

> **Duration:** 2 weeks (Week 4–5)  
> **Critical Path:** Partial — V2 is a vertical slice on top of wired lie_detective phase  
> **Bottleneck:** AI prompt quality for fake statement generation  
> **Recommended Model:** Opus 4.6 for prompt design + server logic; GPT-5.4 xhigh for UI

*Unchanged from v1.0 Sprint 2. See original plan for full task breakdown.*

**Key dependency:** SA.5 (DB migration) must be complete before V2 server work begins.

---

## Sprint D: Speed-Friending + Shared Infrastructure

> **Duration:** 2 weeks (Week 6–7)  
> **Critical Path:** YES — shared infra must exist before Sprint E batch boost  
> **Bottleneck:** Reveal Engine component creation + mini-program animation performance  
> **Recommended Model:** Opus 4.6 for engine architecture; GPT-5.4 xhigh for phase implementation

*Unchanged from v1.0 Sprint 3. See original plan for full task breakdown.*

---

## Sprint E: Batch Game Boost Rollout

> **Duration:** 2 weeks (Week 8–9)  
> **Critical Path:** Partial — lifts scores on wired phases using shared infra  
> **Bottleneck:** Undercover word + auction visual/interaction overhaul  
> **Recommended Model:** GPT-5.4 xhigh for most boosts; Opus 4.6 for auction overhaul

*Unchanged from v1.0 Sprint 4. See original plan for full task breakdown.*

---

## Sprint F: QA + Launch Readiness

> **Duration:** 1 week (Week 10)  
> **Critical Path:** YES — gates the entire overhaul  
> **Bottleneck:** 3-rater independent scoring + integration test coverage  
> **Recommended Model:** GPT-5.4 xhigh for verification; Opus 4.6 for launch readiness audit

*Unchanged from v1.0 Sprint 5. See original plan for full task breakdown.*

---

## Feature Flags Register (Updated)

| Flag | Sprint Added | Default | Default-ON Sprint | Controls |
|------|:-----------:|:-------:|:-----------------:|----------|
| `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` | SA | OFF | SE | quip_battle phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` | SA | OFF | SE | undercover_word phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` | SA | OFF | SC | group_mirror phase visibility (glow tier) |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Existing | OFF | SE | auction phase visibility (blaze tier) |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | Existing | **ON** | — | mini_script bonus phase visibility |
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | Existing | ON | — | personality_dice phase visibility |
| `LIE_DETECTIVE_MODE` | SC | v1 | Post-SC (4-week A/B) | `v1` = AI fabricates · `v2` = user tags + AI |
| `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION` | SB | OFF | Post-SB | LLM-enhanced game selection |
| `CONTEXT_INJECTOR_ENABLED` | SD | OFF | SE | Archetype mix injection into prompts |
| `OPTIMISTIC_SYNC_ENABLED` | SD | OFF | SE | Optimistic vote + answer submission |
| `SOCIAL_ICEBREAKER_ENABLE_SPEED_FRIENDING` | SD | OFF | Post-SD | Speed-Friending phase visibility |

---

## Full Dependency Graph (Re-sequenced)

```
Sprint A: Field Clearing (Resumed)
  ├── SA.1 quip_battle wire ──────────────────────────────┐
  ├── SA.2 undercover_word wire ───────────────────────────┤
  ├── SA.3 group_mirror wire ──────────────────────────────┤
  ├── SA.4 deprecate runPlans ─────────────────────────────┤── SA gate
  ├── SA.5 DB migration lie_truths ────────────────────────┤
  ├── SA.6 env vars ───────────────────────────────────────┤
  └── SA.7 integration tests ──────────────────────────────┘
       │
       ▼
Sprint B: Tier+Vibe Completion
  ├── SB.1 tier+vibe UI ───────────────────────────────────┐
  ├── SB.2 vibe wiring ────────────────────────────────────┤
  ├── SB.3 LLM selection ──────────────────────────────────┤── SB gate
  ├── SB.4 backward compat ────────────────────────────────┤
  ├── SB.5 eventTier widening ─────────────────────────────┤
  └── SB.6 server tests ───────────────────────────────────┘
       │
       ├────────────────────────────────────────────────────┐
       ▼                                                    ▼
Sprint C: Lie Detective V2                          Sprint D: Speed-Friending + Infra
  ├── SC.1 V2 prompt ─── (after SA.5) ─┐                ├── SD.1 SF server ────────┐
  ├── SC.2 tag input UI ───────────────┤                ├── SD.2 SF UI ────────────┤
  ├── SC.3 V2 reveal ──────────────────┤                ├── SD.3 CardFlip ─────────┤
  ├── SC.4 dynamic difficulty ─────────┤── SC gate      ├── SD.4 IdentityReveal ───┤── SD gate
  ├── SC.5 V2→V1 degrade ─────────────┤                ├── SD.5 ParticleBurst ────┤
  ├── SC.6 fallback pool ──────────────┤                ├── SD.6 SwipeCard ────────┤
  ├── SC.7 recap builder ──────────────┤                ├── SD.7 TapReaction ──────┤
  └── SC.8 V2 tests ───────────────────┘                ├── SD.8 Context Injector ┤
       │                                                 ├── SD.9 Optimistic Sync ──┤
       │                                                 └── SD.10 infra tests ─────┘
       └────────────────────┬───────────────────────────────┘
                            ▼
                 Sprint E: Batch Boost
                   ├── SE.1 personality_dice ──┐
                   ├── SE.2 group_mirror + micro ├─ SE gate
                   ├── SE.3 undercover + quip ───┤
                   ├── SE.4 auction lift ────────┤
                   └── SE.5 recap V2 ────────────┘
                            │
                            ▼
                 Sprint F: QA + Launch
                   ├── SF.1 3-rater scoring ──┐
                   ├── SF.2 integration tests ──┼─ SF gate → GO/NO-GO
                   ├── SF.3 release notes ──────┤
                   └── SF.4 flag audit ─────────┘
```

---

## Risk Register (Updated)

| # | Risk | Likelihood | Impact | Mitigation | Sprint |
|---|------|:----------:|:------:|------------|:------:|
| **R1** | Taro animation perf on low-end Android | High | High | ParticleBurst capped at 60; `prefers-reduced-motion` gate | SD |
| **R2** | SwipeCard gesture conflicts with ScrollView | Medium | High | Test on 5 Android variants; degrade to TapReaction if needed | SD |
| **R3** | Context Injector token bloat | Medium | Medium | Archetype mix ≤ 100 chars | SD |
| **R4** | Optimistic Sync rollback jarring | Medium | Medium | Fade-to-gray + toast; only self-state reverts | SD |
| **R5** | 3 newly-wired phases (SA) regress existing flow | Low | High | All behind flags (default OFF); 1 integration test each before enabling | SA |
| **R6** | 10-week timeline slips | Medium | High | Cut SE.5 (recap V2) + SB.3 (LLM selection) if behind by week 8. SF is fixed 1-week gate. | All |
| **R7** | V2 fallback pool curation takes >1.5 days | Medium | Low | Pool is 20 sets. Degrade to V1 if insufficient | SC |
| **R8** | compileAgentRunPlan() produces invalid plans with vibe weights | Low | High | 100 test permutations; all 9 tier×vibe validated before SB gate | SB |
| **R9** | Personality Dice dice roll animation complex | Medium | Low | Degrade to CardFlip with dice face image | SE |
| **R10** | Speed-Friending pairing produces poor matches | Low | Medium | Use complementary pairs from chemistry matrix. Manual review of 20 pairs before SD gate | SD |
| **R11** | Legacy tier backward compat breaks old sessions | Low | High | LEGACY_TIER_MAP tested with frozen JSONB sessions | SB |
| **R12** | Out-of-order execution leaves hidden gaps | Medium | Medium | Verifier + QA Agent validate SA gate before SB starts. Auto-Eval dirty-worktree gate. | SA |

---

## Deterministic Checks

At every sprint gate, run:

```bash
npm run guardrails          # Legacy identifiers, cross-app imports, secrets
npm run test -w @joyjoin/server  # Unit + integration tests
npm run db:verify           # Schema vs live DB consistency (SA only)
```

At final Sprint F gate, run:

```bash
npm run check:full          # guardrails + lint + tests + build
npm run harness:gate        # 5-pillar quality gate
```

---

## Model Recommendation for Execution (Updated)

| Sprint | Recommended Model | Justification | Est. Premium Cost |
|:------:|-------------------|---------------|:-----------------:|
| **SA** | **DeepSeek V4 Pro** | Bounded integration work. No architecture changes. Well-defined acceptance criteria. | ~1.0x for 1 week |
| **SB** | **DeepSeek V4 Pro** (compiler) + **GPT-5.4 xhigh** (UI) | Engine needs correctness across 9 permutations; UI is well-specified. | ~1.5x blended for 2 weeks |
| **SC** | **Opus 4.6** (prompt) + **GPT-5.4 xhigh** (UI + tests) | V2 prompt needs adversarial thinking. UI is bounded. | ~1.5x blended for 2 weeks |
| **SD** | **Opus 4.6** (SwipeCard, Optimistic Sync, Speed-Friending) + **GPT-5.4 xhigh** (remaining) | Gesture physics + state consistency are complex. | ~1.5x blended for 2 weeks |
| **SE** | **GPT-5.4 xhigh** (most boosts) + **Opus 4.6** (auction) | Integration of proven shared infra. Auction exception. | ~1.0x blended for 2 weeks |
| **SF** | **GPT-5.4 xhigh** (verification) + **Opus 4.6** (go/no-go) | Verification mechanical; go/no-go high-stakes. | ~1.0x blended for 1 week |

**Overall estimated premium cost:** ~8.5x across 10 weeks (mixed tier strategy saves ~35% vs all-Opus).

### Escalation Triggers

- If `compileAgentRunPlan()` produces invalid plans in >5% of test permutations → escalate to **Opus 4.7** for redesign
- If SwipeCard conflicts appear on >1 Android variant → escalate Gesture Kit architecture review to **Opus 4.7**
- If 3-rater scoring shows < 7 phases ≥ 8.0 → escalate SE boost strategy to **Opus 4.7** for replanning
- If `npm run harness:gate` fails at SF gate → full Harness Runtime Controller deliberation before go/no-go

---

## Changelog from v1.0

| Date | Change | Reason |
|------|--------|--------|
| 2026-05-07 | v1.1 — Re-sequenced sprints | `compileAgentRunPlan()` completed out of order (original S1.2 done before S0). Sprint A created to resume field clearing. |
| 2026-05-07 | Added `State of Play` table | Tracks what's done vs not done after partial execution |
| 2026-05-07 | Sprint count 5→6 | Sprint A (Field Clearing Resumed) inserted before Sprint B |
| 2026-05-07 | Timeline 11 weeks → 10 weeks | Sprint A is 1 week (not 2) because scope is narrowed to wiring only |
| 2026-05-07 | Added Risk R12 | Out-of-order execution risk |
| 2026-05-07 | Updated Feature Flags | `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` now default ON |
| 2026-05-07 | Updated cost estimate | 10.5x → 8.5x reflecting DeepSeek V4 Pro for SA instead of Opus |

---

*End of Master Execution Plan v1.1. Approved plan triggers Supervisor handoff for Sprint A launch.*
