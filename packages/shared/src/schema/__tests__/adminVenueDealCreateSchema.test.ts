import { describe, expect, it } from 'vitest';
import {
  adminVenueDealCreateSchema,
  adminVenueDealUpdateSchema,
  insertVenueDealSchema,
} from '../_definitions.js';

const discountBase = {
  venueId: 'venue-1',
  title: '本场专属折扣',
  description: '全单通用',
  discountType: 'percentage',
  discountValue: 20,
  redemptionMethod: 'show_page',
} as const;

const setMenuBase = {
  venueId: 'venue-1',
  title: '悦聚六人套餐',
  description: '6 菜 1 汤 + 特调',
  discountType: 'set_menu',
  setMenuPriceCents: 59800,
  setMenuOriginalPriceCents: 75800,
  redemptionMethod: 'show_page',
} as const;

describe('adminVenueDealCreateSchema · 合法形态', () => {
  it('接受统一折扣 · 出示本页', () => {
    const result = adminVenueDealCreateSchema.safeParse(discountBase);
    expect(result.success).toBe(true);
  });

  it('接受统一折扣 · 到店暗号', () => {
    const result = adminVenueDealCreateSchema.safeParse({
      ...discountBase,
      redemptionMethod: 'code',
      redemptionCode: '悦聚同桌',
    });
    expect(result.success).toBe(true);
  });

  it('接受定制套餐，缺省出示方式为 show_page', () => {
    const { redemptionMethod: _omitted, ...input } = setMenuBase;
    const result = adminVenueDealCreateSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.redemptionMethod).toBe('show_page');
    }
  });

  it('文案 20 字为上限边界，可通过', () => {
    const result = adminVenueDealCreateSchema.safeParse({
      ...discountBase,
      title: '权'.repeat(20),
      description: '益'.repeat(20),
    });
    expect(result.success).toBe(true);
  });
});

describe('adminVenueDealCreateSchema · 只保留两种形态', () => {
  it.each(['fixed', 'gift'])('拒绝 discountType=%s', (discountType) => {
    expect(adminVenueDealCreateSchema.safeParse({ ...discountBase, discountType }).success).toBe(false);
  });

  it('拒绝 qr_code 出示方式（无码图字段与核销端）', () => {
    expect(
      adminVenueDealCreateSchema.safeParse({ ...discountBase, redemptionMethod: 'qr_code' }).success,
    ).toBe(false);
  });
});

describe('adminVenueDealCreateSchema · 统一折扣规则', () => {
  it.each([0, 91, 19.5])('拒绝 discountValue=%s', (discountValue) => {
    expect(adminVenueDealCreateSchema.safeParse({ ...discountBase, discountValue }).success).toBe(false);
  });

  it('折扣必填', () => {
    const { discountValue: _omitted, ...input } = discountBase;
    expect(adminVenueDealCreateSchema.safeParse(input).success).toBe(false);
  });

  it('统一折扣不得携带套餐价格', () => {
    expect(
      adminVenueDealCreateSchema.safeParse({ ...discountBase, setMenuPriceCents: 59800 }).success,
    ).toBe(false);
  });
});

describe('adminVenueDealCreateSchema · 定制套餐规则', () => {
  it.each([
    ['缺一口价', { setMenuPriceCents: undefined }],
    ['缺原价', { setMenuOriginalPriceCents: undefined }],
    ['一口价为 0', { setMenuPriceCents: 0 }],
    ['原价等于一口价', { setMenuOriginalPriceCents: 59800 }],
    ['原价低于一口价', { setMenuOriginalPriceCents: 49800 }],
  ])('拒绝：%s', (_label, patch) => {
    expect(adminVenueDealCreateSchema.safeParse({ ...setMenuBase, ...patch }).success).toBe(false);
  });

  it('定制套餐只能出示本页，不能用暗号', () => {
    expect(
      adminVenueDealCreateSchema.safeParse({
        ...setMenuBase,
        redemptionMethod: 'code',
        redemptionCode: '悦聚同桌',
      }).success,
    ).toBe(false);
  });

  it('定制套餐不得携带折扣值', () => {
    expect(adminVenueDealCreateSchema.safeParse({ ...setMenuBase, discountValue: 20 }).success).toBe(false);
  });
});

describe('adminVenueDealCreateSchema · 暗号与文案边界', () => {
  it('code 必须有暗号', () => {
    expect(
      adminVenueDealCreateSchema.safeParse({ ...discountBase, redemptionMethod: 'code' }).success,
    ).toBe(false);
  });

  it.each(['悦', '悦聚同桌四人一起行'])('拒绝暗号「%s」（2–8 字之外）', (redemptionCode) => {
    expect(
      adminVenueDealCreateSchema.safeParse({ ...discountBase, redemptionMethod: 'code', redemptionCode })
        .success,
    ).toBe(false);
  });

  it('暗号 trim 后 8 字可通过', () => {
    expect(
      adminVenueDealCreateSchema.safeParse({
        ...discountBase,
        redemptionMethod: 'code',
        redemptionCode: '  悦聚同桌四人  ',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['title 全空白', { title: '   ' }],
    ['title 21 字', { title: '权'.repeat(21) }],
    ['description 全空白', { description: '  ' }],
    ['description 21 字', { description: '益'.repeat(21) }],
  ])('拒绝：%s', (_label, patch) => {
    expect(adminVenueDealCreateSchema.safeParse({ ...discountBase, ...patch }).success).toBe(false);
  });
});

describe('legacy insertVenueDealSchema 保持不变', () => {
  it.each(['percentage', 'fixed', 'gift'])('仍接受 discountType=%s（旧行与旧入口不受影响）', (discountType) => {
    const result = insertVenueDealSchema.safeParse({
      venueId: 'venue-1',
      title: '旧优惠',
      discountType,
    });
    expect(result.success).toBe(true);
  });
});

describe("adminVenueDealUpdateSchema（S1 PATCH 输入）", () => {
  it("接受部分字段更新", () => {
    expect(adminVenueDealUpdateSchema.safeParse({ title: "新权益名" }).success).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("字段边界与创建一致：文案 20 字、暗号 2–8 字、折扣 1–90 整数", () => {
    expect(adminVenueDealUpdateSchema.safeParse({ title: "权".repeat(21) }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ description: "说".repeat(21) }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ redemptionCode: "暗" }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ redemptionCode: "悦".repeat(9) }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ discountValue: 0 }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ discountValue: 91 }).success).toBe(false);
    expect(adminVenueDealUpdateSchema.safeParse({ discountValue: 19.5 }).success).toBe(false);
  });

  it("传输层接受 legacy 值，由服务端策略层返回 LEGACY_DEAL_READONLY", () => {
    // QA 复评：PATCH 若在这里就用 enum 拒绝，legacy 行只会得到 INVALID_VENUE_DEAL，
    // 而不是合同要求的 LEGACY_DEAL_READONLY。类型/方式的业务拒绝见
    // apps/server/src/__tests__/adminVenueDeals.test.ts。
    expect(adminVenueDealUpdateSchema.safeParse({ discountType: "fixed" }).success).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ discountType: "gift" }).success).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ redemptionMethod: "qr_code" }).success).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ discountType: "" }).success).toBe(false);
  });

  it("confirmDeactivate 是仅伴随 isActive:false 的传输字段", () => {
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: false, confirmDeactivate: true }).success,
    ).toBe(true);
    expect(adminVenueDealUpdateSchema.safeParse({ confirmDeactivate: true }).success).toBe(false);
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: true, confirmDeactivate: true }).success,
    ).toBe(false);
    expect(
      adminVenueDealUpdateSchema.safeParse({ isActive: false, confirmDeactivate: false }).success,
    ).toBe(false);
  });

  it("显式 null 用于清除可空字段", () => {
    const result = adminVenueDealUpdateSchema.safeParse({ redemptionCode: null });
    expect(result.success).toBe(true);
  });
});
