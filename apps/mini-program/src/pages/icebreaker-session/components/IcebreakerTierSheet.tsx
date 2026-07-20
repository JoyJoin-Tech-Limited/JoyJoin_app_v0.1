import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { TIER_PRESETS, TIER_CARD_BACKGROUNDS } from '../tierPresets'
import type { VibeId } from '../../../lib/vibeMapping'
import { haptics } from '../../../lib/utils/haptics'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'

import './IcebreakerTierSheet.scss'

export type TierSheetSelection = { tier: TierMachineId; vibe: VibeId }

interface IcebreakerTierSheetProps {
  isOpen: boolean
  currentTier: TierMachineId
  currentVibe?: VibeId
  customEnabled?: boolean
  isBusy?: boolean
  onClose: () => void
  onConfirm: (selection: TierSheetSelection) => void
}

const CUSTOM_VIBE: VibeId = 'balanced'

export function IcebreakerTierSheet({
  isOpen,
  currentTier,
  currentVibe = 'balanced',
  customEnabled = true,
  isBusy = false,
  onClose,
  onConfirm,
}: IcebreakerTierSheetProps) {
  const [draft, setDraft] = useState<TierSheetSelection>({ tier: currentTier, vibe: currentVibe })

  useEffect(() => {
    if (isOpen) {
      setDraft({ tier: currentTier, vibe: currentTier === 'custom' ? CUSTOM_VIBE : currentVibe })
    }
  }, [isOpen, currentTier, currentVibe])

  if (!isOpen) {
    return null
  }

  const hasChanged = draft.tier !== currentTier || (draft.tier !== 'custom' && draft.vibe !== currentVibe)

  const handleSelectPreset = (tier: TierMachineId, vibe: VibeId) => {
    haptics('light')
    setDraft({ tier, vibe })
  }

  const handleSelectCustom = () => {
    haptics('light')
    setDraft({ tier: 'custom', vibe: CUSTOM_VIBE })
  }

  const handleConfirm = () => {
    if (!hasChanged || isBusy) {
      onClose()
      return
    }
    onConfirm(draft)
  }

  return (
    <View className='tier-sheet' role='dialog' aria-modal='true' aria-label='更换本次模式'>
      <View className='tier-sheet__backdrop' onClick={onClose} catchMove />
      <View className='tier-sheet__panel' catchMove>
        <View className='tier-sheet__handle' />

        <View className='tier-sheet__header'>
          <Text className='tier-sheet__title'>更换本次模式</Text>
          <View className='tier-sheet__close' onClick={onClose} role='button' aria-label='关闭' />
        </View>

        <View className='tier-sheet__body'>
          <View className='tier-sheet__list' role='radiogroup' aria-label='选择模式'>
            {TIER_PRESETS.map((preset) => {
              const isActive = draft.tier === preset.tier && draft.vibe === preset.vibe
              return (
                <View
                  key={preset.id}
                  className={`tier-sheet__card ${isActive ? 'tier-sheet__card--active' : ''}`}
                  onClick={() => handleSelectPreset(preset.tier, preset.vibe)}
                  hoverClass='tier-sheet__card--pressed'
                  hoverStartTime={0}
                  hoverStayTime={200}
                  role='radio'
                  aria-checked={isActive}
                  aria-label={`${preset.title}，${preset.subtitle}，${preset.duration}，${preset.gameCount}`}
                >
                  <Image
                    className='tier-sheet__card-bg'
                    src={TIER_CARD_BACKGROUNDS[preset.tier]}
                    mode='scaleToFill'
                    aria-hidden
                  />
                  <View className='tier-sheet__card-body'>
                    <View className='tier-sheet__card-header'>
                      <Text className='tier-sheet__card-title'>{preset.title}</Text>
                      {preset.recommended && <Text className='tier-sheet__card-badge'>推荐</Text>}
                    </View>
                    <Text className='tier-sheet__card-subtitle'>{preset.subtitle}</Text>
                    <View className='tier-sheet__card-meta'>
                      <Text className='tier-sheet__card-meta-item'>{preset.duration}</Text>
                      <Text className='tier-sheet__card-meta-item'>{preset.gameCount}</Text>
                    </View>
                    <Text className='tier-sheet__card-description'>{preset.description}</Text>
                  </View>
                  {isActive && (
                    <View className='tier-sheet__card-check'>
                      <JoyJoinIcon emoji='✓' size={24} />
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          {customEnabled && (
            <>
              <View className='tier-sheet__divider'>
                <View className='tier-sheet__divider-line' />
                <Text className='tier-sheet__divider-text'>或</Text>
                <View className='tier-sheet__divider-line' />
              </View>

              <View
                className={`tier-sheet__card tier-sheet__card--custom ${draft.tier === 'custom' ? 'tier-sheet__card--active' : ''}`}
                onClick={handleSelectCustom}
                hoverClass='tier-sheet__card--pressed'
                hoverStartTime={0}
                hoverStayTime={200}
                role='radio'
                aria-checked={draft.tier === 'custom'}
                aria-label='自由局，手动控制每个环节'
              >
                <Image
                  className='tier-sheet__card-bg'
                  src={TIER_CARD_BACKGROUNDS.custom}
                  mode='scaleToFill'
                  aria-hidden
                />
                <View className='tier-sheet__card-body'>
                  <View className='tier-sheet__card-header'>
                    <Text className='tier-sheet__card-title'>自由局</Text>
                    <Text className='tier-sheet__card-badge tier-sheet__card-badge--custom'>自由定制</Text>
                  </View>
                  <Text className='tier-sheet__card-subtitle'>全场节奏，由你导演</Text>
                  <Text className='tier-sheet__card-description'>手动选择每个环节，适合有明确想法的主持人</Text>
                </View>
                {draft.tier === 'custom' && (
                  <View className='tier-sheet__card-check'>
                    <JoyJoinIcon emoji='✓' size={24} />
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        <View className='tier-sheet__footer'>
          <Button
            variant='primary'
            className='tier-sheet__confirm'
            onClick={handleConfirm}
            disabled={!hasChanged || isBusy}
            loading={isBusy}
          >
            {isBusy ? '切换中…' : '确认更换'}
          </Button>
          <View className='tier-sheet__cancel' onClick={onClose} role='button' aria-label='取消'>
            <Text className='tier-sheet__cancel-text'>取消</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default IcebreakerTierSheet
