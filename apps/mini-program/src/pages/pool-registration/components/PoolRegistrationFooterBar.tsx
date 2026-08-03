import { View } from '@tarojs/components'
import Button from '../../../components/ui/Button'

interface PoolRegistrationFooterBarProps {
  step: number
  eventType: string
  advanceLabel: string
  advanceDisabled: boolean
  isRegistering: boolean
  onAdvance: () => void
  onBack: () => void
  onRegister: () => void
}

export default function PoolRegistrationFooterBar({
  step,
  eventType,
  advanceLabel,
  advanceDisabled,
  isRegistering,
  onAdvance,
  onBack,
  onRegister,
}: PoolRegistrationFooterBarProps) {
  return (
    <View className='pool-reg__footer'>
      {step === 0 ? (
        <Button
          variant='brand'
          className='pool-reg__submit pool-reg__submit--ceremony'
          onClick={onAdvance}
          hoverClass='pool-reg__submit--active'
        >
          {eventType ? `入座这场${eventType}` : '开始我的报名'}
        </Button>
      ) : (
        <View className='pool-reg__footer-actions'>
          <Button variant='secondary' className='pool-reg__footer-btn' onClick={onBack}>
            上一步
          </Button>
          <Button
            variant='primary'
            className='pool-reg__footer-btn pool-reg__footer-btn--primary'
            onClick={step === 3 ? onRegister : onAdvance}
            disabled={advanceDisabled}
            loading={step === 3 && isRegistering}
          >
            {advanceLabel}
          </Button>
        </View>
      )}
    </View>
  )
}
