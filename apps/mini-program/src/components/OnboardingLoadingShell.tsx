import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { XiaoyueExpressionId } from '../lib/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import Card from './Card'
import './OnboardingLoadingShell.scss'

interface OnboardingLoadingShellProps {
  stepLabel: string
  title: string
  subtitle: string
  hint?: string
  /** Defaults to system-loading / thinking pose (`loadingSystem`). */
  xiaoyueExpression?: XiaoyueExpressionId
}

export default function OnboardingLoadingShell({
  stepLabel,
  title,
  subtitle,
  hint = `${DEFAULT_MASCOT_DISPLAY_NAME}正在把这一页铺好，马上就能继续。`,
  xiaoyueExpression = 'loadingSystem',
}: OnboardingLoadingShellProps) {
  const [imgSrc, setImgSrc] = useState(getXiaoyueExpressionAsset(xiaoyueExpression))
  const [settled, setSettled] = useState(false)

  // A4: settle animations after 6s
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <View className={`onboarding-loading-shell ${settled ? 'onboarding-loading-shell--settled' : ''}`}>
      <View className='onboarding-loading-shell__content'>
        <Text className='onboarding-loading-shell__eyebrow'>{stepLabel}</Text>
        <Text className='onboarding-loading-shell__title'>{title}</Text>
        <Text className='onboarding-loading-shell__subtitle'>{subtitle}</Text>

        <Card className='onboarding-loading-shell__card'>
          <Image
            className='onboarding-loading-shell__mascot'
            mode='aspectFit'
            src={imgSrc}
            onError={() => setImgSrc('/assets/personality/xiaoyue/xiaoyue-loading-system.webp')}
          />
          <View className='onboarding-loading-shell__orbit'>
            {[1, 2, 3].map((item) => (
              <View
                key={item}
                className={`onboarding-loading-shell__dot onboarding-loading-shell__dot--${item}`}
              />
            ))}
          </View>

          <Text className='onboarding-loading-shell__hint'>{hint}</Text>

          <View className='onboarding-loading-shell__skeleton'>
            <View className='onboarding-loading-shell__line onboarding-loading-shell__line--wide' />
            <View className='onboarding-loading-shell__line onboarding-loading-shell__line--mid' />
            <View className='onboarding-loading-shell__line onboarding-loading-shell__line--short' />
          </View>
        </Card>
      </View>
    </View>
  )
}
