import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
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
    imageSrc: '/assets/promo/banner-ai-match-calculated.webp',
  },
  {
    title: 'AI 匹配：帮你遇见同频的人',
    subtitle: '同频的人 · 和你合拍的社交伙伴',
    imageSrc: '/assets/promo/banner-ai-match-same-frequency.webp',
  },
  {
    title: 'AI 匹配：帮你遇见懂你的人',
    subtitle: '懂你的人 · 更懂你的线下聚会',
    imageSrc: '/assets/promo/banner-ai-match-understands-you.webp',
  },
] as const

export default function AiMatchPromoCarousel({
  className = '',
  compact = false,
}: AiMatchPromoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

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
          const imageBlock = (
            <View className='ai-match-promo-carousel__image-wrap'>
              <View className='ai-match-promo-carousel__glow' />
              <Image
                className='ai-match-promo-carousel__image'
                src={slide.imageSrc}
                mode='aspectFit'
                lazyLoad
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
