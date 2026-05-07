import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { EventThemeVibe, PoolGroupSummary, PoolRegistrationSummary } from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'
import type { EventThemeTitleRevealedData } from '@shared/wsEvents'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { MS_PER_HOUR, MS_PER_MINUTE } from '../../lib/utils/uiConstants'

export type LiveRevealStage = 'idle' | 'match' | 'members' | 'theme'

export interface ThemeSummary {
  title: string
  subtitle?: string | null
  emoji?: string | null
  vibe?: EventThemeVibe | null
  highlights: string[]
}

export interface MatchingStatusResolvedScreenState<TRegistration extends { id: string }> {
  registration: TRegistration
}

export type MatchingStatusScreenState<TRegistration extends { id: string } = { id: string }> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-found' }
  | ({ kind: 'cancelled' } & MatchingStatusResolvedScreenState<TRegistration>)
  | ({ kind: 'no-match' } & MatchingStatusResolvedScreenState<TRegistration>)
  | ({ kind: 'ready' } & MatchingStatusResolvedScreenState<TRegistration>)

export type ThemeSummaryRegistrationSlice = Pick<
  PoolRegistrationSummary,
  'theme' | 'themeEmoji' | 'highlights' | 'subtitle' | 'vibe'
>

/**
 * Single precedence for the theme block on matching-status after a pool is matched:
 *
 * 1. **WS `EVENT_THEME_TITLE_REVEALED`** — wins whenever present (live reveal payload).
 * 2. Otherwise merge **group details** (`getPoolGroupDetails`) over **registration list**
 *    (`getMyPoolRegistrations`): per field, group wins when set (server snapshot for the locked group).
 */
export function resolvePersistedThemeSummary(params: {
  themeRevealData: EventThemeTitleRevealedData | null | undefined
  group: PoolGroupSummary | null | undefined
  registration: ThemeSummaryRegistrationSlice | null | undefined
}): ThemeSummary | null {
  const { themeRevealData, group, registration } = params

  if (themeRevealData) {
    return {
      title: themeRevealData.eventThemeTitle,
      subtitle: themeRevealData.themeTagline,
      emoji: themeRevealData.themeEmoji,
      vibe: themeRevealData.themeVibe,
      highlights: themeRevealData.themeHighlights ?? [],
    }
  }

  const title = group?.theme ?? registration?.theme ?? null
  const emoji = group?.themeEmoji ?? registration?.themeEmoji ?? null
  const highlights = group?.highlights ?? registration?.highlights ?? []

  if (!title && !emoji) {
    return null
  }

  return {
    title: title ?? '活动主题',
    subtitle: group?.subtitle ?? registration?.subtitle ?? null,
    emoji,
    vibe: group?.vibe ?? registration?.vibe ?? null,
    highlights: Array.isArray(highlights)
      ? highlights
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 4)
      : [],
  }
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

export interface UnifiedRevealSpotlight {
  memberName: string
  chemistryScore: number | null
  connectionPointsWithRarity: { text: string; rarity: 'common' | 'rare' | 'epic' }[]
  rarityTier: 'common' | 'rare' | 'epic'
}

export interface UnifiedRevealTokens {
  headline: string
  body: string
  subtitle: string | null
  groupTags: string[]
  spotlight: UnifiedRevealSpotlight | null
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

export type ChemistryType = 'fire' | 'warm' | 'cold' | 'mild'

export interface TemperatureCopy {
  iconRef: ChemistryType
  label: string
  body: string
}

export interface ChemistryTokens {
  iconRef: ChemistryType
  label: string
  body: string
}

export const MATCHING_BG_SRC = cdnAsset('/assets/matching/matching-bg.webp')
export const MATCHING_WAITING_HERO_SRC = cdnAsset('/assets/matching/matching-waiting-hero.webp')
export const MATCHING_NO_MATCH_HERO_SRC = cdnAsset('/assets/matching/matching-no-match-hero.webp')

const VENUE_UNLOCK_HOURS = 24

export const DEFAULT_MIN_GROUP_SIZE = 4
export const DEFAULT_MAX_GROUP_SIZE = 6
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 20

export function resolveMatchingStatusAuthBootstrap<TUser>(params: {
  authUser: TUser | null | undefined
  cachedAuthUser: TUser | null | undefined
  authLoading: boolean
}): {
  effectiveAuthUser: TUser | undefined
  isAuthBootstrapPending: boolean
} {
  const effectiveAuthUser = params.authUser ?? params.cachedAuthUser ?? undefined

  return {
    effectiveAuthUser,
    isAuthBootstrapPending: params.authLoading && !effectiveAuthUser,
  }
}

export function getMatchingStatusScreenState<TRegistration extends { id: string }>(params: {
  hasRegistrationId: boolean
  isRegistrationUnresolved: boolean
  hasFetchError: boolean
  registration: TRegistration | null | undefined
  isCancelled: boolean
  isNoMatchState: boolean
}): MatchingStatusScreenState<TRegistration> {
  const {
    hasRegistrationId,
    isRegistrationUnresolved,
    hasFetchError,
    registration,
    isCancelled,
    isNoMatchState,
  } = params

  if (!hasRegistrationId) {
    return { kind: 'not-found' }
  }

  if (isRegistrationUnresolved) {
    return { kind: 'loading' }
  }

  if (hasFetchError) {
    return { kind: 'error' }
  }

  if (!registration) {
    return { kind: 'not-found' }
  }

  if (isCancelled) {
    return { kind: 'cancelled', registration }
  }

  if (isNoMatchState) {
    return { kind: 'no-match', registration }
  }

  return { kind: 'ready', registration }
}

export { formatDateTime } from '../../lib/matching/groupDisplay'

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

export { getVibeLabel } from '../../lib/matching/groupDisplay'

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

  const hours = Math.floor(diff / MS_PER_HOUR)
  const minutes = Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE)

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

  return (targetTime - Date.now()) / MS_PER_HOUR
}

export function isVenueUnlocked(dateTime?: string | null): boolean {
  const hoursUntilEvent = getHoursUntilEvent(dateTime)
  return hoursUntilEvent !== null && hoursUntilEvent > 0 && hoursUntilEvent < VENUE_UNLOCK_HOURS
}

export function getTemperatureCopy(level?: string | null): TemperatureCopy {
  switch (level) {
    case 'fire':
      return {
        iconRef: 'fire',
        label: '高能锁定',
        body: '这一桌的化学反应已经拉满，先把桌友和今晚的主题慢慢揭晓给你。',
      }
    case 'warm':
      return {
        iconRef: 'warm',
        label: '暖场成桌',
        body: `${DEFAULT_MASCOT_DISPLAY_NAME}已经把这桌气氛很对的人凑齐了，接下来开始揭晓你的同桌。`,
      }
    case 'cold':
      return {
        iconRef: 'cold',
        label: '稳稳落桌',
        body: '这桌会是慢热但耐聊的组合，先看看今晚会和谁坐在一起。',
      }
    case 'mild':
    default:
      return {
        iconRef: 'mild',
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
      subtext: `${DEFAULT_MASCOT_DISPLAY_NAME}正在完成最后的成桌确认。`,
      nextStepHint: '聚齐 → 成桌 → 揭晓',
    }
  }

  if (currentFill >= minGroupSize) {
    return {
      badge: '开始成桌',
      headline: '已经到成桌门槛了',
      subtext: `已有 ${currentFill} 位候选就位，${DEFAULT_MASCOT_DISPLAY_NAME}正在优先给这桌找最对味的一组。`,
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

export function composeUnifiedReveal(params: {
  chemistryPayoff: { headline: string; chemistryLine: string; tags: string[] } | null
  viewerSpotlight: ViewerPairSpotlight | null
}): UnifiedRevealTokens {
  const { chemistryPayoff, viewerSpotlight } = params

  const headline = chemistryPayoff?.headline ?? '这桌的缘分已经悄悄酝酿'
  const groupTags = chemistryPayoff?.tags ?? []

  // Normalize connectionPoints to connectionPointsWithRarity format
  const rawPoints = viewerSpotlight?.pair.connectionPointsWithRarity
    ?? viewerSpotlight?.pair.connectionPoints?.slice(0, 3).map((text) => ({ text, rarity: 'common' as const }))
    ?? []

  // Compute rarity tier from connection points
  const hasEpic = rawPoints.some((cp) => cp.rarity === 'epic')
  const hasRare = rawPoints.some((cp) => cp.rarity === 'rare')
  const rarityTier = hasEpic ? 'epic' : hasRare ? 'rare' : 'common'

  // Priority rule: spotlight pair explanation wins over group chemistry line
  const spotlightExplanation = viewerSpotlight?.pair.explanation?.trim()
  const spotlightBody = spotlightExplanation && spotlightExplanation.length > 0
    ? spotlightExplanation
    : null

  const groupBody = chemistryPayoff?.chemistryLine ?? '这桌的化学反应很值得期待'

  const body = spotlightBody ?? groupBody
  const subtitle = spotlightBody ? groupBody : null

  const spotlight: UnifiedRevealSpotlight | null = viewerSpotlight
    ? {
        memberName: viewerSpotlight.otherMemberName,
        chemistryScore: viewerSpotlight.pair.chemistryScore ?? null,
        connectionPointsWithRarity: rawPoints,
        rarityTier,
      }
    : null

  return { headline, body, subtitle, groupTags, spotlight }
}

export function getChemistryTokens(
  chemistry?: OverallChemistry,
  matchScore?: number | null,
): ChemistryTokens {
  const roundedScore = typeof matchScore === 'number' ? Math.round(matchScore) : null

  switch (chemistry) {
    case 'fire':
      return {
        iconRef: 'fire',
        label: '高能化学反应',
        body: '这一桌的聊天温度已经被点燃，通常会很快进入状态。',
      }
    case 'warm':
      return {
        iconRef: 'warm',
        label: '暖场很稳',
        body: '这桌的同频感很自然，适合一边吃一边慢慢聊开。',
      }
    case 'cold':
      return {
        iconRef: 'cold',
        label: '慢热耐聊',
        body: '这桌是越聊越有意思的类型，破冰后更容易进入正题。',
      }
    case 'mild':
      return {
        iconRef: 'mild',
        label: '刚刚好',
        body: '这桌的风格平衡又自然，浅聊和深聊都容易接得住。',
      }
    default:
      return {
        iconRef: 'mild',
        label: roundedScore !== null ? `默契度 ${roundedScore}%` : '今晚有戏',
        body: `${DEFAULT_MASCOT_DISPLAY_NAME}已经把这桌锁定，接下来看看你会先和谁聊开。`,
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