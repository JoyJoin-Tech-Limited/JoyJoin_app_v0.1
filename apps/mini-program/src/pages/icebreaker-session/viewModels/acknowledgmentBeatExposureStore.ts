import Taro from '@tarojs/taro'

const ASSIGNMENT_PREFIX = 'jj_ack_beat_assignment_v1'
const VIEW_PREFIX = 'jj_ack_beat_view_v1'

export function buildAcknowledgmentAssignmentStorageKey(icebreakerSessionId: string): string {
  return `${ASSIGNMENT_PREFIX}:${icebreakerSessionId}`
}

export function buildAcknowledgmentViewStorageKey(
  icebreakerSessionId: string,
  topicSetRevision: number,
  topicId: string,
): string {
  return `${VIEW_PREFIX}:${icebreakerSessionId}:${topicSetRevision}:${topicId}`
}

/**
 * Remount-safe per-device claim. Storage failures fail open to the caller's
 * component-local ref, never to a blocked session or a user-facing error.
 */
export function claimAcknowledgmentBeatExposure(storageKey: string): boolean {
  try {
    if (Taro.getStorageSync(storageKey) === true) return false
    Taro.setStorageSync(storageKey, true)
    return true
  } catch {
    return true
  }
}
