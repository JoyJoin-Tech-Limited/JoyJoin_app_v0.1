import { useEffect, useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { SingleTestBot } from '@shared/socialIcebreaker'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { haptics } from '../../lib/utils/haptics'
import Button from '../ui/Button'

import './TestModeDisclosure.scss'

interface TestModeDisclosureProps {
  /** Client-safe bot roster returned by the server for single-test sessions. */
  bots?: SingleTestBot[]
  /** Current social session id for analytics. */
  socialSessionId?: string
  /** Icebreaker session id for analytics. */
  icebreakerSessionId?: string
  /** Called when the user taps the primary CTA to continue to recap. */
  onContinue: () => void
  /** Called when the user taps the CTA while an error is displayed. Defaults to onContinue if omitted. */
  onRetry?: () => void
  /** True while the advance action is in flight. */
  isLoading?: boolean
  /** Optional inline error message; when present the CTA becomes a retry action. */
  error?: string | null
}

/**
 * Single-test mode disclosure.
 *
 * Warm, on-brand explanation that single-test sessions only preview the warmup
 * and skip the multiplayer phases. Shown before advancing to recap so the
 * previewer understands why the session is short.
 */
export function TestModeDisclosure({
  bots,
  socialSessionId,
  icebreakerSessionId,
  onContinue,
  onRetry,
  isLoading,
  error,
}: TestModeDisclosureProps) {
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const deviceTier = useDeviceTier()
  const motionEnabled = !reduceMotion && !deviceTier.isDegradation
  const [showError, setShowError] = useState(false)

  // Reset the local error reveal whenever the external error clears.
  useEffect(() => {
    if (!error) setShowError(false)
  }, [error])

  useEffect(() => {
    socialIcebreakerAnalytics.track(
      'icebreaker_test_mode_disclosure_rendered',
      socialSessionId,
      icebreakerSessionId,
      undefined,
      {
        botCount: bots?.length ?? 0,
        hasError: Boolean(error),
        reduceMotion,
        isDegradationTier: deviceTier.isDegradation,
      },
    )
  }, [bots?.length, socialSessionId, icebreakerSessionId, error, reduceMotion, deviceTier.isDegradation])

  const isErrorState = Boolean(error)
  const ctaLabel = isLoading ? '加载中' : isErrorState ? '重试' : '查看总结'

  const handleContinue = () => {
    haptics('medium')
    if (isErrorState) {
      setShowError(false)
      ;(onRetry ?? onContinue)()
    } else {
      onContinue()
    }
  }

  return (
    <View
      className={`test-mode-disclosure ${motionEnabled ? '' : 'test-mode-disclosure--static'}`}
      role='dialog'
      aria-modal='true'
      aria-label='测试模式说明'
    >
      <View className='test-mode-disclosure__card'>
      <View className='test-mode-disclosure__mascot-wrap' role='img' aria-label='小悦'>
        <Image
          className='test-mode-disclosure__mascot'
          src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
          mode='aspectFit'
          lazyLoad
          aria-hidden='true'
        />
      </View>
        <View className='test-mode-disclosure__icon' aria-hidden='true'>
          <Text className='test-mode-disclosure__icon-text'>测试</Text>
        </View>
        <Text className='test-mode-disclosure__title'>测试模式：多人环节已跳过</Text>
        <Text className='test-mode-disclosure__body'>
          在单人调试局中，只有热身话题卡可以预览；完整游戏环节需要至少 3 位真实玩家一起参与。
        </Text>

        {bots && bots.length > 0 && (
          <View className='test-mode-disclosure__roster'>
            <Text className='test-mode-disclosure__roster-label'>本场调试伙伴</Text>
            <View className='test-mode-disclosure__roster-list' role='list'>
              {bots.map((bot) => (
                <View key={bot.botId} className='test-mode-disclosure__bot-chip' role='listitem'>
                  <View className='test-mode-disclosure__bot-dot' aria-hidden='true' />
                  <Text className='test-mode-disclosure__bot-name'>{bot.displayName}</Text>
                  <Text className='test-mode-disclosure__bot-archetype'>{bot.archetype}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {isErrorState && (
          <View className='test-mode-disclosure__error' role='alert' aria-live='polite'>
            <Text className='test-mode-disclosure__error-text'>
              {error ?? '继续时遇到小问题，点重试再试一次'}
            </Text>
          </View>
        )}

        <Button
          variant='primary'
          className='test-mode-disclosure__cta'
          onClick={handleContinue}
          loading={isLoading}
          disabled={isLoading}
        >
          {ctaLabel}
        </Button>
      </View>
    </View>
  )
}

export default TestModeDisclosure
