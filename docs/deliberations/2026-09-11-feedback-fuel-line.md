# Feedback Fuel Line — ADR (W4) — 2026-09-11

> Sprint: `sprint_20260911_gm_debrief_w4` (Tier 2, accepted/locked).
> Scope: reconnect real event outcomes to `match_history` / calibration, and
> resolve the bandit keep-or-delete decision (**OD-1**).
> Status: **Accepted** (implements AC-W4.2 + AC-W4.3).

## 1. Problem

Three pieces of the learning pipeline existed but were never connected in production:

| Piece | State before W4 |
|-------|-----------------|
| `POST /api/event-pools/:poolId/group-outcome` | Registered (`routes.ts:25`) and writes `event_group_outcomes`; **zero shipping callers**. |
| `deriveMatchHistoryAndRefreshCalibration` | The only production INSERT path for `match_history`; reachable only from the uncalled route. |
| `updateWeightsAfterFeedback` (Thompson bandit) | Definition + unit test only; **no production caller**. |
| Mini-program feedback page | Posted to `POST /api/events/:eventId/feedback` → `event_feedback` table, which the scoring/calibration path never reads. |

So the "fuel line" — outcome → `match_history` → archetype-pair calibration →
predictive auto-disable — was plumbed but dry. OD-1 asked whether to keep the
Thompson bandit and wire it, or delete it and rely on offline shadow replay.

## 2. Decision 1 (AC-W4.2): canonical outcome wiring — option (a)

**Chosen: (a) the mini-program posts the canonical outcome** from the existing
feedback surface, via the new pure builder
`apps/mini-program/src/pages/event-feedback/groupOutcomePayload.ts`.

- After the legacy `/api/events/:eventId/feedback` POST succeeds, the page
  resolves the caller's matched group from the shared registrations cache
  (`assignedGroupId`, pool events use the pool id as the routed event id) and
  fire-and-forgets `POST /api/event-pools/:poolId/group-outcome`.
- Mapping is call-wiring only — **no new UI, no new visible copy**:
  thermometer (fallback: overall rating) → `atmosphereScore`;
  selected-connection / rating ≥ 4 / positive connection status →
  `wouldMeetAgain`; one radar entry per server-returned member id
  (selected = 5, else neutral 3).
- A submission with every optional field skipped returns `null` and is not
  posted: `wouldMeetAgain` uses OR-semantics at derivation time (one `false`
  poisons the pair), so persisting an empty row would inject a false negative
  into calibration.

**Rejected — option (b) server derives `match_history` from `event_feedback`.**
The legacy table is a different, richer schema whose positive signal
(coalesced atmosphere / `wouldAttendAgain` / connection status) already feeds
`getOutcomeCalibrationSnapshot`. Deriving from it server-side would create a
second write path into `match_history` and silently couple the legacy feedback
semantics to the canonical pair rows. The canonical route already owns
membership checks, content moderation, idempotent upsert, and derivation; reusing
it keeps **one** source of truth for outcomes (Harness: Maintainability).

## 3. Decision 2 (OD-1): keep-and-wire the bandit (dark by default)

**Chosen: keep-and-wire**, not delete.

`MatchingWeightsService.recordOutcomeFeedback` is now called from the canonical
outcome route (fire-and-forget, after the post-commit derivation). It is a
**no-op unless two independent gates are both open**:

1. `isAdaptiveWeightsEnabled()` — the runtime consumption flag
   (`ENABLE_ADAPTIVE_WEIGHTS`), the exact gate `poolMatchingService` reads; and
2. an operator-activated adaptive config (`isAdaptiveConfig(activeConfig)`),
   toggled via `/api/admin/evolution/weights/activation` (audited).

Requiring both is the **env-vs-admin-toggle unification** AC-W4.3 asked for: the
bandit only learns when the live matcher would actually consume the learned
weights, so learning can never diverge from consumption. Default behaviour is
byte-identical to the previous zero-caller state.

Rationale for keep over delete:

- The bandit is already bounded (`MAX_WEIGHT_MOVEMENT_PERCENT`, Thompson
  posterior + clamp) and fully dark-by-default; removing it is reversible cost
  we don't need to pay now.
- Shadow replay (`recordShadowRecommendation`) is already wired from the legacy
  feedback route and is unaffected; keeping the live path dark means shadow
  remains the default observation channel until Phase 3.
- `docs/systems/MAGNETISM_ENGINE.md` §4/§8 still target deleting the Thompson
  bandit in Phase 3 (no counterfactual logs). This ADR keeps that door open:
  deleting later is a one-line removal of the route call + method.

**Rejected — delete now.** It would remove a tested, bounded, dark path before
the Phase-3 offline-replay replacement exists, and would not by itself reconnect
the fuel line (AC-W4.2 is orthogonal).

## 4. Code ↔ decision map

| Decision | Code |
|----------|------|
| AC-W4.2 (a) | `groupOutcomePayload.ts`; `event-feedback/index.tsx` `submitGroupOutcome()` after the legacy POST |
| AC-W4.3 keep-and-wire | `matchingWeightsService.recordOutcomeFeedback` (gated) + call in `routes/domains/eventGroupOutcomes.ts` |
| AC-W4.6 deterministic reads | `.orderBy` on member + outcome reads in `eventGroupOutcomesRepo.ts` / `matchHistoryRepo.ts` |
| Verification | `apps/server/src/__tests__/eventOutcomeFuelLine.test.ts`, `eventGroupOutcomeRoutes.test.ts`, `groupOutcomePayload.test.ts` |

## 5. Reversal path

- **Disable the bandit:** turn off `ENABLE_ADAPTIVE_WEIGHTS` (env) or deactivate
  the adaptive config in the admin evolution console → `recordOutcomeFeedback`
  returns immediately. No deploy required.
- **Revert option (a):** delete the `submitGroupOutcome()` call + builder; the
  legacy feedback flow is untouched. `match_history` derivation from the route
  remains available for a future server-side bridge.
- **Delete the bandit (Phase 3):** remove the `recordOutcomeFeedback` call and
  method; update this ADR.

## 6. Observability / follow-ups

- Calibration sample size continues to surface through the archetype-pair
  feedback stats and `/api/metrics`; auto-disable state through
  predictive-rerank telemetry (`summary.autoDisabled`).
- Follow-up (non-blocking, tracked as W6.6b): record a current-state anchor when
  OD-2 resolves.
