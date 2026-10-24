import { Image, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import PixelAvatarComposite from '../../components/profile/PixelAvatarComposite'
import type { EquipmentItem, EquipmentOutfit } from '../../lib/profile/equipmentApi'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import { localAsset } from '../../lib/utils/cdnAssets'
import { logError } from '../../lib/utils/logger'

// Extracted from index.tsx (craft pass 2026-10-24): partner visual +
// equipment slot artwork. Page-size discipline (harness 1800-line blocker).
// NO SCSS import here by design — every profile-page__* rule compiles into
// the owning page's WXSS (subpackage style-splitting rule, same pattern as
// GuidanceTipCard; verify-subpackage-styles gate).

const EMPTY_EQUIPMENT_OUTFIT: EquipmentOutfit = {
  topItemId: null,
  bottomItemId: null,
  shoesItemId: null,
  accessoryItemId: null,
  version: 0,
}

const DEFAULT_EQUIPMENT_PLACEHOLDER_URL = localAsset('/assets/joyjoin-logo-tab.png')

export function EquipmentPreviewArtwork({
  item,
  artworkUrl,
}: {
  item: EquipmentItem
  artworkUrl: string | null
}) {
  const [source, setSource] = useState<'artwork' | 'default' | 'empty'>(
    artworkUrl ? 'artwork' : 'default',
  )

  useEffect(() => {
    setSource(artworkUrl ? 'artwork' : 'default')
  }, [artworkUrl, item.id])

  const image = source === 'artwork' ? artworkUrl : DEFAULT_EQUIPMENT_PLACEHOLDER_URL

  if (source === 'empty' || !image) {
    return <View className='profile-page__equipment-slot-mark' aria-hidden='true' />
  }

  return (
    <Image
      className={`profile-page__equipment-slot-art${source === 'default' ? ' profile-page__equipment-slot-art--placeholder' : ''}`}
      src={image}
      mode='aspectFit'
      lazyLoad={false}
      aria-hidden='true'
      onError={() => {
        logError('profile:equipment_asset_error', {
          itemId: item.id,
          image,
        })
        setSource((current) => current === 'artwork' ? 'default' : 'empty')
      }}
    />
  )
}

export default function ProfilePartnerVisual({
  archetype,
  archetypeName,
  displayName,
  pixelEnabled,
  equipmentState,
  outfit,
  itemsById,
  onRetryEquipment,
}: {
  archetype: string | null
  archetypeName: string | null
  displayName: string
  pixelEnabled: boolean
  equipmentState: 'ready' | 'loading' | 'error'
  outfit?: EquipmentOutfit
  itemsById: Map<string, EquipmentItem>
  onRetryEquipment: () => void
}) {
  const asset = archetype ? ARCHETYPE_ASSET_MAP[archetype] : undefined
  const [sourceKind, setSourceKind] = useState<'webp' | 'png' | 'fallback'>('webp')

  if (pixelEnabled && archetype) {
    if (equipmentState !== 'ready' || !outfit) {
      const isError = equipmentState === 'error'
      return (
        <View
          className={`profile-page__partner-equipment-state${isError ? ' profile-page__partner-equipment-state--error' : ''}`}
          role='status'
          aria-live='polite'
        >
          <View className='profile-page__partner-equipment-placeholder' aria-hidden='true'>
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--short' />
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--tall' />
            <View className='profile-page__partner-equipment-placeholder-bar profile-page__partner-equipment-placeholder-bar--medium' />
          </View>
          <Text className='profile-page__partner-equipment-state-title'>
            {isError ? '装备暂未同步' : '装备同步中…'}
          </Text>
          <Text className='profile-page__partner-equipment-state-copy'>
            {isError ? '已保存的搭配不会丢失' : '正在取回你已保存的搭配'}
          </Text>
          {isError && (
            <View
              className='profile-page__partner-equipment-retry'
              hoverClass='profile-page__partner-equipment-retry--pressed'
              onClick={onRetryEquipment}
              role='button'
              aria-label='重新同步装备'
            >
              <Text>重试</Text>
            </View>
          )}
        </View>
      )
    }

    return (
      <View className='profile-page__partner-pixel'>
        <PixelAvatarComposite
          archetypeId={archetype}
          outfit={outfit ?? EMPTY_EQUIPMENT_OUTFIT}
          itemsById={itemsById}
          variant='compact'
          className='profile-page__partner-pixel-composite'
        />
      </View>
    )
  }

  if (!asset || sourceKind === 'fallback') {
    return (
      <View
        className='profile-page__partner-fallback'
        role='img'
        aria-label={archetypeName ? `${archetypeName}伙伴形象` : `${displayName}的伙伴形象待解锁`}
      >
        <ArchetypeHead archetype={archetype} size={248} fallbackText={displayName} />
      </View>
    )
  }

  return (
    <Image
      className='profile-page__partner-image'
      src={sourceKind === 'webp' ? asset.webp : asset.png}
      mode='aspectFit'
      lazyLoad={false}
      aria-label={archetypeName ? `${archetypeName}伙伴形象` : '伙伴形象'}
      onError={() => setSourceKind(sourceKind === 'webp' ? 'png' : 'fallback')}
    />
  )
}
