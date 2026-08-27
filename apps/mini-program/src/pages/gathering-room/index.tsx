import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ROOM_POKE_EMOJIS, type RoomPokeEmoji } from '@shared/wsEvents'
import type { PoolGroupMemberSummary } from '@shared/api'
import LoadingScreen from '../../components/loading/LoadingScreen'
import StatusCard from '../../components/ui/StatusCard'
import Button from '../../components/ui/Button'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import SegmentedCountdownClock from '../../components/ui/SegmentedCountdownClock'
import TablemateDetailSheet from '../../components/TablemateDetailSheet'
import GatheringRoomScene from '../../components/gathering-room/GatheringRoomScene'
import { haptics } from '../../lib/utils/haptics'
import { navigateBackOrEventsTab } from '../../lib/navigation/matchingNavigation'
import { formatMeetDayLabel, useGatheringRoomController } from './useGatheringRoomController'
import './index.scss'

/** Poke choice labels — text badges only, no emoji glyphs (guardrail). */
const POKE_CHOICE_LABELS: Record<RoomPokeEmoji, string> = {
  wave: '挥手',
  'hi-five': '击掌',
  drink: '干杯',
}

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

  // Live event countdown gives users a natural reason to check back. Warms up
  // on event day (「今天见」+ coral accent). Paused while the page is hidden
  // (WeChat keeps stacked pages alive). Past the event time we switch to the
  // soft terminal state so late confirms remain possible.
  const [countdown, setCountdown] = useState<{ today: boolean; started: boolean } | null>(null)
  const [clockNow, setClockNow] = useState<number | undefined>(undefined)
  useEffect(() => {
    const eventDateTime = controller.roomState?.eventDateTime
    if (!eventDateTime) {
      setCountdown(null)
      setClockNow(undefined)
      return
    }
    if (!controller.pageVisible) return
    const update = () => {
      const diff = new Date(eventDateTime).getTime() - Date.now()
      setClockNow(Date.now())
      if (diff <= 0) {
        setCountdown({ today: true, started: true })
        return
      }
      const days = Math.floor(diff / 86_400_000)
      setCountdown({ today: days === 0, started: false })
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

  return (
    <View className='gathering-room'>
      <View className='gathering-room__pill'>
        {countdown?.started ? (
          <Text className='gathering-room__pill-started'>现场见 · 活动进行中</Text>
        ) : (
          <>
            {countdown?.today ? (
              <Text className='gathering-room__pill-today'>今天见 ·{'\u00A0'}</Text>
            ) : null}
            <SegmentedCountdownClock
              target={roomState?.eventDateTime ?? null}
              enabled={!!countdown && !countdown.started}
              clockId='gathering-room-clock'
              externalNow={clockNow}
              showMinutes={false}
              showSeconds={false}
              showProgress={false}
            />
            <Text className='gathering-room__pill-divider'>·</Text>
            <Text>已到{'\u00A0'}</Text>
            <Text className={`gathering-room__header-count ${presentRollClass}`}>{presentCount}</Text>
            <Text>/{total}</Text>
            <Text className='gathering-room__pill-divider'>·</Text>
            <Text>已确认{'\u00A0'}</Text>
            <Text className={`gathering-room__header-count ${confirmedRollClass}`}>
              {roomState?.confirmedCount ?? 0}
            </Text>
            <Text>/{total}</Text>
          </>
        )}
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
            reducedMotion={controller.reducedMotion}
            pageVisible={controller.pageVisible}
            onAvatarTap={controller.handleAvatarTap}
          />
        )}
        {showHint ? (
          <View className='gathering-room__hint' role='status'>
            <Text className='gathering-room__hint-text'>名牌是留好的座位，伙伴到了就会过来入座</Text>
          </View>
        ) : null}
      </View>

      <View className='gathering-room__action-bar'>
        <Button
          className='gathering-room__confirm-btn'
          variant='primary'
          onClick={controller.handleConfirmAttendance}
          disabled={ownConfirmed || isSubmitting || confirmPending}
          loading={isSubmitting || confirmPending}
        >
          {ownConfirmed ? `座位已锁定 · ${formatMeetDayLabel(roomState?.eventDateTime)}` : isSubmitting || confirmPending ? '确认中…' : '确认出席 · 锁定座位'}
        </Button>
        {blindBoxEventId ? (
          <Text
            className='gathering-room__detail-link'
            onClick={() => {
              haptics('light')
              Taro.navigateTo({
                url: `/pages/event-detail/index?id=${encodeURIComponent(blindBoxEventId)}`,
              })
            }}
          >
            看看活动详情
          </Text>
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
                        {POKE_CHOICE_LABELS[emoji]}
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
