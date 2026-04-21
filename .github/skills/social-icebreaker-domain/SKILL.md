---
name: social-icebreaker-domain
description: >
  Primary live in-event Social Icebreaker — phases (warmup through recap), host/player authority,
  PostgreSQL session store, rejoin, roster vs presence, lie-detective secrecy. API under
  /api/social-icebreaker. Triggers: reconnect, host-only action, advance phase, lie detective,
  personality_dice, session rejoin.
---

# Social Icebreaker Domain

**Core rule:** The Social Icebreaker is the primary mandatory in-event icebreaking flow. All new in-event icebreaker features must integrate with this system. The legacy IcebreakerToolkit is quarantined and must not receive new CTAs.

**Client priority:** Ship and validate **WeChat mini-program (Taro)** behaviour first (`apps/mini-program/src/pages/icebreaker-session/`), then bring **web** (`apps/user-client`) to parity. Smooth in-session experience on mini-program is the default success criterion.

## When to use this skill

- Adding or modifying Social Icebreaker phase behaviour
- Working on session lifecycle (start, advance, rejoin, end)
- Adding AI-generated content to a phase (topics, statements, recap)
- Reviewing host vs player authority
- Debugging session state inconsistency

## Source of truth

| Concern | Location |
|---------|----------|
| Shared contract + types (`PHASE_ORDER`, `DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES`, `getNextEligiblePhase`) | `packages/shared/src/socialIcebreaker.ts` |
| HTTP router (mounted at `/api/social-icebreaker`) | `apps/server/src/routes/socialIcebreaker.ts` |
| Mount + auth wiring | `apps/server/src/routes/domains/icebreaker.ts` — `app.use('/api/social-icebreaker', isPhoneAuthenticated, socialIcebreakerRoutes)` |
| Phase timeouts / min players (`PHASE_CONFIG`) | `apps/server/src/socialIcebreakerPhaseConfig.ts` (imports shared types) |
| PostgreSQL session store | `apps/server/src/lib/socialIcebreakerStore.ts` |
| Session expiry sweep | `apps/server/src/lib/socialIcebreakerSweep.ts` |
| AI content generation | `apps/server/src/socialIcebreakerAIService.ts` |
| **Mini-program session + phase UI (primary client)** | `apps/mini-program/src/pages/icebreaker-session/index.tsx`, `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx` |
| Web session page + hook (parity) | `apps/user-client/src/pages/IcebreakerSessionPage.tsx`, `apps/user-client/src/hooks/useSocialIcebreaker.ts` |
| Web phase registry (parity; naming reference for templates) | `apps/user-client/src/components/social-icebreaker/socialIcebreakerPhaseRegistry.tsx` |
| Tests | `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts`, `socialIcebreakerPhaseConfig.test.ts`, `socialIcebreaker.test.ts`, `socialIcebreakerSweep.test.ts` |

## Session lifecycle

Canonical **phase order** (`PHASE_ORDER` in shared): `warmup` → `micro_challenge` → `lie_detective` → `auction` → `personality_dice` → `mini_script_beta` → `recap`.

- **`MVP_PHASES`:** `warmup`, `micro_challenge`, `lie_detective` only.
- **Default enabled set** (`DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES`): MVP **plus** `personality_dice` (so typical runs include the dice phase before recap when player counts allow). `auction` and `mini_script_beta` are optional / feature-flagged; `getNextEligiblePhase` skips phases that fail minimum player requirements.

```
start → (enabled phases in order) → recap
```

- First caller of `POST /api/social-icebreaker/start` becomes the host
- Subsequent callers join as players
- Only one session per group (idempotent join)

### Server-enabled phases (env)

Runtime list is **`getServerEnabledPhases()`** in `apps/server/src/socialIcebreakerPhaseConfig.ts`: starts from `DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES`, then optionally inserts `auction`, toggles `personality_dice` via **`SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE`** (default on), and may append **`mini_script_beta`** per env. Do not assume every deployment runs the same subset—check env + persisted `state.enabledPhases` on the session.

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

- [`packages/shared/src/socialIcebreaker.ts`](../../../packages/shared/src/socialIcebreaker.ts)
- [`apps/server/src/routes/domains/icebreaker.ts`](../../../apps/server/src/routes/domains/icebreaker.ts) — mounts `/api/social-icebreaker`
- [`apps/server/src/routes/socialIcebreaker.ts`](../../../apps/server/src/routes/socialIcebreaker.ts)
- [`apps/server/src/lib/socialIcebreakerStore.ts`](../../../apps/server/src/lib/socialIcebreakerStore.ts) — PostgreSQL-backed session/participant/lie-truth store; all reads and writes go through this module
- [`apps/server/src/lib/socialIcebreakerSweep.ts`](../../../apps/server/src/lib/socialIcebreakerSweep.ts)
- [`apps/server/src/socialIcebreakerPhaseConfig.ts`](../../../apps/server/src/socialIcebreakerPhaseConfig.ts)
- [`apps/server/src/socialIcebreakerAIService.ts`](../../../apps/server/src/socialIcebreakerAIService.ts)
- [`apps/user-client/src/hooks/useSocialIcebreaker.ts`](../../../apps/user-client/src/hooks/useSocialIcebreaker.ts)
- [`apps/user-client/src/pages/IcebreakerSessionPage.tsx`](../../../apps/user-client/src/pages/IcebreakerSessionPage.tsx)
- [`apps/mini-program/src/pages/icebreaker-session/index.tsx`](../../../apps/mini-program/src/pages/icebreaker-session/index.tsx)
- [`packages/shared/src/types/aiMeta.ts`](../../../packages/shared/src/types/aiMeta.ts)
- [`docs/icebreaker-system.md`](../../../docs/icebreaker-system.md) — full technical reference

## Quick examples

**User says:** "A player refreshed during the micro_challenge phase — how do they rejoin?"
**Apply this skill by:** The `GET /api/social-icebreaker/:sessionId` endpoint returns full current state. The client calls it on mount; `useSocialIcebreaker` restores UI from server state. Do not rely on client-side memory after a refresh.
**Result:** Player sees the current phase and their state without interruption.

---

**User says:** "Only the host should be able to advance the phase — how do I enforce this?"
**Apply this skill by:** In the route handler for phase advancement, verify `req.session.userId === state.hostUserId` server-side and return 403 if not. Do not rely on client-side conditional rendering alone.
**Result:** Host authority is enforced at the API layer regardless of client state.

## Frontend Excellence Notes

### Platform Applicability

- Applies directly to the Web live-session surface today and should be reused for any future Taro mini-program icebreaker session implementation.
- The server owns authority and persistence, but the client still has to render phase changes, reconnection states, and action affordances at a legendary quality bar.

### UI/UX & Aesthetic Guidance

- Phase UIs should make state unmistakable: loading, reconnecting, waiting-for-host, disabled, error, and resolved states all need explicit visual treatment and copy.
- Use JoyJoin design tokens and brand guidance so timers, prompts, vote cards, and recap surfaces feel premium rather than operational.
- Web implementations should use semantic buttons, headings, lists, dialogs, and landmarks; future Taro implementations should preserve the same hierarchy with native components.
- Every irreversible action requires immediate feedback: pressed state, optimistic locking or spinner, and a clear success or failure message.

### Web-Specific Considerations

- Maintain keyboard and `:focus-visible` support for host controls, voting options, and recovery actions; hover can enrich but must never be required to understand the state.
- Keep responsive layouts stable for small mobile widths first, since live sessions are likely to be used on phones in-event.
- Use the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) when deciding when recap feeds, rosters, or activity logs need virtualization.

### Taro-Specific Considerations

- If the session surface is ported to Taro, follow the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) for minimum touch targets and long-list handling, prefer `View`, `Text`, `Button`, `ScrollView`, and `Input`, and use `hover-class` only where tactile clarity improves the action.
- Keep large phase assets, recap media, or low-frequency routes aware of subpackage boundaries, and use `VirtualList` for long rosters or recap streams on mini-program.
- Preserve the same authority model and secrecy boundaries without relying on DOM-only interaction patterns.

### Accessibility & Performance Notes

- Meet WCAG 2.1 AA expectations for focus order, status messaging, readable contrast, and non-colour-only phase communication.
- Protect INP and scroll smoothness because this flow is interaction-dense; avoid main-thread-heavy timers, layout-triggering animations, and oversized rerenders on each poll or phase change.
- For live-state announcements, ensure the UI remains understandable even when motion is reduced or connectivity is unstable.

## Troubleshooting

- **Phase mismatch error — action rejected because phase is wrong** — the client submitted an action for a phase the server has already advanced past. Re-fetch current session state and re-render the correct phase UI before allowing the action.
- **Reconnect restores stale state** — the client is using cached/memory state instead of re-fetching from `GET /api/social-icebreaker/:sessionId`. Ensure the hook re-fetches on mount/focus.
- **Secrecy leak in lie-detective — client payload includes `isLie` or other unrevealed truth data** — truth data should stay in the separate server-only lie-truths table. Store only sanitized statements in public session state and confirm the client reveals outcomes only after the server says they are resolved.
- **Vote or statement not persisted before response returns** — the write is happening asynchronously after the response. Move `await tx.insert(...)` inside the transaction before `res.json(...)`.

## Review checklist

- [ ] Host-only actions are validated server-side (not client-gating only)
- [ ] Session join is idempotent — joining an already-joined session returns current state
- [ ] Phase actions are validated against the current phase before execution
- [ ] Votes, statements, and completed challenges are persisted atomically before response
- [ ] Lie-detective truth data (`isLie`) stays server-only; public session state contains sanitized statements only
- [ ] AI generation (topics, statements) is a side effect outside the transaction
