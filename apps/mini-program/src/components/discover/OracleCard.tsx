import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React from 'react'
import Card from '../ui/Card'
import EcosystemBar from './EcosystemBar'
import CompatibilityIndicator from './CompatibilityIndicator'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  getTypeDensityTeaser,
  getTypeDensitySubline,
  getCtaLabel,
  getHeroMessage,
} from '../../lib/utils/discoverNarrativeCopy'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
} from '@shared/archetypeColors'
import type { EventPoolSummary } from '@shared/api'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'

const CTA_PULSE_SHOWN_KEY = 'jj_oracle_cta_pulse_shown'

const EVENT_TYPE_LABELS: Record<string, string> = {
  '饭局': '饭局',
  '酒局': '酒局',
  '其他': '其他',
  dinner: '饭局',
  dining: '饭局',
  drinks: '酒局',
  bar: '酒局',
  other: '其他',
}

function getEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

interface OracleCardProps {
  pool: EventPoolSummary
  userArchetype: string | null
  index: number
  onTap: (pool: EventPoolSummary) => void
}

export default React.memo(function OracleCard({
  pool,
  userArchetype,
  index,
  onTap,
}: OracleCardProps) {
  const isEmptyPool = (pool.registrationCount ?? 0) === 0
  const accentFamily = isEmptyPool ? 'fire' : (pool.accentFamily ?? 'calm')
  const familyColor = ARCHETYPE_FAMILY_COLORS[accentFamily] ?? '#8B5CF6'
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[accentFamily] ?? ARCHETYPE_FAMILY_GRADIENTS.calm

  const handleTap = React.useCallback(() => {
    discoverAnalytics.track('pool_card_tap', pool.id, {
      cardVersion: 'oracle_v1',
      accentFamily,
      highChemistryShare: pool.highChemistryCount ?? 0,
    })
    onTap(pool)
  }, [pool, accentFamily, onTap])

  // Once-per-session CTA pulse on the first visible card
  const shouldPulseCta = React.useMemo(() => {
    if (index !== 0) return false
    try {
      const shown = Taro.getStorageSync(CTA_PULSE_SHOWN_KEY)
      if (shown) return false
      Taro.setStorageSync(CTA_PULSE_SHOWN_KEY, '1')
      return true
    } catch {
      return false
    }
  }, [index])

  const currentParticipants = pool.currentParticipants ?? pool.registrationCount ?? 0
  const maxParticipants = pool.maxParticipants
    ?? (typeof pool.spotsLeft === 'number' ? currentParticipants + Math.max(pool.spotsLeft, 0) : undefined)
  const fillPct = maxParticipants
    ? Math.min(100, Math.round((currentParticipants / maxParticipants) * 100))
    : 0

  const highChemistryShare = React.useMemo(() => {
    const total = pool.registrationCount ?? 0
    const highChem = pool.highChemistryCount ?? 0
    if (total === 0) return 0
    return Math.min(100, Math.round((highChem / total) * 100))
  }, [pool.registrationCount, pool.highChemistryCount])

  // Degraded-render guard: if pool lacks essential data, render a simplified fallback
  const hasEssentialData = pool.id && pool.title != null
  if (!hasEssentialData) {
    return (
      <Card className='oracle-card oracle-card--skeleton'>
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--hero' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--meta' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--teaser' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--cta' />
      </Card>
    )
  }

  const heroMessage = getHeroMessage(pool, userArchetype)
  const teaser = getTypeDensityTeaser(pool, userArchetype)
  const subline = getTypeDensitySubline(pool)
  const cta = getCtaLabel(pool)
  const dateTimeLabel = formatDateTime(pool.dateTime)

  const animDelay = index < 6 ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  // L2 Topline: live pulse + countdown
  const hoursLeft = pool.hoursUntilDeadline ?? 0
  const countdownLabel = hoursLeft <= 0
    ? '即将截止'
    : hoursLeft < 24
      ? `${hoursLeft} 小时后截止`
      : hoursLeft < 72
        ? `${Math.floor(hoursLeft / 24)} 天后截止`
        : null
  const momentumLabel = pool.registrationCount && pool.registrationCount > 0
    ? (pool.registrationCount >= 8 ? '热度很高' : pool.registrationCount >= 3 ? '正在升温' : '新场开局')
    : '新场开局'

  return (
    <Card
      className={'oracle-card oracle-card--accent-' + accentFamily}
      hoverClass='oracle-card--hover'
      style={{
        animationDelay: animDelay,
        background: gradient,
        boxShadow: `0 8rpx 32rpx ${familyColor}1A`,
      }}
      onClick={handleTap}
    >
      {/* L2 Topline */}
      <View className='oracle-card__topline'>
        <View className='oracle-card__pulse-pill'>
          <View className='oracle-card__pulse-dot' style={{ backgroundColor: familyColor }} />
          <Text className='oracle-card__pulse-label' style={{ color: familyColor }}>
            {momentumLabel}
          </Text>
        </View>
        {countdownLabel && (
          <Text className='oracle-card__countdown'>{countdownLabel}</Text>
        )}
      </View>

      <View className='oracle-card__hero'>
        <View className='oracle-card__hero-text'>
          <Text className='oracle-card__hero-message'>{heroMessage}</Text>
          {highChemistryShare > 0 && (
            <CompatibilityIndicator score={highChemistryShare} family={accentFamily} />
          )}
        </View>
      </View>

      <View className='oracle-card__ecosystem'>
        <EcosystemBar
          archetypes={pool.sampleArchetypes ?? []}
          userArchetype={userArchetype}
          registrationCount={pool.registrationCount ?? 0}
        />
      </View>

      <View className='oracle-card__meta'>
        <Text className='oracle-card__title'>{pool.title || '悦聚活动'}</Text>
        <Text className='oracle-card__meta-line'>
          {getEventTypeLabel(pool.eventType)} · {dateTimeLabel}
          {pool.city ? ' · ' + pool.city + (pool.district ? ' ' + pool.district : '') : ''}
        </Text>
      </View>

      <View
        className='oracle-card__teaser'
        style={{
          borderColor: familyColor + '20',
          backgroundColor: familyColor + '0D',
        }}
      >
        <Text className='oracle-card__teaser-text' style={{ color: familyColor }}>
          {teaser}
        </Text>
        <Text className='oracle-card__teaser-subline'>{subline}</Text>
      </View>

      <View className='oracle-card__footer'>
        {typeof maxParticipants === 'number' && maxParticipants > 0 && (
          <View className='oracle-card__progress-row'>
            <View className='oracle-card__progress-track'>
              <View
                className='oracle-card__progress-fill'
                style={{
                  transform: 'scaleX(' + (fillPct / 100) + ')',
                  backgroundColor: familyColor,
                }}
              />
            </View>
            <Text className='oracle-card__progress-text'>
              {currentParticipants + '/' + maxParticipants + ' 人'}
            </Text>
          </View>
        )}

        <View
          className={'oracle-card__cta' + (shouldPulseCta ? ' oracle-card__cta--pulse' : '')}
          style={{ backgroundColor: familyColor }}
        >
          <Text className='oracle-card__cta-text'>{cta.primary}</Text>
          <Text className='oracle-card__cta-subline'>报名后解锁完整默契参考</Text>
        </View>
      </View>
    </Card>
  )
})
