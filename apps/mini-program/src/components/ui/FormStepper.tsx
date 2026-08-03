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
  /** Archetype accent for filled segments (Bet 1 tinted chrome); brand
      primary when absent. */
  accentColor?: string
}

/**
 * FormStepper — viewport-locked step header for onboarding wizards.
 *
 * Mechanical segmented progress bar design:
 * - Thick segmented blocks (12rpx) that fill with solid brand color
 * - Step label integrated above the bar, centered absolutely
 * - Back button anchored to the left at 32rpx
 * - Each segment represents one step for tangible progress feel
 */
export default function FormStepper({
  currentStep,
  totalSteps,
  stepLabels = [],
  onBack,
  showBack = true,
  headerContent,
  accentColor,
}: FormStepperProps) {
  const label = stepLabels[currentStep] ?? `步骤 ${currentStep + 1}`

  return (
    <View className='form-stepper'>
      {/* Header row: back button + step status unit */}
      <View className='form-stepper__header'>
        {/* Back button — anchored left at 32rpx */}
        {showBack && onBack && currentStep > 0 ? (
          <Button
            variant='secondary'
            className='form-stepper__back'
            onClick={onBack}
          >
            <Text className='form-stepper__back-icon'>‹</Text>
          </Button>
        ) : null}

        {/* Step status unit: label + segmented bar, absolutely centered */}
        <View className='form-stepper__status-unit'>
          <Text className='form-stepper__step-label'>
            {`步骤 ${currentStep + 1} / ${totalSteps}`}
          </Text>
          <View className='form-stepper__segments'>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                className={[
                  'form-stepper__segment',
                  i <= currentStep ? 'form-stepper__segment--filled' : '',
                  i === currentStep ? 'form-stepper__segment--active' : '',
                ].filter(Boolean).join(' ')}
                style={
                  i <= currentStep && accentColor
                    ? { background: accentColor }
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      </View>

      {/* Step title */}
      <View className='form-stepper__title-wrap'>
        <Text className='form-stepper__title'>{label}</Text>
      </View>

      {headerContent}
    </View>
  )
}
