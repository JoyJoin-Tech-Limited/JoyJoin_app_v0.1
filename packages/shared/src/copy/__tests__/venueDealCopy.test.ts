import { describe, expect, it } from 'vitest';
import * as venueDealCopyModule from '../venueDealCopy';
import {
  formatCentsAsYuan,
  formatDiscountLabel,
  formatSetMenuPriceLabel,
  getVenueDealValueText,
  getVenueDealHowText,
  getVenueDealFootText,
  isCompactVenueDealValue,
  VENUE_DEAL_CARD_HEADER,
  VENUE_DEAL_CARD_UNLOCKED_STATUS,
  VENUE_DEAL_CARD_LOCKED_STATUS,
  VENUE_DEAL_CARD_ERROR_STATUS,
  VENUE_DEAL_CARD_LOCKED_TITLE,
  VENUE_DEAL_CARD_LOCKED_SCOPE,
  VENUE_DEAL_CARD_DISCOUNT_HOW,
  VENUE_DEAL_CARD_SET_MENU_HOW,
  VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE,
  VENUE_DEAL_CARD_ERROR_TITLE,
  VENUE_DEAL_CARD_ERROR_SCOPE,
  VENUE_DEAL_CARD_RETRY,
  VENUE_DEAL_CARD_ADJUSTED_STATUS,
  VENUE_DEAL_CARD_ADJUSTED_TITLE,
  VENUE_DEAL_CARD_ADJUSTED_SCOPE,
  VENUE_DEAL_CODE_HINT,
  VENUE_DEAL_COPY_FAILURE_HINT,
  VENUE_DEAL_CREDENTIAL_TITLE,
  VENUE_DEAL_DEFAULT_DISCOUNT_TITLE,
  VENUE_DEAL_FEE_BOUNDARY_LINE,
  VENUE_DEAL_LOCKED_HINT,
  VENUE_DEAL_LOCKED_TITLE,
  VENUE_DEAL_RULE_LINE,
  VENUE_DEAL_SEAL_COPIED_TEXT,
  VENUE_DEAL_SEAL_TEXT,
  VENUE_DEAL_SHOW_PAGE_HINT,
  VENUE_DEAL_SHOW_PAGE_SUBTITLE,
} from '../venueDealCopy.js';

describe('formatDiscountLabel', () => {
  it.each([
    [20, '8 折'],
    [25, '7.5 折'],
    [90, '1 折'],
    [1, '9.9 折'],
    [10, '9 折'],
  ])('discountValue=%i → %s', (input, expected) => {
    expect(formatDiscountLabel(input)).toBe(expected);
  });

  it.each([0, 91, 19.5, Number.NaN, -20])('非法输入 %s 返回空串，不编造面值', (input) => {
    expect(formatDiscountLabel(input)).toBe('');
  });
});

describe('formatCentsAsYuan / formatSetMenuPriceLabel', () => {
  it.each([
    [59800, '598'],
    [75800, '758'],
    [59850, '598.5'],
    [59855, '598.55'],
    [0, '0'],
  ])('%i 分 → %s 元', (input, expected) => {
    expect(formatCentsAsYuan(input)).toBe(expected);
  });

  it('套餐一口价带人民币符号', () => {
    expect(formatSetMenuPriceLabel(59800)).toBe('¥598');
  });

  it.each([-1, 1.5, Number.NaN])('非法输入 %s 返回空串', (input) => {
    expect(formatCentsAsYuan(input)).toBe('');
    expect(formatSetMenuPriceLabel(input)).toBe('');
  });
});

describe('getVenueDealValueText', () => {
  it('折扣与套餐各自取面值', () => {
    expect(getVenueDealValueText({ kind: 'discount', valueOffPercent: 20 })).toBe('8 折');
    expect(getVenueDealValueText({ kind: 'set_menu', setMenuPriceCents: 59800 })).toBe('¥598');
  });

  it('数据缺失返回空串', () => {
    expect(getVenueDealValueText({ kind: 'discount' })).toBe('');
    expect(getVenueDealValueText({ kind: 'set_menu' })).toBe('');
  });
});

describe('文案硬约束', () => {
  const allCopy = [
    VENUE_DEAL_RULE_LINE,
    VENUE_DEAL_FEE_BOUNDARY_LINE,
    VENUE_DEAL_DEFAULT_DISCOUNT_TITLE,
    VENUE_DEAL_LOCKED_TITLE,
    VENUE_DEAL_LOCKED_HINT,
    VENUE_DEAL_CREDENTIAL_TITLE,
    VENUE_DEAL_SHOW_PAGE_HINT,
    VENUE_DEAL_SHOW_PAGE_SUBTITLE,
    VENUE_DEAL_CODE_HINT,
    VENUE_DEAL_COPY_FAILURE_HINT,
    VENUE_DEAL_SEAL_TEXT,
    VENUE_DEAL_SEAL_COPIED_TEXT,
    VENUE_DEAL_CARD_HEADER,
    VENUE_DEAL_CARD_UNLOCKED_STATUS,
    VENUE_DEAL_CARD_LOCKED_STATUS,
    VENUE_DEAL_CARD_ERROR_STATUS,
    VENUE_DEAL_CARD_LOCKED_TITLE,
    VENUE_DEAL_CARD_LOCKED_SCOPE,
    VENUE_DEAL_CARD_DISCOUNT_HOW,
    VENUE_DEAL_CARD_SET_MENU_HOW,
    VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE,
    VENUE_DEAL_CARD_ERROR_TITLE,
    VENUE_DEAL_CARD_ERROR_SCOPE,
    VENUE_DEAL_CARD_RETRY,
    VENUE_DEAL_CARD_ADJUSTED_STATUS,
    VENUE_DEAL_CARD_ADJUSTED_TITLE,
    VENUE_DEAL_CARD_ADJUSTED_SCOPE,
  ];

  it('规则与费用边界逐字锁定', () => {
    expect(VENUE_DEAL_RULE_LINE).toBe('仅限本场活动 · 本桌使用');
    expect(VENUE_DEAL_FEE_BOUNDARY_LINE).toBe('订座费不含餐费，餐费到店与门店另结');
  });

  it('无 emoji、无会员/VIP/独家、无虚假核销状态', () => {
    for (const line of allCopy) {
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(line).not.toMatch(/会员|VIP|独家/);
      expect(line).not.toMatch(/已出示|已使用|已核销/);
    }
  });

  it('模块内全部字符串文案（含 S4 新增）都进入同一禁词矩阵', () => {
    const exportedCopy = Object.values(venueDealCopyModule)
      .filter((value): value is string => typeof value === 'string');
    expect(exportedCopy.length).toBeGreaterThanOrEqual(allCopy.length);
    for (const line of exportedCopy) {
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(line).not.toMatch(/会员|VIP|独家/);
      expect(line).not.toMatch(/已出示|已使用|已核销/);
    }
  });
});

describe('票券卡文案与 helper（S3）', () => {
  it('使用方式行：两种形态各一句，无门槛、无有效期', () => {
    expect(getVenueDealHowText('discount')).toBe('无门槛 · 全单通用 · 到店出示');
    expect(getVenueDealHowText('set_menu')).toBe('整桌一口价 · 到店出示');
  });

  it('底部规则行：折扣只有唯一规则行，套餐追加餐费边界', () => {
    expect(getVenueDealFootText('discount')).toBe(VENUE_DEAL_RULE_LINE);
    expect(getVenueDealFootText('set_menu')).toBe(`${VENUE_DEAL_RULE_LINE} · ${VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE}`);
  });

  it('长面值降级：套餐整数位 ≥4 才 compact，折扣永不', () => {
    expect(isCompactVenueDealValue({ kind: 'set_menu', setMenuPriceCents: 128800 })).toBe(true);
    expect(isCompactVenueDealValue({ kind: 'set_menu', setMenuPriceCents: 100000 })).toBe(true);
    expect(isCompactVenueDealValue({ kind: 'set_menu', setMenuPriceCents: 99800 })).toBe(false);
    expect(isCompactVenueDealValue({ kind: 'set_menu', setMenuPriceCents: 99899 })).toBe(false);
    expect(isCompactVenueDealValue({ kind: 'discount', valueOffPercent: 1 })).toBe(false);
    expect(isCompactVenueDealValue({ kind: 'set_menu' })).toBe(false);
  });

  it('锁定态不指代具体门店，错误态不声称权益已兑现', () => {
    expect(VENUE_DEAL_CARD_LOCKED_TITLE).toBe('场地确定后解锁本场专属优惠');
    expect(VENUE_DEAL_CARD_LOCKED_STATUS).toBe('待解锁');
    expect(VENUE_DEAL_CARD_ERROR_STATUS).toBe('读取失败');
    expect(VENUE_DEAL_CARD_ERROR_SCOPE).toContain('权益不会消失');
  });
});

describe('同桌凭证出示页文案', () => {
  it('复制失败提示携带真实暗号；状态只声明已复制', async () => {
    const copy = await import('../venueDealCopy');
    expect(copy.formatVenueDealCopyFailure('悦聚同桌')).toBe('复制失败，请直接念给店员：悦聚同桌');
    expect(copy.VENUE_DEAL_SEAL_COPIED_TEXT).toBe('暗号已复制');
    expect(copy.VENUE_DEAL_COPIED_ACTION).not.toContain('已出示');
  });

  it('桌型与套餐原价来自真实数据', async () => {
    const copy = await import('../venueDealCopy');
    expect(copy.getVenueDealTableText(6)).toBe('6 人桌');
    expect(copy.getVenueDealSetMenuOriginalText(75800)).toBe('原价 ¥758 · 餐费到店支付');
  });
});
