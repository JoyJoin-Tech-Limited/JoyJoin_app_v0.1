# Icebreaker System — Complete Reference

**Last Updated:** 2026-08-03

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
> [IcebreakerToolkit] — pre-event game browser, 13 curated games from `packages/shared/src/icebreakerGames.ts`
> (retained for backward compatibility only; **deprecated 2026-04-27**)
>
> ⚠️ **DEPRECATED — `icebreakerGames.ts`:**
> The 13 static party games in `packages/shared/src/icebreakerGames.ts` are **not** connected to the
> Social Icebreaker phase system. They power the legacy `IcebreakerToolkit` UI only.
> New mechanics must ship as `SocialIcebreakerPhase` values, not as entries in this catalog.

> ✅ **REMOVED — IcebreakerCardsSheet:**
> Pre-event topic preview sheet (GET /api/icebreakers/curated/:eventId) has been deleted.
> The pre-event 小悦 button in BlindBoxEventDetailPage now shows a static teaser card.
> The live Topic Card phase (Social Icebreaker) is the sole topic browsing experience.
```

---

## §0 — Architectural Decision Record

### ADR-001: IcebreakerCardsSheet Removed (2026-03-16)

**Decision:** `IcebreakerCardsSheet` and the `GET /api/icebreakers/curated/:eventId` endpoint have been deleted.

**Context:** Three separate icebreaker surfaces existed:
- **Surface A** (`IcebreakerCardsSheet`): Pre-event bottom sheet, passive carousel, `CuratedTopic[]` from `/api/icebreakers/curated/:eventId`, based on all `matchedAttendees`
- **Surface B** (`IcebreakerToolkit`): Full-screen session tool, `TopicCard[]` + games, legacy
- **Surface C** (`SocialIcebreakerOrchestrator` / `WarmupPhase`): Live session, mood-filtered topic cards (`SocialTopic[]`), host-driven, checked-in users only — **the primary flow**

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

### Client implementation priority (mini-program only)

**WeChat mini-program (Taro) is the only shipping user-facing client** for in-event Social Icebreaker UX. Implement phase behaviour, polish, and regressions in **`apps/mini-program/src/pages/icebreaker-session/`** (including `phaseViews`). Server contracts (`/api/social-icebreaker`, `SocialSessionState`) are shared with the admin portal and any future surfaces, but **mini-program smoothness is the authoritative target**. (The legacy `apps/user-client` web sandbox was archived to `archived/workspaces/user-client/` in 2026-05 and must not be treated as an active parity surface.)

### Shared Types
**File:** `shared/socialIcebreaker.ts` (also `packages/shared/src/socialIcebreaker.ts`)

```typescript
type SocialIcebreakerPhase =
  | 'warmup'           // 🌅 Hot Topics — mood-filtered conversation starters
  | 'micro_challenge'  // ⚡ Group Challenges — timed activities
  | 'lie_detective'    // 🕵️ Two Truths One Lie — AI-generated statements
  | 'undercover_word'  // 🕵️‍♂️ Undercover Word — hidden-role word deduction
  | 'auction'          // 🎪 Auction (feature-flagged)
  | 'personality_dice' // 🎲 Personality Dice
  | 'group_mirror'     // 🪞 Group Mirror — peer reflection voting
  | 'quip_battle'      // ⚔️ Quip Battle — witty prompt responses
  | 'speed_friending'  // 🔄 Speed Friending — round-robin 1-on-1 rotations
  | 'mini_script'       // 🎭 迷你剧本杀 (feature-flagged)
  | 'recap';           // ✨ Session summary

type AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional';

// Vibe controls phase selection, duration, and warmup depth
// Machine IDs: 'deep_chat' | 'balanced' | 'play_fun'
// Display names: 深聊 | 均衡 | 暢玩
type VibeId = 'deep_chat' | 'balanced' | 'play_fun';

// MVP active phases (currently deployed):
const MVP_PHASES = ['warmup', 'micro_challenge', 'lie_detective'];
const DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES = [...MVP_PHASES, 'personality_dice'];
```

### Phase Configuration

| Phase | Emoji | CN Name | Timeout | Min Players | Key Mechanic |
|-------|-------|---------|---------|-------------|--------------|
| `warmup` | 🌅 | 话题卡 | 6–20 min | 2 | Mood-filtered topics, host navigates, all see same topic. **Vibe-aware duration:** 深聊 = 18–20 min with 6–7 cards + 3-tier prompts; 均衡 = 10–12 min with 5 cards; 暢玩 = 6–8 min with 4 cards. **UI (2026-07-16):** 4-band zero-scroll layout: slim host band, hero card slot (state machine: mood pick → generating → deal-flip), chrome-less presence strip, white action bar. CardFlip topic entrance is the single wow moment; archetype mix is woven into welcome copy and shown at the all-ready celebration; AIGC labels are a single quiet footer. ParticleBurst all-ready celebration. |
| `micro_challenge` | ⚡ | 挑战 | 8–10 min | 2 | Host-paced group task; each player taps "done", then the host advances after everyone finishes. |
| `lie_detective` | 🕵️ | 侦探 | 12–25 min | 3 | Per-player AI statements, group votes on which is the lie. Duration varies by vibe. |
| `undercover_word` | 🕵️‍♂️ | 谁是卧底 | 12–15 min | 3 | Hidden-role word deduction; AI generates word pairs, players describe and vote |
| `auction` | 🎪 | 拍卖 | 16–30 min | 3 | Virtual-coin lots + host-closed English auction (AI lots when `SOCIAL_AUCTION_LLM_ENABLED=true`, else curated fallbacks). Bid history, outbid notifications, archetype-aware lot generation. |
| `personality_dice` | 🎲 | 骰子 | 10–15 min | 2 | AI-generated archetype dares. When `PERSONALITY_DICE_CHOOSE_MODE_ENABLED=true`, each player receives 3 difficulty-tiered options (simple/medium/hard) and picks one. |
| `group_mirror` | 🪞 | 群像镜像 | 14–15 min | 2 | Peer reflection voting; players nominate who best fits each question |
| `quip_battle` | ⚔️ | 机智对决 | 10–15 min | 2 | Witty prompt responses; SwipeCard voting, best-of reel |
| `speed_friending` | 🔄 | 速聊 | 14–18 min | 2 | Round-robin timed 1-on-1 rotations. Glow+blaze only. |
| `mini_script` | 🎭 | 迷你剧本杀 | 45 min | 4 | **Full Social Icebreaker phase.** Host-picked style/genre, multi-act collaborative mystery with role assignments, clue reveals, and group voting. Feature-flagged (`SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`). Not a side game — executes within the phase-ordered session flow. |
| `recap` | ✨ | 回顾 | 5–6 min | 1 | AI-generated session summary with V2 stats (lieDetective aiWinRate, personalityDice highlights, undercoverWord result, etc.). IdentityReveal hero headline, CardFlip share card, staggered medal grid, ParticleBurst celebration. |

> **Phase durations are vibe-aware.** When `RUN_PLAN_TEMPLATES_ENABLED=true`, the template compiler (`resolveTemplateSlots` in `packages/shared/src/runPlanCompiler.ts`) allocates `allocatedMinutes` per segment from 9 default templates (3 vibes × 3 tiers). When `false`, legacy hardcoded plans apply uniform durations regardless of vibe.

### Session Lifecycle

```
User opens event/group page
        │
        ▼
POST /api/social-icebreaker/start
  { sessionId, displayName, tier?, vibe? }
        │
        ├── First caller → becomes HOST
        └── Subsequent callers → join existing session
        │
        ▼
GET /api/social-icebreaker/:socialSessionId  (poll every 3s)
  returns SocialSessionState + joinedParticipants roster summary
        │
        ▼
[TIER + VIBE SELECTION] (host only, before or during warmup)
  Host selects tier (`breeze`/`glow`/`blaze`) + vibe (`deep_chat`/`balanced`/`play_fun`)
  → POST /api/social-icebreaker/:socialSessionId/set-tier { tier, vibe }
  Server recompiles run plan via template compiler (when `RUN_PLAN_TEMPLATES_ENABLED=true`)
  or legacy `compileAgentRunPlan()` (when `false`).
  Tier can only be changed during `waiting` or `warmup` phase.

  **Re-selecting tier on an existing session** — since 2026-07-06, `POST /api/social-icebreaker/start`
  honors a changed `eventTier`/`vibe` when the caller is the original host and the session is still in
  `warmup`. This fixes the single-player test flow where selecting `custom` after an initial `glow`
  session used to reuse the old glow plan and advance straight to `recap`. The reset is handled by
  `resetSocialIcebreakerTier()` in `apps/server/src/services/socialIcebreakerTierReset.ts`, which is
  shared with `/set-tier`.

  **`/start` failure diagnostics (2026-07-11):** access denial returns a machine-readable `code` (`GROUP_EXPIRED`/`EVENT_EXPIRED` → 410, `NOT_MEMBER_OF_GROUP`/`NOT_MEMBER_OF_EVENT` → 403, `SESSION_NOT_FOUND` → 404) and the server emits `logger.warn('[SocialIcebreaker] /start access denied', { code, status, sessionId, userId })`. The mini-program tier selector (`pages/icebreaker-session/tier-selector`) writes `tier-selector:start-session-failed` (with `statusCode`/`code`/`isTransportError`) to the WeChat realtime log and shows a scenario-specific toast, replacing the previous silent `创建没成功，再试试` fallback.

  **Custom mode (`custom`)** — host-driven free-form flow (feature flag `SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED`, default `true`):
  - Available as a fourth tier option. No fixed run plan; host picks phases one-by one from a carousel.
  - `autoAdvanceEnabled` is set to `false`; only the host can advance/end. This host-paced rule also applies to preset tiers.
  - Server enters `phase_selection` between phases. Host chooses next phase via `POST /api/social-icebreaker/:socialSessionId/select-phase { phase, phaseSelectionId }`.
  - Host can end early from `phase_selection` or `recap` via `POST /api/social-icebreaker/:socialSessionId/end-session { phaseSelectionId? }`, generating a recap snapshot identical to normal advance.
  - **Phase-selection data is host-only (2026-07-31):** `sanitizeStateForClient` strips `phaseSelectionId` for non-host callers and `buildClientState` attaches `selectablePhases` only when the caller is the session host — players never receive the actionable nonce or the picker list. The mini-program `CustomModeSection` renders phase emblems via `JoyJoinIcon` (`tier='phase'`), never raw emoji. Route-level regression coverage: `apps/server/src/__tests__/socialIcebreakerCustomRoutes.test.ts` (16 tests: `/select-phase` + `/end-session` auth/phase/nonce guards, stale or unknown `phaseSelectionId` → 400, host-only sanitize unit cases).
  - Preset tiers can be re-selected from custom mode; custom data (selected phases, completed phases) is preserved but the fixed run plan takes over.
  - When switching from a preset tier to `custom`, the server clears `runPlan`, `completedPhases`,
    `phaseSelectionId`, and phase-specific ephemeral state, then advances from `warmup` into
    `phase_selection`.
        │
        ▼
[WARMUP PHASE]
  Host selects mood → POST .../topics (server generates shared warmupTopics list)
    — Server sets `warmupTopicsStatus = 'generating'` + `warmupTopicsGeneratingAt` before any LLM work, and `warmupTopicsStatus = 'ready'` (or `'error'`) when generation finishes
    — All Social Icebreaker LLM calls are wrapped with `raceWithTimeout(ms, RACE_LLM_TIMEOUT_MS = 6000)` in `apps/server/src/socialIcebreakerAICore.ts`; this is a deterministic Promise.race hard bound, not just an AbortController signal. On timeout/error the generator returns a deterministic fallback and logs `fallbackUsed: true` / `evaluatorRejectionReason: 'timeout'` via `logAITrace`
    — The `/topics` endpoint **re-reads the latest session snapshot** after generation + merges only owned fields (`selectedMood`, `warmupTopics*`, `currentTopicIndex`, `warmupReadyUserIds`) — this eliminates the lost-update that previously clobbered concurrent ready writes
    — If topics generation fails on the client, the host sees an **error card** (Xiaoyue mascot, warm-rose #B83A5E copy, primary 重试 button, ≤2 auto-retries via `shouldRetryWarmupTopics`) instead of a phantom local fallback deck that would be swapped out by the next poll
  Any player → POST .../warmup/ready once they are comfortable moving on
    — Client updates **optimistic ready count** immediately (mirrors the self-ember), avoids the "ready tap → 6s spinner → nothing happened" UX
    — Concurrent duplicate ready POSTs are blocked by `performSocialAction`'s same-key action guard; suppressed taps show 「正在同步，请稍候」 toast
  Host → POST .../warmup/next-topic once everyone is ready
  Any player → POST .../pulse-check { vibe: 1|2|3 }
        │
  ▼ Host calls POST .../advance (phase advance, not per-topic navigation)
[MICRO_CHALLENGE PHASE]
  Server auto-generates challenge on advance
  Each player → POST .../micro-challenge/complete
        │
        ▼ Host calls POST .../advance after everyone finishes (skipped if <3 players)
[LIE_DETECTIVE PHASE]
  V1 mini-program: each player writes 3 statements (2 facts + 1 lie) and POSTs them to
  .../lie-detective/generate; the server stores `isLie` separately. Legacy callers may omit
  the custom set and use the server AI generator.
  Single-test bots: the approved Lie Detective AI generator creates each bot's set, then
  deterministic seeded bot votes simulate the other attendees.
  All other players → POST .../lie-detective/vote
  isLie revealed server-side when all votes received
  Host → POST .../lie-detective/next-player to move to the next player after reveal
        │
        ▼ Host calls POST .../advance
[UNDERCOVER_WORD] (when `SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD=true`)
  Host → POST .../undercover-word/generate (AI word pair, role assignment)
  Players → POST .../undercover-word/describe (word description) → POST .../undercover-word/vote
        │
        ▼ Host calls POST .../advance
[AUCTION] (only when `SOCIAL_ICEBREAKER_ENABLE_AUCTION=true`, inserted before `personality_dice`)
  Host → POST .../auction/generate-lots (AI or curated `auctionLots[]`, initializes `auctionBalances`)
  Players → POST .../auction/bid { amount } (virtual coins; outbid refunds previous high)
  Host → POST .../auction/close-lot after each lot (records `auctionRecapLines`, advances lot index)
        │
        ▼ Host calls POST .../advance only when `auctionAllLotsClosed` is true
[PERSONALITY_DICE] (optional; default enabled)
  Host → POST .../personality-dice/generate
  Players → POST .../personality-dice/complete
        │
        ▼ Host calls POST .../advance
[GROUP_MIRROR] (when `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR=true`)
  Host → POST .../group-mirror/generate
  Players → POST .../group-mirror/submit (nominate + reason)
  Host → POST .../group-mirror/reveal
        │
        ▼ Host calls POST .../advance
[QUIP_BATTLE] (when `SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE=true`)
  Host → POST .../quip-battle/generate (AI prompts)
  Players → POST .../quip-battle/submit (answers) → POST .../quip-battle/vote (SwipeCard upvotes)
  Host → POST .../quip-battle/results (reveals best-of reel per prompt)
        │
        ▼ Host calls POST .../advance
[BONUS GATE] (when next phase would be `mini_script` and `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` is true)
  Server pauses advancement and offers bonus gate to host + players
  Host → POST /api/miniscript/bonus/respond { accept: boolean }
  Players → POST /api/miniscript/bonus/sentiment { sentiment: 'want' | 'pass' }
  If accepted → enter [MINI_SCRIPT]; if declined → skip to [RECAP]
        │
        ▼ Host calls POST .../advance
[MINI_SCRIPT] (when `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` or legacy `_BETA` true)
  Host opens the mini-script config modal and chooses style/genre; the client shows `AiGenerationShell` while `POST /api/miniscript/generate` runs (32 s hard bound; shell surfaces progress, step text, and a completion CTA)
  Host → POST /api/miniscript/generate (see miniscript routes below)
  Players → CardFlip role reveal, TapReaction clue voting, IdentityReveal act transitions
        │
        ▼ Host calls POST .../advance
[RECAP]
  GET .../recap → AI-generated { headline, moments[], closingLine, medals[], lieDetectiveV2Stats?, personalityDiceHighlights?, undercoverWordResult?, microChallengeHighlights?, groupMirrorHighlights? } (`social-recap-summary-v2`; includes lie highlights, dice, MiniScript premise excerpt, auction lines when present). V2 recap snapshot is built once during phase advance and persisted in `recapSnapshot`.
```

### Single-Player Test Mode & Tier Reset (2026-07-06; updated 2026-07-08)

A **single-player test flow** lets staff/internal users start a Social Icebreaker session without a full matched group, primarily for QA and demo. It is gated by server-side `isMatchingTestMode()` (requires `ENABLE_SINGLE_TEST_MODE=true` and is disabled in `APP_MODE=production`).

**Client components**
- `TestModeDisclosure` (`apps/mini-program/src/components/icebreaker/TestModeDisclosure.tsx`) — renders a full-screen disclosure overlay when `session.isTestModeSkip === true` and the session is still in `warmup`. Explains that multi-player phases have been skipped, shows the active tier/vibe, displays a warm mascot "ready" hint when bot simulation is enabled, and offers a primary **查看总结** CTA that explicitly advances the host from `warmup` to `recap`. If the advance fails, an inline error message is shown and the CTA becomes a **重试** action. The overlay is dismissible via an 88rpx close button; `min-height` includes a `vh` fallback before `dvh`. Empty-roster and loading states are handled gracefully.
- `IcebreakerTierSheet` (`apps/mini-program/src/pages/icebreaker-session/components/IcebreakerTierSheet.tsx`) — the tier/vibe selector sheet surfaced by the in-session host menu and during initial session setup.

**Server authority**
- `POST /api/social-icebreaker/start` accepts `eventTier`/`vibe` from the client. When the caller is the original host and the session is still in `warmup`, a changed tier/vibe triggers `resetSocialIcebreakerTier()` (`apps/server/src/services/socialIcebreakerTierReset.ts`) rather than reusing the previous plan.
- The reset clears `runPlan`, `completedPhases`, `phaseSelectionId`, and phase-specific ephemeral state, then re-advances from `waiting` into `warmup` (or `phase_selection` for `custom`).
- Reset is blocked when:
  - the caller is not the host,
  - the session has already left `warmup`,
  - the requested tier is `custom` and `SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED` is false.
- Auto-advance is intentionally disabled for single-test sessions (`state.singleTest.isTestModeSkip === true`) so the test-mode disclosure gate is not bypassed.
- `getSingleTestMetaForSessionStart` propagates `runBots` to the client state so the disclosure can surface the correct copy and the server knows whether to simulate bot actions.

**Bot simulation for single-test sessions (2026-07-08)**
- `apps/server/src/services/socialIcebreakerBotService.ts` provides deterministic, seeded, LLM-free bot simulation for single-test sessions when `runBots === true`.
- Covered phases: `warmup`, `micro_challenge`, `lie_detective`, `auction`, `personality_dice`, `quip_battle`, `undercover_word`, `group_mirror`, `speed_friending`, and `mini_script`.
- Wired into `socialIcebreaker.ts`, `socialIcebreakerCustom.ts`, `socialIcebreakerGameplayCore.ts`, `socialIcebreakerGameplayExtra.ts`, `socialIcebreakerExtended.ts`, and `routes/domains/miniscript.ts` via `runBotSimulationSafely()`.
- All bot actions are gated by `isSingleTestMode() && isSocialIcebreakerTestMode() && state.singleTest.runBots === true` so they never run in production or normal sessions.
- Logs the `runBots` decision in `singleTestService.ts` for observability.
- Regression tests: `socialIcebreakerBotService.test.ts`, `singleTestMetaRunBots.test.ts`, `socialIcebreakerClientState.test.ts`.

**UX rules**
- The disclosure is **not** shown to normal matched-group players (`isTestMode === false`).
- Tier reset is only actionable while `currentPhase === 'warmup'`; once the host advances past warmup the reset CTA is hidden.
- Custom mode remains host-driven free-form; switching from a preset tier to `custom` clears the fixed run plan and enters `phase_selection`.
- Preset ↔ custom mode switches in the in-session tier sheet require a double-confirm `Taro.showModal`.
- Analytics: `test_mode_disclosure_view`, `test_mode_reset_tap`, `test_mode_reset_success`, `test_mode_reset_error`, `icebreaker_test_mode_disclosure_shown`, `icebreaker_session_tier_changed`.

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

  // Tier + vibe (template-driven when RUN_PLAN_TEMPLATES_ENABLED=true)
  eventTier?: TierMachineId;       // 'breeze' | 'glow' | 'blaze'
  vibe?: VibeId;                   // 'deep_chat' | 'balanced' | 'play_fun'
  tierDisplayName?: string;        // e.g. '破冰局' | '畅聊局' | '狂欢局'
  archetypeMixText?: string;       // Pre-computed archetype composition summary for AI prompts

  // Topic card phase
  warmupTopics?: SocialTopic[];
  currentTopicIndex?: number;
  warmupReadyUserIds?: string[];
  selectedMood?: AtmosphereMood;
  commonGroundCount?: number;
  warmupTopicsStatus?: 'idle' | 'generating' | 'ready' | 'error'; // server-owned generation lifecycle (2026-07-26)
  warmupTopicsGeneratingAt?: number; // ms timestamp when generation started; used to bound stall suppression

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

  // Auction (virtual currency; see `SOCIAL_ICEBREAKER_ENABLE_AUCTION`)
  // AuctionLot = { id: string; title: string; teaser?: string; emoji?: string } (see packages/shared/src/socialIcebreaker.ts)
  auctionLots?: Array<{ id: string; title: string; teaser?: string; emoji?: string }>;
  auctionBalances?: Record<string, number>;
  auctionCurrentLotIndex?: number;
  auctionHighBid?: { userId: string; amount: number } | null;
  auctionAllLotsClosed?: boolean;
  auctionRecapLines?: string[];
  auctionLotStartedAt?: number;      // legacy compatibility only; no active countdown
  auctionBidHistory?: Array<{ userId: string; displayName: string; amount: number; at: number }>;

  // Recap
  recapData?: {
    topicsDiscussed: string[];
    challengesCompleted: number;
    lieDetectiveWinner?: string;
    funMoments: string[];
  };

  // Run plan (template-driven compilation)
  runPlan?: IcebreakerRunPlan;     // Compiled phase segments with allocatedMinutes per phase

  // Bonus gate (mini_script offer)
  bonusGateOffered?: boolean;
  bonusGateAccepted?: boolean;
  bonusGateDeclined?: boolean;
  bonusGatePlayerSentiment?: Record<string, 'want' | 'pass'>;
  bonusGateFrameworkPreloading?: boolean;
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

social_icebreaker_phase_metrics
  // per-phase instrumentation: dwellTimeMs, startedAt, endedAt, participantCount
```

Sessions expire after 6 hours and expired rows are swept periodically. Missing vs expired sessions are differentiated in the API so clients can handle `410 SESSION_EXPIRED` separately from a true `404`.

### Backend API Endpoints

**File:** `apps/server/src/routes/socialIcebreaker.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/social-icebreaker/start` | any | Join or create session; first caller = host; participant roster is persisted. Accepts optional `{ tier, vibe }` |
| `GET` | `/api/social-icebreaker/:socialSessionId` | any | Poll state (every 3s); registers presence and returns `joinedParticipants` roster summary |
| `POST` | `/api/social-icebreaker/:socialSessionId/topics` | host | Generate mood-filtered warmup topics. Sets `warmupTopicsStatus = 'generating'` before LLM work and `'ready'`/`'error'` after. **Reliability:** 6s deterministic `raceWithTimeout` hard bound (Promise.race) on all icebreaker LLM calls → deterministic fallback; endpoint re-reads latest session snapshot + merges owned fields only to avoid concurrent-ready lost updates; stall suppression while generating (≤30s). Client shows error card with retry on failure (no phantom local deck). |
| `POST` | `/api/social-icebreaker/:socialSessionId/warmup/ready` | any | Mark whether the current player is ready to move on |
| `POST` | `/api/social-icebreaker/:socialSessionId/warmup/next-topic` | host | Advance to the next shared warmup topic after mutual readiness |
| `POST` | `/api/social-icebreaker/:socialSessionId/advance` | host | Advance to next phase; accepts `force: true` to skip stragglers; auto-skips `lie_detective` if <3 players |
| `POST` | `/api/social-icebreaker/:socialSessionId/set-tier` | host | Change tier + vibe during `waiting` or `warmup` phase; server recompiles run plan |
| `POST` | `/api/social-icebreaker/:socialSessionId/pulse-check` | any | Submit vibe (1=cold, 2=warm, 3=fire) |
| `POST` | `/api/social-icebreaker/:socialSessionId/micro-challenge/complete` | any | Mark self as challenge done |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/generate` | any | Accepts a V1 custom 3-statement set + secret `lieIndex`; legacy callers may omit it for AI generation |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/vote` | any | Vote on which statement is the lie; triggers reveal when all voted |
| `POST` | `/api/social-icebreaker/:socialSessionId/lie-detective/next-player` | host | Advance to the next player after the current reveal resolves |
| `GET` | `/api/social-icebreaker/:socialSessionId/recap` | any | Generates AI recap summary |
| `GET` | `/api/social-icebreaker/:socialSessionId/moment-card.png` | any | Server-rendered shareable Moment Card PNG (feature-flagged: `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`; rate-limited: 5 req/min per user) |
| `POST` | `/api/miniscript/bonus/respond` | host | Host accepts or declines the bonus `mini_script` offer |
| `POST` | `/api/miniscript/bonus/sentiment` | any | Player votes `want` or `pass` on the bonus `mini_script` offer |
| `POST` | `/api/miniscript/generate` | host | Generate the story framework (style/genres/lite); idempotent; 32s hard bound with client 35s timeout |
| `POST` | `/api/miniscript/assign-roles` | host | Round-robin role assignment by join order (idempotent) |
| `POST` | `/api/miniscript/reveal-act` | host | Reveal next act + its clues + deduction hints (sequential) |
| `POST` | `/api/miniscript/vote` | any | Submit/replace a consensus vote (content-filtered) |
| `POST` | `/api/miniscript/reveal-solution` | host | Reveal the truth once all acts revealed + all assigned players voted |
| `POST` | `/api/miniscript/ready` | any | Toggle own role-card readiness |
| `POST` | `/api/social-icebreaker/:socialSessionId/early-end` | host | Jump to recap early without counting the current phase as completed; routes through `transitionPhase()` |
| `POST` | `/api/social-icebreaker/:socialSessionId/end-session` | host | End a custom-mode session early |
| `POST` | `/api/social-icebreaker/:socialSessionId/select-phase` | host | Select the next phase in custom mode (`phase_selection`) |

The mini-script family above (bonus + generate + actions) is mounted in `apps/server/src/routes/domains/miniscript.ts` at top-level `/api/miniscript/*` (wired via `registerIcebreakerRoutes` in `routes/domains/icebreaker.ts`), with `socialSessionId` read from the request body. These routes intentionally do NOT use the `/api/social-icebreaker/:id/...` prefix; the mini-program client must post to `/api/miniscript/*` (regression-guarded by `miniscriptClientPathContract.test.ts`, 2026-08-06).

### Frontend Surfaces

**Files (mini-program first):**
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` — Taro session page (primary in-field client)
- `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx` — barrel that now exports hero views exclusively (PH3 PR3: all 9 non-warmup phases), `PhaseHeroCard` shared premium frame with per-phase foil accent, 4 zones (header rail → hero → status → action), abandoned `--paused` rollback
- `apps/mini-program/src/pages/icebreaker-session/components/PhaseHeroCard.tsx` — shared premium card frame used by all hero views; per-phase foil border/shadow via `getPhaseFoilStyle()`, `artUrl` Lovart band (≤40%, widthFix)
- `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` — host-facing tier+vibe selector: 3 opinionated presets (`轻松破冰`, `深度畅聊`, `游戏狂欢`) plus an advanced 3×3 grid and a `自由局` custom mode card; feature-flagged via `features.runPlanTemplatesEnabled` and `features.socialIcebreakerCustomModeEnabled`
- `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` — Warmup phase (4-band zero-scroll layout: welcome band, hero card slot, chrome-less presence strip, white action bar). Host band replaced permanent XiaoyueChatBubble with 40rpx expression avatar + single toneLine. Host tools consolidated in `⋯` menu. Warmup hero card state machine: mood pick → generating shimmer → deal-flip to topic. `深聊` collapse expander. Ready CTA morphs `我准备好了` → `已准备 ✓`.
- `apps/mini-program/src/pages/icebreaker-session/phases/MicroChallengeHeroView.tsx` — Micro-challenge hero (live countdown, tap-burst, calm `已完成 ✓` morph) — pilot of PR2 PhaseHeroCard visual system
- `apps/mini-program/src/pages/icebreaker-session/phases/LieDetectiveHeroView.tsx` — Lie Detective hero (statement flip-to-reveal on vote complete, emoji-purged tags)
- `apps/mini-program/src/pages/icebreaker-session/phases/MomentCardView.tsx` — Session recap terminal card; dual-preview (Moment + keepsake); `keepsake` topic optional editorial block
- `apps/mini-program/src/pages/icebreaker-session/warmupViewModels.ts` — Warmup state machine, hero card state, ready CTA logic extracted from WarmupPhaseView
- `apps/mini-program/src/pages/icebreaker-session/phaseAccents.ts` — Per-phase foil accent tokens (`getPhaseFoilStyle()`), locked by `phaseAccents.test.ts` (≥4.5:1 deep-on-tint contrast)
- `apps/mini-program/src/styles/_phase-hero-card.scss` — PhaseHeroCard shared styles + `_phase-motion.scss` shared motion vocabulary
- `packages/shared/src/socialIcebreakerYuezaiCopy.ts` — Centralised 悦仔 copy: tier copy, permission lines (`YUEZAI_PERMISSION_LINES` keyed by `SocialTopicDepthLevel`), `getYuezaiCopyForTier()`
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

#### Template Compiler (`resolveTemplateSlots`)

When `RUN_PLAN_TEMPLATES_ENABLED=true`, the server uses a template-driven compiler instead of legacy hardcoded plans:

**4-tier fallback chain:**
1. **DB template** — query `run_plan_templates` table for matching `vibe` + `tier` + `playerCount` range
2. **`TEMPLATE_DEFAULTS`** — 9 seeded defaults (3 vibes × 3 tiers) in `packages/shared/src/runPlanCompiler.ts`
3. **Legacy `compileAgentRunPlan()`** — rule engine with archetype-weighted selection
4. **`BREEZE_RUN_PLAN`** — absolute fallback

**Slot resolution rules:**
- Each template defines `slots[]` with `slotType` (`deep_chat` | `play_fun` | `flexible`) and `eligiblePhases[]`
- Category spacing enforced: no two consecutive phases share the same `category`
- 4-tier fallback for each slot: eligible + spacing → full pool + spacing → eligible ignoring spacing → full pool ignoring spacing
- `allocatedMinutes` populated on each `PhaseSegment` from template slots

**Runtime validation:** `dbRowToTemplate()` validates `slotType` ∈ `['deep_chat','play_fun','flexible']` and `eligiblePhases` against `PHASE_ORDER`; invalid data triggers `TEMPLATE_DEFAULTS` fallback.

**Files:**
- `packages/shared/src/runPlanCompiler.ts` — `resolveTemplateSlots()`, `TEMPLATE_DEFAULTS`
- `apps/server/src/services/runPlanService.ts` — `compileForSession()`, `dbRowToTemplate()`, feature-flag gating
- `apps/server/src/repositories/runPlanTemplateRepo.ts` — DB queries for `run_plan_templates`

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
- `PERSONALITY_DICE_CHOOSE_MODE_ENABLED=true` → enables the Choose-Your-Prompt variant (3 difficulty-tiered dares per player, player picks one); `false` retains original single-dare flow
- `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true` → appends `mini_script` before recap (legacy alias: `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA`)

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

> **Deterministic hard timeout (2026-07-26):** Every LLM call in the Social Icebreaker generators is wrapped with `raceWithTimeout(promise, RACE_LLM_TIMEOUT_MS = 6000)` exported from `apps/server/src/socialIcebreakerAICore.ts`. This is a Promise.race hard bound, not a best-effort AbortController signal, so a hung transport or retrying SDK can never freeze a phase or route. On timeout or any error, the generator returns a deterministic curated fallback and logs `fallbackUsed: true` / `evaluatorRejectionReason: 'timeout'` (where applicable) via `logAITrace`. The regression test `warmupTopicsTimeout.test.ts` asserts that no bare `await client.chat.completions.create` remains in `socialIcebreakerAIService.ts`, `socialIcebreakerAuctionAI.ts`, or `socialIcebreakerPersonalityDiceAI.ts`.

| Function | Input | Output | Fallback |
|----------|-------|--------|---------|
| `generateWarmupTopics` | `{ mood, eventType, participantCount, vibe?, avoidTopics? }` | 5 `SocialTopic[]` | 25 curated topics (mood-filtered). When `vibe='deep_chat'`, generates 3-tier prompts (`opener`/`followUp`/`reflection`) on each `SocialTopic`. When `vibe='play_fun'`, generates lighter, faster prompts. **6s LLM timeout** with curated fallback. |
| `generateMicroChallenges` | `{ eventType, participantCount, completedChallengeIds? }` | 3 `MicroChallenge[]` | 8 curated challenges |
| `generateLieDetectiveStatements` | `{ userId, displayName, archetype?, interests? }` | 3 statements (2T+1F) | 3 curated fallback sets |
| `generateAuctionLots` | `{ eventType, participantCount, sessionContext? { mixText } }` | `AuctionLot[]` (with optional `emoji`) | Curated fallback lots; archetype mix injected when `sessionContext` provided |
| `generateXiaoYueComment` | `{ phase, event, context? }` | commentary string | hardcoded phase/event map |
| `generateRecapSummary` | `{ participants, topicsDiscussed, challengesCompleted, durationMinutes }` | `{ headline, moments[], closingLine }` | template-based default |

**Vibe-aware warmup prompt structure (`SocialTopicPromptTiers`):**

```typescript
interface SocialTopicPromptTiers {
  opener: string;      // Surface-level entry point
  followUp: string;    // Deeper elaboration
  reflection: string;  // Self-disclosure or insight
}

// Added to SocialTopic when vibe = 'deep_chat'
interface SocialTopic {
  id: string;
  text: string;
  mood: AtmosphereMood;
  depthLevel: number;           // 1 (light) → 3 (deep)
  promptTiers?: SocialTopicPromptTiers;  // 3-tier prompts for 深聊 vibe
  permissionLine?: string | null;       // 悦仔说 whisper, server-selected from register-matched pool at generation (PR3 PR1)
}
```

**Client → API vibe mapping:**
```typescript
// apps/mini-program/src/lib/vibeMapping.ts
const CLIENT_TO_API_VIBE = {
  deep_chat: 'chat',   // 深聊
  balanced: 'balanced', // 均衡
  play_fun: 'game',    // 暢玩
};
```

**Fallback strategy:** All functions gracefully fall back to curated content on AI error or empty response. `isLie` is only stored server-side and never exposed via the polling endpoint.

---

## §6 — Key Files Reference

> **Note:** `IcebreakerCardsSheet` (both user and admin copies) has been deleted. See §0 ADR-001.

| File | Purpose |
|------|---------|
| `shared/socialIcebreaker.ts` | Core types: phases, state, configs (`PHASE_CONFIG`, `PHASE_ORDER` — 11 phases, `MVP_PHASES`) |
| `packages/shared/src/socialIcebreaker.ts` | Package alias of above |
| `apps/server/src/routes/socialIcebreaker.ts` | Core Social Icebreaker API routes: start, session get/heartbeat, warmup/topics, moment-card telemetry, plus sub-router composition. |
| `apps/server/src/routes/socialIcebreakerGameplayCore.ts` | Core gameplay phase routes: micro-challenge, lie-detective, personality-dice. |
| `apps/server/src/routes/socialIcebreakerGameplayExtra.ts` | Extra gameplay phase routes: quip-battle, undercover-word, group-mirror, speed-friending, moment-card render, AI feedback. |
| `apps/server/src/routes/socialIcebreakerCustom.ts` | Custom mode routes: `select-phase` and `end-session`. |
| `apps/server/src/routes/socialIcebreakerTier.ts` | Tier/vibe selection route, including custom tier switching. |
| `apps/server/src/routes/socialIcebreakerExtended.ts` | Extended phase routes: auction (generate-lots, bid, close-lot), speed_friending auto-init (pair generation on phase advance) + advance guard |
| `apps/server/src/socialIcebreakerAIService.ts` | Public barrel for AI generation functions (re-exports topical modules). |
| `apps/server/src/socialIcebreakerAICore.ts` | Shared AI core: `AIServiceResult`, `fireAndForgetQualityGate`, `raceWithTimeout`, `isLLMTimeoutError`, `RACE_LLM_TIMEOUT_MS`. |
| `apps/server/src/socialIcebreakerPersonalityDiceAI.ts` | Personality-dice challenge generation (V1/V4 choose mode). |
| `apps/server/src/socialIcebreakerAuctionAI.ts` | Auction lot generation. |
| `apps/server/src/socialIcebreakerMiniScriptAI.ts` | Mini-script framework JSON fetch (MiniMax-first hybrid; owns its own 32s pipeline AbortController + catalog fallback). |
| `apps/server/src/services/runPlanService.ts` | Template-driven run plan compiler with 4-tier fallback chain; feature-flag gated by `RUN_PLAN_TEMPLATES_ENABLED` |
| `apps/server/src/repositories/runPlanTemplateRepo.ts` | DB queries for `run_plan_templates` table |
| `packages/shared/src/runPlanCompiler.ts` | `resolveTemplateSlots()` — 9 default templates (3 vibes × 3 tiers), category-spacing enforcement, slot resolution |
| `packages/shared/src/socialIcebreakerTierManifest.ts` | Tier machine IDs (`breeze`/`glow`/`blaze`) + `resolveTierDisplay()` + `LEGACY_TIER_MAP` |
| `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` | Tier+vibe selector grid, including `custom` mode (feature-flagged) |
| `apps/mini-program/src/pages/icebreaker-session/components/IcebreakerTierSelector.tsx` | Inline tier options component used by the session page. |
| `apps/mini-program/src/pages/icebreaker-session/components/CustomPhasePicker.tsx` | Host-facing PS5-style horizontal phase carousel for custom mode. |
| `apps/mini-program/src/pages/icebreaker-session/components/PlayerCustomLobby.tsx` | Non-host waiting state during custom-mode `phase_selection`. |
| `apps/mini-program/src/pages/icebreaker-session/components/CustomModeSection.tsx` | Host/player branch wrapper for the custom-mode `phase_selection` screen. |
| `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | Warmup phase with vibe-aware depth badges + 3-tier prompt reveal |
| `apps/mini-program/src/hooks/useTierReveal.ts` | Staggered tier-prompt reveal hook |
| `apps/mini-program/src/lib/vibeMapping.ts` | Client ↔ API bidirectional vibe mapping |
| `apps/user-client/src/components/social-icebreaker/socialIcebreakerPhaseRegistry.tsx` | Phase id → shipped UI template registry (`renderSocialIcebreakerPhasePanel`) |
| `apps/user-client/src/hooks/useSocialIcebreaker.ts` | React hook: session management, polling, all actions |
| `.github/skills/game-design-icebreaker-compilation/SKILL.md` | Game Design compile skill + modular safety/mechanics/handoff references |
| `.github/agents/game-design-agent.agent.md` | Game Design Agent (plan compilation handoff) |
| `.github/agents/game-development-agent.agent.md` | Game Development Agent (registry + server implementation) |
| `packages/shared/src/icebreakerGames.ts` | **DEPRECATED** — 13 static games for legacy `IcebreakerToolkit`. Not part of Social Icebreaker. Do not extend. |
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

**Custom-mode phase-selection data leaking to players (2026-07-31):**
- The same `buildClientState()` → `sanitizeStateForClient` path is the only serialization: `selectablePhases` is attached only when the caller is the session host, and `phaseSelectionId` is deleted for non-host callers
- If a player can read the nonce or sees the picker list, verify no other route returns the raw stored session state

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

---

## §8 — Phase Curve Audit (2026-08-03, 磁场引擎 P4)

Audit of tier run plans + `runPlanCompiler.ts` against two principles: **(1) Aron (1997) progressive self-disclosure** (light → deep pacing) and **(2) face-protection for mainland-China social norms** (no losers, no forced personal disclosure, no singling-out in early phases). Audit-first pass: only metadata/ordering fixes were applied; larger design changes are listed as backlog.

### Tier verdicts (static plans, `socialIcebreakerRunPlans.ts`)

| Tier | Order | Verdict |
|------|-------|---------|
| BREEZE 破冰局 | warmup → micro_challenge → lie_detective → recap | **PASS.** Peak (lie_detective) at position 3, gentle close. No early spotlight. |
| GLOW 畅聊局 | warmup → micro_challenge → lie_detective → personality_dice → group_mirror → recap | **PASS after fix.** Arc and cool-down were correct; group_mirror segment metadata (weight 3 / playful) contradicted its wind-down role — aligned to weight 1 / gentle. |
| BLAZE 狂欢局 | warmup → micro_challenge → lie_detective → personality_dice → auction → quip_battle → group_mirror → recap | **PASS after fix.** Peak-heavy middle (positions 3–6, ~57 of 90 min) is intentional for the tier; same group_mirror metadata alignment. |

### Compiler path (`runPlanCompiler.ts`)

- `CORE_PHASES` (warmup, micro_challenge) are hard-pinned to positions 1–2 and `recap` to last by `validateRunPlan`; no peak-arc phase can open a compiled plan. ✔
- **Fixed bug:** group_mirror carried `energyArc: 'warmup'`, so `ENERGY_ARC_ORDER` (warmup=1) made `sortByEnergyArc` place it **first in the non-core block** — e.g. Glow with `SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR` compiled to `warmup → micro_challenge → group_mirror → lie_detective → personality_dice → recap`. An anonymous perception-voting phase ("how the group sees you") at minute ~16, before any shared experience, violated progressive disclosure. Fix: `phaseRegistry.ts` group_mirror `energyArc: 'warmup' → 'falling'`; it now lands in the wind-down slot before recap, matching both static plans. Glow now compiles to `warmup → micro_challenge → personality_dice → lie_detective → group_mirror → recap`.
- Template path (`resolveTemplateSlots` / `TEMPLATE_DEFAULTS`) is slot-ordered, not arc-sorted; group_mirror appears only in later `deep_chat`/`flexible` slots (deep_chat breeze places it after 28 core minutes) — acceptable, no change.
- Regression guards added in `packages/shared/src/__tests__/runPlanCompiler.test.ts`: no warmup-arc phase in the non-core block; no peak-arc phase before position 3.

### Face-protection findings per phase

| Phase | Mechanic check | Finding |
|-------|---------------|---------|
| warmup (pos 1) | Group topic cards; `pass_ok`; per-topic `permissionLine` opt-out whisper; deck has `depthLevel` 1–3 with intentional brave-but-safe final card | **PASS.** Note: `getFallbackTopics` shuffles the deck, so a depth-3 reflective topic can surface first in fallback mode (the repair path pins the brave card last; the natural path does not order by depth) — backlog. |
| micro_challenge (pos 2) | Group-oriented challenges (find commonalities, co-invent an idea); completion-tracked, no voting, no losers | **PASS.** c2 "用3个词形容右边的人" / c5 "30秒不为人知" are mild, positive-framed, self-selected content. |
| lie_detective (pos 3+) | Self-authored disclosure (V1: user writes own 2 truths + 1 lie; V2: user writes 2 tags, AI expands); advance guard requires every roster player to author statements (`canBeSkipped: false`, `participation: full`) | **PASS with findings.** Position 3+ is correct Aron pacing, and authorship keeps disclosure user-controlled. **Votes are not anonymous:** `state.votes` (voterId + guessedStatementIndex) is broadcast in client state via `buildClientState`/`sanitizeStateForClient` pre-reveal, and the reveal response returns per-voter `publicVotes` — backlog. |
| personality_dice (pos 3–4) | Explicit pass route (`dicePassedBy`); pass counts toward phase completion so passers never block; choose-mode lets players pick challenge difficulty (`diceSelectedOption`); `participation: pass_ok` | **PASS.** Best-in-catalog opt-out design. |
| auction (blaze, pos 5–6) | Virtual coins only; lots are opt-in fun prompts (bid = volunteer); outbid auto-refunds; recap copy is winner-only ("由X以N虚拟币拍下" / "流拍（无人出价）") | **PASS.** Being outbid reads as "didn't get the prize", never public failure. Late-phase only, flag-gated. |
| group_mirror (intended late) | Anonymous perception voting; questions flattering/neutral; results expose only top-voted + count (no bottom ranking) | **PASS after fix** (metadata). Data-layer note: `groupMirrorAnswers` carries voter→target attribution in broadcast client state, contradicting the "匿名投票" copy — backlog. |
| quip_battle (blaze/templates) | Parallel written answers (introvert-friendly); results are winner-only per prompt, no loser ranking | **PASS.** Minor: answers carry displayName in payload during voting — backlog (low priority). |
| undercover_word (blaze, flag default off) | 谁是卧底: one hidden odd-one-out is publicly identified at reveal (`caught` + name in recap) | **NOTE.** The only loser-adjacent mechanic in the catalog; acceptable as a late, opt-in, peak-arc phase. Keep out of early positions; monitor reveal copy tone. |
| mini_script (flag-gated, not in default plans) | Roleplay with assigned roles + votes | **NOTE.** Late position when enabled; out of default-path scope for this audit. |
| recap (final) | falling arc, `observe_ok`, medals/highlights celebration | **PASS.** |

### Fixes applied (this pass)

1. `packages/shared/src/phaseRegistry.ts` — group_mirror `energyArc: 'warmup' → 'falling'` (with comment). No weight change (`energyArcToWeight` maps both to 1; `customRunPlanService` maps both to 1); no other `energyArc` consumers exist in mini-program or server.
2. `packages/shared/src/socialIcebreakerRunPlans.ts` — GLOW + BLAZE group_mirror segments `energyWeight 3 → 1`, `tone 'playful' → 'gentle'` (matches registry tone and compiler output for falling).
3. `packages/shared/src/__tests__/runPlanCompiler.test.ts` — replaced the test that pinned the old opener placement; added two structural arc guards.

### Backlog (explicitly NOT done in this pass)

1. **Self-disclosure-depth field on `PhaseModule`** — no explicit depth metadata exists (only `energyArc`/`energyWeight`/`tone`). Add e.g. `disclosureDepth: 1–3` so compilation can enforce light→deep independent of energy.
2. **Warmup deck depth ordering** — sort fallback (and LLM-normalized) topic decks by `depthLevel` ascending so the brave/reflective card cannot open the phase (repair path already pins it last; natural path shuffles).
3. **Lie-detective vote anonymity** — strip or aggregate `state.votes` in `sanitizeStateForClient` until reveal (mirror the `bonusGatePlayerSentiment` aggregate pattern); reconsider per-voter `publicVotes` in the reveal response.
4. **Group-mirror answer attribution** — remove voter→target pairs from broadcast client state (`groupMirrorAnswers`); keep only aggregates + the requester's own answer, matching the "匿名投票" copy.
5. **Quip-battle answer authorship during voting** — evaluate hiding `displayName` on answers until results are revealed.
6. **Undercover-word reveal framing** — loser-adjacent by design; consider softening reveal/recap copy ("被找出" → celebration framing) if tester feedback flags face concerns.
7. **Forced lie_detective authorship** — every roster player must author statements to advance; consider a pass/skip affordance for players unwilling to self-disclose (currently host can only skip the whole phase in custom mode).
