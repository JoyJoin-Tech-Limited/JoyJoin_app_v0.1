import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// venueDealBinding 顶层引入 db；本文件只测纯函数，不需要真实连接
vi.mock("../db", () => ({ db: {} }));

import { adminVenueDealCreateSchema, adminVenueDealUpdateSchema } from "@shared/schema";
import {
  buildMergedVenueDeal,
  planVenueDealDeactivation,
  planVenueDealPatch,
} from "../lib/venueDealBinding";

const routesSource = fs.readFileSync(
  path.resolve(__dirname, "../routes/domains/venues.ts"),
  "utf8",
);
const repoSource = fs.readFileSync(
  path.resolve(__dirname, "../repositories/venueDealsRepo.ts"),
  "utf8",
);

const modernPercentage = {
  id: "deal-1",
  venueId: "venue-1",
  title: "本场专属折扣",
  description: "无门槛全单通用",
  discountType: "percentage",
  discountValue: 20,
  redemptionMethod: "code",
  redemptionCode: "悦聚同桌",
  isActive: true,
};

const modernSetMenu = {
  id: "deal-2",
  venueId: "venue-1",
  title: "六人分享套餐",
  description: "6菜1汤加特调",
  discountType: "set_menu",
  discountValue: null,
  setMenuPriceCents: 59800,
  setMenuOriginalPriceCents: 75800,
  redemptionMethod: "show_page",
  redemptionCode: null,
  isActive: true,
};

describe("planVenueDealPatch（AC-02 三类策略）", () => {
  it("空更新为 noop", () => {
    expect(planVenueDealPatch(modernPercentage, {}).kind).toBe("noop");
    expect(planVenueDealPatch(modernPercentage, { title: undefined }).kind).toBe("noop");
  });

  it("现代行：仅 isActive 可直接写，不需要整体校验", () => {
    expect(planVenueDealPatch(modernPercentage, { isActive: false }).kind).toBe("write");
  });

  it("现代行：核心业务字段触发整体校验", () => {
    expect(planVenueDealPatch(modernPercentage, { discountValue: 25 }).kind).toBe("validate");
    expect(planVenueDealPatch(modernSetMenu, { setMenuPriceCents: 52800 }).kind).toBe("validate");
    expect(planVenueDealPatch(modernPercentage, { title: "新权益名" }).kind).toBe("validate");
  });

  it("legacy 行：isActive-only 始终可用", () => {
    const legacy = { discountType: "gift" };
    expect(planVenueDealPatch(legacy, { isActive: false }).kind).toBe("write");
  });

  it("legacy 行：可改文案，但不能改类型/面值/核销方式", () => {
    const legacy = { discountType: "fixed" };
    expect(planVenueDealPatch(legacy, { title: "旧权益改名" }).kind).toBe("write");
    expect(planVenueDealPatch(legacy, { description: "旧权益说明" }).kind).toBe("write");
    const plan = planVenueDealPatch(legacy, { discountValue: 30 });
    expect(plan.kind).toBe("legacy_readonly");
    expect(planVenueDealPatch(legacy, { discountType: "percentage" }).kind).toBe("legacy_readonly");
    expect(planVenueDealPatch(legacy, { redemptionMethod: "code" }).kind).toBe("legacy_readonly");
  });
});

describe("合并后整体校验（REL-01 语义）", () => {
  it("既有 description 超长的 percentage 行：单独停用不触发校验，可写", () => {
    const legacyShaped = { ...modernPercentage, description: "x".repeat(60) };
    expect(planVenueDealPatch(legacyShaped, { isActive: false }).kind).toBe("write");
  });

  it("折扣合并后合法", () => {
    const merged = buildMergedVenueDeal(modernPercentage, { discountValue: 25 });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(true);
  });

  it("折扣越界被拒绝（0 / 91 / 非整数）", () => {
    for (const discountValue of [0, 91, 19.5]) {
      const merged = buildMergedVenueDeal(modernPercentage, { discountValue });
      expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
    }
  });

  it("套餐只改一口价导致原价≤一口价时被拒绝", () => {
    const merged = buildMergedVenueDeal(modernSetMenu, { setMenuPriceCents: 80000 });
    const result = adminVenueDealCreateSchema.safeParse(merged);
    expect(result.success).toBe(false);
  });

  it("套餐必须保持 show_page", () => {
    const merged = buildMergedVenueDeal(modernSetMenu, { redemptionMethod: "code" });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
  });

  it("code 暗号被显式清空后被拒绝", () => {
    const merged = buildMergedVenueDeal(modernPercentage, { redemptionCode: null });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
  });

  it("文案超过 20 字被拒绝", () => {
    const merged = buildMergedVenueDeal(modernPercentage, { title: "权".repeat(21) });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
  });
});

describe("adminVenueDealUpdateSchema（confirmDeactivate 传输字段）", () => {
  it("confirmDeactivate 只能伴随 isActive:false", () => {
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: false, confirmDeactivate: true }).success,
    ).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ confirmDeactivate: true }).success).toBe(false);
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: true, confirmDeactivate: true }).success,
    ).toBe(false);
  });

  it("confirmDeactivate 只接受字面量 true", () => {
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: false, confirmDeactivate: false }).success,
    ).toBe(false);
  });
});

describe("路由接线（源码契约）", () => {
  it("POST 使用 adminVenueDealCreateSchema.safeParse，venueId 取自 path", () => {
    expect(routesSource).toMatch(/adminVenueDealCreateSchema\.safeParse\(\{\s*\.\.\.req\.body,\s*venueId: req\.params\.venueId/);
    expect(routesSource).toContain('code: "INVALID_VENUE_DEAL"');
    expect(routesSource).toContain('code: "VENUE_NOT_FOUND"');
  });

  it("POST/PATCH/DELETE 均为 requireAdmin + requireOperatorOrAbove", () => {
    for (const signature of [
      'app.post("/api/admin/venues/:venueId/deals", requireAdmin, requireOperatorOrAbove',
      'app.patch("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove',
      'app.delete("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove',
    ]) {
      expect(routesSource).toContain(signature);
    }
  });

  it("PATCH 走行锁事务 + 合并校验，不再透传 req.body", () => {
    expect(routesSource).toContain("updateVenueDealWithLock(req.params.id");
    expect(routesSource).toContain("planVenueDealPatch(existing, updates)");
    expect(routesSource).toContain("buildMergedVenueDeal(existing, updates)");
    expect(routesSource).not.toContain("storage.updateVenueDeal(req.params.id, req.body)");
    expect(repoSource).toContain('.for("update")');
  });

  it("停用已绑定权益：409 + affectedPools + confirmDeactivate", () => {
    expect(routesSource).toContain('code: "DEAL_BOUND_TO_POOL"');
    expect(routesSource).toContain("affectedPools");
    expect(routesSource).toContain("planVenueDealDeactivation(");
    // confirmDeactivate 被解构剥离，不会进入写库 payload
    expect(routesSource).toContain("const { confirmDeactivate, ...updates } = parsed.data;");
  });

  it("删除已绑定权益返回 409 而不是硬删", () => {
    expect(routesSource).toContain("listPoolsBoundToDeal(req.params.id)");
  });

  it("三类写操作均写审计", () => {
    for (const action of ["VENUE_DEAL_CREATED", "VENUE_DEAL_UPDATED", "VENUE_DEAL_DELETED"]) {
      expect(routesSource).toContain(`action: "${action}"`);
    }
  });

  it("公共只读路由仍走旧 storage（SEC-02）", () => {
    expect(routesSource).toContain("storage.getActiveVenueDeals(req.params.venueId)");
    expect(routesSource).toContain("storage.incrementVenueDealUsage(req.params.id)");
  });
});

describe("QA 复评修复：legacy 错误码与类型互转", () => {
  const legacyGift = {
    id: "deal-legacy",
    venueId: "venue-1",
    title: "旧赠饮",
    description: "历史数据",
    discountType: "gift",
    redemptionMethod: "qr_code",
    isActive: true,
  };

  it("update schema 在传输层接受 legacy 的 discountType / redemptionMethod，由路由判 LEGACY_DEAL_READONLY", () => {
    const parsed = adminVenueDealUpdateSchema.safeParse({
      discountType: "fixed",
      redemptionMethod: "qr_code",
    });
    expect(parsed.success).toBe(true);
    // legacy 行提交核心业务字段 → 路由进入 legacy_readonly，而不是 INVALID_VENUE_DEAL
    expect(planVenueDealPatch(legacyGift, { discountType: "fixed" }).kind).toBe("legacy_readonly");
    expect(planVenueDealPatch(legacyGift, { redemptionMethod: "qr_code" }).kind).toBe("legacy_readonly");
    // 现代行提交非法类型仍被合并后的创建 schema 拒绝
    const merged = buildMergedVenueDeal(modernPercentage, { discountType: "fixed" });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
  });

  it("percentage → set_menu：显式 null 清掉旧折扣值后整体校验通过", () => {
    const updates = {
      discountType: "set_menu",
      discountValue: null,
      setMenuPriceCents: 59800,
      setMenuOriginalPriceCents: 75800,
      redemptionMethod: "show_page",
      redemptionCode: null,
    };
    expect(planVenueDealPatch(modernPercentage, updates).kind).toBe("validate");
    const merged = buildMergedVenueDeal(modernPercentage, updates);
    expect(merged.discountValue).toBeUndefined();
    expect(merged.redemptionCode).toBeUndefined();
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(true);
  });

  it("set_menu → percentage：显式 null 清掉套餐价后整体校验通过", () => {
    const updates = {
      discountType: "percentage",
      discountValue: 20,
      setMenuPriceCents: null,
      setMenuOriginalPriceCents: null,
      redemptionMethod: "code",
      redemptionCode: "悦聚同桌",
    };
    const merged = buildMergedVenueDeal(modernSetMenu, updates);
    expect(merged.setMenuPriceCents).toBeUndefined();
    expect(merged.setMenuOriginalPriceCents).toBeUndefined();
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(true);
  });

  it("缺显式 null 时类型互转必须失败（回归锁：防止退回到保留旧面值）", () => {
    const merged = buildMergedVenueDeal(modernPercentage, {
      discountType: "set_menu",
      setMenuPriceCents: 59800,
      setMenuOriginalPriceCents: 75800,
      redemptionMethod: "show_page",
    });
    expect(adminVenueDealCreateSchema.safeParse(merged).success).toBe(false);
  });
});

describe("planVenueDealDeactivation（AC-09，含 legacy + 已绑定 + 确认停用）", () => {
  const boundPools = [
    { id: "pool-1", title: "周末饭局", dateTime: "2026-11-14" },
    { id: "pool-2", title: "微醺小局", dateTime: "2026-11-15" },
  ];

  it("legacy 行 + 已绑定 + confirmDeactivate=true → 允许停用并返回受影响池", () => {
    const legacyGift = {
      isActive: true,
      discountType: "gift",
      redemptionMethod: "qr_code",
      title: "到店赠饮",
      description: "历史权益",
    };
    // legacy 行的 isActive-only PATCH 必须仍然可写（AC-02a / AC-09 例外）
    expect(planVenueDealPatch(legacyGift, { isActive: false }).kind).toBe("write");

    const plan = planVenueDealDeactivation(legacyGift, { isActive: false }, boundPools, true);
    expect(plan.kind).toBe("ok");
    expect(plan.kind === "ok" && plan.affectedPoolIds).toEqual(["pool-1", "pool-2"]);

    // OBS-01：确认停用必须进入审计上下文，而不是只在响应里出现
    expect(routesSource).toContain("confirmedDeactivation: true");
    expect(routesSource).toContain("affectedPoolIds: outcome.affectedPoolIds");
  });

  it("已绑定但未确认 → confirm_required，携带受影响池明细", () => {
    const plan = planVenueDealDeactivation({ isActive: true }, { isActive: false }, boundPools, false);
    expect(plan.kind).toBe("confirm_required");
    expect(plan.kind === "confirm_required" && plan.affectedPools.map((p) => p.id)).toEqual([
      "pool-1",
      "pool-2",
    ]);
  });

  it("无绑定池 → 不需要确认", () => {
    expect(planVenueDealDeactivation({ isActive: true }, { isActive: false }, [], false).kind).toBe("ok");
  });

  it("非停用操作 / 已停用行不进入确认链路", () => {
    expect(planVenueDealDeactivation({ isActive: true }, { isActive: true }, boundPools, false)).toEqual({
      kind: "ok",
      affectedPoolIds: [],
    });
    expect(planVenueDealDeactivation({ isActive: false }, { isActive: false }, boundPools, false)).toEqual({
      kind: "ok",
      affectedPoolIds: [],
    });
  });
});
