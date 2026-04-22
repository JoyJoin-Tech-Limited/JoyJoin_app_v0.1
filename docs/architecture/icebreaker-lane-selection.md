# Icebreaker Lane Selection Reference

**Status:** Active reference  
**Scope:** Which delivery lane (HRC / DM / Direct) to use for Social Icebreaker changes  
**Related:** [`social-icebreaker-domain`](../../.github/skills/social-icebreaker-domain/SKILL.md), [`lane-selection-governance`](../../.github/skills/lane-selection-governance/SKILL.md)

---

## The rule

Icebreaker is a **stack**, not a monolith. The layer you touch determines the lane.

| Layer | Examples | Lane | Rationale |
|---|---|---|---|
| **Session lifecycle & phase state machine** | Change `PHASE_ORDER`, modify `advance` guards, alter `cleanupPhaseStateForNextPhase`, change host authority rules, modify TTL/sweep logic | **HRC** | State-machine correctness = partial-failure risk. A bad transition corrupts live session state for 4–8 users. |
| **New phase with new ephemeral state** | Add a phase (e.g., `speed_dating`) requiring new state fields + cleanup logic + advance guard | **HRC** | New state fields + transitions = state-machine change. |
| **Phase-specific game logic (existing state)** | New dice challenge template, new auction lot category, tweak lie-detective reveal rules within current schema | **DM** | Domain logic inside an existing state machine. Cross-workspace (server + mini-program), but bounded failure domain. |
| **AI copy / prompt changes** | New XiaoYue comment tone, new warmup topic flavor, tweak prompt version | **Direct** | Presentation-only enrichment. Follows existing `llm-runtime-safety-and-integration` patterns. |
| **REST route additions (passthrough)** | Add `GET /api/social-icebreaker/:id/stats` reading existing state | **Direct** | No new state machine or auth boundary. |
| **UI / rendering changes** | New phase view in `phaseViews.tsx`, motion design, responsive layout | **DM** or **Direct** | Cross-platform parity check if both surfaces involved; otherwise bounded UI change. |
| **WebSocket broadcast changes** | Modify real-time event shape, heartbeat logic, room broadcast pattern | **HRC** | Real-time infrastructure touches reliability and scalability pillars. |

---

## Concrete scenarios

| Scenario | Lane | Why |
|---|---|---|
| "Add a `speed_dating` phase between `warmup` and `micro_challenge` with a 3-minute timer" | **HRC** | New state field (`speedDatingReadyUserIds`) + advance guard + cleanup + timer logic |
| "Change lie-detective vote reveal to show archetype icons instead of text" | **DM** | UX-heavy, cross-workspace, no state machine change |
| "Add a new auction lot type for 'virtual gift'" | **DM** | Domain logic inside existing `auctionLots` state |
| "Tweak XiaoYue comment tone to be more playful" | **Direct** | Copy change, existing AI boundary |
| "Fix `advance` route to handle 410 SESSION_EXPIRED correctly when rejoining" | **HRC** | State-machine edge case, host/player authority |
| "Add loading skeleton to mini-program icebreaker screen" | **Direct** | Bounded UI change |
| "Change WebSocket event shape for phase advance broadcast" | **HRC** | Real-time infra, affects all connected clients |

---

## Key files by layer

| Layer | Server files | Client files |
|---|---|---|
| State machine | `apps/server/src/routes/socialIcebreaker.ts` (advance route, guards, cleanup) | `apps/mini-program/src/pages/icebreaker-session/icebreakerSessionModel.ts` |
| Game logic (existing state) | `apps/server/src/routes/socialIcebreaker.ts` (phase-specific POST handlers) | `apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx` |
| AI copy | `apps/server/src/ai/socialModelRouter.ts`, `apps/server/src/ai/workers/*` | — |
| UI / rendering | — | `apps/mini-program/src/pages/icebreaker-session/index.tsx`, `phaseViews.tsx` |
| WebSocket | `apps/server/src/wsService.ts`, `apps/server/src/routes/socialIcebreaker.ts` (broadcast) | `apps/mini-program/src/pages/icebreaker-session/index.tsx` (socket listeners) |

---

## When in doubt

If you are unsure which layer a change touches, run the **4-gate heuristic** from [`lane-selection-governance`](../../.github/skills/lane-selection-governance/SKILL.md). If still unsure after Gate 1, default to **DM** — never default to Direct for icebreaker changes.
