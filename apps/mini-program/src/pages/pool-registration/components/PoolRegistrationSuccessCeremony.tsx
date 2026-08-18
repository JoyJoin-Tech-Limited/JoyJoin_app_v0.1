import { memo, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { EventPoolSummary } from '@shared/api'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'

import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import { haptics } from '../../../lib/utils/haptics'
import { formatDateTime } from '../../../lib/matching/groupDisplay'
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import Button from '../../../components/ui/Button'
import ChemistryMiniGrid from '../../../components/discover/ChemistryMiniGrid'
import RegistrationSuccessCeremony from '../../../components/reservation/RegistrationSuccessCeremony'
import type { PoolEventType } from '../flowConfig'

interface PoolRegistrationSuccessCeremonyProps {
  poolId: string
  eventType: PoolEventType
  highlights: string[]
  pool: EventPoolSummary
  userArchetype: string | null
  /** Duo variant (spec §C.3/C'-2): bound → duo title + body; waiting → extra pill. */
  duo?: { partnerName: string; bound: boolean }
  onEnableNotifications: () => void
  isEnablingNotifications?: boolean
  notificationsEnabled?: boolean
  /** OS-level reduced-motion flag from the page (spec §4 degradation ladder). */
  reduceMotion?: boolean
}

/**
 * Pool-registration success surface (Phase 4 「订座」, 2026-08-17): wraps the
 * shared RegistrationSuccessCeremony with the pool-specific slots — notify
 * hint + subscribe button, highlight pills, duo variants, and the
 * ChemistryMiniGrid `after` slot. The EventSummaryCard is intentionally gone:
 * the ticket now carries title / eventType / 地点 / 时间 (spec §6).
 */
function PoolRegistrationSuccessCeremony({
  poolId,
  eventType,
  highlights,
  pool,
  userArchetype,
  duo,
  onEnableNotifications,
  isEnablingNotifications = false,
  notificationsEnabled = false,
  reduceMotion = false,
}: PoolRegistrationSuccessCeremonyProps) {
  const deviceTier = useDeviceTier()
  const [isNavigating, setIsNavigating] = useState(false)
  useResetOnShow(setIsNavigating)

  useEffect(() => {
    discoverAnalytics.track('registration_terminal_state_view', poolId, {
      variant: 'success',
    })
    if (duo) {
      discoverAnalytics.track('duo_success_view', poolId, { bound: duo.bound })
    }
  }, [poolId, duo])

  const handleEnableNotifications = () => {
    if (isEnablingNotifications || notificationsEnabled) return
    haptics('light')
    discoverAnalytics.track('registration_terminal_notify_tap', poolId, {
      variant: 'success',
    })
    onEnableNotifications()
  }

  const handleGoToFootprint = () => {
    if (isNavigating) return
    setIsNavigating(true)
    haptics('medium')
    discoverAnalytics.track('registration_terminal_cta_tap', poolId, {
      variant: 'success',
      target: 'footprint',
    })
    Taro.switchTab({
      url: '/pages/events/index',
      fail: () => {
        setIsNavigating(false)
        Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
      },
    })
  }

  const areaLabel = pool.district?.trim() || pool.city?.trim() || ''
  const dateLabel = formatDateTime(pool.dateTime)
  const seatOrdinal = pool.registrationCount ?? pool.currentParticipants

  const showPills = highlights.length > 0 || (duo && !duo.bound)

  const chemistryGrid = useMemo(
    () => <ChemistryMiniGrid pool={pool} userArchetype={userArchetype} />,
    [pool, userArchetype],
  )

  return (
    <View className='pool-reg'>
      <ScrollView className='pool-reg__scroll pool-reg__scroll--ceremony' scrollY enhanced showScrollbar={false}>
        <RegistrationSuccessCeremony
          title={duo?.bound ? '双人成行已就位' : `已加入这场${eventType}`}
          banner={{
            imageSrc: CEREMONY_HEROES.poolRegistrationSuccess,
            badgeEmoji: eventType === '饭局' ? '🍜' : '🍷',
            badgeText: eventType,
            title: pool.title,
          }}
          meta={[
            {
              key: 'venue',
              label: '地点',
              value: areaLabel || '待定',
              hint: areaLabel ? undefined : '排桌完成后 24 小时内公布',
            },
            {
              key: 'time',
              label: '时间',
              value: dateLabel || '待定',
              hint: dateLabel ? undefined : '确认后推送具体时段',
              align: 'right',
            },
          ]}
          seatOrdinal={seatOrdinal}
          motionEnabled={!reduceMotion && !deviceTier.isDegradation}
          onCtaClick={handleGoToFootprint}
          ctaDisabled={isNavigating}
          after={chemistryGrid}
        >
          {duo?.bound ? (
            <Text className='registration-ceremony__text'>
              已和 {duo.partnerName} 组成双人，悦仔会安排同桌。
            </Text>
          ) : null}
          <Text className='registration-ceremony__text'>
            我们会按照你刚刚填写的预算、活动期待和偏好完成排桌，有结果会第一时间通知你。
          </Text>
          <Text className='registration-ceremony__hint'>
            {`想在${DEFAULT_MASCOT_DISPLAY_NAME}帮你排桌完成时收到微信提醒？点一下授权（可在微信授权弹窗中选择）。`}
          </Text>
          <Button
            variant='secondary'
            className='registration-ceremony__notify-btn'
            onClick={handleEnableNotifications}
            loading={isEnablingNotifications}
            disabled={notificationsEnabled}
          >
            {notificationsEnabled ? '已开启提醒' : '开启排桌结果通知'}
          </Button>
          {showPills ? (
            <View className='registration-ceremony__pills'>
              {highlights.map((item) => (
                <Text key={item} className='registration-ceremony__pill'>
                  {item}
                </Text>
              ))}
              {duo && !duo.bound ? (
                <Text className='registration-ceremony__pill'>
                  等 {duo.partnerName} 报名，你们就是同桌
                </Text>
              ) : null}
            </View>
          ) : null}
        </RegistrationSuccessCeremony>
      </ScrollView>
    </View>
  )
}

export default memo(PoolRegistrationSuccessCeremony)
