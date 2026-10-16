import type { SessionPhase } from '../phaseUtils'

/**
 * Phase-broadcast weight table (sprint icebreaker-uiux-wave1, AC-14 / plan #5).
 *
 * Exactly ONE announcement channel per phase transition — the old
 * quadruple-broadcast (PhaseIntroOverlay 1.6s + toast 3s + toneLine + haptic)
 * is banned:
 *
 *   light  — 轻环节: toast only.
 *   medium — 中环节: toast + toneLine (the session shell's coaching line
 *            updates from the session pack automatically — no extra chrome).
 *   ritual — 重仪式: the intro overlay ABSORBS the announcement (toast is
 *            suppressed); reserved for chapter-level ceremonies.
 */
export type PhaseBroadcastWeight = 'light' | 'medium' | 'ritual'

const PHASE_BROADCAST_WEIGHT: Partial<Record<SessionPhase, PhaseBroadcastWeight>> = {
  // 轻: conversation-flow phases — a toast is enough.
  warmup: 'light', // topic_card 走查代表 (AC-14)
  speed_friending: 'light',
  quip_battle: 'light',
  personality_dice: 'light',
  // 中: gameplay phases — toast + automatic toneLine.
  micro_challenge: 'medium', // 走查代表 (AC-14)
  lie_detective: 'medium',
  auction: 'medium',
  undercover_word: 'medium',
  group_mirror: 'medium',
  // 重: chapter ceremonies — overlay absorbs the announcement.
  mini_script: 'ritual', // 走查代表 (AC-14)
  recap: 'ritual',
}

export function getPhaseBroadcastWeight(phase: SessionPhase): PhaseBroadcastWeight {
  return PHASE_BROADCAST_WEIGHT[phase] ?? 'medium'
}
