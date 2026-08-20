import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { PoolGroupMemberSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'

import { getVibeLabel as getVibeLabelShared } from '../../lib/matching/groupDisplay'
import {
  CHEMISTRY_FALLBACK_WORD,
  CHEMISTRY_TITLES,
  stripConnectionPointParens,
} from '../../lib/utils/pairChemistry'
import type { ChemistryType } from '../../lib/utils/pairChemistry'

// Pair-chemistry display helpers moved to lib/utils/pairChemistry (2026-08-15)
// so TablemateCard can share them; re-exported here for existing consumers.
export {
  buildInterestHookText,
  buildPairKeyMemberMap,
  getPairChemistryTier,
  getPairChemistryWord,
  shortenConnectionPointForPill,
  stripConnectionPointParens,
} from '../../lib/utils/pairChemistry'
export type { ChemistryType } from '../../lib/utils/pairChemistry'

export type FlowState = 'ready' | 'shaking' | 'revealed'
export type ActionDockState = 'hidden' | 'ready'
export type BlindBoxVisualState = 'ready' | 'opening' | 'open'

// Legacy type kept for backward compatibility in persisted analytics; UI now uses a single expandable panel.
export type AnalysisStage = 0 | 1 | 2 | 3 | 4

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
  // Education clause (2026-07-16 PM): sits right after industry in the beat
  // priority (connection > industry > education > hometown). The slice cap
  // below (2 with a pair explanation, else 3) pushes hometown/archetype out
  // first when every field is present, which protects the typewriter budget.
  const education = member?.educationVisible === false ? '' : normalize(member?.educationLevel)
  const interests = (member?.topInterests ?? []).map((interest) => normalize(interest)).filter(Boolean).slice(0, 3)
  const hometown = member?.hometownAffinityOptin === false ? '' : normalize(member?.hometownRegionCity)
  // member.archetype may be an ID or a legacy nameCn — resolve either form.
  const archetype = member?.archetype ? resolveArchetype(member.archetype)?.nameCn ?? '' : ''
  const profileBeats = [
    industry ? `在${industry}领域` : '',
    education ? `${education}学历` : '',
    interests.length > 0 ? `喜欢${interests.join('、')}` : '',
    hometown ? `来自${hometown}` : '',
    archetype ? `带着${archetype}的气质` : '',
  ].filter(Boolean)
  // BUG B (2026-07-28 overlap incident): when a pair explanation follows,
  // cap the intro at 2 beats — intro(3 beats) + explanation blew past the
  // bubble clamp and spilled over the 桌卡 strip in the locked revealed
  // column. The clamp tightened 4 → 3 lines on 2026-08-19 (auto-pocket
  // handoff), so the 2-beat cap matters even more.
  const reason = normalize(explanation)
  const hasReason = Boolean(reason) && !/还在.{0,8}(整理|寻找).{0,8}连接线索/.test(reason)
  const beatCap = hasReason ? 2 : 3
  const introduction = profileBeats.length > 0
    ? `先认识一下${name}：${profileBeats.slice(0, beatCap).join('，')}`
    : `先认识一下${name}：这是今晚会和你同桌的新伙伴`
  if (hasReason) {
    return `${introduction}。你们之间还有个连接点：${reason}。`
  }

  const points = connectionPoints.map((point) => normalize(point)).filter(Boolean).slice(0, 2)
  if (points.length > 0) return `${introduction}。你们都对${points.join('、')}感兴趣，见面可以从这里聊起。`

  const intro = normalize(introAngle)
  if (intro) return `${introduction}。悦仔也给你们留了个开场：${intro}。`

  // Dignity floor (2026-07-24 P0): never admit "没找到共同点" — the user just
  // paid, and conceding the engine found nothing actively negates that
  // purchase. Reframe as complementarity (archetype contrast IS a match
  // reason) and always hand over a concrete first move.
  const complement = archetype
    ? `TA身上${archetype}的气质，和你正好互补`
    : 'TA的气质和你正好互补'
  const opener = interests[0]
    ? `${complement}——今晚从${interests[0]}聊起，说不定能互相打开新话题。`
    : `${complement}——不妨先聊聊最近各自遇到的一件有趣小事。`
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

// ── "今晚这桌" event-type pill tone (2026-07-17) ───────────────────────────
// The brief-type pill renders as a colored label; the tone is derived from the
// pool's event type so 饭局 / 酒局 read as distinct categories at a glance.

/** Pill tone for the 今晚这桌 brief-type label. */
export function getEventTypePillTone(eventType?: string | null): 'dining' | 'drinks' | 'default' {
  if (!eventType) return 'default'
  if (eventType === 'dining' || eventType === 'dinner' || eventType === '饭局') return 'dining'
  if (eventType === 'bar' || eventType === 'drinks' || eventType === '酒局') return 'drinks'
  return 'default'
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

export function getChemistryWord(chemistry?: OverallChemistry | ChemistryType | null): string {
  if (chemistry && chemistry in CHEMISTRY_TITLES) {
    return CHEMISTRY_TITLES[chemistry as ChemistryType]
  }
  return CHEMISTRY_FALLBACK_WORD
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

// ── 桌型诊断 (2026-07-24 P0) ────────────────────────────────────────────────
// Deterministic roster → social-role read ("这桌：2个暖心派 + 1个气氛组").
// No LLM: each archetype maps to exactly one role from its ACOEXP profile
// (see the trait notes in archetypeNames.ts). Unknown archetypes are skipped.

export type SquadRoleKey = 'hype' | 'deep' | 'warm'

const SQUAD_ROLE_BY_ARCHETYPE: Record<string, SquadRoleKey> = {
  corgi: 'hype',
  rooster: 'hype',
  hamster_praise: 'hype',
  fox: 'deep',
  octopus: 'deep',
  owl: 'deep',
  dolphin_calm: 'warm',
  spider: 'warm',
  koala: 'warm',
  elephant: 'warm',
  turtle: 'warm',
  cat: 'warm',
}

const SQUAD_ROLE_LABELS: Record<SquadRoleKey, string> = {
  hype: '气氛组',
  deep: '深度派',
  warm: '暖心派',
}

const SQUAD_ROLE_ORDER: readonly SquadRoleKey[] = ['hype', 'deep', 'warm']

/** Self-addressed role labels ("你是这桌的气氛担当") for the 我 card. */
const SQUAD_ROLE_SELF_LABELS: Record<SquadRoleKey, string> = {
  hype: '气氛担当',
  deep: '深度担当',
  warm: '暖心担当',
}

/**
 * The viewer's own table role (2026-07-24 self-relevance pass): derived from
 * the same deterministic archetype→role map as the 桌型诊断. '' when the
 * archetype doesn't resolve.
 */
export function getSelfSquadRoleLabel(archetype?: string | null): string {
  if (!archetype) return ''
  const id = resolveArchetype(archetype)?.id
  const role = id ? SQUAD_ROLE_BY_ARCHETYPE[id] : undefined
  return role ? SQUAD_ROLE_SELF_LABELS[role] : ''
}

/**
 * 我-card narration with role positioning (2026-07-24): the self card's
 * bubble tells the user what they bring to the table — self-relevance is
 * the strongest blind-box hook ("我在这桌是什么位置").
 */
export function buildSelfCardBubbleText(roleLabel: string): string {
  const role = roleLabel.trim()
  return role
    ? `这张是你的桌友卡。你是这桌的${role}——悦仔把你放进来，就是要你把这份能量带上桌。`
    : SQUAD_SELF_CARD_BUBBLE_TEXT
}

export interface SquadDiagnosisSegment {
  key: SquadRoleKey
  label: string
  count: number
}

/**
 * Role-mix segments for the 桌型诊断 strip. Fixed hype→deep→warm order,
 * zero-count segments dropped. Empty when no member archetype resolves.
 */
export function buildTableDiagnosis(members: PoolGroupMemberSummary[]): SquadDiagnosisSegment[] {
  const counts: Record<SquadRoleKey, number> = { hype: 0, deep: 0, warm: 0 }
  for (const member of members) {
    if (!member.archetype) continue
    const id = resolveArchetype(member.archetype)?.id
    const role = id ? SQUAD_ROLE_BY_ARCHETYPE[id] : undefined
    if (role) counts[role] += 1
  }
  return SQUAD_ROLE_ORDER
    .filter((key) => counts[key] > 0)
    .map((key) => ({ key, label: SQUAD_ROLE_LABELS[key], count: counts[key] }))
}

// ── 结构化同频分析卡 (2026-07-24 P1) ────────────────────────────────────────
// Focused-member narration as verdict → evidence chips → opener instead of
// one flat prose block. Returns null when the pair data is too thin to
// structure — the caller then falls back to the (dignity-floored) prose
// bubble from buildFocusedMemberBubbleText.

export interface FocusedNarrativeModel {
  verdict: string
  /** Up to 3 connection points, paren-stripped, chip-ready. */
  evidence: string[]
  /** Concrete first move; '' when nothing quotable exists. */
  opener: string
  isBestPartner: boolean
}

export function buildFocusedNarrativeModel(
  pair: PairExplanation | null | undefined,
  opts: { isBestPartner: boolean },
): FocusedNarrativeModel | null {
  if (!pair) return null
  const normalize = (value?: string | null) => (value ?? '').trim().replace(/[。！？，\s]*$/, '')

  const rawPoints = pair.connectionPointsWithRarity && pair.connectionPointsWithRarity.length > 0
    ? pair.connectionPointsWithRarity.map((point) => point.text)
    : (pair.connectionPoints ?? [])
  const evidence = rawPoints
    .map((point) => stripConnectionPointParens(normalize(point)))
    .filter(Boolean)
    .slice(0, 3)

  const intro = normalize(pair.introAngle)
  const explanation = normalize(pair.explanation)
  const opener = intro || (evidence.length > 0 ? `见面可以先从${evidence[0]}聊起` : '')

  // Too thin to structure → prose fallback (still dignity-floored).
  if (evidence.length === 0 && !opener && !explanation) return null

  const score = typeof pair.chemistryScore === 'number' ? pair.chemistryScore : null
  const verdict = opts.isBestPartner
    ? '这是今晚和你最同频的人'
    : score === null
      ? '你们俩的气场很有意思'
      : score >= 85
        ? '你们俩大概率一见如故'
        : score >= 70
          ? '你们俩大概率聊得来'
          : score >= 55
            ? '你们俩有不少可聊的点'
            : '你们俩是互补型同桌'

  return { verdict, evidence, opener, isBestPartner: opts.isBestPartner }
}
