import { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PixelAvatar3D from '../../../components/profile/PixelAvatar3D'
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

function getCompatibleEquipmentItemIds(snapshot: {
  archetypeId: string
  outfit: EquipmentOutfit
  inventory: Array<{ item: EquipmentItem }>
}): Set<string> {
  return new Set(
    snapshot.inventory
      .filter((entry) => isEquipmentItemCompatible(entry.item, snapshot.archetypeId))
      .map((entry) => entry.item.id),
  )
}

function getUsableEquipmentItemIds(snapshot: {
  archetypeId: string
  outfit: EquipmentOutfit
  inventory: Array<{ item: EquipmentItem }>
}): Set<string> {
  return new Set(
    snapshot.inventory
      .filter((entry) => isEquipmentItemCompatible(entry.item, snapshot.archetypeId)
        && !!getPixelEquipmentLayerUrl(entry.item.assetKey, snapshot.archetypeId))
      .map((entry) => entry.item.id),
  )
}

function sanitizeEquipmentSnapshotOutfit(snapshot: {
  archetypeId: string
  outfit: EquipmentOutfit
  inventory: Array<{ item: EquipmentItem }>
}): EquipmentOutfit {
  return sanitizeOutfitForInventory(snapshot.outfit, getCompatibleEquipmentItemIds(snapshot))
}

function makeIdempotencyKey(itemId: string): string {
  return `equipment-shop-${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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
  const [failedArtworkKeys, setFailedArtworkKeys] = useState<Set<string>>(new Set())

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
  const data = equipmentQuery.data
  const usableItemIds = useMemo(
    () => data ? getUsableEquipmentItemIds(data) : new Set<string>(),
    [data],
  )
  const compatibleItemIds = useMemo(
    () => data ? getCompatibleEquipmentItemIds(data) : new Set<string>(),
    [data],
  )

  useEffect(() => {
    const snapshot = data
    if (!snapshot) return
    const sanitized = sanitizeEquipmentSnapshotOutfit(snapshot)
    setDraftOutfit((current) => {
      if (!current || current.version !== sanitized.version) return sanitized
      return sanitizeOutfitForInventory(current, compatibleItemIds)
    })
  }, [compatibleItemIds, data])

  useEffect(() => {
    setFailedArtworkKeys(new Set())
  }, [data?.archetypeId])

  const saveMutation = useMutation({
    mutationFn: (outfit: EquipmentOutfit) => {
      const safeOutfit = sanitizeOutfitForInventory(outfit, usableItemIds)
      return saveMyEquipmentOutfit({
        topItemId: safeOutfit.topItemId,
        bottomItemId: safeOutfit.bottomItemId,
        shoesItemId: safeOutfit.shoesItemId,
        accessoryItemId: safeOutfit.accessoryItemId,
        expectedVersion: safeOutfit.version,
      })
    },
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
  const hasUnavailableDraftItem = !!draftOutfit && SLOT_ORDER.some((slot) => {
    const itemId = getOutfitItemId(draftOutfit, slot)
    return !!itemId && !usableItemIds.has(itemId)
  })
  const canSave = isDirty && !hasUnavailableDraftItem && !saveMutation.isPending

  const getArtworkFailureKey = (item: Pick<EquipmentItem, 'id' | 'assetKey'>) => `${item.id}:${item.assetKey}`

  const markArtworkFailed = (item: Pick<EquipmentItem, 'id' | 'assetKey'>) => {
    const failureKey = getArtworkFailureKey(item)
    setFailedArtworkKeys((current) => {
      if (current.has(failureKey)) return current
      const next = new Set(current)
      next.add(failureKey)
      return next
    })
  }

  const retryArtwork = (item: Pick<EquipmentItem, 'id' | 'assetKey'>) => {
    const failureKey = getArtworkFailureKey(item)
    setFailedArtworkKeys((current) => {
      if (!current.has(failureKey)) return current
      const next = new Set(current)
      next.delete(failureKey)
      return next
    })
  }

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
    if (
      !rewardsEnabled
      || item.owned
      || redeemMutation.isPending
      || !data
      || !getPixelEquipmentLayerUrl(item.assetKey, data.archetypeId)
    ) return
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

  if (equipmentQuery.isError && !data) {
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

  if (authLoading || (equipmentQuery.isLoading && !data) || !draftOutfit || !data) {
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
          <View className='my-image__stage' aria-label='当前形象预览'>
            <View className='my-image__stage-grid' aria-hidden='true' />
            <PixelAvatar3D
              className='my-image__turntable'
              archetypeId={data.archetypeId}
              outfit={draftOutfit}
              itemsById={itemsById}
              variant='full'
            />
            <View className='my-image__base-note' role='note' aria-label='基础内搭不可脱'>
              <View className='my-image__base-note-dot' aria-hidden='true' />
              <Text>基础内搭不可脱</Text>
            </View>
            {process.env.TARO_APP_AVATAR_3D_QA === 'true' && (
              <View
                className='my-image__qa-entry'
                onClick={() => Taro.navigateTo({ url: '/subpackages/profile-linked/my-image/qa3d/index' })}
                role='button'
                aria-label='打开 3D 形象调试页'
              ><Text>3D 调试</Text></View>
            )}
          </View>

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
                <Text className='my-image__section-copy'>四类装备都可以自由穿脱，贴身基础内搭会一直保留。</Text>
                <View className='my-image__slot-tabs'>
                  {SLOT_ORDER.map((slot) => (
                    <View
                      key={slot}
                      className={`my-image__slot-tab${activeSlot === slot ? ' my-image__slot-tab--active' : ''}`}
                      hoverClass='my-image__slot-tab--pressed'
                      onClick={() => {
                        haptics('light')
                        setActiveSlot(slot)
                      }}
                      role='button'
                      aria-label={`选择${SLOT_COPY[slot]}槽位`}
                      aria-pressed={activeSlot === slot}
                    ><Text>{SLOT_COPY[slot]}</Text></View>
                  ))}
                </View>
                <View className='my-image__inventory-grid'>
                  <View
                    className={`my-image__item-card${getOutfitItemId(draftOutfit, activeSlot) === null ? ' my-image__item-card--selected' : ''}`}
                    hoverClass='my-image__item-card--pressed'
                    onClick={() => {
                      haptics('light')
                      setDraftOutfit(withOutfitItem(draftOutfit, activeSlot, null))
                    }}
                    role='button'
                    aria-label={`脱下${SLOT_COPY[activeSlot]}`}
                    aria-pressed={getOutfitItemId(draftOutfit, activeSlot) === null}
                  >
                    <View className='my-image__item-icon my-image__item-icon--empty'><Text>空</Text></View>
                    <Text className='my-image__item-name'>脱下</Text>
                    {getOutfitItemId(draftOutfit, activeSlot) === null && (
                      <View className='my-image__selection-mark' aria-hidden='true'><Text>✓</Text></View>
                    )}
                  </View>
                  {slotInventory.map((entry) => {
                    const selected = getOutfitItemId(draftOutfit, activeSlot) === entry.item.id
                    const artworkUrl = getPixelEquipmentLayerUrl(entry.item.assetKey, data.archetypeId)
                    const artworkFailed = failedArtworkKeys.has(getArtworkFailureKey(entry.item))
                    const artworkUnavailable = !artworkUrl
                    return (
                      <View
                        key={entry.id}
                        className={`my-image__item-card${selected ? ' my-image__item-card--selected' : ''}${artworkUnavailable ? ' my-image__item-card--unavailable' : ''}`}
                        hoverClass='my-image__item-card--pressed'
                        onClick={() => {
                          if (artworkUnavailable) return
                          haptics('light')
                          if (artworkFailed) retryArtwork(entry.item)
                          setDraftOutfit(withOutfitItem(draftOutfit, activeSlot, entry.item.id))
                        }}
                        role='button'
                        aria-label={artworkUnavailable ? `${entry.item.name}，素材准备中` : `穿上${entry.item.name}`}
                        aria-disabled={artworkUnavailable}
                        aria-pressed={selected}
                      >
                        <View className={`my-image__item-icon my-image__item-icon--${entry.item.rarity}`}>
                          {artworkUrl && !artworkFailed ? (
                            <Image
                              className='my-image__item-art'
                              src={artworkUrl}
                              mode='aspectFit'
                              lazyLoad
                              aria-hidden='true'
                              onError={() => markArtworkFailed(entry.item)}
                            />
                          ) : (
                            <View className='my-image__item-art-placeholder'>
                              <Text>{artworkUnavailable ? '素材准备中' : '图片暂未加载，点击装备重试'}</Text>
                            </View>
                          )}
                        </View>
                        <Text className='my-image__item-name'>{entry.item.name}</Text>
                        {entry.item.rarity === 'rare' && <Text className='my-image__rare-badge'>稀有</Text>}
                        {selected && <View className='my-image__selection-mark' aria-hidden='true'><Text>✓</Text></View>}
                      </View>
                    )
                  })}
                </View>
              </View>

              {recentItems.length > 0 && (
                <View className='my-image__section'>
                  <Text className='my-image__section-title'>最近获得</Text>
                  <ScrollView className='my-image__recent' scrollX enhanced showScrollbar={false}>
                    {recentItems.map((entry) => {
                      const artworkUrl = getPixelEquipmentLayerUrl(entry.item.assetKey, data.archetypeId)
                      const artworkFailed = failedArtworkKeys.has(getArtworkFailureKey(entry.item))
                      return (
                        <View key={entry.id} className='my-image__recent-chip'>
                          {artworkUrl && !artworkFailed
                            ? <Image className='my-image__recent-art' src={artworkUrl} mode='aspectFit' lazyLoad aria-hidden='true' onError={() => markArtworkFailed(entry.item)} />
                            : <View className='my-image__recent-art-placeholder' aria-hidden='true' onClick={() => artworkFailed && retryArtwork(entry.item)}><Text>图</Text></View>}
                          <Text>{entry.item.name}</Text>
                        </View>
                      )
                    })}
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
              {shopQuery.isError && shopQuery.data && (
                <Text className='my-image__shop-cache-note'>商店暂未刷新，先展示上次目录。</Text>
              )}
              {!rewardsEnabled ? (
                <Text className='my-image__shop-disabled'>商店兑换暂未开放，已有装备和碎片会继续保留。</Text>
              ) : shopQuery.isLoading && !shopQuery.data ? (
                <Text className='my-image__shop-disabled'>正在整理装备目录…</Text>
              ) : shopQuery.isError && !shopQuery.data ? (
                <View className='my-image__shop-state' role='status'>
                  <Text className='my-image__shop-state-title'>商店目录暂时没有打开</Text>
                  <Text className='my-image__shop-state-copy'>碎片不会减少，可以重新加载。</Text>
                  <View className='my-image__shop-retry' onClick={() => shopQuery.refetch()} role='button' aria-label='重新加载商店目录'>
                    <Text>重新加载</Text>
                  </View>
                </View>
              ) : (shopQuery.data?.items.length ?? 0) === 0 ? (
                <View className='my-image__shop-state' role='status'>
                  <Text className='my-image__shop-state-title'>新装备正在准备</Text>
                  <Text className='my-image__shop-state-copy'>目录还是空的，稍后再来看看。</Text>
                </View>
              ) : (
                <View className='my-image__shop-grid'>
                  {(shopQuery.data?.items ?? []).map((item) => {
                    const artworkUrl = getPixelEquipmentLayerUrl(item.assetKey, data.archetypeId)
                    const artworkFailed = failedArtworkKeys.has(getArtworkFailureKey(item))
                    const artworkUnavailable = !artworkUrl
                    const actionDisabled = item.owned || redeemMutation.isPending || artworkUnavailable
                    return (
                      <View key={item.id} className={`my-image__shop-item${artworkUnavailable ? ' my-image__shop-item--unavailable' : ''}`}>
                        <View className={`my-image__item-icon my-image__item-icon--${item.rarity}`}>
                          {artworkUrl && !artworkFailed ? (
                            <Image
                              className='my-image__item-art'
                              src={artworkUrl}
                              mode='aspectFit'
                              lazyLoad
                              aria-hidden='true'
                              onError={() => markArtworkFailed(item)}
                            />
                          ) : (
                            <View
                              className='my-image__item-art-placeholder'
                              onClick={() => artworkFailed && retryArtwork(item)}
                              role={artworkFailed ? 'button' : undefined}
                              aria-label={artworkFailed ? `重新加载${item.name}图片` : undefined}
                            >
                              <Text>{artworkUnavailable ? '素材准备中' : '图片暂未加载，点击重试'}</Text>
                            </View>
                          )}
                        </View>
                        <Text className='my-image__shop-item-name'>{item.name}</Text>
                        <Text className='my-image__shop-item-meta'>{item.rarity === 'rare' ? '稀有' : '普通'} · {item.price} 碎片</Text>
                        <View
                          className={`my-image__shop-action${item.owned ? ' my-image__shop-action--owned' : ''}${artworkUnavailable ? ' my-image__shop-action--disabled' : ''}`}
                          onClick={() => !actionDisabled && void handleRedeem(item)}
                          role='button'
                          aria-label={artworkUnavailable ? `${item.name}素材准备中` : item.owned ? `已拥有${item.name}` : `兑换${item.name}`}
                          aria-disabled={actionDisabled}
                        ><Text>{artworkUnavailable ? '准备中' : item.owned ? '已拥有' : '兑换'}</Text></View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {activeTab === 'wardrobe' && (
        <View className='my-image__save-bar'>
          <View
            className={`my-image__save-button${!canSave ? ' my-image__save-button--disabled' : ''}`}
            onClick={() => canSave && saveMutation.mutate(draftOutfit)}
            role='button'
            aria-label={saveMutation.isPending ? '正在保存形象' : '保存形象'}
            aria-disabled={!canSave}
          ><Text>{saveMutation.isPending ? '正在保存…' : hasUnavailableDraftItem ? '素材准备中' : isDirty ? '保存形象' : '形象已保存'}</Text></View>
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
