/**
 * S2：后台保底 reason 中文文案 + 停用确认后果文案（AC-08/AC-09）
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REASON_LABELS } from "../EventPoolDetailDialog";

const GUARANTEE_REASONS = [
  "guaranteed_binding_incomplete",
  "guaranteed_venue_unavailable",
  "guaranteed_deal_unavailable",
  "guaranteed_venue_no_slot",
  "guaranteed_venue_capacity",
];

describe("EventPoolDetailDialog REASON_LABELS", () => {
  it.each(GUARANTEE_REASONS)("%s 有中文文案，不直接展示英文 code", (reason) => {
    expect(REASON_LABELS[reason]).toBeDefined();
    expect(REASON_LABELS[reason].label).not.toBe(reason);
    expect(REASON_LABELS[reason].label).toMatch(/[一-龥]/);
  });
});

describe("VenueDealsManager 停用确认（D9）", () => {
  it("明确说明不成局与全退后果", () => {
    const src = readFileSync(resolve(__dirname, "../VenueDealsManager.tsx"), "utf8");
    expect(src).toContain("无法成局");
    expect(src).toContain("全额退款");
  });
});
