import {
  pickQuipInspirationChips,
  type QuipInspirationChip,
} from '@shared/copy/quipInspirationChips'

/**
 * Quip 灵感 chips 交互模型（2026-10-20 P2 #6，spec 规格二 §4）— 纯函数，
 * 无 Taro / React 依赖，供 QuipBattleHeroView 消费并单测。
 */

/** chip 点按的两条路径：直接填入/替换，或先轻确认（手打内容保护）。 */
export type QuipChipTapAction = 'fill' | 'confirm-replace'

/**
 * 点 chip 时的填入决策（spec §4）：
 * - 输入框为空（含纯空白）→ 直接填入；
 * - 现值恰为本题 chips 子集任一条原文（即上次点 chip 填的）→ 直接替换；
 * - 现值为手打内容 → 轻确认后再替换。
 */
export function resolveQuipChipTapAction(
  currentValue: string,
  promptChips: ReadonlyArray<QuipInspirationChip>,
): QuipChipTapAction {
  if (currentValue.trim().length === 0) return 'fill'
  if (promptChips.some((chip) => chip.text === currentValue)) return 'fill'
  return 'confirm-replace'
}

/**
 * quip_chip_adopted 判定（spec §5 AC5）：提交成功的某答案「以 chip 原文开头」。
 * 子集按同一三元种子重算（纯函数，跨 remount 稳定）；多条命中时取最长
 * 前缀（子集内文案两两不互为前缀，此分支实际至多一条命中，排序仅为防御）。
 */
export function findAdoptedQuipChip(
  sessionId: string,
  promptId: string,
  userId: string,
  answerText: string,
): QuipInspirationChip | null {
  if (!sessionId || !promptId || !userId || !answerText) return null
  const chips = pickQuipInspirationChips(sessionId, promptId, userId)
  const matches = chips.filter((chip) => answerText.startsWith(chip.text))
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.text.length - a.text.length)[0]
}
