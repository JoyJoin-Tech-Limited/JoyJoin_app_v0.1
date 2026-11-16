import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  zheToDiscountValue,
  discountValueToZhe,
  yuanToCents,
  centsToYuan,
  normalizePoolGuaranteePayload,
} from "../venueConstants";
import {
  DealFormFields,
  EMPTY_DEAL_FORM,
  buildDealPayload,
  validateDealForm,
} from "../VenueDealsManager";

describe("折扣换算（AC-06）", () => {
  it("1.0 → 90，9.9 → 1，8 → 20", () => {
    expect(zheToDiscountValue("1.0")).toBe(90);
    expect(zheToDiscountValue("9.9")).toBe(1);
    expect(zheToDiscountValue("8")).toBe(20);
    expect(zheToDiscountValue("7.5")).toBe(25);
  });

  it("10.0 / 0 / 负数 / 两位小数 / 非数字都被拒绝", () => {
    for (const bad of ["10.0", "10", "0", "-1", "8.55", "abc", ""]) {
      expect(zheToDiscountValue(bad)).toBeNull();
    }
  });

  it("回显与录入互逆", () => {
    expect(discountValueToZhe(20)).toBe("8");
    expect(discountValueToZhe(25)).toBe("7.5");
    expect(discountValueToZhe(90)).toBe("1");
    expect(discountValueToZhe(null)).toBe("");
  });
});

describe("元 → 分", () => {
  it("整数与两位小数", () => {
    expect(yuanToCents("598")).toBe(59800);
    expect(yuanToCents("598.5")).toBe(59850);
    expect(yuanToCents("598.55")).toBe(59855);
  });

  it("三位小数 / 非数字 / 空 / 0 被拒绝", () => {
    for (const bad of ["1.234", "abc", "", "0", "-5"]) {
      expect(yuanToCents(bad)).toBeNull();
    }
  });

  it("回显", () => {
    expect(centsToYuan(59800)).toBe("598");
    expect(centsToYuan(59850)).toBe("598.5");
    expect(centsToYuan(null)).toBe("");
  });
});

describe("buildDealPayload", () => {
  it("折扣：只携带现代字段，不含门槛/有效期/条款", () => {
    const payload = buildDealPayload({
      ...EMPTY_DEAL_FORM,
      title: "本场专属折扣",
      description: "无门槛全单通用",
      discountZhe: "8",
      redemptionMethod: "code",
      redemptionCode: "悦聚同桌",
    });
    expect(payload).toEqual({
      title: "本场专属折扣",
      description: "无门槛全单通用",
      discountType: "percentage",
      discountValue: 20,
      setMenuPriceCents: undefined,
      setMenuOriginalPriceCents: undefined,
      redemptionMethod: "code",
      redemptionCode: "悦聚同桌",
    });
    for (const legacyKey of ["minSpend", "maxDiscount", "perPersonLimit", "validFrom", "validUntil", "terms"]) {
      expect(payload).not.toHaveProperty(legacyKey);
    }
  });

  it("套餐：强制 show_page，不带折扣值与暗号", () => {
    const payload = buildDealPayload({
      ...EMPTY_DEAL_FORM,
      kind: "set_menu",
      title: "六人分享套餐",
      description: "6菜1汤加特调",
      setMenuPriceYuan: "598",
      setMenuOriginalPriceYuan: "758",
      redemptionMethod: "code",
      redemptionCode: "不应出现",
    });
    expect(payload.discountType).toBe("set_menu");
    expect(payload.setMenuPriceCents).toBe(59800);
    expect(payload.setMenuOriginalPriceCents).toBe(75800);
    expect(payload.redemptionMethod).toBe("show_page");
    expect(payload.discountValue).toBeUndefined();
    expect(payload.redemptionCode).toBeUndefined();
  });
});

describe("validateDealForm", () => {
  it("折扣 10.0 在表单侧就被拒绝", () => {
    expect(validateDealForm({ ...EMPTY_DEAL_FORM, title: "折扣", discountZhe: "10.0" })).toBeTruthy();
    expect(validateDealForm({ ...EMPTY_DEAL_FORM, title: "折扣", discountZhe: "9.9" })).toBeNull();
  });

  it("套餐原价必须大于一口价", () => {
    const base = {
      ...EMPTY_DEAL_FORM,
      kind: "set_menu" as const,
      title: "套餐",
      setMenuPriceYuan: "598",
      setMenuOriginalPriceYuan: "598",
    };
    expect(validateDealForm(base)).toBeTruthy();
    expect(validateDealForm({ ...base, setMenuOriginalPriceYuan: "758" })).toBeNull();
  });

  it("暗号 2–8 字", () => {
    const base = {
      ...EMPTY_DEAL_FORM,
      title: "折扣",
      discountZhe: "8",
      redemptionMethod: "code" as const,
    };
    expect(validateDealForm({ ...base, redemptionCode: "暗" })).toBeTruthy();
    expect(validateDealForm({ ...base, redemptionCode: "悦聚同桌" })).toBeNull();
    expect(validateDealForm({ ...base, redemptionCode: "悦".repeat(9) })).toBeTruthy();
  });

  it("标题/说明 20 字上限", () => {
    expect(
      validateDealForm({ ...EMPTY_DEAL_FORM, title: "权".repeat(21), discountZhe: "8" }),
    ).toBeTruthy();
    expect(
      validateDealForm({
        ...EMPTY_DEAL_FORM,
        title: "折扣",
        description: "说".repeat(21),
        discountZhe: "8",
      }),
    ).toBeTruthy();
  });
});

describe("DealFormFields 动态字段", () => {
  it("折扣形态显示折扣输入，不显示套餐价格", () => {
    render(<DealFormFields value={{ ...EMPTY_DEAL_FORM, discountZhe: "8" }} onChange={() => {}} />);
    expect(screen.getByTestId("input-discount-zhe")).toBeTruthy();
    expect(screen.queryByTestId("input-set-menu-price")).toBeNull();
  });

  it("切到套餐显示两个价格字段，折扣输入消失", () => {
    render(
      <DealFormFields value={{ ...EMPTY_DEAL_FORM, kind: "set_menu" }} onChange={() => {}} />,
    );
    expect(screen.getByTestId("input-set-menu-price")).toBeTruthy();
    expect(screen.getByTestId("input-set-menu-original")).toBeTruthy();
    expect(screen.queryByTestId("input-discount-zhe")).toBeNull();
  });

  it("点击类型切换回调 kind，套餐强制 show_page", () => {
    const calls: any[] = [];
    render(
      <DealFormFields
        value={{ ...EMPTY_DEAL_FORM, redemptionMethod: "code" }}
        onChange={(next) => calls.push(next)}
      />,
    );
    fireEvent.click(screen.getByTestId("deal-kind-set_menu"));
    expect(calls[0].kind).toBe("set_menu");
    expect(calls[0].redemptionMethod).toBe("show_page");
  });

  it("折扣选 code 时才出现暗号输入", () => {
    const { rerender } = render(
      <DealFormFields value={{ ...EMPTY_DEAL_FORM }} onChange={() => {}} />,
    );
    expect(screen.queryByTestId("input-redemption-code")).toBeNull();
    rerender(
      <DealFormFields
        value={{ ...EMPTY_DEAL_FORM, redemptionMethod: "code" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId("input-redemption-code")).toBeTruthy();
  });
});

describe("QA 复评修复：PATCH 类型互转与池保底提交", () => {
  it("PATCH：percentage → set_menu 显式清空旧折扣值与暗号", () => {
    const payload = buildDealPayload(
      {
        ...EMPTY_DEAL_FORM,
        kind: "set_menu",
        title: "六人分享套餐",
        description: "6菜1汤加特调",
        setMenuPriceYuan: "598",
        setMenuOriginalPriceYuan: "758",
      },
      { forUpdate: true },
    );
    expect(payload.discountType).toBe("set_menu");
    expect(payload.discountValue).toBeNull();
    expect(payload.redemptionCode).toBeNull();
    expect(payload.setMenuPriceCents).toBe(59800);
  });

  it("PATCH：set_menu → percentage 显式清空套餐价", () => {
    const payload = buildDealPayload(
      {
        ...EMPTY_DEAL_FORM,
        kind: "discount",
        title: "本场专属折扣",
        discountZhe: "8",
        redemptionMethod: "code",
        redemptionCode: "悦聚同桌",
      },
      { forUpdate: true },
    );
    expect(payload.discountType).toBe("percentage");
    expect(payload.discountValue).toBe(20);
    expect(payload.setMenuPriceCents).toBeNull();
    expect(payload.setMenuOriginalPriceCents).toBeNull();
    expect(payload.redemptionCode).toBe("悦聚同桌");
  });

  it("POST 行为不变：不使用的字段仍是 undefined（创建 schema 不接受 null）", () => {
    const payload = buildDealPayload({
      ...EMPTY_DEAL_FORM,
      kind: "set_menu",
      title: "套餐",
      setMenuPriceYuan: "598",
      setMenuOriginalPriceYuan: "758",
    });
    expect(payload.discountValue).toBeUndefined();
    expect(payload.redemptionCode).toBeUndefined();
  });
});

describe("normalizePoolGuaranteePayload（池绑定 submit-payload）", () => {
  it("绑定：保留两个 id", () => {
    expect(
      normalizePoolGuaranteePayload({ guaranteedVenueId: "venue-1", guaranteedDealId: "deal-1" }),
    ).toEqual({ guaranteedVenueId: "venue-1", guaranteedDealId: "deal-1" });
  });

  it("解绑：空串与 undefined 都落成 null，而不是缺字段", () => {
    expect(normalizePoolGuaranteePayload({ guaranteedVenueId: "", guaranteedDealId: "" })).toEqual({
      guaranteedVenueId: null,
      guaranteedDealId: null,
    });
    expect(normalizePoolGuaranteePayload({})).toEqual({
      guaranteedVenueId: null,
      guaranteedDealId: null,
    });
  });
});
