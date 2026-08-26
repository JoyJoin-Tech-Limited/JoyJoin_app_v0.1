import type { FlashStoryV2Interaction } from '@shared/schema/flash'

/**
 * 叙事动作层（sprint_20260821_3kmkkw）手势落点 → 有效结果的纯映射。
 *
 * DTO 的 result 只有 { id, next, effect? }，没有展示文案（内容基线约定回响
 * 文案由 result.next 指向的 callback 节点承载）。因此客户端采用位置映射约定：
 * 手势被划分为 results.length 个落点位置（0..n-1），**最后一个位置（完成态）
 * 恒等于 defaultResultId**——即内容侧审核过的安全/预期结果；其余结果按声明
 * 顺序依次落在 0..n-2。内容侧（Step 4）按此约定排列 results 即可，模板组件
 * 与 JSON 配置保持解耦（MNT-02）。
 *
 * 任何落点都映射到一个有效结果：没有硬失败、没有次数惩罚、没有死路。
 */
export function interactionPositionCount(interaction: FlashStoryV2Interaction): number {
  return Math.max(1, interaction.results.length)
}

export function resultIdAtPosition(
  interaction: FlashStoryV2Interaction,
  position: number,
): string {
  const { results, defaultResultId } = interaction
  if (results.length === 0) return defaultResultId
  if (results.length === 1) return results[0]?.id ?? defaultResultId
  const clamped = Math.min(Math.max(0, Math.round(position)), results.length - 1)
  const defaultResult = results.find((result) => result.id === defaultResultId)
  if (clamped === results.length - 1) return defaultResult?.id ?? results[results.length - 1]?.id ?? defaultResultId
  const alternates = results.filter((result) => result.id !== defaultResultId)
  return alternates[clamped]?.id ?? defaultResult?.id ?? results[0]?.id ?? defaultResultId
}

/** 隐私/配对类模板的分区数量：比结果数多一格，封顶 3 个大点击区域。 */
export function interactionRegionCount(interaction: FlashStoryV2Interaction): number {
  return Math.min(3, Math.max(2, interaction.results.length + 1))
}

/** 遮盖/配对数量 → 落点位置：至少一处才算有可提交的结果。 */
export function positionFromCompletedCount(
  completedCount: number,
  interaction: FlashStoryV2Interaction,
): number | null {
  if (completedCount < 1) return null
  return Math.min(completedCount, interactionPositionCount(interaction) - 1)
}

/** firstMistake 文案在 DTO 中不存在独立字段：按契约静默处决策，取第一条提示。 */
export function mistakeGuidance(interaction: FlashStoryV2Interaction): string {
  return interaction.hints?.[0] ?? '没关系，慢一点再来一次就好。'
}
