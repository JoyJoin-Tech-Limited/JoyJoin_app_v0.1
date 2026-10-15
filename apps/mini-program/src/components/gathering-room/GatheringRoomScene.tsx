import { Image, Text, View } from '@tarojs/components'
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { RoomPokeEmoji } from '@shared/wsEvents'
import { ROOM_POKE_EMOJIS } from '@shared/wsEvents'
import type { EquipmentItemView, EquipmentOutfitView } from '@joyjoin/shared/schema'
import { localAsset } from '../../lib/utils/cdnAssets'
import { logWarn } from '../../lib/utils/logger'
import PixelAvatarComposite from '../profile/PixelAvatarComposite'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './GatheringRoomScene.scss'

/**
 * GatheringRoomScene — 集结房间 pixel-scene stage.
 *
 * Full-viewport zero-scroll room: 4–6 matched members wait for the offline
 * event as their existing V2 pixel avatars (with equipped outfits). Three
 * presence states (PRD §3): 未现身 (seat-anchored warm silhouette + held-place
 * name card — 占位剪影, narratively "正在路上"), 在场 (walks in from the door on
 * live arrival, idle breathing), 已确认出席 (seated pose + brand seal).
 *
 * Layers: designed CSS room (素胚房) renders underneath as the loading AND
 * failure state; the bundled composite art (`ROOM_COMPOSITE_PATH`) fades in
 * over it on decode (onError + a 2.5s decode-timeout both log — a failed art
 * load must never be silent). Character layer: every member's avatar sits at
 * their own seat; name plates hang OFF the seat body (placement per seat,
 * collision-audited) so they ride the avatar's animations and never cover a
 * body; per-row perspective scale + painter's z give the stack depth.
 *
 * Interaction: tapping a present tablemate opens the one-tap quick-poke
 * bubble (挥手/击掌/干杯 + 看看TA) anchored above their seat; self/absent taps
 * open the detail sheet. A live activity ticker ("X 推门进来了") is owned by
 * the page controller.
 *
 * Performance note: member profiles (identity + equipment) are kept stable and
 * split from transient presence state. Each seat is memoized so a presence
 * update for one member does not re-render the other PixelAvatarComposite
 * instances.
 *
 * Motion rules: transform/opacity only; entrance curve
 * cubic-bezier(0.22, 1, 0.36, 1); loops pause when the page hides; reduced
 * motion renders everything static at the final state.
 */

/** Single composite background image path (CDN-first, local fallback). */
const ROOM_COMPOSITE_PATH = '/assets/gathering-room/room-composite-v2.webp'

/** Seat anchors in scene-% (x right, y down), origin = scene top-left.
 *  Measured against room-composite-v2.webp's six zabuton cushions (feet land
 *  on the cushion, so the avatar reads as seated at the table):
 *  back (50,35.5) / top-left (34.6,44) / top-right (65.4,44) /
 *  mid-left (32.7,58) / mid-right (67.3,58) / front (50,68.5).
 *  Two extra standing spots along the side walls handle 7–8 member groups
 *  (feet on the floor line, clear of the console and the plant). */
const SEAT_ANCHORS = [
  { x: 50, y: 36 }, // 0 back
  { x: 35, y: 45 }, // 1 mid-left
  { x: 65, y: 45 }, // 2 mid-right
  { x: 33, y: 58 }, // 3 front-left
  { x: 50, y: 68.5 }, // 4 front
  { x: 67, y: 59 }, // 5 front-right
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
const SEATED_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: 0, dy: 18 },
  1: { dx: 16, dy: 8 },
  2: { dx: -16, dy: 8 },
  3: { dx: 14, dy: -14 },
  4: { dx: 0, dy: -18 },
  5: { dx: -14, dy: -14 },
}

/** Scene box in rpx — the composite art is 750×960 and the scene box mirrors
 *  it exactly (full width × 960rpx), so seat-% → rpx math stays exact. */
const SCENE_WIDTH_RPX = 750
const SCENE_HEIGHT_RPX = 960

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
  /** Celebration overlay copy; null hides the overlay. */
  celebrationText?: string | null
  /** Member whose quick-poke bubble is open (anchored above their seat). */
  quickPokeMember?: GatheringRoomMemberProfile | null
  onQuickPoke?: (userId: string, emoji: RoomPokeEmoji) => void
  onQuickPokeProfile?: (member: GatheringRoomMemberProfile) => void
  onDismissQuickPoke?: () => void
  reducedMotion: boolean
  /** Pause all loops when the page is hidden (WeChat page-stack). */
  pageVisible: boolean
  onAvatarTap?: (member: GatheringRoomMemberProfile) => void
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

const CELEBRATION_SPARKLES = [
  { left: '18%', top: '30%', delayMs: 0 },
  { left: '32%', top: '18%', delayMs: 200 },
  { left: '50%', top: '26%', delayMs: 400 },
  { left: '68%', top: '16%', delayMs: 100 },
  { left: '82%', top: '30%', delayMs: 300 },
  { left: '24%', top: '44%', delayMs: 500 },
  { left: '76%', top: '44%', delayMs: 250 },
] as const

export function seatIndexFor(memberIndex: number, count: number): number {
  const normalizedCount = Math.min(Math.max(count, 3), MAX_SEAT_COUNT)
  const map = SEAT_INDEX_BY_COUNT[normalizedCount] ?? SEAT_INDEX_BY_COUNT[6]
  return map[memberIndex] ?? map[map.length - 1] ?? 0
}

interface GatheringRoomSeatProps {
  profile: GatheringRoomMemberProfile
  presence: GatheringRoomPresence
  seatIndex: number
  isOwn: boolean
  isEntering: boolean
  playOwnDoorEntry: boolean
  pokeBadge: GatheringRoomPokeBadge | null
  reducedMotion: boolean
  onAvatarTap?: (member: GatheringRoomMemberProfile) => void
}

const GatheringRoomSeat = memo(function GatheringRoomSeat({
  profile,
  presence,
  seatIndex,
  isOwn,
  isEntering,
  playOwnDoorEntry,
  pokeBadge,
  reducedMotion,
  onAvatarTap,
}: GatheringRoomSeatProps) {
  const anchor = ALL_SEAT_ANCHORS[seatIndex]
  const seatedOffset = SEATED_OFFSETS[seatIndex]

  // Confirmation beat: hop once when this member's attendance flips to
  // confirmed (pairs with the CTA haptic + the 480ms seated slide).
  const prevPresenceRef = useRef(presence)
  const hasMountedRef = useRef(false)
  const [justConfirmed, setJustConfirmed] = useState(false)
  // Live-arrival walk: 'door' renders the avatar at the door point for one
  // beat, then 'walking' flips the wrapper transform to the seat so the
  // 640ms transition reads as a walk. Only for absent→present/confirmed
  // flips after first paint — first-paint members fade in at their seats.
  const [arrival, setArrival] = useState<'door' | 'walking' | null>(null)
  useEffect(() => {
    const prev = prevPresenceRef.current
    prevPresenceRef.current = presence
    const isLiveArrival = hasMountedRef.current && prev === 'absent' && presence !== 'absent'
    hasMountedRef.current = true
    if (isLiveArrival && !reducedMotion) {
      setArrival('door')
      const walkId = setTimeout(() => setArrival('walking'), 60)
      const doneId = setTimeout(() => setArrival(null), 780)
      return () => {
        clearTimeout(walkId)
        clearTimeout(doneId)
      }
    }
    if (presence === 'confirmed' && prev !== 'confirmed' && !reducedMotion) {
      setJustConfirmed(true)
      const id = setTimeout(() => setJustConfirmed(false), 420)
      return () => clearTimeout(id)
    }
  }, [presence, reducedMotion])

  const bodyClass = [
    'gathering-room-scene__seat-body',
    `gathering-room-scene__seat-body--${presence}`,
    !reducedMotion && isEntering ? 'gathering-room-scene__seat-body--entering' : '',
    !reducedMotion && playOwnDoorEntry ? 'gathering-room-scene__seat-body--door-entry' : '',
    justConfirmed ? 'gathering-room-scene__seat-body--just-confirmed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Every member renders their avatar at their own seat — including absent
  // ones, who show as a muted seat-anchored silhouette (占位剪影, PRD §3
  // 名牌/剪影 placeholder). Rendering nothing for absent members left bare
  // floor + a floating name card on every seat whose owner hadn't explicitly
  // confirmed or wasn't concurrently online — on device that is almost every
  // tablemate, so the room looked broken ("only my own avatar renders").
  // The 2026-08-17 lesson still holds: never pile dimmed avatars at the DOOR;
  // a silhouette anchored AT THE SEAT with its name card reads as a held
  // place, and a live arrival swaps it for the real avatar walking in.
  //
  // The seated (confirmed) offset lives on the seat WRAPPER so pose keyframes
  // and the press state on the body never fight it — an animation on the same
  // element would override an inline transform mid-run and snap the avatar
  // back to the standing spot. A live arrival mounts at the door point and
  // the wrapper's 640ms transition walks the avatar to its seat.
  const doorPoint = doorQueuePoint(seatIndex)
  const seatStyle: CSSProperties = {
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
    // Painter's algorithm: front rows occlude back rows (and their cards).
    zIndex: seatZIndex(anchor.y),
    // First-paint stagger (see &__seat animation in the stylesheet); the base
    // 150ms lets the room art finish fading in before anyone walks in. Live
    // arrivals skip the stagger — they fade in at the door instead.
    animationDelay: arrival ? '0ms' : `${150 + seatIndex * 70}ms`,
    ...(arrival === 'door'
      ? {
          transform: `translate(-50%, -88%) translate(${(doorPoint.x - anchor.x) / 100 * SCENE_WIDTH_RPX}rpx, ${(doorPoint.y - anchor.y) / 100 * SCENE_HEIGHT_RPX}rpx)`,
        }
      : presence === 'confirmed' && seatedOffset
        ? { transform: `translate(-50%, -88%) translate(${seatedOffset.dx}rpx, ${seatedOffset.dy}rpx)` }
        : {}),
  }

  // Desync the shared breathing loop per seat so members don't bob in
  // lockstep (chorus-line robot effect). Only while idle-present: a negative
  // delay on the entry keyframes would skip them.
  const bodyStyle: CSSProperties =
    presence === 'present' && !isEntering && !playOwnDoorEntry
      ? { animationDelay: `-${seatIndex * 900}ms` }
      : {}

  const name = profile.displayName || '队友'

  const itemsById = useMemo(
    () => new Map((profile.equippedItems ?? []).map((item) => [item.id, item])),
    [profile.equippedItems],
  )

  const cardPlacement = NAME_CARD_PLACEMENT[seatIndex] ?? 'below'
  const nameCardClass = [
    'gathering-room-scene__name-card',
    `gathering-room-scene__name-card--${cardPlacement}`,
    `gathering-room-scene__name-card--${presence}`,
  ].join(' ')

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
        aria-label={`${name} 的座位`}
        role='button'
        onClick={() => onAvatarTap?.(profile)}
      >
        {/* Warm halo behind absent silhouettes — a held place glows softly
            instead of reading as a ghost on bare floor. */}
        {presence === 'absent' ? (
          <View className='gathering-room-scene__seat-halo' aria-hidden='true' />
        ) : null}
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
          <View className='gathering-room-scene__confirmed-seal'>
            <View className='gathering-room-scene__confirmed-seal-check' aria-hidden='true' />
          </View>
        ) : null}
        {pokeBadge ? (
          <View className='gathering-room-scene__poke-badge' key={pokeBadge.ts}>
            <Text className='gathering-room-scene__poke-badge-text'>
              {`${pokeBadge.fromName} ${POKE_BADGE_LABELS[pokeBadge.emoji]}`}
            </Text>
          </View>
        ) : null}
        {/* Name plate — absolutely hung off the seat body so it rides every
            animation (breathe / hop / seated shift) with its avatar and can
            never drift onto the legs. Placement per seat: mid-rows hang it on
            the outer side (below would collide with the front row). */}
        <View className={nameCardClass}>
          <ArchetypeHead
            archetype={profile.archetype}
            size={30}
            variant='grid'
            fallback='none'
            className='gathering-room-scene__name-card-head'
          />
          <Text className='gathering-room-scene__name-card-text'>{name}</Text>
          {presence === 'absent' ? (
            <View className='gathering-room-scene__name-card-dot' aria-hidden='true' />
          ) : null}
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
  quickPokeMember,
  onQuickPoke,
  onQuickPokeProfile,
  onDismissQuickPoke,
  reducedMotion,
  pageVisible,
  onAvatarTap,
}: GatheringRoomSceneProps) {
  const sceneClass = [
    'gathering-room-scene',
    pageVisible ? '' : 'gathering-room-scene--paused',
  ]
    .filter(Boolean)
    .join(' ')

  const ownUserIdResolved = ownUserId ?? ''

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

  // Entrance choreography: seats mount only once the room art has decoded
  // (900ms fallback so a slow/failed art load never blocks the room), then
  // stagger in per seat — the room "lights up" before anyone walks in.
  const [entranceArmed, setEntranceArmed] = useState(false)
  useEffect(() => {
    if (entranceArmed) return
    if (roomArtLoaded) {
      const id = setTimeout(() => setEntranceArmed(true), 150)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setEntranceArmed(true), 900)
    return () => clearTimeout(id)
  }, [roomArtLoaded, entranceArmed])

  // Celebration exit choreography: when the controller clears the text, keep
  // the overlay mounted for a 320ms fade-out instead of unmounting mid-beat.
  const [celebrationShown, setCelebrationShown] = useState<string | null>(null)
  const [celebrationLeaving, setCelebrationLeaving] = useState(false)
  useEffect(() => {
    if (celebrationText) {
      setCelebrationShown(celebrationText)
      setCelebrationLeaving(false)
      return
    }
    if (!celebrationShown) return
    setCelebrationLeaving(true)
    const id = setTimeout(() => {
      setCelebrationShown(null)
      setCelebrationLeaving(false)
    }, 320)
    return () => clearTimeout(id)
  }, [celebrationText, celebrationShown])

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

  // Quick-poke bubble anchor — resolve the target member's seat so the bubble
  // floats above their head. Horizontal clamp keeps it on-screen for the
  // outer standing seats.
  const quickPokeAnchor = useMemo(() => {
    if (!quickPokeMember) return null
    const index = memberProfiles.findIndex((p) => p.userId === quickPokeMember.userId)
    if (index < 0) return null
    const anchor = ALL_SEAT_ANCHORS[seatIndexFor(index, memberProfiles.length)]
    return { x: Math.min(Math.max(anchor.x, 28), 72), y: anchor.y }
  }, [quickPokeMember, memberProfiles])

  return (
    <View className={sceneClass} data-testid='gathering-room-scene'>
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
        style={{ opacity: roomArtLoaded ? 1 : 0, transition: 'opacity 320ms ease-out' }}
      />

      {/* Lamp glow breathing — only over the real art (the CSS room carries
          its own glow; a floating pulse over bare space exposes the void). */}
      {roomArtLoaded ? (
        <View className='gathering-room-scene__layer gathering-room-scene__layer--lamp-breathe' aria-hidden='true' />
      ) : null}

      {/* Character layer — above the art and lamp-breathe overlay. Each seat
          is memoized so presence changes only re-render the seat whose state
          actually changed. Every member's avatar stays at their own seat:
          absent members render as a muted silhouette (占位剪影) behind their
          held-place name card; the real avatar walks in from the door on
          arrival and the silhouette crossfades to full color. The name plate
          lives inside each seat body so it rides the avatar's animations. */}
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
                seatIndex={seatIndex}
                isOwn={isOwn}
                isEntering={enteringUserIds.has(profile.userId)}
                playOwnDoorEntry={isOwn && playOwnDoorEntry}
                pokeBadge={isOwn ? pokeBadge ?? null : null}
                reducedMotion={reducedMotion}
                onAvatarTap={onAvatarTap}
              />
            )
          })
        : null}

      {/* Quick-poke bubble — one-tap 挥手/击掌/干杯 anchored above a present
          tablemate's seat (the detail sheet used to be the only path). The
          catcher sits BELOW seat z-indexes: tapping empty room dismisses,
          tapping another seat retargets. */}
      {quickPokeMember && quickPokeAnchor ? (
        <Fragment>
          <View
            className='gathering-room-scene__poke-catcher'
            onClick={() => onDismissQuickPoke?.()}
          />
          <View
            className='gathering-room-scene__quick-poke'
            style={{ left: `${quickPokeAnchor.x}%`, top: `${quickPokeAnchor.y}%` }}
          >
            {ROOM_POKE_EMOJIS.map((emoji) => (
              <View
                key={emoji}
                className='gathering-room-scene__quick-poke-chip'
                hoverClass='gathering-room-scene__quick-poke-chip--pressed'
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
              onClick={() => onQuickPokeProfile?.(quickPokeMember)}
            >
              <Text className='gathering-room-scene__quick-poke-chip-text'>看看TA</Text>
            </View>
          </View>
        </Fragment>
      ) : null}

      {firstArriverText ? (
        <View className='gathering-room-scene__first-arriver'>
          <Text className='gathering-room-scene__first-arriver-text'>{firstArriverText}</Text>
        </View>
      ) : null}

      {celebrationShown ? (
        <View
          className={`gathering-room-scene__celebration${celebrationLeaving ? ' gathering-room-scene__celebration--leaving' : ''}`}
          role='status'
          aria-live='polite'
        >
          <View className='gathering-room-scene__celebration-glow' aria-hidden='true' />
          {!reducedMotion
            ? CELEBRATION_SPARKLES.map((spec, index) => (
                <View
                  key={index}
                  className='gathering-room-scene__celebration-sparkle'
                  aria-hidden='true'
                  style={{
                    left: spec.left,
                    top: spec.top,
                    animationDelay: `${spec.delayMs}ms`,
                  }}
                />
              ))
            : null}
          <View className='gathering-room-scene__celebration-card'>
            <Text className='gathering-room-scene__celebration-text'>{celebrationShown}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

export default GatheringRoomScene
