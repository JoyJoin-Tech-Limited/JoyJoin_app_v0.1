import { useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import type { SingleTestBot } from '@shared/socialIcebreaker'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { haptics } from '../../lib/utils/haptics'
import Button from '../ui/Button'
import JoyJoinIcon from '../ui/JoyJoinIcon'

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
  /** True while the advance action is in flight. */
  isLoading?: boolean
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
  isLoading,
}: TestModeDisclosureProps) {
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])
  const deviceTier = useDeviceTier()
  const motionEnabled = !reduceMotion && !deviceTier.isDegradation

  useEffect(() => {
    socialIcebreakerAnalytics.track(
      'icebreaker_test_mode_disclosure_rendered',
      socialSessionId,
      icebreakerSessionId,
      undefined,
      {
        botCount: bots?.length ?? 0,
        reduceMotion,
        isDegradationTier: deviceTier.isDegradation,
      },
    )
  }, [bots?.length, socialSessionId, icebreakerSessionId, reduceMotion, deviceTier.isDegradation])

  const handleContinue = () => {
    haptics('medium')
    onContinue()
  }

  return (
    <View
      className={`test-mode-disclosure ${motionEnabled ? '' : 'test-mode-disclosure--static'}`}
      role='dialog'
      aria-modal='true'
      aria-label='测试模式说明'
    >
      <View className='test-mode-disclosure__card'>
        <View className='test-mode-disclosure__icon'>
          <JoyJoinIcon emoji='🧪' size={80} />
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
                  <JoyJoinIcon emoji='🤖' size={28} />
                  <Text className='test-mode-disclosure__bot-name'>{bot.displayName}</Text>
                  <Text className='test-mode-disclosure__bot-archetype'>{bot.archetype}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Button
          variant='primary'
          className='test-mode-disclosure__cta'
          onClick={handleContinue}
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? '加载中' : '查看总结'}
        </Button>
      </View>
    </View>
  )
}

export default TestModeDisclosure
