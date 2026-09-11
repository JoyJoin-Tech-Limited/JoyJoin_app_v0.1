import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import { localAsset } from '../../../lib/utils/cdnAssets'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from './visuals'

interface PersonalityTestReturnInterstitialProps {
  onViewResults: () => void
  onRestart: () => void
}

/**
 * Post-onboarding retake interstitial (2026-09-11).
 *
 * Replaces the silent `redirectTo(results)` bounce for users who already hold
 * an archetype and are fully past onboarding: previously they never saw the
 * questions and believed the test kept re-assigning the same archetype. The
 * interstitial offers an explicit choice — review the existing result or
 * re-enter the test in restart mode.
 *
 * Mid-onboarding users never see this surface (the page keeps the legacy
 * instant redirect for any in-flight nextStep).
 *
 * Styles live in the page SCSS (`index.scss`, `personality-test__return-*`)
 * per the subpackage WXSS guard — this component deliberately carries no
 * TSX-side SCSS import (XiaoyueInlineError pattern).
 */
export default function PersonalityTestReturnInterstitial({
  onViewResults,
  onRestart,
}: PersonalityTestReturnInterstitialProps) {
  // CDN-primary mascot expression with the bundled local fallback — same
  // pattern as OnboardingLoadingShell.
  const [mascotSrc, setMascotSrc] = useState(
    getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach),
  )

  return (
    <View className='personality-test personality-test--return'>
      <View className='personality-test__return-shell'>
        <View className='personality-test__return-mascot'>
          <Image
            className='personality-test__return-mascot-img'
            mode='aspectFit'
            src={mascotSrc}
            lazyLoad={false}
            onError={() =>
              setMascotSrc(localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp'))
            }
          />
        </View>
        <Text className='personality-test__return-title'>你已经解锁了氛围命格</Text>
        <Text className='personality-test__return-body'>
          可以直接回看结果，也可以重新测一次。
        </Text>
        <View className='personality-test__return-actions'>
          <Button
            variant='brand'
            className='personality-test__return-primary'
            hoverClass='personality-test__return-primary--hover'
            onClick={onViewResults}
          >
            查看我的结果
          </Button>
          <View
            className='personality-test__return-secondary'
            hoverClass='personality-test__return-secondary--hover'
            onClick={onRestart}
          >
            <Text className='personality-test__return-secondary-text'>重新测一次</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
