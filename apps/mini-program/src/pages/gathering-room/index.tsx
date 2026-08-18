import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { ROOM_POKE_EMOJIS, type RoomPokeEmoji } from '@shared/wsEvents'
import type { EquipmentOutfitView } from '@joyjoin/shared/schema'
import LoadingScreen from '../../components/loading/LoadingScreen'
import StatusCard from '../../components/ui/StatusCard'
import Button from '../../components/ui/Button'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import PixelAvatarComposite from '../../components/profile/PixelAvatarComposite'
import GatheringRoomScene from '../../components/gathering-room/GatheringRoomScene'
import { navigateBackOrEventsTab } from '../../lib/navigation/matchingNavigation'
import { formatMeetDayLabel, useGatheringRoomController } from './useGatheringRoomController'
import './index.scss'

/** Poke choice labels — text badges only, no emoji glyphs (guardrail). */
const POKE_CHOICE_LABELS: Record<RoomPokeEmoji, string> = {
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
  } = controller
  const selectedMemberItems = useMemo(
    () => new Map((controller.selectedMember?.equippedItems ?? []).map((item) => [item.id, item])),
    [controller.selectedMember?.equippedItems],
  )
  const presentRollClass = useCountRollClass(presentCount)
  const confirmedRollClass = useCountRollClass(roomState?.confirmedCount ?? 0)

  // Live event countdown gives users a natural reason to check back. Warms up
  // on event day (「今天见」+ coral accent). Paused while the page is hidden
  // (WeChat keeps stacked pages alive).
  const [countdown, setCountdown] = useState<{ text: string; today: boolean } | null>(null)
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
        setCountdown({ text: '活动即将开始', today: true })
        return
      }
      const minutes = Math.floor(diff / 60_000)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      if (days > 0) {
        setCountdown({ text: `还有 ${days} 天`, today: false })
      } else if (hours > 0) {
        setCountdown({ text: `今天见 · 还有 ${hours} 小时`, today: true })
      } else if (minutes >= 1) {
        setCountdown({ text: `今天见 · 还有 ${minutes} 分钟`, today: true })
      } else {
        setCountdown({ text: '还有不到 1 分钟', today: true })
      }
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [controller.roomState?.eventDateTime, controller.pageVisible])

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
      <View className='gathering-room__header'>
        <View className='gathering-room__header-subtitle'>
          {/* Sibling Texts, not nested — Taro flattens nested Text children
              and the counts would merge into one garbled number. No keyed
              remounts either: animation-name parity restarts the roll. */}
          {countdown ? (
            <Text className={countdown.today ? 'gathering-room__header-today' : undefined}>
              {countdown.text} ·{'\u00A0'}
            </Text>
          ) : null}
          <Text>已到{'\u00A0'}</Text>
          <Text className={`gathering-room__header-count ${presentRollClass}`}>{presentCount}</Text>
          <Text>/{total} 人 · 已确认{'\u00A0'}</Text>
          <Text className={`gathering-room__header-count ${confirmedRollClass}`}>
            {roomState?.confirmedCount ?? 0}
          </Text>
          <Text>/{total}</Text>
        </View>
      </View>

      <View className='gathering-room__scene-wrap'>
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
      </View>

      {selectedMember ? (
        <View className='gathering-room__sheet-mask' onClick={controller.closeSheet}>
          <View
            className='gathering-room__sheet'
            onClick={(event) => event.stopPropagation()}
          >
            <View className='gathering-room__sheet-grabber' aria-hidden='true' />
            <View className='gathering-room__sheet-header'>
              <PixelAvatarComposite
                archetypeId={selectedMember.archetype ?? 'corgi'}
                outfit={selectedMember.outfit ?? EMPTY_OUTFIT}
                itemsById={selectedMemberItems}
                variant='full'
                className='gathering-room__sheet-avatar'
              />
              <View className='gathering-room__sheet-identity'>
                <Text className='gathering-room__sheet-name'>
                  {selectedMember.displayName || '队友'}
                </Text>
                {selectedMember.archetype ? (
                  <Text className='gathering-room__sheet-archetype'>
                    {ARCHETYPE_BY_ID[selectedMember.archetype]?.nameCn || selectedMember.archetype}
                  </Text>
                ) : null}
                {selectedMember.ageVisible && selectedMember.ageLabel ? (
                  <Text className='gathering-room__sheet-meta'>{selectedMember.ageLabel}</Text>
                ) : null}
                {selectedMember.industryVisible && selectedMember.industryNicheLabel ? (
                  <Text className='gathering-room__sheet-meta'>{selectedMember.industryNicheLabel}</Text>
                ) : null}
              </View>
            </View>

            {(selectedMember.topInterests ?? []).length > 0 ? (
              <View className='gathering-room__sheet-tags'>
                {(selectedMember.topInterests ?? []).slice(0, 3).map((interest) => (
                  <Text key={interest} className='gathering-room__sheet-tag'>
                    {interest}
                  </Text>
                ))}
              </View>
            ) : null}

            {selectedMember.userId !== controller.currentUserId && presentUserIds.has(selectedMember.userId) ? (
              <View className='gathering-room__sheet-poke'>
                <Text className='gathering-room__sheet-poke-title'>打个招呼</Text>
                <View className='gathering-room__sheet-poke-row'>
                  {ROOM_POKE_EMOJIS.map((emoji) => (
                    <View
                      key={emoji}
                      className='gathering-room__sheet-poke-btn'
                      hoverClass='gathering-room__sheet-poke-btn--pressed'
                      onClick={() => controller.handlePoke(selectedMember.userId, emoji)}
                    >
                      <Text className='gathering-room__sheet-poke-btn-text'>
                        {POKE_CHOICE_LABELS[emoji]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Button variant='secondary' onClick={controller.closeSheet}>
              先这样
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )
}
