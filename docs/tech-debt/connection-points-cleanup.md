# Cleanup Ticket: Connection Points Legacy Field Removal

**Ticket ID:** TECH-DEBT-001  
**Created:** 2026-04-29  
**Deadline:** 2 sprints from now (target: 2026-05-13)  
**Tags:** `tech-debt`, `breaking-change-pending`

## Background

As part of the connection points mini-program integration (sprint `connection-points-mini-program`), we added a new field `connectionPointsWithRarity` to `PairExplanation` while preserving the legacy `connectionPoints: string[]` for backward compatibility.

## Cleanup Tasks

- [ ] Remove `connectionPoints: string[]` from `PairExplanation` interface in `packages/shared/src/types/groupAnalysis.ts`
- [ ] Remove `connectionPoints: string[]` from `MatchExplanationContract` in `packages/shared/src/groupAnalysis.ts`
- [ ] Remove all client-side fallbacks to `connectionPoints` in mini-program, web, and admin
- [ ] Remove web compat shim `packages/shared/src/ui/connectionPointCompat.ts` (if no longer needed)
- [ ] Delete both `attendeeAnalytics.ts` copies entirely (user-client + admin-client) if no remaining exports are used
- [ ] Update all server code to only produce `connectionPointsWithRarity`
- [ ] Update tests to remove legacy field assertions
- [ ] Update API documentation

## Acceptance Criteria

- [ ] `PairExplanation` contains only `connectionPointsWithRarity`, no `connectionPoints`
- [ ] All clients consume only `connectionPointsWithRarity`
- [ ] No references to legacy `string[]` connection points anywhere in the repo
- [ ] Server tests pass
- [ ] All client builds pass
- [ ] Guardrails pass

## Risks

- Breaking change for any external API consumers (unlikely — internal API only)
- Cached pair explanations in DB will have old format; may need migration or regeneration
