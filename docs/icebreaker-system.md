# Icebreaker System — Complete Reference

> **Architecture principle:** The **Social Icebreaker** is the central, authoritative icebreaking flow. All other components (Toolkit, Card Game, Widget) are supporting layers that blend into this central flow.

---

## System Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    ICEBREAKER ECOSYSTEM                         │
│                                                                 │
│  [IcebreakerTool Widget]  ──────────────────────┐              │
│  Simple random question                         │ entry point  │
│  GET /api/icebreakers/random                    ▼              │
│                                                                 │
│  [IcebreakerToolkit]  ──────── host prep ──► [SOCIAL           │
│  Browse 13 games / topics                    ICEBREAKER        │
│  AI game recommendation                       SESSION]         │
│  shared/icebreakerGames.ts                    ◄────────────────┤
│                                                    ▲           │
│  [IcebreakerCardGame]  ─── deep warmup ────────────┘           │
│  AI-personalized cards (70/30)                                 │
│  5 rounds × 20 min                                             │
│  DB-persisted                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Social Icebreaker System (Central Flow)

### Overview
The Social Icebreaker is a **multi-phase, real-time group experience** that runs in-memory on the server (no DB required). It is session-keyed, host-driven, and supports 2–6 players.

### Shared Types
**File:** `shared/socialIcebreaker.ts` (also `packages/shared/src/socialIcebreaker.ts`)

```typescript
type SocialIcebreakerPhase =
  | 'warmup'           // 🌅 Hot Topics — mood-filtered conversation starters
  | 'micro_challenge'  // ⚡ Group Challenges — timed activities
  | 'lie_detective'    // 🕵️ Two Truths One Lie — AI-generated statements
  | 'auction'          // 🎪 [Future] Personality auction
  | 'personality_dice' // 🎲 [Future] Dice game
  | 'recap';           // ✨ Session summary

type AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional';

// MVP active phases (currently deployed):
const MVP_PHASES = ['warmup', 'micro_challenge', 'lie_detective'];
```

### Phase Configuration

| Phase | Emoji | CN Name | Timeout | Min Players | Key Mechanic |
|-------|-------|---------|---------|-------------|--------------|
| `warmup` | 🌅 | 热身 | 20 min | 2 | Mood-filtered topics, host navigates, all see same topic |
| `micro_challenge` | ⚡ | 挑战 | 15 min | 2 | Timed group task, each player taps "done" |
| `lie_detective` | 🕵️ | 侦探 | 25 min | 3 | Per-player AI statements, group votes on which is the lie |
| `auction` | 🎪 | 拍卖 | 30 min | 3 | Future phase |
| `personality_dice` | 🎲 | 骰子 | 15 min | 2 | Future phase |
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
        │
        ▼
[WARMUP PHASE]
  Host selects mood → POST .../topics
  Host navigates topics (index managed server-side)
  Any player → POST .../pulse-check { vibe: 1|2|3 }
        │
        ▼ Host calls POST .../advance
[MICRO_CHALLENGE PHASE]
  Server auto-generates challenge on advance
  Each player → POST .../micro-challenge/complete
        │
        ▼ Host calls POST .../advance (skipped if <3 players)
[LIE_DETECTIVE PHASE]
  Each player → POST .../lie-detective/generate (AI creates 3 statements)
  All other players → POST .../lie-detective/vote
  isLie revealed server-side when all votes received
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
  playerCount: number;             // auto-synced from sessionJoinedUsers
  phaseStartedAt: number;          // ms timestamp
  sessionStartedAt: number;
  completedPhases: SocialIcebreakerPhase[];

  // Warmup phase
  warmupTopics?: SocialTopic[];
  currentTopicIndex?: number;
  selectedMood?: AtmosphereMood;

  // Micro-challenge phase
  currentChallenge?: MicroChallenge;
  challengeCompletedBy?: string[]; // userIds who tapped done

  // Lie Detective phase
  lieDetectivePlayers?: LieDetectivePlayer[];
  currentLieDetectivePlayerIndex?: number;
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

### In-Memory Store (Server)

```typescript
// File: apps/server/src/routes/socialIcebreaker.ts
socialSessions: Map<string, SocialSessionState>
  // TTL: 6 hours, max 1000 sessions, 5-min sweep

sessionIndex: Map<icebreakerSessionId, socialSessionId>
  // deduplication: prevents multiple sessions for same icebreaker

lieStatements: Map<socialSessionId, Map<userId, LieDetectiveStatement[]>>
  // server-side truth: isLie never exposed to clients via poll

sessionJoinedUsers: Map<socialSessionId, Set<userId>>
  // presence tracking; drives playerCount
```

### Backend API Endpoints

**File:** `apps/server/src/routes/socialIcebreaker.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/social-icebreaker/start` | any | Join or create session; first caller = host |
| `GET` | `/api/social-icebreaker/:socialSessionId` | any | Poll state (every 3s); registers presence |
| `POST` | `/api/social-icebreaker/:socialSessionId/topics` | host | Generate mood-filtered warmup topics |
| `POST` | `/api/social-icebreaker/:socialSessionId/advance` | host | Advance to next phase; auto-skips `lie_detective` if <3 players |
| `POST` | `/api/social-icebreaker/:socialSessionId/pulse-check` | any | Submit vibe (1=cold, 2=warm, 3=fire) |
| `POST` | `/api/social-icebreaker/:socialSessionId/micro-challenge/complete` | any | Mark self as challenge done |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/generate` | any | AI generates 3 statements (2 true, 1 lie) per user |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/vote` | any | Vote on which statement is the lie; triggers reveal when all voted |
| `GET` | `/api/social-icebreaker/:socialSessionId/recap` | any | Generates AI recap summary |

### Frontend Hook

**File:** `apps/user-client/src/hooks/useSocialIcebreaker.ts`

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

---

## 2. IcebreakerToolkit (Pre-Event Browser — Supporting Layer)

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
The Toolkit is the **host preparation layer**. Game content from `icebreakerGames.ts` can feed `micro_challenge` phase content when a host selects a specific game before launching the session.

---

## 3. IcebreakerCardGame (In-Session AI Card System — Deep Integration Layer)

### Overview
An **AI-personalized card game** that runs within the Social Icebreaker warmup phase, or as a standalone deep-dive for matched groups. Cards are DB-persisted and personalized using 6-dimension personality scores.

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
The Card Game runs **within** the Social Icebreaker `warmup` phase OR as a standalone deep-dive. Question cards from this system can be surfaced during warmup topics if the host activates card mode.

---

## 4. IcebreakerTool Widget (Lightweight Entry Point)

### Overview
A **simple question widget** shown on the Discover/Home page. Surfaces a random warmup question and funnels users into a full Social Icebreaker session.

### Files
- `apps/user-client/src/components/IcebreakerTool.tsx`
- `apps/admin-client/src/components/IcebreakerTool.tsx`

### API
`GET /api/icebreakers/random` → `{ question, category, categoryColor }`

### Relationship to Social Icebreaker
This is the **lightweight entry point**. Clicking "join" from the widget should navigate users to the Social Icebreaker session for their current event or group.

---

## 5. AI Services Summary

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

## 6. Key Files Reference

| File | Purpose |
|------|---------|
| `shared/socialIcebreaker.ts` | Core types: phases, state, configs (`PHASE_CONFIG`, `PHASE_ORDER`, `MVP_PHASES`) |
| `packages/shared/src/socialIcebreaker.ts` | Package alias of above |
| `apps/server/src/routes/socialIcebreaker.ts` | All Social Icebreaker API routes + in-memory session store |
| `apps/server/src/socialIcebreakerAIService.ts` | AI generation functions (DeepSeek) with curated fallbacks |
| `apps/user-client/src/hooks/useSocialIcebreaker.ts` | React hook: session management, polling, all actions |
| `shared/icebreakerGames.ts` | 13 curated game definitions for IcebreakerToolkit |
| `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx` | Pre-event game browser (user-facing) |
| `apps/admin-client/src/components/icebreaker/IcebreakerToolkit.tsx` | Pre-event game browser (admin-facing) |
| `apps/user-client/src/components/icebreaker/IcebreakerCardGame.tsx` | In-session AI card game component |
| `apps/user-client/src/pages/IcebreakerGamePage.tsx` | Card game page (`/icebreaker-game`) |
| `apps/server/src/icebreakerCardGenerationService.ts` | Card generation service (DB-persisted) |
| `apps/user-client/src/components/IcebreakerTool.tsx` | Lightweight random question widget |
| `docs/icebreaker-ux-report.md` | UX analysis and design decisions |

---

## 7. Debugging Tips

**Session not found / duplicate sessions:**
- Check `sessionIndex` map — deduplication is based on `icebreakerSessionId`
- Sessions expire after 6h; max 1000 active sessions

**Lie Detective `isLie` leaking to client:**
- The `GET /state` endpoint strips `isLie` from `LieDetectivePlayer.statements`
- `lieStatements` map is server-only; never serialized into `SocialSessionState`

**Phase not advancing:**
- Verify caller is host (`hostUserId === userId`)
- Check `lie_detective` auto-skip: requires ≥3 players, otherwise skipped automatically

**AI content empty / fallback always triggered:**
- Verify `DEEPSEEK_API_KEY` environment variable is set
- Check server logs for `[SocialIcebreakerAI]` error prefixes
- All generators have curated fallbacks; the experience degrades gracefully

**playerCount wrong:**
- `sessionJoinedUsers` Set is updated on every `GET` poll
- Count reflects users who have polled within the session lifetime
