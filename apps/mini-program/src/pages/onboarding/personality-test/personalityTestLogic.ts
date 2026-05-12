import type { XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'

/** Poetic trait-fragment labels for Phase 2 wow element.
 *  Deterministic mapping by option text hash — no "+1" gamification.
 */
const FRAGMENT_LABELS = [
  '🌙 月光气质',
  '🔥 热忱底色',
  '💧 静水流深',
  '🍃 清风徐来',
  '⚡ 锐意思维',
  '🌸 柔软内核',
  '🪨 沉稳根基',
  '🌊 包容广度',
  '✨ 独特光芒',
  '🌿 自然节律',
  '💎 剔透本真',
  '🌅 温暖曙光',
  '🌌 深邃夜空',
  '🍂 从容秋意',
  '❄️ 清冽边界',
  '🌻 向阳生长',
]

export interface AnswerOption {
  value: string
  text: string
  traitScores?: Record<string, number>
}

/** Map an option to a trait fragment label based on its text content. */
export function resolveFragmentLabel(option: AnswerOption): string {
  const hash = Math.abs(option.text.charCodeAt(0)) % FRAGMENT_LABELS.length
  return FRAGMENT_LABELS[hash]!
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
