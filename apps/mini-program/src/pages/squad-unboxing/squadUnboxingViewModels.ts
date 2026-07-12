import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'

import { getVibeLabel as getVibeLabelShared } from '../../lib/matching/groupDisplay'

export type FlowState = 'ready' | 'shaking' | 'revealed'
export type ActionDockState = 'hidden' | 'ready'
export type BlindBoxVisualState = 'ready' | 'opening' | 'open'

// Legacy type kept for backward compatibility in persisted analytics; UI now uses a single expandable panel.
export type AnalysisStage = 0 | 1 | 2 | 3 | 4

export type ChemistryType = 'fire' | 'warm' | 'cold' | 'mild'

export interface SquadChemistryTokens {
  iconRef: ChemistryType
  title: string
  description: string
  chipClassName: string
}

export interface ViewerSpotlight {
  pair: PairExplanation
  otherMember: PoolGroupMemberSummary
}

export function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

export { formatDateTime } from '../../lib/matching/groupDisplay'

export function getVibeLabel(vibe?: string | null): string {
  return getVibeLabelShared(vibe, '今晚成桌')
}

const CHEMISTRY_TITLES: Record<ChemistryType, string> = {
  fire: '超级火花',
  warm: '暖意融融',
  mild: '相聊甚欢',
  cold: '慢慢发现',
}

const CHEMISTRY_FALLBACK_WORD = '今晚有戏'

export function getChemistryWord(chemistry?: OverallChemistry | ChemistryType | null): string {
  if (chemistry && chemistry in CHEMISTRY_TITLES) {
    return CHEMISTRY_TITLES[chemistry as ChemistryType]
  }
  return CHEMISTRY_FALLBACK_WORD
}

function scoreToChemistryType(score: number): ChemistryType {
  // Mirrors server `getTemperatureLevel` thresholds (poolMatchingService.ts):
  // fire >= 85, warm >= 70, mild >= 55, else cold.
  if (score >= 85) return 'fire'
  if (score >= 70) return 'warm'
  if (score >= 55) return 'mild'
  return 'cold'
}

export function getPairChemistryWord(score?: number | null): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return CHEMISTRY_FALLBACK_WORD
  return CHEMISTRY_TITLES[scoreToChemistryType(score)]
}

export function getSquadChemistryTokens(chemistry?: OverallChemistry): SquadChemistryTokens {
  switch (chemistry) {
    case 'fire':
      return {
        iconRef: 'fire',
        title: CHEMISTRY_TITLES.fire,
        description: '这桌的聊天温度很高，基本不会冷场。',
        chipClassName: 'squad-unboxing__chemistry-chip--fire',
      }
    case 'warm':
      return {
        iconRef: 'warm',
        title: CHEMISTRY_TITLES.warm,
        description: '同频感很稳定，适合边吃边慢慢聊开。',
        chipClassName: 'squad-unboxing__chemistry-chip--warm',
      }
    case 'cold':
      return {
        iconRef: 'cold',
        title: CHEMISTRY_TITLES.cold,
        description: '这桌是耐聊型组合，越往后越容易找到共同节奏。',
        chipClassName: 'squad-unboxing__chemistry-chip--cold',
      }
    case 'mild':
      return {
        iconRef: 'mild',
        title: CHEMISTRY_TITLES.mild,
        description: '这桌的风格平衡又自然，很适合从小话题慢慢热起来。',
        chipClassName: 'squad-unboxing__chemistry-chip--mild',
      }
    default:
      return {
        iconRef: 'mild',
        title: CHEMISTRY_FALLBACK_WORD,
        description: `${DEFAULT_MASCOT_DISPLAY_NAME}已经替你把这一桌锁定，接下来看看你们为什么会聊得来。`,
        chipClassName: 'squad-unboxing__chemistry-chip--fallback',
      }
  }
}

export function computeActionDockState(flowState: FlowState): ActionDockState {
  return flowState === 'revealed' ? 'ready' : 'hidden'
}

export function buildPairKeyMemberMap(
  members: PoolGroupMemberSummary[],
): Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]> {
  const map = new Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]>()

  for (let index = 0; index < members.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < members.length; nextIndex += 1) {
      const pairKey = [members[index].userId, members[nextIndex].userId].sort().join('-')
      map.set(pairKey, [members[index], members[nextIndex]])
    }
  }

  return map
}
