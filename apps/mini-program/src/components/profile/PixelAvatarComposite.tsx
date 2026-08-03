import { Image, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { EquipmentItem, EquipmentOutfit, EquipmentSlot } from '../../lib/profile/equipmentApi'
import {
  PIXEL_AVATAR_EQUIPMENT_SLOTS,
  getPixelAvatarApprovedStarterLookUrl,
  getPixelAvatarBodyUrl,
  getPixelEquipmentAsset,
  normalizePixelArchetypeId,
  type PixelEquipmentAsset,
  type PixelEquipmentPlacement,
} from '../../lib/profile/pixelAvatarAssets'
import AvatarPlaceholder from './AvatarPlaceholder'
import './PixelAvatarComposite.scss'

export interface PixelAvatarSlotHotspot {
  slot: EquipmentSlot
  /** Accessible name, e.g. 「查看上装」. */
  label: string
  placement: PixelEquipmentPlacement
}

export interface PixelAvatarCompositeProps {
  archetypeId: string
  outfit: EquipmentOutfit
  itemsById: ReadonlyMap<string, EquipmentItem>
  variant?: 'compact' | 'full'
  className?: string
  /**
   * Optional tap-to-slot hotspots over the character (placement-rect hit
   * areas, from the open-source slot hit-rect pattern).
   */
  slotHotspots?: PixelAvatarSlotHotspot[]
  onSlotTap?: (slot: EquipmentSlot) => void
}

interface EquippedLayer {
  item: EquipmentItem
  asset: PixelEquipmentAsset
}

const BODY_CANVAS_WIDTH = 512
const BODY_CANVAS_HEIGHT = 768

function getOutfitItemId(outfit: EquipmentOutfit, slot: EquipmentSlot): string | null {
  return outfit[`${slot}ItemId` as keyof EquipmentOutfit] as string | null
}

function toPlacementStyle(asset: PixelEquipmentAsset): CSSProperties {
  return {
    left: `${(asset.placement.left / BODY_CANVAS_WIDTH) * 100}%`,
    top: `${(asset.placement.top / BODY_CANVAS_HEIGHT) * 100}%`,
    width: `${(asset.placement.width / BODY_CANVAS_WIDTH) * 100}%`,
    height: `${(asset.placement.height / BODY_CANVAS_HEIGHT) * 100}%`,
  }
}

export function PixelAvatarComposite({
  archetypeId,
  outfit,
  itemsById,
  variant = 'full',
  className = '',
  slotHotspots,
  onSlotTap,
}: PixelAvatarCompositeProps) {
  const safeArchetypeId = normalizePixelArchetypeId(archetypeId)
  const [bodySource, setBodySource] = useState<'primary' | 'base' | 'placeholder'>('primary')
  const [failedLayerIds, setFailedLayerIds] = useState<Set<string>>(new Set())

  const requestedItems = useMemo<EquipmentItem[]>(() => {
    return PIXEL_AVATAR_EQUIPMENT_SLOTS.flatMap((slot) => {
      const itemId = getOutfitItemId(outfit, slot)
      const item = itemId ? itemsById.get(itemId) : undefined
      if (!item || item.slot !== slot) return []
      return [item]
    })
  }, [itemsById, outfit])

  const equippedLayers = useMemo<EquippedLayer[]>(() => {
    const layers: EquippedLayer[] = []
    for (const item of requestedItems) {
      const asset = getPixelEquipmentAsset(item.assetKey, safeArchetypeId)
      if (asset?.slot === item.slot) layers.push({ item, asset })
    }
    return layers
  }, [requestedItems, safeArchetypeId])

  const resolvedItemIds = new Set(equippedLayers.map(({ item }) => item.id))
  const unresolvedItems = requestedItems.filter((item) => !resolvedItemIds.has(item.id))

  const assetSignature = requestedItems
    .map((item) => `${item.id}:${item.assetKey}`)
    .join('|')

  const approvedStarterLookUrl = getPixelAvatarApprovedStarterLookUrl(safeArchetypeId)
  const usesApprovedStarterLook = approvedStarterLookUrl !== null
    && failedLayerIds.size === 0
    && PIXEL_AVATAR_EQUIPMENT_SLOTS.every((slot) => requestedItems.some((item) => (
      item.slot === slot
      && item.assetKey === `equipment/starter/${safeArchetypeId}/${slot}/v1`
    )))
  const bodyUrl = usesApprovedStarterLook
    ? approvedStarterLookUrl
    : getPixelAvatarBodyUrl(safeArchetypeId)
  const fallbackBodyUrl = getPixelAvatarBodyUrl(safeArchetypeId)
  const renderedBodyUrl = bodySource === 'base' ? fallbackBodyUrl : bodyUrl

  useEffect(() => {
    setBodySource('primary')
  }, [bodyUrl])

  useEffect(() => {
    setFailedLayerIds(new Set())
  }, [assetSignature, safeArchetypeId])

  const visibleLayers = equippedLayers.filter(({ item }) => !failedLayerIds.has(item.id))
  const equippedNames = visibleLayers.map(({ item }) => item.name.trim()).filter(Boolean)
  const failedLayerCount = equippedLayers.length - visibleLayers.length
  const unresolvedLayerCount = unresolvedItems.length
  const archetypeName = ARCHETYPE_BY_ID[safeArchetypeId]?.nameCn ?? '我的伙伴'
  const equipmentCopy = equippedNames.length > 0
    ? `，穿着${equippedNames.join('、')}`
    : '，未穿戴可脱装备'
  const failedAssetCopy = failedLayerCount > 0
    ? `；另有${failedLayerCount}件装备图片未加载`
    : ''
  const unresolvedAssetCopy = unresolvedLayerCount > 0
    ? `；另有${unresolvedLayerCount}件装备素材准备中`
    : ''
  const fallbackCopy = archetypeId === safeArchetypeId ? '' : '，已使用默认形象'
  const accessibleLabel = `${archetypeName}像素形象${equipmentCopy}${failedAssetCopy}${unresolvedAssetCopy}；基础背心和安全短裤固定保留${fallbackCopy}`
  const bodyFallbackAccessibleLabel = `${archetypeName}像素形象；原始图片未加载，已显示不可脱基础背心和安全短裤的安全替代形象；装备图层已暂时隐藏${fallbackCopy}`
  // The scene box mirrors the 2:3 body canvas and stays centered; equipment
  // placement rects and the hotspot plane map 1:1 onto it.
  const sceneStyle: CSSProperties = {
    transform: 'translate3d(-50%, 0, 0)',
  }

  if (bodySource === 'placeholder') {
    return (
      <View
        className={`pixel-avatar-composite pixel-avatar-composite--${variant} ${className}`.trim()}
        data-permanent-underwear='true'
      >
        <View
          className='pixel-avatar-composite__canvas'
          data-permanent-underwear='true'
          role='img'
          aria-label={bodyFallbackAccessibleLabel}
        >
          <View className='pixel-avatar-composite__fallback-shell' aria-hidden='true'>
            <AvatarPlaceholder
              className='pixel-avatar-composite__fallback'
            />
          </View>
          <Text className='pixel-avatar-composite__accessible-copy'>{bodyFallbackAccessibleLabel}</Text>
        </View>
        <View
          className='pixel-avatar-composite__asset-warning'
          onClick={() => setBodySource('primary')}
          role='button'
          aria-label='重新加载形象图片'
          hoverClass='pixel-avatar-composite__asset-warning--pressed'
        ><Text>形象图未加载 · 重试</Text></View>
      </View>
    )
  }

  return (
    <View
      className={`pixel-avatar-composite pixel-avatar-composite--${variant} ${className}`.trim()}
      data-permanent-underwear='true'
    >
      <View
        className='pixel-avatar-composite__canvas'
        data-permanent-underwear='true'
        role='img'
        aria-label={accessibleLabel}
      >
        <View
          className='pixel-avatar-composite__scene'
          style={sceneStyle}
          aria-hidden='true'
        >
          <Image
            className={`pixel-avatar-composite__body${usesApprovedStarterLook ? ' pixel-avatar-composite__body--approved-starter' : ''}`}
            src={renderedBodyUrl}
            mode='scaleToFill'
            lazyLoad={false}
            onError={() => {
              console.error({
                type: 'avatar_asset_error',
                src: renderedBodyUrl,
              })
              setBodySource((current) => (
                current === 'primary' && renderedBodyUrl !== fallbackBodyUrl
                  ? 'base'
                  : 'placeholder'
              ))
            }}
          />

          {!usesApprovedStarterLook && visibleLayers.map(({ item, asset }) => (
            <Image
              key={item.id}
              className={`pixel-avatar-composite__layer pixel-avatar-composite__layer--${asset.slot}`}
              data-item-id={item.id}
              data-depth={asset.depth}
              src={asset.url}
              mode='scaleToFill'
              lazyLoad={false}
              style={toPlacementStyle(asset)}
              onError={() => setFailedLayerIds((current) => {
                const next = new Set(current)
                next.add(item.id)
                return next
              })}
            />
          ))}
        </View>

        <Text className='pixel-avatar-composite__accessible-copy'>{accessibleLabel}</Text>
      </View>

      {onSlotTap && slotHotspots && slotHotspots.length > 0 && (
        <View className='pixel-avatar-composite__hotspot-plane'>
          {slotHotspots.map(({ slot, label, placement }) => (
            <View
              key={slot}
              className='pixel-avatar-composite__hotspot'
              hoverClass='pixel-avatar-composite__hotspot--pressed'
              style={{
                left: `${(placement.left / BODY_CANVAS_WIDTH) * 100}%`,
                top: `${(placement.top / BODY_CANVAS_HEIGHT) * 100}%`,
                width: `${(placement.width / BODY_CANVAS_WIDTH) * 100}%`,
                height: `${(placement.height / BODY_CANVAS_HEIGHT) * 100}%`,
              }}
              onClick={() => onSlotTap(slot)}
              role='button'
              aria-label={label}
            />
          ))}
        </View>
      )}

      {failedLayerCount > 0 && (
        <View
          className='pixel-avatar-composite__asset-warning'
          onClick={() => setFailedLayerIds(new Set())}
          role='button'
          aria-label={`${failedLayerCount}件装备图片未加载，重新加载`}
          hoverClass='pixel-avatar-composite__asset-warning--pressed'
        ><Text>装备图未加载 · 重试</Text></View>
      )}
      {failedLayerCount === 0 && unresolvedLayerCount > 0 && (
        <View
          className='pixel-avatar-composite__asset-warning pixel-avatar-composite__asset-warning--status'
          role='status'
          aria-label={`${unresolvedLayerCount}件装备素材准备中`}
        ><Text>装备素材准备中</Text></View>
      )}
    </View>
  )
}

export default PixelAvatarComposite
