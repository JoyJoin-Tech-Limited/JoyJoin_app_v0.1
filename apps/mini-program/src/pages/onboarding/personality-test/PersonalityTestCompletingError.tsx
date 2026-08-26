import { View, Text, Image } from '@tarojs/components'
import { ONBOARDING_ERROR_STAGE_COPY } from '@shared/copy/errorBaselines'
import Button from '../../../components/ui/Button'
import { getXiaoyueExpressionAsset, PERSONALITY_TEST_XIAOYUE_EXPRESSION } from './visuals'

const COPY = ONBOARDING_ERROR_STAGE_COPY.completingError

interface PersonalityTestCompletingErrorProps {
  error: string
  onRetry: () => void
}

export default function PersonalityTestCompletingError({
  error,
  onRetry,
}: PersonalityTestCompletingErrorProps) {
  return (
    <View className='personality-test personality-test--intro'>
      <View className='personality-test__intro-shell'>
        <View className='personality-test__stage personality-test__stage--1'>
          <View className='personality-test__intro-hero'>
            <Image
              className='personality-test__intro-mascot'
              src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.errorState)}
              mode='aspectFit'
              style={{ width: '160rpx', height: '160rpx', marginBottom: '24rpx' }}
            />
            <Text className='personality-test__intro-title'>{COPY.title}</Text>
            <Text className='personality-test__intro-subtitle'>
              {typeof error === 'string' && error.includes('服务器')
                ? COPY.serverBusyBody
                : error || COPY.fallbackBody}
            </Text>
          </View>
        </View>
        <View className='personality-test__intro-footer'>
          <Button
            variant='brand'
            className='personality-test__start-btn'
            onClick={onRetry}
          >
            {COPY.retryLabel}
          </Button>
        </View>
      </View>
    </View>
  )
}
