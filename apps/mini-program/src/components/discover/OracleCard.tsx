import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React from 'react'
import {
  ARCHETYPE_FAMILY_COLORS,
  ARCHETYPE_FAMILY_GRADIENTS,
  BRAND_PRIMARY_HEX,
  getContrastSafeArchetypeColor,
} from '@shared/archetypeColors'
import type { EventPoolSummary } from '@shared/api'
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
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { getOracleCardCornerAsset } from './oracleCardAssets'

// ─── Constants ─────────────────────────────────────────────────

const CTA_PULSE_SHOWN_KEY = 'jj_oracle_cta_pulse_shown'
const CARD_VARIANT = 'oracle_v1'

const URGENT_HOURS = 24
const CRITICAL_HOURS = 6
const HIGH_CHEMISTRY_CELEBRATION_THRESHOLD = 3
/** Cap the displayed participant count to keep the pill width predictable. */
const CORNER_STAT_CAP = 999

const FALLBACK_COLOR = BRAND_PRIMARY_HEX

const EVENT_TYPE_LABELS: Record<string, string> = {
  '饭局': '饭局', '酒局': '酒局', '其他': '其他',
  dinner: '饭局', dining: '饭局', drinks: '酒局', bar: '酒局', other: '其他',
}

/** Event-type-aware social copy for the corner participant count. */
function getCornerStatLabel(eventType?: string): string {
  const label = EVENT_TYPE_LABELS[eventType ?? ''] ?? '其他'
  if (label === '饭局') return '人入座中'
  if (label === '酒局') return '人已入席'
  return '位伙伴已加入'
}

// ─── Helpers ───────────────────────────────────────────────────

function getEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

/** Render-safe alpha accessor — returns the rgba value from a hex for inline styles. */
function familyAlphaHex(hex: string, alphaHex: string): string {
  return hex.startsWith('#') ? hex + alphaHex : hex
}

interface OracleCardProps {
  pool: EventPoolSummary
  userArchetype: string | null
  index: number
  onTap: (pool: EventPoolSummary) => void
  /** Kill switch — when false renders a simplified card without interactivity. Default true. */
  enabled?: boolean
  /** Feature flag — when false hides the corner registration-count badge. Default true. */
  cornerStatEnabled?: boolean
}

export default React.memo(function OracleCard({
  pool,
  userArchetype,
  index,
  onTap,
  enabled = true,
  cornerStatEnabled = true,
}: OracleCardProps) {
  const { isDegradation } = useDeviceTier()
  const reduceMotion = React.useMemo(() => getSystemReducedMotion() || isDegradation, [isDegradation])

  // Track impression analytics for the corner stat once per mount.
  const hasTrackedCornerStatImpressionRef = React.useRef(false)
  React.useEffect(() => {
    if (hasTrackedCornerStatImpressionRef.current) return
    const count = pool.currentParticipants ?? pool.registrationCount ?? 0
    if (count > 0) {
      hasTrackedCornerStatImpressionRef.current = true
      discoverAnalytics.track('corner_badge_impression', pool.id, {
        cardVersion: CARD_VARIANT,
        cornerCount: count,
        isCapped: count >= CORNER_STAT_CAP,
        eventType: pool.eventType,
      })
    }
  }, [pool])

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

  const showCornerStat = cornerStatEnabled && !isPoolFull && currentParticipants > 0
  const cornerStatDisplayCount = Math.min(currentParticipants, CORNER_STAT_CAP)
  const cornerStatLabel = getCornerStatLabel(pool.eventType)
  const cornerStatColor = React.useMemo(() => {
    // Prefer a contrast-safe archetype color when we know the user's archetype.
    // Fall back to the card's family color, then brand primary.
    if (userArchetype) return getContrastSafeArchetypeColor(userArchetype)
    return ARCHETYPE_FAMILY_COLORS[accentFamily] ?? FALLBACK_COLOR
  }, [userArchetype, accentFamily])

  const cornerAssetSrc = getOracleCardCornerAsset(pool.eventType)

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
      hasEventTypeVignette: Boolean(cornerAssetSrc),
      hasCornerCount: showCornerStat,
      cornerCount: currentParticipants,
    })
    try {
      if (Taro.vibrateShort) Taro.vibrateShort({ type: 'light' })
    } catch { /* haptic is decorative */ }
    onTap(pool)
  }, [pool, accentFamily, highChemistryCount, cornerAssetSrc, showCornerStat, currentParticipants, onTap, enabled, isPoolFull])

  // ── Corner-stat live-update tracking ─────────────────────────

  const prevCountRef = React.useRef(currentParticipants)
  React.useEffect(() => {
    if (currentParticipants === prevCountRef.current) return
    const prev = prevCountRef.current
    prevCountRef.current = currentParticipants
    if (currentParticipants > 0 && prev > 0) {
      discoverAnalytics.track('corner_badge_live_update', pool.id, {
        previousCount: prev,
        newCount: currentParticipants,
        delta: currentParticipants - prev,
      })
    }
  }, [currentParticipants, pool.id])

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

  // ── Memoised copy — only recompute when pool data changes ────

  const copyRef = React.useMemo(() => {
    // Defensive fallback for the skeleton path; the actual render uses this
    // only when hasEssentialData is true.
    if (!pool.id || pool.title == null) {
      return {
        heroMessage: '',
        teaser: '',
        subline: '',
        cta: { primary: '去看看' },
        dateTime: { date: '', time: '' },
      }
    }
    return {
      heroMessage: getHeroMessage(pool, userArchetype),
      teaser: getTypeDensityTeaser(pool, userArchetype),
      subline: getTypeDensitySubline(pool),
      cta: getCtaLabel(pool),
      dateTime: formatDateTimeParts(pool.dateTime),
    }
  }, [pool, userArchetype])

  // Skeleton fallback — mirrors the corner-stat footprint so the badge does
  // not pop in abruptly when data hydrates.

  const hasEssentialData = pool.id && pool.title != null
  if (!hasEssentialData || !enabled) {
    return (
      <Card className='oracle-card oracle-card--skeleton'>
        <View className='oracle-card__corner-stat oracle-card__corner-stat--skeleton'>
          <View className='oracle-card__corner-stat-pill' />
        </View>
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--hero' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--meta' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--teaser' />
        <View className='oracle-card__skeleton-line oracle-card__skeleton-line--cta' />
      </Card>
    )
  }

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
    showCornerStat ? 'oracle-card--has-corner-stat' : '',
  ].filter(Boolean).join(' ')

  const eventTypeLabel = getEventTypeLabel(pool.eventType)
  const titleLabel = (pool.title || '悦聚活动').trim()
  const shouldShowTitle = titleLabel !== eventTypeLabel
  const cardAriaLabel = `${dateLabel} ${timeLabel} ${eventTypeLabel}${pool.city ? ' ' + pool.city : ''}${isPoolFull ? '，已满员' : currentParticipants > 0 ? `，已有 ${cornerStatDisplayCount}${currentParticipants >= CORNER_STAT_CAP ? ' 多位' : ' 人'}报名` : ''}，${heroMessage}`

  const showCornerAsset = cornerAssetSrc && !isDegradation

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
      {showCornerAsset && (
        <Image
          className='oracle-card__type-corner'
          src={cornerAssetSrc}
          mode='aspectFill'
          aria-hidden='true'
          lazyLoad
        />
      )}

      {showCornerStat && (
        <View
          className='oracle-card__corner-stat'
          aria-hidden='true'
          style={{ animationDelay: isDegradation ? undefined : animDelay }}
        >
          <View
            className={[
              'oracle-card__corner-stat-pill',
              !showCornerAsset ? 'oracle-card__corner-stat-pill--no-vignette' : '',
            ].filter(Boolean).join(' ')}
          >
            <Text
              className='oracle-card__corner-stat-number'
              style={{ color: cornerStatColor }}
            >
              {String(cornerStatDisplayCount)}{currentParticipants >= CORNER_STAT_CAP ? '+' : ''}
            </Text>
            <Text className='oracle-card__corner-stat-label'>{cornerStatLabel}</Text>
          </View>
        </View>
      )}

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
