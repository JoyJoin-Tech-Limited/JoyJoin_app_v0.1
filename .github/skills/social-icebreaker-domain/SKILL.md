---
name: Social Icebreaker Domain
description: Primary live in-event system — session lifecycle, host/player authority, persistence/rejoin behaviour, roster vs active presence, action integrity, and secrecy boundaries. Use when working on icebreaker sessions, phase transitions, or AI content generation for live events.
---

# Social Icebreaker Domain

**Core rule:** The Social Icebreaker is the primary mandatory in-event icebreaking flow. All new in-event icebreaker features must integrate with this system. The legacy IcebreakerToolkit is quarantined and must not receive new CTAs.

## When to use this skill

- Adding or modifying Social Icebreaker phase behaviour
- Working on session lifecycle (start, advance, rejoin, end)
- Adding AI-generated content to a phase (topics, statements, recap)
- Reviewing host vs player authority
- Debugging session state inconsistency

## Source of truth

| Concern | Location |
|---------|----------|
| Shared contract + types | `packages/shared/src/socialIcebreaker.ts` |
| Server route handlers | `apps/server/src/routes/socialIcebreaker.ts` |
| AI content generation | `apps/server/src/socialIcebreakerAIService.ts` |
| Client hook | `apps/user-client/src/hooks/useSocialIcebreaker.ts` |
| Client page | `apps/user-client/src/pages/IcebreakerSessionPage.tsx` |
| Phase config tests | `apps/server/src/__tests__/socialIcebreakerPhaseConfig.test.ts` |
| Route tests | `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` |

## Session lifecycle

```
start → warmup → micro_challenge → lie_detective → recap
```

MVP phases: `['warmup', 'micro_challenge', 'lie_detective']`

- First caller of `POST /api/social-icebreaker/start` becomes the host
- Subsequent callers join as players
- Only one session per group (idempotent join)

## Host vs player authority

| Action | Authority |
|--------|-----------|
| Advance phase | Host only |
| Generate warmup topics | Host only |
| Start lie detective round | Host only |
| Submit pulse check | Player |
| Generate my statements | Player (per-user) |
| Cast vote | Player |
| View session state | All |

Enforce host authority server-side — do not rely on client-side gating alone.

## Persistence and rejoin behaviour

- Session state is server-persisted — clients rejoin by polling `GET /api/social-icebreaker/:sessionId`
- A user returning after refresh or reconnect receives the current server state
- Joining an already-joined session is idempotent — returns current state, not an error
- Do not depend on client-side memory for session state continuity

## Roster vs active presence

- **Roster**: all users who have joined the session (persistent, used for lie-detective and recap)
- **Active presence**: users currently connected (used for display/progress indicators only)
- Do not use active presence as a gate for phase advancement — use roster

## Phase action integrity

- Phase actions must be validated server-side (correct phase, correct actor, correct state)
- Out-of-phase actions return a clear error — not silent success
- Once a phase is advanced, it cannot be reversed
- Votes, statements, and completed challenges are persisted atomically before sending response

## Secrecy boundaries

Lie detective phase — secrecy rules:

- A player's own statements (true/false) must not be revealed to other players before voting
- API responses for statement lists must filter out the requesting player's own statements during the voting phase
- After voting resolves, reveal is allowed

## AI content

- AI topic generation (`POST .../topics`) and statement generation (`POST .../lie-detective/generate`) are per-request calls with the `AIResponseMeta` contract attached
- AI generation is a side effect — it must not block phase persistence
- Use `buildLiveAIMeta()` / `buildFallbackAIMeta()` from `packages/shared/src/types/aiMeta.ts`
- Log AI calls via `logAITrace()` from `apps/server/src/lib/aiTraceLogger.ts`

## Legacy quarantine

- `IcebreakerToolkit` (`apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx`) is a legacy pre-event game browser — do not add new CTAs or make it the primary in-event experience
- `IcebreakerTool` widget is an entry-point teaser only — it is not a session surface
- `IcebreakerCardGame` is a supporting layer inside the warmup phase, not a standalone primary flow

## Common mistakes to avoid

- Enforcing host authority only on the client
- Allowing a player to vote on their own statements
- Fetching session state from client memory after a reconnect (always re-fetch from server)
- Using active presence count as the condition for phase advancement
- Adding AI generation inside a transaction (it is a side effect — must be outside)
- Adding new primary icebreaker entry points that bypass `useSocialIcebreaker`

## Related files

- `packages/shared/src/socialIcebreaker.ts`
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts` — PostgreSQL-backed session/participant/lie-truth store; all reads and writes go through this module
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/user-client/src/hooks/useSocialIcebreaker.ts`
- `apps/user-client/src/pages/IcebreakerSessionPage.tsx`
- `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts`
- `apps/server/src/__tests__/socialIcebreakerPhaseConfig.test.ts`
- `packages/shared/src/types/aiMeta.ts`
- `docs/icebreaker-system.md` — full technical reference
