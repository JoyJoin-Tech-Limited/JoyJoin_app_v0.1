import type { PoolGroupMemberSummary } from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'

export type FlowState = 'ready' | 'shaking' | 'revealed'
export type AnalysisStage = 0 | 1 | 2 | 3 | 4
export type ActionDockState = 'hidden' | 'tease' | 'ready'
export type BlindBoxVisualState = 'ready' | 'opening' | 'open'

export interface SquadChemistryTokens {
  emoji: string
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

export { formatDateTime } from '../../lib/groupDisplay'

import { getVibeLabel as getVibeLabelShared } from '../../lib/groupDisplay'

export function getVibeLabel(vibe?: string | null): string {
  return getVibeLabelShared(vibe, '今晚成桌')
}

export function getSquadChemistryTokens(
  chemistry?: OverallChemistry,
  matchScore?: number | null,
): SquadChemistryTokens {
  const fallbackScore = typeof matchScore === 'number' ? Math.round(matchScore) : null

  switch (chemistry) {
    case 'fire':
      return {
        emoji: '🔥',
        title: '超级火花',
        description: '这桌的聊天温度很高，基本不会冷场。',
        chipClassName: 'squad-unboxing__chemistry-chip--fire',
      }
    case 'warm':
      return {
        emoji: '✨',
        title: '暖意融融',
        description: '同频感很稳定，适合边吃边慢慢聊开。',
        chipClassName: 'squad-unboxing__chemistry-chip--warm',
      }
    case 'cold':
      return {
        emoji: '🌱',
        title: '慢慢发现',
        description: '这桌是耐聊型组合，越往后越容易找到共同节奏。',
        chipClassName: 'squad-unboxing__chemistry-chip--cold',
      }
    case 'mild':
      return {
        emoji: '💬',
        title: '相聊甚欢',
        description: '这桌的风格平衡又自然，很适合从小话题慢慢热起来。',
        chipClassName: 'squad-unboxing__chemistry-chip--mild',
      }
    default:
      return {
        emoji: '💫',
        title: fallbackScore !== null ? `默契度 ${fallbackScore}%` : '今晚有戏',
        description: '小悦已经替你把这一桌锁定，接下来看看你们为什么会聊得来。',
        chipClassName: 'squad-unboxing__chemistry-chip--fallback',
      }
  }
}

export function computeActionDockState(
  flowState: FlowState,
  analysisStage: AnalysisStage,
): ActionDockState {
  if (flowState !== 'revealed') {
    return 'hidden'
  }

  if (analysisStage >= 4) {
    return 'ready'
  }

  if (analysisStage >= 3) {
    return 'tease'
  }

  return 'hidden'
}
