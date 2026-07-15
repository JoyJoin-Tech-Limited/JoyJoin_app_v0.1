import { apiRequest } from '../api/api'
import type {
  EquipmentDrawResponse,
  EquipmentItemView as EquipmentItem,
  EquipmentMeResponse,
  EquipmentOutfitInput as SaveEquipmentOutfitRequest,
  EquipmentOutfitView as EquipmentOutfit,
  EquipmentShopRedeemResponse,
  EquipmentShopResponse,
  EquipmentSlot,
} from '@joyjoin/shared'

export type {
  EquipmentDrawResponse,
  EquipmentItem,
  EquipmentMeResponse,
  EquipmentOutfit,
  EquipmentShopResponse,
  EquipmentSlot,
  SaveEquipmentOutfitRequest,
}

export function fetchMyEquipment(): Promise<EquipmentMeResponse> {
  return apiRequest<EquipmentMeResponse>({ path: '/api/equipment/me' })
}

export function saveMyEquipmentOutfit(data: SaveEquipmentOutfitRequest) {
  return apiRequest<{ outfit: EquipmentOutfit; saved: true }>({
    path: '/api/equipment/me/outfit',
    method: 'PUT',
    data,
  })
}

export function drawEquipmentEntitlement(entitlementId: string) {
  return apiRequest<EquipmentDrawResponse>({
    path: `/api/equipment/entitlements/${encodeURIComponent(entitlementId)}/draw`,
    method: 'POST',
  })
}

export function fetchEquipmentShop(): Promise<EquipmentShopResponse> {
  return apiRequest<EquipmentShopResponse>({ path: '/api/equipment/shop' })
}

export function redeemEquipmentShopItem(itemId: string, idempotencyKey: string) {
  return apiRequest<EquipmentShopRedeemResponse>({
    path: `/api/equipment/shop/items/${encodeURIComponent(itemId)}/redeem`,
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}
