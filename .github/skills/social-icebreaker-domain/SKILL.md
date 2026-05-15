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
GET /recap      → AI summary + medals
GET /:id/moment-card.png → server-rendered shareable PNG (feature-flagged)
POST /:id/bonus/respond  → host accepts/declines mini_script bonus gate
POST /:id/bonus/sentiment → player votes want/pass on bonus gate
TTL sweep (5m)  → deletes expired sessions (6h lifetime)
```

**Key semantics:** `socialSessionId` = `social_${icebreakerSessionId}`; rejoin is an `upsertParticipant`; expiry returns **410 SESSION_EXPIRED**. Race-condition safety is handled by unique-constraint catch-and-resolve.

## Host vs Player Authority

| Action | Authority |
|--------|-----------|
| Start session | First caller (becomes host) |
| Advance phase / generate content | **Host only** |
| Ready / complete / vote / bid | **Any player** (self-state) |

**Pattern:** Host owns **phase transitions** and **generative triggers**; players own **self-state mutations**. See [references/session-spec.md](references/session-spec.md) for routes, schema, parity, AI boundaries, and advance guards.

## Quick examples

**User:** "Add a new phase between warmup and micro_challenge"
→ Use this skill. Check `PHASE_ORDER`, add the phase to `socialIcebreakerPhaseConfig.ts`, update advance guards, register in both client registries, and add env flag if feature-gated.

**User:** "Why can't the host advance from lie_detective?"
→ Use this skill. Check advance guard (all statements generated, all turns revealed) and `getNextEligiblePhase` (roster < 3 skips the phase).

**User:** "Fix the lie-detective vote reveal logic"
→ Do **not** use this skill alone. Start with `lie-detective-icebreaker` (owns vote/reveal state machine and `isLie` secrecy). Use this skill only for session lifecycle context (when to call `cleanupPhaseStateForNextPhase`).

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Session returns 404 after refresh | `socialSessionId` not cached / expired | Check `sessionStorage` on web; verify `expires_at` on server |
| Host can't advance | Guard not met | Check `currentPhase` matches request body; verify guard conditions in reference |
| Duplicate participants | Concurrent start race | Handled by unique-constraint catch; check client is not calling `start` twice |
| AI content is empty / generic | Fallback triggered | Check `logAITrace` for `fallbackUsed: true`; verify env vars and provider health |
| Mini-program phase missing | Not in `phaseViews.tsx` `supportedPhases` | Add view function and register in the session page switch statement |
| Lie truth leaked to client | `isLie` in `state_json` | Remove immediately; `isLie` lives only in `social_icebreaker_lie_truths` table |
| Sweep not running | `startSocialIcebreakerSweep` threw | Check logs; sweep is fail-open (disables itself on error) |
| Bonus gate not appearing | `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` is false or `mini_script` not in enabled phases | Verify env flag and tier run plan; check `bonusGateOffered` is set on advance |
| Moment Card PNG 404 | `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER` is false | Enable env flag; verify `@napi-rs/canvas` binary loads for the target platform |

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

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `lie-detective-icebreaker` | Vote/reveal logic, `isLie` secrecy |
| `personality-dice-icebreaker` | Challenge copy, roster-sized generation |
| `icebreaker-auction-phase` | Bid/close-lot mechanics, virtual-coin economy |
| `miniscript-story-framework` | JSON schema, genre/style enums |
| `game-design-icebreaker-compilation` | Run-plan compilation, energy arc |
| `llm-runtime-safety-and-integration` | Provider routing, prompt versioning |
| `platform-coordination-protocol` | Sibling-platform review |
| `reliability-and-state-integrity` | Transaction boundaries, retry safety |
| `multi-agent-deliberation` | Cross-domain changes needing multi-perspective review |
