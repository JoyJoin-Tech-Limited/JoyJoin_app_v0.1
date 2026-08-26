import { Image, Text, View } from '@tarojs/components'
import { ONBOARDING_ERROR_STAGE_COPY } from '@shared/copy/errorBaselines'
import Button from '../../../../components/ui/Button'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

const COPY = ONBOARDING_ERROR_STAGE_COPY.resultsError

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
        {isOffline ? COPY.offlineTitle : COPY.interruptedTitle}
      </Text>
      <Text className='personality-results__state-copy'>
        {isOffline
          ? COPY.offlineBody
          : (errorMessage || COPY.fallbackBody)}
      </Text>
      <Text className='personality-results__state-hint'>
        {isOffline
          ? COPY.offlineHint
          : COPY.retryHint}
      </Text>
      <View className='personality-results__stack-actions'>
        <View className='personality-results__retry-with-tooltip'>
          <Button onClick={onRetry} disabled={isFetchingResult} loading={isFetchingResult}>
            {isFetchingResult ? COPY.retryBusyLabel : COPY.retryLabel}
          </Button>
          <Text className='personality-results__retry-tooltip'>
            {COPY.retryTooltip}
          </Text>
        </View>
        <Button variant='secondary' onClick={onRestart}>{COPY.restartLabel}</Button>
      </View>
    </View>
  )
}
