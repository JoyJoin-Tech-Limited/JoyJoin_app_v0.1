---
name: lie-detective-icebreaker
description: >-
  Social phase `lie_detective`: server secrecy for `isLie`, vote/reveal state machine, REST routes,
  and `generateLieDetectiveStatements` (`social-lie-detective-v1`). Triggers: lie_detective,
  lie detective secrecy, two truths one lie, /lie-detective/generate, isLie, vote reveal.
---

# lie-detective-icebreaker

## Hard constraints

- **`isLie` is server-only**: client-visible `LieDetectivePlayer` statements never include `isLie`; truths live in DB (`socialIcebreakerStore` lie-truth table), not `stateJson` redaction comments in [`apps/server/src/routes/socialIcebreaker.ts`](../../../apps/server/src/routes/socialIcebreaker.ts).
- **Wrong-phase guards**: statement generation, votes, and `next-player` only in `lie_detective`; host-only for `next-player`.
- **Advance**: cannot leave phase until every roster player has generated statements, every turn revealed, and `lieDetectiveCompletedUserIds` covers the roster (see advance handler).

## When to use this skill

- Implementing the `lie_detective` social icebreaker phase (Two Truths and a Lie)
- Ensuring `isLie` secrecy is maintained server-side and never leaked to clients
- Adding vote/reveal state machine logic or host-only `next-player` controls
- Reviewing a PR that touches `LieDetectivePlayer` types or `socialIcebreakerStore` truth tables
- Debugging 400 errors, ignored votes, or missing recap lie highlights

## References

| File | Purpose |
| --- | --- |
| [references/secrecy-and-api.md](references/secrecy-and-api.md) | Payload boundaries + route list + AI trace feature name. |

## Cross-links

- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md)
- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md)
- [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md)
- [`testing-and-regression-guardrails`](../testing-and-regression-guardrails/SKILL.md)

## Quick examples

- **Review a PR that exposes `isLie` in JSON to clients** → reject; keep server-only table + `buildClientState` contract.
- **Add a new vote edge case** → extend route tests in `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` and verify recap medals still use `getAllSessionLieTruths`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 400 “Not in lie_detective phase” | Client phase desync vs `state.currentPhase`; refetch session. |
| Votes ignored | `votes` only apply to **active** `currentLieDetectivePlayerIndex` target. |
| Recap missing lie highlights | `GET .../recap` builds `lieDetectiveHighlights` from votes + `getAllSessionLieTruths` — ensure votes persisted before recap. |

## Review checklist

- [ ] No `isLie` in client session payloads or shared types exposed to non-owners.
- [ ] Host-only actions enforced with 403 + clear error copy.
- [ ] `logAITrace` / `social-lie-detective-v1` unchanged unless prompt/schema intentionally versioned.
