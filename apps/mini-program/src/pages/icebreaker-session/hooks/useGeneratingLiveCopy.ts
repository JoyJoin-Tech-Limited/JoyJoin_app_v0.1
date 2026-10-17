import { useEffect, useState } from 'react'
import type { SocialContentStatus } from '@shared/socialIcebreaker'
import {
  GENERATING_COPY_STAGE_DELAY_MS,
  getGeneratingLiveCopy,
  isContentGenerating,
  type GenerativeContentPhase,
  type GeneratingCopyStage,
} from '../viewModels/generatingLiveCopy'

/**
 * Wave 3 (icebreaker-uiux-wave3, contract AC-07): staged live generating
 * copy for one AI-generative phase. Returns `null` unless the phase's
 * `*ContentStatus` is positively `'generating'` — field absent (flag off /
 * legacy session) → null → the caller renders its pre-Wave-3 static waiting
 * copy unchanged. The 4s stage flip mirrors WarmupCardSlot's staged
 * generating copy so a long generation reads as alive, not hung; the stage
 * resets the moment the status leaves `'generating'`.
 */
export function useGeneratingLiveCopy(
  phase: GenerativeContentPhase,
  status: SocialContentStatus | undefined,
): string | null {
  const generating = isContentGenerating(status)
  const [stage, setStage] = useState<GeneratingCopyStage>(0)

  useEffect(() => {
    if (!generating) {
      setStage(0)
      return
    }
    const timer = setTimeout(() => setStage(1), GENERATING_COPY_STAGE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [generating])

  if (!generating) return null
  return getGeneratingLiveCopy(phase, stage)
}
