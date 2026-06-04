import type { XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'

/** Poetic trait-fragment labels for Phase 2 wow element.
 *  One entry per ACOEXP trait, keyed by short trait code (A/O/C/E/X/P).
 *  Selected at runtime by the option's dominant traitScores — no "+1" gamification,
 *  no emoji in primary copy (brand guideline: emoji-free primary copy).
 */
const FRAGMENT_LABELS: Record<string, string> = {
  A: '月光气质',
  O: '清风徐来',
  C: '沉稳根基',
  E: '静水流深',
  X: '向阳生长',
  P: '温暖曙光',
}

const DEFAULT_FRAGMENT_LABEL = '你的光'

export interface AnswerOption {
  value: string
  text: string
  traitScores?: Record<string, number>
  iconAssetKey?: string
}

/** Map an option to a trait fragment label based on its dominant traitScores.
 *  Falls back to a warm generic when no traitScores are present. */
export function resolveFragmentLabel(option: AnswerOption): string {
  const scores = option.traitScores
  if (!scores) return DEFAULT_FRAGMENT_LABEL

  const entries = Object.entries(scores).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
  if (entries.length === 0) return DEFAULT_FRAGMENT_LABEL

  const [topKey] = entries.reduce<[string, number]>(
    (best, current) => (current[1] > best[1] ? current : best),
    entries[0]!,
  )
  return FRAGMENT_LABELS[topKey] ?? DEFAULT_FRAGMENT_LABEL
}

/** Map an option to a preview sprite state based on its text content. */
export function resolveOptionPreviewSpriteState(option: { text: string }): XiaoyueSpriteState {
  const states: XiaoyueSpriteState[] = ['listening', 'curious', 'thinking', 'surprised']
  const hash = Math.abs(option.text.charCodeAt(0)) % states.length
  return states[hash]!
}

/** Check if the given answered count triggers a milestone celebration. */
export function isMilestoneQuestion(answeredCount: number): boolean {
  return answeredCount === 3 || answeredCount === 7
}

/** Resolve the nearest slider option for a given value (0-100). */
export function getNearestSliderOption(
  options: AnswerOption[],
  sliderValue: number,
): AnswerOption | null {
  if (options.length === 0) return null
  return options.reduce<AnswerOption | null>((closest, option) => {
    const match = option.value.match(/(-?\d+)/)
    const optionValue = match ? Number(match[1]) : 50
    if (!closest) return option
    const closestMatch = closest.value.match(/(-?\d+)/)
    const closestValue = closestMatch ? Number(closestMatch[1]) : 50
    return Math.abs(optionValue - sliderValue) < Math.abs(closestValue - sliderValue)
      ? option
      : closest
  }, null)
}
