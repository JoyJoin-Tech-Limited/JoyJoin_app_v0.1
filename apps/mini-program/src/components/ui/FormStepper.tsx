import { View, Text } from '@tarojs/components'
import Button from './Button'
import './FormStepper.scss'

export interface FormStepperProps {
  /** Current step index (0-based) */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Step labels for each step */
  stepLabels?: string[]
  /** Called when user taps back */
  onBack?: () => void
  /** Whether back button is visible */
  showBack?: boolean
  /** Optional custom header content */
  headerContent?: React.ReactNode
}

/**
 * FormStepper — viewport-locked step header for onboarding wizards.
 *
 * Pixel specs (8rpx rhythm):
 * - Header height: 112rpx
 * - Progress bar height: 6rpx
 * - Progress bar radius: 3rpx
 * - Step label: 24rpx, medium weight, muted color
 * - Title: 40rpx, bold, Alimama display face
 * - Back button: 48rpx tap target
 */
export default function FormStepper({
  currentStep,
  totalSteps,
  stepLabels = [],
  onBack,
  showBack = true,
  headerContent,
}: FormStepperProps) {
  const progress = Math.min(100, Math.max(0, ((currentStep + 1) / totalSteps) * 100))
  const label = stepLabels[currentStep] ?? `步骤 ${currentStep + 1}`

  return (
    <View className='form-stepper'>
      {/* Progress bar */}
      <View className='form-stepper__progress-track'>
        <View
          className='form-stepper__progress-fill'
          style={{ width: `${progress}%` }}
        />
      </View>

      {/* Header row */}
      <View className='form-stepper__header'>
        {showBack && onBack && currentStep > 0 ? (
          <Button
            variant='secondary'
            className='form-stepper__back'
            onClick={onBack}
          >
            <Text className='form-stepper__back-icon'>‹</Text>
          </Button>
        ) : (
          <View className='form-stepper__back-placeholder' />
        )}

        <View className='form-stepper__meta'>
          <Text className='form-stepper__step-label'>
            {`步骤 ${currentStep + 1} / ${totalSteps}`}
          </Text>
        </View>

        <View className='form-stepper__back-placeholder' />
      </View>

      {/* Step title */}
      <View className='form-stepper__title-wrap'>
        <Text className='form-stepper__title'>{label}</Text>
      </View>

      {headerContent}
    </View>
  )
}
