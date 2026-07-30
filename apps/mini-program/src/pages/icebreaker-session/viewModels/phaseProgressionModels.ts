export interface GenerationPendingResponse {
  status?: string
  retryAfterMs?: number
}

export function getGenerationRetryDelayMs(
  response: GenerationPendingResponse | null | undefined,
): number | null {
  if (response?.status !== 'generating') return null
  const requestedDelay = Number.isFinite(response.retryAfterMs) ? response.retryAfterMs! : 1200
  return Math.min(Math.max(requestedDelay, 500), 5000)
}

export function resolvePersonalityDiceChooseMode(
  sessionMode: boolean | undefined,
  legacyAuthFeature: boolean | undefined,
): boolean {
  return sessionMode ?? legacyAuthFeature ?? true
}

export function canChoosePersonalityDiceOption(
  readOnly: boolean,
  isChoosing: boolean,
  selectedOptionIndex: number | undefined,
  targetOptionIndex: number,
): boolean {
  return !readOnly && !isChoosing && selectedOptionIndex !== targetOptionIndex
}

export function getPersonalityDiceCountdownSeconds(
  countdownEndsAt: number | undefined,
  now: number,
): number {
  if (!countdownEndsAt) return 0
  return Math.max(0, Math.ceil((countdownEndsAt - now) / 1000))
}

export type AuctionPreviewRole = 'host' | 'guest'

export function resolveAuctionRoleControls(input: {
  isHost: boolean
  isSingleTest: boolean
  previewRole: AuctionPreviewRole
}): { canBid: boolean; canHostControl: boolean } {
  if (!input.isHost) {
    return { canBid: true, canHostControl: false }
  }
  if (!input.isSingleTest) {
    return { canBid: false, canHostControl: true }
  }
  return input.previewRole === 'guest'
    ? { canBid: true, canHostControl: false }
    : { canBid: false, canHostControl: true }
}

interface GroupMirrorAnswerInput {
  userId: string
  displayName: string
  questionId: string
  targetUserId: string
}

interface GroupMirrorParticipantInput {
  userId: string
  displayName?: string
}

export function buildGroupMirrorAnswerRows(input: {
  questionId: string
  answers: GroupMirrorAnswerInput[]
  participants: GroupMirrorParticipantInput[]
}): Array<{
  voterDisplayName: string
  targetDisplayName: string
  targetUserId: string
}> {
  const names = new Map(
    input.participants.map((participant) => [
      participant.userId,
      participant.displayName?.trim() || '匿名成员',
    ]),
  )
  return input.answers
    .filter((answer) => answer.questionId === input.questionId)
    .map((answer) => ({
      voterDisplayName: answer.displayName?.trim() || '匿名成员',
      targetDisplayName: names.get(answer.targetUserId) ?? '匿名成员',
      targetUserId: answer.targetUserId,
    }))
}
