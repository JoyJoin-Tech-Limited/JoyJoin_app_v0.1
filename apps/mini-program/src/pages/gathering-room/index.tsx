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
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'
import {
  navigateBackOrEventsTab,
  openPoolGroupDetail,
} from '../../lib/navigation/matchingNavigation'
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

/** Preparation-card date line: "10月30日 周五 19:00". */
function formatArrivalTime(iso: string | null | undefined): string {
  if (!iso) return '活动时间待定'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '活动时间待定'
  const weekday = formatMeetDayLabel(iso).replace('见', '')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday} ${hh}:${mm}`
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
    confirmedCount,
    arrivingLateCount,
    presentUserIds,
    ownConfirmed,
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
  const presentRollClass = useCountRollClass(presentCount)
  const confirmedRollClass = useCountRollClass(confirmedCount)

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
  const members = roomState?.members ?? []
  const pendingCount = members.filter((member) => member.attendanceStatus === 'pending').length
  const explicitlyAbsentCount = members.filter((member) => member.attendanceStatus === 'absent').length
  const confirmedOfflineCount = members.filter(
    (member) =>
      (member.attendanceStatus === 'confirmed' || member.attendanceStatus === 'late') &&
      !presentUserIds.has(member.userId),
  ).length
  const remainingToConfirm = Math.max(total - confirmedCount, 0)
  const wayCaptionParts: string[] = []
  if (arrivingLateCount > 0) wayCaptionParts.push(`${arrivingLateCount} 位已确认会晚到`)
  if (explicitlyAbsentCount > 0) wayCaptionParts.push(`${explicitlyAbsentCount} 位已告知无法出席`)
  if (pendingCount > 0) wayCaptionParts.push(`${pendingCount} 位还没确认`)
  if (wayCaptionParts.length === 0 && confirmedOfflineCount > 0) {
    wayCaptionParts.push(`${confirmedOfflineCount} 位已确认，座位已留`)
  }
  const wayCaption = wayCaptionParts.join(' · ')
  const venueReady =
    venue?.status === 'assigned' || venue?.status === 'manual_override'
  const venueName = venueReady ? venue?.name?.trim() : ''
  const venueAddress = venueReady ? venue?.address?.trim() : ''
  const ownIsLate = ownAttendanceStatus === 'late'
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
            {eventPhase === 'ended' ? (
              <Text className='gathering-room__countdown-live'>活动已结束 · 回看这一桌</Text>
            ) : countdown.started ? (
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
                  <View className='gathering-room__countdown-pair'>
                    <Text className='gathering-room__countdown-num'>{countdown.days}</Text>
                    <Text className='gathering-room__countdown-unit'>天</Text>
                  </View>
                ) : null}
                <View className='gathering-room__countdown-pair'>
                  <Text className='gathering-room__countdown-num'>{countdown.hours}</Text>
                  <Text className='gathering-room__countdown-unit'>时</Text>
                </View>
                {countdown.days === 0 ? (
                  <View className='gathering-room__countdown-pair'>
                    <Text className='gathering-room__countdown-num'>{countdown.minutes}</Text>
                    <Text className='gathering-room__countdown-unit'>分</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
        <View className='gathering-room__arrive-chip'>
          <Text className='gathering-room__arrive-label'>在房间</Text>
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
            {confirmedCount}
          </Text>
          <Text className='gathering-room__arrive-total'>/{total}</Text>
        </View>
        {wayCaption ? (
          <Text className='gathering-room__way-caption'>
            {`${wayCaption} · ${formatMeetDayLabel(roomState?.eventDateTime)}`}
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
            layout={sceneLayout}
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
        {showHint && (sceneLayout?.scale ?? 1) >= 0.9 ? (
          <View className='gathering-room__hint' role='status'>
            <Text className='gathering-room__hint-text'>名牌是留好的座位，点伙伴的头像可以打个招呼</Text>
          </View>
        ) : null}
      </View>

      <View className='gathering-room__action-bar'>
        {eventPhase === 'ended' ? (
          <Button
            className='gathering-room__memory-btn'
            variant='secondary'
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
        {ownConfirmed ? (
          <View className='gathering-room__success-card'>
            <View className='gathering-room__success-glow' aria-hidden='true' />
            <View className='gathering-room__success-seal' aria-hidden='true'>
              <View className='gathering-room__success-seal-check' />
            </View>
            <View className='gathering-room__success-copy'>
              <Text className='gathering-room__success-title'>
                {`已确认出席 · ${formatMeetDayLabel(roomState?.eventDateTime)}`}
              </Text>
              <View className='gathering-room__arrival-prep'>
                <Text className='gathering-room__arrival-time'>
                  {formatArrivalTime(roomState?.eventDateTime)}
                </Text>
                <Text className='gathering-room__arrival-venue'>
                  {venueReady ? (venueName || '地点已确认') : '地点待定'}
                </Text>
                <Text className='gathering-room__arrival-address'>
                  {venueReady ? (venueAddress || '具体地址确认后同步') : '地点确认后会在这里显示'}
                </Text>
                <Text className='gathering-room__arrival-route'>
                  {venueAddress
                    ? '路线：点下方「看看活动详情」查看地址与导航'
                    : '路线：地点确定后可在活动详情里查看导航'}
                </Text>
              </View>
              <Text className='gathering-room__success-sub'>
                {remainingToConfirm > 0
                  ? `还差 ${remainingToConfirm} 位桌友确认`
                  : '全员确认，现场见～'}
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
            {isSubmitting || confirmPending ? '确认中…' : '确认出席'}
          </Button>
        )}
        {canReportLate ? (
          <View
            className={
              ownIsLate
                ? 'gathering-room__late-link gathering-room__late-link--done'
                : 'gathering-room__late-link'
            }
            role='button'
            aria-label={ownIsLate ? '已登记会晚到' : '告诉大家你会晚到'}
            onClick={ownIsLate || isReportingLate ? undefined : handleReportLate}
          >
            <Text className='gathering-room__late-link-text'>
              {isReportingLate
                ? '正在登记…'
                : ownIsLate
                  ? '已登记会晚到'
                  : '会晚到？提前告诉大家'}
            </Text>
          </View>
        ) : null}
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
