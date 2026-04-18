import type { EventThemeVibe } from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'

export type LiveRevealStage = 'idle' | 'match' | 'members' | 'theme'

export interface ThemeSummary {
  title: string
  subtitle?: string | null
  emoji?: string | null
  vibe?: EventThemeVibe | null
  highlights: string[]
}

export interface PoolFillStats {
  currentFill: number
  minGroupSize: number
  maxGroupSize: number
  progress: number
}

export interface WaitingStateCopy {
  badge: string | null
  headline: string
  subtext: string
  nextStepHint: string
}

export interface ViewerPairSpotlight {
  pair: PairExplanation
  otherMemberId: string
  otherMemberName: string
}

export interface WaitingSeatViewModel {
  seatNumber: number
  isFilled: boolean
  isThreshold: boolean
  isNewest: boolean
  isBonusSeat: boolean
  seatMark: string
  caption: string | null
  layoutClassName: string
}

export interface TemperatureCopy {
  emoji: string
  label: string
  body: string
}

export interface ChemistryTokens {
  emoji: string
  label: string
  body: string
}

export const MATCHING_BG_SRC = '/assets/matching/matching-bg.png'
export const MATCHING_WAITING_HERO_SRC = '/assets/matching/matching-waiting-hero.png'
export const MATCHING_NO_MATCH_HERO_SRC = '/assets/matching/matching-no-match-hero.png'

const VENUE_UNLOCK_HOURS = 24

export const DEFAULT_MIN_GROUP_SIZE = 4
export const DEFAULT_MAX_GROUP_SIZE = 6
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 20

export function formatDateTime(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) return '时间待定'

  return parsedDate.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusLabel(status?: string): string {
  switch (status) {
    case 'matched':
      return '小队已锁定'
    case 'completed':
      return '活动已完成'
    case 'pending':
    default:
      return '匹配进行中'
  }
}

export function getVibeLabel(vibe?: EventThemeVibe | string | null): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意碰撞'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? ''
  }
}

export function getCountdownState(dateTime?: string | null): { isExpired: boolean; label: string } {
  if (!dateTime) {
    return { isExpired: false, label: '时间待定' }
  }

  const targetTime = new Date(dateTime).getTime()
  if (Number.isNaN(targetTime)) {
    return { isExpired: false, label: '时间待定' }
  }

  const diff = targetTime - Date.now()
  if (diff <= 0) {
    return { isExpired: true, label: '活动时间已到，当前这桌未能成局' }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { isExpired: false, label: `距离开始还有 ${days} 天` }
  }

  if (hours > 0) {
    return { isExpired: false, label: `距离开始还有 ${hours} 小时 ${minutes} 分钟` }
  }

  return { isExpired: false, label: `距离开始还有 ${Math.max(minutes, 1)} 分钟` }
}

function getHoursUntilEvent(dateTime?: string | null): number | null {
  if (!dateTime) return null

  const targetTime = new Date(dateTime).getTime()
  if (Number.isNaN(targetTime)) return null

  return (targetTime - Date.now()) / (1000 * 60 * 60)
}

export function isVenueUnlocked(dateTime?: string | null): boolean {
  const hoursUntilEvent = getHoursUntilEvent(dateTime)
  return hoursUntilEvent !== null && hoursUntilEvent > 0 && hoursUntilEvent < VENUE_UNLOCK_HOURS
}

export function buildMatchedDestinationUrl(groupId: string): string {
  return `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}`
}

export function getTemperatureCopy(level?: string | null): TemperatureCopy {
  switch (level) {
    case 'fire':
      return {
        emoji: '🔥',
        label: '高能锁定',
        body: '这一桌的化学反应已经拉满，先把桌友和今晚的主题慢慢揭晓给你。',
      }
    case 'warm':
      return {
        emoji: '✨',
        label: '暖场成桌',
        body: '小悦已经把这桌气氛很对的人凑齐了，接下来开始揭晓你的同桌。',
      }
    case 'cold':
      return {
        emoji: '🌱',
        label: '稳稳落桌',
        body: '这桌会是慢热但耐聊的组合，先看看今晚会和谁坐在一起。',
      }
    case 'mild':
    default:
      return {
        emoji: '💬',
        label: '成桌啦',
        body: '小队已经锁定，桌友卡片和今晚的主题会按顺序为你揭晓。',
      }
  }
}

export function getWaitingStateCopy(stats?: PoolFillStats | null): WaitingStateCopy {
  const currentFill = stats?.currentFill ?? 0
  const minGroupSize = stats?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE
  const maxGroupSize = stats?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE
  const seatsNeeded = Math.max(minGroupSize - currentFill, 0)

  if (currentFill >= maxGroupSize) {
    return {
      badge: '即将揭晓',
      headline: '这一桌已经齐了',
      subtext: '桌友已聚齐，小悦正在完成最后的成桌确认。',
      nextStepHint: '聚齐 → 成桌 → 揭晓',
    }
  }

  if (currentFill >= minGroupSize) {
    return {
      badge: '开始成桌',
      headline: '已经到成桌门槛了',
      subtext: `已有 ${currentFill} 位候选就位，小悦正在优先给这桌找最对味的一组。`,
      nextStepHint: '系统会先从这桌开始完成配对',
    }
  }

  return {
    badge: null,
    headline: `再来 ${seatsNeeded} 位，这一桌就开了`,
    subtext: '有缘人正在路上，先把这桌的人味慢慢攒起来。',
    nextStepHint: '入座 → 聚齐 → 揭晓',
  }
}

export function getChemistryTokens(
  chemistry?: OverallChemistry,
  matchScore?: number | null,
): ChemistryTokens {
  const roundedScore = typeof matchScore === 'number' ? Math.round(matchScore) : null

  switch (chemistry) {
    case 'fire':
      return {
        emoji: '🔥',
        label: '高能化学反应',
        body: '这一桌的聊天温度已经被点燃，通常会很快进入状态。',
      }
    case 'warm':
      return {
        emoji: '✨',
        label: '暖场很稳',
        body: '这桌的同频感很自然，适合一边吃一边慢慢聊开。',
      }
    case 'cold':
      return {
        emoji: '🌱',
        label: '慢热耐聊',
        body: '这桌是越聊越有意思的类型，破冰后更容易进入正题。',
      }
    case 'mild':
      return {
        emoji: '💬',
        label: '刚刚好',
        body: '这桌的风格平衡又自然，浅聊和深聊都容易接得住。',
      }
    default:
      return {
        emoji: '💫',
        label: roundedScore !== null ? `默契度 ${roundedScore}%` : '今晚有戏',
        body: '小悦已经把这桌锁定，接下来看看你会先和谁聊开。',
      }
  }
}

export function buildWaitingSeats({
  currentFill,
  minGroupSize,
  maxGroupSize,
  newMemberArchetype,
  newMemberJoined,
}: {
  currentFill: number
  minGroupSize: number
  maxGroupSize: number
  newMemberArchetype: string | null
  newMemberJoined: boolean
}): WaitingSeatViewModel[] {
  const seatCount = Math.min(Math.max(maxGroupSize, DEFAULT_MIN_GROUP_SIZE), DEFAULT_MAX_GROUP_SIZE)
  const layoutKey = Math.min(Math.max(seatCount, DEFAULT_MIN_GROUP_SIZE), DEFAULT_MAX_GROUP_SIZE)
  const filledSeatCount = Math.min(currentFill, seatCount)

  return Array.from({ length: seatCount }).map((_, index) => {
    const seatNumber = index + 1
    const isFilled = seatNumber <= filledSeatCount
    const isThreshold = seatNumber === minGroupSize
    const isNewest = Boolean(newMemberJoined && isFilled && seatNumber === filledSeatCount)
    const isBonusSeat = seatNumber > minGroupSize

    return {
      seatNumber,
      isFilled,
      isThreshold,
      isNewest,
      isBonusSeat,
      seatMark: isFilled ? (isNewest ? '新' : `${seatNumber}`) : isThreshold ? '开' : '+',
      caption: isNewest
        ? newMemberArchetype ?? '新朋友'
        : isThreshold
          ? '成桌线'
          : seatNumber === seatCount
            ? '满员'
            : null,
      layoutClassName: `matching-status__waiting-seat--layout-${layoutKey}-${seatNumber}`,
    }
  })
}