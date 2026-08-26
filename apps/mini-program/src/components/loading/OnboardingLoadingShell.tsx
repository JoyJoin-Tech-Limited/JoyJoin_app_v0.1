import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import type { XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { localAsset } from '../../lib/utils/cdnAssets'
import { useChoreographedWait, CHOREOGRAPHED_SKIP_DELAY_MS } from '../../hooks/useChoreographedWait'
import Card from '../ui/Card'
import XiaoyueSpriteAnimator from '../mascot/XiaoyueSpriteAnimator'
import CelebrationSparkle from '../mascot/CelebrationSparkle'
import './OnboardingLoadingShell.scss'

/** Celebrate animation duration in ms. Parents should hold navigation for at
 *  least this long so the user sees the full animation before route transition. */
export const CELEBRATE_MIN_DISPLAY_MS = 1500

/**
 * Continuity bridge: how long parents hold the shell's mount after auth
 * resolves so the shell → content swap crossfades instead of flashing.
 * Pages using `continuity` should import this instead of defining their own.
 */
export const SHELL_EXIT_HOLD_MS = 180

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
   *  - fires onCelebrateReady after CELEBRATE_MIN_DISPLAY_MS
   *  Default false — preserves the 7+ existing call sites.
   */
  celebrate?: boolean
  /** Particle count for the celebration sparkle. Default 6. */
  sparkleCount?: number
  /** Fires after the celebrate animation's minimum display duration.
   *  Use this to gate navigation that would cut the celebration short. */
  onCelebrateReady?: () => void
  /** PR-7: override for the celebrate beat length (default
   *  CELEBRATE_MIN_DISPLAY_MS). The personality-test completing shell uses a
   *  shorter beat because the results page continues the same celebration
   *  visual into the slot anticipation (celebrate bridge). */
  celebrateMinDisplay?: number
  /**
   * Opt-in continuity bridge (2026-08-18): the shell fades in on mount with
   * the shared onboarding page-enter transition instead of popping in, and
   * fades out when the parent flips `exiting` before unmounting it — so a
   * shell → page-content swap never flashes a bare background between the
   * two onboarding pages. Default false — the 7+ existing call sites render
   * pixel-identical without these props.
   */
  continuity?: boolean
  /** True while the parent holds the shell through its exit fade. */
  exiting?: boolean
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
  onCelebrateReady,
  celebrateMinDisplay = CELEBRATE_MIN_DISPLAY_MS,
  continuity = false,
  exiting = false,
}: OnboardingLoadingShellProps) {
  const [imgSrc, setImgSrc] = useState(getXiaoyueExpressionAsset(xiaoyueExpression))
  const [settled, setSettled] = useState(false)

  // A4: settle animations after 6s. Skipped for `celebrate` to preserve the celebrate sprite + sparkle.
  useEffect(() => {
    if (celebrate) return
    const t = setTimeout(() => setSettled(true), 6000)
    return () => clearTimeout(t)
  }, [celebrate])

  // PR-7: celebrate beat runs through the shared choreographed-wait contract —
  // auto-fires onCelebrateReady at celebrateMinDisplay, and the shell becomes
  // tappable after the skip delay so users can move on sooner.
  const { canSkip: celebrateCanSkip, skip: skipCelebrate } = useChoreographedWait({
    active: celebrate && Boolean(onCelebrateReady),
    minDuration: celebrateMinDisplay,
    skipDelay: CHOREOGRAPHED_SKIP_DELAY_MS,
    onComplete: onCelebrateReady,
  })

  const resolvedTitle = celebrate ? CELEBRATE_TITLE : title
  const resolvedSubtitle = celebrate ? CELEBRATE_SUBTITLE : subtitle

  return (
    <View
      className={[
        'onboarding-loading-shell',
        settled ? 'onboarding-loading-shell--settled' : '',
        continuity ? 'onboarding-loading-shell--continuity' : '',
        continuity && exiting ? 'onboarding-loading-shell--continuity-exiting' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => {
        if (celebrate && celebrateCanSkip) skipCelebrate()
      }}
    >
      <View className='onboarding-loading-shell__content'>
        <Text className='onboarding-loading-shell__eyebrow'>{stepLabel}</Text>
        <Text className='onboarding-loading-shell__title'>{resolvedTitle}</Text>
        <Text className='onboarding-loading-shell__subtitle'>{resolvedSubtitle}</Text>

        <Card className='onboarding-loading-shell__card'>
          {celebrate ? (
            <View className='onboarding-loading-shell__mascot onboarding-loading-shell__mascot--celebrate'>
              <XiaoyueSpriteAnimator state='celebrate' size='240rpx' showGlow />
              <CelebrationSparkle count={sparkleCount} />
              {celebrateCanSkip && (
                <Text className='onboarding-loading-shell__skip-hint'>点击跳过</Text>
              )}
            </View>
          ) : (
            <>
              <Image
                className='onboarding-loading-shell__mascot'
                mode='aspectFit'
                src={imgSrc}
                onError={() => setImgSrc(localAsset('/assets/xiaoyue-expressions/xiaoyue-loading-system.webp'))}
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
