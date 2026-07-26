import { View, Text } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import { haptics } from '../../lib/utils/haptics'
import TeammateCard from './TeammateCard'
import {
  DEAL_ANTICIPATION_MS,
  DEAL_CARD_ENTER_MS,
  DEAL_HAPTIC_MIN_STAGGER_MS,
  computeDealStaggerMs,
  computeDealTotalMs,
} from './squadDealTiming'
import { computeFanLayout, MAX_FAN_CARDS } from './computeFanLayout'
import {
  FOLD_SETTLE_INSTANT_MS,
  UNFOLD_RELEASE_MS,
  computeFoldTotalMs,
  computeUnfoldTotalMs,
  type DeckPhase,
} from './squadDeckCollapseState'

export interface SquadDeckStageProps {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  viewerPairByMemberId: Map<string, PairExplanation | null>
  focusedIndex: number
  reduceMotion: boolean
  isDegradation: boolean
  /** Bump to reset transient deal/focus state (swipe-back re-entry). */
  resetSignal: number
  /** Controller-owned flip state (AC-13): ids currently face-up. */
  flippedIds: ReadonlySet<string>
  /** Per-card flip transition delay (ms) — burst stagger; 0 for single flips. */
  flipDelayById: ReadonlyMap<string, number>
  /** The viewer's highest-chemistry tablemate (controller-computed). */
  bestPartnerUserId: string | null
  /** Re-entry arrival (reveal flag present): every card renders face-up. */
  allRevealed: boolean
  /** First-visit interactive session: backs shimmer once after the deal. */
  interactive: boolean
  /** Fired when the deal flight fully settles (drives the 我 auto-flip). */
  onDealSettled: (instant: boolean) => void
  onCardTap: (index: number) => void
  onCardLongPress: (index: number) => void
  /**
   * "Pocket the deck" phase (two-phase reveal, 2026-07-15). The stage owns
   * the transient card-pose windows: `folding` cascades cards into the pill,
   * `pocketed` holds them at the vanish point (stage hidden), `unfolding`
   * re-fans them after a visibility-commit frame gap.
   */
  deckPhase: DeckPhase
  /** Per-card fold delay (ms) — 最佳拍档 folds last (controller-computed). */
  foldDelayById: ReadonlyMap<string, number>
  /** Per-card re-fan delay (ms) — roster order (controller-computed). */
  unfoldDelayById: ReadonlyMap<string, number>
  /** Fired when the fold cascade fully settles (controller → `pocketed`). */
  onFoldSettled: () => void
  /** Fired when the re-fan fully settles (controller → `fan`). */
  onUnfoldSettled: () => void
  /** Front art loaded for a member (page-level flip hold-to-onLoad gate). */
  onArtLoad?: (userId: string) => void
}

// Re-export the pure deal budget helpers so existing consumers/tests that
// import them from SquadDeckStage keep working.
export {
  DEAL_ANTICIPATION_MS,
  DEAL_ACTIVE_BUDGET_MS,
  DEAL_CARD_ENTER_MS,
  computeDealStaggerMs,
  computeDealActiveMs,
  computeDealTotalMs,
} from './squadDealTiming'

export default function SquadDeckStage({
  members,
  currentUserId,
  viewerPairByMemberId,
  focusedIndex,
  reduceMotion,
  isDegradation,
  resetSignal,
  flippedIds,
  flipDelayById,
  bestPartnerUserId,
  allRevealed,
  interactive,
  onDealSettled,
  onCardTap,
  onCardLongPress,
  deckPhase,
  foldDelayById,
  unfoldDelayById,
  onFoldSettled,
  onUnfoldSettled,
  onArtLoad,
}: SquadDeckStageProps) {
  const instant = reduceMotion || isDegradation
  const [dealt, setDealt] = useState(() => instant)
  const [dealComplete, setDealComplete] = useState(() => instant)
  // Pocket-the-deck card pose: true while cards sit at the pill vanish point
  // (folding + pocketed), released one frame into `unfolding` so the re-fan
  // transition runs after WeChat commits the stage visibility flip.
  const [cardsPocketed, setCardsPocketed] = useState(() => deckPhase === 'pocketed')

  const dealStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dealDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const foldTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevResetSignalRef = useRef(resetSignal)
  const prevDeckPhaseRef = useRef<DeckPhase>(deckPhase)
  // Fresh refs for the fold/unfold settle callbacks so the timers never fire
  // a stale closure (same pattern as onDealSettledRef).
  const onFoldSettledRef = useRef(onFoldSettled)
  onFoldSettledRef.current = onFoldSettled
  const onUnfoldSettledRef = useRef(onUnfoldSettled)
  onUnfoldSettledRef.current = onUnfoldSettled
  // Fresh ref for the deal-settle callback so the deal timers never fire a
  // stale closure (the effect deps key on the stable roster id sequence).
  const onDealSettledRef = useRef(onDealSettled)
  onDealSettledRef.current = onDealSettled
  // Tracks whether the controller was notified of the deal settle. The
  // swipe-back recovery path (A1) must notify exactly once if the flight was
  // interrupted — otherwise the flip session never seeds (chip no-ops,
  // all_revealed never fires, 我 auto-flip skipped).
  const dealSettledRef = useRef(false)

  // Overflow: the fan shows at most MAX_FAN_CARDS; the rest collapse into a
  // "+N" badge on the last visible card so nobody is silently dropped.
  const overflowCount = Math.max(0, members.length - MAX_FAN_CARDS)
  const displayMembers = useMemo(
    () => (overflowCount > 0 ? members.slice(0, MAX_FAN_CARDS) : members),
    [members, overflowCount],
  )

  const layout = useMemo(() => computeFanLayout(displayMembers.length), [displayMembers.length])
  const staggerMs = useMemo(() => computeDealStaggerMs(displayMembers.length), [displayMembers.length])
  const dealTotalMs = useMemo(() => computeDealTotalMs(displayMembers.length), [displayMembers.length])
  // Pocket-the-deck wall-clock budgets (pure module): fold cascade ≤600ms,
  // re-fan ≤480ms; reduced-motion/degradation settles on the 150ms crossfade.
  const foldTotalMs = useMemo(() => computeFoldTotalMs(displayMembers.length), [displayMembers.length])
  const unfoldTotalMs = useMemo(() => computeUnfoldTotalMs(displayMembers.length), [displayMembers.length])
  // Stable roster identity: a same-content refetch must NOT re-arm the deal
  // timers (React Query structural sharing usually prevents this, but the
  // array identity is not guaranteed). Keyed on the id sequence.
  const memberKey = useMemo(() => displayMembers.map((m) => m.userId).join(','), [displayMembers])

  // Per-card flip sheen arming: a card sheens when its id transitions INTO
  // the controller-owned flipped set. Mount-time sets (all-up re-entry,
  // story seeds) never sheen — the class only appears on a live transition.
  const prevFlippedRef = useRef<ReadonlySet<string>>(flippedIds)
  const justFlippedIds = useMemo(() => {
    const fresh = new Set<string>()
    flippedIds.forEach((id) => {
      if (!prevFlippedRef.current.has(id)) fresh.add(id)
    })
    return fresh
  }, [flippedIds])
  useEffect(() => {
    prevFlippedRef.current = flippedIds
  }, [flippedIds])

  // ── 契合点光迹 (2026-07-24 P2) ────────────────────────────────────────────
  // A falling archetype-tinted light blob per live flip, dropping from the
  // card's slot toward the dock bubble — "the card's story flows there".
  // Transform/opacity only, ≤500ms, aria-hidden. Instant tiers never spawn.
  interface FlipTrail {
    key: number
    leftPct: number
    color: string
  }
  const [trails, setTrails] = useState<FlipTrail[]>([])
  const trailKeyRef = useRef(0)
  const trailTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevTrailSourceRef = useRef<ReadonlySet<string>>(new Set())

  // Split the roster into rows (top row first) per the fan layout.
  const memberRows = useMemo(() => {
    const rows: PoolGroupMemberSummary[][] = []
    let cursor = 0
    for (const len of layout.rows) {
      rows.push(displayMembers.slice(cursor, cursor + len))
      cursor += len
    }
    return rows
  }, [displayMembers, layout.rows])

  // userId → approximate horizontal centre (%) + archetype tint for trails.
  const trailMetaById = useMemo(() => {
    const map = new Map<string, { leftPct: number; color: string }>()
    memberRows.forEach((rowMembers) => {
      rowMembers.forEach((member, indexInRow) => {
        const archetypeId = member.archetype ? resolveArchetype(member.archetype)?.id ?? null : null
        const hsl = getArchetypeHSL(archetypeId)
        map.set(member.userId, {
          leftPct: ((indexInRow + 0.5) / rowMembers.length) * 100,
          color: formatHSLAsRGBA(hsl, 0.85),
        })
      })
    })
    return map
  }, [memberRows])

  useEffect(() => {
    const fresh = [...justFlippedIds].filter((id) => !prevTrailSourceRef.current.has(id))
    prevTrailSourceRef.current = justFlippedIds
    if (instant || fresh.length === 0) return undefined
    const spawned: FlipTrail[] = []
    for (const id of fresh) {
      const meta = trailMetaById.get(id)
      if (!meta) continue
      trailKeyRef.current += 1
      spawned.push({ key: trailKeyRef.current, ...meta })
    }
    if (spawned.length === 0) return undefined
    setTrails((prev) => [...prev, ...spawned])
    const keys = new Set(spawned.map((trail) => trail.key))
    trailTimersRef.current.push(
      setTimeout(() => {
        setTrails((prev) => prev.filter((trail) => !keys.has(trail.key)))
      }, 560),
    )
    return undefined
  }, [justFlippedIds, instant, trailMetaById])

  useEffect(() => () => {
    trailTimersRef.current.forEach(clearTimeout)
    trailTimersRef.current = []
  }, [])

  const clearAllTimers = useCallback(() => {
    if (dealStartTimerRef.current) clearTimeout(dealStartTimerRef.current)
    if (dealDoneTimerRef.current) clearTimeout(dealDoneTimerRef.current)
    dealStartTimerRef.current = null
    dealDoneTimerRef.current = null
    hapticTimersRef.current.forEach(clearTimeout)
    hapticTimersRef.current = []
    foldTimersRef.current.forEach(clearTimeout)
    foldTimersRef.current = []
  }, [])

  // ── Pocket-the-deck phase orchestration ──────────────────────────────────
  // `folding`: cards take the pocket pose with per-card fold delays (最佳拍档
  // last — its delay is the largest in foldDelayById); the settle timer flips
  // the controller to `pocketed` (stage hides). `unfolding`: hold the pocket
  // pose for one frame gap while the stage re-appears, then release so the
  // re-fan transition runs; the settle timer flips the controller to `fan`.
  useEffect(() => {
    if (prevDeckPhaseRef.current === deckPhase) return
    prevDeckPhaseRef.current = deckPhase
    foldTimersRef.current.forEach(clearTimeout)
    foldTimersRef.current = []

    if (deckPhase === 'folding') {
      setCardsPocketed(true)
      const settleMs = instant ? FOLD_SETTLE_INSTANT_MS : foldTotalMs
      foldTimersRef.current.push(setTimeout(() => onFoldSettledRef.current(), settleMs))
      return
    }
    if (deckPhase === 'pocketed') {
      setCardsPocketed(true)
      return
    }
    if (deckPhase === 'unfolding') {
      setCardsPocketed(true)
      foldTimersRef.current.push(setTimeout(() => setCardsPocketed(false), UNFOLD_RELEASE_MS))
      const settleMs = UNFOLD_RELEASE_MS + (instant ? FOLD_SETTLE_INSTANT_MS : unfoldTotalMs)
      foldTimersRef.current.push(setTimeout(() => onUnfoldSettledRef.current(), settleMs))
      return
    }
    setCardsPocketed(false)
  }, [deckPhase, instant, foldTotalMs, unfoldTotalMs])

  // Deal: anticipation beat, then a staggered slide-up per card (landing
  // FACE-DOWN — the deal-flight flip-up was retired with tap-to-reveal), with
  // a per-card landing haptic near the end of each entrance. The controller
  // is notified when the flight settles so it can arm the 我 auto-flip.
  useEffect(() => {
    if (instant) {
      setDealt(true)
      setDealComplete(true)
      if (!dealSettledRef.current) {
        dealSettledRef.current = true
        onDealSettledRef.current(true)
      }
      return undefined
    }

    dealStartTimerRef.current = setTimeout(() => setDealt(true), DEAL_ANTICIPATION_MS)
    dealDoneTimerRef.current = setTimeout(() => {
      setDealComplete(true)
      dealSettledRef.current = true
      onDealSettledRef.current(false)
    }, dealTotalMs)

    // Per-card landing haptic — only when the stagger leaves room between
    // landings. Below DEAL_HAPTIC_MIN_STAGGER_MS the taps merge into a
    // continuous buzz (N≥6), so the deal relies on the box-open haptic alone.
    // The reveal-all burst fires a single haptic at the page level, so no
    // per-card gate is needed there.
    const perCardHaptics = staggerMs >= DEAL_HAPTIC_MIN_STAGGER_MS
    hapticTimersRef.current = perCardHaptics
      ? displayMembers.map((_, index) =>
          setTimeout(
            () => haptics('light'),
            DEAL_ANTICIPATION_MS + index * staggerMs + Math.round(DEAL_CARD_ENTER_MS * 0.7),
          ),
        )
      : []

    return () => {
      if (dealStartTimerRef.current) clearTimeout(dealStartTimerRef.current)
      if (dealDoneTimerRef.current) clearTimeout(dealDoneTimerRef.current)
      hapticTimersRef.current.forEach(clearTimeout)
      hapticTimersRef.current = []
    }
    // memberKey (stable id sequence) stands in for the roster: a same-content
    // refetch must not re-arm the deal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant, dealTotalMs, staggerMs, memberKey])

  // Swipe-back re-entry: settle to a clean revealed state (no flight replay),
  // clearing all timers. Flip state is controller-owned and survives — a warm
  // re-entry keeps the user's mid-game progress.
  useEffect(() => {
    if (prevResetSignalRef.current === resetSignal) return
    prevResetSignalRef.current = resetSignal
    clearAllTimers()
    setDealt(true)
    setDealComplete(true)
    setTrails([])
    // Pocket-the-deck settle (AC-05): transient fold/unfold windows never
    // survive a hide/show cycle — snap the phase machine to its target so a
    // paused timer can't leave the deck stuck half-cascaded. The settle
    // handlers are phase-guarded in the controller, so these are no-ops when
    // the phase is already stable.
    if (deckPhase === 'folding') onFoldSettledRef.current()
    if (deckPhase === 'unfolding') onUnfoldSettledRef.current()
    setCardsPocketed(deckPhase === 'pocketed')
    // Interrupted-deal recovery (A1): if the flight never settled (e.g. the
    // app was backgrounded mid-deal before dealDoneTimer fired), seed the
    // flip session now — without this the session keeps visibleIds=[] and
    // interactive=false, so the hint chip no-ops, all_revealed never fires,
    // and the 我 auto-flip is skipped. Instant=true: the recovered session
    // behaves like a reduced-motion settle.
    if (!dealSettledRef.current) {
      dealSettledRef.current = true
      onDealSettledRef.current(true)
    }
  }, [resetSignal, clearAllTimers, deckPhase])

  // Final safety net: clear everything on unmount.
  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  if (members.length === 0) {
    return (
      <View className='squad-unboxing__deck-stage squad-unboxing__deck-stage--empty' role='list' aria-label='桌友卡组'>
        <Text className='squad-unboxing__deck-empty-text'>
          {`${DEFAULT_MASCOT_DISPLAY_NAME}还没收到这桌的名单，稍后再来看看～`}
        </Text>
      </View>
    )
  }

  // One-time back shimmer (AC-07): a single sweep across the face-down backs
  // after the deal settles. Suppressed under reduce-motion/degradation and on
  // all-up re-entry. The class is derived (not state), so a warm re-entry
  // never replays it — the animation only fires when the class first appears.
  const shimmerArmed = dealComplete && !instant && interactive

  return (
    <View
      className={[
        'squad-unboxing__deck-stage',
        dealt ? 'squad-unboxing__deck-stage--revealed' : '',
        reduceMotion ? 'squad-unboxing__deck-stage--reduce-motion' : '',
        isDegradation ? 'squad-unboxing__deck-stage--degradation' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role='list'
      aria-label={`桌友卡组，共 ${members.length} 张`}
    >
      <View className='squad-unboxing__deck-shadow' />

      {/* 契合点光迹 (2026-07-24 P2): one falling archetype-tinted blob per
          live flip — pure visual, transform/opacity only, ≤500ms. */}
      {trails.map((trail) => (
        <View
          key={trail.key}
          className='squad-unboxing__flip-trail'
          style={{
            left: `${trail.leftPct}%`,
            background: `radial-gradient(circle, ${trail.color} 0%, rgba(255, 255, 255, 0) 70%)`,
          }}
          aria-hidden='true'
        />
      ))}

      {/* One-time shimmer sweep across the face-down backs (transform-only
          band; replays never — see shimmerArmed derivation). */}
      {shimmerArmed ? (
        <View
          className='squad-unboxing__deck-back-shimmer squad-unboxing__deck-back-shimmer--armed'
          aria-hidden='true'
        />
      ) : null}

      {/* The fan: two flex-centred rows for N≥5, one row otherwise. Card size
          comes from the per-count SCSS rules; rotation from per-(row-length,
          index) rules. --dealt gates the fan pose (cards start stacked).
          --pocketing overlays the fold-to-pill transform (comes AFTER the
          dealt rules in the stylesheet so it wins the source-order tie). */}
      <View
        className={[
          'squad-unboxing__deck-fan',
          `squad-unboxing__deck-fan--count-${layout.count}`,
          dealt ? 'squad-unboxing__deck-fan--dealt' : '',
          // Focus grammar (2026-07-24 polish, visual audit B2): while a card
          // is lifted, siblings drop their info zones (art stays, deck stays
          // legible) so the lift never slices a neighbour's text mid-glyph.
          focusedIndex >= 0 ? 'squad-unboxing__deck-fan--has-focus' : '',
          cardsPocketed ? 'squad-unboxing__deck-fan--pocketing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {memberRows.map((rowMembers, rowIndex) => {
          // Running roster offset so each card keeps its global index.
          const rowOffset = layout.rows.slice(0, rowIndex).reduce((sum, len) => sum + len, 0)

          return (
            <View
              key={rowIndex}
              className={[
                'squad-unboxing__deck-fan-row',
                `squad-unboxing__deck-fan-row--len-${rowMembers.length}`,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {rowMembers.map((member, indexInRow) => {
                const rosterIndex = rowOffset + indexInRow
                const isCurrentUser = member.userId === currentUserId
                const viewerPair = viewerPairByMemberId.get(member.userId) ?? null
                // Face derives from the controller-owned flip set (single
                // source of truth — REL-01); all-up re-entry forces face-up.
                const isFaceUp = allRevealed || flippedIds.has(member.userId)
                const flipDelayMs = instant ? 0 : flipDelayById.get(member.userId) ?? 0
                // Pocket-the-deck per-card timing: folding uses the fold map
                // (最佳拍档 last), the unfold release uses the roster-order
                // re-fan map; instant tiers drop the stagger to 0 so every
                // card crossfades together. Null outside the pocket windows
                // so focus/emerge transitions keep their own timing.
                const pocketTransitionDelayMs = instant
                  ? 0
                  : cardsPocketed
                    ? foldDelayById.get(member.userId) ?? 0
                    : deckPhase === 'unfolding'
                      ? unfoldDelayById.get(member.userId) ?? 0
                      : null

                return (
                  <TeammateCard
                    key={member.userId}
                    member={member}
                    viewerPair={viewerPair}
                    index={rosterIndex}
                    focused={focusedIndex === rosterIndex}
                    isCurrentUser={isCurrentUser}
                    isBestPartner={member.userId === bestPartnerUserId}
                    isDealt={dealt}
                    isFaceUp={isFaceUp}
                    flipDelayMs={flipDelayMs}
                    sheenActive={!instant && justFlippedIds.has(member.userId)}
                    sheenDelayMs={flipDelayMs}
                    emergeComplete={dealComplete}
                    emergeDelayMs={reduceMotion ? 0 : rosterIndex * staggerMs}
                    overflowBadge={rosterIndex === displayMembers.length - 1 ? overflowCount : 0}
                    reduceMotion={reduceMotion}
                    isDegradation={isDegradation}
                    pocketPose={cardsPocketed}
                    pocketTransitionDelayMs={pocketTransitionDelayMs}
                    pocketGlowActive={
                      cardsPocketed && !instant && member.userId === bestPartnerUserId
                    }
                    slowFlipActive={
                      !instant && justFlippedIds.has(member.userId) && member.userId === bestPartnerUserId
                    }
                    onArtLoad={onArtLoad}
                    onTap={() => onCardTap(rosterIndex)}
                    onLongPress={() => onCardLongPress(rosterIndex)}
                  />
                )
              })}
            </View>
          )
        })}
      </View>
    </View>
  )
}
