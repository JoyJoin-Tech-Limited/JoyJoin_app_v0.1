import { View, Text } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
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
}: SquadDeckStageProps) {
  const instant = reduceMotion || isDegradation
  const [dealt, setDealt] = useState(() => instant)
  const [dealComplete, setDealComplete] = useState(() => instant)

  const dealStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dealDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevResetSignalRef = useRef(resetSignal)
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

  const clearAllTimers = useCallback(() => {
    if (dealStartTimerRef.current) clearTimeout(dealStartTimerRef.current)
    if (dealDoneTimerRef.current) clearTimeout(dealDoneTimerRef.current)
    dealStartTimerRef.current = null
    dealDoneTimerRef.current = null
    hapticTimersRef.current.forEach(clearTimeout)
    hapticTimersRef.current = []
  }, [])

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
  }, [resetSignal, clearAllTimers])

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
          index) rules. --dealt gates the fan pose (cards start stacked). */}
      <View
        className={[
          'squad-unboxing__deck-fan',
          `squad-unboxing__deck-fan--count-${layout.count}`,
          dealt ? 'squad-unboxing__deck-fan--dealt' : '',
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
