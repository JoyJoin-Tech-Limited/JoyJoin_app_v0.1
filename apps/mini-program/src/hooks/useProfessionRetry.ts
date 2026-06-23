import { useEffect, useRef } from 'react'
import type { AuthUserResponse } from '@shared/api'
import { apiRequest } from '../lib/api/api'
import { logInfo, logWarn } from '../lib/utils/logger'

interface UnderstandProfessionResponse {
  reaction: string
  reactionHint: string
  displayTags: string[]
  classification: {
    category: { id: string; label: string } | null
    segment: { id: string; label: string } | null
    niche: { id: string; label: string } | null
    standardizedOccupationId: string | null
  }
  source: string
  confidence: number
}

export function useProfessionRetry(user: AuthUserResponse | null | undefined) {
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (attemptedRef.current) return
    if (!user) return
    if (!user.features?.smartProfession) return

    const rawInput = user.industryRawInput as string | undefined
    const industryNiche = user.industryNiche as string | undefined

    if (!rawInput || industryNiche) return

    attemptedRef.current = true

    logInfo('[ProfessionRetry] Triggering background classification', {
      rawInput: rawInput.substring(0, 30),
    })

    apiRequest<UnderstandProfessionResponse>({
      path: '/api/inference/understand-profession',
      method: 'POST',
      data: { description: rawInput },
    })
      .then((data) => {
        const classification = data.classification

        return apiRequest({
          path: '/api/profile',
          method: 'PATCH',
          data: {
            standardizedOccupationId: classification.standardizedOccupationId,
            industryCategoryLabel: classification.category?.label ?? undefined,
            industrySegmentLabel: classification.segment?.label ?? undefined,
            industryNicheLabel: classification.niche?.label ?? undefined,
            industryCategory: classification.category?.id ?? undefined,
            industrySegmentNew: classification.segment?.id ?? undefined,
            industryNiche: classification.niche?.id ?? undefined,
            industrySource: data.source,
            industryConfidence: data.confidence,
          },
        })
      })
      .then(() => {
        logInfo('[ProfessionRetry] Background classification successful')
      })
      .catch((err) => {
        logWarn('[ProfessionRetry] Background classification failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }, [user])
}
