import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { TIER_PRESETS } from '../tierPresets'
import type { VibeId } from '../../../lib/vibeMapping'
import type { SessionParticipant } from '../phaseUtils'

export type WarmupCardState =
  | 'host_no_topics'
  | 'player_no_topics'
  | 'generating'
  | 'topic_card'
  | 'error'
  | 'terminal'

export interface ResolveCardStateInput {
  topics: SocialTopic[]
  currentIndex: number
  isHost: boolean
  isGeneratingTopics: boolean
  topicsError: boolean
}

/**
 * Resolve the hero card slot state machine (contract Q7 / AC5).
 *
 * Priority: error > generating > empty topics (host/player) > terminal > topic card.
 */
export function getWarmupCardState(input: ResolveCardStateInput): WarmupCardState {
  if (input.topicsError) return 'error'
  if (input.isGeneratingTopics) return 'generating'
  if (input.topics.length === 0) {
    return input.isHost ? 'host_no_topics' : 'player_no_topics'
  }
  if (input.currentIndex >= input.topics.length) return 'terminal'
  return 'topic_card'
}

export interface ArchetypeCount {
  id: string
  name: string
  count: number
}

/**
 * Build archetype mix text client-side from participant roster.
 * Mirrors server-side buildArchetypeContext logic.
 */
export function buildArchetypeMixText(participants: SessionParticipant[]): string {
  const counts = new Map<string, number>()
  for (const p of participants) {
    if (p.archetype) {
      counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return ''

  const segments: string[] = []
  for (const [id, count] of counts) {
    const def = ARCHETYPE_BY_ID[id]
    const name = def?.nameCn ?? id
    segments.push(count > 1 ? `${name}×${count}` : name)
  }
  return segments.join('、')
}

/**
 * Count archetypes by occurrence, preserving the original join order as a stable
 * tie-breaker (counts descending, then first-seen index ascending).
 */
export function countArchetypes(participants: SessionParticipant[]): ArchetypeCount[] {
  const seenOrder = new Map<string, number>()
  const counts = new Map<string, number>()
  participants.forEach((p, index) => {
    if (!p.archetype) return
    if (!seenOrder.has(p.archetype)) {
      seenOrder.set(p.archetype, index)
    }
    counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      name: ARCHETYPE_BY_ID[id]?.nameCn ?? id,
      count,
      firstSeen: seenOrder.get(id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.firstSeen - b.firstSeen
    })
    .map(({ id, name, count }) => ({ id, name, count }))
}

/**
 * Welcome-line copy matrix (contract Q10).
 *
 * Returns segments so the caller can render archetype names in accent color.
 * The viewer's archetype is accepted for future personalization but is not
 * used in the locked matrix; ordering is by count desc, then join order.
 */
export interface WelcomeSegment {
  text: string
  accentArchetype?: string
}

export function buildWelcomeSegments(
  participants: SessionParticipant[],
  _viewerArchetype?: string,
): WelcomeSegment[] {
  const counts = countArchetypes(participants)
  const total = participants.length

  if (total === 0 || counts.length === 0) {
    return [{ text: '先到先聊，抽张话题卡暖暖场' }]
  }

  if (total === 1) {
    const a = counts[0]
    return [
      { text: '今晚是' },
      { text: a.name, accentArchetype: a.id },
      { text: '的试玩时间' },
    ]
  }

  if (counts.length === 1) {
    const a = counts[0]
    return [
      { text: '一桌子' },
      { text: a.name, accentArchetype: a.id },
      { text: '，先抽张卡暖暖场' },
    ]
  }

  if (counts.length === 2) {
    const a = counts[0]
    const b = counts[1]
    return [
      { text: a.name, accentArchetype: a.id },
      { text: '和' },
      { text: b.name, accentArchetype: b.id },
      { text: '的小桌，先抽张卡暖暖场' },
    ]
  }

  const a = counts[0]
  const b = counts[1]
  return [
    { text: a.name, accentArchetype: a.id },
    { text: '、' },
    { text: b.name, accentArchetype: b.id },
    { text: '和伙伴们的小桌，先抽张卡暖暖场' },
  ]
}

/** String variant of the welcome line (for tests / logging). */
export function buildWelcomeLine(
  participants: SessionParticipant[],
  viewerArchetype?: string,
): string {
  return buildWelcomeSegments(participants, viewerArchetype)
    .map((s) => s.text)
    .join('')
}

export function buildCelebrationLine(archetypeMixText?: string): string {
  const mix = archetypeMixText?.trim() ?? ''
  return mix ? `气氛组集结完毕：${mix}` : '气氛组集结完毕'
}

export interface CTAState {
  primary: string
  /** True when the host secondary "进入下一题 ›" should render. */
  secondaryVisible: boolean
  /** True when the small "取消" unlink row should render under the primary CTA. */
  showCancel: boolean
}

/**
 * Resolve the primary CTA label and secondary-button visibility (contract Q6).
 */
export function buildCTAState(
  isReady: boolean,
  isHost: boolean,
  everyoneReady: boolean,
  isLastTopic: boolean,
): CTAState {
  if (everyoneReady && isHost && isLastTopic) {
    return { primary: '本轮结束', secondaryVisible: false, showCancel: false }
  }

  const secondaryVisible = everyoneReady && isHost && !isLastTopic

  if (isReady) {
    // Cancel is hidden only when the host has the "next/end" authority available.
    const showCancel = !(everyoneReady && isHost)
    return { primary: '已准备 ✓', secondaryVisible, showCancel }
  }

  return { primary: '我准备好了', secondaryVisible, showCancel: false }
}

/** Generate the band-① caption: `{vibeLabel} · 约{duration}min`; custom → `自由局`. */
export function buildWarmupCaption(
  vibe?: VibeId,
  tier?: TierMachineId,
  isCustomMode?: boolean,
): string {
  if (isCustomMode || tier === 'custom') {
    return '自由局'
  }
  const preset = tier ? TIER_PRESETS.find((p) => p.tier === tier && p.vibe === vibe) : undefined
  if (preset) {
    return `${preset.title} · 约${preset.duration.replace('min', '分钟')}`
  }
  // Fallback to raw vibe id when no preset matches.
  const vibeLabel = vibe === 'deep_chat' ? '深度畅聊' : vibe === 'play_fun' ? '游戏狂欢' : '轻松破冰'
  return `${vibeLabel} · 约60分钟`
}

/** Corner text for the topic card: `深度 · L{n}` for deep_chat, hidden for play_fun. */
export function getDepthCornerText(vibe?: VibeId, depthLevel?: number | null): string | null {
  if (vibe === 'deep_chat' && depthLevel) {
    return `深度 · L${depthLevel}`
  }
  if (vibe === 'play_fun') {
    return null // 快速暖场 per contract, but rendered as hidden.
  }
  return null
}

export interface MoodOptionRender {
  mood: AtmosphereMood
  label: string
  asset: string
  isActive: boolean
  isDisabled: boolean
}

/** Build the 2×2 mood option grid render model. */
export function buildMoodOptions(
  moods: Array<{ mood: AtmosphereMood; label: string; asset: string }>,
  selectedMood?: AtmosphereMood,
  isGenerating?: boolean,
): MoodOptionRender[] {
  return moods.map((m) => ({
    ...m,
    isActive: m.mood === selectedMood,
    isDisabled: !!isGenerating,
  }))
}

/** Total number of topics for progress dots. */
export function getTotalTopics(topics: SocialTopic[]): number {
  return Math.max(topics.length, 1)
}
