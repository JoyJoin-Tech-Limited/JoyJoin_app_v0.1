import type { PoolRegistrationSummary } from '@shared/api'
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
  /** Badge artwork URL — null while the Batch-D2 Lovart assets (5/10/20场)
   *  are pending; locked cells then render the CSS lock medallion, unlocked
   *  cells a gold medallion. Wire the CDN path here when the art lands. */
  badge: string | null
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
  return archetype ? '回看氛围报告' : '完成氛围测试'
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
  // P1-4 (2026-10-22, PM memo §3): the wall grows to the 5-tier ladder
  // 1/3/5/10/20 场. Badge art for the three new tiers lands with Lovart
  // Batch-D2 (brief: docs/design/lovart-brief-milestone-batch-d2-20261022.md)
  // — until then badge:null renders the CSS medallion states.
  {
    key: 'regular5',
    label: '渐入佳境',
    threshold: 5,
    badge: null,
    ariaLabel: '渐入佳境徽章',
  },
  {
    key: 'veteran10',
    label: '悦聚常客',
    threshold: 10,
    badge: null,
    ariaLabel: '悦聚常客徽章',
  },
  {
    key: 'legend20',
    label: '城市传说',
    threshold: 20,
    badge: null,
    ariaLabel: '城市传说徽章',
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

/**
 * Tone-aware greetings for completed profiles — makes Xiaoyue feel tailored
 * per archetype. Pool depth is 5 per archetype (2026-10-23, re-audit a3):
 * a 3-line pool repeated every third day for daily openers; 5 lines give a
 * workday week of variety. Copy rules: no 匹配/社交/灵魂/AI tokens, no
 * fabricated urgency — affirmation and soft 活动页 CTAs only.
 */
export const ARCHETYPE_GREETINGS: Record<string, string[]> = {
  corgi: ['气氛组就位，今天准备带哪场节奏？', '有你在的局，场子不会冷', '下一场热闹，缺你不行', '只要你在，冷场这个词不存在', '今晚气氛组组长的位置，给你留着'],
  rooster: ['小太阳模式开启，今天想照亮谁？', '你的能量场，正在吸引同频的人', '去活动页，把你的光洒出去', '先把自己晒暖，再去暖别人', '今天的活动页，有几场很适合发光'],
  hamster_praise: ['夸夸雷达启动，今天也想给人打气', '你的每一句“好棒”都会被人记住', '去遇见值得被夸奖的人', '被你夸过的人，今天也在偷偷开心', '攒了一周的夸奖额度，去发放吧'],
  fox: ['狐狸雷达启动，今天又想嗅到什么新鲜事？', '探险家，下一张城市地图等你解锁', '去活动页，继续你的发现之旅', '新局的名单里，藏着下一段故事', '保持好奇，转角就有新发现'],
  dolphin_calm: ['灵感接收器已打开，今天会有什么新连接？', '读空气的你，适合去个舒服的小局', '慢慢来，对的人正在靠近', '安静的局也有它的频率，你听得见', '灵感不赶时间，它喜欢松弛的人'],
  spider: ['织网时间到，今天想遇见哪位同路人？', '你的细腻观察，正在编织真正的连接', '去活动页，扩展你的人脉网', '每一次真诚寒暄，都是一根新丝线', '你织的网，比你想象的更大'],
  koala: ['树洞已暖好，慢慢来也挺好', '今天想安静充电，还是去个温柔的小局？', '你的倾听，会让某个人感到被接住', '不必急着说话，你在场就很好', '温柔的小局，正在等你推门'],
  octopus: ['脑洞喷泉已加压，今天想碰撞什么奇思？', '你的联想力，正在制造意想不到的连接', '去遇见能接得住你脑洞的人', '奇怪的想法，留给接得住的人', '下一场对话，可能就诞生一个点子'],
  owl: ['追问模式就绪，今天想解开什么好奇？', '你的问题，本身就是最好的开场白', '去活动页，找到愿意深聊的人', '好问题，值得一个好听众', '有一场深聊，正在排队等你'],
  elephant: ['定海神针在线，今天想稳住哪个局？', '可靠如你，是大家想靠近的底气', '去活动页，继续成为那个让人安心的人', '你在的桌，大家都坐得更安心', '稳定也是一种魅力，而且稀缺'],
  turtle: ['慢热星球运行稳定，今天想先观察还是加入？', '不着急，真正合适的连接会等你', '去活动页，按自己的节奏认识人', '先观察三巡，再决定要不要举杯', '慢热的人，熟起来最耐看'],
  cat: ['静音模式运行良好，今天想被世界怎样轻轻打扰？', '你的存在本身，就是一种舒适的信号', '去活动页，找到尊重你边界的人', '不想说话的局，也有你的位置', '恰到好处的距离，也是一种亲近'],
}

/**
 * P0-3 (2026-10-22): daily-rotating greeting for the identity card's bio
 * line. Deterministic per calendar day (day-of-year % pool size) so the line
 * is stable within a day but fresh across days. Returns null for unknown
 * archetypes — callers then fall back to the static archetype tagline.
 */
export function getDailyGreeting(
  archetype: string | null | undefined,
  date: Date = new Date(),
): string | null {
  if (!archetype) return null
  const pool = ARCHETYPE_GREETINGS[archetype]
  if (!pool || pool.length === 0) return null
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000)
  return pool[dayOfYear % pool.length] ?? null
}

/**
 * P0-4 streak capsule ladder — mirrors the server awards in
 * apps/server/src/gamificationService.ts (3/6/12 weeks → +200/+500/+1000 XP).
 * If the server ladder changes, update this AND the contract test below.
 */
export const STREAK_MILESTONE_LADDER: ReadonlyArray<{ weeks: number; xp: number }> = [
  { weeks: 3, xp: 200 },
  { weeks: 6, xp: 500 },
  { weeks: 12, xp: 1000 },
]

/**
 * P0-4: near-milestone teaser for the streak capsule. Returns the rung only
 * when the user is exactly ONE week away (streak + 1 hits a ladder rung);
 * null otherwise. The naive `3 - (N % 3) === 1` check misfires at N=8 (9 is
 * not a rung) — the ladder lookup is the correct gate.
 */
export function getStreakMilestoneTeaser(streak: number): { weeks: number; xp: number } | null {
  if (!Number.isFinite(streak) || streak < 0) return null
  return STREAK_MILESTONE_LADDER.find((rung) => rung.weeks === streak + 1) ?? null
}

// ---- Full-marks Wave A (2026-10-23, PM plan) -------------------------------

/** Monday 00:00Z of the UTC ISO week containing `time` (ms). */
function getUtcIsoWeekStart(time: number): number {
  const day = new Date(time).getUTCDay() // 0=Sun..6=Sat
  return time - ((day + 6) % 7) * 86_400_000
}

/**
 * A5-1: streak-continuation target (streak + 1) when the user must attend
 * THIS week to keep the flame alive; null when the streak is safe (already
 * attended this week), at zero, or unrecoverable (server will reset).
 *
 * Truth condition mirrors apps/server/src/gamificationService.ts
 * updateStreak: lastActivityDate is stored as a UTC date string
 * ('YYYY-MM-DD' via toISOString) and the streak increments when the ISO-week
 * gap is exactly 1 (or 2 with an unused freeze card). We reproduce the gap
 * with UTC week starts so a +08:00 device cannot disagree with the UTC
 * container by up to 8h at the Monday boundary. Year-boundary parity was
 * checked against the server's getWeeksDiff (correct for gaps ≤ 2).
 */
export function getStreakContinuationTarget(
  activityStreak: number,
  lastActivityDate: string | null | undefined,
  streakFreezeAvailable: boolean,
  now: Date = new Date(),
): number | null {
  if (!Number.isFinite(activityStreak) || activityStreak <= 0) return null
  if (!lastActivityDate) return null
  const last = Date.parse(`${lastActivityDate}T00:00:00Z`)
  if (Number.isNaN(last)) return null
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const weeksDiff = Math.round(
    (getUtcIsoWeekStart(todayUtc) - getUtcIsoWeekStart(last)) / (7 * 86_400_000),
  )
  if (weeksDiff <= 0) return null
  if (weeksDiff === 1) return activityStreak + 1
  if (weeksDiff === 2 && streakFreezeAvailable) return activityStreak + 1
  return null
}

/**
 * A5-2: next upcoming registration — pending or matched with the event time
 * still in the future, soonest first. `finalDateTime` (revealed time) wins
 * over `poolDateTime` when present, matching the server's precedence.
 */
export function getNextUpcomingRegistration(
  registrations: PoolRegistrationSummary[] | null | undefined,
  now: Date = new Date(),
): PoolRegistrationSummary | null {
  if (!registrations?.length) return null
  const nowMs = now.getTime()
  let best: PoolRegistrationSummary | null = null
  let bestMs = Infinity
  for (const reg of registrations) {
    if (reg.matchStatus !== 'pending' && reg.matchStatus !== 'matched') continue
    const timeStr = reg.finalDateTime ?? reg.poolDateTime
    if (!timeStr) continue
    const ms = Date.parse(timeStr)
    if (Number.isNaN(ms) || ms <= nowMs) continue
    if (ms < bestMs) {
      best = reg
      bestMs = ms
    }
  }
  return best
}

/**
 * A4-3: event-day greeting — when the user has an event TODAY the greeting
 * line becomes concrete (time + district) instead of the daily rotation.
 * Copy decision (PM plan): factual 「今天 HH:mm 有局 · {district}见」 — no
 * 今晚 (morning events exist), no exclamation inflation. Wall-clock fields
 * use device-local time because this is a user-facing clock, unlike the
 * streak math above which must match the UTC server.
 */
export function getEventDayGreeting(
  registrations: PoolRegistrationSummary[] | null | undefined,
  now: Date = new Date(),
): string | null {
  const next = getNextUpcomingRegistration(registrations, now)
  if (!next) return null
  const timeStr = next.finalDateTime ?? next.poolDateTime
  if (!timeStr) return null
  const ms = Date.parse(timeStr)
  if (Number.isNaN(ms)) return null
  const eventDate = new Date(ms)
  const sameDay =
    eventDate.getFullYear() === now.getFullYear() &&
    eventDate.getMonth() === now.getMonth() &&
    eventDate.getDate() === now.getDate()
  if (!sameDay) return null
  const hh = String(eventDate.getHours()).padStart(2, '0')
  const mm = String(eventDate.getMinutes()).padStart(2, '0')
  const district = next.poolDistrict ? ` · ${next.poolDistrict}见` : ''
  return `今天 ${hh}:${mm} 有局${district}`
}

/** A2-3: 「M月D日」 for the story title's chapter date. */
export function formatChapterDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * P0 (re-audit #3, 2026-10-23): the server's canonical chapter title is
 * `${YYYY.MM.DD} · ${activityType}` (formatPersonalStoryChapterTitle, locked
 * by server test) — the date is already IN the title. A2-3 appends
 * 「· M月D日写下」, so the display title must strip the server date prefix
 * first or the date renders twice. Titles without the prefix pass through
 * unchanged; null → null; a prefix-only title falls back to the original.
 */
export function stripChapterDatePrefix(title: string | null | undefined): string | null {
  if (!title) return null
  const stripped = title.replace(/^\d{4}\.\d{2}\.\d{2}\s*·\s*/, '').trim()
  return stripped.length > 0 ? stripped : title
}

/**
 * A5-3: badge proximity — the first locked milestone within `maxRemaining`
 * events. Returns null when nothing is close (no nagging from far away).
 */
export function getBadgeProximity(
  joinedEventsCount: number,
  maxRemaining = 3,
): { label: string; remaining: number } | null {
  if (!Number.isFinite(joinedEventsCount)) return null
  const next = MILESTONES.find((milestone) => milestone.threshold > joinedEventsCount)
  if (!next) return null
  const remaining = next.threshold - joinedEventsCount
  return remaining > 0 && remaining <= maxRemaining
    ? { label: next.label, remaining }
    : null
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
