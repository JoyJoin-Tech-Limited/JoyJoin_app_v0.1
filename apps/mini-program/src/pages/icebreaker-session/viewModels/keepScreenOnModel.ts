import type { SessionPhase } from '../phaseUtils'

/**
 * keepScreenOn 生命周期判定（P0 打磨 ⑧，2026-10-20 deliberation §2）— 纯函数。
 *
 * 此前挂在 moodFieldEnabled（氛围 flag）上：锁屏即轮询死亡，「人还在却像
 * 掉线」。现在挂会话生命周期本身，与氛围 flag 解耦：
 *
 *   hold    — 任何进行中的环节（waiting/warmup/各玩法/recap 回顾，
 *             大家还在桌上看高光）
 *   release — 仅 ended（会话真正结束）或页面不可见（hide/后台）
 *
 * 调用方：index.tsx 的 useKeepScreenOn。单测：__tests__/keepScreenOnModel.test.ts
 */
export function resolveKeepScreenOn({
  phase,
  isPageVisible,
}: {
  phase: SessionPhase
  isPageVisible: boolean
}): boolean {
  return phase !== 'ended' && isPageVisible
}
