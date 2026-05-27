import { View, Text } from '@tarojs/components'
import type { ProfessionClassificationData } from '../ProfessionChatOverlay'
import './ProfessionDisplayField.scss'

export interface ProfessionDisplayFieldProps {
  rawValue?: string
  classification?: ProfessionClassificationData | null
  onEdit?: () => void
  className?: string
}

/**
 * ProfessionDisplayField — displays the user's profession with classified tags.
 *
 * Shows the raw profession text as the primary value, with AI-classified
 * category/segment/niche chips beneath. Includes an "编辑" trigger.
 * Used in edit-profile and anywhere profession is displayed read-only.
 */
export default function ProfessionDisplayField({
  rawValue,
  classification,
  onEdit,
  className = '',
}: ProfessionDisplayFieldProps) {
  const hasValue = rawValue && rawValue.trim() !== ''
  const tags = [
    classification?.industryCategoryLabel,
    classification?.industrySegmentLabel,
    classification?.industryNicheLabel,
  ].filter((item): item is string => Boolean(item))

  return (
    <View className={`profession-display-field ${className}`} onClick={onEdit}>
      <View className='profession-display-field__row'>
        <Text className={`profession-display-field__value ${hasValue ? 'profession-display-field__value--filled' : ''}`}>
          {hasValue ? rawValue : '选填（点击告诉悦仔）'}
        </Text>
        {hasValue && (
          <Text className='profession-display-field__edit'>修改 ›</Text>
        )}
      </View>

      {tags.length > 0 && (
        <View className='profession-display-field__tags'>
          {tags.map((tag) => (
            <View key={tag} className='profession-display-field__tag'>
              <Text className='profession-display-field__tag-text'>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {!hasValue && (
        <Text className='profession-display-field__hint'>
          完善职业信息，匹配更精准
        </Text>
      )}
    </View>
  )
}
