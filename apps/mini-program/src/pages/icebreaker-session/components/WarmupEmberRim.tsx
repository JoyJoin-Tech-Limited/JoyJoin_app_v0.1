import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'
import type { SessionParticipant } from '../phaseUtils'
import {
  EMBER_MAX_SEATS,
  buildEmberIgnitionQueue,
  computeEmberAccent,
  computeEmberSeats,
  diffReadyUserIds,
  resolveEmberHalo,
  seedLitUserIds,
} from '../viewModels/warmupViewModels'
import type { EmberAccent, EmberHaloVisual, EmberSeat } from '../viewModels/warmupViewModels'
// Styles are @use'd by the page SCSS (index.scss) — a component-level SCSS
// import would be chunked into the page-invisible sub-common.wxss.

// ─── Campfire Vault Card PR2 motion constants (contract E1 / S2 / H1 / H4) ──
/** E1 — per-seat pop-in stagger on first topic_card entry. */
const ENTER_STAGGER_MS = 40
const ENTER_DURATION_MS = 320
/** S2 — spring pop + glow bloom settle window for one ignition. */
const IGNITE_SETTLE_MS = 320
/** S4 — quiet un-ready fade. */
const EXTINGUISH_MS = 240
/** I1 — desync increment for the idle breath negative delays (−0.4s/seat). */
const BREATHE_DESYNC_MS = 400
/** H1 — per-seat swell stagger when the halo consumes the embers. */
const HALO_STAGGER_MS = 60
/** H4 — swell + single breath window before the halo settles static. */
const HALO_PLAY_MS = 3600

export type EmberAnimKind = 'ignite' | 'self' | 'extinguish'
export type EmberHaloState = EmberHaloVisual

export interface EmberVisual {
  userId: string
  archetype?: string
  seat: EmberSeat
  seatIndex: number
  /** True when the ember should render its accent fill (lit, igniting, or mid-extinguish). */
  lit: boolean
  anim: EmberAnimKind | null
  accent: EmberAccent
}

export interface EmberSyncResult {
  embers: EmberVisual[]
  halo: EmberHaloState
  /** True only during the first-entry pop-in window (E1). */
  entering: boolean
  readyCount: number
  totalCount: number
}

interface UseEmberSyncInput {
  participants: SessionParticipant[]
  readyUserIds: string[]
  currentUserId: string
  /** S1 — self ready tapped; server echo not yet received. */
  selfReadyOptimistic: boolean
  isTopicCard: boolean
  currentIndex: number
  reduceMotion: boolean
  /**
   * C3 — true only once the first ready-state payload has actually arrived
   * (the page passes `?? []`, so an unresolved query is indistinguishable
   * from "nobody ready" without this flag). Seeding and halo evaluation wait
   * for it so already-ready friends never animate as fresh ignitions (S3).
   */
  dataReady: boolean
}

/**
 * Campfire Vault Card PR2 — ember sync hook (S1–S4, H1–H4, E1).
 *
 * Target state is always `f(current readyUserIds)` — the poll diff only
 * schedules transient ignition/extinguish animations, so a missed cycle
 * self-heals on the next poll (Reliability pillar). Refs persist across
 * WeChat page re-show, which gives S3 (seed without replay) for free.
 */
export function useEmberSync({
  participants,
  readyUserIds,
  currentUserId,
  selfReadyOptimistic,
  isTopicCard,
  currentIndex,
  reduceMotion,
  dataReady,
}: UseEmberSyncInput): EmberSyncResult {
  const seats = useMemo(() => computeEmberSeats(participants.length), [participants.length])
  const seatParticipants = useMemo(
    () => participants.slice(0, EMBER_MAX_SEATS),
    [participants],
  )

  const [litIds, setLitIds] = useState<Set<string>>(() => new Set())
  const [anims, setAnims] = useState<Record<string, { kind: EmberAnimKind }>>({})
  const [halo, setHalo] = useState<EmberHaloState>('off')
  const [entering, setEntering] = useState(false)

  const seededRef = useRef(false)
  const prevLitRef = useRef<Set<string>>(new Set())
  const animsRef = useRef<Record<string, { kind: EmberAnimKind }>>({})
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const haloConsumedRef = useRef(false)
  const haloFirstEvalRef = useRef(true)
  const prevIndexRef = useRef(currentIndex)
  const enteredRef = useRef(false)

  const schedule = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      // Fired timers are spliced out so the array never grows monotonically.
      const index = timersRef.current.indexOf(timer)
      if (index !== -1) timersRef.current.splice(index, 1)
      fn()
    }, ms)
    timersRef.current.push(timer)
  }

  useEffect(
    () => () => {
      for (const timer of timersRef.current) clearTimeout(timer)
    },
    [],
  )

  const setAnim = (userId: string, value: { kind: EmberAnimKind } | null) => {
    const next = { ...animsRef.current }
    if (value) next[userId] = value
    else delete next[userId]
    animsRef.current = next
    setAnims(next)
  }

  const scheduleIgnite = (userId: string, kind: 'ignite' | 'self', delayMs: number) => {
    // G1 — reduced motion renders the lit state statically, no pop.
    if (reduceMotion) return
    schedule(() => {
      setAnim(userId, { kind })
      schedule(() => setAnim(userId, null), IGNITE_SETTLE_MS)
    }, delayMs)
  }

  const scheduleExtinguish = (userId: string) => {
    if (reduceMotion) return
    setAnim(userId, { kind: 'extinguish' })
    schedule(() => setAnim(userId, null), EXTINGUISH_MS)
  }

  // ── S1–S4: ready-state sync (poll diff + optimistic self) ────────────────
  useEffect(() => {
    if (!isTopicCard) return
    // C3 — never seed on an unresolved payload: an empty `?? []` would seed
    // "nobody ready", and the first real poll would then animate every
    // already-ready friend as a fresh ignition (violates S3).
    if (!dataReady) return
    const next = new Set(seedLitUserIds(readyUserIds, seatParticipants))
    if (selfReadyOptimistic) next.add(currentUserId)

    if (!seededRef.current) {
      // S3 — first paint / re-entry seeds lit embers with NO animation replay.
      seededRef.current = true
      prevLitRef.current = next
      setLitIds(next)
      return
    }

    const diff = diffReadyUserIds(Array.from(prevLitRef.current), Array.from(next))
    if (diff.ignited.length === 0 && diff.extinguished.length === 0) return
    prevLitRef.current = next
    setLitIds(next)

    for (const id of diff.extinguished) {
      scheduleExtinguish(id) // S4 — quiet fade, no haptic
    }

    const freshIgnitions = diff.ignited.filter((id) => !animsRef.current[id])
    const selfIgnited = freshIgnitions.includes(currentUserId)
    const queue = buildEmberIgnitionQueue(freshIgnitions, { excludeUserId: currentUserId })
    if (queue.items.length > 0 && !reduceMotion) {
      haptics('light') // S2 — at most ONE light haptic per poll cycle
    }
    for (const item of queue.items) {
      scheduleIgnite(item.userId, 'ignite', item.delayMs)
    }
    if (selfIgnited) {
      scheduleIgnite(currentUserId, 'self', 0) // S1 — golden-fill sweep
    }
  }, [
    readyUserIds,
    seatParticipants,
    currentUserId,
    selfReadyOptimistic,
    isTopicCard,
    reduceMotion,
    dataReady,
  ])

  // ── H1–H4: all-ready halo ────────────────────────────────────────────────
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length

  useEffect(() => {
    const indexChanged = currentIndex !== prevIndexRef.current
    prevIndexRef.current = currentIndex
    // B2 / C2 / C3 — decision matrix lives in the pure, unit-tested
    // resolveEmberHalo; this effect only applies the result.
    const result = resolveEmberHalo({
      isTopicCard,
      dataReady,
      indexChanged,
      everyoneReady,
      consumed: haloConsumedRef.current,
      firstEval: haloFirstEvalRef.current,
      reduceMotion,
    })
    haloConsumedRef.current = result.nextConsumed
    haloFirstEvalRef.current = result.nextFirstEval
    if (result.decision === null) return
    setHalo(result.decision)
    if (result.decision === 'playing') {
      schedule(() => setHalo('static'), HALO_PLAY_MS)
    }
  }, [everyoneReady, isTopicCard, currentIndex, reduceMotion, dataReady])

  // ── E1: first-entry pop-in (no replay on WeChat page re-show) ────────────
  useEffect(() => {
    if (!isTopicCard) {
      enteredRef.current = false
      return
    }
    if (enteredRef.current || seats.length === 0) return
    enteredRef.current = true
    if (reduceMotion) return
    setEntering(true)
    schedule(() => setEntering(false), seats.length * ENTER_STAGGER_MS + ENTER_DURATION_MS)
  }, [isTopicCard, seats.length, reduceMotion])

  const embers = useMemo<EmberVisual[]>(
    () =>
      seatParticipants.map((participant, index) => {
        const anim = anims[participant.userId]?.kind ?? null
        return {
          userId: participant.userId,
          archetype: participant.archetype,
          seat: seats[index],
          seatIndex: index,
          // Mid-extinguish embers keep their accent fill for the quiet fade.
          lit: litIds.has(participant.userId) || anim === 'extinguish',
          anim,
          accent: computeEmberAccent(participant.archetype),
        }
      }),
    [seatParticipants, seats, litIds, anims],
  )

  return {
    embers,
    halo,
    entering,
    readyCount: litIds.size,
    totalCount: participants.length,
  }
}

interface WarmupEmberRimProps {
  embers: EmberVisual[]
  halo: EmberHaloState
  entering: boolean
  /** C8 — degradation-tier devices render all rim motion statically. */
  degraded?: boolean
}

/**
 * E1–E5 — per-participant ember seats overlaid on the topic card's border
 * band. Absolute positioning only: the question zone, seals, 悦仔说, and
 * AIGC footer never shift (E4). Decorative — presence is announced by the
 * count chip (P1), so the rim is aria-hidden. Memoized: props are primitives
 * plus the hook-memoized embers array, so per-poll re-renders stay cheap.
 */
export const WarmupEmberRim = memo(function WarmupEmberRim({
  embers,
  halo,
  entering,
  degraded = false,
}: WarmupEmberRimProps) {
  if (embers.length === 0) return null
  return (
    <View
      className={`warmup-ember-rim ${degraded ? 'warmup-ember-rim--degraded' : ''}`}
      aria-hidden='true'
    >
      {embers.map((ember) => {
        const settledLit = ember.lit && !ember.anim && halo === 'off'
        const className = [
          'warmup-ember-rim__seat',
          entering && halo === 'off' ? 'warmup-ember-rim__seat--enter' : '',
          settledLit ? 'warmup-ember-rim__seat--lit' : '',
          ember.anim === 'ignite' ? 'warmup-ember-rim__seat--igniting' : '',
          ember.anim === 'self' ? 'warmup-ember-rim__seat--self-ignite' : '',
          ember.anim === 'extinguish' ? 'warmup-ember-rim__seat--extinguish' : '',
          halo === 'playing' ? 'warmup-ember-rim__seat--halo' : '',
          halo === 'static' ? 'warmup-ember-rim__seat--halo-static' : '',
        ]
          .filter(Boolean)
          .join(' ')

        // Seat-level delay: halo swell stagger (H1) or entry pop stagger (E1).
        // Inline style, static per seat — never a per-frame CSS variable.
        let seatDelayMs: number | null = null
        if (halo === 'playing') seatDelayMs = ember.seatIndex * HALO_STAGGER_MS
        else if (entering && halo === 'off') seatDelayMs = ember.seatIndex * ENTER_STAGGER_MS

        const seatStyle: Record<string, string> = {
          left: `${ember.seat.leftPercent}%`,
          ...(ember.seat.edge === 'top' ? { top: '0' } : { bottom: '0' }),
        }
        if (seatDelayMs) seatStyle.animationDelay = `${seatDelayMs}ms`

        const dotStyle: Record<string, string> = {}
        if (ember.lit) dotStyle.background = ember.accent.fill
        if (settledLit) {
          // I1 — negative delay desyncs the idle breath (never lockstep).
          dotStyle.animationDelay = `${-BREATHE_DESYNC_MS * ember.seatIndex}ms`
        }

        return (
          <View key={ember.userId} className={className} style={seatStyle}>
            {ember.lit && (
              <View
                className='warmup-ember-rim__glow'
                style={{
                  background: `radial-gradient(circle, ${ember.accent.glow} 0%, ${ember.accent.glowFade} 72%)`,
                }}
              />
            )}
            <View className='warmup-ember-rim__dot' style={dotStyle} />
            {ember.anim === 'self' && <View className='warmup-ember-rim__self-flash' />}
          </View>
        )
      })}
    </View>
  )
})

export default WarmupEmberRim
