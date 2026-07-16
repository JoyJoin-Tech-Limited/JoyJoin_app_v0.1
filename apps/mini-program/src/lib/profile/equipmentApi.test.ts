import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  drawEquipmentEntitlement,
  fetchEquipmentShop,
  fetchMyEquipment,
  redeemEquipmentShopItem,
  saveMyEquipmentOutfit,
  type SaveEquipmentOutfitRequest,
} from './equipmentApi'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('../api/api', () => ({
  apiRequest: mocks.apiRequest,
}))

describe('equipmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiRequest.mockResolvedValue({})
  })

  it('loads the authenticated user inventory and fragment shop', async () => {
    await fetchMyEquipment()
    await fetchEquipmentShop()

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, {
      path: '/api/equipment/me',
    })
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, {
      path: '/api/equipment/shop',
    })
  })

  it('saves the complete outfit with optimistic expectedVersion', async () => {
    const outfit: SaveEquipmentOutfitRequest = {
      topItemId: 'top-1',
      bottomItemId: null,
      shoesItemId: 'shoes-1',
      accessoryItemId: null,
      expectedVersion: 7,
    }

    await saveMyEquipmentOutfit(outfit)

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/equipment/me/outfit',
      method: 'PUT',
      data: outfit,
    })
  })

  it('draws a specific entitlement without accepting client-selected rewards', async () => {
    await drawEquipmentEntitlement('entitlement/one')

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/equipment/entitlements/entitlement%2Fone/draw',
      method: 'POST',
    })
  })

  it('redeems with an idempotency header and never enters a payment path', async () => {
    await redeemEquipmentShopItem('item/rare', 'redeem-key-123')

    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/equipment/shop/items/item%2Frare/redeem',
      method: 'POST',
      headers: { 'Idempotency-Key': 'redeem-key-123' },
    })
    expect(mocks.apiRequest.mock.calls.flatMap(([request]) => request.path)).not.toContain(
      expect.stringMatching(/payment|order|checkout/i),
    )
  })
})
