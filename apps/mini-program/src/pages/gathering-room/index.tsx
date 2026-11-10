import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ROOM_POKE_EMOJIS, type RoomPokeEmoji } from '@shared/wsEvents'
import type { PoolGroupMemberSummary } from '@shared/api'
import LoadingScreen from '../../components/loading/LoadingScreen'
import StatusCard from '../../components/ui/StatusCard'
import Button from '../../components/ui/Button'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import TablemateDetailSheet from '../../components/TablemateDetailSheet'
import GatheringRoomScene, {
  QUICK_POKE_LABELS,
  type GatheringRoomMemberProfile,
} from '../../components/gathering-room/GatheringRoomScene'
import { haptics } from '../../lib/utils/haptics'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'
import { formatEventFactDateTime } from '../../lib/utils/eventDisplay'
import { resolveGatheringRoomMemberState } from './gatheringRoomPresence'
import {
  navigateBackOrEventsTab,
  openPoolGroupDetail,
} from '../../lib/navigation/matchingNavigation'
import { useGatheringRoomController } from './useGatheringRoomController'
import './index.scss'

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
    confirmedCount,
    arrivingLateCount,
    presentUserIds,
    ownConfirmed,
    wsConnected,
    ownAttendanceStatus,
    isSubmitting,
    isReportingLate,
    confirmPending,
    canReportLate,
    handleReportLate,
    blindBoxEventId,
    currentUserId,
    viewerPairByMemberId,
    venue,
    eventPhase,
  } = controller
  // Full-body pixel look for the tablemate sheet. The room already receives
  // the same equipment payload the seat avatars render, so the sheet can show
  // the exact look the group sees without another request.
  const selectedPixelAvatar = useMemo(() => {
    if (!selectedMember?.archetype || !selectedMember.outfit) return null
    const itemsById = new Map(
      (selectedMember.equippedItems ?? []).map((item) => [item.id, item] as const),
    )
    return {
      archetype: selectedMember.archetype,
      outfit: selectedMember.outfit,
      itemsById,
    }
  }, [selectedMember])

  const selectedMemberState = useMemo(() => selectedMember
    ? resolveGatheringRoomMemberState({
        attendanceStatus: selectedMember.attendanceStatus ?? 'pending',
        isPresent: presentUserIds.has(selectedMember.userId),
        wsConnected,
        eventPhase,
      })
    : null, [selectedMember, presentUserIds, wsConnected, eventPhase])

  // Absolute event time stays primary; this relative countdown is auxiliary.
  // Invalid or missing dates never produce a fake "0天0小时" countdown.
  const eventTimeMs = controller.roomState?.eventDateTime
    ? new Date(controller.roomState.eventDateTime).getTime()
    : Number.NaN
  const hasValidEventTime = Number.isFinite(eventTimeMs)
  const [countdown, setCountdown] = useState<{
    today: boolean
    started: boolean
    days: number
    hours: number
    minutes: number
  } | null>(null)
  useEffect(() => {
    if (!hasValidEventTime) {
      setCountdown(null)
      return
    }
    if (!controller.pageVisible) return
    const update = () => {
      const diff = eventTimeMs - Date.now()
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
  }, [eventTimeMs, hasValidEventTime, controller.pageVisible])

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

  // Keep the 750×960 room coordinate system intact on short screens. Scaling
  // the whole scene preserves art, seats, name cards and motion together;
  // clamping only its height used to stretch the art and collide with the
  // absolutely-positioned header. The scene stays hidden for the first measure
  // so a short device never flashes a clipped, unscaled room.
  const [sceneLayout, setSceneLayout] = useState<{
    width: number
    height: number
    scale: number
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      Taro.nextTick(() => {
        if (cancelled) return
        Taro.createSelectorQuery()
          .select('.gathering-room__scene-wrap')
          .boundingClientRect()
          .exec((result) => {
            const rect = result?.[0] as { width?: number; height?: number } | null | undefined
            if (cancelled || !rect?.width || !rect.height) return
            const width = getWindowInfoCompat().windowWidth || rect.width
            const height = width * (960 / 750)
            const scale = Math.min(1, rect.width / width, rect.height / height)
            setSceneLayout({ width, height, scale })
          })
      })
    }
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(measure, 100)
    }
    measure()
    if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
    }
    return () => {
      cancelled = true
      if (resizeTimer) clearTimeout(resizeTimer)
      if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [
    controller.authLoading,
    controller.error,
    controller.gatheringRoomEnabled,
    controller.isLoading,
    controller.roomState?.groupId,
    ownConfirmed,
  ])

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

  // Member-first interaction: a normal avatar tap always opens the detail
  // sheet. Quick-poke is a secondary long-press action on present tablemates;
  // the sheet also keeps direct emoji actions. Auto-dismisses on room tap.
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
    setQuickPokeUserId(null)
    controller.handleAvatarTap(member)
  }

  const handleSeatLongPress = (member: GatheringRoomMemberProfile) => {
    const memberState = resolveGatheringRoomMemberState({
      attendanceStatus: member.attendanceStatus ?? 'pending',
      isPresent: presentUserIds.has(member.userId),
      wsConnected,
      eventPhase,
    })
    if (member.userId === currentUserId || !memberState.canPoke) return
    haptics('light')
    setQuickPokeUserId((current) => (current === member.userId ? null : member.userId))
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
  const members = roomState?.members ?? []
  const pendingCount = members.filter((member) => member.attendanceStatus === 'pending').length
  const explicitlyAbsentCount = members.filter((member) => member.attendanceStatus === 'absent').length
  const groupExceptionParts: string[] = []
  if (arrivingLateCount > 0) groupExceptionParts.push(`${arrivingLateCount} 位会晚到`)
  if (pendingCount > 0) groupExceptionParts.push(`${pendingCount} 位待确认`)
  if (explicitlyAbsentCount > 0) groupExceptionParts.push(`${explicitlyAbsentCount} 位无法出席`)
  const groupExceptionText = groupExceptionParts.join(' · ')
  const venueReady = venue?.status === 'assigned' || venue?.status === 'manual_override'
  const venueName = venueReady ? venue?.name?.trim() : ''
  const venueAddress = venueReady ? venue?.address?.trim() : ''
  const eventDateTimeLabel = formatEventFactDateTime(roomState?.eventDateTime)
  const countdownLabel = !countdown || eventPhase === 'ended'
    ? ''
    : countdown.started
      ? '活动进行中'
      : countdown.days > 0
        ? `还有 ${countdown.days} 天 ${countdown.hours} 小时`
        : countdown.hours > 0
          ? `还有 ${countdown.hours} 小时 ${countdown.minutes} 分钟`
          : `还有 ${countdown.minutes} 分钟`
  const ownStatusLabel = ownAttendanceStatus === 'confirmed'
    ? '已确认出席'
    : ownAttendanceStatus === 'late'
      ? '已登记会晚到'
      : ownAttendanceStatus === 'absent'
        ? '已告知无法出席'
        : eventPhase === 'ended'
          ? '未确认出席'
          : '待确认'
  const ownIsLate = ownAttendanceStatus === 'late'
  const lateAvailabilityText = ownConfirmed && !ownIsLate && !canReportLate && eventPhase === 'upcoming'
    ? blindBoxEventId
      ? '晚到登记将在活动前 2 小时开放'
      : '活动信息同步后可登记晚到'
    : ''
  const handleCopyVenueAddress = () => {
    if (!venueAddress) return
    haptics('light')
    const copyText = venueName ? `${venueName}\n${venueAddress}` : venueAddress
    void Taro.setClipboardData({ data: copyText })
      .then(() => Taro.showToast({ title: '地址已复制，去地图粘贴搜索', icon: 'none' }))
      .catch(() => Taro.showToast({ title: '复制失败，请稍后再试', icon: 'none' }))
  }

  return (
    <View className='gathering-room'>
      <View className='gathering-room__status-stack'>
        <View className='gathering-room__room-summary' role='status' aria-live='polite'>
          <View className='gathering-room__room-summary-main'>
            <Text className='gathering-room__room-summary-title'>
              {eventPhase === 'ended'
                ? '活动已结束 · 这一桌已定格'
                : `这桌已确认 ${confirmedCount}/${total}`}
            </Text>
            {eventPhase !== 'ended' ? (
              <Text className='gathering-room__room-summary-online'>
                {wsConnected ? `${presentCount} 人在房间` : '房间连接已断开'}
              </Text>
            ) : null}
          </View>
          {eventPhase !== 'ended' && groupExceptionText ? (
            <Text className='gathering-room__room-summary-exceptions'>{groupExceptionText}</Text>
          ) : null}
          {eventPhase !== 'ended' && !wsConnected ? (
            <Text className='gathering-room__room-summary-connection'>
              出席信息仍可查看，实时状态恢复后更新
            </Text>
          ) : null}
        </View>
        {controller.activityLine && wsConnected && eventPhase !== 'ended' ? (
          <View className='gathering-room__room-activity' role='status'>
            <Text className='gathering-room__room-activity-text'>{controller.activityLine.text}</Text>
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
            layout={sceneLayout}
            ownUserId={controller.currentUserId}
            enteringUserIds={controller.enteringUserIds}
            playOwnDoorEntry={controller.playOwnDoorEntry}
            pokeBadge={controller.pokeBadge}
            firstArriverText={controller.firstArriverText}
            celebrationText={controller.celebrationText}
            celebrationStatic={controller.celebrationStatic}
            presentUserIds={presentUserIds}
            wsConnected={controller.wsConnected}
            eventPhase={eventPhase}
            ownConfirmationPulse={controller.ownConfirmationPulse}
            quickPokeMember={quickPokeMember}
            onQuickPoke={handleQuickPoke}
            onQuickPokeProfile={handleQuickPokeProfile}
            onDismissQuickPoke={() => setQuickPokeUserId(null)}
            reducedMotion={controller.reducedMotion}
            pageVisible={controller.pageVisible}
            onAvatarTap={handleSeatTap}
            onAvatarLongPress={handleSeatLongPress}
          />
        )}
        {showHint && (sceneLayout?.scale ?? 1) >= 0.9 ? (
          <View className='gathering-room__hint' role='status'>
            <Text className='gathering-room__hint-text'>点头像认识桌友，详情里可以打招呼</Text>
          </View>
        ) : null}
      </View>

      <View className='gathering-room__action-bar'>
        {eventPhase === 'ended' ? (
          <Button
            className='gathering-room__memory-btn'
            variant='primary'
            onClick={() => {
              haptics('light')
              void Taro.navigateTo({
                url: `/pages/gathering-room/memory/index?groupId=${groupId}`,
              })
            }}
          >
            回看这一桌
          </Button>
        ) : null}
        <View className='gathering-room__appointment-status' role='status' aria-live='polite'>
            <Text className='gathering-room__fact-label'>我的出席</Text>
            <View className='gathering-room__appointment-status-value'>
              <JoyJoinIcon emoji='✅' size={24} />
              <Text>{ownStatusLabel}</Text>
            </View>
          </View>

        <View className='gathering-room__facts-grid'>
          <View className='gathering-room__fact-module'>
            <View className='gathering-room__fact-label-row'>
              <JoyJoinIcon emoji='📅' size={24} />
              <Text className='gathering-room__fact-label'>时间</Text>
            </View>
            <Text className='gathering-room__fact-time'>{eventDateTimeLabel}</Text>
            {eventPhase !== 'ended' ? (
              <Text className='gathering-room__fact-meta'>
                {hasValidEventTime ? countdownLabel : '时间确定后在这里更新'}
              </Text>
            ) : null}
            {canReportLate && ownConfirmed ? (
              <View
                className={ownIsLate
                  ? 'gathering-room__fact-action gathering-room__fact-action--done'
                  : 'gathering-room__fact-action'}
                role='button'
                aria-label={ownIsLate ? '已登记会晚到' : '会晚到？提前告诉大家'}
                onClick={ownIsLate || isReportingLate ? undefined : handleReportLate}
              >
                <Text>{isReportingLate ? '正在登记…' : ownIsLate ? '已登记会晚到' : '会晚到？提前告诉大家'}</Text>
              </View>
            ) : lateAvailabilityText && ownConfirmed ? (
              <Text className='gathering-room__fact-meta'>{lateAvailabilityText}</Text>
            ) : null}
          </View>

          <View className='gathering-room__fact-module'>
            <View className='gathering-room__fact-label-row'>
              <JoyJoinIcon emoji='📍' size={24} />
              <Text className='gathering-room__fact-label'>地点</Text>
            </View>
            <Text
              className={`gathering-room__fact-venue${venueReady && venueName ? '' : ' gathering-room__fact-venue--tbd'}`}
            >
              {venueReady && venueName ? venueName : '场地安排中'}
            </Text>
            {/* An ended event can no longer resolve its venue, so the promise
                has to stop pretending it might. Before the event, the venue is
                a promise with a deadline: 活动前一天一定告诉你，定不下来就退款。 */}
            <Text className='gathering-room__fact-address'>
              {venueAddress
                || (venueReady && venueName ? '' : eventPhase === 'ended' ? '地点未公布' : '活动前一天会告诉你具体地点')}
            </Text>
          </View>
        </View>

        {ownAttendanceStatus === 'pending' && eventPhase !== 'ended' ? (
          <Button
            className='gathering-room__confirm-btn'
            variant='primary'
            onClick={controller.handleConfirmAttendance}
            disabled={isSubmitting || confirmPending}
            loading={isSubmitting || confirmPending}
          >
            {isSubmitting || confirmPending ? '确认中…' : '确认出席'}
          </Button>
        ) : null}

        {/* A commitment you cannot take back is a trap (D-I1B, 2026-11-11): the
            RSVP stays reversible until the event starts, so the primary slot
            never empties on the user who just tapped it. */}
        {controller.canReleaseAttendance ? (
          <Button
            className='gathering-room__release-btn'
            onClick={controller.handleReleaseAttendance}
            disabled={isSubmitting || controller.releasePending}
            loading={isSubmitting || controller.releasePending}
          >
            {controller.releasePending ? '取消中…' : '改主意，先不确认'}
          </Button>
        ) : null}

        {controller.confirmError ? (
          <View className='gathering-room__confirm-error' role='alert'>
            <Text>{controller.confirmError}</Text>
          </View>
        ) : null}

        <View className='gathering-room__appointment-actions'>
          {eventPhase !== 'ended' && venueAddress ? (
            <View
              className='gathering-room__tertiary-action'
              role='button'
              aria-label={`复制${venueName || '活动地点'}地址`}
              onClick={handleCopyVenueAddress}
            >
              <JoyJoinIcon emoji='🗺️' size={24} />
              <Text>复制地址</Text>
            </View>
          ) : null}
          {blindBoxEventId || roomState?.poolId ? (
            <View
              className='gathering-room__tertiary-action'
              role='button'
              aria-label='查看活动详情'
              onClick={() => {
                haptics('light')
                void Taro.navigateTo({
                  url: `/pages/event-detail/index?id=${encodeURIComponent(roomState?.poolId ?? blindBoxEventId!)}`,
                })
              }}
            >
              <JoyJoinIcon emoji='📅' size={24} />
              <Text>查看活动详情</Text>
            </View>
          ) : null}
        </View>
      </View>


      {selectedMember ? (
        <TablemateDetailSheet
          visible={!!selectedMember}
          member={selectedMember as PoolGroupMemberSummary}
          viewerPair={viewerPairByMemberId.get(selectedMember.userId) ?? null}
          pixelAvatar={selectedPixelAvatar}
          isCurrentUser={selectedMember.userId === currentUserId}
          reduceMotion={controller.reducedMotion}
          onClose={controller.closeSheet}
          onOpenMyImage={() => {
            haptics('light')
            void Taro.navigateTo({ url: '/pages/profile-linked/my-image/index' })
          }}
          onViewAllMembers={() => openPoolGroupDetail(groupId)}
          actionSlot={
            selectedMember.userId !== currentUserId && selectedMemberState?.canPoke ? (
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
