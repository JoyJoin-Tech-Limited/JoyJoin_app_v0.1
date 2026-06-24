export type ProfessionInputQualityReason =
  | 'empty'
  | 'symbol_only'
  | 'too_short'
  | 'repeated'
  | 'low_information'

export interface ProfessionInputQualityResult {
  valid: boolean
  normalized: string
  reason?: ProfessionInputQualityReason
}

const SHORT_LATIN_PROFESSIONS = new Set([
  'ai',
  'bd',
  'ceo',
  'cfo',
  'cto',
  'dev',
  'hr',
  'it',
  'pm',
  'pr',
  'qa',
  'ui',
  'ux',
])

const SEMANTIC_CHAR_PATTERN = /[A-Za-z\u3400-\u9FFF]/
const CJK_PATTERN = /[\u3400-\u9FFF]/
const LATIN_PATTERN = /[A-Za-z]/
const MEANINGLESS_LATIN_PATTERN = /^[bcdfghjklmnpqrstvwxyz]{3,}$/i

export function evaluateProfessionInputQuality(input: string): ProfessionInputQualityResult {
  const normalized = input.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return { valid: false, normalized, reason: 'empty' }
  }

  const compact = normalized.replace(/\s+/g, '')
  if (![...compact].some((char) => SEMANTIC_CHAR_PATTERN.test(char))) {
    return { valid: false, normalized, reason: 'symbol_only' }
  }

  if (compact.length >= 2 && [...compact].every((char) => char === compact[0])) {
    return { valid: false, normalized, reason: 'repeated' }
  }

  const cjkCount = [...compact].filter((char) => CJK_PATTERN.test(char)).length
  if (cjkCount > 0) {
    return cjkCount >= 2
      ? { valid: true, normalized }
      : { valid: false, normalized, reason: 'too_short' }
  }

  const latinCompact = compact.toLowerCase().replace(/[^a-z]/g, '')
  if (SHORT_LATIN_PROFESSIONS.has(latinCompact)) {
    return { valid: true, normalized }
  }

  const latinCount = [...compact].filter((char) => LATIN_PATTERN.test(char)).length
  if (latinCount < 3) {
    return { valid: false, normalized, reason: 'too_short' }
  }

  if (!normalized.includes(' ') && latinCount <= 3) {
    return { valid: false, normalized, reason: 'low_information' }
  }

  if (MEANINGLESS_LATIN_PATTERN.test(latinCompact)) {
    return { valid: false, normalized, reason: 'low_information' }
  }

  return { valid: true, normalized }
}

export function isMeaningfulProfessionInput(input: string): boolean {
  return evaluateProfessionInputQuality(input).valid
}
