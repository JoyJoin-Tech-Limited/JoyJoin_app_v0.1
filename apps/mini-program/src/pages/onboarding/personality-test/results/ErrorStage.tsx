import { Image, Text, View } from '@tarojs/components'
import Button from '../../../../components/ui/Button'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

interface ErrorStageProps {
  errorMessage?: string
  isFetchingResult: boolean
  onRetry: () => void
  onRestart: () => void
}

export default function ErrorStage({ errorMessage, isFetchingResult, onRetry, onRestart }: ErrorStageProps) {
  return (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.errorState)}
      />
      <Text className='personality-results__state-title'>揭晓过程被打断了</Text>
      <Text className='personality-results__state-copy'>
        {errorMessage || '结果同步出了点问题，重新试一次通常就能恢复。'}
      </Text>
      <View className='personality-results__stack-actions'>
        <Button onClick={onRetry} disabled={isFetchingResult} loading={isFetchingResult}>
          {isFetchingResult ? '正在重新同步…' : '重试揭晓'}
        </Button>
        <Button variant='secondary' onClick={onRestart}>重新测试一次</Button>
      </View>
    </View>
  )
}
