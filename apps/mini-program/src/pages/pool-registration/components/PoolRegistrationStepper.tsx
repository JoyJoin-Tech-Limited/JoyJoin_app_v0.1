import { View } from '@tarojs/components'
import StepPill from './StepPill'

interface PoolRegistrationStepperProps {
  step: number
  labels: string[]
}

export default function PoolRegistrationStepper({ step, labels }: PoolRegistrationStepperProps) {
  return (
    <View className='pool-reg__stepper' role='list' aria-label='报名步骤'>
      {labels.map((label, index) => {
        const stepIndex = index + 1
        return (
          <StepPill
            key={label}
            index={stepIndex}
            label={label}
            active={step === stepIndex}
            complete={step > stepIndex}
          />
        )
      })}
    </View>
  )
}
