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

---

## When to use this skill

- Adding, removing, or reordering phases in the icebreaker flow
- Changing host authority (who can advance, generate, or close)
- Modifying session lifecycle (create, rejoin, expiry, sweep, heartbeat)
- Changing the session store schema (`social_icebreaker_sessions`, `social_icebreaker_participants`)
- Adding or modifying REST routes under `/api/social-icebreaker/*`
- Debugging cross-platform parity between web (`socialIcebreakerPhaseRegistry`) and mini-program (`phaseViews.tsx`)
- Investigating AI integration boundaries (when to use `socialIcebreakerAIService.ts` vs. vertical skills)

## When NOT to use this skill

- Phase-specific game logic (lie-detective vote/reveal, auction bid/close, dice challenge copy, mini-script schema) → use the **vertical skill** for that phase
- LLM provider routing, prompt versioning, or shadow mode → use `llm-runtime-safety-and-integration`
- Web-only UI polish or motion design → use `frontend-component-architecture` + `wow-elements`
- Taro-specific pixel-perfect layout → use `mini-program-frontend-excellence`

---

## Session Lifecycle

```
POST /start        → create or rejoin (first caller becomes host)
  ↓
GET /:id (poll)    → 3s interval on web and mini-program
  ↓
POST /advance      → host-driven, guard-validated phase transition
  ↓
GET /recap         → AI-generated summary + medals
  ↓
TTL sweep (5m)     → deletes expired sessions (6h lifetime)
```

**Key semantics:**
- `socialSessionId` is deterministic: `social_${icebreakerSessionId}`
- Rejoin is an `upsertParticipant` — updates `display_name` and `last_seen_at`
- Race-condition safety: unique-constraint collision on `icebreaker_session_id` is caught and resolved by fetching the concurrent row
- Expiry returns **410 SESSION_EXPIRED** (not 404)

## Phase System

**Canonical order** (`PHASE_ORDER`):
```
warmup → micro_challenge → lie_detective → auction → personality_dice → mini_script → recap
```

**Default enabled:** `warmup`, `micro_challenge`, `lie_detective`, `personality_dice`

**Feature-flagged:** `auction` (`SOCIAL_ICEBREAKER_ENABLE_AUCTION`), `mini_script` (`SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`)

**Advance guards** (enforced server-side):
| Phase | Guard |
|-------|-------|
| `warmup` | All roster ready; topics generated |
| `micro_challenge` | Everyone completed or timer expired |
| `lie_detective` | All statements generated; all turns revealed |
| `auction` | `auctionAllLotsClosed === true` |

**State cleanup:** `cleanupPhaseStateForNextPhase` scrubs ephemeral fields when leaving a phase (e.g. `warmupReadyUserIds`, `currentChallenge`, `lieDetectivePlayers`, `auctionLots`).

## Host vs Player Authority

| Action | Authority |
|--------|-----------|
| Start session | First caller (becomes host) |
| Advance phase | **Host only** |
| Generate topics / lots / dice / mini-script | **Host only** |
| Ready / complete / vote / bid | **Any player** (self-state) |
| Next lie-detective player / next warmup topic | **Host only** |

**Pattern:** Host owns **phase transitions** and **generative triggers**; players own **self-state mutations**.

## REST Route Surface

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

Mini-script has its own top-level route: `POST /api/miniscript/generate`.

## State Store Schema

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

## Cross-Platform Parity

| Concern | Web | Mini-program |
|---------|-----|--------------|
| Registry | `socialIcebreakerPhaseRegistry.tsx` | `phaseViews.tsx` |
| State sync | TanStack Query polling (3s) | TanStack Query polling (3s) |
| Rejoin cache | `sessionStorage` | No persistent cache |
| Host controls | Global badge + per-phase buttons | Conditional `hostControls` |
| AI feedback | `IcebreakerRecapFeedbackBar` | `RecapAiFeedbackBar` |

**Rule:** Mini-program is launch-primary. Any new phase must land in `phaseViews.tsx` first.

## AI Integration Boundaries

- `socialIcebreakerAIService.ts` owns all in-event generators (warmup topics, micro challenges, lie-detective statements, auction lots, personality dice, recap summary, XiaoYue comments, mini-script framework)
- **All generators have curated fallbacks.** Never rely solely on LLM output.
- **Auction LLM is opt-in** (`SOCIAL_AUCTION_LLM_ENABLED`). Default is curated fallback only.
- **MiniScript has a deterministic stub** when `SOCIAL_MINISCRIPT_LLM_ENABLED` is false.
- Prompt versions and `logAITrace` domains are documented in `references/production-ai-surfaces.md`

For provider routing, prompt versioning, and shadow mode → see `llm-runtime-safety-and-integration`.

---

## Quick Examples

**User:** "Add a new phase between warmup and micro_challenge"
→ Use this skill. Check `PHASE_ORDER` in `packages/shared/src/socialIcebreaker.ts`, add the phase to `socialIcebreakerPhaseConfig.ts`, update advance guards in `socialIcebreaker.ts`, register in both `socialIcebreakerPhaseRegistry.tsx` and `phaseViews.tsx`, and add env flag if feature-gated.

**User:** "Why can't the host advance from lie_detective?"
→ Use this skill. Check advance guard: all players must have generated statements (`lieDetectiveCompletedUserIds` covers roster) and all turns must be revealed. Also check `getNextEligiblePhase` — if roster < 3, `lie_detective` is skipped entirely.

**User:** "Fix the lie-detective vote reveal logic"
→ Do **not** use this skill alone. Start with `lie-detective-icebreaker` (owns vote/reveal state machine and `isLie` secrecy). Use this skill only for session lifecycle context (when to call `cleanupPhaseStateForNextPhase`).

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Session returns 404 after refresh | `socialSessionId` not cached / expired | Check `sessionStorage` on web; verify `expires_at` on server |
| Host can't advance | Guard not met | Check `currentPhase` matches request body; verify guard conditions per phase table above |
| Duplicate participants | Concurrent start race | Already handled by unique-constraint catch; check client is not calling `start` twice |
| AI content is empty / generic | Fallback triggered | Check `logAITrace` for `fallbackUsed: true`; verify env vars and provider health |
| Mini-program phase missing | Not in `phaseViews.tsx` `supportedPhases` | Add view function and register in the session page switch statement |
| Lie truth leaked to client | `isLie` in `state_json` | Remove immediately; `isLie` lives only in `social_icebreaker_lie_truths` table |
| Sweep not running | `startSocialIcebreakerSweep` threw | Check logs; sweep is fail-open (disables itself on error) |

---

## Review Checklist

- [ ] New/modified route checks `state.currentPhase === expected` before mutating
- [ ] Host-only routes validate `userId === state.hostUserId`
- [ ] Phase added to `PHASE_ORDER` **and** `getNextEligiblePhase` **and** both client registries
- [ ] `cleanupPhaseStateForNextPhase` scrubs ephemeral state when leaving the phase
- [ ] Env flag added to `getServerEnabledPhases` if feature-gated
- [ ] `buildClientState` / `sanitizeStateForClient` do not leak internal DB IDs or secrets
- [ ] AI generator has curated fallback and emits `logAITrace`
- [ ] Mini-program `phaseViews.tsx` updated before or alongside web registry
- [ ] Unique constraints and race-handling preserved on `POST /start`

---

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `lie-detective-icebreaker` | Vote/reveal logic, `isLie` secrecy, statement generation |
| `personality-dice-icebreaker` | Challenge copy, roster-sized generation, trait mapping |
| `icebreaker-auction-phase` | Bid/close-lot mechanics, virtual-coin economy, escrow |
| `miniscript-story-framework` | JSON schema, genre/style enums, 4–6 player gate |
| `game-design-icebreaker-compilation` | Run-plan compilation, energy arc, template matching |
| `llm-runtime-safety-and-integration` | Provider routing, prompt versioning, shadow mode |
| `platform-coordination-protocol` | Sibling-platform review when touching both web and Taro |
| `reliability-and-state-integrity` | Transaction boundaries, retry safety, idempotency on start/rejoin |
| `multi-agent-deliberation` | New phase or session flow changes with UX + backend + AI tension requiring multi-perspective review |

## Canonical References

- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/socialIcebreakerPhaseConfig.ts`
- `apps/server/src/lib/socialIcebreakerStore.ts`
- `packages/shared/src/socialIcebreaker.ts`
- `apps/user-client/src/components/social-icebreaker/socialIcebreakerPhaseRegistry.tsx`
- `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx`
- `apps/mini-program/src/pages/icebreaker-session/index.tsx`
- `docs/ops/icebreaker-ai-quality-protocol.md`
- `references/production-ai-surfaces.md` (this skill)
