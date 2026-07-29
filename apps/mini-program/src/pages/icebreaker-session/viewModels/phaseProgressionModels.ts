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

export function canShowAuctionBidControls(input: {
  isHost: boolean
  isSingleTest: boolean
}): boolean {
  return !input.isHost || input.isSingleTest
}
