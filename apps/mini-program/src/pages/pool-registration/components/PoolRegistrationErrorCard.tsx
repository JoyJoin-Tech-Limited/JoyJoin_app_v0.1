import { View, Text } from '@tarojs/components'
import StatusCard from '../../../components/ui/StatusCard'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'

interface PoolRegistrationErrorCardProps {
  error: string
  isRegistering: boolean
  reduceMotion: boolean
  onRetry: () => void
}

export default function PoolRegistrationErrorCard({
  error,
  isRegistering,
  reduceMotion,
  onRetry,
}: PoolRegistrationErrorCardProps) {
  return (
    <View
      className={`pool-reg__error-wrap${reduceMotion ? ' pool-reg__error-wrap--reduce-motion' : ''}`}
      role='alert'
      aria-live='polite'
      id='pool-reg-error-anchor'
    >
      <StatusCard
        tone='error'
        title='提交没成功'
        description={error}
        className='pool-reg__error-card'
        heroSrc={getXiaoyueExpressionAsset('actionFailure')}
        action={{
          label: isRegistering ? '提交中…' : '重新提交',
          onClick: onRetry,
          variant: 'primary',
          disabled: isRegistering,
          loading: isRegistering,
        }}
        footer={<Text className='pool-reg__error-helper'>别担心，悦仔帮你再试一次就好～</Text>}
      />
    </View>
  )
}
