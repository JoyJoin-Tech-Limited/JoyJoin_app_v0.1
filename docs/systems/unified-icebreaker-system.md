# Unified Icebreaker System

> **Canonical specification for the JoyJoin Social Icebreaker.**
> Last updated: 2026-05-07
> Status: **Draft** — `compileAgentRunPlan()` not yet implemented
>
> This document replaces the scattered references in `icebreaker-execution-plan.md` and serves as the single source of truth for tier definitions, game pool, compilation rules, and backward compatibility.

---

## §1 — Executive Summary

The Social Icebreaker is a **host-driven, phase-ordered group activity session** with a 6-hour TTL. It is the **primary and default in-event experience** for JoyJoin matched groups.

**Key design principle:** The server owns phase eligibility, host authority, and AI generation gating; clients own rendering and self-state mutations. The mini-program is the launch-primary surface.

**Two compilation modes:**
1. **Hardcoded tier run plans** (`BREEZE_RUN_PLAN`, `GLOW_RUN_PLAN`, `BLAZE_RUN_PLAN`) — **current production fallback**
2. **Dynamic `compileAgentRunPlan()`** — **planned**. Replaces hardcoded plans with a deterministic rule engine + optional LLM enhancement layer.

---

## §2 — Tier Definitions

Machine IDs: `breeze` | `glow` | `blaze`
Display names: 破冰局 | 畅聊局 | 狂欢局

| Detail | Value |
|--------|-------|
| **Sprint Contract "80-min Standard"** | Median across all 3 tiers (40/60/90). Original 80-min requirement tied to `mini_script` (now blaze-only). Not a per-tier requirement. |
| **mini_script** | Optional bonus phase. Host can add to any tier as extended session. Inserted before recap. **Bonus gate:** when `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`, the server pauses at a group-vote gate before entering `mini_script`; host decides after seeing player sentiment tally. |
| **Lie Detective V2** | Host-choosable toggle within `lie_detective` phase slot. Available to all tiers. |

### Phase composition per tier

```
                    core (always)      tier-selected
                    ┌────────────┐     ┌──────────────────────────────┐
  breeze  40min     │ warmup →   │  →  │ lie_detective → recap        │
                    │ micro      │     │                              │
  glow    60min     │ challenge  │  →  │ lie_detective → personality  │
                    │            │     │  → group_mirror → recap      │
  blaze   90min     │            │  →  │ lie_detective → personality  │
                    └────────────┘     │  → undercover → auction →   │
                                       │  → quip_battle → group_mirror│
                                       │  → recap                     │
```

| Phase | breeze | glow | blaze | Tier coverage |
|-------|:------:|:----:|:-----:|:-------------:|
| warmup | ✅ | ✅ | ✅ | All tiers |
| micro_challenge | ✅ | ✅ | ✅ | All tiers |
| lie_detective | ✅ | ✅ | ✅ | All tiers |
| personality_dice | ❌ | ✅ | ✅ | glow + blaze |
| group_mirror | ❌ | ✅ | ✅ | glow + blaze |
| undercover_word | ❌ | ❌ | ✅ | Blaze only |
| auction | ❌ | ❌ | ✅ | Blaze only |
| quip_battle | ❌ | ❌ | ✅ | Blaze only |
| mini_script | 🎁 | 🎁 | 🎁 | All tiers (bonus, gated by host+player vote) |
| recap | ✅ | ✅ | ✅ | All tiers |

### Phase exposure by tier (detailed)

| Phase | breeze | glow | blaze | Boost priority |
|-------|:------:|:----:|:-----:|:--------------:|
| warmup | ✅ | ✅ | ✅ | Deferred (6.6) |
| micro_challenge | ✅ | ✅ | ✅ | **Medium** |
| lie_detective | ✅ | ✅ | ✅ | V2 → 8.5 |
| personality_dice | ❌ | ✅ | ✅ | **High** (Track A) |
| group_mirror | ❌ | ✅ | ✅ | **High** — now in default tier |
| undercover_word | ❌ | ❌ | ✅ | Medium |
| auction | ❌ | ❌ | ✅ | Medium |
| quip_battle | ❌ | ❌ | ✅ | Medium |
| mini_script | 🎁 | 🎁 | 🎁 | Low (bonus add-on, gated) |
| recap | ✅ | ✅ | ✅ | Deferred (6.9) |

---

## §3 — Session Lifecycle

```
POST /start     → create or rejoin (first caller becomes host)
GET /:id (poll) → 3s interval
POST /advance   → host-driven phase transition
GET /recap      → AI summary + medals
TTL sweep (5m)  → deletes expired sessions (6h lifetime)
```

**Key semantics:** `socialSessionId` = `social_${icebreakerSessionId}`; rejoin is an `upsertParticipant`; expiry returns **410 SESSION_EXPIRED**.

### Host vs Player Authority

| Action | Authority |
|--------|-----------|
| Start session | First caller (becomes host) |
| Advance phase / generate content | **Host only** |
| Ready / complete / vote / bid | **Any player** (self-state) |

---

## §4 — Game Pool

All phases are defined in `packages/shared/src/phaseRegistry.ts` as self-contained `PhaseModule` objects.

### Phase Registry

| Phase | Name | Emoji | Duration | Min | Max | Category | Energy Arc |
|-------|------|-------|----------|:---:|:---:|----------|------------|
| `warmup` | 话题卡 | 🌅 | 8 min | 2 | — | conversation | warmup |
| `micro_challenge` | 挑战 | ⚡ | 8 min | 2 | — | game | rising |
| `lie_detective` | 谎言侦探 | 🕵️ | 15 min | 3 | — | deduction | peak |
| `auction` | 拍卖 | 🎪 | 20 min | 3 | — | competition | peak |
| `personality_dice` | 人格骰子 | 🎲 | 12 min | 2 | — | creative | rising |
| `mini_script` | 迷你剧本杀 | 🎭 | 25 min | 4 | 6 | narrative | peak |
| `quip_battle` | 机智对决 | ⚔️ | 12 min | 2 | — | creative | rising |
| `undercover_word` | 谁是卧底 | 🕵️ | 12 min | 3 | — | deduction | peak |
| `group_mirror` | 群像镜像 | 🪞 | 10 min | 2 | — | creative | warmup |
| `recap` | 回顾 | ✨ | 5 min | 1 | — | conversation | falling |

### Phase module attributes (per `PhaseModule` interface)

- `id`, `name`, `nameEn`, `emoji`
- `durationMinutes`, `minPlayers`, `maxPlayers?`
- `category`: `conversation` | `game` | `creative` | `deduction` | `narrative` | `competition` | `voting`
- `energyArc`: `warmup` | `rising` | `peak` | `falling` | `variable`
- `requiresGeneration`, `generationLeadTimeMinutes`
- `canBeSkipped`, `participation`, `tone`
- UI tokens: `gradient`, `bgGradient`, `darkBgGradient`, `pillColor`

---

## §5 — Agent Compilation Rules (`compileAgentRunPlan()`)

> ⚠️ **Not yet implemented.** Current production uses hardcoded `BREEZE_RUN_PLAN`, `GLOW_RUN_PLAN`, `BLAZE_RUN_PLAN`.

### 5.1 — Function Signature

```ts
// packages/shared/src/runPlanCompiler.ts (planned)
export function compileAgentRunPlan(
  tier: TierMachineId,
  vibe: 'chat' | 'balanced' | 'game',
  context: CompilationContext,
  options?: { useLLM?: boolean }
): IcebreakerRunPlan;

interface CompilationContext {
  playerCount: number;
  archetypeMix: Record<string, number>; // e.g. { "开心柯基": 2, "布偶猫": 1 }
  enabledPhases: SocialIcebreakerPhase[]; // env-flag gated
  warmupMood?: string; // "energetic" | "chill" | "competitive"
  commonGround?: string[]; // shared interests from matching
  completionRate?: number; // 0.0–1.0 from prior sessions
}
```

### 5.2 — Rule Engine (Deterministic Baseline)

**Step 1: Core phases (always included)**
- `warmup` → `micro_challenge` (fixed order, fixed position)

**Step 2: Select non-core phases from enabled pool**

| Tier | Budget (min) | # non-core slots | Selection pool |
|------|:------------:|:----------------:|----------------|
| breeze | 40 | 1 | `lie_detective` only |
| glow | 60 | 3 | `lie_detective` + 2 from `{personality_dice, group_mirror}` |
| blaze | 90 | 5–6 | `lie_detective` + 4–5 from `{personality_dice, undercover_word, auction, quip_battle, group_mirror}` |

**Step 3: Prioritize by archetype mix**

| Archetype dominance | Preference weight |
|---------------------|-------------------|
| High-O (Openness) | Favor `creative` phases (personality_dice, quip_battle, group_mirror) |
| High-A (Agreeableness) | Favor `conversation` + `game` (warmup extended, micro_challenge) |
| High-X (Extraversion) | Favor `competition` + `peak` energy (auction, quip_battle) |
| High-C (Conscientiousness) | Favor `deduction` + structured (lie_detective, undercover_word) |
| Balanced mix | Default to `balanced` vibe weights |

**Step 4: Sort by energy arc**

```
warmup → rising → peak → falling
```

- No two consecutive phases may share the same `category`
- No `peak` phase may follow another `peak` phase without an intervening `rising` or `conversation`
- `recap` always closes

**Step 5: Time budget enforcement**

```ts
const BUDGETS = { breeze: 40, glow: 60, blaze: 90 };
const CORE_TIME = 16; // warmup (8) + micro_challenge (8)
const RECAP_TIME = 5;
const REMAINING = BUDGETS[tier] - CORE_TIME - RECAP_TIME;
```

Allocate `allocatedMinutes` per selected phase proportional to `durationMinutes`, scaled to fit `REMAINING`.

**Step 6: Validate output**

- Every segment references a known phase in `PHASE_REGISTRY`
- `totalMinutes` equals sum of `allocatedMinutes`
- No duplicate phases
- `recap` is always last
- All selected phases are in `enabledPhases`
- Player count ≥ `minPlayers` for every selected phase (auto-skip if not)

### 5.3 — LLM Enhancement Layer (Optional)

Triggered when `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION=true`.

**Input to LLM:**
- Tier, vibe, player count
- Archetype mix string (≤100 chars)
- Topic card mood, commonGround (≤300 chars)
- Enabled phase list

**LLM task:** Rank phase suitability 1–10 per phase. Return JSON.

**Timeout:** 3 seconds. On timeout or parse failure → fallback to rule engine baseline (§5.2).

**Prompt version:** `social-game-selection-v1`

**Observability:** `logAITrace` with `domain: 'social-icebreaker', promptVersion: 'social-game-selection-v1'`.

### 5.4 — Vibe Override

| Vibe | Effect on selection |
|------|---------------------|
| `chat` | Increase weight of `conversation` and `creative` categories; reduce `competition` and `deduction` by 20% |
| `balanced` | No override — use archetype-weighted baseline |
| `game` | Increase weight of `game`, `competition`, `deduction`; reduce `conversation` by 20% |

---

## §6 — REST Route Surface

Base: `/api/social-icebreaker`

| Method | Path | Purpose | Authority |
|--------|------|---------|-----------|
| `POST` | `/start` | Create or rejoin | Any |
| `GET` | `/:id` | Poll full state | Any participant |
| `POST` | `/:id/heartbeat` | Presence ping | Any participant |
| `POST` | `/:id/advance` | Next phase | Host |
| `POST` | `/:id/topics` | Generate warmup topics | Host |
| `POST` | `/:id/warmup/ready` | Toggle ready | Self |
| `POST` | `/:id/warmup/next-topic` | Advance topic | Host |
| `POST` | `/:id/micro-challenge/complete` | Mark done | Self |
| `POST` | `/:id/lie-detective/generate` | Generate statements | Self |
| `POST` | `/:id/lie-detective/vote` | Cast vote | Self |
| `POST` | `/:id/lie-detective/next-player` | Next reveal | Host |
| `POST` | `/:id/auction/generate-lots` | Generate lots | Host |
| `POST` | `/:id/auction/bid` | Place bid | Self |
| `POST` | `/:id/auction/close-lot` | Close lot | Host |
| `POST` | `/:id/personality-dice/generate` | Generate challenges | Host |
| `POST` | `/:id/personality-dice/complete` | Mark done | Self |
| `GET` | `/:id/recap` | AI recap + medals | Any |
| `POST` | `/:id/ai-feedback` | Rate AI content | Any |
| `POST` | `/:id/set-tier` | Change tier (warmup only) | Host |

Mini-script has its own top-level route: `POST /api/miniscript/generate`.

---

## §7 — State Store Schema

**`social_icebreaker_sessions`**
- `id` (PK): `social_${icebreakerSessionId}`
- `icebreaker_session_id` (unique): upstream session key
- `host_user_id`, `host_display_name`
- `current_phase` (default `warmup`)
- `phase_started_at`, `session_started_at`, `expires_at` (6h TTL)
- `state_json`: full `SocialSessionState` JSONB

**`social_icebreaker_participants`**
- `id` (uuid PK)
- `social_session_id` (FK, cascade)
- `user_id`, `display_name`
- `joined_at`, `last_seen_at`

Unique index on `(social_session_id, user_id)`.

**`social_icebreaker_lie_truths`**
- Server-only secrecy table for `lie_detective`
- `statements_json` includes `isLie` boolean
- **Never** leak `isLie` into `state_json` or client types

---

## §8 — Backward Compatibility

### Tier ID migration

| Legacy ID | New ID | Context |
|-----------|--------|---------|
| `standard` | `glow` | Old default tier |
| `premium` | `blaze` | Old extended tier |
| `bar` | `breeze` | Old compact tier |

**Rules:**
- **New sessions:** Server writes new IDs only (`breeze`/`glow`/`blaze`)
- **Old sessions:** `getRunPlanForTier()` dispatches via `LEGACY_TIER_MAP` at read time
- **Write path:** Legacy input (`standard`/`premium`/`bar`) is **rejected** with 400. Client must send new IDs.
- **Frozen JSONB:** Old `state_json` records with legacy tier values are never mutated in place

### Run plan constants

```ts
// packages/shared/src/socialIcebreakerRunPlans.ts
export const BREEZE_RUN_PLAN: IcebreakerRunPlan = { ... };
export const GLOW_RUN_PLAN: IcebreakerRunPlan = { ... };
export const BLAZE_RUN_PLAN: IcebreakerRunPlan = { ... };
```

These hardcoded plans remain as **frozen fallbacks** until `compileAgentRunPlan()` is fully validated.

---

## §9 — Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `SOCIAL_ICEBREAKER_ENABLE` | Master kill switch for social icebreaker | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Enable `auction` phase | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | Enable `mini_script` phase | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` | Legacy alias for above | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | Enable `personality_dice` | `true` |
| `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE` | Enable `quip_battle` phase | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD` | Enable `undercover_word` phase | `false` |
| `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` | Enable `group_mirror` phase | `false` |
| `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION` | Enable LLM enhancement in `compileAgentRunPlan()` | `false` |
| `LIE_DETECTIVE_MODE` | `v1` (AI-fabricated) or `v2` (user-tag + AI fake) | `v1` |

---

## §10 — Files to Touch

### Compilation (new)

| File | Purpose |
|------|---------|
| `packages/shared/src/runPlanCompiler.ts` | **NEW** — `compileAgentRunPlan()` rule engine + LLM layer |
| `packages/shared/src/runPlanCompiler.test.ts` | **NEW** — 100 permutation test matrix |
| `apps/server/src/services/runPlanService.ts` | **NEW** — Server-side wrapper: context assembly, caching, fallback |

### Existing files to modify

| File | Change |
|------|--------|
| `packages/shared/src/socialIcebreakerRunPlans.ts` | Add `compileAgentRunPlan()` import; mark hardcoded plans as `@deprecated` once compiler is validated |
| `apps/server/src/routes/socialIcebreaker.ts` | `/start` and `/set-tier` call `compileAgentRunPlan()` instead of hardcoded plans |
| `packages/shared/src/phaseRegistry.ts` | Add `getPhasesByCategory()`, `getPhasesByEnergyArc()` helpers if missing |
| `packages/shared/src/index.ts` | Export `compileAgentRunPlan` and related types |
| `.env.example` | Add `SOCIAL_ICEBREAKER_LLM_GAME_SELECTION=false` |

---

## §11 — Dependencies

| Dependency | Blocks | Resolution |
|------------|--------|------------|
| `getServerEnabledPhases()` must include all 8 non-core phases | `compileAgentRunPlan()` selection pool | Phase 0 field clearing (wire `quip_battle`, `undercover_word`, `group_mirror`) |
| `phaseRegistry.ts` must expose category + energyArc filters | Rule engine sorting | Already implemented |
| `packages/shared/src/schema.ts` split | Clean import paths | Partially done — `_definitions.ts` still monolithic |
| Archetype mix available at session start | Context injection | Already available via matched group data |

---

## §12 — Success Criteria for `compileAgentRunPlan()`

- [ ] Returns valid `IcebreakerRunPlan` for all 3 tiers × 3 vibes = 9 permutations
- [ ] 100 test permutations pass (random archetype mixes, edge player counts)
- [ ] No phase regresses below current score in any dimension
- [ ] LLM layer timeout (3s) + fallback to rule engine works
- [ ] `npm run guardrails` + `npm run test -w @joyjoin/server` pass
- [ ] Old sessions with hardcoded plans still load correctly
