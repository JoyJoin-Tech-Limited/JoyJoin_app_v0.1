import { Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { cdnAsset } from '../lib/utils/cdnAssets'
import { useMiniRevealMotion } from '../hooks/useMiniRevealMotion'
import { useStaggerMount } from '../hooks/useStaggerMount'
import { useDeviceTier } from '../hooks/useDeviceTier'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import { haptics } from '../lib/utils/haptics'
import { preloadImage } from '../lib/utils/imagePreload'
import './HeroPromoBanner.scss'

export type PromoBannerVariant = 'A' | 'B' | 'C'

interface PromoVariantConfig {
  eyebrow: string
  title: string
  subtitle: string
  cta: string
  accessibilityLabel: string
}

const PROMO_VARIANTS: Record<PromoBannerVariant, PromoVariantConfig> = {
  A: {
    eyebrow: '本周推荐',
    title: '这周末，会遇见谁？',
    subtitle: '已有 12 人报名 · 最后 3 席',
    cta: '查看活动详情',
    accessibilityLabel: '本周推荐活动，已有 12 人报名，剩 3 个名额',
  },
  B: {
    eyebrow: '专属匹配',
    title: '3 种社交人格已匹配',
    subtitle: '你的同类正在附近聚会',
    cta: '看看是谁',
    accessibilityLabel: '专属匹配，已有 3 种社交人格匹配到你的活动',
  },
  C: {
    eyebrow: '先测再玩',
    title: '30 秒测出你的社交人格',
    subtitle: '更精准的聚会推荐',
    cta: '开始测试',
    accessibilityLabel: '30 秒测出你的社交人格，更精准的聚会推荐',
  },
} as const

// WebP primary with explicit PNG fallback for environments where
// canvas / older WeChat shells don't decode WebP cleanly.
const HERO_IMAGE_WEBP = cdnAsset('/assets/promo/banner-hero-lovart-v1.webp')
const HERO_IMAGE_PNG = cdnAsset('/assets/promo/banner-hero-lovart-v1.png')

// ─── Sparkle layer (surprise-box breath of life) ─────────────────────
// Five soft sparkles on negative-delay loop. Five (not three) so the
// surface is never visually "empty" mid-cycle, even at slow heartbeat
// speeds. Negative delays populate from frame 0.
const SPARKLE_BASE = [
  { left: '70%', bottom: '66%', size: 8,  negDelay: -0.0, drift: 'sm' },
  { left: '78%', bottom: '24%', size: 14, negDelay: -0.7, drift: 'md' },
  { left: '88%', bottom: '54%', size: 10, negDelay: -1.4, drift: 'lg' },
  { left: '82%', bottom: '82%', size: 6,  negDelay: -2.1, drift: 'sm' },
  { left: '64%', bottom: '46%', size: 12, negDelay: -2.8, drift: 'md' },
] as const

// Stable id used by IntersectionObserver; lives at module scope so
// the observer lookup is deterministic across re-mounts.
const HERO_BANNER_ID = 'hero-promo-banner'

// URL-param override: `?promo=A` for staff debugging. Backed by the
// server-driven `promoBannerEnabled` feature flag for kill-switch.
// Choice logic: explicit prop > URL param > archetype-driven default.
function resolveVariant(
  explicit: PromoBannerVariant | undefined,
  urlParam: string | undefined,
  hasArchetype: boolean,
): PromoBannerVariant {
  if (explicit) return explicit
  const allowed: PromoBannerVariant[] = ['A', 'B', 'C']
  if (urlParam && (allowed as string[]).includes(urlParam)) {
    return urlParam as PromoBannerVariant
  }
  return hasArchetype ? 'A' : 'C'
}

interface HeroPromoBannerProps {
  className?: string
  compact?: boolean
  variant?: PromoBannerVariant
  hasArchetype?: boolean
  /** When false, the banner is replaced with a quiet skeleton-only surface
   *  and no analytics fire. Use for kill-switch, onboarding, or hidden
   *  tabs. Defaults to true when not provided. */
  enabled?: boolean
  onCtaTap?: () => void
}

export default function HeroPromoBanner({
  className = '',
  compact = false,
  variant,
  hasArchetype = false,
  enabled = true,
  onCtaTap,
}: HeroPromoBannerProps) {
  // [webp, png] — Taro <Image> doesn't have a `<source>` element, so we
  // swap on error to the PNG URL. The state machine ensures we don't
  // loop back to WebP (which would just error again).
  const [resolvedSrc, setResolvedSrc] = useState(HERO_IMAGE_WEBP)
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const { shouldReduceMotion } = useMiniRevealMotion()
  const staggerMounted = useStaggerMount()
  const { isDegradation } = useDeviceTier()
  const router = useRouter()

  // Server-driven kill switch lives in the auth payload as
  // `user.features.promoBannerEnabled`. Defaults to true so the banner
  // is shown when the flag is missing (e.g., during boot before the
  // auth payload lands, or on pre-feature-flag accounts).
  // The discover page reads this from the auth user object and passes
  // it via the `enabled` prop.

  // Variant resolution: explicit prop > URL param > archetype-driven default.
  // A-variant is the primary "this weekend" pitch; C-variant nudges the
  // user toward the personality test when they don't yet have an archetype.
  const effectiveVariant: PromoBannerVariant = useMemo(
    () =>
      resolveVariant(
        variant,
        router?.params?.promo as string | undefined,
        hasArchetype,
      ),
    [variant, router?.params?.promo, hasArchetype],
  )

  const config = PROMO_VARIANTS[effectiveVariant]
  const isCtaDisabled = !onCtaTap
  const isBannerEnabled = enabled
  const animateIn = staggerMounted && !shouldReduceMotion && isBannerEnabled
  // Degradation tier + reduce motion both gate the infinite animations.
  // Degradation: keeps the entrance but kills the idle loops.
  const idleAnimationsEnabled = animateIn && !isDegradation
  const [isInView, setIsInView] = useState(true)

  // Fire impression analytics once on mount (only when shown)
  useEffect(() => {
    if (!isBannerEnabled) return
    discoverAnalytics.track(
      'promo_banner_impression',
      undefined,
      { variant: effectiveVariant, hasArchetype },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBannerEnabled, effectiveVariant])

  // Predictive preload: on first mount, try to get the PNG into the
  // WeChat image cache. Fire-and-forget; failures are silent. The PNG
  // is the fallback path so priming it ensures the swap is instant.
  useEffect(() => {
    if (!isBannerEnabled) return
    void preloadImage(HERO_IMAGE_PNG)
  }, [isBannerEnabled])

  // Pause infinite animations (sparkles, CTA breathe) when the banner
  // scrolls off-screen. Saves ~5 composited animations on every other
  // page once you scroll past discover. Best-effort cross-platform via
  // Taro's createIntersectionObserver — silently degrades to "always
  // in view" on older runtimes that lack the API.
  useEffect(() => {
    if (shouldReduceMotion || isDegradation) {
      setIsInView(true)
      return
    }
    let observer: ReturnType<typeof Taro.createIntersectionObserver> | null = null
    try {
      const page = Taro.getCurrentInstance()?.page as unknown as Record<string, unknown> | undefined
      if (!page) {
        setIsInView(true)
        return
      }
      observer = Taro.createIntersectionObserver(page, {
        thresholds: [0, 0.01],
      })
    } catch {
      setIsInView(true)
      return
    }
    if (!observer) {
      setIsInView(true)
      return
    }
    observer
      .relativeToViewport()
      .observe(`#${HERO_BANNER_ID}`, (res: any) => {
        setIsInView(Boolean(res?.intersectionRatio > 0))
      })
    return () => {
      try {
        observer?.disconnect?.()
      } catch {
        // Cleanup is best-effort; never throw in unmount.
      }
    }
  }, [shouldReduceMotion, isDegradation])

  const handleImageError = useCallback(() => {
    setImageState('error')
    discoverAnalytics.track(
      'promo_banner_image_error',
      undefined,
      { variant: effectiveVariant, retryCount },
    )
    setResolvedSrc((current) => (current === HERO_IMAGE_PNG ? current : HERO_IMAGE_PNG))
  }, [effectiveVariant, retryCount])

  const handleImageLoad = useCallback(() => {
    setImageState('loaded')
  }, [])

  // Manual retry: re-attempt the WebP. If we get back to WebP and it
  // fails again, the error handler falls through to PNG. Bounded by
  // retryCount so a user can't hammer the CDN.
  const handleRetry = useCallback(() => {
    if (retryCount >= 2) return
    setImageState('loading')
    setResolvedSrc(HERO_IMAGE_WEBP)
    setRetryCount((c) => c + 1)
    discoverAnalytics.track(
      'promo_banner_image_retry',
      undefined,
      { variant: effectiveVariant, retryCount },
    )
  }, [effectiveVariant, retryCount])

  const handleCtaTap = useCallback(() => {
    if (isCtaDisabled) return
    haptics('medium')
    discoverAnalytics.track(
      'promo_banner_cta_tap',
      undefined,
      { variant: effectiveVariant, hasArchetype },
    )
    onCtaTap?.()
  }, [isCtaDisabled, effectiveVariant, hasArchetype, onCtaTap])

  const sparkles = useMemo(
    () =>
      SPARKLE_BASE.map((s) => ({
        ...s,
        className: `hero-promo-banner__sparkle hero-promo-banner__sparkle-drift-${s.drift}`,
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

  // ── Kill switch / disabled state ───────────────────────────────────
  if (!isBannerEnabled) {
    return (
      <View
        id={HERO_BANNER_ID}
        className={[
          'hero-promo-banner',
          'hero-promo-banner--disabled',
          compact ? 'hero-promo-banner--compact' : '',
          className,
        ].filter(Boolean).join(' ')}
        aria-hidden='true'
      />
    )
  }

  const imageBlock = (
    <View className='hero-promo-banner__image-wrap'>
      {imageState === 'loading' && (
        <View
          className='hero-promo-banner__image-skeleton'
          aria-busy='true'
          aria-label='活动推荐图加载中'
        />
      )}
      {imageState === 'error' && (
        <View className='hero-promo-banner__image-fallback' aria-hidden='true'>
          {/* When the CDN image is unrecoverable, the gradient alone
              (already painted on __overlay) carries the surface. */}
        </View>
      )}
      <Image
        className={[
          'hero-promo-banner__image',
          imageState === 'loaded' ? 'hero-promo-banner__image--revealed' : '',
        ].filter(Boolean).join(' ')}
        src={resolvedSrc}
        mode='aspectFill'
        onError={handleImageError}
        onLoad={handleImageLoad}
        aria-hidden='true'
      />
      <View className='hero-promo-banner__overlay' aria-hidden='true' />
      {idleAnimationsEnabled && isInView && (
        <View className='hero-promo-banner__sparkles' aria-hidden='true'>
          {sparkles.map((s, i) => (
            <View key={i} className={s.className} style={s.style} />
          ))}
        </View>
      )}
    </View>
  )

  const copyBlock = (
    <View className='hero-promo-banner__content'>
      <View
        className={[
          'hero-promo-banner__copy-panel',
          animateIn ? 'stagger-in stagger-in--0' : '',
        ].filter(Boolean).join(' ')}
      >
        <Text
          className={[
            'hero-promo-banner__eyebrow',
            animateIn ? 'stagger-in stagger-in--1' : '',
          ].filter(Boolean).join(' ')}
        >
          {config.eyebrow}
        </Text>
        <Text
          className={[
            'hero-promo-banner__title',
            animateIn ? 'stagger-in stagger-in--2' : '',
          ].filter(Boolean).join(' ')}
        >
          {config.title}
        </Text>
        <Text
          className={[
            'hero-promo-banner__subtitle',
            animateIn ? 'stagger-in stagger-in--3' : '',
          ].filter(Boolean).join(' ')}
        >
          {config.subtitle}
        </Text>
        <View
          className={[
            'hero-promo-banner__cta',
            isCtaDisabled ? 'hero-promo-banner__cta--disabled' : '',
            animateIn ? 'stagger-in stagger-in--4' : '',
          ].filter(Boolean).join(' ')}
          onClick={handleCtaTap}
          hoverClass={isCtaDisabled ? '' : 'hero-promo-banner__cta--active'}
          role='button'
          aria-label={config.cta}
          aria-disabled={isCtaDisabled}
        >
          <Text className='hero-promo-banner__cta-text'>{config.cta}</Text>
          <View className='hero-promo-banner__cta-arrow' aria-hidden='true'>
            <Text className='hero-promo-banner__cta-arrow-glyph'>→</Text>
          </View>
        </View>
        {imageState === 'error' && retryCount < 2 && (
          <View
            className='hero-promo-banner__retry'
            onClick={handleRetry}
            hoverClass='hero-promo-banner__retry--active'
            role='button'
            aria-label='重新加载活动推荐图'
          >
            <Text className='hero-promo-banner__retry-text'>重新加载</Text>
          </View>
        )}
      </View>
    </View>
  )

  return (
    <View
      id={HERO_BANNER_ID}
      className={[
        'hero-promo-banner',
        compact ? 'hero-promo-banner--compact' : '',
        shouldReduceMotion ? 'hero-promo-banner--reduce-motion' : '',
        isDegradation ? 'hero-promo-banner--degradation' : '',
        className,
      ].filter(Boolean).join(' ')}
      role='region'
      aria-label={config.accessibilityLabel}
      aria-roledescription='活动推荐横幅'
      aria-live='polite'
    >
      <View className='hero-promo-banner__slide'>{imageBlock}{copyBlock}</View>
    </View>
  )
}
