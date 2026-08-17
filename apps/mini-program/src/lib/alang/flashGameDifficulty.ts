export const FLASH_GAMEPLAY_VERSION = 'flash-gameplay-v2' as const

export type FlashFailureTier = 'consequence' | 'clue' | 'assist'

export interface FlashFailureAssistance {
  tier: FlashFailureTier
  showClue: boolean
  assist: boolean
}

export function getFailureAssistance(attempts: number): FlashFailureAssistance {
  if (attempts >= 3) return { tier: 'assist', showClue: true, assist: true }
  if (attempts >= 2) return { tier: 'clue', showClue: true, assist: false }
  return { tier: 'consequence', showClue: false, assist: false }
}

function stableSeed(value: string): number {
  let seed = 0
  for (let index = 0; index < value.length; index += 1) seed = ((seed * 31) + value.charCodeAt(index)) >>> 0
  return seed
}

export function deterministicGameOrder<T>(items: readonly T[], key: string): T[] {
  if (items.length < 2) return [...items]
  const offset = stableSeed(key) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}
