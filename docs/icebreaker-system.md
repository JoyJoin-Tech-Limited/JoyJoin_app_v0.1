# Icebreaker System — Complete Reference

**Last Updated:** 2026-04-21

> ⭐ **CANONICAL FLOW:** The Social Icebreaker is the **primary and default in-event icebreaking experience** for JoyJoin matched groups. When building any feature that relates to icebreaking or in-event social facilitation, you MUST integrate with or extend the Social Icebreaker. Do NOT build new standalone icebreaking UIs.

---

## System Map

```
+─────────────────────────────────────────────────────────────────+
|           ⭐ PRIMARY FLOW — SOCIAL ICEBREAKER ⭐                  |
|                                                                 |
|  [IcebreakerTool Widget]  ──────────────────────┐              |
|  Entry-point teaser widget                      | entry point  |
|  GET /api/icebreakers/random                    ▼              |
|                                    +──────────────────────+    |
|                                    |  SOCIAL ICEBREAKER   |    |
|                                    |      SESSION         |    |
|                                    |  /icebreaker/:id     |    |
|                                    |  warmup → challenge  |    |
|                                    |  → detective → recap |    |
|                                    +──────────┬───────────+    |
|                                               |                |
|  [IcebreakerCardGame]  <── optional deep-dive─┘                |
|  AI-personalized cards (70/30)                                 |
|  5 rounds × 20 min, DB-persisted                               |
+─────────────────────────────────────────────────────────────────+

> ⚠️ **LEGACY PATH (do not use as primary CTA):**
> [IcebreakerToolkit] — pre-event game browser, 13 curated games
> (retained for backward compatibility only)

> ✅ **REMOVED — IcebreakerCardsSheet:**
> Pre-event topic preview sheet (GET /api/icebreakers/curated/:eventId) has been deleted.
> The pre-event 小悦 button in BlindBoxEventDetailPage now shows a static teaser card.
> The live WarmupPhase (Social Icebreaker) is the sole topic browsing experience.
```

---

## §0 — Architectural Decision Record

### ADR-001: IcebreakerCardsSheet Removed (2026-03-16)

**Decision:** `IcebreakerCardsSheet` and the `GET /api/icebreakers/curated/:eventId` endpoint have been deleted.

**Context:** Three separate icebreaker surfaces existed:
- **Surface A** (`IcebreakerCardsSheet`): Pre-event bottom sheet, passive carousel, `CuratedTopic[]` from `/api/icebreakers/curated/:eventId`, based on all `matchedAttendees`
- **Surface B** (`IcebreakerToolkit`): Full-screen session tool, `TopicCard[]` + games, legacy
- **Surface C** (`SocialIcebreakerOrchestrator` / `WarmupPhase`): Live session, mood-filtered `SocialTopic[]`, host-driven, checked-in users only — **the primary flow**

**Problem:** Surface A duplicated Surface C's purpose (show 小悦-curated topics to the group) but was worse in every dimension: static, single-player, disconnected from the live session, based on pre-checkin attendee list, and using a different data model (`CuratedTopic` vs `SocialTopic`).

**Resolution:** Surface A deleted. The pre-event 小悦 button in `BlindBoxEventDetailPage` (both user and admin clients) now renders a non-interactive static teaser card ("AI破冰环节已就绪 / 到场签到后，小悦将为你们定制专属破冰体验") when the event has not yet started. When the event starts, the button navigates directly to `IcebreakerSessionPage` as before — in both the user client and the admin client.

**Files deleted:**
- `apps/user-client/src/components/IcebreakerCardsSheet.tsx`
- `apps/admin-client/src/components/IcebreakerCardsSheet.tsx`

**Endpoint removed:**
- `GET /api/icebreakers/curated/:eventId`

---

## §1 — Social Icebreaker System (Primary In-Event Flow — Required Reading)

### Overview
The Social Icebreaker is a **multi-phase, real-time group experience** backed by a PostgreSQL session store. It is the **primary and default in-event icebreaking experience** for all JoyJoin matched groups. It is session-keyed, host-driven, and designed for small groups. Each phase enforces its own minimum: most phases require ≥2 players; `lie_detective` requires ≥3 (auto-skipped otherwise). There is no enforced upper cap on player count.

### Client implementation priority (mini-program first)

**WeChat mini-program (Taro) is the core ship target** for in-event Social Icebreaker UX: implement phase behaviour, polish, and regressions in **`apps/mini-program/src/pages/icebreaker-session/`** (including `phaseViews`) first, then align **`apps/user-client`** for web parity. Server contracts (`/api/social-icebreaker`, `SocialSessionState`) are shared; both clients must stay consistent, but **mini-program smoothness takes precedence** when scheduling or scoping work.

### Shared Types
**File:** `shared/socialIcebreaker.ts` (also `packages/shared/src/socialIcebreaker.ts`)

```typescript
type SocialIcebreakerPhase =
  | 'warmup'           // 🌅 Hot Topics — mood-filtered conversation starters
  | 'micro_challenge'  // ⚡ Group Challenges — timed activities
  | 'lie_detective'    // 🕵️ Two Truths One Lie — AI-generated statements
  | 'auction'          // 🎪 Auction (feature-flagged)
  | 'personality_dice' // 🎲 Personality Dice
  | 'mini_script_beta' // 🧪 Mini Script Mystery beta (feature-flagged)
  | 'recap';           // ✨ Session summary

type AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional';

// MVP active phases (currently deployed):
const MVP_PHASES = ['warmup', 'micro_challenge', 'lie_detective'];
const DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES = [...MVP_PHASES, 'personality_dice'];
```

### Phase Configuration

| Phase | Emoji | CN Name | Timeout | Min Players | Key Mechanic |
|-------|-------|---------|---------|-------------|--------------|
| `warmup` | 🌅 | 热身 | 20 min | 2 | Mood-filtered topics, host navigates, all see same topic |
| `micro_challenge` | ⚡ | 挑战 | 15 min | 2 | Timed group task, each player taps "done" |
| `lie_detective` | 🕵️ | 侦探 | 25 min | 3 | Per-player AI statements, group votes on which is the lie |
| `auction` | 🎪 | 拍卖 | 30 min | 3 | Feature-flagged phase stub |
| `personality_dice` | 🎲 | 骰子 | 15 min | 2 | AI-generated archetype dares |
| `mini_script_beta` | 🧪 | 剧本杀β | 20 min | 4 | Feature-flagged beta stub |
| `recap` | ✨ | 回顾 | 5 min | 1 | AI-generated session summary |

### Session Lifecycle

```
User opens event/group page
        │
        ▼
POST /api/social-icebreaker/start
  { sessionId, displayName }
        │
        ├── First caller → becomes HOST
        └── Subsequent callers → join existing session
        │
        ▼
GET /api/social-icebreaker/:socialSessionId  (poll every 3s)
  returns SocialSessionState + joinedParticipants roster summary
        │
        ▼
[WARMUP PHASE]
  Host selects mood → POST .../topics (server generates shared warmupTopics list)
  Any player → POST .../warmup/ready once they are comfortable moving on
  Host → POST .../warmup/next-topic once everyone is ready
  Any player → POST .../pulse-check { vibe: 1|2|3 }
        │
  ▼ Host calls POST .../advance (phase advance, not per-topic navigation)
[MICRO_CHALLENGE PHASE]
  Server auto-generates challenge on advance
  Each player → POST .../micro-challenge/complete
        │
        ▼ Host calls POST .../advance after everyone finishes or the timer expires (skipped if <3 players)
[LIE_DETECTIVE PHASE]
  Each player → POST .../lie-detective/generate (AI creates 3 statements)
  All other players → POST .../lie-detective/vote
  isLie revealed server-side when all votes received
  Host → POST .../lie-detective/next-player to move to the next player after reveal
        │
        ▼ Host calls POST .../advance
[RECAP]
  GET .../recap → AI-generated { headline, moments[], closingLine }
```

### Session State (`SocialSessionState`)

```typescript
interface SocialSessionState {
  socialSessionId: string;         // "social_${icebreakerSessionId}"
  icebreakerSessionId: string;
  currentPhase: SocialIcebreakerPhase;
  hostUserId: string;
  hostDisplayName: string;
  playerCount: number;             // joined roster count
  activePlayerCount?: number;      // heartbeats seen within the active presence window
  joinedParticipants?: SocialSessionParticipantSummary[]; // roster + presence summary for clients
  phaseStartedAt: number;          // ms timestamp
  sessionStartedAt: number;
  expiresAt?: string;              // ISO timestamp for TTL-backed expiry
  completedPhases: SocialIcebreakerPhase[];
  eventType?: string;
  enabledPhases?: SocialIcebreakerPhase[];

  // Warmup phase
  warmupTopics?: SocialTopic[];
  currentTopicIndex?: number;
  warmupReadyUserIds?: string[];
  selectedMood?: AtmosphereMood;
  commonGroundCount?: number;

  // Micro-challenge phase
  currentChallenge?: MicroChallenge;
  challengeCompletedBy?: string[]; // userIds who tapped done

  // Lie Detective phase
  lieDetectivePlayers?: LieDetectivePlayer[];
  currentLieDetectivePlayerIndex?: number;
  lieDetectiveCompletedUserIds?: string[];
  currentLieDetectiveReveal?: LieDetectiveReveal;
  votes?: LieDetectiveVote[];

  // Cross-phase
  pulseChecks?: PulseCheckResult[]; // reset on each phase advance

  // Recap
  recapData?: {
    topicsDiscussed: string[];
    challengesCompleted: number;
    lieDetectiveWinner?: string;
    funMoments: string[];
  };
}
```

### Persistent Session Store (Server)

```typescript
// File: apps/server/src/lib/socialIcebreakerStore.ts
SESSION_TTL_MS = 6 * 60 * 60 * 1000;     // 6 hours
PRESENCE_THRESHOLD_MS = 30_000;          // 30 seconds

socialIcebreakerSessions
  // persisted session state + expiresAt

socialIcebreakerParticipants
  // joined roster with joinedAt / lastSeenAt heartbeats

socialIcebreakerLieTruths
  // server-only truth data; never returned to clients
```

Sessions expire after 6 hours and expired rows are swept periodically. Missing vs expired sessions are differentiated in the API so clients can handle `410 SESSION_EXPIRED` separately from a true `404`.

### Backend API Endpoints

**File:** `apps/server/src/routes/socialIcebreaker.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/social-icebreaker/start` | any | Join or create session; first caller = host; participant roster is persisted |
| `GET` | `/api/social-icebreaker/:socialSessionId` | any | Poll state (every 3s); registers presence and returns `joinedParticipants` roster summary |
| `POST` | `/api/social-icebreaker/:socialSessionId/topics` | host | Generate mood-filtered warmup topics |
| `POST` | `/api/social-icebreaker/:socialSessionId/warmup/ready` | any | Mark whether the current player is ready to move on |
| `POST` | `/api/social-icebreaker/:socialSessionId/warmup/next-topic` | host | Advance to the next shared warmup topic after mutual readiness |
| `POST` | `/api/social-icebreaker/:socialSessionId/advance` | host | Advance to next phase; auto-skips `lie_detective` if <3 players |
| `POST` | `/api/social-icebreaker/:socialSessionId/pulse-check` | any | Submit vibe (1=cold, 2=warm, 3=fire) |
| `POST` | `/api/social-icebreaker/:socialSessionId/micro-challenge/complete` | any | Mark self as challenge done |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/generate` | any | AI generates 3 statements (2 true, 1 lie) per user |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/vote` | any | Vote on which statement is the lie; triggers reveal when all voted |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/next-player` | host | Advance to the next player after the current reveal resolves |
| `GET` | `/api/social-icebreaker/:socialSessionId/recap` | any | Generates AI recap summary |

### Frontend Surfaces

**Files (mini-program first):**
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` — Taro session page (primary in-field client)
- `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx` — phase UI modules for mini-program
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx` — web session page (parity)
- `apps/user-client/src/hooks/useSocialIcebreaker.ts` — web hook (parity)

The mini-program surface consumes the same `SocialSessionState` contract and prefers `joinedParticipants` when the server provides it.

**Hook:** `apps/user-client/src/hooks/useSocialIcebreaker.ts`

```typescript
const {
  state,             // SocialSessionState | null
  isLoading,
  isHost,            // true if userId === state.hostUserId
  socialSessionId,
  startSession,      // POST /start
  fetchTopics,       // (mood) → SocialTopic[]
  advancePhase,      // POST /advance
  submitPulseCheck,  // (vibe: 1|2|3) → { averageVibe, voteCount, allVoted }
  generateMyStatements, // POST /lie-detective/generate → statements[]
  castVote,          // (targetUserId, statementIndex) → void
  completeChallenge, // POST /micro-challenge/complete
  isStarting,
  isAdvancing,
} = useSocialIcebreaker({ sessionId, userId, displayName });
```

Polls via `useQuery` with `refetchInterval: 3000`.

### Pre-event run plan lifecycle (post-match → start time → in-event execution)

This subsection describes **production** behaviour: after a match is known (typical groups of about **4–6** people), JoyJoin uses the **interval before event start** to prepare a **compiled icebreaker run plan** stored **on disk** (PostgreSQL). The live Social Icebreaker session then **executes** that plan instead of improvising structure at the table.

#### When it runs

| Window | What happens |
|--------|----------------|
| **Post-match** | Pool matching persists `event_pool_groups` (and related rows). Roster size and match metadata are known. |
| **Pre-event (minutes to days)** | Automated jobs may **compile**, **validate**, and **upsert** a per-scope run plan. Work is **async** and must **not** block matching or the user’s first open of the icebreaker page. |
| **In-event** | `POST /api/social-icebreaker/start` and polling read server state; phase advances remain **host-driven** and **server-authoritative**. Existing rules (`getNextEligiblePhase`, min players per phase, lie-detective secrecy) stay in force. |

#### Inputs available for compilation (reuse + “fascinating”)

Use only **bounded, non-secret** fields suitable for JSON plans and prompts, for example:

- From **`event_pool_groups`**: `memberCount`, `temperatureLevel`, `overallScore`, `matchExplanation`, `theme`, `subtitle`, `themeEmoji`, `themeHighlights` (when populated), pool-linked context.
- From **`event_pools`**: `eventType`, city/district, title, scheduled `dateTime`.
- **Routine segments** to reuse: Social Icebreaker phases (warmup / micro-challenge / lie detective / personality dice / recap), curated **话题** patterns (warmup `SocialTopic` flow), and over time **catalog segment IDs** that map to the same HTTP + UI templates (not one-off pages).

Later async updates (venue assignment, refreshed theme highlights, cached pair explanations) may arrive **after** the first compile tick. Production pipelines should either **re-run compile** when critical fields change, **merge** into a new plan version, or ship **v1** with “best effort at match time” and document the limitation.

#### On-disk artifact: `IcebreakerRunPlan`

- **Shared contract (types + validation):** `packages/shared/src/icebreakerRunPlan.ts` — Zod schema, `parseIcebreakerRunPlan`, version literal.
- **Persistence (implementation):** a dedicated table (for example `icebreaker_run_plans`) keyed by match scope such as **`pool_group` + `event_pool_groups.id`**, storing `plan_json`, `plan_hash`, `compiler_id`, timestamps. See `docs/superpowers/plans/2026-04-21-icebreaker-compilation-implementation-plan.md` for the engineering task breakdown.

#### Shipped phase templates (web registry + mini-program phase views)

**Web:** phase UI is registered in **`apps/user-client/src/components/social-icebreaker/socialIcebreakerPhaseRegistry.tsx`** (`SOCIAL_ICEBREAKER_PHASE_REGISTRY`); the orchestrator uses **`renderSocialIcebreakerPhasePanel`**.

**Mini-program (primary):** the same phase set is implemented in **`apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx`** (and composed from `index.tsx`). New or changed phases must land **here first**, then the web registry is updated for parity.

Any compiled plan must only reference phases that exist in **both** surfaces **unless** a release-track **Game Development Agent** change explicitly adds a phase (with mini-program delivered first).

#### Production automation: Game Design Agent and Game Dev Agent

In production, “agents” are **deployed workers** (queue consumers or scheduled jobs), not interactive Cursor sessions. Recommended split:

Repo agent specs for human/IDE orchestration of the same responsibilities: [`.github/agents/game-design-agent.agent.md`](../.github/agents/game-design-agent.agent.md) and [`.github/agents/game-development-agent.agent.md`](../.github/agents/game-development-agent.agent.md). Modular compile checklists: [`.github/skills/game-design-icebreaker-compilation/SKILL.md`](../.github/skills/game-design-icebreaker-compilation/SKILL.md).

**Game Design Agent (production)** — *compile*

- **Input:** frozen snapshot of group + pool (+ optional safe profile summaries).
- **Output:** a single **`IcebreakerRunPlan`** JSON that passes **`parseIcebreakerRunPlan`** (and any future stricter policy checks).
- **May use an LLM** only inside **fixed slots** (copy tone, short rationale, ordering hints among **allowed** catalog segments). It must **not** invent new phase types, store `isLie`, or embed PII.
- **Objective:** bonding with **low peer pressure**; prefer reusing proven routines (话题卡-style warmup, standard phases) and vary **presentation** and **ordering** rather than unsafe novel mechanics.

**Game Dev Agent (production)** — *bind templates, not arbitrary codegen*

- **Does not** generate and execute arbitrary TypeScript on the live request path (unsafe for security, review, and rollback).
- **Does** one or both of:
  1. **Template registry selection:** choose `templatePackId` / `segmentBindings` that map to **already-shipped** server routes and UI shells (`SocialIcebreakerOrchestrator`, existing phase components). The running binary is the source of truth for what can execute.
  2. **Offline / CI worker (optional):** produces **reviewed** template or prompt updates that ship in a **normal release** (PR + tests). Production only **selects versions** baked into that release.

Together, Design writes **data**; Dev ensures **code paths exist** for every referenced template. Novel mechanics ship through **releases**, not ad-hoc generation during a user’s event.

#### Failure behaviour

If no valid plan exists at session start, the server falls back to **today’s defaults** (`enabledPhases` / `PHASE_ORDER` from `packages/shared/src/socialIcebreaker.ts` and `apps/server/src/socialIcebreakerPhaseConfig.ts`). Missing plans should log a structured warning for operations.

---

## §2 — IcebreakerToolkit (Legacy Host-Prep Tool — NOT the Primary Flow)

> **Note:** This section was previously titled "IcebreakerToolkit (Pre-Event Browser — Supporting Layer)". It has been renamed to make clear that the Toolkit is a **legacy** component and must not be treated as the recommended icebreaking path.

> ⚠️ **LEGACY:** The IcebreakerToolkit is a legacy pre-event game browser. It is no longer the recommended icebreaking path. New development should NOT use or extend this toolkit as the primary icebreaking experience. It is retained for backward compatibility.

### Overview
The Toolkit is a **pre-session browsing and host preparation tool**. A host explores curated games, gets AI recommendations, then launches a Social Icebreaker session.

### Files
- `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx`
- `apps/admin-client/src/components/icebreaker/IcebreakerToolkit.tsx`
- Sub-components: `ActivitySpotlight`, `GameDetailView`, `KingGameController`

### Data Source
**File:** `shared/icebreakerGames.ts` (also `packages/shared/src/icebreakerGames.ts`)

**13 curated games** across categories:

| Category | Games |
|----------|-------|
| `quick` | 两真一假, 你会选择, 谐音梗接龙, 最xxx的人, 数字炸弹, 心有灵犀 |
| `creative` | 故事接龙, 如果我是 |
| `deep` | 小众观点, 高光与低谷 |
| `active` | 我说你猜, 谁是卧底, 国王游戏 |

**Scene filter:** `dinner` | `bar` | `both`

### AI Game Recommendation (Admin)
**File:** `apps/admin-client/src/icebreakerAIService.ts`
Function: `generateGameRecommendation()` using `GAME_RECOMMENDATION_PROMPT`

### Relationship to Social Icebreaker
The Toolkit is the **host preparation layer**, helping hosts browse and choose suitable games/topics before running an event.
At present, the Social Icebreaker `micro_challenge` phase is always populated server-side via `generateMicroChallenges(...)` and does **not** consume Toolkit game selections directly; wiring Toolkit selection into `micro_challenge` is an aspirational/future integration, not yet implemented.

### Server-Driven Phase Flags
Social Icebreaker v2 phase availability is now owned by the server. Each `SocialSessionState` carries an `enabledPhases` array, and `/api/social-icebreaker/:socialSessionId/advance` advances using that server-owned list rather than any client-provided phase order.

Current server flags:
- `SOCIAL_ICEBREAKER_ENABLE_AUCTION=true` → inserts `auction` before `personality_dice`
- `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE=false` → removes `personality_dice`
- `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA=true` → appends `mini_script_beta` before recap

If a configured phase does not meet `PHASE_CONFIG[phase].minPlayersRequired`, the server skips only that phase and advances to the next enabled phase instead of jumping straight to recap.

---

## §3 — IcebreakerCardGame (Supporting Deep-Dive Layer)

### Overview
An **AI-personalized card game** that serves as an **optional deep-dive supporting layer** accessible from within or after the Social Icebreaker warmup phase. It is **not** a standalone primary in-event experience — the primary flow is always the Social Icebreaker (`/icebreaker/:sessionId`). Cards are DB-persisted and personalized using 6-dimension personality scores.

### Files
- `apps/user-client/src/components/icebreaker/IcebreakerCardGame.tsx`
- `apps/user-client/src/pages/IcebreakerGamePage.tsx`
- `apps/user-client/src/hooks/useIcebreakerGame.ts`
- `apps/server/src/icebreakerCardGenerationService.ts`

### Database Tables
- `icebreaker_game_cards`
- `icebreaker_game_progress`
- `icebreaker_card_interactions`

### Card Structure

| Field | Values |
|-------|--------|
| Card types | `question` \| `vote` \| `mission` |
| Rounds | 5 rounds × 20 min |
| Cards per round | 3 |
| AI ratio | 70% DeepSeek / 30% curated fallback |

### Personalization Inputs
6-dimension personality scores (A, C, E, O, X, P), archetypes, interests, demographics.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/icebreaker/game/generate-cards` | Generate personalized cards |
| `GET` | `/api/icebreaker/game/cards/:sessionId?roundNumber=N` | Get cards for round |
| `POST` | `/api/icebreaker/game/interact` | Record card interaction |
| `GET` | `/api/icebreaker/game/progress/:sessionId` | Get game progress |

### Routes
`/icebreaker-game?eventId=X` or `?groupId=X` or `?sessionId=X`

### Relationship to Social Icebreaker
The Card Game is an **optional deep-dive** that complements the Social Icebreaker. It is accessible at `/icebreaker-game` as a supporting layer that hosts can link to from within or after the Social Icebreaker warmup phase. The warmup UI does not yet embed or directly surface this game in-session, but the Card Game is architecturally subordinate to the Social Icebreaker and should not be presented to users as the default or first icebreaking experience.

---

## §4 — IcebreakerTool Widget (Entry-Point Teaser — Not a Flow)

### Overview
A **simple question widget** shown on the Discover/Home page. Surfaces a random warmup question as a teaser, then funnels users into a full Social Icebreaker session. This component is an **entry-point only** — it is not a complete icebreaking flow.

### Files
- `apps/user-client/src/components/IcebreakerTool.tsx`
- `apps/admin-client/src/components/IcebreakerTool.tsx`

### API
`GET /api/icebreakers/random` → `{ question, category, categoryColor }`

### Relationship to Social Icebreaker
This widget **fetches and displays a random question** (`GET /api/icebreakers/random`). It serves as a lightweight teaser for the icebreaker experience. There is currently no in-widget "join" CTA or direct navigation into a Social Icebreaker session; that funnel must be implemented by the page embedding this component.

---

## §5 — AI Services Summary

### `socialIcebreakerAIService.ts`
**File:** `apps/server/src/socialIcebreakerAIService.ts`
**Provider:** DeepSeek (`deepseek-chat` model)

| Function | Input | Output | Fallback |
|----------|-------|--------|---------|
| `generateWarmupTopics` | `{ mood, eventType, participantCount, avoidTopics? }` | 5 `SocialTopic[]` | 25 curated topics (mood-filtered) |
| `generateMicroChallenges` | `{ eventType, participantCount, completedChallengeIds? }` | 3 `MicroChallenge[]` | 8 curated challenges |
| `generateLieDetectiveStatements` | `{ userId, displayName, archetype?, interests? }` | 3 statements (2T+1F) | 3 curated fallback sets |
| `generateXiaoYueComment` | `{ phase, event, context? }` | commentary string | hardcoded phase/event map |
| `generateRecapSummary` | `{ participants, topicsDiscussed, challengesCompleted, durationMinutes }` | `{ headline, moments[], closingLine }` | template-based default |

**Fallback strategy:** All functions gracefully fall back to curated content on AI error or empty response. `isLie` is only stored server-side and never exposed via the polling endpoint.

---

## §6 — Key Files Reference

> **Note:** `IcebreakerCardsSheet` (both user and admin copies) has been deleted. See §0 ADR-001.

| File | Purpose |
|------|---------|
| `shared/socialIcebreaker.ts` | Core types: phases, state, configs (`PHASE_CONFIG`, `PHASE_ORDER`, `MVP_PHASES`) |
| `packages/shared/src/socialIcebreaker.ts` | Package alias of above |
| `apps/server/src/routes/socialIcebreaker.ts` | All Social Icebreaker API routes + client-state assembly over the PostgreSQL-backed session store |
| `apps/server/src/socialIcebreakerAIService.ts` | AI generation functions (DeepSeek) with curated fallbacks |
| `apps/user-client/src/components/social-icebreaker/socialIcebreakerPhaseRegistry.tsx` | Phase id → shipped UI template registry (`renderSocialIcebreakerPhasePanel`) |
| `apps/user-client/src/hooks/useSocialIcebreaker.ts` | React hook: session management, polling, all actions |
| `.github/skills/game-design-icebreaker-compilation/SKILL.md` | Game Design compile skill + modular safety/mechanics/handoff references |
| `.github/agents/game-design-agent.agent.md` | Game Design Agent (plan compilation handoff) |
| `.github/agents/game-development-agent.agent.md` | Game Development Agent (registry + server implementation) |
| `shared/icebreakerGames.ts` | 13 curated game definitions for IcebreakerToolkit |
| `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx` | Pre-event game browser (user-facing) |
| `apps/admin-client/src/components/icebreaker/IcebreakerToolkit.tsx` | Pre-event game browser (admin-facing) |
| `apps/user-client/src/components/icebreaker/IcebreakerCardGame.tsx` | In-session AI card game component |
| `apps/user-client/src/pages/IcebreakerGamePage.tsx` | Card game page (`/icebreaker-game`) |
| `apps/server/src/icebreakerCardGenerationService.ts` | Card generation service (DB-persisted) |
| `apps/user-client/src/components/IcebreakerTool.tsx` | Lightweight random question widget |
| `packages/shared/src/icebreakerRunPlan.ts` | Zod contract for pre-compiled per-match `IcebreakerRunPlan` (post-match automation) |
| `docs/superpowers/plans/2026-04-21-icebreaker-compilation-implementation-plan.md` | Implementation plan: persist plan on disk, hook match, wire Social Icebreaker |
| `docs/icebreaker-ux-report.md` | UX analysis and design decisions |

---

## §7 — Debugging Tips

**Session not found / duplicate sessions:**
- Session IDs are deterministic: `socialSessionId = social_${icebreakerSessionId}`, so the same icebreaker always maps to the same session key
- Session persistence lives in `socialIcebreakerSessions`, keyed by `socialSessionId`; expired rows are swept by TTL, not by route-local maps
- Sessions expire after 6h and return structured expiry state instead of a generic missing-session response

**Lie Detective `isLie` leaking to client:**
- The poll endpoint `GET /api/social-icebreaker/:socialSessionId` builds client state through `buildClientState()` and then returns `SocialSessionState` via `sanitizeStateForClient`
- `isLie` is never stored on `SocialSessionState` (statements are sanitized on insert into `lieDetectivePlayers`), so it cannot be serialized to the client

**Phase not advancing:**
- Verify caller is host (`hostUserId === userId`)
- Check `lie_detective` auto-skip: requires ≥3 players, otherwise skipped automatically

**AI content empty / fallback always triggered:**
- Verify `DEEPSEEK_API_KEY` environment variable is set
- Check server logs for `[SocialIcebreakerAI]` error prefixes
- All generators have curated fallbacks; the experience degrades gracefully

**playerCount wrong:**
- `playerCount` reflects the persisted joined roster in `socialIcebreakerParticipants`
- `activePlayerCount` and `joinedParticipants[*].isActive` are derived from `lastSeenAt` heartbeats within the active presence window
