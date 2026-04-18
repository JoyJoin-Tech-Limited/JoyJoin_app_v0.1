import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import './AiMatchPromoCarousel.scss'

interface AiMatchPromoCarouselProps {
  className?: string
  compact?: boolean
}

const PROMO_SLIDES = [
  {
    title: 'AI 匹配：帮你算好遇见什么样的人',
    subtitle: '算好的人 · 用数据找到更合适的缘分',
    imageSrc: '/assets/promo/banner-ai-match-calculated.png',
  },
  {
    title: 'AI 匹配：帮你遇见同频的人',
    subtitle: '同频的人 · 和你合拍的社交伙伴',
    imageSrc: '/assets/promo/banner-ai-match-same-frequency.png',
  },
  {
    title: 'AI 匹配：帮你遇见懂你的人',
    subtitle: '懂你的人 · 更懂你的线下聚会',
    imageSrc: '/assets/promo/banner-ai-match-understands-you.png',
  },
] as const

function webpFromPng(pngPath: string): string {
  return pngPath.replace(/\.png$/i, '.webp')
}

function buildInitialResolvedSources(): Record<string, string> {
  const next: Record<string, string> = {}
  for (const slide of PROMO_SLIDES) {
    next[slide.imageSrc] = webpFromPng(slide.imageSrc)
  }
  return next
}

export default function AiMatchPromoCarousel({
  className = '',
  compact = false,
}: AiMatchPromoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [resolvedSrcByPng, setResolvedSrcByPng] = useState(buildInitialResolvedSources)
  const prefersReducedMotion = usePrefersReducedMotion()

  const handleImageError = useCallback((pngPath: string) => {
    setResolvedSrcByPng((current) => {
      if (current[pngPath] === pngPath) {
        return current
      }
      return { ...current, [pngPath]: pngPath }
    })
  }, [])

  const autoplayEnabled = !prefersReducedMotion
  const transitionMs = prefersReducedMotion ? 0 : 420

  const swiperKey = useMemo(
    () => `${autoplayEnabled ? 'auto' : 'still'}-${compact ? 'c' : 'full'}`,
    [autoplayEnabled, compact],
  )

  return (
    <View
      className={[
        'ai-match-promo-carousel',
        compact ? 'ai-match-promo-carousel--compact' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <Swiper
        key={swiperKey}
        className='ai-match-promo-carousel__swiper'
        circular
        autoplay={autoplayEnabled}
        interval={4200}
        duration={transitionMs}
        indicatorDots={false}
        onChange={(event) => setActiveIndex(event.detail.current)}
      >
        {PROMO_SLIDES.map((slide) => {
          const imageSrc = resolvedSrcByPng[slide.imageSrc] ?? slide.imageSrc

          const imageBlock = (
            <View className='ai-match-promo-carousel__image-wrap'>
              <View className='ai-match-promo-carousel__glow' />
              <Image
                className='ai-match-promo-carousel__image'
                src={imageSrc}
                mode='aspectFit'
                lazyLoad
                onError={() => handleImageError(slide.imageSrc)}
              />
            </View>
          )

          const copyBlock = (
            <View className='ai-match-promo-carousel__content'>
              <Text className='ai-match-promo-carousel__eyebrow'>AI 匹配</Text>
              <Text className='ai-match-promo-carousel__title'>{slide.title}</Text>
              <Text className='ai-match-promo-carousel__subtitle'>{slide.subtitle}</Text>
            </View>
          )

          return (
            <SwiperItem key={slide.imageSrc}>
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
            </SwiperItem>
          )
        })}
      </Swiper>

      <View className='ai-match-promo-carousel__indicators'>
        {PROMO_SLIDES.map((slide, index) => (
          <View
            key={slide.imageSrc}
            className={[
              'ai-match-promo-carousel__indicator',
              index === activeIndex ? 'ai-match-promo-carousel__indicator--active' : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </View>
    </View>
  )
}
