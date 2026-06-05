import { Image, Text, View } from '@tarojs/components'
import Button from '../../../../components/ui/Button'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

interface ErrorStageProps {
  errorMessage?: string
  isFetchingResult: boolean
  isOffline?: boolean
  onRetry: () => void
  onRestart: () => void
}

export default function ErrorStage({ errorMessage, isFetchingResult, isOffline = false, onRetry, onRestart }: ErrorStageProps) {
  return (
    <View className='personality-results__centered-state' role='alert' aria-live='polite'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.errorState)}
      />
      <Text className='personality-results__state-title'>
        {isOffline ? '网络好像断开了' : '揭晓过程被打断了'}
      </Text>
      <Text className='personality-results__state-copy'>
        {isOffline
          ? '请检查网络连接后点击重试，结果已经保存在本地。'
          : (errorMessage || '同步遇到小状况，再试一次就好~')}
      </Text>
      <Text className='personality-results__state-hint'>
        {isOffline
          ? '恢复网络后，点「再试试」就能继续揭晓。'
          : '点「再试试」会重新获取结果，不会重复答题。'}
      </Text>
      <View className='personality-results__stack-actions'>
        <View className='personality-results__retry-with-tooltip'>
          <Button onClick={onRetry} disabled={isFetchingResult} loading={isFetchingResult}>
            {isFetchingResult ? '正在同步…' : '再试试'}
          </Button>
          <Text className='personality-results__retry-tooltip'>
            网络波动时可能需要多试一次
          </Text>
        </View>
        <Button variant='secondary' onClick={onRestart}>重新测试一次</Button>
      </View>
    </View>
  )
}
