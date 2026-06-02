# Icebreaker Vibe Reframe — Implementation Plan

Last updated: 2026-05-27

## Mission

Replaced the old 2-axis vibe system (Budget × `聊天感/混合感/竞技感`) with a cleaner Budget × Activity Preference model (`深聊/均衡/暢玩`), where vibe directly controls phase selection, phase duration, and warmup depth — making icebreaker sessions feel intentionally crafted rather than generically compiled. Shipped 2026-05-27 behind `RUN_PLAN_TEMPLATES_ENABLED`.

## PM Review — Resolved

### Blocker 1: Phase Classification ✅ Resolved

| Phase | Category | Tone | 深聊 Slot | 暢玩 Slot | 任意 Slot | Notes |
|-------|----------|------|----------|----------|----------|-------|
| `warmup` | conversation | gentle | ✅ Core | ✅ Core | ✅ Core | Always first. Duration + depth varies by vibe. |
| `micro_challenge` | game | playful | ✅ Core | ✅ Core | ✅ Core | Always second. Duration varies by vibe. |
| `recap` | conversation | gentle | ✅ Core | ✅ Core | ✅ Core | Always last. Duration varies by vibe. |
| `lie_detective` | deduction | playful | ✅ | ✅ | ✅ | Vibe-affects duration (18min 深聊 / 12min 暢玩) |
| `personality_dice` | creative | playful | ✅ | ✅ | ✅ | Vibe-affects duration (15min 深聊 / 10min 暢玩) |
| `group_mirror` | creative | gentle | ✅ | — | ✅ | 深聊-leaning: reflection activity (14min 深聊) |
| `undercover_word` | deduction | playful | — | ✅ | ✅ | 暢玩-leaning: deception/competitive |
| `quip_battle` | creative | playful | — | ✅ | ✅ | 暢玩-leaning: humor competition |
| `auction` | competition | competitive | — | ✅ | — | 暢玩-locked: pure competition |
| `speed_friending` | conversation | playful | ✅ | — | ✅ | 深聊-locked: 1-on-1 timed conversations (glow+blaze only) |
| `mini_script` | narrative | dramatic | — | — | ✅ | Bonus-only: gated by host+player vote, not in templates |

**Phase affinity summary:**
- 深聊-slots eligible: `lie_detective`, `personality_dice`, `group_mirror`, `speed_friending`
- 暢玩-slots eligible: `lie_detective`, `undercover_word`, `quip_battle`, `auction`
- 任意-slots eligible: `lie_detective`, `personality_dice`, `group_mirror`, `undercover_word`, `quip_battle`, `speed_friending`, `mini_script` (bonus gate)
- Always-present: `warmup`, `micro_challenge`, `recap` (core/closing, never in slots)

### Blocker 2: Template Authority ✅ Resolved

**Rule:** The template is the **final authority** on phase selection and duration. AI **only** polishes:

1. **Warmup prompt depth** — when `vibe = 深聊`, AI generates 3-tier follow-up prompts for each topic card. When `vibe = 暢玩`, AI generates lighter, faster prompts.
2. **Group-tailored warmup prompts** — AI adjusts topic card wording based on archetype mix (e.g., 3x树洞考拉 → prompts that draw out introverts).
3. **Duration fine-tuning** — AI may shift per-slot durations by ±3 minutes based on group signals, capped by the template's `minMinutes`/`maxMinutes` bounds.

AI does **NOT** swap, add, or remove phases. If AI fails during pre-compilation, the raw template runs unchanged — no fallback to `compileAgentRunPlan()`.

---

## 3×3 Slot Matrix

### 深聊 (Deep Chat) — Connection-first, fewer phases, longer durations

| Cell | Slots (type: phase, minutes) | Total phases | Phase minutes | Group-tailored? |
|------|-----|-------------|--------------|-----------------|
| **深聊 × breeze** (40min) | Core: warmup(18m) → micro_challenge(10m) → 深聊槽(1): `[group_mirror\|personality_dice]`(7m) → Core: recap(5m) | 4 | 40 | warmup only |
| **深聊 × glow** (60min) | Core: warmup(18m) → micro_challenge(10m) → 任意槽(1): `[lie_detective\|personality_dice]`(12m) → 深聊槽(1): `[group_mirror\|speed_friending]`(14m) → Core: recap(6m) | 5 | 60 | warmup + prompts |
| **深聊 × blaze** (90min) | Core: warmup(20m) → micro_challenge(10m) → 任意槽(1): `[lie_detective\|personality_dice]`(14m) → 深聊槽(1): `[group_mirror]`(14m) → 任意槽(2): `[speed_friending\|personality_dice]`(18m) → Core: recap(6m) | 6 | 82 (+8min slack) | warmup + prompts |

```
深聊 × blaze minimum perceptible difference from 暢玩 × blaze:
  - 2 fewer phases (6 vs 8)
  - warmup: 20min vs 8min (2.5× depth)
  - zero competitive phases (no auction, undercover_word, quip_battle)
  - speed_friending present in glow+/blaze
  - group_mirror (reflection) guaranteed in glow+/blaze
```

### 暢玩 (Play Fun) — Energy-first, more phases, shorter durations

| Cell | Slots (type: phase, minutes) | Total phases | Phase minutes | Group-tailored? |
|------|-----|-------------|--------------|-----------------|
| **暢玩 × breeze** (40min) | Core: warmup(6m) → micro_challenge(10m) → 暢玩槽(1): `[lie_detective]`(12m) → 任意槽(1): `[quip_battle\|personality_dice]`(7m) → Core: recap(5m) | 5 | 40 | light warmup |
| **暢玩 × glow** (60min) | Core: warmup(6m) → micro_challenge(10m) → 暢玩槽(1): `[lie_detective]`(12m) → 暢玩槽(2): `[undercover_word\|quip_battle]`(12m) → 任意槽(1): `[personality_dice\|lie_detective\|quip_battle]`(10m) → Core: recap(5m) | 6 | 55 (+5min slack) | light warmup |
| **暢玩 × blaze** (90min) | Core: warmup(8m) → micro_challenge(10m) → 暢玩槽(1): `[lie_detective]`(12m) → 暢玩槽(2): `[undercover_word]`(12m) → 暢玩槽(3): `[auction]`(16m) → 任意槽(1): `[quip_battle\|personality_dice]`(10m) → 任意槽(2): `[lie_detective\|quip_battle]`(10m) → Core: recap(5m) | 8 | 83 (+7min slack) | light warmup |

### 均衡 (Balanced) — Standard mix, flexible

| Cell | Slots (type: phase, minutes) | Total phases | Phase minutes |
|------|-----|-------------|--------------|
| **均衡 × breeze** (40min) | Core: warmup(10m) → micro_challenge(8m) → 任意槽(1): `[lie_detective\|personality_dice]`(12m) → Core: recap(5m) | 4 | 35 (+5min slack) |
| **均衡 × glow** (60min) | Core: warmup(10m) → micro_challenge(8m) → 任意槽(1): `[lie_detective\|personality_dice]`(12m) → 任意槽(2): `[quip_battle\|group_mirror]`(10m) → 任意槽(3): `[undercover_word\|personality_dice]`(10m) → Core: recap(5m) | 6 | 55 (+5min slack) |
| **均衡 × blaze** (90min) | Core: warmup(12m) → micro_challenge(8m) → 任意槽(1): `[lie_detective]`(12m) → 任意槽(2): `[personality_dice\|group_mirror]`(12m) → 任意槽(3): `[undercover_word\|quip_battle]`(12m) → 任意槽(4): `[auction\|quip_battle]`(14m) → 任意槽(5): `[speed_friending\|group_mirror]`(14m) → Core: recap(5m) | 8 | 77 (+13min slack) |

### Slot Notation

```
{slot_type}({count}): `[{eligible_phase_1}|{eligible_phase_2}|...]`({allocated_minutes}m)
```

Where:
- `slot_type`: `深聊槽` / `暢玩槽` / `任意槽`
- `count`: whether this is the nth occurrence of this slot type (affects "no consecutive same-phase/category" rule)
- `eligible_phases[]`: ordered by priority; compiler picks the first that passes `minPlayers` and category-spacing checks
- `allocated_minutes`: target duration; actual may be AI-tuned ±3min

---

## Per-Vibe Warmup Configuration

| Vibe | Duration | Topic Count | Depth Curve | Prompt Style | AI Group-Tailored |
|------|----------|------------|-------------|-------------|-------------------|
| **深聊** | 18-20min | 6-7 cards | L2-L3 dominant, 1×L1 opener | 3-tier: opener → follow-up → reflection | ✅ Always |
| **均衡** | 10-12min | 5 cards | L1-L2-L3 balanced, current default | Standard single prompt | ❌ Default only |
| **暢玩** | 6-8min | 4 cards | L1-L2, light & fast | Rapid-fire single prompt | ❌ Default only |

### Warmup Prompt Structure (深聊 only)

Each topic card under 深聊 has 3 tiers generated at session creation:

```json
{
  "id": "topic-1",
  "question": "如果你可以改变过去的一个决定，你会改变什么？",
  "mood": "生活",
  "emoji": "🌀",
  "depthLevel": 3,
  "promptTiers": {
    "opener": "分享一个你想改变的决定",           // 30s — warm entry
    "followUp": "这个改变会如何影响你现在的生活？", // 60s — deeper probe
    "reflection": "这个反思让你对自己有什么新的认识？" // 90s — meaningful closure
  }
}
```

Implementation: existing `SocialTopic` type already has `depthLevel`. Add optional `promptTiers` field. The `buildWarmupTopicsPrompt()` in `apps/server/src/ai/socialIcebreakerPrompts.ts` receives a `vibe` parameter and adjusts the depth curve + tier generation accordingly.

---

## Feature Flag

`RUN_PLAN_TEMPLATES_ENABLED` — default `false`.

| Flag State | Behavior |
|-----------|----------|
| `false` (default) | Existing `compileAgentRunPlan()` with hardcoded `TIER_NON_CORE_POOLS` + `VIBE_BIAS` runs unchanged |
| `true` | `compileForSession()` reads `run_plan_templates` table → if JSONB template found, use it; if not found, fall back to `compileAgentRunPlan()` |

**Kill switch:** Toggle flag to `false` → all new sessions revert to old compiler. Running sessions are unaffected (their `state.runPlan` was already compiled).

---

## Implementation Sprints

### Sprint 1: Template Storage + Compiler Engine (Backend Only)

**Goal:** Show any session that templates work. Phase selection + ordering driven by JSONB templates instead of hardcoded constants.

| Task | Agent | Files | Effort |
|------|-------|-------|--------|
| 1.1 Add `run_plan_templates` table (JSONB: `vibe`, `tier`, `playerCountMin`, `playerCountMax`, `slots`, `createdAt`, `updatedAt`) | Backend Engineer | `packages/shared/src/schema/_definitions.ts`, new barrel export in `schema/misc.ts` | 1h |
| 1.2 Write template compiler: `resolveTemplateSlots(vibe, tier, playerCount)` → resolved `PhaseSegment[]` with slot-to-phase resolution | Backend Engineer | `packages/shared/src/runPlanCompiler.ts` (new function) | 3h |
| 1.3 Wire `compileForSession()` to check `RUN_PLAN_TEMPLATES_ENABLED` → read DB template → use template or fallback | Backend Engineer | `apps/server/src/services/runPlanService.ts` | 2h |
| 1.4 Seed 9 default templates (code fallback) in `TEMPLATE_DEFAULTS` constant | Backend Engineer | `packages/shared/src/runPlanCompiler.ts` | 2h |
| 1.5 Tests: resolver produces valid plans for all 9 cells; category spacing enforced; phase count within budget | Backend Engineer | `apps/server/src/__tests__/runPlanCompiler.test.ts` (extend) | 3h |
| 1.6 Feature flag wiring + kill switch test | Backend Engineer | `apps/server/src/lib/featureFlags.ts` (add FLAG_ENV_MAP entry), `apps/server/src/socialIcebreakerPhaseConfig.ts` | 1h |

**Sprint 1 Deliverable:** Toggle `RUN_PLAN_TEMPLATES_ENABLED=true`, start a session, verify the session's `runPlan.segments` match the template.

### Sprint 2: Vibe-Controlled Durations + AI Pre-Compilation

**Goal:** Phase durations respect vibe. Warmup depth varies by vibe. AI generates group-tailored prompts at session creation.

| Task | Agent | Files | Effort |
|------|-------|-------|--------|
| 2.1 Add `allocatedMinutes` to `PhaseSegment` type; compiler uses template durations instead of `PhaseModule.durationMinutes` | Backend Engineer | `packages/shared/src/phaseModule.ts`, `packages/shared/src/runPlanCompiler.ts` | 2h |
| 2.2 Add `promptTiers` to `SocialTopic` type | Backend Engineer | `packages/shared/src/socialIcebreaker.ts` | 0.5h |
| 2.3 Update `buildWarmupTopicsPrompt()` to accept `vibe` + generate 3-tier prompts for 深聊 | AI Engineer | `apps/server/src/ai/socialIcebreakerPrompts.ts` | 3h |
| 2.4 Thread vibe through session creation → warmup prompt generation flow | AI Engineer | `apps/server/src/routes/socialIcebreaker.ts`, `apps/server/src/socialIcebreakerAIService.ts` | 2h |
| 2.5 Add `archetypeMix` context to warmup prompt builder; AI generates group-tailored follow-up questions | AI Engineer | `apps/server/src/ai/socialIcebreakerPrompts.ts` | 2h |
| 2.6 AI pre-compilation at session creation: warmup topics generated, cached on session state; fallback to curated defaults on AI failure | AI Engineer | `apps/server/src/routes/socialIcebreaker.ts` (start handler) | 3h |
| 2.7 Tests: 深聊 warmup returns 6-7 cards with L2-L3 dominant curve; 暢玩 warmup returns 4 cards with L1-L2; AI failure falls back to curated defaults | AI Engineer | `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` (extend) | 2h |

**Sprint 2 Deliverable:** Start a 深聊 session → warmup has 6 cards with 3-tier prompts. Start a 暢玩 session → warmup has 4 cards, fast prompts. Phase durations match template.

### Sprint 3: Mini-Program Vibe Selector + Extended Warmup UX

**Goal:** Users see the new vibe labels in the tier selector. Warmup renders depth badges + tiered prompts for 深聊. Push to developer QA.

| Task | Agent | Files | Effort |
|------|-------|-------|--------|
| 3.1 Update vibe selector UI: labels `深聊/均衡/暢玩`, descriptions, icons | Taro Engineer | `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` | 2h |
| 3.2 Update `VibeId` type + `VIBE_OPTIONS` array | Taro Engineer | `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` | 0.5h |
| 3.3 Pass vibe to warmup view; render `depthLevel` badge (深聊: golden "深度话题" chip; 暢玩: green "快速暖场" chip) | Taro Engineer | `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | 2h |
| 3.4 Render 3-tier prompt cycling for 深聊 warmup: card flips through opener → follow-up → reflection with progress indicator | Taro Engineer | `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | 3h |
| 3.5 **Wow element — warmup depth reveal (深聊 only):** Card flip animation transitions from surface copy to depth badge. Staggered fade-in for each prompt tier with punctuation-aware rhythm. Reduced-motion fallback: static tier list. | Taro Engineer | `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx`, `.scss` | 2h |
| 3.6 Update mock env to support new vibe values | Backend Engineer | `scripts/mock/mock-beta-env.mjs` | 1h |
| 3.7 Update docs: `docs/icebreaker/icebreaker-system.md`, `DEVELOPER_QUICK_REFERENCE.md`, `AGENTS.md` | Backend Engineer | Docs | 1h |
| 3.8 Developer QA: smoke test all 9 vibe-tier combos via mock env | QA Agent | Mock env | 2h |

**Sprint 3 Deliverable:** Mini-program tier selector shows `深聊/均衡/暢玩`. 深聊 warmup renders depth badges + tiered prompts. Pass smoke test.

---

## Deferred: Mid-Session Vibe Switching

Deferred per PM recommendation. When implemented (separate feature, separate flag `MID_SESSION_VIBE_SWITCH_ENABLED`):

1. Host taps vibe button in session header → selector overlay
2. New vibe selected → compiler replans remaining slots from the new vibe's template
3. Current phase finishes as-is (no mid-phase forced change)
4. Completed phases are immutable
5. Compiler re-resolves flexible slots (same eligible_phases, new vibe-tailored durations)
6. `state.runPlan` updated with new segment list

---

## UI Polish Requirements (Sprint 3)

### Tier+Vibe Selector Grid

| Requirement | Source |
|-------------|--------|
| 8rpx spacing rhythm throughout grid | `mini-program-frontend-excellence` |
| Each row (breeze/glow/blaze) has tier name + phase preview count | |
| Each column (深聊/均衡/暢玩) has vibe name + activity hint text | |
| Selected cell has JoyJoin primary accent border + subtle scale | |
| Pressed feedback: 96% scale + 200ms transition | `wow-elements` |
| Touch targets: ≥ 88rpx per cell per accessibility rules | `mini-program-frontend-excellence` |
| No emoji on primary copy (per brand guidelines) | `joyjoin-brand-guidelines` |

### Warmup Depth Badge (深聊 only)

| Requirement | Source |
|-------------|--------|
| Golden chip: "深度话题 · L3" at card top-right | `wow-elements` |
| Entrance: `cubic-bezier(0.22, 1, 0.36, 1)`, 300ms fade+slide-in | `wow-elements` |
| 3 prompt tiers: each fades in as previous tier completes | |
| Progress dots at card bottom: ∘∘● (current tier highlighted) | |
| Reduced motion: all tiers visible as static list, no animation | `mini-program-frontend-excellence` |
| `prefers-reduced-motion` respected via `useSystemInfo` or CSS media query | `wow-elements` |

---

## Model Recommendations

### Sprint 1 — Backend template compiler
**Model:** DeepSeek V4 Pro
**Why:** Deterministic logic, schema changes, feature flag wiring — bounded scope, no AI calls.

### Sprint 2 — AI warmup prompts
**Model:** Kimi K2.6
**Why:** Multi-file AI integration (prompt builder, service layer, session creation pipeline). Requires fallback chain design and structured JSON output validation. Medium complexity, 3+ files coordinated.

### Sprint 3 — Mini-program UI + polish
**Model:** DeepSeek V4 Pro
**Why:** UI component changes with Taro-specific constraints, wow elements, brand fidelity. Multi-file but bounded.

---

## Out of Scope (Explicit)

- Mid-session vibe switching (separate feature)
- Admin JSONB template editor (manual seed; admin UI follows if templates prove stable after 2 sprints)
- Web client parity (web client archived; mini-program is launch-primary)
- `mini_script` integration into templates (remains bonus-only, host+player vote gate)
- Archetype-specific phase recommendations (slots are archetype-agnostic; AI handles personalization via prompts)
- Post-session vibe quality scoring (separate analytics feature)

---

## Risk Register

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | Template JSONB corruption → session can't start | Code fallback (`compileAgentRunPlan()`) runs when no valid DB template |
| R2 | AI warmup generation timeout at session creation | 3s timeout per LLM safety; fallback to curated default prompts (unchanged from current behavior) |
| R3 | 深聊 warmup feels indistinguishable from 暢玩 warmup | Minimum perceptible difference: 深聊 warmup = 18-20min with 6-7 3-tier cards vs 暢玩 = 6-8min with 4 single-prompt cards |
| R4 | Template slot `eligible_phases[]` empty or all fail `minPlayers` check | Compiler falls back to next eligible phase from the vibe's full pool |
| R5 | Phase duration overrun → session exceeds tier budget | Templates include `slackMinutes` (5-13min per cell). Remaining budget displayed to host |
| R6 | `compileAgentRunPlan()` regression from shared code changes | Both code paths tested in Sprint 1; feature flag ensures old path runs unchanged |

---

## Acceptance Criteria

- [ ] `RUN_PLAN_TEMPLATES_ENABLED=false` — existing sessions compile identically to current production
- [ ] `RUN_PLAN_TEMPLATES_ENABLED=true` — all 9 vibe-tier combos produce valid run plans
- [ ] 深聊 warmup: 6-7 cards with L2-L3 depth curve + 3-tier prompts
- [ ] 暢玩 warmup: 4 cards with L1-L2 depth curve + single prompt
- [ ] Phase durations follow template allocations (±3min AI tuning)
- [ ] AI warmup failure → fallback to curated defaults (no session-start error)
- [ ] Mock env `--smoke --tier breeze --vibe 深聊` passes
- [ ] Mini-program vibe selector shows `深聊/均衡/暢玩` with correct descriptions
- [ ] 深聊 warmup renders depth badge + tiered prompt cycling
- [ ] Guardrails + test suite pass

---

## Summary

| Metric | Value |
|--------|-------|
| Sprints | 3 |
| New table | 1 (`run_plan_templates`, JSONB) |
| New feature flag | 1 (`RUN_PLAN_TEMPLATES_ENABLED`) |
| Files changed | ~15 (server + shared + mini-program) |
| New tests | ~30 |
| Deferred features | 1 (mid-session vibe switching) |
| AI touch points | 2 (warmup depth prompts, group-tailored prompts) |
| UI polish touch points | 2 (vibe selector grid, warmup depth badge + tiers) |
