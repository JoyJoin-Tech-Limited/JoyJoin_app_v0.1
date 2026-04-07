import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

const { buildEventPoolStatsResponse } = await import("../routes/domains/eventPools");

describe("event pool stats contract", () => {
  it("keeps the drawer stats response shape stable", () => {
    const result = buildEventPoolStatsResponse({
      totalRegistrations: 7,
      minGroupSize: 4,
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
      poolFormableGroupCount: 1,
      avgMatchScore: 82,
      recentThemeTitles: [{ themeTitle: "城市夜游", themeEmoji: "🌃" }],
    });
  });

  it("returns 0 poolFormableGroupCount when registrations are below minGroupSize", () => {
    const result = buildEventPoolStatsResponse({
      totalRegistrations: 3,
      minGroupSize: 4,
      archetypeRows: [],
      avgMatchScore: 0,
      recentThemeTitles: [],
    });
    // A partial batch cannot form a complete group — pool readiness is 0.
    expect(result.poolFormableGroupCount).toBe(0);
  });
});
