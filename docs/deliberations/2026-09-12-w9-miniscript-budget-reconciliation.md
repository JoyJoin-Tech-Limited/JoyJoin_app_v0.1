# ADR: Mini-Script Budget Reconciliation (W9.4)

- **Date:** 2026-09-12
- **Status:** Accepted (implemented in Sprint Contract `gm-debrief-w9`)
- **Owner:** Backend Engineer
- **Related:** `docs/deliberations/2026-09-11-feedback-fuel-line.md`, `.git/.orchestration/sprints/sprint-contract.gm-debrief-w9.md`

## Context

`mini_script` (迷你剧本杀, 25 min) is a feature-flagged bonus phase spliced in
immediately before `recap` whenever `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` is on
and the roster has ≥4 players (`runPlanService.appendMiniScriptBonusSegment`).

Before W9 the splice was **purely additive**: the compiled plan already filled
its tier budget (breeze 40 / glow 60 / blaze 90), so adding 25 minutes produced a
plan that overran the booked session length by up to 25 minutes
(P-10d: `runPlanService.ts:20,34-53`). The bonus gate gave players an explicit
accept/pass choice, but the reported `totalMinutes` was dishonest about the
session length.

## Decision

**Reconcile the bonus from the non-core budget; refuse the bonus when there is
no meaningful room.**

`reconcileMiniScriptBudget(plan, playerCount, budgetMinutes)`:

1. Core allocations are fixed: `warmup`, `micro_challenge`, `recap`, plus the
   roster-derived `lie_detective` floor (`deriveLieDetectiveMinutes`) — these are
   never reduced to fund the bonus.
2. Available bonus room =
   `budget − core − lieFloor − (non-core phase count × NON_CORE_FLOOR_MINUTES)`,
   where `NON_CORE_FLOOR_MINUTES = 4`.
3. If room `< MINI_SCRIPT_MIN_MINUTES (12)`, **no bonus is appended**
   (`accepted: false`). A shorter script is not worth the bonus-gate pause.
4. Otherwise the bonus takes `min(25, room)` and the remaining non-core budget is
   redistributed across the other non-core phases (each ≥4 min), proportional to
   nominal duration with largest-remainder rounding.
5. `totalMinutes` is recomputed; `overBudgetMinutes` is surfaced in the plan
   result and a structured `Mini-script budget reconciled` log (observability).

### Consumer wiring

`compileForSession()` normalizes every plan source (rule compiler, template
compiler, static fallback) with `normalizeRunPlanTiming()` and then calls
`appendMiniScriptBonusSegment(..., getBudgetForTier(tier))`. The legacy additive
behaviour remains the default when no budget is passed (back-compat for direct
callers/tests that pre-date W9).

## Worked examples (6-player roster)

| Tier | Budget | Core | `lie_detective` | Bonus | Other non-core | Total |
|------|--------|------|-----------------|-------|----------------|-------|
| breeze | 40 | 16 | 15 | refused (room 9 < 12) | lie only | 40 (unchanged) |
| glow | 60 | 21 | 15 | 24 | distributed | 60 |
| blaze | 90 | 21 | 15 | 25 | 29 | 90 |

The blaze total leaves room for the full 25-minute bonus; glow sizes it down to
the leftover; breeze declines it entirely.

## Consequences

- `totalMinutes` is now trustworthy: the plan never overruns its tier budget when
  a budget is supplied.
- Glow sessions with `mini_script` enabled lose ~24 minutes from
  `personality_dice` / `group_mirror` — expected: the bonus replaces side games
  rather than extending the evening.
- The bonus gate remains the explicit player-facing acceptance step; the
  reconciliation simply keeps the arithmetic honest before the gate fires.
- When the compiled plan is the hardcoded fallback, `normalizeRunPlanTiming`
  still applies the roster-derived `lie_detective` floor and peak decompression,
  so fallback and compiler paths align (Maintainability criterion).

## Alternatives considered

- **Surface total + rely on the bonus gate only (no reconciliation):** rejected —
  the gate is an acceptance UI, not a budgeting mechanism; the session would still
  overrun for players who accept.
- **Drop non-core phases entirely to fit 25 min:** rejected — removing
  `personality_dice`/`group_mirror` from the roster's plan is a larger product
  change than resizing them; floors preserve the phase list.
