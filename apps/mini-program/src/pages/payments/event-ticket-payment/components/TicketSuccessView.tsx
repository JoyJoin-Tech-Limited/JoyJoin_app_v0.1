import { useEffect, useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { EventPoolSummary } from '@shared/api'

import { CEREMONY_HEROES } from '../../../../lib/ceremonyHeroes'
import { formatEventDateShort } from '../../../../lib/utils/eventDisplay'
import { discoverAnalytics } from '../../../../lib/analytics/discoverAnalytics'
import JoyJoinIcon from '../../../../components/ui/JoyJoinIcon'

// Brand confetti palette — keep in sync with $color-primary, $color-secondary,
// and $color-landed-gold in apps/mini-program/src/styles/_variables.scss.
const SUCCESS_CONFETTI_COLORS = ['#8B5CF6', '#FF6B9D', '#FBBF24']

interface TicketConfettiParticle {
  id: number
  x: number
  y: number
  tx: number
  ty: number
  angle: number
  size: number
  color: string
  delay: number
  duration: number
}

function generateConfetti(count: number, colors: string[]): TicketConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * 360
    const distance = 80 + Math.random() * 120
    const rad = (angle * Math.PI) / 180
    return {
      id: i,
      x: 20 + Math.random() * 60,
      y: 10 + Math.random() * 40,
      tx: Math.round(Math.cos(rad) * distance),
      ty: Math.round(-Math.sin(rad) * distance),
      angle: Math.round(angle + Math.random() * 180),
      size: Math.round(8 + Math.random() * 10),
      color: colors[i % colors.length],
      delay: Math.round(Math.random() * 150) / 1000,
      duration: 2 + Math.round(Math.random() * 500) / 1000,
    }
  })
}

export interface TicketSuccessViewProps {
  pool?: EventPoolSummary | null
  eventType: string
  motionEnabled: boolean
  onCtaClick: () => void
  ctaDisabled?: boolean
  poolId?: string
}

export default function TicketSuccessView({
  pool,
  eventType,
  motionEnabled,
  onCtaClick,
  ctaDisabled = false,
  poolId,
}: TicketSuccessViewProps) {
  const [successHeroError, setSuccessHeroError] = useState(false)
  const [confettiStarted, setConfettiStarted] = useState(false)

  // 'active' means the pool is still recruiting/collecting registrations.
  // Only 'matching' means the matching engine is actually running.
  const isMatchingInProgress = pool?.status === 'matching'
  const subtitle = isMatchingInProgress
    ? `${DEFAULT_MASCOT_DISPLAY_NAME}已收到你的入场券，正在为你匹配合适的伙伴。`
    : `报名成功！${DEFAULT_MASCOT_DISPLAY_NAME}拿着你的入场券，匹配开始前会第一时间通知你。`

  const dateLabel = formatEventDateShort(pool?.dateTime)
  const areaLabel = pool?.district || pool?.city || ''
  const chipText = [eventType, dateLabel, areaLabel].filter(Boolean).join(' · ')

  const successHeroSrc = successHeroError
    ? CEREMONY_HEROES.eventTicketSuccessV2.png
    : CEREMONY_HEROES.eventTicketSuccessV2.webp

  const confettiParticles = useMemo(() => {
    if (!motionEnabled) return []
    return generateConfetti(16, SUCCESS_CONFETTI_COLORS)
  }, [motionEnabled])

  useEffect(() => {
    if (!motionEnabled || confettiParticles.length === 0) return
    const raf = requestAnimationFrame(() => setConfettiStarted(true))
    return () => cancelAnimationFrame(raf)
  }, [motionEnabled, confettiParticles.length])

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '报名成功' })
    discoverAnalytics.track('event_ticket_payment_success_view', undefined, { poolId: poolId ?? pool?.id })
  }, [poolId, pool?.id])

  return (
    <View
      className={`ticket-success ${motionEnabled ? 'ticket-success--motion' : ''}`}
      role='status'
      aria-live='polite'
    >
      <View className='ticket-success__hero-wrap'>
        <Image
          className='ticket-success__hero'
          src={successHeroSrc}
          mode='widthFix'
          ariaLabel='报名成功'
          onError={() => setSuccessHeroError(true)}
        />
        <View className='ticket-success__hero-bridge' aria-hidden='true' />
        {confettiParticles.length > 0 && (
          <View className='ticket-success__confetti' aria-hidden='true'>
            {confettiParticles.map((p) => (
              <View
                key={p.id}
                className='ticket-success__confetti-particle'
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: `${p.size}rpx`,
                  height: `${Math.round(p.size * 0.5)}rpx`,
                  backgroundColor: p.color,
                  transitionDelay: `${p.delay}s`,
                  transitionDuration: `${p.duration}s`,
                  opacity: confettiStarted ? 0 : 1,
                  transform: confettiStarted
                    ? `translate(${p.tx}rpx, ${p.ty}rpx) rotate(${p.angle}deg)`
                    : 'translate(0, 0) rotate(0deg)',
                }}
              />
            ))}
          </View>
        )}
      </View>

      <View className='ticket-success__body'>
        <Text className='ticket-success__title'>报名成功！</Text>
        <Text className='ticket-success__subtitle'>{subtitle}</Text>
        {chipText && (
          <View className='ticket-success__chip'>
            <JoyJoinIcon emoji={eventType === '饭局' ? '🍜' : '🍷'} tier='category' size={28} />
            <Text className='ticket-success__chip-text'>{chipText}</Text>
          </View>
        )}
      </View>

      <View className='ticket-success__footer'>
        <View
          className={`ticket-success__cta ${ctaDisabled ? 'ticket-success__cta--disabled' : ''}`}
          hoverClass={ctaDisabled ? '' : 'ticket-success__cta--pressed'}
          onClick={ctaDisabled ? undefined : onCtaClick}
        >
          <Text className='ticket-success__cta-text'>查看我的活动</Text>
        </View>
      </View>
    </View>
  )
}
