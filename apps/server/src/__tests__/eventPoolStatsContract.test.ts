import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

const { buildEventPoolStatsResponse } = await import("../routes/domains/eventPools");

describe("event pool stats contract", () => {
  it("keeps the drawer stats response shape stable", () => {
    const result = buildEventPoolStatsResponse({
      totalRegistrations: 7,
      minGroupSize: 4,
      targetGroups: 3,
      archetypeRows: [
        { archetype: "柯基", count: 3 },
        { archetype: "狐狸", count: 4 },
      ],
      avgMatchScore: 82,
      recentThemeTitles: [{ themeTitle: "城市夜游", themeEmoji: "🌃" }],
    });

    expect(result).toEqual({
      totalRegistrations: 7,
      archetypeBreakdown: {
        柯基: 3,
        狐狸: 4,
      },
      // floor(7 / 4) = 1 — conservative: only fully-formable groups are counted.
      estimatedGroups: 1,
      avgMatchScore: 82,
      recentThemeTitles: [{ themeTitle: "城市夜游", themeEmoji: "🌃" }],
    });
  });

  it("does not report more groups than the pool is configured to form", () => {
    const result = buildEventPoolStatsResponse({
      totalRegistrations: 12,
      minGroupSize: 4,
      targetGroups: 2,
      archetypeRows: [],
      avgMatchScore: 0,
      recentThemeTitles: [],
    });

    expect(result.estimatedGroups).toBe(2);
  });
});
