import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueDealPreview from "../VenueDealPreview";
import {
  VENUE_DEAL_CODE_PLACEHOLDER,
  VENUE_DEAL_DISCOUNT_VALUE_ERROR,
  VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER,
  VENUE_DEAL_RULE_LINE,
} from "@shared/copy/venueDealCopy";

describe("VenueDealPreview（AC-07）", () => {
  it("占位与校验提示也来自共享 copy，无本地硬编码文案", () => {
    render(<VenueDealPreview kind="discount" title="" discountValue={0} method="code" />);
    expect(screen.getByText(VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByTestId("preview-code").textContent).toBe(VENUE_DEAL_CODE_PLACEHOLDER);
    expect(screen.getByText(VENUE_DEAL_DISCOUNT_VALUE_ERROR)).toBeTruthy();
  });

  it("折扣卡：8 折 + 标题 + 规则行", () => {
    render(
      <VenueDealPreview
        kind="discount"
        title="本场专属折扣"
        description="无门槛全单通用"
        discountValue={20}
        method="code"
        code="悦聚同桌"
        venueName="悦聚小馆"
      />,
    );
    expect(screen.getByTestId("preview-value").textContent).toBe("8 折");
    expect(screen.getByTestId("preview-title").textContent).toBe("本场专属折扣");
    expect(screen.getByTestId("preview-code").textContent).toBe("悦聚同桌");
    expect(screen.getByText(VENUE_DEAL_RULE_LINE)).toBeTruthy();
    expect(screen.getByText("悦聚小馆")).toBeTruthy();
  });

  it("折扣换算沿用共享 copy：25 → 7.5 折", () => {
    render(
      <VenueDealPreview kind="discount" title="折扣" discountValue={25} method="show_page" />,
    );
    expect(screen.getByTestId("preview-value").textContent).toBe("7.5 折");
  });

  it("套餐卡：一口价 + 划线原价 + 出示提示", () => {
    render(
      <VenueDealPreview
        kind="set_menu"
        title="六人分享套餐"
        description="6菜1汤加特调"
        setMenuPriceCents={59800}
        setMenuOriginalPriceCents={75800}
        method="show_page"
      />,
    );
    expect(screen.getByTestId("preview-value").textContent).toBe("¥598");
    expect(screen.getByTestId("preview-original-price").textContent).toBe("¥758");
    expect(screen.getByTestId("preview-show-page").textContent).toBe("把这一页递给店员");
    expect(screen.queryByTestId("preview-code")).toBeNull();
  });

  it("空表单不编造面值", () => {
    render(<VenueDealPreview kind="discount" title="" method="show_page" />);
    expect(screen.getByTestId("preview-value").textContent).toBe("—");
    expect(screen.getByTestId("preview-title").textContent).toBe("本场专属折扣");
  });
});
