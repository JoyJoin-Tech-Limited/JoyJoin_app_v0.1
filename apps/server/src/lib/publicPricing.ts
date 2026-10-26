import type { PricingSetting } from "@shared/schema";

/**
 * Shape returned by the public `GET /api/pricing` endpoint.
 *
 * The mini-program reads `price` (yuan) and `planType` (`monthly`,
 * `quarterly`, `event_single`, `pack_3`, `pack_6`) directly, while the
 * admin API exposes the raw `priceInCents` row. Keep this serializer as the
 * single definition of the public contract — a silent key rename here would
 * make both payment pages fall back to hardcoded prices.
 */
export interface PublicPricingPlan {
  id: string;
  planType: string;
  displayName: string;
  displayNameEn: string | null;
  /** Legacy aliases kept for older clients. */
  name: string;
  nameEn: string | null;
  description: string | null;
  /** Yuan, not cents. */
  price: number;
  originalPrice: number | null;
  durationDays: number | null;
  isActive: boolean;
  isFeatured: boolean | null;
}

export function serializePricingSetting(
  setting: PricingSetting
): PublicPricingPlan {
  return {
    id: setting.id,
    planType: setting.planType,
    displayName: setting.displayName,
    displayNameEn: setting.displayNameEn,
    name: setting.displayName,
    nameEn: setting.displayNameEn,
    description: setting.description,
    price: setting.priceInCents / 100,
    originalPrice: setting.originalPriceInCents
      ? setting.originalPriceInCents / 100
      : null,
    durationDays: setting.durationDays,
    isActive: setting.isActive,
    isFeatured: setting.isFeatured,
  };
}

export function serializePricingSettings(
  settings: PricingSetting[]
): PublicPricingPlan[] {
  return settings.map(serializePricingSetting);
}
