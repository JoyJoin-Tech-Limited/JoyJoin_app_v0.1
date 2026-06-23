import { View, Text, Image } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import { getXiaoyueExpressionAsset, PERSONALITY_TEST_XIAOYUE_EXPRESSION } from './visuals'

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
            <Text className='personality-test__intro-title'>同步遇到小状况</Text>
            <Text className='personality-test__intro-subtitle'>
              {typeof error === 'string' && error.includes('服务器')
                ? '服务器开小差了，稍后再试'
                : error || '悦仔马上帮你重试~'}
            </Text>
          </View>
        </View>
        <View className='personality-test__intro-footer'>
          <Button
            variant='brand'
            className='personality-test__start-btn'
            onClick={onRetry}
          >
            重新打开结果
          </Button>
        </View>
      </View>
    </View>
  )
}
