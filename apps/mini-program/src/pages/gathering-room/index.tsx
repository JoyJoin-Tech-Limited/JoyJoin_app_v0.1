import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ROOM_POKE_EMOJIS, type RoomPokeEmoji } from '@shared/wsEvents'
import type { PoolGroupMemberSummary } from '@shared/api'
import LoadingScreen from '../../components/loading/LoadingScreen'
import StatusCard from '../../components/ui/StatusCard'
import Button from '../../components/ui/Button'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import TablemateDetailSheet from '../../components/TablemateDetailSheet'
import GatheringRoomScene, {
  QUICK_POKE_LABELS,
  type GatheringRoomMemberProfile,
} from '../../components/gathering-room/GatheringRoomScene'
import { haptics } from '../../lib/utils/haptics'
import { navigateBackOrEventsTab } from '../../lib/navigation/matchingNavigation'
import { formatMeetDayLabel, useGatheringRoomController } from './useGatheringRoomController'
import './index.scss'

/** Restart the count-roll animation without remounting the Text (keyed
 *  remounts leave stale taro-text-core nodes behind on H5/WeChat). Toggling
 *  between two identical keyframes forces the animation to restart. */
function useCountRollClass(value: number): string {
  const [nonce, setNonce] = useState(0)
  const prevRef = useRef(value)
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value
      setNonce((n) => n + 1)
    }
  }, [value])
  return `gathering-room__header-count--roll-${nonce % 2}`
}

export default function GatheringRoomPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const controller = useGatheringRoomController({ groupId })

  // Hooks must run unconditionally above every early return below (rules of hooks).
  const {
    roomState,
    memberProfiles,
    presenceByUserId,
    selectedMember,
    presentCount,
    presentUserIds,
    ownConfirmed,
    isSubmitting,
    confirmPending,
    blindBoxEventId,
    currentUserId,
  } = controller
  const presentRollClass = useCountRollClass(presentCount)
  const confirmedRollClass = useCountRollClass(roomState?.confirmedCount ?? 0)

  // Live event countdown gives users a natural reason to check back. Hero
  // digits (天/时, or 时/分 on event day) replace the old segmented clock leaf
  // that cramped "02:03" with units underneath (2026-10-14 review). Warms up
  // on event day (「今天见」accent). Ticks every minute while visible.
  const [countdown, setCountdown] = useState<{
    today: boolean
    started: boolean
    days: number
    hours: number
    minutes: number
  } | null>(null)
  useEffect(() => {
    const eventDateTime = controller.roomState?.eventDateTime
    if (!eventDateTime) {
      setCountdown(null)
      return
    }
    if (!controller.pageVisible) return
    const update = () => {
      const diff = new Date(eventDateTime).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown({ today: true, started: true, days: 0, hours: 0, minutes: 0 })
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const minutes = Math.floor((diff % 3_600_000) / 60_000)
      setCountdown({ today: days === 0, started: false, days, hours, minutes })
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [controller.roomState?.eventDateTime, controller.pageVisible])

  // Scene-wrap mount fade: kills the hard white flash between the loading
  // screen and the rendered room. Static when reduced motion is enabled.
  const [sceneMounted, setSceneMounted] = useState(false)
  useEffect(() => {
    if (controller.reducedMotion) {
      setSceneMounted(true)
      return
    }
    const id = setTimeout(() => setSceneMounted(true), 50)
    return () => clearTimeout(id)
  }, [controller.reducedMotion])

  // First-visit hint: teaches the door-queue / held-seat metaphor once, then
  // never again (session-less storage flag).
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (!controller.roomState || controller.isLoading) return
    try {
      if (Taro.getStorageSync('gathering-room-hint-shown')) return
      Taro.setStorageSync('gathering-room-hint-shown', '1')
    } catch {
      return
    }
    setShowHint(true)
    const id = setTimeout(() => setShowHint(false), 2500)
    return () => clearTimeout(id)
  }, [controller.roomState, controller.isLoading])

  // Quick-poke bubble: tapping a PRESENT tablemate's avatar opens the
  // one-tap 挥手/击掌/干杯 bubble anchored at their seat (the detail sheet
  // used to be the only poke path — two taps deep). Self / absent members
  // keep the sheet. Auto-dismisses; tapping empty room also dismisses.
  const [quickPokeUserId, setQuickPokeUserId] = useState<string | null>(null)
  useEffect(() => {
    if (!quickPokeUserId) return
    const id = setTimeout(() => setQuickPokeUserId(null), 4200)
    return () => clearTimeout(id)
  }, [quickPokeUserId])

  const quickPokeMember = useMemo(
    () => memberProfiles.find((profile) => profile.userId === quickPokeUserId) ?? null,
    [memberProfiles, quickPokeUserId],
  )

  const handleSeatTap = (member: GatheringRoomMemberProfile) => {
    const presence = presenceByUserId.get(member.userId) ?? 'absent'
    if (member.userId !== currentUserId && presence === 'present') {
      haptics('light')
      setQuickPokeUserId((current) => (current === member.userId ? null : member.userId))
      return
    }
    setQuickPokeUserId(null)
    controller.handleAvatarTap(member)
  }

  const handleQuickPoke = (userId: string, emoji: RoomPokeEmoji) => {
    setQuickPokeUserId(null)
    controller.handlePoke(userId, emoji)
  }

  const handleQuickPokeProfile = (member: GatheringRoomMemberProfile) => {
    setQuickPokeUserId(null)
    controller.handleAvatarTap(member)
  }

  if (controller.authLoading) {
    return <LoadingScreen message='正在推开集结房间的门…' />
  }

  // Kill switch off: friendly surface, never a crash.
  if (!controller.gatheringRoomEnabled) {
    return (
      <View className='gathering-room__status'>
        <StatusCard
          tone='info'
          title='集结房间还没开门'
          description='悦仔正在布置房间，晚一点再来看看吧'
          action={{ label: '返回', onClick: navigateBackOrEventsTab, variant: 'secondary' }}
        />
      </View>
    )
  }

  if (controller.isLoading) {
    return <LoadingScreen message='正在推开集结房间的门…' />
  }

  if (controller.error || !controller.roomState) {
    return (
      <View className='gathering-room__status'>
        <StatusCard
          tone='error'
          title='房间加载没成功'
          description='可能是网络晃了一下，再试一次看看吧'
          action={{ label: '重试', onClick: controller.retry }}
          footer={(
            <Button variant='secondary' onClick={navigateBackOrEventsTab}>
              返回
            </Button>
          )}
        />
      </View>
    )
  }

  const total = roomState?.totalParticipants || memberProfiles.length
  const absentCount = memberProfiles.filter(
    (profile) => (presenceByUserId.get(profile.userId) ?? 'absent') === 'absent',
  ).length
  const remainingToConfirm = Math.max(
    (roomState?.totalParticipants ?? 0) - (roomState?.confirmedCount ?? 0),
    0,
  )
  // Restart the ticker animation on each new line without keyed remounts
  // (keyed Text remounts leak stale nodes on H5/WeChat — see useCountRollClass).
  const activityRollClass = controller.activityLine
    ? `gathering-room__activity--roll-${controller.activityLine.ts % 2}`
    : ''

  return (
    <View className='gathering-room'>
      <View className='gathering-room__status-stack'>
        {countdown ? (
          <View className='gathering-room__countdown-chip'>
            {countdown.started ? (
              <Text className='gathering-room__countdown-live'>现场见 · 活动进行中</Text>
            ) : (
              <>
                {countdown.today ? (
                  <>
                    <Text className='gathering-room__countdown-today'>今天见</Text>
                    <Text className='gathering-room__countdown-sep'>·</Text>
                  </>
                ) : null}
                {countdown.days > 0 ? (
                  <>
                    <Text className='gathering-room__countdown-num'>{countdown.days}</Text>
                    <Text className='gathering-room__countdown-unit'>天</Text>
                  </>
                ) : null}
                <Text className='gathering-room__countdown-num'>{countdown.hours}</Text>
                <Text className='gathering-room__countdown-unit'>时</Text>
                {countdown.days === 0 ? (
                  <>
                    <Text className='gathering-room__countdown-num'>{countdown.minutes}</Text>
                    <Text className='gathering-room__countdown-unit'>分</Text>
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : null}
        <View className='gathering-room__arrive-chip'>
          <Text className='gathering-room__arrive-label'>已到</Text>
          <Text className={`gathering-room__header-count ${presentRollClass}`}>{presentCount}</Text>
          <Text className='gathering-room__arrive-total'>/{total}</Text>
          <View className='gathering-room__arrive-dots' aria-hidden='true'>
            {memberProfiles.map((profile) => {
              const presence = presenceByUserId.get(profile.userId) ?? 'absent'
              return (
                <View
                  key={profile.userId}
                  className={`gathering-room__arrive-dot gathering-room__arrive-dot--${presence}`}
                />
              )
            })}
          </View>
          <Text className='gathering-room__arrive-label'>已确认</Text>
          <Text className={`gathering-room__header-count ${confirmedRollClass}`}>
            {roomState?.confirmedCount ?? 0}
          </Text>
          <Text className='gathering-room__arrive-total'>/{total}</Text>
        </View>
        {absentCount > 0 ? (
          <Text className='gathering-room__way-caption'>
            {`${absentCount} 位桌友正在路上，到了会走过来 · ${formatMeetDayLabel(roomState?.eventDateTime)}`}
          </Text>
        ) : null}
        {controller.activityLine ? (
          <View className={`gathering-room__activity ${activityRollClass}`} role='status'>
            <Text className='gathering-room__activity-text'>{controller.activityLine.text}</Text>
          </View>
        ) : null}
      </View>

      <View
        className='gathering-room__scene-wrap'
        style={{
          opacity: sceneMounted ? 1 : 0,
          transition: controller.reducedMotion ? undefined : 'opacity 240ms ease-out',
        }}
      >
        {memberProfiles.length === 0 ? (
          <View className='gathering-room__scene-empty' role='status'>
            <XiaoyueEmptyState
              emotion='waiting'
              title='同桌还在路上'
              subtitle='排桌完成后，这桌的伙伴会陆续出现'
            />
          </View>
        ) : (
          <GatheringRoomScene
            memberProfiles={memberProfiles}
            presenceByUserId={presenceByUserId}
            ownUserId={controller.currentUserId}
            enteringUserIds={controller.enteringUserIds}
            playOwnDoorEntry={controller.playOwnDoorEntry}
            pokeBadge={controller.pokeBadge}
            firstArriverText={controller.firstArriverText}
            celebrationText={controller.celebrationText}
            quickPokeMember={quickPokeMember}
            onQuickPoke={handleQuickPoke}
            onQuickPokeProfile={handleQuickPokeProfile}
            onDismissQuickPoke={() => setQuickPokeUserId(null)}
            reducedMotion={controller.reducedMotion}
            pageVisible={controller.pageVisible}
            onAvatarTap={handleSeatTap}
          />
        )}
        {showHint ? (
          <View className='gathering-room__hint' role='status'>
            <Text className='gathering-room__hint-text'>名牌是留好的座位，点伙伴的头像可以打个招呼</Text>
          </View>
        ) : null}
      </View>

      <View className='gathering-room__action-bar'>
        {ownConfirmed ? (
          <View className='gathering-room__success-card'>
            <View className='gathering-room__success-glow' aria-hidden='true' />
            <View className='gathering-room__success-seal' aria-hidden='true'>
              <View className='gathering-room__success-seal-check' />
            </View>
            <View className='gathering-room__success-copy'>
              <Text className='gathering-room__success-title'>
                {`座位已锁定 · ${formatMeetDayLabel(roomState?.eventDateTime)}`}
              </Text>
              <Text className='gathering-room__success-sub'>
                {remainingToConfirm > 0
                  ? `还差 ${remainingToConfirm} 位桌友确认，到齐一起庆祝`
                  : '这桌全员到齐，现场见～'}
              </Text>
            </View>
          </View>
        ) : (
          <Button
            className='gathering-room__confirm-btn'
            variant='primary'
            onClick={controller.handleConfirmAttendance}
            disabled={isSubmitting || confirmPending}
            loading={isSubmitting || confirmPending}
          >
            {isSubmitting || confirmPending ? '确认中…' : '确认出席 · 锁定座位'}
          </Button>
        )}
        {blindBoxEventId ? (
          <Button
            className='gathering-room__detail-btn'
            variant='secondary'
            onClick={() => {
              haptics('light')
              Taro.navigateTo({
                url: `/pages/event-detail/index?id=${encodeURIComponent(blindBoxEventId)}`,
              })
            }}
          >
            看看活动详情
          </Button>
        ) : null}
      </View>

      {selectedMember ? (
        <TablemateDetailSheet
          visible={!!selectedMember}
          member={selectedMember as PoolGroupMemberSummary}
          isCurrentUser={selectedMember.userId === currentUserId}
          reduceMotion={controller.reducedMotion}
          onClose={controller.closeSheet}
          actionSlot={
            selectedMember.userId !== currentUserId && presentUserIds.has(selectedMember.userId) ? (
              <View className='gathering-room__poke'>
                <Text className='gathering-room__poke-title'>打个招呼</Text>
                <View className='gathering-room__poke-row'>
                  {ROOM_POKE_EMOJIS.map((emoji) => (
                    <View
                      key={emoji}
                      className='gathering-room__poke-btn'
                      hoverClass='gathering-room__poke-btn--pressed'
                      onClick={() => controller.handlePoke(selectedMember.userId, emoji)}
                    >
                      <Text className='gathering-room__poke-btn-text'>
                        {QUICK_POKE_LABELS[emoji]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : undefined
          }
        />
      ) : null}
    </View>
  )
}
