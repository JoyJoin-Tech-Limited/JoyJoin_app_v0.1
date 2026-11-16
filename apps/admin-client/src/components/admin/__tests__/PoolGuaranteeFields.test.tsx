import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Radix Select 在 jsdom 中依赖指针捕获等浏览器能力；
// 这里用原生 select 替身测试组件的取值/清空/回填契约，样式不参与断言。
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@/lib/queryClient";
import PoolGuaranteeFields, {
  isPoolGuaranteeDealRedeemable,
  isPoolGuaranteeVenueEligible,
} from "../PoolGuaranteeFields";

const eligibleVenue = {
  district: "南山",
  type: "restaurant",
  isActive: true,
  onboardingStatus: "active" as const,
  partnerStatus: "active" as const,
  contractEndDate: null,
};
const venues = [
  { id: "venue-1", name: "悦聚小馆", brandName: "悦聚小馆", city: "深圳", ...eligibleVenue },
  { id: "venue-2", name: "香江小馆", brandName: "香江小馆", city: "香港", ...eligibleVenue },
  { id: "venue-3", name: "停用门店", brandName: "停用门店", city: "深圳", ...eligibleVenue, isActive: false },
];

const validDeal = {
  venueId: "venue-1",
  description: "无门槛全单通用",
  discountType: "percentage" as const,
  discountValue: 20,
  setMenuPriceCents: null,
  setMenuOriginalPriceCents: null,
  redemptionMethod: "show_page" as const,
  redemptionCode: null,
  isActive: true,
};
const deals = [
  { id: "deal-1", title: "本场专属折扣", ...validDeal },
  { id: "deal-2", title: "旧赠饮", ...validDeal, isActive: false },
];

function mockApi() {
  (apiRequest as any).mockImplementation(async (_method: string, url: string) => {
    if (url === "/api/admin/venues") return { json: async () => venues };
    if (url === "/api/admin/venues/venue-1/deals") return { json: async () => deals };
    return { json: async () => [] };
  });
}

function renderFields(value: { venueId: string | null; dealId: string | null }, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PoolGuaranteeFields city="深圳" district="南山" eventType="饭局" value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

const venueSelect = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;
const dealSelect = () => screen.getAllByRole("combobox")[1] as HTMLSelectElement;

describe("PoolGuaranteeFields（AC-08）", () => {
  beforeEach(() => {
    (apiRequest as any).mockReset();
    mockApi();
  });

  it("只列出同城且启用中的场地", async () => {
    renderFields({ venueId: null, dealId: null });
    await waitFor(() => expect(venueSelect().options.length).toBe(2)); // 不绑定 + 悦聚小馆
    expect(screen.queryByText("香江小馆")).toBeNull();
    expect(screen.queryByText("停用门店")).toBeNull();
    expect(dealSelect().disabled).toBe(true);
  });

  it("选择场地后清空已选权益", async () => {
    const onChange = renderFields({ venueId: null, dealId: "deal-old" });
    await waitFor(() => expect(venueSelect().options.length).toBe(2));
    fireEvent.change(venueSelect(), { target: { value: "venue-1" } });
    expect(onChange).toHaveBeenCalledWith({ venueId: "venue-1", dealId: null });
  });

  it("选择「不绑定」同时清空两者", async () => {
    const onChange = renderFields({ venueId: "venue-1", dealId: "deal-1" });
    await waitFor(() => expect(venueSelect().options.length).toBe(2));
    fireEvent.change(venueSelect(), { target: { value: "__none__" } });
    expect(onChange).toHaveBeenCalledWith({ venueId: null, dealId: null });
  });

  it("编辑回填：场地与权益都显示当前值，且只列出有效权益", async () => {
    renderFields({ venueId: "venue-1", dealId: "deal-1" });
    await waitFor(() => expect(dealSelect().options.length).toBe(2)); // 不绑定 + 有效权益
    expect(venueSelect().value).toBe("venue-1");
    expect(dealSelect().value).toBe("deal-1");
    expect(screen.queryByText("旧赠饮")).toBeNull();
  });

  it("已停用的已绑定权益仍以「当前已选 · 不可用」标注回填", async () => {
    renderFields({ venueId: "venue-1", dealId: "deal-2" });
    await screen.findByText("旧赠饮（当前已选 · 不可用）");
    expect(dealSelect().value).toBe("deal-2");
  });

  it("切换权益时保留场地", async () => {
    const onChange = renderFields({ venueId: "venue-1", dealId: null });
    await waitFor(() => expect(dealSelect().options.length).toBe(2));
    fireEvent.change(dealSelect(), { target: { value: "deal-1" } });
    expect(onChange).toHaveBeenCalledWith({ venueId: "venue-1", dealId: "deal-1" });
  });

  it("场地无有效权益时给出提示", async () => {
    renderFields({ venueId: "venue-1", dealId: null });
    // 本用例使用只有停用权益的响应
    (apiRequest as any).mockImplementation(async (_m: string, url: string) => {
      if (url === "/api/admin/venues") return { json: async () => venues };
      return { json: async () => [deals[1]] };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByTestId } = render(
      <QueryClientProvider client={client}>
        <PoolGuaranteeFields city="深圳" district="南山" eventType="饭局" value={{ venueId: "venue-1", dealId: null }} onChange={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await findByTestId("guarantee-no-deals")).toBeTruthy();
  });

  it("成局后的编辑对话框只读展示保底，不提供换绑/解绑", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PoolGuaranteeFields city="深圳" district="南山" eventType="饭局" locked value={{ venueId: "venue-1", dealId: "deal-1" }} onChange={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("guarantee-locked-note")).toBeTruthy();
    expect(venueSelect().disabled).toBe(true);
    expect(dealSelect().disabled).toBe(true);
  });

  it("运行期必拒的场地不会进入保底选项（区域/类型/合作状态/合同）", () => {
    const context = { city: "深圳", district: "南山", eventType: "饭局" };
    expect(isPoolGuaranteeVenueEligible(venues[0] as any, context, "2026-11-16")).toBe(true);
    for (const invalid of [
      { ...venues[0], district: "福田" },
      { ...venues[0], type: "bar" },
      { ...venues[0], onboardingStatus: "draft" },
      { ...venues[0], partnerStatus: "paused" },
      { ...venues[0], contractEndDate: "2026-11-15" },
    ]) {
      expect(isPoolGuaranteeVenueEligible(invalid as any, context, "2026-11-16")).toBe(false);
    }
  });

  it("legacy 或无效权益不会进入保底选项", () => {
    expect(isPoolGuaranteeDealRedeemable(deals[0] as any)).toBe(true);
    expect(isPoolGuaranteeDealRedeemable({ ...deals[0], discountType: "gift" } as any)).toBe(false);
    expect(isPoolGuaranteeDealRedeemable({ ...deals[0], discountValue: 0 } as any)).toBe(false);
  });
});
