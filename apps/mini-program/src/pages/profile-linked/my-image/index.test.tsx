import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentMeResponse } from '../../../lib/profile/equipmentApi'
import MyImagePage from './index'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    user: {
      id: 'current-user',
      features: {
        profilePixelAvatarEnabled: true,
        equipmentRewardsEnabled: true,
      },
    } as any,
  },
  fetchMyEquipment: vi.fn(),
  saveMyEquipmentOutfit: vi.fn(),
  drawEquipmentEntitlement: vi.fn(),
  fetchEquipmentShop: vi.fn(),
  redeemEquipmentShopItem: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  requestPayment: vi.fn(),
  haptics: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    showModal: mocks.showModal,
    showToast: mocks.showToast,
    requestPayment: mocks.requestPayment,
  },
  // PixelAvatar3D registers page lifecycle hooks unconditionally (rules of hooks).
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
}))

vi.mock('../../../lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, userSelect: _userSelect, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img alt='' {...props} />,
  Canvas: ({ children: _children, ...props }: any) => <canvas {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, scrollX: _scrollX, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('../../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => mocks.auth,
}))

vi.mock('../../../lib/profile/equipmentApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/profile/equipmentApi')>()
  return {
    ...actual,
    fetchMyEquipment: mocks.fetchMyEquipment,
    saveMyEquipmentOutfit: mocks.saveMyEquipmentOutfit,
    drawEquipmentEntitlement: mocks.drawEquipmentEntitlement,
    fetchEquipmentShop: mocks.fetchEquipmentShop,
    redeemEquipmentShopItem: mocks.redeemEquipmentShopItem,
  }
})

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../../components/mascot/ArchetypeHead', () => ({
  default: () => <div>avatar fallback</div>,
}))

const topItem = {
  id: 'item-top-1',
  slug: 'starlight-jacket',
  name: '星夜夹克',
  description: '一件深紫色夹克',
  slot: 'top' as const,
  rarity: 'rare' as const,
  assetKey: 'equipment/starter/cat/top/v1',
  compatibleArchetypes: null,
}

const accessoryItem = {
  id: 'item-accessory-1',
  slug: 'warm-pin',
  name: '暖光胸针',
  description: '一枚柔和的胸针',
  slot: 'accessory' as const,
  rarity: 'common' as const,
  assetKey: 'equipment/starter/cat/accessory/v1',
  compatibleArchetypes: null,
}

const oldCatStarter = {
  id: 'item-cat-starter-top',
  slug: 'cat-starter-top',
  name: 'Old Cat Starter',
  description: 'Starter retained from the previous archetype',
  slot: 'top' as const,
  rarity: 'common' as const,
  assetKey: 'equipment/starter/cat/top/v1',
  compatibleArchetypes: ['cat'],
}

const owlStarter = {
  id: 'item-owl-starter-top',
  slug: 'owl-starter-top',
  name: 'Current Owl Starter',
  description: 'Starter for the current archetype',
  slot: 'top' as const,
  rarity: 'common' as const,
  assetKey: 'equipment/starter/owl/top/v1',
  compatibleArchetypes: ['owl'],
}

const unavailableTopItem = {
  id: 'item-top-unavailable',
  slug: 'future-jacket',
  name: '未来夹克',
  description: '素材尚未发布的装备',
  slot: 'top' as const,
  rarity: 'common' as const,
  assetKey: 'equipment/future/cat/top/v1',
  compatibleArchetypes: ['cat'],
}

const baseEquipment: EquipmentMeResponse = {
  archetypeId: 'cat',
  outfit: {
    topItemId: null,
    bottomItemId: null,
    shoesItemId: null,
    accessoryItemId: null,
    version: 7,
  },
  inventory: [
    {
      id: 'inventory-top-1',
      itemId: topItem.id,
      sourceType: 'draw',
      sourceId: 'entitlement-1',
      acquiredAt: '2026-07-15T10:00:00.000Z',
      item: topItem,
    },
    {
      id: 'inventory-accessory-1',
      itemId: accessoryItem.id,
      sourceType: 'shop',
      sourceId: 'redemption-1',
      acquiredAt: '2026-07-15T11:00:00.000Z',
      item: accessoryItem,
    },
  ],
  recentItems: [],
  wallet: {
    fragmentBalance: 45,
    pityMisses: 2,
    pityTarget: 4,
  },
  pendingEntitlements: [{
    id: 'entitlement-1',
    sourceType: 'blind_box',
    sourceRecordId: 'activity-1',
    poolId: 'pool-1',
    createdAt: '2026-07-15T09:00:00.000Z',
    pool: {
      id: 'pool-1',
      slug: 'bay-park',
      name: '湾公园夜游',
    },
  }],
  rewardsEnabled: true,
}

function renderPage(data: EquipmentMeResponse = baseEquipment, primeFetch = true) {
  if (primeFetch) mocks.fetchMyEquipment.mockResolvedValue(data)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { ...render(<MyImagePage />, { wrapper: Wrapper }), queryClient }
}

describe('MyImagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.isLoading = false
    mocks.auth.user = {
      id: 'current-user',
      features: {
        profilePixelAvatarEnabled: true,
        equipmentRewardsEnabled: true,
      },
    }
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.saveMyEquipmentOutfit.mockImplementation(async (outfit) => ({
      saved: true,
      outfit: { ...outfit, version: outfit.expectedVersion + 1 },
    }))
    mocks.drawEquipmentEntitlement.mockResolvedValue({
      entitlementId: 'entitlement-1',
      replayed: false,
      item: topItem,
      resultKind: 'new',
      fragmentsAwarded: 0,
      fragmentBalance: 45,
      pityMisses: 0,
      pityTarget: 4,
      guaranteed: false,
      poolComplete: false,
    })
    mocks.fetchEquipmentShop.mockResolvedValue({
      fragmentBalance: 45,
      prices: { common: 20, rare: 40 },
      items: [{ ...accessoryItem, price: 20, owned: false }],
    })
    mocks.redeemEquipmentShopItem.mockResolvedValue({
      item: accessoryItem,
      replayed: false,
      alreadyOwned: false,
      fragmentBalance: 25,
      cost: 20,
    })
  })

  it('shows a stable feature-disabled state without loading private equipment data', () => {
    mocks.auth.user = {
      id: 'current-user',
      features: {
        profilePixelAvatarEnabled: false,
        equipmentRewardsEnabled: false,
      },
    }

    renderPage()

    expect(screen.getByText('我的形象暂未开放')).toBeInTheDocument()
    expect(screen.getByText('你的资料和原有人格结果不会受到影响。')).toBeInTheDocument()
    expect(mocks.fetchMyEquipment).not.toHaveBeenCalled()
  })

  it('renders owned inventory and fragment balance', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('星夜夹克')).toBeInTheDocument()
    expect(screen.getByText('稀有')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存形象' })).toHaveAttribute('aria-disabled', 'true')
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    expect(container.querySelector<HTMLImageElement>('.my-image__item-art')?.src)
      .toMatch(/layer-v2\.[a-f0-9]{12}\.webp/)
    expect(screen.getByText('基础内搭不可脱')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar')).toBeNull()
  })

  it('filters old-archetype inventory while keeping the current starter saveable', async () => {
    renderPage({
      ...baseEquipment,
      archetypeId: 'owl',
      outfit: {
        ...baseEquipment.outfit,
        topItemId: oldCatStarter.id,
        version: 8,
      },
      inventory: [
        {
          id: 'inventory-old-cat-starter',
          itemId: oldCatStarter.id,
          sourceType: 'initial',
          sourceId: null,
          acquiredAt: '2026-07-14T10:00:00.000Z',
          item: oldCatStarter,
        },
        {
          id: 'inventory-current-owl-starter',
          itemId: owlStarter.id,
          sourceType: 'initial',
          sourceId: null,
          acquiredAt: '2026-07-15T10:00:00.000Z',
          item: owlStarter,
        },
      ],
      recentItems: [{
        id: 'inventory-old-cat-starter',
        itemId: oldCatStarter.id,
        sourceType: 'initial',
        sourceId: null,
        acquiredAt: '2026-07-14T10:00:00.000Z',
        item: oldCatStarter,
      }],
    })

    expect(await screen.findByText('Current Owl Starter')).toBeInTheDocument()
    expect(screen.queryByText('Old Cat Starter')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Current Owl Starter/ }))
    const saveButton = screen.getByRole('button', { name: /保存形象/ })
    fireEvent.click(saveButton)

    await waitFor(() => expect(mocks.saveMyEquipmentOutfit).toHaveBeenCalledWith({
      topItemId: owlStarter.id,
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
      expectedVersion: 8,
    }))
  })

  it('shows a retry state when the initial wardrobe request fails and recovers in place', async () => {
    mocks.fetchMyEquipment.mockRejectedValueOnce(new Error('network unavailable'))
    renderPage(baseEquipment, false)

    expect(await screen.findByText('衣橱暂时没有打开')).toBeInTheDocument()
    expect(screen.queryByText('正在整理你的衣橱…')).not.toBeInTheDocument()

    mocks.fetchMyEquipment.mockResolvedValueOnce(baseEquipment)
    fireEvent.click(screen.getByRole('button', { name: '重新加载衣橱' }))

    expect(await screen.findByText('星夜夹克')).toBeInTheDocument()
    expect(mocks.fetchMyEquipment).toHaveBeenCalledTimes(2)
  })

  it('keeps equip and unequip choices as a draft until explicit Save', async () => {
    const { container } = renderPage()
    const equipButton = await screen.findByRole('button', { name: '穿上星夜夹克' })
    expect(equipButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(equipButton)

    expect(mocks.saveMyEquipmentOutfit).not.toHaveBeenCalled()
    expect(screen.getByText('保存形象')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeTruthy()
    expect(equipButton).toHaveAttribute('aria-pressed', 'true')
    expect(equipButton.querySelector('.my-image__selection-mark')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '脱下上装' }))
    expect(mocks.saveMyEquipmentOutfit).not.toHaveBeenCalled()
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeNull()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '穿上星夜夹克' }))
    fireEvent.click(screen.getByRole('button', { name: '保存形象' }))

    await waitFor(() => expect(mocks.saveMyEquipmentOutfit).toHaveBeenCalledWith({
      topItemId: topItem.id,
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
      expectedVersion: 7,
    }))
  })

  it('keeps unpublished equipment disabled and never persists its item id', async () => {
    const { container } = renderPage({
      ...baseEquipment,
      inventory: [{
        id: 'inventory-top-unavailable',
        itemId: unavailableTopItem.id,
        sourceType: 'draw',
        sourceId: 'future-pool',
        acquiredAt: '2026-07-15T12:00:00.000Z',
        item: unavailableTopItem,
      }],
    })

    const unavailableButton = await screen.findByRole('button', { name: '未来夹克，素材准备中' })
    expect(unavailableButton).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('素材准备中')).toBeInTheDocument()

    fireEvent.click(unavailableButton)

    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeNull()
    expect(screen.getByRole('button', { name: '保存形象' })).toHaveAttribute('aria-disabled', 'true')
    expect(mocks.saveMyEquipmentOutfit).not.toHaveBeenCalled()
  })

  it('keeps a previously saved unpublished item until the user explicitly removes it', async () => {
    renderPage({
      ...baseEquipment,
      outfit: {
        ...baseEquipment.outfit,
        topItemId: unavailableTopItem.id,
      },
      inventory: [{
        id: 'inventory-top-unavailable',
        itemId: unavailableTopItem.id,
        sourceType: 'draw',
        sourceId: 'future-pool',
        acquiredAt: '2026-07-15T12:00:00.000Z',
        item: unavailableTopItem,
      }],
    })

    expect(await screen.findByRole('button', { name: '未来夹克，素材准备中' })).toHaveAttribute('aria-disabled', 'true')
    const saveButton = screen.getByRole('button', { name: '保存形象' })
    expect(saveButton).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveAccessibleName('1件装备素材准备中')

    fireEvent.click(screen.getByRole('button', { name: '脱下上装' }))

    expect(saveButton).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(saveButton)

    await waitFor(() => expect(mocks.saveMyEquipmentOutfit).toHaveBeenCalledWith({
      topItemId: null,
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
      expectedVersion: 7,
    }))
  })

  it('replaces a failed equipment thumbnail with a visible retry state', async () => {
    renderPage()
    const equipButton = await screen.findByRole('button', { name: '穿上星夜夹克' })
    const thumbnail = equipButton.querySelector<HTMLImageElement>('.my-image__item-art')

    expect(thumbnail).toBeTruthy()
    fireEvent.error(thumbnail!)

    expect(equipButton).toHaveTextContent('图片暂未加载，点击装备重试')

    fireEvent.click(equipButton)

    expect(equipButton.querySelector('.my-image__item-art')).toBeInTheDocument()
  })

  it('saves null after removing an equipped item while keeping the permanent base layer', async () => {
    const { container } = renderPage({
      ...baseEquipment,
      outfit: {
        ...baseEquipment.outfit,
        topItemId: topItem.id,
      },
    })

    expect(await screen.findByText('星夜夹克')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '脱下上装' }))

    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeNull()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存形象' }))

    await waitFor(() => expect(mocks.saveMyEquipmentOutfit).toHaveBeenCalledWith({
      topItemId: null,
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
      expectedVersion: 7,
    }))
  })

  it('requires confirmation before manually drawing an earned entitlement', async () => {
    mocks.showModal.mockResolvedValueOnce({ confirm: false, cancel: true })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: '开启湾公园夜游装备池' }))
    await waitFor(() => expect(mocks.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '开启地点装备池',
      confirmText: '开始抽取',
    })))
    expect(mocks.drawEquipmentEntitlement).not.toHaveBeenCalled()

    mocks.showModal.mockResolvedValueOnce({ confirm: true, cancel: false })
    fireEvent.click(screen.getByRole('button', { name: '开启湾公园夜游装备池' }))

    await waitFor(() => expect(mocks.drawEquipmentEntitlement.mock.calls[0]?.[0]).toBe('entitlement-1'))
    expect(await screen.findByRole('dialog', { name: '装备抽取结果' })).toBeInTheDocument()
  })

  it('redeems with a generated idempotency key and never invokes payment', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: '碎片商店' }))
    fireEvent.click(await screen.findByRole('button', { name: '兑换暖光胸针' }))

    await waitFor(() => expect(mocks.redeemEquipmentShopItem).toHaveBeenCalledWith(
      accessoryItem.id,
      expect.stringMatching(/^equipment-shop-item-accessory-1-/),
    ))
    expect(mocks.requestPayment).not.toHaveBeenCalled()
  })

  it('shows an explicit retry state when the shop request fails', async () => {
    mocks.fetchEquipmentShop.mockRejectedValueOnce(new Error('shop unavailable'))
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: '碎片商店' }))

    expect(await screen.findByText('商店目录暂时没有打开')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载商店目录' }))

    expect(await screen.findByRole('button', { name: '兑换暖光胸针' })).toBeInTheDocument()
    expect(mocks.fetchEquipmentShop).toHaveBeenCalledTimes(2)
  })

  it('shows a warm empty state when the shop directory has no items', async () => {
    mocks.fetchEquipmentShop.mockResolvedValueOnce({
      fragmentBalance: 45,
      prices: { common: 20, rare: 40 },
      items: [],
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: '碎片商店' }))

    expect(await screen.findByText('新装备正在准备')).toBeInTheDocument()
    expect(screen.getByText('目录还是空的，稍后再来看看。')).toBeInTheDocument()
  })

  it('keeps the inventory page usable when saving the draft fails', async () => {
    mocks.saveMyEquipmentOutfit.mockRejectedValueOnce(new Error('conflict'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '穿上星夜夹克' }))
    fireEvent.click(screen.getByRole('button', { name: '保存形象' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith({
      title: '形象没有保存，请重新选择',
      icon: 'none',
    }))
    expect(await screen.findByText('星夜夹克')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存形象' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the honest 3D-preparing notice for non-spider personas (no WebGL boot)', async () => {
    renderPage()

    // cat persona: the 3D gate falls back synchronously to the V2 turntable.
    expect(await screen.findByText('该人格 3D 形象正在准备，先展示经典形象')).toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('gives light haptic feedback on slot-tab, equip and unequip taps', async () => {
    renderPage()
    await screen.findByText('星夜夹克')

    fireEvent.click(screen.getByRole('button', { name: '选择下装槽位' }))
    expect(mocks.haptics).toHaveBeenCalledWith('light')

    mocks.haptics.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '选择上装槽位' }))
    fireEvent.click(screen.getByRole('button', { name: '穿上星夜夹克' }))
    expect(mocks.haptics).toHaveBeenCalledWith('light')

    mocks.haptics.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '脱下上装' }))
    expect(mocks.haptics).toHaveBeenCalledWith('light')
  })
})
