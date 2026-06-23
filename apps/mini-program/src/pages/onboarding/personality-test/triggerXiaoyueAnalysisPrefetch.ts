import { apiRequest } from '../../../lib/api/api'
import { logError, logInfo } from '../../../lib/utils/logger'
import type {
  AnonymousAssessmentResult,
  AnonymousAssessmentTopMatch,
} from '../../../lib/auth/anonymousOnboarding'

/**
 * Fire-and-forget prefetch of the Xiaoyue AI analysis. Triggered when
 * the test completes — the slot animation's 3-5s duration gives the
 * LLM enough time to populate the cache so the result page lands
 * on a populated analysis instead of a 400ms skeleton.
 *
 * The server endpoint at /api/xiaoyue/prefetch short-circuits with
 * `{ prefetched: false, reason: 'Not ready yet' }` when `confidence < 0.7`.
 * It is safe to call speculatively; failure is logged and swallowed.
 */
export function triggerXiaoyueAnalysisPrefetch(
  result: AnonymousAssessmentResult,
  topMatches: AnonymousAssessmentTopMatch[],
): void {
  const archetype = result.primaryArchetype
  if (!archetype) return

  const traitScores = result.traitScores ?? {}
  const confidence =
    result.archetypeConfidence ??
    topMatches[0]?.confidence ??
    0

  void apiRequest<{ prefetched: boolean; reason?: string }>({
    path: '/api/xiaoyue/prefetch',
    method: 'POST',
    data: {
      archetype,
      secondaryArchetype: result.secondaryArchetype ?? null,
      topArchetypes: topMatches,
      traitScores: {
        affinity: traitScores.A ?? traitScores.affinity ?? 0.5,
        openness: traitScores.O ?? traitScores.openness ?? 0.5,
        conscientiousness: traitScores.C ?? traitScores.conscientiousness ?? 0.5,
        emotionalStability: traitScores.E ?? traitScores.emotionalStability ?? 0.5,
        extraversion: traitScores.X ?? traitScores.extraversion ?? 0.5,
        positivity: traitScores.P ?? traitScores.positivity ?? 0.5,
      },
      confidence,
    },
  })
    .then((res) => {
      logInfo('[PersonalityTest] Xiaoyue prefetch', {
        archetype,
        prefetched: res.prefetched,
        reason: res.reason,
      })
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logError('[PersonalityTest] Xiaoyue prefetch failed', { message })
    })
}
