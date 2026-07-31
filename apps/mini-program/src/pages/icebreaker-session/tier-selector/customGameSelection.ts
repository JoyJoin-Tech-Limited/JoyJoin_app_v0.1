import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'

export type CustomGamePhase = Exclude<
  SocialIcebreakerPhase,
  'warmup' | 'recap' | 'phase_selection'
>

export interface CustomGameOption {
  phase: CustomGamePhase
  iconPhase: CustomGamePhase
  title: string
  minutes: number
}

export const CUSTOM_GAME_OPTIONS: CustomGameOption[] = [
  { phase: 'micro_challenge', iconPhase: 'micro_challenge', title: '默契挑战', minutes: 8 },
  { phase: 'lie_detective', iconPhase: 'lie_detective', title: '谎言侦探', minutes: 15 },
  { phase: 'auction', iconPhase: 'auction', title: '心动拍卖', minutes: 20 },
  { phase: 'personality_dice', iconPhase: 'personality_dice', title: '人格骰子', minutes: 12 },
  { phase: 'speed_friending', iconPhase: 'speed_friending', title: '快速交友', minutes: 20 },
  { phase: 'quip_battle', iconPhase: 'quip_battle', title: '机智对决', minutes: 12 },
  { phase: 'undercover_word', iconPhase: 'undercover_word', title: '谁是卧底', minutes: 12 },
  { phase: 'group_mirror', iconPhase: 'group_mirror', title: '群像镜像', minutes: 10 },
  { phase: 'mini_script', iconPhase: 'mini_script', title: '迷你剧本杀', minutes: 25 },
]

export function toggleCustomGameSelection(
  selected: CustomGamePhase[],
  phase: CustomGamePhase,
): CustomGamePhase[] {
  return selected.includes(phase)
    ? selected.filter((selectedPhase) => selectedPhase !== phase)
    : [...selected, phase]
}

export function getCustomSelectionMinutes(selected: CustomGamePhase[]): number {
  const durations = new Map(CUSTOM_GAME_OPTIONS.map((game) => [game.phase, game.minutes]))
  return selected.reduce((total, phase) => total + (durations.get(phase) ?? 0), 0)
}

export function getCustomSelectionSummary(selected: CustomGamePhase[]): string {
  if (selected.length === 0) return '选择游戏，安排今晚的专属节奏'
  return `选择了${selected.length}个游戏，预计时长${getCustomSelectionMinutes(selected)}分钟`
}
