import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// resolvePoolDealBinding 只以 await db.select().from().where().limit(1) 收尾，
// 用队列 mock 依次返回场地行、权益行。
const selectMock = vi.fn();
vi.mock("../db", () => ({ db: { select: (...args: unknown[]) => selectMock(...args) } }));

import { describePoolBindingChange, isPoolGuaranteeChangeLocked, resolvePoolDealBinding } from "../lib/venueDealBinding";

function queueRows(...rowSets: Array<Array<Record<string, unknown>>>) {
  for (const rows of rowSets) {
    selectMock.mockImplementationOnce(() => ({
      from: () => ({ where: () => ({ limit: async () => rows }) }),
    }));
  }
}

const venue = { id: "venue-1", city: "深圳", isActive: true };
const deal = {
  id: "deal-1",
  venueId: "venue-1",
  isActive: true,
  discountType: "percentage",
  discountValue: 20,
  redemptionMethod: "show_page",
};

describe("resolvePoolDealBinding（AC-04）", () => {
  beforeEach(() => selectMock.mockReset());

  it("两者都为空 = 不绑定/解绑，不查库", async () => {
    const result = await resolvePoolDealBinding({ city: "深圳" });
    expect(result).toEqual({ ok: true, venueId: null, dealId: null });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("只给一个返回 GUARANTEE_BINDING_INCOMPLETE", async () => {
    for (const input of [
      { guaranteedVenueId: "venue-1", city: "深圳" },
      { guaranteedDealId: "deal-1", city: "深圳" },
      { guaranteedVenueId: "venue-1", guaranteedDealId: null, city: "深圳" },
    ]) {
      const result = await resolvePoolDealBinding(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("GUARANTEE_BINDING_INCOMPLETE");
    }
  });

  it("场地不存在或已停用", async () => {
    queueRows([]);
    let result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-x",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GUARANTEE_VENUE_UNAVAILABLE");

    queueRows([{ ...venue, isActive: false }]);
    result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    if (!result.ok) expect(result.code).toBe("GUARANTEE_VENUE_UNAVAILABLE");
  });

  it("跨城市绑定被拒绝（含 PATCH 仅改城市的场景）", async () => {
    queueRows([{ ...venue, city: "香港" }]);
    const result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GUARANTEE_VENUE_CITY_MISMATCH");
  });

  it("权益不存在或已停用", async () => {
    queueRows([venue], []);
    let result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-x",
      city: "深圳",
    });
    if (!result.ok) expect(result.code).toBe("GUARANTEE_DEAL_UNAVAILABLE");

    queueRows([venue], [{ ...deal, isActive: false }]);
    result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    if (!result.ok) expect(result.code).toBe("GUARANTEE_DEAL_UNAVAILABLE");
  });

  it("权益不属于所选场地被拒绝", async () => {
    queueRows([venue], [{ ...deal, venueId: "venue-2" }]);
    const result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    if (!result.ok) expect(result.code).toBe("GUARANTEE_DEAL_VENUE_MISMATCH");
  });

  it("合法绑定返回规范化后的 id", async () => {
    queueRows([venue], [deal]);
    const result = await resolvePoolDealBinding({
      guaranteedVenueId: "venue-1",
      guaranteedDealId: "deal-1",
      city: "深圳",
    });
    expect(result).toEqual({ ok: true, venueId: "venue-1", dealId: "deal-1" });
  });

  it("legacy / 坏面值 / 无效暗号的权益不能作为保底", async () => {
    for (const invalid of [
      { ...deal, discountType: "gift" },
      { ...deal, discountValue: 0 },
      { ...deal, redemptionMethod: "code", redemptionCode: "" },
      { ...deal, discountType: "set_menu", redemptionMethod: "show_page", discountValue: undefined, setMenuPriceCents: 59800, setMenuOriginalPriceCents: 59800 },
    ]) {
      queueRows([venue], [invalid]);
      const result = await resolvePoolDealBinding({
        guaranteedVenueId: "venue-1",
        guaranteedDealId: "deal-1",
        city: "深圳",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("GUARANTEE_DEAL_UNAVAILABLE");
    }
  });
});

describe("adminEventPools 路由接线（源码契约）", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../routes/domains/adminEventPools.ts"),
    "utf8",
  );

  it("POST 与 PATCH 都调用同一个 binding helper", () => {
    const occurrences = source.split("await resolvePoolDealBinding(").length - 1;
    expect(occurrences).toBe(2);
  });

  it("POST 在校验通过后才 insert，并写绑定审计", () => {
    expect(source).toMatch(/if \(!binding\.ok\) \{\s*return res\.status\(400\)/);
    expect(source).toContain('action: "EVENT_POOL_DEAL_BOUND"');
  });

  it("PATCH 合并既有池的绑定与城市（仅改城市也会重新校验）", () => {
    expect(source).toContain("guaranteedVenueId: eventPools.guaranteedVenueId");
    expect(source).toContain("city: updates.city ?? currentBinding.city");
    expect(source).toContain("district: updates.district ?? currentBinding.district");
    expect(source).toContain("eventType: updates.eventType ?? currentBinding.eventType");
    expect(source).toContain("updates.district !== undefined");
    expect(source).toContain("updates.eventType !== undefined");
  });

  it("成局后禁止保底换绑/解绑，避免改写已展示承诺", () => {
    expect(source).toContain("matchedAt: eventPools.matchedAt");
    expect(source).toContain('code: "POOL_GUARANTEE_LOCKED_AFTER_MATCHING"');
    expect(source).toContain("isPoolGuaranteeChangeLocked(currentBinding, change.type)");
  });

  it("列表 GET 返回两个保底字段供编辑回填", () => {
    expect(source).toContain("guaranteedDealId: eventPools.guaranteedDealId,");
  });

  it("绑定审计携带 before 与 changeType（换绑/解绑可追溯旧值）", () => {
    expect(source).toContain("describePoolBindingChange(currentBinding");
    expect(source).toContain("before: bindingAudit.before");
    expect(source).toContain("context: { changeType: bindingAudit.type }");
    expect(source).toContain('unbound: bindingAudit.type === "unbind"');
  });

  it("updateEventPoolSchema 接受可空绑定字段", () => {
    expect(source).toContain("guaranteedVenueId: z.string().min(1).nullish()");
    expect(source).toContain("guaranteedDealId: z.string().min(1).nullish()");
  });
});

describe("describePoolBindingChange（绑定审计载荷：before/after + changeType）", () => {
  const bound = { guaranteedVenueId: "venue-1", guaranteedDealId: "deal-1" };

  it("首次绑定 bind：before 为双 null，after 为新绑定", () => {
    const change = describePoolBindingChange({}, bound);
    expect(change.type).toBe("bind");
    expect(change.before).toEqual({ guaranteedVenueId: null, guaranteedDealId: null });
    expect(change.after).toEqual(bound);
  });

  it("换绑 rebind：before 保留旧绑定", () => {
    const change = describePoolBindingChange(bound, {
      guaranteedVenueId: "venue-2",
      guaranteedDealId: "deal-2",
    });
    expect(change.type).toBe("rebind");
    expect(change.before).toEqual(bound);
  });

  it("解绑 unbind：before 必须保留旧绑定，after 双 null", () => {
    const change = describePoolBindingChange(bound, { guaranteedVenueId: null, guaranteedDealId: null });
    expect(change.type).toBe("unbind");
    expect(change.before).toEqual(bound);
    expect(change.after).toEqual({ guaranteedVenueId: null, guaranteedDealId: null });
  });

  it("值未变 → none，不写审计", () => {
    expect(describePoolBindingChange(bound, bound).type).toBe("none");
    expect(describePoolBindingChange({}, {}).type).toBe("none");
  });
});

describe("isPoolGuaranteeChangeLocked（成局后的承诺不可改写）", () => {
  it("matched 后 rebind / unbind 都锁定，同值 none 仍放行", () => {
    const matched = { matchedAt: new Date("2026-11-14T12:00:00Z") };
    expect(isPoolGuaranteeChangeLocked(matched, "rebind")).toBe(true);
    expect(isPoolGuaranteeChangeLocked(matched, "unbind")).toBe(true);
    expect(isPoolGuaranteeChangeLocked(matched, "bind")).toBe(true);
    expect(isPoolGuaranteeChangeLocked(matched, "none")).toBe(false);
  });

  it("未 matched 的池仍可在后台调整", () => {
    expect(isPoolGuaranteeChangeLocked({ matchedAt: null }, "rebind")).toBe(false);
    expect(isPoolGuaranteeChangeLocked({ matchedAt: null }, "unbind")).toBe(false);
  });
});
