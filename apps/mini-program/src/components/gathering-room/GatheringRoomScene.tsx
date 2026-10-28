import { Image, ScrollView, Text, View } from '@tarojs/components'
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { GatheringRoomMember } from '@shared/api'
import type { RoomPokeEmoji } from '@shared/wsEvents'
import { ROOM_POKE_EMOJIS } from '@shared/wsEvents'
import type { EquipmentItemView, EquipmentOutfitView } from '@joyjoin/shared/schema'
import { localAsset } from '../../lib/utils/cdnAssets'
import { logWarn } from '../../lib/utils/logger'
import {
  ROOM_TABLE_OVERLAY,
  ROOM_TABLE_OVERLAY_STYLE,
} from './room-table-overlay.meta'
import { resolveGatheringRoomMemberState } from '../../pages/gathering-room/gatheringRoomPresence'
import PixelAvatarComposite from '../profile/PixelAvatarComposite'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './GatheringRoomScene.scss'

/**
 * GatheringRoomScene — 集结房间 pixel-scene stage.
 *
 * Full-viewport zero-scroll room: matched members wait for the offline event
 * as their existing V2 pixel avatars. Durable attendance and ephemeral WS
 * presence stay independent: the member-state helper owns every spoken label
 * and poke-eligibility decision; neither axis claims physical arrival.
 *
 * Layers: the designed CSS room renders underneath as the loading/failure
 * state; bundled composite art fades in on decode. Every avatar stays at its
 * measured seat anchor, the transparent table plane occludes bodies only, and
 * scene-level name plates remain readable above that plane.
 *
 * Interaction: an ordinary tap ALWAYS opens member details (the primary poke
 * path lives in that sheet). Long-press is only a shortcut for an eligible,
 * non-self tablemate. Compact screens replace scaled labels with an unscaled
 * three-column roster; 7–8 members scroll inside that roster, never the page.
 *
 * Motion rules: transform/opacity only. Real arrivals keep their one-shot
 * response; only the viewer's real confirmation success can arm the 480ms seat
 * and 320ms seal pulse. No decorative perpetual glow/pulse survives. Offline
 * and ended rooms disable live feedback; reduced motion and ended rooms render
 * equivalent static states.
 */

/** Single composite background image path — subpackage-local, package-direct.
 *  2026-10-15: the two room composites were moved out of the main package's
 *  `assets/` directory (WeChat rejected the upload with errcode 80200, main
 *  package source size 2064KB > 2048KB). The asset now travels with the
 *  gathering-room subpackage (see the copy pattern in config/index.ts), which
 *  has its own budget, and nothing fetches it from the CDN. */
const ROOM_COMPOSITE_PATH = '/pages/gathering-room/assets/room-composite-v2.webp'

/** Seat anchors in scene-% (x right, y down), origin = scene top-left.
 *  Measured against room-composite-v2.webp's six zabuton cushions (feet land
 *  on the cushion, so the avatar reads as seated at the table):
 *  back (48.8,38.8) / mid-left (34.3,44.4) / mid-right (65.3,44.4) /
 *  front-left (32.5,57.4) / front-right (67.1,57.4) / front (50.1,71.3).
 *  Two extra standing spots along the side walls handle 7–8 member groups
 *  (feet on the floor line, clear of the console and the plant). */
export const SEAT_ANCHORS = [
  { x: 48.8, y: 38.8 }, // 0 back
  { x: 34.3, y: 44.4 }, // 1 mid-left
  { x: 65.3, y: 44.4 }, // 2 mid-right
  { x: 32.5, y: 57.4 }, // 3 front-left
  { x: 50.1, y: 71.3 }, // 4 front
  { x: 67.1, y: 57.4 }, // 5 front-right
] as const

const EXTRA_SEAT_ANCHORS = [
  { x: 72, y: 51 }, // 6 standing, right wall between door and console
  { x: 24, y: 51 }, // 7 standing, left wall below the window
] as const

const ALL_SEAT_ANCHORS = [...SEAT_ANCHORS, ...EXTRA_SEAT_ANCHORS] as const
const MAX_SEAT_COUNT = ALL_SEAT_ANCHORS.length

/** Name-card placement per seat — collision-audited against the full 6-seat
 *  house (and the 7/8 standing spots) so a plate can never stamp onto another
 *  character (2026-10-14 review). Geometry: row pitch 125rpx < avatar 144rpx,
 *  so "below" is only safe for the front-centre seat (4); the back-centre
 *  seat (0) hangs its plate ABOVE the head (its below-band runs into the mid
 *  row's avatars); every flanking seat hangs the plate on the outer side, and
 *  the two wall spots (6/7) hang INWARD so the plate never clips the edge. */
export const NAME_CARD_PLACEMENT = ['above', 'left', 'right', 'left', 'below', 'right', 'left', 'right'] as const

/** Perspective: deeper rows render slightly smaller so the six-avatar stack
 *  reads as depth around a table instead of a flat circle of clones. */
export function rowPerspectiveScale(anchorY: number): number {
  if (anchorY <= 40) return 0.88
  if (anchorY <= 52) return 0.94
  return 1
}

/** Painter's-algorithm z so a front-row avatar naturally occludes whatever is
 *  behind it (a back row's side card can no longer stamp over a body). */
export function seatZIndex(anchorY: number): number {
  return 10 + Math.round(anchorY)
}

/** Which seat indices are used for a given member count (3–8). Front seats are
 *  filled last so the viewer keeps a clear window onto the table. */
const SEAT_INDEX_BY_COUNT: Record<number, readonly number[]> = {
  3: [1, 2, 4],
  4: [1, 2, 3, 5],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
}

/** Seated-pose offset per seat (confirmed members shift closer to the table).
 *  Hand-authored transform offsets — transform-only, no layout measurement.
 *  Extra standing seats (6,7) have no offset; they remain standing. */
export const SEATED_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: 0, dy: 0 },
  1: { dx: 16, dy: 0 },
  2: { dx: -16, dy: 0 },
  3: { dx: 10, dy: 0 },
  4: { dx: 0, dy: 0 },
  5: { dx: -10, dy: 0 },
}

/** Scene box in rpx — the composite art is 750×960 and the scene box mirrors
 *  it exactly (full width × 960rpx), so seat-% → rpx math stays exact. */
const SCENE_WIDTH_RPX = 750
const SCENE_HEIGHT_RPX = 960
const QUICK_POKE_BUBBLE_WIDTH_RPX = 420
const SCENE_SAFE_MARGIN_RPX = 16
const QUICK_POKE_MIN_X = ((QUICK_POKE_BUBBLE_WIDTH_RPX / 2 + SCENE_SAFE_MARGIN_RPX) / SCENE_WIDTH_RPX) * 100
const QUICK_POKE_MAX_X = 100 - QUICK_POKE_MIN_X

/** Door zone (%) — a live arrival materializes here for one beat, then the
 *  wrapper transition walks the avatar to its seat. Anchored on the actual
 *  doorway floor (door threshold is x 55–70%, y≈45% in the composite art);
 *  fanned per seat index so back-to-back arrivals don't spawn on top of
 *  each other. */
const DOOR_QUEUE_BASE = { x: 56, y: 42 } as const

function doorQueuePoint(seatIndex: number): { x: number; y: number } {
  const col = seatIndex % 2
  const row = Math.floor(seatIndex / 2)
  return { x: DOOR_QUEUE_BASE.x + col * 7, y: DOOR_QUEUE_BASE.y + row * 5 }
}

export type GatheringRoomPresence = 'absent' | 'present' | 'confirmed'

export interface GatheringRoomMemberProfile {
  userId: string
  displayName?: string | null
  archetype?: string | null
  /** Durable server attendance; required for the attendance × presence truth matrix. */
  attendanceStatus: GatheringRoomMember['attendanceStatus']
  /** Existing avatar-system outfit + resolved items so equipment shows in-room. */
  outfit?: EquipmentOutfitView | null
  equippedItems?: EquipmentItemView[]
}

export interface GatheringRoomPokeBadge {
  fromName: string
  emoji: RoomPokeEmoji
  ts: number
}

export interface GatheringRoomSceneProps {
  /** Stable identity + equipment profiles (presence is supplied separately). */
  memberProfiles: GatheringRoomMemberProfile[]
  /** Transient presence per member. */
  presenceByUserId: ReadonlyMap<string, GatheringRoomPresence>
  ownUserId?: string
  /** Transient look-up bounce for members who just entered. */
  enteringUserIds: ReadonlySet<string>
  /** Play the own-avatar door-entry animation (first arrival only). */
  playOwnDoorEntry: boolean
  /** Floating poke badge near the viewer's avatar (transient). */
  pokeBadge?: GatheringRoomPokeBadge | null
  /** First-arriver banner copy; null hides the banner. */
  firstArriverText?: string | null
  /** Authoritative all-confirmed trigger; null hides the non-modal table card. */
  celebrationText?: string | null
  /** Initial/late-join presentation: static copy, no animation or Scene haptic. */
  celebrationStatic: boolean
  /** Raw WS presence; durable attendance stays on each member profile. */
  presentUserIds: ReadonlySet<string>
  wsConnected: boolean
  eventPhase: 'upcoming' | 'live' | 'ended'
  /** Success-only, viewer-only pulse signal; never derived from a refetch. */
  ownConfirmationPulse: boolean
  /** Eligible member whose secondary quick-poke surface is open. */
  quickPokeMember?: GatheringRoomMemberProfile | null
  onQuickPoke?: (userId: string, emoji: RoomPokeEmoji) => void
  onQuickPokeProfile?: (member: GatheringRoomMemberProfile) => void
  onDismissQuickPoke?: () => void
  reducedMotion: boolean
  /** Uniformly fitted design-space geometry; null until the wrapper is measured. */
  layout: { width: number; height: number; scale: number } | null
  /** Pause all loops when the page is hidden (WeChat page-stack). */
  pageVisible: boolean
  onAvatarTap?: (member: GatheringRoomMemberProfile) => void
  onAvatarLongPress?: (member: GatheringRoomMemberProfile) => void
}

/** Short labels for poke badges — CSS/text badges only, no emoji glyphs. */
const POKE_BADGE_LABELS: Record<RoomPokeEmoji, string> = {
  wave: '向你挥手',
  'hi-five': '想和你击掌',
  drink: '喊你干杯',
}

/** Quick-poke bubble choices — one tap, no sheet detour. Shared with the
 *  page's detail-sheet poke row so the two surfaces can never drift. */
export const QUICK_POKE_LABELS: Record<RoomPokeEmoji, string> = {
  wave: '挥手',
  'hi-five': '击掌',
  drink: '干杯',
}

const EMPTY_OUTFIT: EquipmentOutfitView = {
  topItemId: null,
  bottomItemId: null,
  shoesItemId: null,
  accessoryItemId: null,
  version: 1,
}

const OWN_CONFIRMATION_PULSE_MS = 480
const CELEBRATION_ENTER_MS = 360
const CELEBRATION_HOLD_MS = 1400
const CELEBRATION_EXIT_MS = 240
const CELEBRATION_TOTAL_MS = CELEBRATION_ENTER_MS + CELEBRATION_HOLD_MS + CELEBRATION_EXIT_MS
const CELEBRATION_TITLE = '这桌齐了'
const CELEBRATION_SUBTITLE = '悦仔先偷笑一下，现场见'
const CELEBRATION_ARIA_LABEL = '全员已确认出席'

export function seatIndexFor(memberIndex: number, count: number): number {
  const normalizedCount = Math.min(Math.max(count, 3), MAX_SEAT_COUNT)
  const map = SEAT_INDEX_BY_COUNT[normalizedCount] ?? SEAT_INDEX_BY_COUNT[6]
  return map[memberIndex] ?? map[map.length - 1] ?? 0
}

export function resolveQuickPokeAnchor(seatIndex: number) {
  const anchor = ALL_SEAT_ANCHORS[seatIndex] ?? ALL_SEAT_ANCHORS[0]
  return {
    x: Math.min(Math.max(anchor.x, QUICK_POKE_MIN_X), QUICK_POKE_MAX_X),
    y: anchor.y,
    placement: NAME_CARD_PLACEMENT[seatIndex] === 'above' ? 'below' : 'above',
  } as const
}

interface GatheringRoomSeatProps {
  profile: GatheringRoomMemberProfile
  presence: GatheringRoomPresence
  presentUserIds: ReadonlySet<string>
  wsConnected: boolean
  eventPhase: GatheringRoomSceneProps['eventPhase']
  pageVisible: boolean
  seatIndex: number
  isOwn: boolean
  isEntering: boolean
  playOwnDoorEntry: boolean
  ownConfirmationPulse: boolean
  pokeBadge: GatheringRoomPokeBadge | null
  reducedMotion: boolean
  pxPerRpx: number
  onAvatarTap?: (member: GatheringRoomMemberProfile) => void
  onAvatarLongPress?: (member: GatheringRoomMemberProfile) => void
}

const GatheringRoomSeat = memo(function GatheringRoomSeat({
  profile,
  presence,
  presentUserIds,
  wsConnected,
  eventPhase,
  pageVisible,
  seatIndex,
  isOwn,
  isEntering,
  playOwnDoorEntry,
  ownConfirmationPulse,
  pokeBadge,
  reducedMotion,
  pxPerRpx,
  onAvatarTap,
  onAvatarLongPress,
}: GatheringRoomSeatProps) {
  const anchor = ALL_SEAT_ANCHORS[seatIndex]
  const seatedOffset = SEATED_OFFSETS[seatIndex]
  // Inline rpx is dropped by Taro's H5 style serializer; use concrete px so
  // confirmation offsets and door arrivals survive on every renderer.
  const toPx = (value: number) => `${value * pxPerRpx}px`

  const memberState = resolveGatheringRoomMemberState({
    attendanceStatus: profile.attendanceStatus,
    isPresent: presentUserIds.has(profile.userId),
    wsConnected,
    eventPhase,
  })
  const realtimeConnectionEnabled = wsConnected && eventPhase !== 'ended'
  const realtimeMotionEnabled = realtimeConnectionEnabled && pageVisible && !reducedMotion

  // Live arrival is observed only after first paint. A disconnect, page hide,
  // ended event or RM preference settles the current walk without replaying it.
  const prevPresenceRef = useRef(presence)
  const hasMountedRef = useRef(false)
  const [arrival, setArrival] = useState<'door' | 'walking' | null>(null)
  useEffect(() => {
    const prev = prevPresenceRef.current
    prevPresenceRef.current = presence
    const isLiveArrival = hasMountedRef.current && prev === 'absent' && presence !== 'absent'
    hasMountedRef.current = true
    if (!realtimeMotionEnabled) {
      setArrival(null)
      return
    }
    if (!isLiveArrival) return
    setArrival('door')
    const walkId = setTimeout(() => setArrival('walking'), 60)
    const doneId = setTimeout(() => setArrival(null), 780)
    return () => {
      clearTimeout(walkId)
      clearTimeout(doneId)
    }
  }, [presence, realtimeMotionEnabled])

  // The controller's success-only signal arms this pulse; presence must also
  // be confirmed so there is no optimistic seat/check. A per-mount consumption
  // ref blocks first-paint, refetch, reconnect and swipe-back replays.
  const ownPulseConsumedRef = useRef(false)
  const [ownPulseActive, setOwnPulseActive] = useState(false)
  useEffect(() => {
    if (!ownConfirmationPulse || ownPulseConsumedRef.current || presence !== 'confirmed') return
    ownPulseConsumedRef.current = true
    if (realtimeConnectionEnabled && !reducedMotion) setOwnPulseActive(true)
  }, [ownConfirmationPulse, presence, realtimeConnectionEnabled, reducedMotion])
  useEffect(() => {
    if (!ownPulseActive) return
    if (presence !== 'confirmed' || !realtimeConnectionEnabled || reducedMotion) {
      setOwnPulseActive(false)
      return
    }
    const id = setTimeout(() => setOwnPulseActive(false), OWN_CONFIRMATION_PULSE_MS)
    return () => clearTimeout(id)
  }, [ownPulseActive, presence, realtimeConnectionEnabled, reducedMotion])

  const showOwnConfirmationPulse =
    ownPulseActive && presence === 'confirmed' && realtimeConnectionEnabled && !reducedMotion
  const showBreathing =
    presence === 'present' && realtimeMotionEnabled && !isEntering && !playOwnDoorEntry && !arrival
  const bodyClass = [
    'gathering-room-scene__seat-body',
    `gathering-room-scene__seat-body--${presence}`,
    showBreathing ? 'gathering-room-scene__seat-body--breathing' : '',
    realtimeMotionEnabled && isEntering ? 'gathering-room-scene__seat-body--entering' : '',
    realtimeMotionEnabled && playOwnDoorEntry ? 'gathering-room-scene__seat-body--door-entry' : '',
    showOwnConfirmationPulse ? 'gathering-room-scene__seat-body--own-confirmation-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Every member renders at their own seat. Absent members keep a muted,
  // static silhouette and a held-place name card; a real arrival may walk in,
  // but no halo/dot/pulse is needed to explain the state.
  //
  // The seated offset lives on the WRAPPER so pose keyframes and press state
  // never fight the inline transform. Its 480ms transition covers confirmation;
  // a live arrival uses the same transform-only door→seat path.
  const doorPoint = doorQueuePoint(seatIndex)
  const seatStyle: CSSProperties = {
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
    zIndex: seatZIndex(anchor.y),
    // Live arrivals skip first-paint stagger and fade in at the door instead.
    animationDelay: arrival ? '0ms' : `${150 + seatIndex * 70}ms`,
    ...(arrival === 'door'
      ? {
          transform: `translate(-50%, -88%) translate(${toPx((doorPoint.x - anchor.x) / 100 * SCENE_WIDTH_RPX)}, ${toPx((doorPoint.y - anchor.y) / 100 * SCENE_HEIGHT_RPX)})`,
        }
      : presence === 'confirmed' && seatedOffset
        ? { transform: `translate(-50%, -88%) translate(${toPx(seatedOffset.dx)}, ${toPx(seatedOffset.dy)})` }
        : {}),
  }

  // Only connected, upcoming/live idle-present seats breathe. The negative
  // delay desyncs the loop; entry keyframes never inherit it.
  const bodyStyle: CSSProperties = showBreathing
    ? { animationDelay: `-${seatIndex * 900}ms` }
    : {}

  const name = profile.displayName || '队友'

  const itemsById = useMemo(
    () => new Map((profile.equippedItems ?? []).map((item) => [item.id, item])),
    [profile.equippedItems],
  )

  const canLongPressPoke = memberState.canPoke && !isOwn && realtimeConnectionEnabled
  const seatAriaLabel =
    `${name}${isOwn ? '（我）' : ''}，${memberState.statusLabel}，点按查看详情` +
    (canLongPressPoke ? '，长按可打招呼' : '')

  return (
    <View
      key={profile.userId}
      className='gathering-room-scene__seat'
      style={seatStyle}
    >
      <View
        className={bodyClass}
        style={bodyStyle}
        hoverClass='gathering-room-scene__seat-body--pressed'
        aria-label={seatAriaLabel}
        role='button'
        onClick={() => onAvatarTap?.(profile)}
        onLongPress={canLongPressPoke ? () => onAvatarLongPress?.(profile) : undefined}
      >
        <View
          className='gathering-room-scene__avatar-frame'
          style={{ transform: `scale(${rowPerspectiveScale(anchor.y)})` }}
        >
          <View className='gathering-room-scene__seat-shadow' aria-hidden='true' />
          <PixelAvatarComposite
            archetypeId={profile.archetype ?? 'corgi'}
            outfit={profile.outfit ?? EMPTY_OUTFIT}
            itemsById={itemsById}
            variant='compact'
            className='gathering-room-scene__avatar'
          />
        </View>
        {presence === 'confirmed' ? (
          <View
            className={`gathering-room-scene__confirmed-seal${showOwnConfirmationPulse ? ' gathering-room-scene__confirmed-seal--own-pulse' : ''}`}
            aria-hidden='true'
          >
            <View className='gathering-room-scene__confirmed-seal-check' aria-hidden='true' />
          </View>
        ) : null}
        {pokeBadge && realtimeConnectionEnabled ? (
          <View className='gathering-room-scene__poke-badge' key={pokeBadge.ts}>
            <Text className='gathering-room-scene__poke-badge-text'>
              {`${pokeBadge.fromName} ${POKE_BADGE_LABELS[pokeBadge.emoji]}`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
})

interface GatheringRoomNameCardProps {
  profile: GatheringRoomMemberProfile
  presence: GatheringRoomPresence
  anchor: { x: number; y: number }
  seatIndex: number
  isOwn: boolean
  pxPerRpx: number
}

/**
 * Name plates live in their own scene-level layer. They must stay above the
 * table overlay even when the seat body behind them is occluded by it, so
 * they cannot remain children of the seat (the seat's z-index creates a
 * stacking context that would trap them below the table).
 */
const GatheringRoomNameCard = memo(function GatheringRoomNameCard({
  profile,
  presence,
  anchor,
  seatIndex,
  isOwn,
  pxPerRpx,
}: GatheringRoomNameCardProps) {
  const name = profile.displayName || '队友'
  const cardPlacement = NAME_CARD_PLACEMENT[seatIndex] ?? 'below'
  const seatedOffset = presence === 'confirmed'
    ? SEATED_OFFSETS[seatIndex] ?? { dx: 0, dy: 0 }
    : { dx: 0, dy: 0 }
  const nameCardClass = [
    'gathering-room-scene__name-card',
    `gathering-room-scene__name-card--${cardPlacement}`,
    `gathering-room-scene__name-card--${presence}`,
  ].join(' ')

  return (
    <View
      className='gathering-room-scene__name-card-slot'
      style={{
        left: `${anchor.x}%`,
        top: `${anchor.y}%`,
        transform:
          `translate(-50%, -88%) translate(${seatedOffset.dx * pxPerRpx}px, ${seatedOffset.dy * pxPerRpx}px)`,
      }}
    >
      <View className={nameCardClass}>
        <ArchetypeHead
          archetype={profile.archetype}
          size={30}
          variant='grid'
          fallback='none'
          className='gathering-room-scene__name-card-head'
        />
        <Text className='gathering-room-scene__name-card-text'>{name}</Text>
        {presence === 'confirmed' ? (
          <View className='gathering-room-scene__name-card-check' aria-hidden='true'>
            <View className='gathering-room-scene__name-card-check-mark' />
          </View>
        ) : null}
        {isOwn ? (
          <View className='gathering-room-scene__me-chip'>
            <Text className='gathering-room-scene__me-chip-text'>我</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
})

export function GatheringRoomScene({
  memberProfiles,
  presenceByUserId,
  ownUserId,
  enteringUserIds,
  playOwnDoorEntry,
  pokeBadge,
  firstArriverText,
  celebrationText,
  celebrationStatic,
  presentUserIds,
  wsConnected,
  eventPhase,
  ownConfirmationPulse,
  quickPokeMember,
  onQuickPoke,
  onQuickPokeProfile,
  onDismissQuickPoke,
  reducedMotion,
  layout,
  pageVisible,
  onAvatarTap,
  onAvatarLongPress,
}: GatheringRoomSceneProps) {
  const staticMotion = reducedMotion || eventPhase === 'ended'
  const realtimeConnectionEnabled = wsConnected && eventPhase !== 'ended'
  const sceneClass = [
    'gathering-room-scene',
    pageVisible ? '' : 'gathering-room-scene--paused',
    staticMotion ? 'gathering-room-scene--static' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const ownUserIdResolved = ownUserId ?? ''
  const pxPerRpx = (layout?.width ?? 375) / SCENE_WIDTH_RPX
  const sceneStyle: CSSProperties = {
    width: layout?.width ?? 375,
    height: layout?.height ?? 480,
    transform: `translate(-50%, -50%) scale(${layout?.scale ?? 1})`,
    visibility: layout ? 'visible' : 'hidden',
  }

  // Bundled local art (packOptions force-included) — no CDN attempt at all.
  // Fade in on decode so the art never pops into the scene. The designed CSS
  // room (素胚房) sits underneath as the loading/failure state — a bare flat
  // gradient is not an acceptable fallback (2026-10-14 review).
  const roomArtSrc = localAsset(ROOM_COMPOSITE_PATH)
  const [roomArtLoaded, setRoomArtLoaded] = useState(false)
  // The composite <Image> previously had only onLoad — a failed decode left
  // opacity pinned at 0 forever with zero telemetry. Track both outcomes and
  // log a decode timeout so the silent-failure class is observable.
  const artSettledRef = useRef(false)
  useEffect(() => {
    const id = setTimeout(() => {
      if (!artSettledRef.current) {
        logWarn('[GatheringRoomScene] Room art decode timeout — showing CSS room', {
          src: roomArtSrc,
        })
      }
    }, 2500)
    return () => clearTimeout(id)
  }, [roomArtSrc])
  const handleRoomArtLoad = () => {
    artSettledRef.current = true
    setRoomArtLoaded(true)
  }
  const handleRoomArtError = () => {
    artSettledRef.current = true
    logWarn('[GatheringRoomScene] Room art failed to decode — showing CSS room', {
      src: roomArtSrc,
    })
  }

  // Motion-free states show their final content immediately. Otherwise seats
  // wait for art decode (900ms fallback) before the one-time entrance stagger.
  const [entranceArmed, setEntranceArmed] = useState(false)
  useEffect(() => {
    if (entranceArmed) return
    if (staticMotion) {
      setEntranceArmed(true)
      return
    }
    if (roomArtLoaded) {
      const id = setTimeout(() => setEntranceArmed(true), 150)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setEntranceArmed(true), 900)
    return () => clearTimeout(id)
  }, [roomArtLoaded, entranceArmed, staticMotion])

  // The controller owns the factual trigger and haptics; the scene owns only
  // the 360ms enter / 1400ms hold / 240ms exit presentation. Initial/static and
  // RM cards render the same copy without motion and never replay on refetch.
  const celebrationIsStatic = celebrationStatic || reducedMotion
  const [celebrationVisible, setCelebrationVisible] = useState(false)
  const [celebrationLeaving, setCelebrationLeaving] = useState(false)
  useEffect(() => {
    setCelebrationLeaving(false)
    if (!celebrationText || eventPhase === 'ended' || (!celebrationIsStatic && !wsConnected)) {
      setCelebrationVisible(false)
      return
    }
    setCelebrationVisible(true)
    if (celebrationIsStatic) {
      const id = setTimeout(() => setCelebrationVisible(false), CELEBRATION_TOTAL_MS)
      return () => clearTimeout(id)
    }
    const leaveId = setTimeout(
      () => setCelebrationLeaving(true),
      CELEBRATION_ENTER_MS + CELEBRATION_HOLD_MS,
    )
    const doneId = setTimeout(() => {
      setCelebrationVisible(false)
      setCelebrationLeaving(false)
    }, CELEBRATION_TOTAL_MS)
    return () => {
      clearTimeout(leaveId)
      clearTimeout(doneId)
    }
  }, [celebrationText, celebrationIsStatic, eventPhase, wsConnected])

  // Defensive: groups larger than the art's seat map render, but warn so we
  // know the layout is degrading rather than silently dropping members.
  useEffect(() => {
    if (memberProfiles.length > MAX_SEAT_COUNT) {
      logWarn('[GatheringRoomScene] Member count exceeds available seat anchors', {
        count: memberProfiles.length,
        max: MAX_SEAT_COUNT,
      })
    }
  }, [memberProfiles.length])

  // Quick-poke bubble anchor — clamp the measured 420rpx bubble inside the
  // scene with a 16rpx gutter. Rear seat 0 already owns an above-head name
  // card, so its bubble opens below instead of covering that card.
  const quickPokeAnchor = useMemo(() => {
    if (!quickPokeMember) return null
    const index = memberProfiles.findIndex((p) => p.userId === quickPokeMember.userId)
    if (index < 0) return null
    const seatIndex = seatIndexFor(index, memberProfiles.length)
    return resolveQuickPokeAnchor(seatIndex)
  }, [quickPokeMember, memberProfiles])

  const compactInteractions = Boolean(layout && layout.scale < 0.75)
  const quickPokeMemberState = quickPokeMember
    ? resolveGatheringRoomMemberState({
        attendanceStatus: quickPokeMember.attendanceStatus,
        isPresent: presentUserIds.has(quickPokeMember.userId),
        wsConnected,
        eventPhase,
      })
    : null
  const quickPokeVisible = Boolean(
    quickPokeMember &&
    quickPokeAnchor &&
    quickPokeMember.userId !== ownUserIdResolved &&
    quickPokeMemberState?.canPoke &&
    realtimeConnectionEnabled
  )

  // Compact labels never ride the scene scale. The helper's full dual-axis
  // label is both visible and spoken; only eligible non-self members expose
  // the long-press shortcut, while every cell keeps its ordinary detail tap.
  const renderCompactRosterGrid = () => (
    <View className='gathering-room-scene__compact-roster-grid'>
      {memberProfiles.map((profile) => {
        const isOwn = profile.userId === ownUserIdResolved
        const name = profile.displayName || '桌友'
        const memberState = resolveGatheringRoomMemberState({
          attendanceStatus: profile.attendanceStatus,
          isPresent: presentUserIds.has(profile.userId),
          wsConnected,
          eventPhase,
        })
        const canLongPressPoke = memberState.canPoke && !isOwn && realtimeConnectionEnabled
        const ariaLabel =
          `${name}${isOwn ? '（我）' : ''}，${memberState.statusLabel}，点按查看详情` +
          (canLongPressPoke ? '，长按可打招呼' : '')
        return (
          <View
            key={profile.userId}
            className='gathering-room-scene__compact-roster-item'
            hoverClass='gathering-room-scene__compact-roster-item--pressed'
            role='button'
            aria-label={ariaLabel}
            onClick={() => onAvatarTap?.(profile)}
            onLongPress={canLongPressPoke ? () => onAvatarLongPress?.(profile) : undefined}
          >
            <View className='gathering-room-scene__compact-roster-name-row'>
              <Text className='gathering-room-scene__compact-roster-name'>{name}</Text>
              {isOwn ? (
                <Text className='gathering-room-scene__compact-roster-own' aria-hidden='true'>我</Text>
              ) : null}
            </View>
            <Text className='gathering-room-scene__compact-roster-status'>
              {memberState.statusLabel}
            </Text>
          </View>
        )
      })}
    </View>
  )

  return (
    <Fragment>
      <View className={sceneClass} data-testid='gathering-room-scene' style={sceneStyle}>
      {/* Designed CSS room (素胚房) — the loading AND failure state under the
          composite art. Wall / wainscot / floor / window glow / low table /
          six cushion platforms: even with zero art the scene reads as a room. */}
      <View
        className='gathering-room-scene__layer gathering-room-scene__layer--fallback-room'
        aria-hidden='true'
        style={{ opacity: roomArtLoaded ? 0 : 1 }}
      >
        <View className='gathering-room-scene__fallback-window' />
        <View className='gathering-room-scene__fallback-wainscot' />
        <View className='gathering-room-scene__fallback-floor' />
        <View className='gathering-room-scene__fallback-table' />
        {SEAT_ANCHORS.map((seat, index) => (
          <View
            key={index}
            className='gathering-room-scene__fallback-cushion'
            style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
          />
        ))}
      </View>

      <Image
        className='gathering-room-scene__layer gathering-room-scene__layer--composite'
        src={roomArtSrc}
        mode='scaleToFill'
        aria-hidden='true'
        onLoad={handleRoomArtLoad}
        onError={handleRoomArtError}
        style={{ opacity: roomArtLoaded ? 1 : 0, transition: staticMotion ? 'none' : 'opacity 320ms ease-out' }}
      />

      {/* Character layer — static room material underneath, measured seats and
          the transparent table plane above. Absent silhouettes stay muted;
          only real arrivals and the viewer's success pulse add motion. Name
          plates render separately below so the table never hides identity. */}
      {entranceArmed
        ? memberProfiles.map((profile, index) => {
            const seatIndex = seatIndexFor(index, memberProfiles.length)
            const isOwn = profile.userId === ownUserIdResolved
            const presence = presenceByUserId.get(profile.userId) ?? 'absent'
            return (
              <GatheringRoomSeat
                key={profile.userId}
                profile={profile}
                presence={presence}
                presentUserIds={presentUserIds}
                wsConnected={wsConnected}
                eventPhase={eventPhase}
                pageVisible={pageVisible}
                seatIndex={seatIndex}
                isOwn={isOwn}
                isEntering={enteringUserIds.has(profile.userId)}
                playOwnDoorEntry={isOwn && playOwnDoorEntry}
                ownConfirmationPulse={isOwn && ownConfirmationPulse}
                pokeBadge={realtimeConnectionEnabled && isOwn ? pokeBadge ?? null : null}
                reducedMotion={reducedMotion}
                pxPerRpx={pxPerRpx}
                onAvatarTap={onAvatarTap}
                onAvatarLongPress={onAvatarLongPress}
              />
            )
          })
        : null}

      {/* The table is a real foreground plane, not part of the flat backdrop.
          This transparent cut-out sits above the back-row body (z49) and below
          the mid/front seats (z54/67/81), so the back member reads as seated
          behind the table instead of standing on top of it. */}
      {roomArtLoaded ? (
        <Image
          className='gathering-room-scene__layer gathering-room-scene__layer--table-overlay'
          src={localAsset(ROOM_TABLE_OVERLAY.path)}
          mode='scaleToFill'
          aria-hidden='true'
          style={ROOM_TABLE_OVERLAY_STYLE}
        />
      ) : null}

      {/* Name plates are a separate, top-most layer: the table overlay must be
          able to occlude a back-row body without ever dimming or clipping the
          plate that identifies that member. */}
      {!compactInteractions && entranceArmed ? (
        <View className='gathering-room-scene__name-card-layer' aria-hidden='true'>
          {memberProfiles.map((profile, index) => {
            const seatIndex = seatIndexFor(index, memberProfiles.length)
            return (
              <GatheringRoomNameCard
                key={profile.userId}
                profile={profile}
                presence={presenceByUserId.get(profile.userId) ?? 'absent'}
                anchor={ALL_SEAT_ANCHORS[seatIndex]}
                seatIndex={seatIndex}
                isOwn={profile.userId === ownUserIdResolved}
                pxPerRpx={pxPerRpx}
              />
            )
          })}
        </View>
      ) : null}

      {/* Quick-poke bubble — a secondary long-press action; a normal avatar
          tap always opens the member sheet first. The catcher sits BELOW seat
          z-indexes: tapping empty room dismisses, another seat retargets. */}
      {quickPokeMember && quickPokeAnchor && quickPokeVisible && !compactInteractions ? (
        <Fragment>
          <View
            className='gathering-room-scene__poke-catcher'
            onClick={() => onDismissQuickPoke?.()}
          />
          <View
            className={`gathering-room-scene__quick-poke gathering-room-scene__quick-poke--${quickPokeAnchor.placement}`}
            style={{ left: `${quickPokeAnchor.x}%`, top: `${quickPokeAnchor.y}%` }}
          >
            {ROOM_POKE_EMOJIS.map((emoji) => (
              <View
                key={emoji}
                className='gathering-room-scene__quick-poke-chip'
                hoverClass='gathering-room-scene__quick-poke-chip--pressed'
                role='button'
                aria-label={`向${quickPokeMember.displayName || '桌友'}${QUICK_POKE_LABELS[emoji]}`}
                onClick={() => onQuickPoke?.(quickPokeMember.userId, emoji)}
              >
                <Text className='gathering-room-scene__quick-poke-chip-text'>
                  {QUICK_POKE_LABELS[emoji]}
                </Text>
              </View>
            ))}
            <View className='gathering-room-scene__quick-poke-divider' aria-hidden='true' />
            <View
              className='gathering-room-scene__quick-poke-chip gathering-room-scene__quick-poke-chip--profile'
              hoverClass='gathering-room-scene__quick-poke-chip--pressed'
              role='button'
              aria-label={`查看${quickPokeMember.displayName || '桌友'}的详情`}
              onClick={() => onQuickPokeProfile?.(quickPokeMember)}
            >
              <Text className='gathering-room-scene__quick-poke-chip-text'>看看TA</Text>
            </View>
          </View>
        </Fragment>
      ) : null}

      {firstArriverText && realtimeConnectionEnabled ? (
        <View className='gathering-room-scene__first-arriver'>
          <Text className='gathering-room-scene__first-arriver-text'>{firstArriverText}</Text>
        </View>
      ) : null}
      </View>

      {celebrationVisible ? (
        <View
          className={[
            'gathering-room-scene__celebration',
            celebrationLeaving ? 'gathering-room-scene__celebration--leaving' : '',
            celebrationIsStatic ? 'gathering-room-scene__celebration--static' : '',
          ].filter(Boolean).join(' ')}
          role='status'
          aria-live='polite'
          aria-label={CELEBRATION_ARIA_LABEL}
        >
          <View className='gathering-room-scene__celebration-card'>
            <Text className='gathering-room-scene__celebration-title'>{CELEBRATION_TITLE}</Text>
            <Text className='gathering-room-scene__celebration-subtitle'>{CELEBRATION_SUBTITLE}</Text>
          </View>
        </View>
      ) : null}

      {compactInteractions ? (
        <View className='gathering-room-scene__compact-layer'>
          {quickPokeMember && quickPokeVisible ? (
            <Fragment>
              <View
                className='gathering-room-scene__compact-scrim'
                aria-hidden='true'
                onClick={() => onDismissQuickPoke?.()}
              />
              <View className='gathering-room-scene__compact-poke-panel'>
                <Text className='gathering-room-scene__compact-poke-title'>
                  和 {quickPokeMember.displayName || '桌友'} 打个招呼
                </Text>
                <View className='gathering-room-scene__compact-poke-grid'>
                  {ROOM_POKE_EMOJIS.map((emoji) => (
                    <View
                      key={emoji}
                      className='gathering-room-scene__compact-poke-action'
                      hoverClass='gathering-room-scene__compact-poke-action--pressed'
                      role='button'
                      aria-label={`向${quickPokeMember.displayName || '桌友'}${QUICK_POKE_LABELS[emoji]}`}
                      onClick={() => onQuickPoke?.(quickPokeMember.userId, emoji)}
                    >
                      <Text className='gathering-room-scene__compact-poke-action-text'>
                        {QUICK_POKE_LABELS[emoji]}
                      </Text>
                    </View>
                  ))}
                  <View
                    className='gathering-room-scene__compact-poke-action'
                    hoverClass='gathering-room-scene__compact-poke-action--pressed'
                    role='button'
                    aria-label={`查看${quickPokeMember.displayName || '桌友'}的详情`}
                    onClick={() => onQuickPokeProfile?.(quickPokeMember)}
                  >
                    <Text className='gathering-room-scene__compact-poke-action-text'>看看TA</Text>
                  </View>
                </View>
                <View
                  className='gathering-room-scene__compact-poke-close'
                  role='button'
                  aria-label='收起打招呼面板'
                  onClick={() => onDismissQuickPoke?.()}
                >
                  <Text className='gathering-room-scene__compact-poke-close-text'>收起</Text>
                </View>
              </View>
            </Fragment>
          ) : (
            <View className='gathering-room-scene__compact-roster-panel'>
              <Text className='gathering-room-scene__compact-roster-hint'>
                {realtimeConnectionEnabled ? '点名字认识桌友 · 详情里可打招呼' : '点名字认识桌友'}
              </Text>
              {/* 7–8-person roster is the only compact scroll port. */}
              {memberProfiles.length > 6 ? (
                <ScrollView
                  scrollY
                  enhanced
                  showScrollbar={false}
                  className='gathering-room-scene__compact-roster-scroll'
                >
                  {renderCompactRosterGrid()}
                </ScrollView>
              ) : renderCompactRosterGrid()}
            </View>
          )}
        </View>
      ) : null}
    </Fragment>
  )
}

export default GatheringRoomScene
