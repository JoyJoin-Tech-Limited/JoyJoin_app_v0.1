import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useUnload } from '../../../../../hooks/useUnload'
import { apiRequest } from '../../../../../lib/api/api'
import { logInfo, logWarn } from '../../../../../lib/utils/logger'
import type { AnonymousAssessmentSessionSnapshot } from '../../../../../lib/auth/anonymousOnboarding'
import type { FlowStage, ResolvedResultState } from '../resultHelpers'

export interface XiaoyueAnalysisResult {
  headline: string
  analysis: string
  socialRole: string
  bestScene: string
  microAction: string
  shareLine: string
  stateLabel: string
  whyThisFits: string
  blendLine: string
  expressionTags: string[]
  shareVariants: {
    selfIntro: string
    friendCallout: string
    socialInvite: string
  }
  cached: boolean
}

interface UseResultsXiaoyueAnalysisParams {
  flowStage: FlowStage
  resultStateRef: MutableRefObject<ResolvedResultState | null>
  sessionSnapshot: AnonymousAssessmentSessionSnapshot | null
}

/**
 * Xiaoyue AI analysis fetch for the result stage (extracted from index.tsx,
 * 2026-08-18 split). Fires once when the flow reaches 'result', after an 80ms
 * render buffer; fails silently to static copy.
 */
export function useResultsXiaoyueAnalysis({
  flowStage,
  resultStateRef,
  sessionSnapshot,
}: UseResultsXiaoyueAnalysisParams) {
  const [xiaoyueAnalysis, setXiaoyueAnalysis] = useState<XiaoyueAnalysisResult | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const mountedRef = useRef(false)
  const analysisRequestedRef = useRef(false)

  useUnload(() => {
    mountedRef.current = false
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchXiaoyueAnalysis = useCallback(async () => {
    const result = resultStateRef.current?.result ?? sessionSnapshot?.result
    if (!result?.primaryArchetype) return

    const traitScores = result.traitScores ?? {}
    const topMatches = resultStateRef.current?.topMatches ?? sessionSnapshot?.topArchetypes ?? []

    setIsLoadingAnalysis(true)
    try {
      const response = await apiRequest<XiaoyueAnalysisResult>({
        path: '/api/xiaoyue/analysis',
        method: 'POST',
        data: {
          archetype: result.primaryArchetype,
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
          confidence: result.archetypeConfidence ?? 1,
        },
      })

      if (mountedRef.current) {
        setXiaoyueAnalysis(response)
        logInfo('[PersonalityResults] Xiaoyue analysis loaded', {
          headline: response.headline,
          cached: response.cached,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logWarn('[PersonalityResults] Xiaoyue analysis failed', { message })
      // Silently fail — UI gracefully falls back to static copy
    } finally {
      if (mountedRef.current) {
        setIsLoadingAnalysis(false)
      }
    }
  }, [resultStateRef, sessionSnapshot])

  useEffect(() => {
    if (flowStage !== 'result') return
    if (analysisRequestedRef.current) return
    analysisRequestedRef.current = true

    // P0-3: 80ms render buffer (was 400ms). The test page fires a
    // fire-and-forget prefetch at completion so this call mostly
    // hits the server cache. 80ms is the minimum to let the result
    // page settle before the analysis fetch starts.
    const timer = setTimeout(() => {
      void fetchXiaoyueAnalysis()
    }, 80)
    return () => clearTimeout(timer)
  }, [flowStage, fetchXiaoyueAnalysis])

  return { xiaoyueAnalysis, isLoadingAnalysis }
}
