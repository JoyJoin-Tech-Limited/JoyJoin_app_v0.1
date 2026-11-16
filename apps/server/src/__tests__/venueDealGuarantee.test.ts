/**
 * venue-deal S2：可兑现判定 / 选择 / 映射 / 保底分配决策 / reason 可观测性
 * 合同：.git/.orchestration/sprints/sprint-contract.venue-deals-s2.md（D1–D8）
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isRedeemableVenueDeal,
  selectRedeemableVenueDeal,
  toVenueDealSummary,
} from "../lib/venueDealVisibility";
import { planGuaranteedGroupAssignment } from "../venueAssignmentService";
import {
  observeVenueAssignmentRun,
  getMatchingMetricsSnapshot,
} from "../matchingMetrics";
import { getGroupVenueDeal } from "../repositories/venueDealsRepo";

// repository 在部分绑定场景下必须在任何 DB 访问之前返回 null
vi.mock("../db", () => ({ db: {} }));

let seq = 0;
function deal(overrides: Record<string, any> = {}): any {
  seq += 1;
  return {
    id: `deal-${seq}`,
    venueId: "venue-1",
    title: "本场专属折扣",
    description: "无门槛全单通用",
    discountType: "percentage",
    discountValue: 20,
    redemptionMethod: "show_page",
    redemptionCode: null,
    isActive: true,
    setMenuPriceCents: null,
    setMenuOriginalPriceCents: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    ...overrides,
  };
}

describe("isRedeemableVenueDeal（D4，自身含 isActive）", () => {
  it("接受 show_page 折扣", () => {
    expect(isRedeemableVenueDeal(deal())).toBe(true);
  });
  it("停用权益不可兑现", () => {
    expect(isRedeemableVenueDeal(deal({ isActive: false }))).toBe(false);
  });
  it("legacy fixed/gift/qr_code 不可兑现", () => {
    expect(isRedeemableVenueDeal(deal({ discountType: "fixed" }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ discountType: "gift" }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ redemptionMethod: "qr_code" }))).toBe(false);
  });
  it("折扣面值必须 1–90 整数", () => {
    expect(isRedeemableVenueDeal(deal({ discountValue: 0 }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ discountValue: 91 }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ discountValue: 19.5 }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ discountValue: null }))).toBe(false);
  });
  it("code 形态必须有 2–8 字暗号", () => {
    expect(isRedeemableVenueDeal(deal({ redemptionMethod: "code", redemptionCode: "悦聚同桌" }))).toBe(true);
    expect(isRedeemableVenueDeal(deal({ redemptionMethod: "code", redemptionCode: null }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ redemptionMethod: "code", redemptionCode: "悦" }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ redemptionMethod: "code", redemptionCode: "悦聚同桌四人一起行" }))).toBe(false);
  });
  it("套餐必须 show_page 且原价 > 一口价", () => {
    const setMenu = { discountType: "set_menu", discountValue: null, setMenuPriceCents: 59800, setMenuOriginalPriceCents: 75800 };
    expect(isRedeemableVenueDeal(deal(setMenu))).toBe(true);
    expect(isRedeemableVenueDeal(deal({ ...setMenu, redemptionMethod: "code", redemptionCode: "悦聚同桌" }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ ...setMenu, setMenuOriginalPriceCents: 59800 }))).toBe(false);
    expect(isRedeemableVenueDeal(deal({ ...setMenu, setMenuPriceCents: null }))).toBe(false);
  });
});

describe("selectRedeemableVenueDeal（统一选择入口）", () => {
  it("较新的停用权益被跳过，取较旧的有效可兑现一张", () => {
    const older = deal({ id: "older", createdAt: new Date("2026-10-01") });
    const newerInactive = deal({ id: "newer-inactive", isActive: false, createdAt: new Date("2026-11-10") });
    expect(selectRedeemableVenueDeal([older, newerInactive])?.id).toBe("older");
  });
  it("较新的 legacy 权益同样被跳过", () => {
    const older = deal({ id: "older", createdAt: new Date("2026-10-01") });
    const legacy = deal({ id: "legacy", discountType: "gift", createdAt: new Date("2026-11-10") });
    expect(selectRedeemableVenueDeal([legacy, older])?.id).toBe("older");
  });
  it("全部停用/不可兑现返回 null", () => {
    expect(selectRedeemableVenueDeal([deal({ isActive: false }), deal({ discountType: "gift" })])).toBeNull();
    expect(selectRedeemableVenueDeal([])).toBeNull();
    expect(selectRedeemableVenueDeal(null)).toBeNull();
  });
});

describe("toVenueDealSummary（valueOffPercent 直接拷贝，禁止 100-x）", () => {
  it("discountValue=20 → valueOffPercent=20（8 折），90 → 90（1 折）", () => {
    expect(toVenueDealSummary(deal({ discountValue: 20 }), "山止川行").valueOffPercent).toBe(20);
    expect(toVenueDealSummary(deal({ discountValue: 90 }), "山止川行").valueOffPercent).toBe(90);
  });
  it("折扣 DTO 不带套餐价，show_page 不带 code", () => {
    const dto = toVenueDealSummary(deal(), "山止川行");
    expect(dto.kind).toBe("discount");
    expect(dto.method).toBe("show_page");
    expect(dto.code).toBeUndefined();
    expect(dto.setMenuPriceCents).toBeUndefined();
    expect(dto.venueName).toBe("山止川行");
  });
  it("code 形态带暗号", () => {
    const dto = toVenueDealSummary(deal({ redemptionMethod: "code", redemptionCode: "悦聚同桌" }), "店");
    expect(dto.code).toBe("悦聚同桌");
  });
  it("套餐映射两个分字段", () => {
    const dto = toVenueDealSummary(
      deal({ discountType: "set_menu", discountValue: null, setMenuPriceCents: 59800, setMenuOriginalPriceCents: 75800 }),
      "店",
    );
    expect(dto.kind).toBe("set_menu");
    expect(dto.setMenuPriceCents).toBe(59800);
    expect(dto.setMenuOriginalPriceCents).toBe(75800);
    expect(dto.valueOffPercent).toBeUndefined();
  });
});

describe("planGuaranteedGroupAssignment（D3/D8）", () => {
  it("座位与时段都满足 → ok", () => {
    expect(planGuaranteedGroupAssignment({ seatingCapacity: 8, groupSize: 6, slotRemaining: 1 }).ok).toBe(true);
  });
  it("时段并发耗尽 → guaranteed_venue_no_slot（maxConcurrentEvents=1 时第二组必然失败）", () => {
    expect(planGuaranteedGroupAssignment({ seatingCapacity: 8, groupSize: 6, slotRemaining: 0 })).toEqual({
      ok: false,
      reason: "guaranteed_venue_no_slot",
    });
  });
  it("座位不足 → guaranteed_venue_capacity", () => {
    expect(planGuaranteedGroupAssignment({ seatingCapacity: 4, groupSize: 6, slotRemaining: 1 })).toEqual({
      ok: false,
      reason: "guaranteed_venue_capacity",
    });
  });
  it("时段耗尽优先于座位不足", () => {
    expect(planGuaranteedGroupAssignment({ seatingCapacity: 4, groupSize: 6, slotRemaining: 0 })).toEqual({
      ok: false,
      reason: "guaranteed_venue_no_slot",
    });
  });
});

describe("分配器源码契约（D1/D2/D5/D8）", () => {
  const src = readFileSync(resolve(__dirname, "../venueAssignmentService.ts"), "utf8");
  it("每次 run 按 poolId 自读一次保底绑定（调用方零改动）", () => {
    expect(src.match(/await getPoolGuarantee\(/g)?.length).toBe(1);
  });
  it("任一字段单独存在即 fail-closed", () => {
    expect(src).toContain("guaranteed_binding_incomplete");
  });
  it("保底绕过打分但复用 slotUsageTracker", () => {
    expect(src).toContain("planGuaranteedGroupAssignment({");
    expect(src).toContain('reasons: ["guaranteed_pool_venue"]');
    expect(src).toContain("slotUsageTracker.set(timeSlot.id, used + 1)");
  });
  it("通用提前返回分支在保底池改写 reason", () => {
    expect(src).toContain('guaranteedVenueId ? "guaranteed_venue_no_slot" : "no_available_slots"');
  });
  it("分配前校验保底权益可兑现", () => {
    expect(src).toContain("guaranteed_deal_unavailable");
    expect(src).toContain("isRedeemableVenueDeal(lockedDeal)");
  });
});

describe("用户路由源码契约（AC-04/AC-05）", () => {
  const src = readFileSync(resolve(__dirname, "../routes/domains/userEventPools.ts"), "utf8");
  it("池列表与池详情都不再展开原始 pool", () => {
    expect(src).not.toContain("...pool,");
    expect(src.match(/\.\.\.publicPool,/g)?.length).toBe(2);
  });
  it("池详情返回 hasGuaranteedDeal，小组详情返回 venueDeal", () => {
    expect(src).toContain("hasGuaranteedDeal,");
    expect(src).toContain("venueDeal,");
    expect(src).toContain("await getGroupVenueDeal({");
  });
});

describe("新 reason 的 metrics 标签（OBS-01）", () => {
  it("guaranteed_* 不再归入 __other__", () => {
    observeVenueAssignmentRun({
      assignedCount: 0,
      unassignedByReason: { guaranteed_deal_unavailable: 2, guaranteed_venue_capacity: 1 },
    });
    const snapshot = getMatchingMetricsSnapshot();
    const reasons = snapshot.venueAssignment.unassignedByReason;
    expect(reasons.guaranteed_deal_unavailable).toBeGreaterThanOrEqual(2);
    expect(reasons.guaranteed_venue_capacity).toBeGreaterThanOrEqual(1);
  });
});

describe("getGroupVenueDeal：部分绑定 = 配置损坏，绝不换券（QA 复评 D6/AC-04）", () => {
  const base = {
    venueId: "venue-1",
    venueName: "山止川行",
    assignmentStatus: "assigned",
    poolGuaranteedVenueId: null,
    poolGuaranteedDealId: null,
  };

  it("只有 guaranteedVenueId、没有 guaranteedDealId → null（db 为 {}，访问即抛错）", async () => {
    await expect(
      getGroupVenueDeal({ ...base, poolGuaranteedVenueId: "venue-1" }),
    ).resolves.toBeNull();
  });

  it("只有 guaranteedDealId、没有 guaranteedVenueId → null", async () => {
    await expect(
      getGroupVenueDeal({ ...base, poolGuaranteedDealId: "deal-9" }),
    ).resolves.toBeNull();
  });

  it("两字段齐全但实际门店 ≠ 保底门店 → null，且不读取任何权益", async () => {
    await expect(
      getGroupVenueDeal({
        ...base,
        venueId: "venue-other",
        poolGuaranteedVenueId: "venue-1",
        poolGuaranteedDealId: "deal-9",
      }),
    ).resolves.toBeNull();
  });
});
