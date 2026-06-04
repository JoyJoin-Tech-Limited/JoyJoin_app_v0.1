import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { localAsset } from '../../lib/utils/cdnAssets'
import Card from '../ui/Card'
import XiaoyueSpriteAnimator from '../mascot/XiaoyueSpriteAnimator'
import CelebrationSparkle from '../mascot/CelebrationSparkle'
import './OnboardingLoadingShell.scss'

interface OnboardingLoadingShellProps {
  stepLabel: string
  title: string
  subtitle: string
  hint?: string
  /** Defaults to system-loading / thinking pose (`loadingSystem`). */
  xiaoyueExpression?: XiaoyueExpressionId
  /** Opt-in celebration beat. When true:
   *  - mascot renders as XiaoyueSpriteAnimator in `celebrate` state (overrides `xiaoyueExpression`)
   *  - title is overridden to the completion copy
   *  - subtitle is overridden to the completion copy
   *  - the orbit dots and skeleton lines are hidden
   *  - <CelebrationSparkle count={6} /> is overlaid on the card
   *  - the 6s settled-timer that disables animations is disabled
   *  Default false — preserves the 7+ existing call sites.
   */
  celebrate?: boolean
  /** Particle count for the celebration sparkle. Default 6. */
  sparkleCount?: number
}

const CELEBRATE_TITLE = '全部收到啦 — 让我开始翻你的命格'
const CELEBRATE_SUBTITLE = '看到的只是最近的自己，不是标签。'

export default function OnboardingLoadingShell({
  stepLabel,
  title,
  subtitle,
  hint = `${DEFAULT_MASCOT_DISPLAY_NAME}正在把这一页铺好，马上就能继续。`,
  xiaoyueExpression = 'loadingSystem',
  celebrate = false,
  sparkleCount = 6,
}: OnboardingLoadingShellProps) {
  const [imgSrc, setImgSrc] = useState(getXiaoyueExpressionAsset(xiaoyueExpression))
  const [settled, setSettled] = useState(false)

  // A4: settle animations after 6s. Skipped for `celebrate` to preserve the celebrate sprite + sparkle.
  useEffect(() => {
    if (celebrate) return
    const t = setTimeout(() => setSettled(true), 6000)
    return () => clearTimeout(t)
  }, [celebrate])

  const resolvedTitle = celebrate ? CELEBRATE_TITLE : title
  const resolvedSubtitle = celebrate ? CELEBRATE_SUBTITLE : subtitle

  return (
    <View className={`onboarding-loading-shell ${settled ? 'onboarding-loading-shell--settled' : ''}`}>
      <View className='onboarding-loading-shell__content'>
        <Text className='onboarding-loading-shell__eyebrow'>{stepLabel}</Text>
        <Text className='onboarding-loading-shell__title'>{resolvedTitle}</Text>
        <Text className='onboarding-loading-shell__subtitle'>{resolvedSubtitle}</Text>

        <Card className='onboarding-loading-shell__card'>
          {celebrate ? (
            <View className='onboarding-loading-shell__mascot onboarding-loading-shell__mascot--celebrate'>
              <XiaoyueSpriteAnimator state='celebrate' size='240rpx' showGlow />
              <CelebrationSparkle count={sparkleCount} />
            </View>
          ) : (
            <>
              <Image
                className='onboarding-loading-shell__mascot'
                mode='aspectFit'
                src={imgSrc}
                onError={() => setImgSrc(localAsset('/assets/xiaoyue-expressions/xiaoyue-loading-system.png'))}
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
            </>
          )}
        </Card>
      </View>
    </View>
  )
}
