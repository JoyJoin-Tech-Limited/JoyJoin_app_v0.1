export interface FlashActGamePlacement {
  cardId: string
  destinationId: string
}

export interface FlashActGameProgress {
  version: 'flash-act-game-v2'
  unitId: string
  phase: 1 | 2 | 3
  mode: string
  status: 'playing' | 'completed'
  placements: FlashActGamePlacement[]
  pending: FlashActGamePlacement | null
  revealedItemIds: string[]
  attemptsByItem: Record<string, number>
}

const isPlacement = (value: unknown): value is FlashActGamePlacement => Boolean(
  value
  && typeof value === 'object'
  && typeof (value as FlashActGamePlacement).cardId === 'string'
  && typeof (value as FlashActGamePlacement).destinationId === 'string',
)

export function createFlashActGameProgress(input: {
  unitId: string
  phase: 1 | 2 | 3
  mode: string
}): FlashActGameProgress {
  return {
    version: 'flash-act-game-v2',
    unitId: input.unitId,
    phase: input.phase,
    mode: input.mode,
    status: 'playing',
    placements: [],
    pending: null,
    revealedItemIds: [],
    attemptsByItem: {},
  }
}

export function restoreFlashActGameProgress(
  value: unknown,
  expected: { unitId: string; phase: 1 | 2 | 3; mode: string; itemIds: readonly string[] },
): FlashActGameProgress {
  const fallback = createFlashActGameProgress(expected)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const candidate = value as Partial<FlashActGameProgress>
  const candidateVersion = (value as { version?: unknown }).version
  if (
    (candidateVersion !== 'flash-act-game-v1' && candidateVersion !== 'flash-act-game-v2')
    || candidate.unitId !== expected.unitId
    || candidate.phase !== expected.phase
    || candidate.mode !== expected.mode
  ) return fallback

  const placements: FlashActGamePlacement[] = []
  if (Array.isArray(candidate.placements)) {
    for (let index = 0; index < expected.itemIds.length; index += 1) {
      const placement = candidate.placements[index]
      if (!isPlacement(placement) || placement.cardId !== expected.itemIds[index]) break
      placements.push(placement)
    }
  }
  const nextItemId = expected.itemIds[placements.length]
  const pending = isPlacement(candidate.pending) && candidate.pending.cardId === nextItemId
    ? candidate.pending
    : null
  const completed = placements.length === expected.itemIds.length && candidate.status === 'completed'
  const revealedItemIds = candidateVersion === 'flash-act-game-v2' && Array.isArray(candidate.revealedItemIds)
    ? [...new Set(candidate.revealedItemIds.filter((id): id is string => typeof id === 'string' && expected.itemIds.includes(id)))]
    : []
  const attemptsByItem = candidateVersion === 'flash-act-game-v2' && candidate.attemptsByItem && typeof candidate.attemptsByItem === 'object'
    ? Object.fromEntries(expected.itemIds.map((id) => [id, Math.max(0, Math.min(20, Number((candidate.attemptsByItem as Record<string, unknown>)[id]) || 0))]))
    : {}
  return {
    ...fallback,
    status: completed ? 'completed' : 'playing',
    placements,
    pending: completed ? null : pending,
    revealedItemIds,
    attemptsByItem,
  }
}

export function completedFlashActGamePlacements(
  value: unknown,
  expected: { unitId: string; phase: 1 | 2 | 3 },
): FlashActGamePlacement[] | null {
  // Backward compatibility for a game completed before the act-bound envelope shipped.
  if (Array.isArray(value) && value.length === 3 && value.every(isPlacement)) return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<FlashActGameProgress>
  const candidateVersion = (value as { version?: unknown }).version
  if (
    (candidateVersion !== 'flash-act-game-v1' && candidateVersion !== 'flash-act-game-v2')
    || candidate.unitId !== expected.unitId
    || candidate.phase !== expected.phase
    || candidate.status !== 'completed'
    || !Array.isArray(candidate.placements)
    || candidate.placements.length !== 3
    || !candidate.placements.every(isPlacement)
  ) return null
  return candidate.placements
}
