import { describe, expect, it } from "vitest";

import {
  adminEquipmentItemCreateSchema,
  adminEquipmentPoolCreateSchema,
  adminEquipmentPoolItemsSchema,
  hasLaunchReadyEquipmentPoolComposition,
} from "../routes/domains/adminEquipment";
import {
  calculateEquipmentAnalyticsRates,
  evaluateAdminEquipmentConsistency,
} from "../repositories/adminEquipmentRepo";

const venueId = "11111111-1111-4111-8111-111111111111";
const missionId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";

describe("admin equipment validation", () => {
  it("requires exactly one authoritative pool source", () => {
    const base = { slug: "nanshan-cafe-v1", name: "南山咖啡馆装备池" };

    expect(adminEquipmentPoolCreateSchema.safeParse({ ...base, venueId }).success).toBe(true);
    expect(adminEquipmentPoolCreateSchema.safeParse({ ...base, alangMissionId: missionId }).success).toBe(true);
    expect(adminEquipmentPoolCreateSchema.safeParse(base).success).toBe(false);
    expect(adminEquipmentPoolCreateSchema.safeParse({ ...base, venueId, alangMissionId: missionId }).success).toBe(false);
  });

  it("rejects duplicate items and unsafe weights in one pool", () => {
    expect(adminEquipmentPoolItemsSchema.safeParse({
      items: [
        { itemId, weight: 80, isActive: true },
        { itemId, weight: 20, isActive: true },
      ],
    }).success).toBe(false);

    expect(adminEquipmentPoolItemsSchema.safeParse({
      items: [{ itemId, weight: 0, isActive: true }],
    }).success).toBe(false);
  });

  it("accepts only governed slots, rarities and asset keys", () => {
    const valid = {
      slug: "linen-jacket",
      name: "亚麻短外套",
      slot: "top",
      rarity: "rare",
      assetKey: "equipment/v1/top/linen-jacket.webp",
    };
    expect(adminEquipmentItemCreateSchema.safeParse(valid).success).toBe(true);
    expect(adminEquipmentItemCreateSchema.safeParse({ ...valid, slot: "hat" }).success).toBe(false);
    expect(adminEquipmentItemCreateSchema.safeParse({ ...valid, assetKey: "" }).success).toBe(false);
  });

  it("only treats a 4 common plus 2 rare pool as launch ready", () => {
    const ready = [
      ...Array.from({ length: 4 }, () => ({ rarity: "common", isActive: true })),
      ...Array.from({ length: 2 }, () => ({ rarity: "rare", isActive: true })),
    ];
    expect(hasLaunchReadyEquipmentPoolComposition(ready)).toBe(true);
    expect(hasLaunchReadyEquipmentPoolComposition(ready.slice(0, 5))).toBe(false);
    expect(hasLaunchReadyEquipmentPoolComposition([
      ...Array.from({ length: 5 }, () => ({ rarity: "common", isActive: true })),
      { rarity: "rare", isActive: true },
    ])).toBe(false);
  });

  it("calculates analytics rates with stable zero denominators", () => {
    expect(calculateEquipmentAnalyticsRates({ total: 10, resolved: 8, newItems: 5 })).toEqual({
      claimRate: 0.8,
      newItemRate: 0.625,
    });
    expect(calculateEquipmentAnalyticsRates({ total: 0, resolved: 0, newItems: 0 })).toEqual({
      claimRate: 0,
      newItemRate: 0,
    });
  });

  it("reports blocking and warning equipment consistency issues", () => {
    const result = evaluateAdminEquipmentConsistency({
      items: [
        { id: itemId, name: "停用外套", isActive: false, shopAvailable: true },
      ],
      pools: [],
      rollout: {
        profilePixelAvatarEnabled: true,
        equipmentRewardsEnabled: true,
      },
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toMatchObject({ blocking: 2, warnings: 1 });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "REWARDS_WITHOUT_ACTIVE_POOL",
      "AVATAR_WITHOUT_ACTIVE_ITEMS",
      "INACTIVE_ITEM_IN_SHOP",
    ]);
  });

  it("accepts a healthy launch-ready equipment configuration", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `item-${index}`,
      name: `装备 ${index}`,
      isActive: true,
      shopAvailable: false,
    }));
    const result = evaluateAdminEquipmentConsistency({
      items,
      pools: [{
        id: "pool-1",
        name: "健康装备池",
        isActive: true,
        items: items.map((item, index) => ({
          itemId: item.id,
          itemName: item.name,
          itemRarity: index < 4 ? "common" : "rare",
          isActive: true,
          itemIsActive: true,
        })),
      }],
      rollout: {
        profilePixelAvatarEnabled: true,
        equipmentRewardsEnabled: true,
      },
    });

    expect(result.status).toBe("healthy");
    expect(result.summary).toEqual({ checks: 5, passed: 5, blocking: 0, warnings: 0 });
    expect(result.issues).toEqual([]);
  });
});
