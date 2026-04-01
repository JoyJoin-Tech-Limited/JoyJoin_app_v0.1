import { describe, expect, it } from "vitest";
import { buildEventPoolStatsResponse } from "../routes/domains/eventPools";

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
      estimatedGroups: 2,
      avgMatchScore: 82,
      recentThemeTitles: [{ themeTitle: "城市夜游", themeEmoji: "🌃" }],
    });
  });
});
