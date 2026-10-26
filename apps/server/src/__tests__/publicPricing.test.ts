/**
 * Locks the public `GET /api/pricing` contract.
 *
 * The mini-program reads `price` (yuan) and `planType` directly and falls
 * back to hardcoded prices (98 / 294 / 211 / 370) when a field is missing,
 * so a silent rename or a cents/yuan regression would look like a working
 * page charging the wrong amount. The admin console reads the same table
 * through `/api/admin/pricing` in cents — both shapes must stay distinct.
 */
import { describe, expect, it } from "vitest";
import type { PricingSetting } from "@shared/schema";
import {
  serializePricingSetting,
  serializePricingSettings,
  type PublicPricingPlan,
} from "../lib/publicPricing";

function makeSetting(overrides: Partial<PricingSetting> = {}): PricingSetting {
  return {
    id: "plan-monthly",
    planType: "monthly",
    displayName: "悦聚月卡",
    displayNameEn: "YueJu Monthly",
    description: "每月 6 场局，说走就走",
    priceInCents: 9800,
    originalPriceInCents: null,
    durationDays: 30,
    sortOrder: 1,
    isActive: true,
    isFeatured: false,
    effectiveFrom: null,
    effectiveUntil: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PricingSetting;
}

describe("serializePricingSetting (public /api/pricing)", () => {
  it("returns yuan, not cents", () => {
    expect(serializePricingSetting(makeSetting()).price).toBe(98);
    expect(serializePricingSetting(makeSetting({ priceInCents: 29400 })).price).toBe(294);
    expect(serializePricingSetting(makeSetting({ priceInCents: 37000 })).price).toBe(370);
  });

  it("converts a set original price and keeps it null otherwise", () => {
    expect(
      serializePricingSetting(makeSetting({ originalPriceInCents: 12800 })).originalPrice
    ).toBe(128);
    expect(serializePricingSetting(makeSetting()).originalPrice).toBeNull();
  });

  it("keeps the legacy name aliases the mini-program reads", () => {
    const plan = serializePricingSetting(makeSetting());
    expect(plan.name).toBe("悦聚月卡");
    expect(plan.nameEn).toBe("YueJu Monthly");
    expect(plan.displayName).toBe("悦聚月卡");
  });

  it("exposes exactly the public key set and never leaks cents or bookkeeping columns", () => {
    const plan = serializePricingSetting(makeSetting());
    expect(Object.keys(plan).sort()).toEqual(
      [
        "description",
        "displayName",
        "displayNameEn",
        "durationDays",
        "id",
        "isActive",
        "isFeatured",
        "name",
        "nameEn",
        "originalPrice",
        "planType",
        "price",
      ].sort()
    );

    for (const internal of [
      "priceInCents",
      "originalPriceInCents",
      "sortOrder",
      "createdAt",
      "updatedAt",
      "effectiveFrom",
      "effectiveUntil",
      "createdBy",
      "updatedBy",
    ]) {
      expect(plan).not.toHaveProperty(internal);
    }
  });

  it("passes planType through unchanged (monthly/quarterly/event_single/pack_3/pack_6)", () => {
    for (const planType of ["monthly", "quarterly", "event_single", "pack_3", "pack_6"]) {
      expect(serializePricingSetting(makeSetting({ planType })).planType).toBe(planType);
    }
  });

  it("maps arrays in order", () => {
    const plans = serializePricingSettings([
      makeSetting({ id: "a", planType: "monthly", priceInCents: 9800 }),
      makeSetting({ id: "b", planType: "pack_3", priceInCents: 21100 }),
    ]);
    expect(plans.map((p: PublicPricingPlan) => [p.planType, p.price])).toEqual([
      ["monthly", 98],
      ["pack_3", 211],
    ]);
  });
});
