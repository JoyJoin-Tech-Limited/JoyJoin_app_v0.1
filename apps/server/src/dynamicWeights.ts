/**
 * @deprecated Legacy gradient-descent matching-weight experiment.
 *
 * This module is intentionally kept as a non-runnable tombstone so the old path
 * stays clearly documented without exposing callable runtime exports.
 *
 * Preferred adaptive-weight path:
 *   - `apps/server/src/matchingWeightsService.ts`
 *   - Thompson Sampling backed by persisted matching-weight history/config
 *
 * Do not add runtime callers here. If adaptive matching weights are needed,
 * extend `matchingWeightsService.ts` instead.
 */

export {};
