import { Image, Text, View } from '@tarojs/components'
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { RoomPokeEmoji } from '@shared/wsEvents'
import type { EquipmentItemView, EquipmentOutfitView } from '@joyjoin/shared/schema'
import { localAsset } from '../../lib/utils/cdnAssets'
import PixelAvatarComposite from '../profile/PixelAvatarComposite'
import './GatheringRoomScene.scss'

/**
 * GatheringRoomScene — 集结房间 pixel-scene stage.
 *
 * Full-viewport zero-scroll room: 4–6 matched members wait for the offline
 * event as their existing V2 pixel avatars (with equipped outfits). Three
 * presence states (PRD): 未现身 (held-place name card at the seat, no
 * avatar), 在场 (walks in from the door on live arrival, idle breathing),
 * 已确认出席 (seated pose + 已确认 badge).
 *
 * The scene renders the composite room art (`ROOM_COMPOSITE_PATH`) from the
 * bundled package copy (packOptions force-included). Loading locally removes
 * the whole CDN failure class for this asset: a transient CDN error used to
 * pin the session onto a bundled fallback that packOptions.include never
 * uploaded, leaving the scene bare on device. Seats mount once the art has
 * decoded (900ms fallback) so the room "lights up" before anyone walks in,
 * then stagger in per seat.
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
const ROOM_COMPOSITE_PATH = '/assets/gathering-room/room-composite-v1.webp'

/** Seat anchors in % of the scene viewport (x from left, y from top).
 *  Measured against room-composite-v1.webp's six zabuton cushions (feet land
 *  on the cushion, so the avatar reads as seated at the table):
 *  back (50,35.5) / top-left (34.6,44) / top-right (65.4,44) /
 *  mid-left (32.7,58) / mid-right (67.3,58) / front (50,68.5). */
const SEAT_ANCHORS = [
  { x: 50, y: 36 }, // 0 back
  { x: 35, y: 45 }, // 1 mid-left
  { x: 65, y: 45 }, // 2 mid-right
  { x: 33, y: 59 }, // 3 front-left
  { x: 50, y: 69.5 }, // 4 front
  { x: 67, y: 59 }, // 5 front-right
] as const

/** Which seat indices are used for a given member count (4–6). Front seats are
 *  filled last so the viewer keeps a clear window onto the table. */
const SEAT_INDEX_BY_COUNT: Record<number, readonly number[]> = {
  4: [1, 2, 3, 5],
  5: [0, 1, 2, 3, 5],
  6: [0, 1, 2, 3, 4, 5],
}

/** Seated-pose offset per seat (confirmed members shift closer to the table).
 *  Hand-authored transform offsets — transform-only, no layout measurement. */
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
 *  wrapper transition walks the avatar to its seat. Fanned per seat index so
 *  back-to-back arrivals don't spawn on top of each other. */
const DOOR_QUEUE_BASE = { x: 71, y: 30 } as const

function doorQueuePoint(seatIndex: number): { x: number; y: number } {
  const col = seatIndex % 2
  const row = Math.floor(seatIndex / 2)
  return { x: DOOR_QUEUE_BASE.x + col * 8, y: DOOR_QUEUE_BASE.y + row * 8 }
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

function seatIndexFor(memberIndex: number, count: number): number {
  const map = SEAT_INDEX_BY_COUNT[Math.min(Math.max(count, 4), 6)] ?? SEAT_INDEX_BY_COUNT[6]
  return map[memberIndex] ?? memberIndex
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
  const anchor = SEAT_ANCHORS[seatIndex]
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

  // Absent members render no avatar at all — the held-place name card at the
  // seat anchor (rendered by the parent) is their only visual. The seated
  // (confirmed) offset lives on the seat WRAPPER so pose keyframes and the
  // press state on the body never fight it — an animation on the same element
  // would override an inline transform mid-run and snap the avatar back to
  // the standing spot. A live arrival mounts at the door point and the
  // wrapper's 640ms transition walks the avatar to its seat.
  const doorPoint = doorQueuePoint(seatIndex)
  const seatStyle: CSSProperties = {
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
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

  // 未现身 = held-place name card only (rendered by the parent at the seat
  // anchor). No avatar: a pile of dimmed avatars waiting at the door read as
  // a layout bug, not as "on the way" (device screenshot 2026-08-17).
  if (presence === 'absent') return null

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
        <View className='gathering-room-scene__seat-shadow' aria-hidden='true' />
        <PixelAvatarComposite
          archetypeId={profile.archetype ?? 'corgi'}
          outfit={profile.outfit ?? EMPTY_OUTFIT}
          itemsById={itemsById}
          variant='compact'
          className='gathering-room-scene__avatar'
        />
        {presence === 'confirmed' ? (
          <View className='gathering-room-scene__confirmed-badge'>
            <Text className='gathering-room-scene__confirmed-badge-text'>已确认</Text>
          </View>
        ) : null}
        {pokeBadge ? (
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

export function GatheringRoomScene({
  memberProfiles,
  presenceByUserId,
  ownUserId,
  enteringUserIds,
  playOwnDoorEntry,
  pokeBadge,
  firstArriverText,
  celebrationText,
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
  // Fade in on decode so the art never pops into the scene.
  const roomArtSrc = localAsset(ROOM_COMPOSITE_PATH)
  const [roomArtLoaded, setRoomArtLoaded] = useState(false)

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

  return (
    <View className={sceneClass} data-testid='gathering-room-scene'>
      <Image
        className='gathering-room-scene__layer gathering-room-scene__layer--composite'
        src={roomArtSrc}
        mode='scaleToFill'
        aria-hidden='true'
        onLoad={() => setRoomArtLoaded(true)}
        style={{ opacity: roomArtLoaded ? 1 : 0, transition: 'opacity 320ms ease-out' }}
      />

      {/* Lamp glow breathing — a live warm pulse over the static composite art
          so the room feels awake without any animated asset. */}
      <View className='gathering-room-scene__layer gathering-room-scene__layer--lamp-breathe' aria-hidden='true' />

      {/* Character layer — above the art and lamp-breathe overlay. Each seat
          is memoized so presence changes only re-render the seat whose state
          actually changed. Absent members show only their held-place name
          card at the seat; the avatar walks in from the door on arrival. */}
      {entranceArmed
        ? memberProfiles.map((profile, index) => {
            const seatIndex = seatIndexFor(index, memberProfiles.length)
            const isOwn = profile.userId === ownUserIdResolved
            const anchor = SEAT_ANCHORS[seatIndex]
            const presence = presenceByUserId.get(profile.userId) ?? 'absent'
            return (
              <Fragment key={profile.userId}>
                <GatheringRoomSeat
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
                {presence === 'absent' ? (
                  <View
                    className='gathering-room-scene__name-card'
                    style={{
                      left: `${anchor.x}%`,
                      top: `${anchor.y}%`,
                      animationDelay: `${150 + seatIndex * 70}ms`,
                    }}
                  >
                    <View className='gathering-room-scene__name-card-dot' aria-hidden='true' />
                    <Text className='gathering-room-scene__name-card-text'>
                      {profile.displayName || '队友'}
                    </Text>
                  </View>
                ) : null}
              </Fragment>
            )
          })
        : null}

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
