import { Image, Text, View } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import { cdnAsset } from '../lib/utils/cdnAssets'
import { useMiniRevealMotion } from '../hooks/useMiniRevealMotion'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import { haptics } from '../lib/utils/haptics'
import './AiMatchPromoCarousel.scss'

export type PromoBannerVariant = 'A' | 'B' | 'C'

interface PromoVariantConfig {
  eyebrow: string
  title: string
  subtitle: string
  cta: string
}

const PROMO_VARIANTS: Record<PromoBannerVariant, PromoVariantConfig> = {
  A: {
    eyebrow: '本周推荐',
    title: '这周末，会遇见谁？',
    subtitle: '已有 12 人报名 · 最后 3 席',
    cta: '查看活动详情',
  },
  B: {
    eyebrow: '专属匹配',
    title: '3 种社交人格已匹配',
    subtitle: '你的同类正在附近聚会',
    cta: '看看是谁',
  },
  C: {
    eyebrow: '先测再玩',
    title: '30 秒测出你的社交人格',
    subtitle: '更精准的聚会推荐',
    cta: '开始测试',
  },
} as const

const HERO_IMAGE_SRC = cdnAsset('/assets/promo/banner-hero-lovart-v1.webp')

function webpFromPng(pngPath: string): string {
  return pngPath.replace(/\.png$/i, '.webp')
}

interface AiMatchPromoCarouselProps {
  className?: string
  compact?: boolean
  variant?: PromoBannerVariant
  hasArchetype?: boolean
  onCtaTap?: () => void
}

export default function AiMatchPromoCarousel({
  className = '',
  compact = false,
  variant = 'A',
  hasArchetype = false,
  onCtaTap,
}: AiMatchPromoCarouselProps) {
  const [resolvedSrc, setResolvedSrc] = useState(webpFromPng(HERO_IMAGE_SRC))
  const [imageLoaded, setImageLoaded] = useState(false)
  const { shouldReduceMotion } = useMiniRevealMotion()

  const effectiveVariant: PromoBannerVariant =
    variant && variant in PROMO_VARIANTS ? variant : 'A'
  const config = PROMO_VARIANTS[effectiveVariant]
  const isCtaDisabled = !onCtaTap

  // Fire impression analytics once on mount
  useEffect(() => {
    discoverAnalytics.track(
      'promo_banner_impression',
      undefined,
      { variant: effectiveVariant, hasArchetype },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleImageError = useCallback(() => {
    setResolvedSrc((current) => {
      if (current === HERO_IMAGE_SRC) return current
      return HERO_IMAGE_SRC
    })
  }, [])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

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

  const imageBlock = (
    <View className='ai-match-promo-carousel__image-wrap'>
      {!imageLoaded && (
        <View className='ai-match-promo-carousel__image-skeleton' />
      )}
      <Image
        className='ai-match-promo-carousel__image'
        src={resolvedSrc}
        mode='aspectFit'
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </View>
  )

  const copyBlock = (
    <View className='ai-match-promo-carousel__content'>
      <Text className='ai-match-promo-carousel__eyebrow'>{config.eyebrow}</Text>
      <Text className='ai-match-promo-carousel__title'>{config.title}</Text>
      <Text className='ai-match-promo-carousel__subtitle'>{config.subtitle}</Text>
      <View
        className={[
          'ai-match-promo-carousel__cta',
          isCtaDisabled ? 'ai-match-promo-carousel__cta--disabled' : '',
        ].filter(Boolean).join(' ')}
        onClick={handleCtaTap}
        hoverClass={isCtaDisabled ? '' : 'ai-match-promo-carousel__cta--active'}
        role='button'
        aria-label={config.cta}
        aria-disabled={isCtaDisabled}
      >
        <Text className='ai-match-promo-carousel__cta-text'>{config.cta}</Text>
      </View>
    </View>
  )

  return (
    <View
      className={[
        'ai-match-promo-carousel',
        compact ? 'ai-match-promo-carousel--compact' : '',
        shouldReduceMotion ? 'ai-match-promo-carousel--reduce-motion' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <View className='ai-match-promo-carousel__slide'>
        {compact ? (
          <>
            {copyBlock}
            {imageBlock}
          </>
        ) : (
          <>
            {imageBlock}
            {copyBlock}
          </>
        )}
      </View>
    </View>
  )
}
