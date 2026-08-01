import Taro from '@tarojs/taro'

export type FlowStorageKind = 'joyjoin-intro' | 'blind-box-lifecycle'

const FLOW_STORAGE_VERSION = 2
const FLOW_STORAGE_PREFIX = 'joyjoin_flow_seen'
const FLOW_PENDING_PREFIX = 'joyjoin_flow_pending'

function normalizeUserScope(userId?: string | null): string {
  return userId?.trim() || 'anonymous'
}

export function getFlowStorageKey(kind: FlowStorageKind, userId?: string | null): string {
  return `${FLOW_STORAGE_PREFIX}:v${FLOW_STORAGE_VERSION}:${kind}:${normalizeUserScope(userId)}`
}

export function getPendingFlowStorageKey(kind: FlowStorageKind, userId?: string | null): string {
  return `${FLOW_PENDING_PREFIX}:v${FLOW_STORAGE_VERSION}:${kind}:${normalizeUserScope(userId)}`
}

export function hasSeenFlow(kind: FlowStorageKind, userId?: string | null): boolean {
  try {
    return Taro.getStorageSync(getFlowStorageKey(kind, userId)) === true
  } catch {
    return false
  }
}

export function markFlowSeen(kind: FlowStorageKind, userId?: string | null): void {
  try {
    Taro.setStorageSync(getFlowStorageKey(kind, userId), true)
  } catch {
    // A storage failure must never block the user's primary journey.
  }
}

export function shouldShowFlow(kind: FlowStorageKind, userId?: string | null): boolean {
  return !hasSeenFlow(kind, userId)
}

export function hasPendingFlow(kind: FlowStorageKind, userId?: string | null): boolean {
  try {
    return Taro.getStorageSync(getPendingFlowStorageKey(kind, userId)) === true
  } catch {
    return false
  }
}

export function markFlowPending(kind: FlowStorageKind, userId?: string | null): void {
  try {
    Taro.setStorageSync(getPendingFlowStorageKey(kind, userId), true)
  } catch {
    // A handoff failure falls back to the source page's in-memory render.
  }
}

export function clearPendingFlow(kind: FlowStorageKind, userId?: string | null): void {
  try {
    Taro.removeStorageSync(getPendingFlowStorageKey(kind, userId))
  } catch {
    // A cleanup failure must never block navigation.
  }
}

export function resetFlowSeen(kind: FlowStorageKind, userId?: string | null): void {
  try {
    Taro.removeStorageSync(getFlowStorageKey(kind, userId))
  } catch {
    // Development/demo recovery must not affect the primary journey.
  }
}
