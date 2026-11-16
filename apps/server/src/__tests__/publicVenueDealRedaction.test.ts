/**
 * S2 AC-07：公开（无鉴权）权益路由不得再泄露 redemption_code。
 * 历史上这些端点 SELECT * 直出，任何未登录用户都能拿到全部门店暗号。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  sanitizePublicVenueDeal,
  sanitizePublicVenueDeals,
} from "../lib/venueDealVisibility";

describe("sanitizePublicVenueDeal", () => {
  it("同时剔除 snake_case 与 camelCase 暗号，保留其余字段", () => {
    const row = {
      id: "d1",
      title: "本场专属折扣",
      redemption_code: "悦聚同桌",
      redemptionCode: "悦聚同桌",
      discount_value: 20,
    };
    const out = sanitizePublicVenueDeal(row);
    expect(out.redemption_code).toBeUndefined();
    expect(out.redemptionCode).toBeUndefined();
    expect(out.discount_value).toBe(20);
    expect(out.title).toBe("本场专属折扣");
    // 不修改原行
    expect(row.redemption_code).toBe("悦聚同桌");
  });

  it("数组版本逐行脱敏", () => {
    const out = sanitizePublicVenueDeals([
      { id: "a", redemption_code: "x" },
      { id: "b", redemptionCode: "y" },
    ]);
    expect(out).toEqual([{ id: "a" }, { id: "b" }]);
  });
});

describe("公开路由源码契约", () => {
  const src = readFileSync(resolve(__dirname, "../routes/domains/venues.ts"), "utf8");

  it("GET /api/venues/:venueId/deals 脱敏", () => {
    expect(src).toContain("res.json(sanitizePublicVenueDeals(deals));");
  });

  it("with-deals 与 by-name 两个公开端点都脱敏", () => {
    expect(src.match(/deals: sanitizePublicVenueDeals\(deals\)/g)?.length).toBe(2);
  });

  it("成员专属 DTO 不经过公开脱敏（暗号只给小组成员）", () => {
    const groupSrc = readFileSync(resolve(__dirname, "../routes/domains/userEventPools.ts"), "utf8");
    expect(groupSrc).not.toContain("sanitizePublicVenueDeal");
  });
});
