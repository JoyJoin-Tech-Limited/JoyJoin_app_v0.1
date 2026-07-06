# Social Icebreaker Session Specification

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

## REST Route Surface

Base: `/api/social-icebreaker`

| Method | Path | Purpose | Authority |
|--------|------|---------|-----------|
| `POST` | `/start` | Create or rejoin; also resets tier/vibe on an existing session when the caller is the original host and the session is still in `warmup` | Any |
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
