import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import Card from '../../../components/ui/Card'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { buildSummaryItems } from '../poolRegistrationForm'
import type { RegistrationFormState } from '../poolRegistrationForm'
import type { PoolEventType } from '../flowConfig'

interface PoolRegistrationSummaryCardProps {
  formState: RegistrationFormState
  eventType: PoolEventType
}

export default function PoolRegistrationSummaryCard({
  formState,
  eventType,
}: PoolRegistrationSummaryCardProps) {
  const summaryItems = useMemo(() => buildSummaryItems(formState, eventType), [formState, eventType])

  return (
    <Card className='pool-reg__summary-card' role='group' aria-label='已选偏好（已锁定）'>
      <View className='pool-reg__summary-header'>
        <View className='pool-reg__summary-header-accent' aria-hidden='true' />
        <Text className='pool-reg__summary-title'>已选好的偏好</Text>
        <View className='pool-reg__summary-completed' aria-hidden='true'>
          <View className='pool-reg__summary-completed-dot' />
          <Text className='pool-reg__summary-completed-text'>已锁定</Text>
        </View>
      </View>

      <View className='pool-reg__summary-body'>
        {summaryItems.map((item, index) => {
          const showChips =
            item.intentLabels && item.intentLabels.length > 0 ? item.intentLabels : [item.value]

          return (
            <View key={item.label}>
              <View className='pool-reg__summary-row'>
                <View className='pool-reg__summary-row-icon' aria-hidden='true'>
                  <JoyJoinIcon emoji={item.icon} tier={item.tier} size={28} />
                </View>
                <View className='pool-reg__summary-row-content'>
                  <Text className='pool-reg__summary-row-label'>{item.label}</Text>
                  <View className='pool-reg__summary-row-chips'>
                    {showChips.map((label) => {
                      const isEmpty = label === '未选择'
                      return (
                        <View
                          key={label}
                          className={[
                            'pool-reg__summary-chip',
                            isEmpty ? 'pool-reg__summary-chip--empty' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <Text className='pool-reg__summary-chip-text'>{label}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </View>
              {index < summaryItems.length - 1 && (
                <View className='pool-reg__summary-divider' aria-hidden='true' />
              )}
            </View>
          )
        })}
      </View>
    </Card>
  )
}
