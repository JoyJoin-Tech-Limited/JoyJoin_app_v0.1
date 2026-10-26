import type { SocialSessionState } from '@shared/socialIcebreaker'
import { getXiaoyueAgentAskCopy } from '@shared/copy/icebreakerSession'

/**
 * Mini-program-only adapter for the M1 agent payload.
 *
 * The shared DTO is landing in a parallel workstream. Keeping the runtime
 * boundary narrow and validating unknown data here lets legacy sessions (with
 * no xiaoyueAgent field) follow the byte-identical pre-M1 path, while avoiding
 * a compile-time dependency on DTOs that may not exist yet.
 */

export type XiaoyueAgentAskKind = 'warmup_rotate_topics'
export type XiaoyueAgentReason = 'phase_overrun' | 'topic_stall' | 'pulse_low'
export type XiaoyueAgentAskStatus =
  | 'pending'
  | 'accepted'
  | 'ignored'
  | 'expired'
  | 'closed_session'
  | 'action_failed_dismissed'
  | 'succeeded'
  | 'failed'
  | 'unknown'

export type XiaoyueAgentDecision =
  | 'accepted'
  | 'ignored'
  | 'closed_session'
  | 'action_failed_dismissed'

export interface XiaoyueAgentAIGCMeta {
  aigc?: {
    aiGenerated?: boolean
  }
  fallbackUsed?: boolean
}

export interface XiaoyueAgentActionSnapshot {
  idempotencyKey: string
  askId?: string
  status?: 'accepted' | 'succeeded' | 'failed' | 'unknown'
  startedAt?: number
  finishedAt?: number
  baseTopicSetRevision?: number
  resultRevision?: number
  errorCode?: string
  fallbackUsed?: boolean
}

export interface XiaoyueAgentAskSnapshot {
  id: string
  kind: XiaoyueAgentAskKind
  phase: 'warmup'
  reason: XiaoyueAgentReason
  createdAt: number
  baseTopicSetRevision: number
  status: XiaoyueAgentAskStatus
  meta?: XiaoyueAgentAIGCMeta
  action?: XiaoyueAgentActionSnapshot
}

export interface XiaoyueAgentSnapshot {
  ask?: XiaoyueAgentAskSnapshot
  proactiveDisabled: boolean
  lastAction?: XiaoyueAgentActionSnapshot
}

export interface XiaoyueAgentDecisionResponse {
  status: 'succeeded' | 'failed' | 'unknown' | 'decision_recorded'
  topicSetRevision?: number
  state?: SocialSessionState
}

export type XiaoyueAgentAskStage =
  | 'pending'
  | 'executing'
  | 'success'
  | 'failed'
  | 'unknown'
  | 'offline'

export interface XiaoyueAgentAskViewModel {
  askId: string
  kind: XiaoyueAgentAskKind
  reason: XiaoyueAgentReason
  stage: XiaoyueAgentAskStage
  kicker: string
  question: string
  hint: string
  primaryLabel: string
  primaryDisabled: boolean
  dismissDecision: 'ignored' | 'action_failed_dismissed'
  busy: boolean
  exiting: boolean
  animateIn: boolean
  aiGenerated: boolean
}

const DEFAULT_ASK_COPY = getXiaoyueAgentAskCopy('default')

export const XIAOYUE_AGENT_ASK_COPY = {
  kicker: DEFAULT_ASK_COPY.kicker,
  hint: DEFAULT_ASK_COPY.hint,
  cta: DEFAULT_ASK_COPY.cta,
  executing: '正在换话题…',
  executingHint: '正在同步，当前话题仍可继续',
  slowHint: '网络有点慢，当前话题不受影响',
  success: '新话题已就位',
  failed: '这次还没换上，当前话题保留',
  unknown: '还没确认换新，当前话题保留',
  offline: '连接恢复后再换，当前话题保留',
  ignore: '先不用',
  close: '本场不再提示',
  retry: '再试一次',
  resync: '重新同步',
  dismissFailure: '先继续',
  closedToast: '已关闭本场主动建议',
} as const

const QUESTION_BY_REASON: Record<XiaoyueAgentReason, string> = {
  phase_overrun: getXiaoyueAgentAskCopy('phase_overrun').question,
  topic_stall: getXiaoyueAgentAskCopy('topic_stall').question,
  pulse_low: getXiaoyueAgentAskCopy('pulse_low').question,
}

const DEFAULT_QUESTION = DEFAULT_ASK_COPY.question

const ASK_STATUSES = new Set<XiaoyueAgentAskStatus>([
  'pending',
  'accepted',
  'ignored',
  'expired',
  'closed_session',
  'action_failed_dismissed',
  'succeeded',
  'failed',
  'unknown',
])

const ASK_REASONS = new Set<XiaoyueAgentReason>(['phase_overrun', 'topic_stall', 'pulse_low'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readAction(value: unknown): XiaoyueAgentActionSnapshot | undefined {
  if (!isRecord(value)) return undefined
  const idempotencyKey = readString(value.idempotencyKey)
  if (!idempotencyKey) return undefined
  const status = ['accepted', 'succeeded', 'failed', 'unknown'].includes(String(value.status))
    ? (value.status as XiaoyueAgentActionSnapshot['status'])
    : undefined
  return {
    idempotencyKey,
    askId: readString(value.askId),
    status,
    startedAt: readFiniteNumber(value.startedAt),
    finishedAt: readFiniteNumber(value.finishedAt),
    baseTopicSetRevision: readFiniteNumber(value.baseTopicSetRevision),
    resultRevision: readFiniteNumber(value.resultRevision),
    errorCode: readString(value.errorCode),
    fallbackUsed: typeof value.fallbackUsed === 'boolean' ? value.fallbackUsed : undefined,
  }
}

function readAsk(value: unknown): XiaoyueAgentAskSnapshot | undefined {
  if (!isRecord(value)) return undefined
  const id = readString(value.id)
  const createdAt = readFiniteNumber(value.createdAt)
  const baseTopicSetRevision = readFiniteNumber(value.baseTopicSetRevision)
  const status = String(value.status) as XiaoyueAgentAskStatus
  const reason = String(value.reason) as XiaoyueAgentReason
  if (
    !id ||
    value.kind !== 'warmup_rotate_topics' ||
    value.phase !== 'warmup' ||
    createdAt === undefined ||
    baseTopicSetRevision === undefined ||
    !ASK_STATUSES.has(status) ||
    !ASK_REASONS.has(reason)
  ) {
    return undefined
  }

  const rawMeta = isRecord(value.meta) ? value.meta : undefined
  const rawAigc = rawMeta && isRecord(rawMeta.aigc) ? rawMeta.aigc : undefined
  const meta: XiaoyueAgentAIGCMeta | undefined = rawMeta
    ? {
        aigc: rawAigc
          ? { aiGenerated: rawAigc.aiGenerated === true }
          : undefined,
        fallbackUsed: typeof rawMeta.fallbackUsed === 'boolean' ? rawMeta.fallbackUsed : undefined,
      }
    : undefined

  return {
    id,
    kind: 'warmup_rotate_topics',
    phase: 'warmup',
    reason,
    createdAt,
    baseTopicSetRevision,
    status,
    meta,
    action: readAction(value.action),
  }
}

/** Read host-only agent state without trusting the transport payload. */
export function readXiaoyueAgentSnapshot(
  session: SocialSessionState | null | undefined,
): XiaoyueAgentSnapshot | null {
  if (!session || !isRecord(session)) return null
  const rawAgent = (session as unknown as Record<string, unknown>).xiaoyueAgent
  if (!isRecord(rawAgent)) return null
  const rawPolicy = isRecord(rawAgent.policy) ? rawAgent.policy : undefined
  return {
    ask: readAsk(rawAgent.ask),
    proactiveDisabled: rawPolicy?.proactiveDisabled === true,
    lastAction: readAction(rawAgent.lastAction),
  }
}

/** Revision fields are intentionally readable even when shared types lag. */
export function getWarmupTopicSetRevision(
  session: SocialSessionState | null | undefined,
): number | undefined {
  if (!session || !isRecord(session)) return undefined
  return readFiniteNumber((session as unknown as Record<string, unknown>).warmupTopicSetRevision)
}

export function isMonotonicTopicRevisionIncrease(
  previousRevision: number | undefined,
  nextRevision: number | undefined,
): boolean {
  return (
    previousRevision !== undefined &&
    nextRevision !== undefined &&
    Number.isSafeInteger(nextRevision) &&
    nextRevision > previousRevision
  )
}

export function getXiaoyueAgentQuestion(reason: XiaoyueAgentReason): string {
  return QUESTION_BY_REASON[reason] ?? DEFAULT_QUESTION
}

export function buildXiaoyueAgentAskViewModel(input: {
  ask: XiaoyueAgentAskSnapshot
  stage: Exclude<XiaoyueAgentAskStage, 'offline'>
  slow: boolean
  offline: boolean
  exiting?: boolean
  animateIn?: boolean
}): XiaoyueAgentAskViewModel {
  const { ask, slow, offline } = input
  const stage: XiaoyueAgentAskStage = offline ? 'offline' : input.stage
  let hint: string = XIAOYUE_AGENT_ASK_COPY.hint
  let primaryLabel: string = XIAOYUE_AGENT_ASK_COPY.cta
  let primaryDisabled = false
  let busy = false

  switch (stage) {
    case 'executing':
      hint = slow ? XIAOYUE_AGENT_ASK_COPY.slowHint : XIAOYUE_AGENT_ASK_COPY.executingHint
      primaryLabel = XIAOYUE_AGENT_ASK_COPY.executing
      primaryDisabled = true
      busy = true
      break
    case 'success':
      hint = XIAOYUE_AGENT_ASK_COPY.success
      primaryLabel = XIAOYUE_AGENT_ASK_COPY.success
      primaryDisabled = true
      break
    case 'failed':
      hint = XIAOYUE_AGENT_ASK_COPY.failed
      primaryLabel = XIAOYUE_AGENT_ASK_COPY.retry
      break
    case 'unknown':
      hint = XIAOYUE_AGENT_ASK_COPY.unknown
      primaryLabel = XIAOYUE_AGENT_ASK_COPY.resync
      break
    case 'offline':
      hint = XIAOYUE_AGENT_ASK_COPY.offline
      primaryDisabled = true
      break
    case 'pending':
    default:
      break
  }

  return {
    askId: ask.id,
    kind: ask.kind,
    reason: ask.reason,
    stage,
    kicker: XIAOYUE_AGENT_ASK_COPY.kicker,
    question: getXiaoyueAgentQuestion(ask.reason),
    hint,
    primaryLabel,
    primaryDisabled,
    dismissDecision:
      input.stage === 'failed' || input.stage === 'unknown' ? 'action_failed_dismissed' : 'ignored',
    busy,
    exiting: input.exiting === true,
    animateIn: input.animateIn !== false,
    aiGenerated: ask.meta?.aigc?.aiGenerated === true,
  }
}

export function getXiaoyueAgentErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined
  const data = isRecord(error.data) ? error.data : undefined
  return readString(data?.code) ?? readString(data?.error) ?? readString(error.code)
}

export function isTerminalAgentError(error: unknown): boolean {
  const code = getXiaoyueAgentErrorCode(error)
  const statusCode = readFiniteNumber(error && isRecord(error) ? error.statusCode : undefined)
  return (
    statusCode === 410 ||
    code === 'SESSION_EXPIRED' ||
    code === 'AGENT_ASK_NOT_FOUND' ||
    code === 'AGENT_ASK_EXPIRED' ||
    code === 'AGENT_PHASE_MISMATCH' ||
    code === 'AGENT_NOT_HOST' ||
    code === 'NOT_HOST'
  )
}
