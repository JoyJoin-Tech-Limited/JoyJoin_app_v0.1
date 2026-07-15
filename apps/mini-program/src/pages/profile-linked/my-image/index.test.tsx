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
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, userSelect: _userSelect, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
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

vi.mock('../../../lib/profile/pixelAvatarAssets', () => ({
  getPixelAvatarBaseUrl: () => 'https://cdn.example.test/base.webp',
  getPixelEquipmentLayerUrl: (assetKey: string) => `https://cdn.example.test/${assetKey}.webp`,
}))

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
  assetKey: 'starlight-jacket',
  compatibleArchetypes: null,
}

const accessoryItem = {
  id: 'item-accessory-1',
  slug: 'warm-pin',
  name: '暖光胸针',
  description: '一枚柔和的胸针',
  slot: 'accessory' as const,
  rarity: 'common' as const,
  assetKey: 'warm-pin',
  compatibleArchetypes: null,
}

const oldCatStarter = {
  id: 'item-cat-starter-top',
  slug: 'cat-starter-top',
  name: 'Old Cat Starter',
  description: 'Starter retained from the previous archetype',
  slot: 'top' as const,
  rarity: 'common' as const,
  assetKey: 'starter/cat/top',
  compatibleArchetypes: ['cat'],
}

const owlStarter = {
  id: 'item-owl-starter-top',
  slug: 'owl-starter-top',
  name: 'Current Owl Starter',
  description: 'Starter for the current archetype',
  slot: 'top' as const,
  rarity: 'common' as const,
  assetKey: 'starter/owl/top',
  compatibleArchetypes: ['owl'],
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
    expect(container.querySelector('.my-image__avatar-layer--base')).toBeTruthy()
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
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '穿上星夜夹克' }))

    expect(mocks.saveMyEquipmentOutfit).not.toHaveBeenCalled()
    expect(screen.getByText('保存形象')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '脱下上装' }))
    expect(mocks.saveMyEquipmentOutfit).not.toHaveBeenCalled()

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
})
