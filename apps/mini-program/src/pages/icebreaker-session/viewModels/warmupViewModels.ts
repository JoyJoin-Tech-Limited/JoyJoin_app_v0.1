import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import type { AtmosphereMood, SocialTopic } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { TIER_PRESETS } from '../tierPresets'
import type { VibeId } from '../../../lib/vibeMapping'
import type { SessionParticipant } from '../phaseUtils'

export type WarmupCardState =
  | 'host_no_topics'
  | 'player_no_topics'
  | 'generating'
  | 'recovering'
  | 'topic_card'
  | 'error'

/** Visible auto-retry state while riding through a transient 5xx/network failure. */
export interface TopicsRecoveryState {
  /** 1-based attempt currently being waited out (backoff) or executed. */
  attempt: number
  maxAttempts: number
}

export interface ResolveCardStateInput {
  topics: SocialTopic[]
  currentIndex: number
  isHost: boolean
  isGeneratingTopics: boolean
  topicsError: boolean
  topicsRecovery?: TopicsRecoveryState | null
}

export interface WarmupTopicRetryInput {
  isHost: boolean
  topicsError: boolean
  syncLost: boolean
  topicCount: number
  selectedMood?: string
  pendingAction: string | null
  retryCount: number
}

export function shouldRetryWarmupTopics(input: WarmupTopicRetryInput): boolean {
  return input.isHost
    && input.topicsError
    && !input.syncLost
    && input.topicCount === 0
    && Boolean(input.selectedMood)
    && input.pendingAction === null
    && input.retryCount < 2
}

/**
 * Resolve the hero card slot state machine (contract Q7 / AC5).
 *
 * Priority: generating > loaded topic card > recovering > error > empty topics.
 * A request can time out locally while the server finishes successfully; the
 * next poll's real topics must replace that stale transport error immediately.
 */
export function getWarmupCardState(input: ResolveCardStateInput): WarmupCardState {
  if (input.isGeneratingTopics) return 'generating'
  if (input.topics.length > 0) return 'topic_card'
  if (input.topicsRecovery) return 'recovering'
  if (input.topicsError) return 'error'
  return input.isHost ? 'host_no_topics' : 'player_no_topics'
}

/** Failure flavour for the topics action — drives patient vs terminal UX. */
export type TopicsFailureKind = 'server' | 'generic'

/**
 * Classify a /topics failure (2026-07-28 502 incident). The route itself
 * degrades to curated topics and never emits a 5xx, so a 5xx (or a bare
 * network/timeout failure with no statusCode) means the gateway/dev server is
 * restarting — transient, worth patient auto-retry. 4xx is a real rejection
 * and goes straight to the terminal error card.
 */
export function classifyTopicsFailure(error: unknown): TopicsFailureKind {
  const statusCode = (error as { statusCode?: number } | null | undefined)?.statusCode
  if (typeof statusCode !== 'number') return 'server'
  return statusCode >= 500 ? 'server' : 'generic'
}

/** Patient backoff ladder (ms) for transient server failures, indexed by 1-based attempt. */
export const TOPICS_SERVER_RETRY_BACKOFF_MS: readonly number[] = [2000, 5000, 10000]

export function getTopicsServerRetryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 1), TOPICS_SERVER_RETRY_BACKOFF_MS.length) - 1
  return TOPICS_SERVER_RETRY_BACKOFF_MS[index]
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
  primaryAction: 'toggle_ready' | 'next_topic' | 'advance_phase'
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
    return {
      primary: '本轮结束',
      primaryAction: 'advance_phase',
      secondaryVisible: false,
      showCancel: isReady,
    }
  }

  if (everyoneReady && isHost && !isLastTopic) {
    return {
      primary: '进入下一题',
      primaryAction: 'next_topic',
      secondaryVisible: false,
      showCancel: isReady,
    }
  }

  if (isReady) {
    return {
      primary: '已准备 · 点按取消',
      primaryAction: 'toggle_ready',
      secondaryVisible: false,
      showCancel: false,
    }
  }

  return {
    primary: '我准备好了',
    primaryAction: 'toggle_ready',
    secondaryVisible: false,
    showCancel: false,
  }
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

/** Corner text for the topic card: `深度·L{n}` for deep_chat, hidden for play_fun. */
export function getDepthCornerText(vibe?: VibeId, depthLevel?: number | null): string | null {
  if (vibe === 'deep_chat' && depthLevel) {
    return `深度·L${depthLevel}`
  }
  if (vibe === 'play_fun') {
    return null // 快速暖场 per contract, but rendered as hidden.
  }
  return null
}

/**
 * Brave-topic analytics predicate (contract A1): a card is "brave" only when
 * the server flags its safety as `reflective` — depth level alone does not
 * qualify (analytics A5 must not over-fire `topic_card_brave_view`).
 */
export function isBraveTopic(
  topic?: Pick<SocialTopic, 'safety'> | null,
): boolean {
  return topic?.safety === 'reflective'
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

// ─── Campfire Vault Card PR1 (contract B2 / C6) ─────────────────────────────

export interface DepthSealColors {
  /** Base accent (hex). */
  accent: string
  /** Deep variant for seal text on the warm card tint (≥4.5:1 on #FFFAF4). */
  deep: string
  /** 2rpx seal border — rgba(accent, 0.3). */
  borderColor: string
  /** Soft seal fill — rgba(accent, 0.10) over the warm tint. */
  backgroundColor: string
}

const DEPTH_SEAL_PALETTE: Record<number, { accent: string; deep: string }> = {
  1: { accent: '#5B8DB8', deep: '#3D6E9C' },
  2: { accent: '#8B5CF6', deep: '#7C3AED' },
  3: { accent: '#C99A3C', deep: '#8A651A' },
}

function sealHexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Depth seal pill colors (contract B2). Computed rgba strings ride inline —
 * WeChat WXSS silently drops hsla(), and the values are depth-keyed.
 */
export function getDepthSealColors(depthLevel?: number | null): DepthSealColors | null {
  if (!depthLevel) return null
  const entry = DEPTH_SEAL_PALETTE[depthLevel]
  if (!entry) return null
  return {
    accent: entry.accent,
    deep: entry.deep,
    borderColor: sealHexToRgba(entry.accent, 0.3),
    backgroundColor: sealHexToRgba(entry.accent, 0.1),
  }
}

/**
 * 悦仔说 cadence (contract C6): the permission whisper is visible on the first
 * card, or on any card with depthLevel ≥ 2 — and only when the server attached
 * a non-empty line to the topic.
 */
export function shouldShowPermissionLine(
  topic?: Pick<SocialTopic, 'depthLevel' | 'permissionLine'> | null,
  index?: number,
): boolean {
  if (!topic?.permissionLine?.trim()) return false
  return index === 0 || (topic.depthLevel ?? 1) >= 2
}

// ─── Campfire Vault Card PR2 — Ember Rim (contract E1 / E2 / S2 / S3) ───────

export interface EmberSeat {
  /** Which border-band edge the seat sits on. */
  edge: 'top' | 'bottom'
  /** Percent (0–100) along the edge — consumed as an inline `left` style. */
  leftPercent: number
}

/** Roster is bounded by group size; never render more embers than seats. */
export const EMBER_MAX_SEATS = 8
const EMBER_EDGE_INSET_PERCENT = 12
const EMBER_EDGE_SPAN_PERCENT = 76

function emberEdgePosition(index: number, count: number): number {
  if (count <= 1) return 50
  return EMBER_EDGE_INSET_PERCENT + (index * EMBER_EDGE_SPAN_PERCENT) / (count - 1)
}

/**
 * E1 — deterministic ember seat positions on the card border band. Seats are
 * split across the top (ceil) and bottom (floor) edges and evenly distributed
 * between 12% and 88% so corner curvature never clips a seat. Pure: same
 * count → same seats, no overlap, no CSS custom properties downstream.
 */
export function computeEmberSeats(count: number): EmberSeat[] {
  const n = Math.max(0, Math.min(Math.floor(count), EMBER_MAX_SEATS))
  if (n === 0) return []
  const topCount = Math.ceil(n / 2)
  const bottomCount = n - topCount
  const seats: EmberSeat[] = []
  for (let i = 0; i < topCount; i += 1) {
    seats.push({ edge: 'top', leftPercent: emberEdgePosition(i, topCount) })
  }
  for (let i = 0; i < bottomCount; i += 1) {
    seats.push({ edge: 'bottom', leftPercent: emberEdgePosition(i, bottomCount) })
  }
  return seats
}

export interface EmberIgnitionDiff {
  /** Newly ready user ids (present in next, absent in prev). */
  ignited: string[]
  /** Newly un-ready user ids (present in prev, absent in next). */
  extinguished: string[]
}

/**
 * Poll-diff of ready ids (S2 / Reliability pillar). The visual target state is
 * always `f(current readyUserIds)` — a missed poll cycle self-heals on the
 * next one because the diff is recomputed against the last applied set.
 */
export function diffReadyUserIds(prevReady: string[], nextReady: string[]): EmberIgnitionDiff {
  const prev = new Set(prevReady)
  const next = new Set(nextReady)
  return {
    ignited: nextReady.filter((id) => !prev.has(id)),
    extinguished: prevReady.filter((id) => !next.has(id)),
  }
}

export type EmberIgnitionMode = 'staggered' | 'batch'

export interface EmberIgnitionItem {
  userId: string
  delayMs: number
}

export interface EmberIgnitionQueue {
  mode: EmberIgnitionMode
  items: EmberIgnitionItem[]
}

/** S2 — minimum spacing between staggered friend ignitions. */
export const EMBER_IGNITION_STAGGER_MS = 120
/** S2 — more than this many ignitions in one poll cycle ignite as one batch. */
export const EMBER_IGNITION_BATCH_THRESHOLD = 2

/**
 * S2 — build the ignition queue for one poll cycle. Duplicates collapse; the
 * viewer (self) is excluded because self ignition is optimistic on tap (S1).
 * ≤2 arrivals stagger ≥120ms apart; >2 batch-ignite together (one burst).
 */
export function buildEmberIgnitionQueue(
  ignitedUserIds: string[],
  options: { excludeUserId?: string } = {},
): EmberIgnitionQueue {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of ignitedUserIds) {
    if (id === options.excludeUserId || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  if (ids.length > EMBER_IGNITION_BATCH_THRESHOLD) {
    return { mode: 'batch', items: ids.map((userId) => ({ userId, delayMs: 0 })) }
  }
  return {
    mode: 'staggered',
    items: ids.map((userId, index) => ({ userId, delayMs: index * EMBER_IGNITION_STAGGER_MS })),
  }
}

/**
 * S3 — re-entry seed: ready ids intersected with the roster, deduped. Seeded
 * embers render lit with NO ignition replay.
 */
export function seedLitUserIds(
  readyUserIds: string[],
  participants: SessionParticipant[],
): string[] {
  const roster = new Set(participants.map((p) => p.userId))
  return Array.from(new Set(readyUserIds.filter((id) => roster.has(id))))
}

export interface EmberAccent {
  /** Lit dot fill — archetype accent at full alpha. */
  fill: string
  /** Glow disc tint — archetype accent at 0.45 alpha (E3). */
  glow: string
  /** Glow fade tail — accent at 0 alpha for a clean radial falloff. */
  glowFade: string
}

/**
 * E2 — resolve an ember's accent colors via the shared archetype color path
 * (TeammateCard precedent). Missing/unknown archetype falls back to the
 * neutral brand purple (DEFAULT_ACCENT inside getArchetypeHSL). All values
 * are rgba strings — WeChat WXSS silently drops hsla().
 */
export function computeEmberAccent(archetype?: string | null): EmberAccent {
  const hsl = getArchetypeHSL(archetype)
  return {
    fill: formatHSLAsRGBA(hsl, 1),
    glow: formatHSLAsRGBA(hsl, 0.45),
    glowFade: formatHSLAsRGBA(hsl, 0),
  }
}

// ─── Campfire Vault Card PR2 — all-ready halo decision (H1–H4) ─────────────

export type EmberHaloVisual = 'off' | 'playing' | 'static'

export interface EmberHaloEvalInput {
  isTopicCard: boolean
  /** S3 — false until the first ready-state payload has actually arrived. */
  dataReady: boolean
  /** True on the evaluation where the topic index just changed. */
  indexChanged: boolean
  everyoneReady: boolean
  /** True once this all-ready moment has already consumed its halo. */
  consumed: boolean
  /** True until the first data-bearing evaluation has run. */
  firstEval: boolean
  reduceMotion: boolean
}

export interface EmberHaloEvalResult {
  /** null = keep the current halo state (nothing changed). */
  decision: EmberHaloVisual | null
  nextConsumed: boolean
  nextFirstEval: boolean
}

/**
 * H1–H4 halo decision, pure (unit-tested; the hook only applies the result).
 *
 * - Not a topic card → off.
 * - No ready-state data yet → no-op (never consume firstEval on an empty
 *   payload, C3).
 * - Topic change → off + RE-ARM consumed (a new topic is a new all-ready
 *   moment, C2).
 * - Not everyone ready → off + re-arm; the first data-bearing evaluation
 *   still consumes firstEval so 'static' is reserved for mount-with-
 *   everyone-already-ready (S3), never for a live transition (B2).
 * - Same all-ready moment → no replay (H4).
 * - First eval / reduced motion → static glow, no swell replay (G1).
 * - Live transition into all-ready → 'playing' (the one climax swell).
 */
export function resolveEmberHalo(input: EmberHaloEvalInput): EmberHaloEvalResult {
  if (!input.isTopicCard) {
    return { decision: 'off', nextConsumed: input.consumed, nextFirstEval: input.firstEval }
  }
  if (!input.dataReady) {
    return { decision: null, nextConsumed: input.consumed, nextFirstEval: input.firstEval }
  }
  if (input.indexChanged) {
    return { decision: 'off', nextConsumed: false, nextFirstEval: input.firstEval }
  }
  if (!input.everyoneReady) {
    return { decision: 'off', nextConsumed: false, nextFirstEval: false }
  }
  if (input.consumed) {
    return { decision: null, nextConsumed: true, nextFirstEval: false }
  }
  if (input.reduceMotion || input.firstEval) {
    return { decision: 'static', nextConsumed: true, nextFirstEval: false }
  }
  return { decision: 'playing', nextConsumed: true, nextFirstEval: false }
}
