import { describe, expect, it } from "vitest";

import { renderFlashPersonalizedPlan } from "../services/flashPersonalizedNarrativeService";

describe("flash personalized narrative renderer", () => {
  it("renders only server-controlled copy around the canonical response", () => {
    const response = renderFlashPersonalizedPlan(
      { tone: "gentle", lens: "industry", cadence: "balanced" },
      "这件旧物还没有准备好离开。",
      { broadIndustry: "创意", timeBand: "evening" },
    );
    expect(response).toContain("创意");
    expect(response).toContain("这件旧物还没有准备好离开。");
  });

  it("does not require private signals for neutral fallback", () => {
    expect(renderFlashPersonalizedPlan(
      { tone: "reflective", lens: "neutral", cadence: "short" },
      "先把这一块碎片收好。",
      { timeBand: "morning" },
    )).toContain("先把这一块碎片收好。");
  });
});
