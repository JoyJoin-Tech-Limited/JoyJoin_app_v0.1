import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React from 'react'
import Card from '../ui/Card'
import ParticipantPresenceStrip from './ParticipantPresenceStrip'
import CompatibilityIndicator from './CompatibilityIndicator'
import { formatDateTimeParts } from '../../lib/matching/groupDisplay'
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
import { useDeviceTier } from '../../hooks/useDeviceTier'

// ─── Constants ─────────────────────────────────────────────────

const CTA_PULSE_SHOWN_KEY = 'jj_oracle_cta_pulse_shown'
const CARD_VARIANT = 'oracle_v1'

const URGENT_HOURS = 24
const CRITICAL_HOURS = 6
const HIGH_CHEMISTRY_CELEBRATION_THRESHOLD = 3

const FALLBACK_COLOR = '#8B5CF6'

const EVENT_TYPE_LABELS: Record<string, string> = {
  '饭局': '饭局', '酒局': '酒局', '其他': '其他',
  dinner: '饭局', dining: '饭局', drinks: '酒局', bar: '酒局', other: '其他',
}

// ─── Helpers ───────────────────────────────────────────────────

function getEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

/** Append a 2-char hex alpha channel to a hex colour (e.g. `#C79450` + `1A` → `#C794501A`). */
function hexWithAlpha(hex: string, alphaHex: string): string {
  return hex.startsWith('#') ? hex + alphaHex : hex
}

/** Render-safe alpha accessor — returns the rgba value from a hex for inline styles. */
function familyAlphaHex(hex: string, alpha: string): string {
  return hexWithAlpha(hex, alpha)
}

interface OracleCardProps {
  pool: EventPoolSummary
  userArchetype: string | null
  index: number
  onTap: (pool: EventPoolSummary) => void
  /** Kill switch — when false renders a simplified card without interactivity. Default true. */
  enabled?: boolean
}

export default React.memo(function OracleCard({
  pool,
  userArchetype,
  index,
  onTap,
  enabled = true,
}: OracleCardProps) {
  const { isDegradation } = useDeviceTier()

  // ── Derived pool state ───────────────────────────────────────

  const isEmptyPool = (pool.currentParticipants ?? pool.registrationCount ?? 0) === 0
  const accentFamily = isEmptyPool ? 'fire' : (pool.accentFamily ?? 'calm')
  const familyColor = ARCHETYPE_FAMILY_COLORS[accentFamily] ?? FALLBACK_COLOR
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[accentFamily] ?? ARCHETYPE_FAMILY_GRADIENTS.calm

  const currentParticipants = pool.currentParticipants ?? pool.registrationCount ?? 0
  const maxParticipants = pool.maxParticipants
    ?? (typeof pool.spotsLeft === 'number' ? currentParticipants + Math.max(pool.spotsLeft, 0) : undefined)

  const isPoolFull = typeof maxParticipants === 'number' && maxParticipants > 0
    && currentParticipants >= maxParticipants

  // ── Memoised chemistry share ─────────────────────────────────

  const highChemistryCount = pool.highChemistryCount ?? 0

  const highChemistryShare = React.useMemo(() => {
    const total = pool.registrationCount ?? 0
    if (total === 0) return 0
    return Math.min(100, Math.round((highChemistryCount / total) * 100))
  }, [pool.registrationCount, highChemistryCount])

  const showCelebration = highChemistryCount >= HIGH_CHEMISTRY_CELEBRATION_THRESHOLD

  // ── Handlers ─────────────────────────────────────────────────

  const handleTap = React.useCallback(() => {
    if (!enabled || isPoolFull) return
    discoverAnalytics.track('pool_card_tap', pool.id, {
      cardVersion: CARD_VARIANT,
      accentFamily,
      highChemistryShare: highChemistryCount,
    })
    try {
      if (Taro.vibrateShort) Taro.vibrateShort({ type: 'light' })
    } catch { /* haptic is decorative */ }
    onTap(pool)
  }, [pool, accentFamily, highChemistryCount, onTap, enabled, isPoolFull])

  // ── Once-per-session CTA pulse (ref init, no render mutation) ──

  const pulseInitRef = React.useRef<boolean | null>(null)
  if (pulseInitRef.current === null) {
    pulseInitRef.current = false
    if (index === 0) {
      try {
        if (!Taro.getStorageSync(CTA_PULSE_SHOWN_KEY)) {
          Taro.setStorageSync(CTA_PULSE_SHOWN_KEY, '1')
          pulseInitRef.current = true
        }
      } catch { /* sync storage failure is non-critical */ }
    }
  }
  const shouldPulseCta = pulseInitRef.current && !isPoolFull

  // ── Skeleton fallback ────────────────────────────────────────

  const hasEssentialData = pool.id && pool.title != null
  if (!hasEssentialData || !enabled) {
    return (
      <Card className='oracle-card oracle-card--skeleton'>
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--hero' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--meta' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--teaser' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--cta' />
      </Card>
    )
  }

  // ── Memoised copy — only recompute when pool data changes ────

  const copyRef = React.useMemo(() => ({
    heroMessage: getHeroMessage(pool, userArchetype),
    teaser: getTypeDensityTeaser(pool, userArchetype),
    subline: getTypeDensitySubline(pool),
    cta: getCtaLabel(pool),
    dateTime: formatDateTimeParts(pool.dateTime),
  }), [pool, userArchetype])

  const { heroMessage, teaser, subline, cta, dateTime: { date: dateLabel, time: timeLabel } } = copyRef

  // ── L2 Topline ───────────────────────────────────────────────

  const hoursLeft = pool.hoursUntilDeadline ?? 0
  const isUrgent = hoursLeft > 0 && hoursLeft <= URGENT_HOURS
  const isCritical = hoursLeft > 0 && hoursLeft <= CRITICAL_HOURS

  const countdownLabel = hoursLeft <= 0
    ? '即将截止'
    : hoursLeft < URGENT_HOURS
      ? `${Math.ceil(hoursLeft)} 小时后截止`
      : hoursLeft < 72
        ? `${Math.floor(hoursLeft / 24)} 天后截止`
        : null

  const momentumLabel = (() => {
    if (isPoolFull) return '已满员'
    const rc = pool.registrationCount ?? 0
    if (rc === 0) return '刚开桌，趁热'
    if (rc >= 8) return '差不多坐满了'
    if (rc >= 3) return '越来越热闹了'
    return '刚开桌，趁热'
  })()

  // ── L1 Hero: chemistry celebration ───────────────────────────

  const ctaLabel = isPoolFull ? '已满员' : cta.primary
  const ctaSubline = isPoolFull ? '下次早点来哦～' : '好奇的话，点开看看'
  const animDelay = index < 6 ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  // ── Render ───────────────────────────────────────────────────

  const cardClass = [
    'oracle-card',
    `oracle-card--accent-${accentFamily}`,
    isPoolFull ? 'oracle-card--full' : '',
    isDegradation ? 'oracle-card--low-end' : '',
  ].filter(Boolean).join(' ')

  const eventTypeLabel = getEventTypeLabel(pool.eventType)
  const titleLabel = (pool.title || '悦聚活动').trim()
  const shouldShowTitle = titleLabel !== eventTypeLabel
  const cardAriaLabel = `${dateLabel} ${timeLabel} ${eventTypeLabel}${pool.city ? ' ' + pool.city : ''}${isPoolFull ? '，已满员' : ''}，${heroMessage}`

  return (
    <Card
      className={cardClass}
      hoverClass={isPoolFull ? '' : 'oracle-card--hover'}
      role='button'
      aria-label={cardAriaLabel}
      aria-disabled={isPoolFull}
      style={{
        animationDelay: isDegradation ? undefined : animDelay,
        background: gradient,
        boxShadow: `0 8rpx 32rpx ${familyAlphaHex(familyColor, '1A')}`,
      }}
      onClick={handleTap}
    >
      {/* L2 Topline: status + urgency */}
      <View className='oracle-card__topline'>
        <View className='oracle-card__pulse-pill'>
          <View
            className={`oracle-card__pulse-dot${isUrgent && !isPoolFull ? ' oracle-card__pulse-dot--urgent' : ''}`}
            style={{ backgroundColor: familyColor }}
          />
          <Text
            className='oracle-card__pulse-label'
            style={{ color: familyColor }}
          >
            {momentumLabel}
          </Text>
        </View>
        {!isPoolFull && countdownLabel && (
          <Text
            className={`oracle-card__countdown${isUrgent ? ' oracle-card__countdown--urgent' : ''}${isCritical ? ' oracle-card__countdown--critical' : ''}`}
            style={isUrgent ? { color: familyColor } : undefined}
          >
            {countdownLabel}
          </Text>
        )}
      </View>

      {/* L1 Hero: emotional hook with chemistry celebration */}
      <View className='oracle-card__hero'>
        <View className='oracle-card__hero-text'>
          <Text className='oracle-card__hero-message'>{heroMessage}</Text>
          {highChemistryShare > 0 && (
            <CompatibilityIndicator score={highChemistryShare} family={accentFamily} />
          )}
        </View>
      </View>

      {/* L3 Decision Facts */}
      <View className='oracle-card__facts'>
        <View className='oracle-card__fact-when-row'>
          <Text className='oracle-card__fact-when'>{dateLabel}</Text>
          {timeLabel && (
            <Text className='oracle-card__fact-time'>{timeLabel}</Text>
          )}
          {showCelebration && (
            <View
              className='oracle-card__celebration-badge'
              style={{ backgroundColor: familyColor }}
              aria-label={`${highChemistryCount} 个高默契对象`}
            >
              <Text>{highChemistryCount}位高默契</Text>
            </View>
          )}
        </View>
        <Text className='oracle-card__fact-what-where'>
          <Text className='oracle-card__fact-type'>{eventTypeLabel}</Text>
          {pool.city && (
            <Text className='oracle-card__fact-location'>
              {'  ·  '}{pool.city}{pool.district ? ` ${pool.district}` : ''}
            </Text>
          )}
        </Text>
      </View>

      {/* L4 Title */}
      {shouldShowTitle && (
        <View className='oracle-card__meta'>
          <Text className='oracle-card__title'>{titleLabel}</Text>
        </View>
      )}

      {/* L5 Social proof teaser */}
      {(teaser || subline) && (
        <View
          className='oracle-card__teaser'
          style={{
            borderColor: familyAlphaHex(familyColor, '20'),
            backgroundColor: familyAlphaHex(familyColor, '0D'),
          }}
        >
          {teaser && (
            <Text className='oracle-card__teaser-text' style={{ color: familyColor }}>
              {teaser}
            </Text>
          )}
          {subline && (
            <Text className='oracle-card__teaser-subline'>{subline}</Text>
          )}
        </View>
      )}

      {/* L6 Action: presence strip + CTA */}
      <View className='oracle-card__footer'>
        <ParticipantPresenceStrip
          pool={pool}
          userArchetype={userArchetype}
          accentColor={familyColor}
          index={index}
          maxParticipants={maxParticipants}
        />

        <View
          className={`oracle-card__cta${shouldPulseCta ? ' oracle-card__cta--pulse' : ''}`}
          style={{ backgroundColor: familyColor }}
          hoverClass={isPoolFull ? '' : 'oracle-card__cta--hover'}
          role='button'
          aria-label={isPoolFull ? '已满员，下次早点来哦' : `${ctaLabel}，${ctaSubline}`}
          aria-disabled={isPoolFull}
        >
          <Text className='oracle-card__cta-text'>{ctaLabel}</Text>
          <Text className='oracle-card__cta-subline'>{ctaSubline}</Text>
        </View>
      </View>
    </Card>
  )
})
