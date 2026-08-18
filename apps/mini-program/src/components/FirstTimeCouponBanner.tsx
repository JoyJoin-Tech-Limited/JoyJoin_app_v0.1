import { Text, View } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getArchetypeHSL } from '@shared/archetypeColors'
import { useMiniRevealMotion } from '../hooks/useMiniRevealMotion'
import { useStaggerMount } from '../hooks/useStaggerMount'
import { useDeviceTier } from '../hooks/useDeviceTier'
import { haptics } from '../lib/utils/haptics'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import './FirstTimeCouponBanner.scss'

interface FirstTimeCouponBannerProps {
  className?: string
  couponCode: string
  discountPercent?: number
  onUseCoupon?: (code: string) => void
  analyticsContext?: string
  userArchetype?: string | null
  archetypeDisplayName?: string | null
  /** Current selected plan price (cents or yuan) for savings preview */
  planPrice?: number
  /** Coupon validity end date ISO string */
  validUntil?: string | null
}

// ─── Counter animation ─────────────────────────────────────────────────
function useCountUp(target: number, durationMs: number, enabled: boolean): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }
    setValue(0)
    startTimeRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / durationMs, 1)
      // easeOutCubic for a satisfying landing
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, durationMs, enabled])

  return value
}

// ─── Confetti particles ────────────────────────────────────────────────
interface ConfettiParticle {
  id: number
  x: number
  y: number
  angle: number
  distance: number
  tx: number
  ty: number
  size: number
  color: string
  delay: number
  duration: number
}

function generateConfetti(count: number, colors: string[]): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * 360
    const distance = 60 + Math.random() * 100
    const rad = (angle * Math.PI) / 180
    return {
      id: i,
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50 + (Math.random() - 0.5) * 20,
      angle,
      distance,
      tx: Math.round(Math.cos(rad) * distance),
      ty: Math.round(-Math.sin(rad) * distance),
      size: 6 + Math.random() * 8,
      color: colors[i % colors.length],
      delay: Math.random() * 0.15,
      duration: 0.6 + Math.random() * 0.4,
    }
  })
}

// Decorative sparkles — same pattern as HeroPromoBanner but tuned for
// the smaller payment-page context. Four sparkles keep the surface
// alive without crowding the discount text.
const SPARKLE_BASE = [
  { left: '72%', bottom: '62%', size: 8, negDelay: -0.0, drift: 'sm' },
  { left: '84%', bottom: '28%', size: 12, negDelay: -0.9, drift: 'md' },
  { left: '92%', bottom: '52%', size: 6, negDelay: -1.8, drift: 'sm' },
  { left: '78%', bottom: '78%', size: 10, negDelay: -2.7, drift: 'md' },
] as const

const BANNER_ID = 'first-time-coupon-banner'

export default function FirstTimeCouponBanner({
  className = '',
  couponCode,
  discountPercent = 50,
  onUseCoupon,
  analyticsContext = 'payment',
  userArchetype,
  archetypeDisplayName,
  planPrice,
  validUntil,
}: FirstTimeCouponBannerProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const staggerMounted = useStaggerMount()
  const { isDegradation } = useDeviceTier()
  const [isPressed, setIsPressed] = useState(false)
  const [isClaimed, setIsClaimed] = useState(false)
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([])
  const [confettiKey, setConfettiKey] = useState(0)

  const animateIn = staggerMounted && !shouldReduceMotion
  const idleAnimationsEnabled = animateIn && !isDegradation
  const showCounterAnimation = animateIn

  const countedPercent = useCountUp(discountPercent, 1200, showCounterAnimation)

  // Archetype-aware shape tint: subtly color the decorative circle
  // with the user's archetype accent. Falls back to default purple.
  const shapeStyle = useMemo(() => {
    if (!userArchetype) return undefined
    const hsl = getArchetypeHSL(userArchetype)
    return {
      background: `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.12)`,
    } as React.CSSProperties
  }, [userArchetype])

  // Savings preview: concrete monetary savings from the current plan
  const savingsAmount = useMemo(() => {
    if (!planPrice || !discountPercent || discountPercent <= 0) return null
    const price = planPrice > 1000 ? planPrice / 100 : planPrice // handle cents vs yuan
    return Math.round(price * (discountPercent / 100))
  }, [planPrice, discountPercent])

  // Validity hint: "有效期至 12月25日" or null
  const validityHint = useMemo(() => {
    if (!validUntil) return null
    try {
      const d = new Date(validUntil)
      if (Number.isNaN(d.getTime())) return null
      return `${d.getMonth() + 1}月${d.getDate()}日`
    } catch {
      return null
    }
  }, [validUntil])

  // Track impression once on mount
  useEffect(() => {
    discoverAnalytics.track(
      'welcome_coupon_banner_impression',
      undefined,
      {
        discountPercent,
        context: analyticsContext,
        hasArchetype: !!userArchetype,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountPercent, analyticsContext, userArchetype])

  const handleTap = useCallback(() => {
    if (!onUseCoupon || !couponCode || isClaimed) return

    haptics('success')
    discoverAnalytics.track(
      'welcome_coupon_banner_tap',
      undefined,
      {
        discountPercent,
        context: analyticsContext,
        couponCode,
        hasArchetype: !!userArchetype,
      },
    )

    // Trigger confetti burst
    const colors = userArchetype
      ? ['#FFFFFF', '#FF6B9D', '#8B5CF6', '#FFD700']
      : ['#FFFFFF', '#FF6B9D', '#8B5CF6', '#FFE4E1']
    setConfetti(generateConfetti(8, colors))
    setConfettiKey((k) => k + 1)

    // Show claimed celebration
    setIsClaimed(true)

    // Auto-select the coupon after brief delay so user sees the celebration
    setTimeout(() => {
      onUseCoupon(couponCode)
    }, 900)
  }, [couponCode, onUseCoupon, discountPercent, analyticsContext, userArchetype, isClaimed])

  const handleTouchStart = useCallback(() => setIsPressed(true), [])
  const handleTouchEnd = useCallback(() => setIsPressed(false), [])

  const sparkles = useMemo(
    () =>
      SPARKLE_BASE.map((s) => ({
        ...s,
        className: `first-time-coupon-banner__sparkle first-time-coupon-banner__sparkle-drift-${s.drift}`,
        style: {
          left: s.left,
          bottom: s.bottom,
          width: `${s.size}rpx`,
          height: `${s.size}rpx`,
          animationDelay: `${s.negDelay}s`,
        },
      })),
    [],
  )

  // ── Emotionally resonant, context-aware copy ────────────────────────
  const eyebrowText = '新人见面礼'
  const titleText = `首单${countedPercent > 0 ? countedPercent : discountPercent}折`
  const subtitleText = archetypeDisplayName
    ? `作为「${archetypeDisplayName}」的你，这份福利专属于你`
    : '完成聚会人格测试后，悦仔为你准备的专属福利'

  return (
    <View
      id={BANNER_ID}
      className={[
        'first-time-coupon-banner',
        shouldReduceMotion ? 'first-time-coupon-banner--reduce-motion' : '',
        isDegradation ? 'first-time-coupon-banner--degradation' : '',
        isClaimed ? 'first-time-coupon-banner--claimed' : '',
        className,
      ].filter(Boolean).join(' ')}
      role='region'
      aria-label={`新人见面礼，首单${discountPercent}折优惠券${savingsAmount !== null ? `，立省${savingsAmount}元` : ''}`}
      aria-roledescription='优惠券横幅'
    >
      <View
        className={[
          'first-time-coupon-banner__slide',
          isPressed ? 'first-time-coupon-banner__slide--pressed' : '',
        ].filter(Boolean).join(' ')}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        hoverClass='first-time-coupon-banner__slide--hover'
        role='button'
        aria-pressed={isClaimed}
        aria-disabled={isClaimed}
      >
        {/* Decorative organic shape — archetype-tinted if available */}
        <View
          className='first-time-coupon-banner__shape'
          style={shapeStyle}
          aria-hidden='true'
        />

        {/* Decorative watermark percent */}
        <View className='first-time-coupon-banner__watermark' aria-hidden='true'>
          <Text className='first-time-coupon-banner__watermark-text'>
            {countedPercent > 0 ? countedPercent : discountPercent}%
          </Text>
        </View>

        {/* Sparkle layer */}
        {idleAnimationsEnabled && (
          <View className='first-time-coupon-banner__sparkles' aria-hidden='true'>
            {sparkles.map((s, i) => (
              <View key={i} className={s.className} style={s.style} />
            ))}
          </View>
        )}

        {/* Confetti burst layer */}
        {confetti.length > 0 && (
          <View className='first-time-coupon-banner__confetti' aria-hidden='true' key={confettiKey}>
            {confetti.map((p) => (
              <View
                key={p.id}
                className='first-time-coupon-banner__confetti-particle'
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: `${p.size}rpx`,
                  height: `${p.size}rpx`,
                  backgroundColor: p.color,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  '--tx': `${p.tx}rpx`,
                  '--ty': `${p.ty}rpx`,
                } as React.CSSProperties}
              />
            ))}
          </View>
        )}

        {/* Gradient overlay for copy legibility */}
        <View className='first-time-coupon-banner__overlay' aria-hidden='true' />

        {/* Copy panel */}
        <View className='first-time-coupon-banner__content'>
          <View
            className={[
              'first-time-coupon-banner__copy-panel',
              animateIn ? 'stagger-in stagger-in--0' : '',
            ].filter(Boolean).join(' ')}
          >
            <Text
              className={[
                'first-time-coupon-banner__eyebrow',
                animateIn ? 'stagger-in stagger-in--1' : '',
              ].filter(Boolean).join(' ')}
            >
              {eyebrowText}
            </Text>
            <Text
              className={[
                'first-time-coupon-banner__title',
                animateIn ? 'stagger-in stagger-in--2' : '',
              ].filter(Boolean).join(' ')}
            >
              {titleText}
            </Text>
            <Text
              className={[
                'first-time-coupon-banner__subtitle',
                animateIn ? 'stagger-in stagger-in--3' : '',
              ].filter(Boolean).join(' ')}
            >
              {subtitleText}
            </Text>
            {savingsAmount !== null ? (
              <Text
                className={[
                  'first-time-coupon-banner__savings',
                  animateIn ? 'stagger-in stagger-in--4' : '',
                ].filter(Boolean).join(' ')}
                aria-live='polite'
                aria-atomic='true'
              >
                立省 ¥{savingsAmount}
                {validityHint ? ` · 有效期至 ${validityHint}` : ''}
              </Text>
            ) : null}
            <View
              className={[
                'first-time-coupon-banner__cta',
                animateIn ? 'stagger-in stagger-in--5' : '',
              ].filter(Boolean).join(' ')}
              aria-hidden='true'
            >
              <Text className='first-time-coupon-banner__cta-text'>
                {isClaimed ? '已领取' : '领取福利'}
              </Text>
              <View className='first-time-coupon-banner__cta-arrow' aria-hidden='true'>
                <Text className='first-time-coupon-banner__cta-arrow-glyph'>
                  {isClaimed ? '✓' : '→'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Claimed celebration overlay — announced to screen readers */}
        {isClaimed && (
          <View
            className='first-time-coupon-banner__claimed-overlay'
            role='status'
            aria-live='polite'
            aria-atomic='true'
          >
            <View className='first-time-coupon-banner__claimed-ring' aria-hidden='true' />
            <Text className='first-time-coupon-banner__claimed-text'>已领取</Text>
          </View>
        )}
      </View>
    </View>
  )
}
