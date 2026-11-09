import {
  ACKNOWLEDGMENT_BEAT_ASSIGNMENT_SALT,
  ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID,
} from '@shared/copy/acknowledgmentBeat'
import type { SocialSessionPoolGroupContext } from '@shared/socialIcebreaker'

export {
  ACKNOWLEDGMENT_BEAT_CUE,
  ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID,
} from '@shared/copy/acknowledgmentBeat'

export const ACKNOWLEDGMENT_EXPOSURE_DELAY_MS = 550

export type AcknowledgmentBeatVariant = 'control' | 'treatment'

export interface AcknowledgmentBeatAssignmentInput {
  enabled: boolean
  icebreakerSessionId?: string
  /** Server-confirmed real pool-group context; absent for all other session kinds. */
  poolGroupContext?: SocialSessionPoolGroupContext | null
  isTestMode: boolean
  runBots: boolean
}

export interface AcknowledgmentBeatExperiment {
  eligible: boolean
  experimentId: string
  variant: AcknowledgmentBeatVariant | null
  icebreakerSessionId?: string
  poolGroupContext?: SocialSessionPoolGroupContext
}

/** FNV-1a: stable across devices, with no random or time-based component. */
function hashAssignmentKey(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * One deterministic variant per real pool-group table. A polymorphic route id
 * alone is never sufficient: the server must confirm both the group and its
 * non-test pool. Test/bot/blind-box/legacy/unknown sessions are ineligible.
 */
export function assignAcknowledgmentBeat(
  input: AcknowledgmentBeatAssignmentInput,
): AcknowledgmentBeatExperiment {
  const icebreakerSessionId = input.icebreakerSessionId?.trim() ?? ''
  const poolGroupContext = input.poolGroupContext ?? null
  const hasConfirmedRealPoolGroup = Boolean(
    poolGroupContext &&
      poolGroupContext.eventPoolGroupId === icebreakerSessionId &&
      poolGroupContext.poolId.trim().length > 0,
  )
  const eligible = Boolean(
    input.enabled &&
      !input.isTestMode &&
      !input.runBots &&
      icebreakerSessionId.length > 0 &&
      hasConfirmedRealPoolGroup,
  )
  if (!eligible || !poolGroupContext) {
    return { eligible: false, experimentId: ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID, variant: null }
  }
  const hash = hashAssignmentKey(`${ACKNOWLEDGMENT_BEAT_ASSIGNMENT_SALT}:${icebreakerSessionId}`)
  return {
    eligible: true,
    experimentId: ACKNOWLEDGMENT_BEAT_EXPERIMENT_ID,
    variant: hash % 2 === 0 ? 'control' : 'treatment',
    icebreakerSessionId,
    poolGroupContext,
  }
}

export type AcknowledgmentBeatMetadata = Record<string, unknown> & {
  experimentId: string
  variant: AcknowledgmentBeatVariant
  eventPoolGroupId: string
  poolId: string
}

export function buildAcknowledgmentBeatMetadata(
  experiment: AcknowledgmentBeatExperiment | null | undefined,
): AcknowledgmentBeatMetadata | null {
  const poolGroupContext = experiment?.poolGroupContext
  if (!experiment?.eligible || !experiment.variant || !poolGroupContext) return null
  if (poolGroupContext.eventPoolGroupId !== experiment.icebreakerSessionId) return null
  return {
    experimentId: experiment.experimentId,
    variant: experiment.variant,
    eventPoolGroupId: poolGroupContext.eventPoolGroupId,
    poolId: poolGroupContext.poolId,
  }
}

export function shouldShowAcknowledgmentBeat(input: {
  experiment?: AcknowledgmentBeatExperiment | null
  state: string
  isFlipped: boolean
  showPermissionLine: boolean
  showDeepPrompt: boolean
}): boolean {
  return Boolean(
    input.experiment?.eligible &&
      input.experiment.variant === 'treatment' &&
      input.state === 'topic_card' &&
      input.isFlipped &&
      !input.showPermissionLine &&
      !input.showDeepPrompt,
  )
}
