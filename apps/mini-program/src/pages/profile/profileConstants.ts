import type { AuthUser } from '../../hooks/useAuth'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'

export const FIRST_EVENT_BADGE = MILESTONE_BADGES.firstEvent
export const STREAK_3_BADGE = MILESTONE_BADGES.streak3
// Profile is a main-package tab, so its always-visible artwork must not depend
// on an Alang subpackage having already been downloaded on this device.
export const PROFILE_STORY_ARTWORK_PATH = '/assets/lovart/alang-result-candidate.webp'

export interface MilestoneConfig {
  key: string
  label: string
  threshold: number
  badge: string
  ariaLabel: string
}

export interface ProfileGrowthInput {
  experiencePoints?: number | null
  nextLevelInfo?: {
    progress?: number | null
    xpNeeded?: number | null
  } | null
}

export interface ProfileGrowthSummary {
  current: number
  nextTarget: number | null
  progress: number
  isMaxLevel: boolean
}

/**
 * Server-owned rollout decision for the V1.7 Profile presentation.
 * An absent value preserves the existing production default (enabled), while
 * an explicit false always selects the deterministic compact fallback.
 */
export function isProfileV17Enabled(
  user?: Pick<AuthUser, 'features'> | null,
): boolean {
  return user?.features?.profileRedesignEnabled ?? true
}

export interface ProfileV17DataPolicy {
  gamificationEnabled: boolean
  equipmentEnabled: boolean
  personalStoryEnabled: boolean
}

export function getProfilePersonalityActionLabel(archetype?: string | null): string {
  return archetype ? '查看人格结果' : '完成人格测试'
}

/**
 * Keep the visual rollout and its optional data work on the same switch.
 * This prevents the compact fallback from silently fetching V1.7-only XP or
 * Alang archive data after the server turns the redesigned Profile off.
 */
export function getProfileV17DataPolicy(
  user: Pick<AuthUser, 'features'> | null | undefined,
): ProfileV17DataPolicy {
  const profileV17Enabled = isProfileV17Enabled(user)

  return {
    gamificationEnabled: profileV17Enabled,
    equipmentEnabled: profileV17Enabled
      && user?.features?.profilePixelAvatarEnabled === true,
    personalStoryEnabled: profileV17Enabled
      && user?.features?.personalStoryEnabled === true,
  }
}

/**
 * Convert the existing gamification response into the compact progress model
 * used by the Profile identity stage. No presentation defaults are invented:
 * the next target is only shown when the API supplies a real xpNeeded value.
 */
export function getProfileGrowthSummary(input?: ProfileGrowthInput | null): ProfileGrowthSummary {
  const rawCurrent = Number(input?.experiencePoints ?? 0)
  const current = Number.isFinite(rawCurrent) ? Math.max(0, Math.round(rawCurrent)) : 0
  const rawNeeded = input?.nextLevelInfo?.xpNeeded
  const hasNextLevel = typeof rawNeeded === 'number' && Number.isFinite(rawNeeded) && rawNeeded > 0
  const rawProgress = Number(input?.nextLevelInfo?.progress ?? (hasNextLevel ? 0 : 100))
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : 0

  return {
    current,
    nextTarget: hasNextLevel ? current + Math.round(rawNeeded) : null,
    progress,
    isMaxLevel: !hasNextLevel,
  }
}

export const MILESTONES: MilestoneConfig[] = [
  {
    key: 'firstEvent',
    label: '初次见面',
    threshold: 1,
    badge: FIRST_EVENT_BADGE,
    ariaLabel: '初次见面徽章',
  },
  {
    key: 'streak3',
    label: '三场连击',
    threshold: 3,
    badge: STREAK_3_BADGE,
    ariaLabel: '三场连击徽章',
  },
]

/** Archetype-specific family names — turns a generic badge into a tribe signal. */
export const ARCHETYPE_FAMILY_NAME: Record<string, string> = {
  corgi: '气氛组联盟',
  rooster: '小太阳家族',
  hamster_praise: '夸夸营地',
  fox: '探险家联盟',
  dolphin_calm: '灵感派',
  spider: '织网者营地',
  koala: '树洞家族',
  octopus: '脑洞星云',
  owl: '追问者联盟',
  elephant: '定海针家族',
  turtle: '慢热星球',
  cat: '静音模式',
}

/** Tone-aware greetings for completed profiles — makes Xiaoyue feel tailored per archetype. */
export const ARCHETYPE_GREETINGS: Record<string, string[]> = {
  corgi: ['气氛组就位，今天准备带哪场节奏？', '有你在的局，场子不会冷', '下一场热闹，缺你不行'],
  rooster: ['小太阳模式开启，今天想照亮谁？', '你的能量场，正在吸引同频的人', '去活动页，把你的光洒出去'],
  hamster_praise: ['夸夸雷达启动，今天也想给人打气', '你的每一句“好棒”都是社交货币', '去遇见值得被夸奖的人'],
  fox: ['狐狸雷达启动，今天又想嗅到什么新鲜事？', '探险家，下一张社交地图等你解锁', '去活动页，继续你的发现之旅'],
  dolphin_calm: ['灵感接收器已打开，今天会有什么新连接？', '读空气的你，适合去个舒服的小局', '慢慢来，对的人正在靠近'],
  spider: ['织网时间到，今天想把谁连进你的圈子？', '你的细腻观察，正在编织真正的连接', '去活动页，扩展你的人脉网'],
  koala: ['树洞已暖好，慢慢来也挺好', '今天想安静充电，还是去个温柔的小局？', '你的倾听，会让某个人感到被接住'],
  octopus: ['脑洞喷泉已加压，今天想碰撞什么奇思？', '你的联想力，正在制造意想不到的连接', '去遇见能接得住你脑洞的人'],
  owl: ['追问模式就绪，今天想解开什么好奇？', '你的问题，本身就是最好的开场白', '去活动页，找到愿意深聊的人'],
  elephant: ['定海神针在线，今天想稳住哪个局？', '可靠如你，是大家想靠近的底气', '去活动页，继续成为那个让人安心的人'],
  turtle: ['慢热星球运行稳定，今天想先观察还是加入？', '不着急，真正合适的连接会等你', '去活动页，按自己的节奏认识人'],
  cat: ['静音模式运行良好，今天想被世界怎样轻轻打扰？', '你的存在本身，就是一种舒适的信号', '去活动页，找到尊重你边界的人'],
}

export function getProfileCompletion(user?: AuthUser | null): number {
  if (!user) return 0
  const essential = user.profileEssentialComplete ? 40 : 0
  const extended = user.profileExtendedComplete ? 30 : 0
  // const archetype = user.archetype ? 30 : 0
  const archetype = (user.archetype ?? user.primaryArchetype) ? 30 : 0
  const bioBonus =
    typeof user.bio === 'string' && user.bio.trim().length > 0 ? 10 : 0
  return Math.min(100, essential + extended + archetype + bioBonus)
}

export function getXiaoyueGreeting(
  displayName: string,
  archetypeName: string | null,
  completion: number,
  isFirstVisit: boolean,
  userCity?: string | null,
): string {
  if (!archetypeName) {
    return '先测测你是哪种社交原型？'
  }
  if (isFirstVisit) {
    const cityBit = userCity ? `在${userCity}的` : ''
    return `欢迎来到你的 JoyJoin 基地，${cityBit}${archetypeName}`
  }
  if (completion < 100) {
    return `${archetypeName}，完成资料，让更多人找到你`
  }
  return `${archetypeName}，和悦聚玩家们一起探索吧`
}
