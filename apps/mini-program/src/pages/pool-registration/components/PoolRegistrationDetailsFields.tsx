import { View, Text } from '@tarojs/components'
import ChoiceCard from './ChoiceCard'
import ChoiceChip from './ChoiceChip'
import {
  ALCOHOL_COMFORT_OPTIONS,
  BAR_THEME_OPTIONS,
  DIETARY_OPTIONS,
  LANGUAGE_OPTIONS,
  type PoolEventType,
} from '../flowConfig'
import type { RegistrationFormState } from '../poolRegistrationForm'

interface PoolRegistrationDetailsFieldsProps {
  eventType: PoolEventType
  formState: RegistrationFormState
  onLanguageToggle: (value: string) => void
  onBarThemeToggle: (value: string) => void
  onAlcoholComfortSelect: (value: string) => void
  onDietaryToggle: (value: string) => void
}

export default function PoolRegistrationDetailsFields({
  eventType,
  formState,
  onLanguageToggle,
  onBarThemeToggle,
  onAlcoholComfortSelect,
  onDietaryToggle,
}: PoolRegistrationDetailsFieldsProps) {
  return (
    <>
      <View className='pool-reg__field'>
        <Text className='pool-reg__field-title'>愿意用什么语言开聊</Text>
        <View className='pool-reg__chip-row'>
          {LANGUAGE_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.value}
              option={option}
              selected={formState.preferredLanguages.includes(option.value)}
              onClick={() => onLanguageToggle(option.value)}
            />
          ))}
        </View>
      </View>

      {eventType === '酒局' ? (
        <>
          <View className='pool-reg__field'>
            <Text className='pool-reg__field-title'>更想去怎样的酒局</Text>
            <View className='pool-reg__chip-row'>
              {BAR_THEME_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  option={option}
                  selected={formState.barThemes.includes(option.value)}
                  onClick={() => onBarThemeToggle(option.value)}
                />
              ))}
            </View>
          </View>

          <View className='pool-reg__field'>
            <Text className='pool-reg__field-title'>喝酒舒适度</Text>
            <View className='pool-reg__choice-grid' role='radiogroup' aria-label='喝酒舒适度'>
              {ALCOHOL_COMFORT_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  selected={formState.alcoholComfort === option.value}
                  onClick={() => onAlcoholComfortSelect(option.value)}
                  compact
                />
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          <View className='pool-reg__field'>
            <Text className='pool-reg__field-title'>需要避开什么</Text>
            <Text className='pool-reg__field-desc'>你的饮食要求会参与匹配，选好了大家吃起来更自在</Text>
            <View className='pool-reg__chip-row'>
              {DIETARY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  option={option}
                  selected={formState.dietaryRestrictions.includes(option.value)}
                  onClick={() => onDietaryToggle(option.value)}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </>
  )
}
