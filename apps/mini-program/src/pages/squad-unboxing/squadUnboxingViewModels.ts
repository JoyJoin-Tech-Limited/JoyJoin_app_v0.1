import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { PoolGroupMemberSummary } from '@shared/api'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
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

// Icebreaker vibe ids (run-plan system) — the shared getVibeLabel only maps
// legacy event vibes and falls through to the raw id for these, so the squad
// surface owns the mapping. Keys include the legacy compiler aliases.
const SQUAD_VIBE_LABELS: Record<string, string> = {
  deep_chat: '深聊',
  balanced: '均衡',
  play_fun: '畅玩',
  chat: '深聊',
  game: '畅玩',
}

export function getVibeLabel(vibe?: string | null): string {
  if (vibe && SQUAD_VIBE_LABELS[vibe]) return SQUAD_VIBE_LABELS[vibe]
  return getVibeLabelShared(vibe, '今晚成桌')
}

// Canonical event-type → label mapping, matching EVENT_TYPE_LABELS used on
// the events surfaces (see components/discover/OracleCard.tsx).
const EVENT_TYPE_LABELS: Record<string, string> = {
  '饭局': '饭局', '酒局': '酒局', '其他': '其他',
  dinner: '饭局', dining: '饭局', drinks: '酒局', bar: '酒局', other: '其他',
}

export function getEventTypeLabel(eventType?: string | null): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

/**
 * Structured date breakdown for the event-brief card header (big day numeral
 * + month/weekday/time side column). Returns null for missing/invalid input
 * so the header can collapse gracefully (sparse-state rule).
 */
export interface EventBriefDate {
  day: string
  month: string
  weekday: string
  time: string
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function buildEventBriefDate(dateTime?: string | null): EventBriefDate | null {
  if (!dateTime) return null
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    day: String(parsed.getDate()),
    month: `${parsed.getMonth() + 1}月`,
    weekday: WEEKDAY_LABELS[parsed.getDay()],
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  }
}

/**
 * 团魂 bubble copy. The archetype-mix clause is only inserted when non-empty,
 * so the bubble never renders a stranded `！，` when no member archetypes are
 * known. Trailing punctuation on each line is stripped before the final `。`
 * to avoid doubled sentence endings.
 *
 * The group-analysis dynamic is folded in as a short follow-on beat (the
 * "Cascading Hand Fan" revamp retires the standalone group-analysis header) —
 * but only when it adds something the companion line didn't already say.
 */
export function buildSquadSoulBubbleText(
  mix: string,
  companion?: string | null,
  dynamics?: string | null,
): string {
  const normalize = (value?: string | null) => (value ?? '').trim().replace(/[。！？，\s]*$/, '')
  const normalizedCompanion = normalize(companion)
  const resolvedCompanion = normalizedCompanion || `${DEFAULT_MASCOT_DISPLAY_NAME}觉得这桌会聊得很自然`
  const trimmedMix = mix.trim()
  const head = trimmedMix
    ? `人到齐了！${trimmedMix}，${resolvedCompanion}。`
    : `人到齐了！${resolvedCompanion}。`
  const normalizedDynamics = normalize(dynamics)
  const extra = normalizedDynamics && normalizedDynamics !== normalizedCompanion ? normalizedDynamics : ''
  return extra ? `${head}${extra}。` : head
}

/**
 * Card-focus narration for the fixed Xiaoyue dock. Pair explanations are
 * already generated from both members' profiles by matchExplanationService;
 * this formatter only gives that governed copy a concise mascot voice.
 */
export function buildFocusedMemberBubbleText(
  memberName: string,
  explanation?: string | null,
  connectionPoints: string[] = [],
  introAngle?: string | null,
  member?: PoolGroupMemberSummary | null,
): string {
  const normalize = (value?: string | null) => (value ?? '').trim().replace(/[。！？，\s]*$/, '')
  const name = memberName.trim() || '这位桌友'
  const industry = member?.industryVisible === false
    ? ''
    : normalize(member?.industryNicheLabel ?? member?.industryCategoryLabel)
  const interests = (member?.topInterests ?? []).map((interest) => normalize(interest)).filter(Boolean).slice(0, 3)
  const hometown = member?.hometownAffinityOptin === false ? '' : normalize(member?.hometownRegionCity)
  const archetype = member?.archetype ? ARCHETYPE_BY_ID[member.archetype]?.nameCn : ''
  const profileBeats = [
    industry ? `在${industry}领域` : '',
    interests.length > 0 ? `喜欢${interests.join('、')}` : '',
    hometown ? `来自${hometown}` : '',
    archetype ? `带着${archetype}的社交气质` : '',
  ].filter(Boolean)
  const introduction = profileBeats.length > 0
    ? `先认识一下${name}：${profileBeats.slice(0, 3).join('，')}`
    : `先认识一下${name}：这是今晚会和你同桌的新伙伴`
  const reason = normalize(explanation)
  if (reason && !/还在.{0,8}(整理|寻找).{0,8}连接线索/.test(reason)) {
    return `${introduction}。你们之间还有个连接点：${reason}。`
  }

  const points = connectionPoints.map((point) => normalize(point)).filter(Boolean).slice(0, 2)
  if (points.length > 0) return `${introduction}。你们都对${points.join('、')}感兴趣，见面可以从这里聊起。`

  const intro = normalize(introAngle)
  if (intro) return `${introduction}。悦仔也给你们留了个开场：${intro}。`

  const opener = interests[0]
    ? `你们的共同点还没显出来，不妨先问问${interests[0]}背后的故事。`
    : '你们的共同点还没显出来，不妨先聊聊最近各自遇到的一件有趣小事。'
  return `${introduction}。${opener}`
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
