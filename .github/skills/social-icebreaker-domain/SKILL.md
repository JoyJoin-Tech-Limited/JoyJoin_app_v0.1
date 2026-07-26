---
name: social-icebreaker-domain
description: >
  Primary in-event Social Icebreaker — session lifecycle, phase system, host/player authority,
  REST route surface, state store schema, rejoin semantics, cross-platform parity, and AI integration
  boundaries. Use when building, debugging, or extending the social icebreaker session flow.
  Trigger phrases: social-icebreaker, social session, phase advance, host authority, icebreaker
  rejoin, socialIcebreakerPhaseRegistry, phaseViews, warmup, micro_challenge, recap, session TTL,
  social_icebreaker_sessions, SOCIAL_ICEBREAKER_ENABLE.
---

# social-icebreaker-domain

**Core rule:** The Social Icebreaker is a host-driven, phase-ordered group activity session with a 6-hour TTL. The server owns phase eligibility, host authority, and AI generation gating; clients own rendering and self-state mutations. Mini-program is the launch-primary surface.

## When to use this skill

- Adding, removing, or reordering phases; changing host authority
- Modifying session lifecycle (create, rejoin, expiry, sweep, heartbeat)
- Changing the session store schema or REST routes under `/api/social-icebreaker/*`
- Debugging cross-platform parity between web and mini-program registries
- Investigating AI integration boundaries

## When NOT to use this skill

- Phase-specific game logic → use the **vertical skill** for that phase
- LLM routing / prompt versioning → use `llm-runtime-safety-and-integration`
- Web UI polish or Taro layout → use `frontend-component-architecture` or `mini-program-frontend-excellence`

## Session lifecycle

```
POST /start     → create or rejoin (first caller becomes host)
GET /:id (poll) → 3s interval
POST /advance   → host-driven phase transition
POST /:id/set-tier → host changes tier/vibe while still in warmup
GET /recap      → AI summary + medals
GET /:id/moment-card.png → server-rendered shareable PNG (feature-flagged)
POST /:id/bonus/respond  → host accepts/declines mini_script bonus gate
POST /:id/bonus/sentiment → player votes want/pass on bonus gate
TTL sweep (5m)  → deletes expired sessions (6h lifetime)
```

**Key semantics:** `socialSessionId` = `social_${icebreakerSessionId}`; rejoin is an `upsertParticipant`; expiry returns **410 SESSION_EXPIRED**. On `POST /start`, access denial returns a structured `{ code }` (2026-07-11): `410 GROUP_EXPIRED`/`EVENT_EXPIRED`, `403 NOT_MEMBER_OF_GROUP`/`NOT_MEMBER_OF_EVENT`, `404 SESSION_NOT_FOUND` (distinct from polling `410 SESSION_EXPIRED`); logged as `[SocialIcebreaker] /start access denied`. Race-condition safety is handled by unique-constraint catch-and-resolve. **Reliability patterns (2026-07-24 / 2026-07-26):** All icebreaker LLM calls are wrapped with `raceWithTimeout(promise, RACE_LLM_TIMEOUT_MS = 6000)` from `apps/server/src/socialIcebreakerAICore.ts`; this is a deterministic Promise.race hard bound, not just an AbortController signal, so a hung SDK or transport can never freeze a phase. On timeout/error, generators return a deterministic fallback and log `fallbackUsed: true` / `evaluatorRejectionReason: 'timeout'` via `logAITrace`. `generateMicroChallenges` was the original 2026-07-24 fix; the wrapper was generalized to all icebreaker generators on 2026-07-26. `processAutoAdvance` uses an in-process `fuseExecutionsInFlight` Set + re-verify of persisted `autoAdvanceScheduledAt` to prevent double-execution by concurrent readers. `POST /topics` sets `warmupTopicsStatus = 'generating'` before LLM work and `'ready'`/`'error'` after, re-reads the latest session snapshot, and merges only owned fields (`selectedMood`, `warmupTopics*`, `currentTopicIndex`, `warmupReadyUserIds`) to avoid concurrent-ready lost updates; stall nudges are suppressed while `warmupTopicsStatus === 'generating'` (up to 30s). Client `performSocialAction` accepts `suppressErrorToast` option and blocks same-key concurrent actions, showing a 「正在同步，请稍候」 toast when a tap is skipped.

**Single-test sessions:** When `state.singleTest.isTestModeSkip === true`, auto-advance is disabled and the client surfaces a `TestModeDisclosure` overlay in `warmup`; the host must explicitly confirm to advance to `recap`.

## Host vs Player Authority

| Action | Authority |
|--------|-----------|
| Start session | First caller (becomes host) |
| Advance phase / generate content | **Host only** |
| Change tier/vibe during warmup | **Host only** (locked to `waiting`/`warmup`; preset ↔ custom switch requires double confirmation) |
| Ready / complete / vote / bid | **Any player** (self-state) |

**Pattern:** Host owns **phase transitions**, **generative triggers**, and **tier/vibe selection**; players own **self-state mutations**. See [references/session-spec.md](references/session-spec.md) for routes, schema, parity, AI boundaries, and advance guards.

## Grill-me stress-test

Run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests session lifecycle, host authority, phase state machine, bonus gate, AI fallback, and cross-platform parity.

## Quick examples

**"Add a new phase between warmup and micro_challenge"** → Check `PHASE_ORDER`, add to `socialIcebreakerPhaseConfig.ts`, update advance guards, register in both client registries, add env flag if feature-gated.

**"Why can't the host advance from lie_detective?"** → Check advance guard (all statements generated, all turns revealed) and `getNextEligiblePhase` (roster < 3 skips the phase).

**"Fix vote reveal logic"** → Start with `lie-detective-icebreaker` (owns vote/reveal state machine). Use this skill only for session lifecycle context.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 404 after refresh | `socialSessionId` not cached / expired | Check `sessionStorage`; verify `expires_at` |
| Host can't advance | Guard not met | Check `currentPhase`; verify guard conditions |
| Duplicate participants | Concurrent start race | Unique-constraint catch; check client not calling `start` twice |
| AI content empty/generic | Fallback triggered | Check `logAITrace` for `fallbackUsed: true` |
| Topics stuck at "generating" (12s+) | `generateMicroChallenges` unbounded DeepSeek call inside `transitionPhase` | Fixed 2026-07-24: added 6s `AbortController` timeout + deterministic fallback. Verify `evaluatorRejectionReason` in AITrace |
| User ready-state keeps getting wiped (e.g., 5/6 → 0/6) | `POST /topics` stale-snapshot lost update | Fixed 2026-07-24: re-read latest session + merge owned fields only. Verify `warmupReadyUserIds` survived after `/topics` call |
| Duplicate phase advance (two concurrent polls both execute fuse) | `processAutoAdvance` had no execution guard | Fixed 2026-07-24: in-process `fuseExecutionsInFlight` Set + re-verify persisted `autoAdvanceScheduledAt` before execution |
| Ready tap → nothing happens (no toast, no count update) | Same-key concurrent action block without user feedback | Fixed 2026-07-24: `performSocialAction` now shows 「正在同步，请稍候」 toast on skipped taps; optimistic ready count mirrors self-ember immediately |
| Topics error toast → phantom topics appear | Client deployed `LOCAL_WARMUP_TOPICS` fallback instead of error card | Fixed 2026-07-24: dead `setTopicsError(true)` wired; local deck deleted; error card shows mascot + warm-rose copy + primary 重试 + bounded auto-retry |
| Warmup topics re-retry uses stale mood | Client didn't track last submitted mood across retry | Fixed 2026-07-24: `lastTopicsMoodRef` keeps retry alive when server never persisted `selectedMood` |
| 6 calls/sec getSystemInfoSync from hidden tab cards | `useEventCountdown` called `prefersReducedMotion()` unmemoized | Fixed 2026-07-24: memoized via `useMemo([], [])` + interval stops on `useDidHide` |
| Any phase hangs at "悦仔正在出题…" for >10s | Unwrapped LLM call in a new generator | All icebreaker LLM calls must use `raceWithTimeout(..., RACE_LLM_TIMEOUT_MS)` from `socialIcebreakerAICore.ts`; add a regression test in `warmupTopicsTimeout.test.ts` that asserts no bare `await client.chat.completions.create` remains in the new module |
| Single-test 调试局 confirm-attendance returns 409 `ATTENDANCE_NOT_READY` | Group was never finalized into `events`/`blindBoxEvents` | `singleTestService.ts` now creates `events`/`blindBoxEvents`/`eventAttendance`/`venueTimeSlotBookings`; `confirm-attendance` prefers `group.blindBoxEventId`. Verify `singleTestGroupFinalization.test.ts` passes |
| Mini-program phase missing | Not in `phaseViews.tsx` | Add view function to session page switch |
| Lie truth leaked | `isLie` in `state_json` | Remove; `isLie` lives only in `lie_truths` table |
| Sweep not running | `startSocialIcebreakerSweep` threw | Sweep is fail-open (disables itself on error) |
| Bonus gate missing | Flag off or phase excluded | Verify `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`; check `bonusGateOffered` |
| Moment Card PNG 404 | Server render flag off | Enable `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER` |

## Review checklist

- [ ] New/modified route checks `state.currentPhase === expected` before mutating
- [ ] Host-only routes validate `userId === state.hostUserId`
- [ ] Phase added to `PHASE_ORDER` **and** `getNextEligiblePhase` **and** both client registries
- [ ] `cleanupPhaseStateForNextPhase` scrubs ephemeral state when leaving the phase
- [ ] Env flag added to `getServerEnabledPhases` if feature-gated
- [ ] `buildClientState` / `sanitizeStateForClient` do not leak internal DB IDs or secrets
- [ ] Bonus gate state (`bonusGateOffered`, `bonusGateAccepted`, `bonusGateDeclined`) is included in client state intentionally
- [ ] AI generator has curated fallback and emits `logAITrace`
- [ ] Mini-program `phaseViews.tsx` updated before or alongside web registry
- [ ] Unique constraints and race-handling preserved on `POST /start`
- [ ] Grill-me interview completed for any session lifecycle, phase, or authority change (see `references/grill-me-checklist.md`)

## Related Skills

- `lie-detective-icebreaker` — Vote/reveal, `isLie` secrecy
- `personality-dice-icebreaker` — Challenge copy, roster-sized generation
- `icebreaker-auction-phase` — Bid/close-lot, virtual-coin economy
- `miniscript-story-framework` — JSON schema, genre/style enums
- `game-design-icebreaker-compilation` — Run-plan compilation, energy arc
- `llm-runtime-safety-and-integration` — Provider routing, prompt versioning
- `platform-coordination-protocol` — Sibling-platform review
- `reliability-and-state-integrity` — Transaction boundaries, retry safety
