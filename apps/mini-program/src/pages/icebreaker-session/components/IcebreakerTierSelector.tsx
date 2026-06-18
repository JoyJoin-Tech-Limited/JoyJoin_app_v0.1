import { View, Text, Button } from '@tarojs/components'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'

interface IcebreakerTierSelectorProps {
  activeTier?: TierMachineId
  customEnabled?: boolean
  isBusy?: boolean
  onSetTier?: (tier: TierMachineId) => void
}

const TIERS: Array<{ id: TierMachineId; label: string }> = [
  { id: 'breeze', label: '破冰局' },
  { id: 'glow', label: '畅聊局' },
  { id: 'blaze', label: '狂欢局' },
]

export function IcebreakerTierSelector({
  activeTier,
  customEnabled,
  isBusy,
  onSetTier,
}: IcebreakerTierSelectorProps) {
  return (
    <View className='icebreaker-tier-selector'>
      <Text className='icebreaker-tier-selector__title'>选择模式</Text>
      {TIERS.map((tier) => (
        <Button
          key={tier.id}
          disabled={isBusy || activeTier === tier.id}
          onClick={() => onSetTier?.(tier.id)}
        >
          {tier.label}
        </Button>
      ))}
      {customEnabled && (
        <Button
          disabled={isBusy || activeTier === 'custom'}
          onClick={() => onSetTier?.('custom')}
        >
          自定义
        </Button>
      )}
    </View>
  )
}

export default IcebreakerTierSelector
