import { View, Text } from '@tarojs/components'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { resolveTierDisplay } from '@shared/socialIcebreakerTierManifest'
import { TIER_PRESETS } from '../tierPresets'
import type { VibeId } from '../../../lib/vibeMapping'
import { haptics } from '../../../lib/utils/haptics'

import './IcebreakerTierSelector.scss'

interface IcebreakerTierSelectorProps {
  currentTier: TierMachineId
  currentVibe?: VibeId
  isHost?: boolean
  canChange?: boolean
  disabledHint?: string
  onChangeRequest?: () => void
}

function getTierLabel(tier: TierMachineId, vibe?: VibeId): string {
  if (tier === 'custom') {
    return '自由局'
  }

  const preset = TIER_PRESETS.find((p) => p.tier === tier && p.vibe === vibe)
  if (preset) {
    return preset.title
  }

  return resolveTierDisplay(tier, { glowVariant: 'default' })
}

function getTierDuration(tier: TierMachineId, vibe?: VibeId): string {
  if (tier === 'custom') {
    return '手动控制环节'
  }

  const preset = TIER_PRESETS.find((p) => p.tier === tier && p.vibe === vibe)
  return preset?.duration ?? ''
}

export function IcebreakerTierSelector({
  currentTier,
  currentVibe = 'balanced',
  isHost = false,
  canChange = false,
  disabledHint,
  onChangeRequest,
}: IcebreakerTierSelectorProps) {
  const label = getTierLabel(currentTier, currentVibe)
  const duration = getTierDuration(currentTier, currentVibe)

  const handleClick = () => {
    if (!isHost || !canChange || !onChangeRequest) {
      return
    }
    haptics('light')
    onChangeRequest()
  }

  const ariaLabel = isHost
    ? canChange
      ? `当前为${label}${duration ? `，${duration}` : ''}，点击更换模式`
      : `当前为${label}${duration ? `，${duration}` : ''}，${disabledHint ?? '当前阶段不可更换'}`
    : `当前模式：${label}${duration ? `，${duration}` : ''}`

  return (
    <View
      className={`tier-chip ${isHost && canChange ? 'tier-chip--editable' : 'tier-chip--readonly'}`}
      onClick={handleClick}
      role={isHost && canChange ? 'button' : 'status'}
      aria-label={ariaLabel}
      aria-disabled={!canChange}
    >
      <Text className='tier-chip__prefix'>当前</Text>
      <Text className='tier-chip__value'>{label}</Text>
      {duration && <Text className='tier-chip__duration'>{duration}</Text>}
      {isHost && canChange && <View className='tier-chip__chevron' />}
    </View>
  )
}

export default IcebreakerTierSelector
