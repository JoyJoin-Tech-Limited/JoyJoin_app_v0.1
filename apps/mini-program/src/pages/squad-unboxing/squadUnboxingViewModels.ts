import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { PoolGroupMemberSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
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

export interface CardFocusResolution {
  nextIndex: number
  animateNarration: boolean
  action: 'focus' | 'complete' | 'dismiss'
}

export function resolveCardFocusInteraction(
  currentIndex: number,
  tappedIndex: number,
  hasBeenSeen: boolean,
  isNarrationAnimating: boolean,
): CardFocusResolution {
  if (currentIndex !== tappedIndex) {
    return {
      nextIndex: tappedIndex,
      animateNarration: !hasBeenSeen,
      action: 'focus',
    }
  }

  if (isNarrationAnimating) {
    return {
      nextIndex: tappedIndex,
      animateNarration: false,
      action: 'complete',
    }
  }

  return {
    nextIndex: -1,
    animateNarration: false,
    action: 'dismiss',
  }
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
 * Server-side connection copy sometimes arrives wrapped in full-width parens
 * (e.g. （都偏内向细腻）). Inside the pill's 1-line nowrap+ellipsis the leading
 * （ made the truncated text read as a severed fragment (`（都偏内向…`). Strip
 * one pair of WRAPPING full-width parens so the pill starts with content.
 * Inner parens and unbalanced pairs are left untouched.
 */
export function stripConnectionPointParens(text: string): string {
  const value = (text ?? '').trim()
  if (value.length >= 2 && value.startsWith('（') && value.endsWith('）')) {
    return value.slice(1, -1).trim()
  }
  return value
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
  // member.archetype may be an ID or a legacy nameCn — resolve either form.
  const archetype = member?.archetype ? resolveArchetype(member.archetype)?.nameCn ?? '' : ''
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

// ── Tap-to-reveal copy set (2026-07-14) ─────────────────────────────────────
// Wording is craft-owned (xiaoyue-writing-craft, AC-20) — the strings live
// here so the copy review has exactly one place to edit. Exclamations stay
// restrained; the chip carries an explicit tap verb so tappability reads
// without motion cues.

/**
 * The 我 card's own narration line (moved from the page for the copy review).
 * Plays when the user deliberately focuses their own card — never auto-fired.
 */
export const SQUAD_SELF_CARD_BUBBLE_TEXT =
  '这张是你的桌友卡。悦仔把你放进这桌，也把属于你的视角带进了今晚。'

/**
 * Single group-completion bubble line after a reveal-all burst finishes
 * (AC-05). Replaces any per-member narration; chip = progress, bubble = voice.
 */
export const SQUAD_BURST_COMPLETION_BUBBLE_TEXT = '全员揭晓，今晚这桌，慢慢认识。'

/**
 * Resting bubble while the deck still holds face-down cards in an interactive
 * session (C1). The soul line is earned once every card is face-up — until
 * then the bubble explains the game, not the group. No exclamation: the chip
 * already carries the call to act.
 */
export const SQUAD_TEASE_BUBBLE_TEXT = '桌友卡都扣好了，轻点翻开，看看今晚和谁一桌。'

/**
 * Pocketed-phase resting voice while face-down cards remain (2026-07-15
 * audit CONCERN-1): the plain tease line invites tapping cards that are
 * hidden inside the pill, so while the deck is pocketed the verb changes
 * from 翻开 to 拉下. Deliberately distinct from the one-time hint
 * (`SQUAD_DECK_POCKETED_HINT_TEXT`) — that teaches the gesture once; this is
 * the standing resting voice and names the affordance (小条 = the pill).
 */
export const SQUAD_TEASE_POCKETED_BUBBLE_TEXT = '拉下小条，继续揭晓今晚的同桌。'

/**
 * Hint-chip label — live unflipped count plus an explicit tap verb, since the
 * chip doubles as the reveal-all trigger (AC-04). Absent when N = 0.
 */
export function buildRevealChipLabel(unflippedCount: number): string {
  return `还有 ${unflippedCount} 位桌友未揭晓 · 轻点全部翻开`
}

// ── "Pocket the deck" copy set (2026-07-15) ─────────────────────────────────
// Two-phase reveal: full-screen fan ⇄ pocketed pill. Copy is craft-owned; the
// strings live here so the copy review has exactly one place to edit.

/** Collapse trigger chip below the card fan (fan phase only). */
export const SQUAD_DECK_COLLAPSE_TRIGGER_LABEL = '收起卡组'

/** Screen-reader announcement when the deck finishes pocketing (AC-09). */
export const SQUAD_DECK_POCKETED_ANNOUNCEMENT = '卡组已收起'

/**
 * One-time Xiaoyue hint shown near the pill after the FIRST collapse
 * (AC-10). Teaches the pull-down gesture; gated by the same storage flag as
 * the `firstCollapse` analytics property.
 */
export const SQUAD_DECK_POCKETED_HINT_TEXT = '卡组收好啦，随时拉下来看看～'

/** Pill aria-label — tap/pull re-fans the deck (AC-04/AC-09). */
export function buildDeckPillAriaLabel(memberCount: number): string {
  return `展开卡组，查看你的${memberCount}位桌友`
}

// ── "今晚这桌" collapsible panel copy (2026-07-16) ──────────────────────────
// The event-brief chapter is collapsed by default in the revealed state; a
// single toggle below the 团魂 bubble expands it in place.

/** Toggle label — mirrors the chapter title so the button "contains" the panel. */
export const SQUAD_TONIGHTS_TABLE_TOGGLE_LABEL = '今晚这桌'

/** Toggle aria-label — state-aware action verb for screen readers. */
export function buildTonightsTableToggleAriaLabel(open: boolean): string {
  return open ? '收起今晚这桌详情' : '展开今晚这桌，查看时间地点'
}

/** Mini-strip cap inside the pill; the rest collapses into a +N chip. */
export const DECK_PILL_STRIP_CAP = 5

export interface DeckPillStripItem {
  member: PoolGroupMemberSummary
  /** Face-up members show their avatar/archetype mini; face-down show a card-back chip (spoiler gating). */
  faceUp: boolean
  isBestPartner: boolean
  isCurrentUser: boolean
}

export interface DeckPillStripModel {
  items: DeckPillStripItem[]
  overflowCount: number
  totalCount: number
}

/**
 * Pill strip model (AC-03/SCA-01): the first DECK_PILL_STRIP_CAP members in
 * roster order; the remainder collapses into a +N overflow chip. Face derives
 * from the controller-owned flip set (same spoiler gating as the fan); the
 * 最佳拍档 keeps its tint ring inside the strip.
 */
export function buildDeckPillStripModel(
  members: PoolGroupMemberSummary[],
  opts: {
    flippedIds: ReadonlySet<string>
    allRevealed: boolean
    bestPartnerUserId: string | null
    currentUserId?: string | null
  },
): DeckPillStripModel {
  const visible = members.slice(0, DECK_PILL_STRIP_CAP)
  return {
    items: visible.map((member) => ({
      member,
      faceUp: opts.allRevealed || opts.flippedIds.has(member.userId),
      isBestPartner: member.userId === opts.bestPartnerUserId,
      isCurrentUser: member.userId === opts.currentUserId,
    })),
    overflowCount: Math.max(0, members.length - DECK_PILL_STRIP_CAP),
    totalCount: members.length,
  }
}

/**
 * Chemistry-tinted border ring for the pill (AC-03). Mirrors the chemistry
 * chip token mapping (fire→error, warm→secondary, cold→success, mild→primary)
 * so the pill reads as the same table the fan just showed.
 */
export function getDeckPillChemistryClass(chemistry?: OverallChemistry | null): string {
  switch (chemistry) {
    case 'fire':
      return 'squad-unboxing__deck-pill--fire'
    case 'warm':
      return 'squad-unboxing__deck-pill--warm'
    case 'cold':
      return 'squad-unboxing__deck-pill--cold'
    default:
      return 'squad-unboxing__deck-pill--fallback'
  }
}

/**
 * Screen-reader label for a face-down card (AC: labelled tap targets with
 * reveal-invitation semantics). Names are already visible on the front; the
 * back itself carries no identity text.
 */
export function buildFaceDownCardAriaLabel(memberName: string, isCurrentUser: boolean): string {
  const name = memberName.trim() || '这位桌友'
  return isCurrentUser ? '我的桌友卡，还未翻开' : `${name}的桌友卡，还未翻开，轻点揭晓`
}

/**
 * The viewer's highest-chemistryScore tablemate. Deterministic roster-order
 * tie-break: the first member in roster order with the max score wins (strict
 * `>` keeps the earliest on ties). Returns null when no viewer pairs exist.
 * Moved from SquadDeckStage so the controller can reuse it for flip
 * analytics payloads (isBestPartner).
 */
export function computeBestPartnerUserId(
  members: PoolGroupMemberSummary[],
  currentUserId: string | null | undefined,
  viewerPairByMemberId: Map<string, PairExplanation | null>,
): string | null {
  let bestUserId: string | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const member of members) {
    if (member.userId === currentUserId) continue
    const pair = viewerPairByMemberId.get(member.userId)
    if (!pair) continue
    const score = typeof pair.chemistryScore === 'number' ? pair.chemistryScore : Number.NEGATIVE_INFINITY
    if (score > bestScore) {
      bestScore = score
      bestUserId = member.userId
    }
  }
  return bestUserId
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
