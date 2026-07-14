import { View, Text } from '@tarojs/components'
import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { haptics } from '../../lib/utils/haptics'
import TeammateCard from './TeammateCard'
import {
  DEAL_ANTICIPATION_MS,
  DEAL_CARD_ENTER_MS,
  computeDealStaggerMs,
  computeDealTotalMs,
} from './squadDealTiming'
import { computeFanLayout } from './computeFanLayout'

export interface SquadDeckStageProps {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  viewerPairByMemberId: Map<string, PairExplanation | null>
  focusedIndex: number
  reduceMotion: boolean
  isDegradation: boolean
  /** Bump to reset transient deal/focus/peek state (swipe-back re-entry). */
  resetSignal: number
  onFocusChange: (index: number) => void
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

/** Auto-peek: fires this long after the deal settles, holds, then releases. */
const PEEK_DELAY_MS = 400
const PEEK_HOLD_MS = 600

/** The fan layout caps at two rows of four — members beyond that collapse
 *  into a "+N" overflow badge on the last visible card instead of being
 *  silently dropped. */
const MAX_FAN_CARDS = 8

/**
 * The viewer's highest-chemistryScore tablemate. Deterministic roster-order
 * tie-break: the first member in roster order with the max score wins (strict
 * `>` keeps the earliest on ties). Returns null when no viewer pairs exist.
 */
function computeBestPartnerUserId(
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

export default function SquadDeckStage({
  members,
  currentUserId,
  viewerPairByMemberId,
  focusedIndex,
  reduceMotion,
  isDegradation,
  resetSignal,
  onFocusChange,
}: SquadDeckStageProps) {
  const instant = reduceMotion || isDegradation
  const [dealt, setDealt] = useState(() => instant)
  const [dealComplete, setDealComplete] = useState(() => instant)
  const [peekActive, setPeekActive] = useState(false)

  const dealStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dealDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const peekTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevResetSignalRef = useRef(resetSignal)

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

  const bestPartnerUserId = useMemo(
    () => computeBestPartnerUserId(members, currentUserId, viewerPairByMemberId),
    [members, currentUserId, viewerPairByMemberId],
  )

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
    peekTimersRef.current.forEach(clearTimeout)
    peekTimersRef.current = []
  }, [])

  // Deal: anticipation beat, then a staggered slide-up + flip per card, with a
  // per-card landing haptic near the end of each entrance.
  useEffect(() => {
    if (instant) {
      setDealt(true)
      setDealComplete(true)
      return undefined
    }

    dealStartTimerRef.current = setTimeout(() => setDealt(true), DEAL_ANTICIPATION_MS)
    dealDoneTimerRef.current = setTimeout(() => setDealComplete(true), dealTotalMs)

    hapticTimersRef.current = displayMembers.map((_, index) =>
      setTimeout(
        () => haptics('light'),
        DEAL_ANTICIPATION_MS + index * staggerMs + Math.round(DEAL_CARD_ENTER_MS * 0.7),
      ),
    )

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

  // One-shot auto-peek: the centre card lifts briefly once the deal settles.
  useEffect(() => {
    if (!dealComplete || instant) return undefined
    const startTimer = setTimeout(() => setPeekActive(true), PEEK_DELAY_MS)
    const endTimer = setTimeout(() => setPeekActive(false), PEEK_DELAY_MS + PEEK_HOLD_MS)
    peekTimersRef.current = [startTimer, endTimer]
    return () => {
      peekTimersRef.current.forEach(clearTimeout)
      peekTimersRef.current = []
    }
  }, [dealComplete, instant])

  // Swipe-back re-entry: settle to a clean revealed state (no flight replay),
  // clearing any in-flight peek and all timers.
  useEffect(() => {
    if (prevResetSignalRef.current === resetSignal) return
    prevResetSignalRef.current = resetSignal
    clearAllTimers()
    setPeekActive(false)
    setDealt(true)
    setDealComplete(true)
  }, [resetSignal, clearAllTimers])

  // Final safety net: clear everything on unmount.
  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  const handleFocus = useCallback((index: number) => {
    // A deliberate tap cancels the one-shot auto-peek so the centre card's
    // peek lift can never compete with a deliberate card focus.
    peekTimersRef.current.forEach(clearTimeout)
    peekTimersRef.current = []
    setPeekActive(false)
    onFocusChange(index)
  }, [onFocusChange])

  if (members.length === 0) {
    return (
      <View className='squad-unboxing__deck-stage squad-unboxing__deck-stage--empty' role='list' aria-label='桌友卡组'>
        <Text className='squad-unboxing__deck-empty-text'>
          {`${DEFAULT_MASCOT_DISPLAY_NAME}还没收到这桌的名单，稍后再来看看～`}
        </Text>
      </View>
    )
  }

  const holoSweep = dealComplete && !instant

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

      {/* Epic holo sweep — one element, plays once on deal then static. */}
      {holoSweep ? (
        <View className='squad-unboxing__deck-holo squad-unboxing__deck-holo--sweep' aria-hidden='true' />
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

                return (
                  <TeammateCard
                    key={member.userId}
                    member={member}
                    viewerPair={viewerPair}
                    index={rosterIndex}
                    focused={focusedIndex === rosterIndex}
                    isCurrentUser={isCurrentUser}
                    isBestPartner={member.userId === bestPartnerUserId}
                    isPeek={peekActive && rosterIndex === layout.peekIndex}
                    isRevealed={dealt}
                    emergeComplete={dealComplete}
                    emergeDelayMs={reduceMotion ? 0 : rosterIndex * staggerMs}
                    overflowBadge={rosterIndex === displayMembers.length - 1 ? overflowCount : 0}
                    reduceMotion={reduceMotion}
                    isDegradation={isDegradation}
                    onFocus={() => handleFocus(rosterIndex)}
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
