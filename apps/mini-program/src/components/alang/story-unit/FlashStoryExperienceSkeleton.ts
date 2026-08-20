export const FLASH_STORY_EXPERIENCE_SKELETON_VERSION = 'atuan-first-act-parity-v1'
export const FLASH_STORY_SHARED_SETTLEMENT_KIND = 'shared-fragment-settlement'

export type FlashStoryExperienceSkeletonStep =
  | 'opening'
  | 'scene_highlights'
  | 'inner_object'
  | 'followup'
  | 'game'
  | 'ready_to_settle'

export const FLASH_STORY_EXPERIENCE_SKELETON_STEPS: readonly FlashStoryExperienceSkeletonStep[] = [
  'opening',
  'scene_highlights',
  'inner_object',
  'followup',
  'game',
  'ready_to_settle',
]

type AtuanFirstActLikeProgress = {
  arrivalReplyId?: string | null
  highlightOrder?: readonly unknown[]
  followupId?: string | null
  benchReached?: boolean
}

type AtuanLaterActLikeProgress = {
  arrivalReplyId?: string | null
  highlightsComplete: boolean
  followupId?: string | null
  gameStarted?: boolean
  gameComplete: boolean
}

export type FirstActTemplateLikeStage =
  | 'scene'
  | 'reveal'
  | 'event'
  | 'choice'
  | 'object'
  | 'followup'
  | 'conversation'
  | 'success'

export type LaterActLikeStage =
  | 'approach'
  | 'explore'
  | 'object'
  | 'followup'
  | 'game'
  | 'ending'

export function resolveAtuanFirstActSkeletonStep(progress: AtuanFirstActLikeProgress): FlashStoryExperienceSkeletonStep {
  if (progress.benchReached) return 'ready_to_settle'
  if (progress.followupId) return 'game'
  if ((progress.highlightOrder?.length ?? 0) > 0) return 'scene_highlights'
  if (progress.arrivalReplyId) return 'scene_highlights'
  return 'opening'
}

export function resolveFirstActTemplateSkeletonStep(stage: FirstActTemplateLikeStage): FlashStoryExperienceSkeletonStep {
  if (stage === 'success') return 'ready_to_settle'
  if (stage === 'conversation') return 'game'
  if (stage === 'followup') return 'followup'
  if (stage === 'object') return 'inner_object'
  if (stage === 'scene' || stage === 'reveal' || stage === 'event') return 'scene_highlights'
  return 'opening'
}

export function resolveAtuanLaterActSkeletonStep(progress: AtuanLaterActLikeProgress): FlashStoryExperienceSkeletonStep {
  if (progress.gameComplete) return 'ready_to_settle'
  if (progress.gameStarted) return 'game'
  if (progress.followupId) return 'game'
  if (progress.highlightsComplete) return 'followup'
  if (progress.arrivalReplyId) return 'scene_highlights'
  return 'opening'
}

export function resolveLaterActSkeletonStep(stage: LaterActLikeStage): FlashStoryExperienceSkeletonStep {
  if (stage === 'ending') return 'ready_to_settle'
  if (stage === 'game') return 'game'
  if (stage === 'followup') return 'followup'
  if (stage === 'object') return 'inner_object'
  if (stage === 'explore') return 'scene_highlights'
  return 'opening'
}
