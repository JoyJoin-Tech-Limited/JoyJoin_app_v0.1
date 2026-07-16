import { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import PixelAvatarFallback from '../../../components/profile/PixelAvatarFallback'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import {
  drawEquipmentEntitlement,
  fetchEquipmentShop,
  fetchMyEquipment,
  redeemEquipmentShopItem,
  saveMyEquipmentOutfit,
  type EquipmentDrawResponse,
  type EquipmentItem,
  type EquipmentOutfit,
  type EquipmentSlot,
} from '../../../lib/profile/equipmentApi'
import {
  getPixelAvatarBaseUrl,
  getPixelEquipmentLayerUrl,
} from '../../../lib/profile/pixelAvatarAssets'
import { haptics } from '../../../lib/utils/haptics'
import { BRAND_COLORS } from '../../../styles/colors'
import './index.scss'

const EQUIPMENT_QUERY_KEY = ['mini-program', 'equipment', 'me'] as const
const EQUIPMENT_SHOP_QUERY_KEY = ['mini-program', 'equipment', 'shop'] as const

const SLOT_ORDER: EquipmentSlot[] = ['top', 'bottom', 'shoes', 'accessory']
const SLOT_COPY: Record<EquipmentSlot, string> = {
  top: '上装',
  bottom: '下装',
  shoes: '鞋子',
  accessory: '配饰',
}

function getOutfitItemId(outfit: EquipmentOutfit, slot: EquipmentSlot): string | null {
  return outfit[`${slot}ItemId` as keyof EquipmentOutfit] as string | null
}

function withOutfitItem(outfit: EquipmentOutfit, slot: EquipmentSlot, itemId: string | null): EquipmentOutfit {
  return { ...outfit, [`${slot}ItemId`]: itemId }
}

export function isEquipmentItemCompatible(item: EquipmentItem, archetypeId: string): boolean {
  return !item.compatibleArchetypes
    || item.compatibleArchetypes.length === 0
    || item.compatibleArchetypes.includes(archetypeId)
}

function sanitizeOutfitForInventory(
  outfit: EquipmentOutfit,
  compatibleItemIds: ReadonlySet<string>,
): EquipmentOutfit {
  return SLOT_ORDER.reduce((current, slot) => {
    const itemId = getOutfitItemId(current, slot)
    return itemId && !compatibleItemIds.has(itemId)
      ? withOutfitItem(current, slot, null)
      : current
  }, outfit)
}

function sanitizeEquipmentSnapshotOutfit(snapshot: {
  archetypeId: string
  outfit: EquipmentOutfit
  inventory: Array<{ item: EquipmentItem }>
}): EquipmentOutfit {
  const compatibleItemIds = new Set(
    snapshot.inventory
      .filter((entry) => isEquipmentItemCompatible(entry.item, snapshot.archetypeId))
      .map((entry) => entry.item.id),
  )
  return sanitizeOutfitForInventory(snapshot.outfit, compatibleItemIds)
}

function makeIdempotencyKey(itemId: string): string {
  return `equipment-shop-${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function PixelAvatarStage({
  archetypeId,
  outfit,
  itemsById,
}: {
  archetypeId: string
  outfit: EquipmentOutfit
  itemsById: Map<string, EquipmentItem>
}) {
  const [baseFailed, setBaseFailed] = useState(false)
  const [failedLayers, setFailedLayers] = useState<Set<string>>(new Set())
  const equippedItems = SLOT_ORDER
    .map((slot) => getOutfitItemId(outfit, slot))
    .flatMap((id) => id ? [itemsById.get(id)] : [])
    .filter((item): item is EquipmentItem => !!item)

  return (
    <View className='my-image__stage' aria-label='当前形象预览'>
      <View className='my-image__stage-grid' aria-hidden='true' />
      <View className='my-image__avatar-frame'>
        {baseFailed && (
          <PixelAvatarFallback
            archetypeId={archetypeId}
            variant='full'
            className='my-image__avatar-code'
          />
        )}
        {!baseFailed && (
          <Image
            className='my-image__avatar-layer my-image__avatar-layer--base'
            src={getPixelAvatarBaseUrl(archetypeId)}
            mode='aspectFit'
            onError={() => setBaseFailed(true)}
          />
        )}
        {!baseFailed && equippedItems.map((item) => {
          const layerUrl = getPixelEquipmentLayerUrl(item.assetKey, archetypeId)
          return failedLayers.has(item.id) || !layerUrl ? null : (
            <Image
              key={item.id}
              className={`my-image__avatar-layer my-image__avatar-layer--${item.slot}`}
              src={layerUrl}
              mode='aspectFit'
              onError={() => setFailedLayers((current) => new Set(current).add(item.id))}
            />
          )
        })}
      </View>
      <View className='my-image__stage-caption'>
        <Text className='my-image__stage-eyebrow'>JOYJOIN PIXEL PERSONA</Text>
        <Text className='my-image__stage-name'>{ARCHETYPE_BY_ID[archetypeId]?.nameCn ?? '我的伙伴'}</Text>
      </View>
    </View>
  )
}

export default function MyImagePage() {
  const { user, isLoading: authLoading } = useAuthGuard()
  const queryClient = useQueryClient()
  const pixelAvatarEnabled = user?.features?.profilePixelAvatarEnabled === true
  const rewardsEnabled = user?.features?.equipmentRewardsEnabled === true
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'shop'>('wardrobe')
  const [activeSlot, setActiveSlot] = useState<EquipmentSlot>('top')
  const [draftOutfit, setDraftOutfit] = useState<EquipmentOutfit | null>(null)
  const [drawResult, setDrawResult] = useState<EquipmentDrawResponse | null>(null)

  const equipmentQuery = useQuery({
    queryKey: EQUIPMENT_QUERY_KEY,
    queryFn: fetchMyEquipment,
    enabled: !authLoading && pixelAvatarEnabled,
    staleTime: 15_000,
  })
  const shopQuery = useQuery({
    queryKey: EQUIPMENT_SHOP_QUERY_KEY,
    queryFn: fetchEquipmentShop,
    enabled: !authLoading && pixelAvatarEnabled && rewardsEnabled && activeTab === 'shop',
    staleTime: 15_000,
  })

  useEffect(() => {
    const snapshot = equipmentQuery.data
    if (!snapshot) return
    const sanitized = sanitizeEquipmentSnapshotOutfit(snapshot)
    setDraftOutfit((current) => !current || current.version !== sanitized.version
      ? sanitized
      : current)
  }, [equipmentQuery.data])

  const saveMutation = useMutation({
    mutationFn: (outfit: EquipmentOutfit) => saveMyEquipmentOutfit({
      topItemId: outfit.topItemId,
      bottomItemId: outfit.bottomItemId,
      shoesItemId: outfit.shoesItemId,
      accessoryItemId: outfit.accessoryItemId,
      expectedVersion: outfit.version,
    }),
    onSuccess: async (response) => {
      setDraftOutfit(response.outfit)
      await queryClient.invalidateQueries({ queryKey: EQUIPMENT_QUERY_KEY })
      haptics('success')
      Taro.showToast({ title: '形象已保存', icon: 'success' })
    },
    onError: async () => {
      const refreshed = await equipmentQuery.refetch()
      setDraftOutfit(refreshed.data
        ? sanitizeEquipmentSnapshotOutfit(refreshed.data)
        : null)
      Taro.showToast({ title: '形象没有保存，请重新选择', icon: 'none' })
    },
  })

  const drawMutation = useMutation({
    mutationFn: drawEquipmentEntitlement,
    onSuccess: async (result) => {
      setDrawResult(result)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EQUIPMENT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EQUIPMENT_SHOP_QUERY_KEY }),
      ])
      haptics('success')
    },
    onError: () => Taro.showToast({ title: '这次没有抽出来，请稍后再试', icon: 'none' }),
  })

  const redeemMutation = useMutation({
    mutationFn: ({ itemId, key }: { itemId: string; key: string }) => redeemEquipmentShopItem(itemId, key),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EQUIPMENT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EQUIPMENT_SHOP_QUERY_KEY }),
      ])
      haptics('success')
      Taro.showToast({ title: '新装备已放入衣橱', icon: 'success' })
    },
    onError: () => Taro.showToast({ title: '碎片不足或兑换没有完成', icon: 'none' }),
  })

  const data = equipmentQuery.data
  const inventory = useMemo(
    () => (data?.inventory ?? []).filter((entry) =>
      !!data && isEquipmentItemCompatible(entry.item, data.archetypeId)),
    [data],
  )
  const recentItems = useMemo(
    () => (data?.recentItems ?? []).filter((entry) =>
      !!data && isEquipmentItemCompatible(entry.item, data.archetypeId)),
    [data],
  )
  const itemsById = useMemo(
    () => new Map(inventory.map((entry) => [entry.item.id, entry.item])),
    [inventory],
  )
  const slotInventory = inventory.filter((entry) => entry.item.slot === activeSlot)
  const isDirty = !!data && !!draftOutfit && SLOT_ORDER.some(
    (slot) => getOutfitItemId(data.outfit, slot) !== getOutfitItemId(draftOutfit, slot),
  )

  const handleDraw = async (entitlementId: string, poolName: string) => {
    if (!rewardsEnabled || drawMutation.isPending) return
    const modal = await Taro.showModal({
      title: '开启地点装备池',
      content: `将使用 1 次「${poolName}」抽取机会。装备结果由服务端生成，是否继续？`,
      confirmText: '开始抽取',
      cancelText: '稍后再说',
      confirmColor: BRAND_COLORS.primary,
    })
    if (modal.confirm) drawMutation.mutate(entitlementId)
  }

  const handleRedeem = async (item: EquipmentItem & { price: number; owned: boolean }) => {
    if (!rewardsEnabled || item.owned || redeemMutation.isPending) return
    const modal = await Taro.showModal({
      title: '兑换装备',
      content: `使用 ${item.price} 通用碎片兑换「${item.name}」？`,
      confirmText: '确认兑换',
      cancelText: '取消',
      confirmColor: BRAND_COLORS.primary,
    })
    if (modal.confirm) redeemMutation.mutate({ itemId: item.id, key: makeIdempotencyKey(item.id) })
  }

  if (!pixelAvatarEnabled) {
    return (
      <View className='my-image my-image--centered'>
        <Text className='my-image__empty-title'>我的形象暂未开放</Text>
        <Text className='my-image__empty-copy'>你的资料和原有人格结果不会受到影响。</Text>
      </View>
    )
  }

  if (equipmentQuery.isError) {
    return (
      <View className='my-image my-image--centered'>
        <Text className='my-image__empty-title'>衣橱暂时没有打开</Text>
        <Text className='my-image__empty-copy'>已保存的形象不会丢失，可以稍后再试。</Text>
        <View className='my-image__retry' onClick={() => equipmentQuery.refetch()} role='button' aria-label='重新加载衣橱'>
          <Text>重新加载</Text>
        </View>
      </View>
    )
  }

  if (authLoading || equipmentQuery.isLoading || !draftOutfit || !data) {
    return (
      <View className='my-image my-image--centered'>
        <View className='my-image__loading-dot' />
        <Text className='my-image__empty-copy'>正在整理你的衣橱…</Text>
      </View>
    )
  }

  return (
    <View className='my-image'>
      <ScrollView className='my-image__scroll' scrollY enhanced showScrollbar={false}>
        <View className='my-image__content'>
          <PixelAvatarStage archetypeId={data.archetypeId} outfit={draftOutfit} itemsById={itemsById} />

          <View className='my-image__tabs' role='tablist' aria-label='形象功能'>
            <View
              className={`my-image__tab${activeTab === 'wardrobe' ? ' my-image__tab--active' : ''}`}
              onClick={() => setActiveTab('wardrobe')}
              role='tab'
              aria-selected={activeTab === 'wardrobe'}
            ><Text>我的衣橱</Text></View>
            <View
              className={`my-image__tab${activeTab === 'shop' ? ' my-image__tab--active' : ''}`}
              onClick={() => setActiveTab('shop')}
              role='tab'
              aria-selected={activeTab === 'shop'}
            ><Text>碎片商店</Text></View>
          </View>

          {activeTab === 'wardrobe' ? (
            <>
              <View className='my-image__balance-card'>
                <View><Text className='my-image__balance-label'>通用碎片</Text><Text className='my-image__balance-value'>{data.wallet.fragmentBalance}</Text></View>
                <View className='my-image__pity-copy'>
                  <Text>新品保底</Text>
                  <Text>{Math.min(data.wallet.pityMisses + 1, data.wallet.pityTarget)} / {data.wallet.pityTarget} 抽</Text>
                </View>
              </View>

              {data.pendingEntitlements.length > 0 && (
                <View className='my-image__section'>
                  <Text className='my-image__section-title'>待领取装备</Text>
                  <Text className='my-image__section-copy'>完成活动获得的机会会永久保留，手动开启后揭晓装备。</Text>
                  {data.pendingEntitlements.map((entitlement) => (
                    <View key={entitlement.id} className='my-image__entitlement'>
                      <View className='my-image__entitlement-copy'>
                        <Text className='my-image__entitlement-name'>{entitlement.pool.name}</Text>
                        <Text className='my-image__entitlement-meta'>1 次地点装备池抽取</Text>
                      </View>
                      <View
                        className={`my-image__draw-button${!rewardsEnabled ? ' my-image__draw-button--disabled' : ''}`}
                        onClick={() => { void handleDraw(entitlement.id, entitlement.pool.name) }}
                        role='button'
                        aria-label={`开启${entitlement.pool.name}装备池`}
                        aria-disabled={!rewardsEnabled || drawMutation.isPending}
                      ><Text>{drawMutation.isPending ? '揭晓中…' : '手动领取'}</Text></View>
                    </View>
                  ))}
                </View>
              )}

              <View className='my-image__section'>
                <Text className='my-image__section-title'>搭配装备</Text>
                <View className='my-image__slot-tabs'>
                  {SLOT_ORDER.map((slot) => (
                    <View
                      key={slot}
                      className={`my-image__slot-tab${activeSlot === slot ? ' my-image__slot-tab--active' : ''}`}
                      onClick={() => setActiveSlot(slot)}
                      role='button'
                      aria-label={`选择${SLOT_COPY[slot]}槽位`}
                    ><Text>{SLOT_COPY[slot]}</Text></View>
                  ))}
                </View>
                <View className='my-image__inventory-grid'>
                  <View
                    className={`my-image__item-card${getOutfitItemId(draftOutfit, activeSlot) === null ? ' my-image__item-card--selected' : ''}`}
                    onClick={() => setDraftOutfit(withOutfitItem(draftOutfit, activeSlot, null))}
                    role='button'
                    aria-label={`脱下${SLOT_COPY[activeSlot]}`}
                  >
                    <View className='my-image__item-icon my-image__item-icon--empty'><Text>空</Text></View>
                    <Text className='my-image__item-name'>脱下</Text>
                  </View>
                  {slotInventory.map((entry) => {
                    const selected = getOutfitItemId(draftOutfit, activeSlot) === entry.item.id
                    return (
                      <View
                        key={entry.id}
                        className={`my-image__item-card${selected ? ' my-image__item-card--selected' : ''}`}
                        onClick={() => setDraftOutfit(withOutfitItem(draftOutfit, activeSlot, entry.item.id))}
                        role='button'
                        aria-label={`穿上${entry.item.name}`}
                      >
                        <View className={`my-image__item-icon my-image__item-icon--${entry.item.rarity}`}><Text>{SLOT_COPY[entry.item.slot].slice(0, 1)}</Text></View>
                        <Text className='my-image__item-name'>{entry.item.name}</Text>
                        {entry.item.rarity === 'rare' && <Text className='my-image__rare-badge'>稀有</Text>}
                      </View>
                    )
                  })}
                </View>
              </View>

              {recentItems.length > 0 && (
                <View className='my-image__section'>
                  <Text className='my-image__section-title'>最近获得</Text>
                  <ScrollView className='my-image__recent' scrollX enhanced showScrollbar={false}>
                    {recentItems.map((entry) => <Text key={entry.id} className='my-image__recent-chip'>{entry.item.name}</Text>)}
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            <View className='my-image__section'>
              <View className='my-image__shop-heading'>
                <View><Text className='my-image__section-title'>通用碎片商店</Text><Text className='my-image__section-copy'>所有地点装备都可兑换，不使用现金或悦币。</Text></View>
                <Text className='my-image__shop-balance'>{shopQuery.data?.fragmentBalance ?? data.wallet.fragmentBalance} 碎片</Text>
              </View>
              {!rewardsEnabled ? (
                <Text className='my-image__shop-disabled'>商店兑换暂未开放，已有装备和碎片会继续保留。</Text>
              ) : shopQuery.isLoading ? (
                <Text className='my-image__shop-disabled'>正在整理装备目录…</Text>
              ) : (
                <View className='my-image__shop-grid'>
                  {(shopQuery.data?.items ?? []).map((item) => (
                    <View key={item.id} className='my-image__shop-item'>
                      <View className={`my-image__item-icon my-image__item-icon--${item.rarity}`}><Text>{SLOT_COPY[item.slot].slice(0, 1)}</Text></View>
                      <Text className='my-image__shop-item-name'>{item.name}</Text>
                      <Text className='my-image__shop-item-meta'>{item.rarity === 'rare' ? '稀有' : '普通'} · {item.price} 碎片</Text>
                      <View
                        className={`my-image__shop-action${item.owned ? ' my-image__shop-action--owned' : ''}`}
                        onClick={() => { void handleRedeem(item) }}
                        role='button'
                        aria-label={item.owned ? `已拥有${item.name}` : `兑换${item.name}`}
                        aria-disabled={item.owned || redeemMutation.isPending}
                      ><Text>{item.owned ? '已拥有' : '兑换'}</Text></View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {activeTab === 'wardrobe' && (
        <View className='my-image__save-bar'>
          <View
            className={`my-image__save-button${!isDirty || saveMutation.isPending ? ' my-image__save-button--disabled' : ''}`}
            onClick={() => isDirty && !saveMutation.isPending && saveMutation.mutate(draftOutfit)}
            role='button'
            aria-label={saveMutation.isPending ? '正在保存形象' : '保存形象'}
            aria-disabled={!isDirty || saveMutation.isPending}
          ><Text>{saveMutation.isPending ? '正在保存…' : isDirty ? '保存形象' : '形象已保存'}</Text></View>
        </View>
      )}

      {drawResult && (
        <View className='my-image__reveal-overlay' role='dialog' aria-label='装备抽取结果'>
          <View className='my-image__reveal-burst' aria-hidden='true' />
          <View className='my-image__reveal-card'>
            <Text className='my-image__reveal-kicker'>{drawResult.guaranteed ? '第 4 抽新品保底' : '地点装备池'}</Text>
            <View className={`my-image__reveal-item my-image__reveal-item--${drawResult.item.rarity}`}><Text>✦</Text></View>
            <Text className='my-image__reveal-title'>{drawResult.item.name}</Text>
            <Text className='my-image__reveal-copy'>
              {drawResult.resultKind === 'new'
                ? '拥有新装备，已经放入你的衣橱。'
                : `重复装备已转化为 ${drawResult.fragmentsAwarded} 通用碎片。`}
            </Text>
            <View className='my-image__reveal-confirm' onClick={() => setDrawResult(null)} role='button' aria-label='收下装备'><Text>收下</Text></View>
          </View>
        </View>
      )}
    </View>
  )
}
