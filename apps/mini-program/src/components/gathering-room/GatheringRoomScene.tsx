import { Image, Text, View } from '@tarojs/components'
import { memo, useMemo, type CSSProperties } from 'react'
import type { RoomPokeEmoji } from '@shared/wsEvents'
import type { EquipmentItemView, EquipmentOutfitView } from '@joyjoin/shared/schema'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'
import PixelAvatarComposite from '../profile/PixelAvatarComposite'
import './GatheringRoomScene.scss'

/**
 * GatheringRoomScene — 集结房间 pixel-scene stage.
 *
 * Full-viewport zero-scroll room: 4–6 matched members stand around the table
 * as their existing V2 pixel avatars (with equipped outfits) while they wait
 * for the offline event. Three presence states (PRD): 未现身 (dimmed + name-card),
 * 在场 (full opacity, idle breathing), 已确认出席 (seated pose + 已确认 badge).
 *
 * The scene uses a single composite room-art image (`ROOM_COMPOSITE_PATH`) when
 * `ROOM_ART_READY` is true; otherwise it falls back to a layered CSS placeholder.
 * Swapping art later only requires changing the path/flag — the seat anchors
 * and character layer stay the same.
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

/** Flip to true when the composite room art (room-composite-v1.png) lands on CDN. */
const ROOM_ART_READY = true

/** Single composite background image path (CDN-first, local fallback). */
const ROOM_COMPOSITE_PATH = '/assets/gathering-room/room-composite-v1.webp'

/** Scene viewport height in rpx — fixed so seat-percent → rpx math stays exact. */
export const GATHERING_ROOM_SCENE_HEIGHT_RPX = 960

/** Seat anchors in % of the scene viewport (x from left, y from top).
 *  Tuned to the composite room art's cushion positions. */
const SEAT_ANCHORS = [
  { x: 48, y: 24 }, // 0 back
  { x: 28, y: 40 }, // 1 mid-left
  { x: 68, y: 40 }, // 2 mid-right
  { x: 24, y: 66 }, // 3 front-left
  { x: 48, y: 72 }, // 4 front
  { x: 72, y: 66 }, // 5 front-right
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

/** Table centre (%) — the lamp glow and seat markers hang off this point. */
const TABLE_CENTER = { x: 50, y: 58 } as const

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

  const bodyClass = [
    'gathering-room-scene__seat-body',
    `gathering-room-scene__seat-body--${presence}`,
    !reducedMotion && isEntering ? 'gathering-room-scene__seat-body--entering' : '',
    !reducedMotion && playOwnDoorEntry ? 'gathering-room-scene__seat-body--door-entry' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const bodyStyle: CSSProperties =
    presence === 'confirmed' && seatedOffset
      ? { transform: `translate(${seatedOffset.dx}rpx, ${seatedOffset.dy}rpx)` }
      : {}

  const name = profile.displayName || '队友'

  const itemsById = useMemo(
    () => new Map((profile.equippedItems ?? []).map((item) => [item.id, item])),
    [profile.equippedItems],
  )

  return (
    <View
      key={profile.userId}
      className='gathering-room-scene__seat'
      style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
    >
      <View
        className={bodyClass}
        style={bodyStyle}
        hoverClass='gathering-room-scene__seat-body--pressed'
        aria-label={`${name} 的座位`}
        role='button'
        onClick={() => onAvatarTap?.(profile)}
      >
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
      {presence === 'absent' ? (
        <View className='gathering-room-scene__name-card'>
          <Text className='gathering-room-scene__name-card-text'>{name}</Text>
        </View>
      ) : null}
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
    ROOM_ART_READY ? 'gathering-room-scene--art' : 'gathering-room-scene--placeholder',
  ]
    .filter(Boolean)
    .join(' ')

  const ownUserIdResolved = ownUserId ?? ''

  // CDN-first with bundled fallback: the composite art may 404 before the CDN
  // upload pipeline ships it — fall back to the local copy instead of showing
  // a bare background.
  const { src: roomArtSrc, onError: handleRoomArtError } = useCdnFirstSrc(ROOM_COMPOSITE_PATH)

  return (
    <View className={sceneClass} data-testid='gathering-room-scene'>
      {ROOM_ART_READY ? (
        <Image
          className='gathering-room-scene__layer gathering-room-scene__layer--composite'
          src={roomArtSrc}
          mode='scaleToFill'
          aria-hidden='true'
          onError={handleRoomArtError}
        />
      ) : (
        <>
          {/* Layer 1 — far wall + floor (placeholder: warm beige wall over wood floor) */}
          <View className='gathering-room-scene__layer gathering-room-scene__layer--far-wall-floor' aria-hidden='true'>
            <View className='gathering-room-scene__wall' />
            <View className='gathering-room-scene__floor' />
          </View>

          {/* Layer 3 — door (entry choreography stage) */}
          <View className='gathering-room-scene__layer gathering-room-scene__layer--door' aria-hidden='true'>
            <View className='gathering-room-scene__door-frame'>
              <View className='gathering-room-scene__door-panel' />
            </View>
          </View>

          {/* Layer 4 — night window (time-passage indicator) */}
          <View className='gathering-room-scene__layer gathering-room-scene__layer--window-night' aria-hidden='true'>
            <View className='gathering-room-scene__window-frame'>
              <View className='gathering-room-scene__window-sky'>
                <View className='gathering-room-scene__window-star gathering-room-scene__window-star--a' />
                <View className='gathering-room-scene__window-star gathering-room-scene__window-star--b' />
                <View className='gathering-room-scene__window-star gathering-room-scene__window-star--c' />
              </View>
            </View>
          </View>

          {/* Layer 2 — six-seat table (coral cloth, six seat markers) */}
          <View
            className='gathering-room-scene__layer gathering-room-scene__layer--table'
            style={{ left: `${TABLE_CENTER.x}%`, top: `${TABLE_CENTER.y}%` }}
            aria-hidden='true'
          >
            <View className='gathering-room-scene__table'>
              <View className='gathering-room-scene__table-cloth' />
              {SEAT_ANCHORS.map((_, index) => (
                <View
                  key={index}
                  className={`gathering-room-scene__seat-marker gathering-room-scene__seat-marker--${index}`}
                />
              ))}
            </View>
          </View>
        </>
      )}

      {/* Character layer — between the table layer and the lamp cone.
          Each seat is memoized so presence changes only re-render the seat
          whose state actually changed. */}
      {memberProfiles.map((profile, index) => {
        const seatIndex = seatIndexFor(index, memberProfiles.length)
        const isOwn = profile.userId === ownUserIdResolved
        return (
          <GatheringRoomSeat
            key={profile.userId}
            profile={profile}
            presence={presenceByUserId.get(profile.userId) ?? 'absent'}
            seatIndex={seatIndex}
            isOwn={isOwn}
            isEntering={enteringUserIds.has(profile.userId)}
            playOwnDoorEntry={isOwn && playOwnDoorEntry}
            pokeBadge={isOwn ? pokeBadge ?? null : null}
            reducedMotion={reducedMotion}
            onAvatarTap={onAvatarTap}
          />
        )
      })}

      {/* Layer 5 — lamp cone (top overlay: purple shade + warm radial glow).
          Hidden when the composite art already includes the lamp + light. */}
      {!ROOM_ART_READY ? (
        <View className='gathering-room-scene__layer gathering-room-scene__layer--lamp-cone' aria-hidden='true'>
          <View className='gathering-room-scene__lamp'>
            <View className='gathering-room-scene__lamp-cord' />
            <View className='gathering-room-scene__lamp-shade' />
          </View>
          <View className='gathering-room-scene__lamp-glow' />
        </View>
      ) : null}

      {firstArriverText ? (
        <View className='gathering-room-scene__first-arriver'>
          <Text className='gathering-room-scene__first-arriver-text'>{firstArriverText}</Text>
        </View>
      ) : null}

      {celebrationText ? (
        <View className='gathering-room-scene__celebration' role='status' aria-live='polite'>
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
            <Text className='gathering-room-scene__celebration-text'>{celebrationText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

export default GatheringRoomScene
