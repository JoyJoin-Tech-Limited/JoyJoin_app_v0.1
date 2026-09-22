/**
 * Live proof for T7 budget-adjacency degradation, driven by the REAL DB +
 * the REAL scoring function (`scoreVenueForGroup`).
 *
 * Scenario: group consensus = `dining_150_200` (order 1, from legacy label
 * "150-200"), venue = T馆·艺术餐厅 tagged `dining_200_300` (order 2).
 * Distance = 1 (adjacent).
 *
 *   adjacencyEnabled=false → score 0 + `预算不匹配` (hard fail, today's behaviour)
 *   adjacencyEnabled=true  → score 20 + `budget_adjacent` (degradation rescue)
 *
 * Run: tsx --tsconfig apps/server/tsconfig.json apps/server/scripts/budget-adjacency-live-proof.ts
 */
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { venues } from "@shared/schema";
import { scoreVenueForGroup } from "../src/venueAssignmentService";
import { getFeatureFlag } from "../src/lib/featureFlags";
import { normalizeBudgetTierIds } from "@shared/budgetTiers";
import type { MatchGroup, UserWithProfile } from "../src/matching/poolMatchingTypes";

function member(id: string): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg_${id}`,
    budgetRange: ["150-200"], // legacy label → normalizeBudgetTierIds → dining_150_200
    barBudgetRange: [],
    cuisinePreferences: ["西餐"],
  } as unknown as UserWithProfile;
}

async function main() {
  const dbFlag = await getFeatureFlag("budgetAdjacencyEnabled");
  console.log(`[proof] DB flag budgetAdjacencyEnabled = ${dbFlag}`);

  const tguan = await db.select().from(venues).where(eq(venues.name, "T馆·艺术餐厅")).limit(1);
  if (tguan.length === 0) {
    console.error("T馆 not found");
    process.exit(1);
  }
  console.log(`[proof] T馆 budget_categories = ${JSON.stringify(tguan[0].budgetCategories)}`);

  const group: MatchGroup = {
    members: [member("u1"), member("u2"), member("u3"), member("u4")],
    avgPairScore: 70, avgChemistryScore: 70, diversityScore: 70,
    communicationBalance: 70, overallScore: 70, temperatureLevel: "warm", explanation: "proof",
  };

  const groupBudget = normalizeBudgetTierIds(["150-200"], { eventType: "饭局" }).ids;
  console.log(`[proof] groupBudget (normalized) = ${JSON.stringify(groupBudget)}`);

  const eventDateTime = new Date(Date.UTC(2026, 8, 23, 11, 30, 0)); // 19:30 local (UTC+8)

  for (const adjacencyEnabled of [false, true]) {
    const res = await scoreVenueForGroup(tguan[0], group, eventDateTime, "饭局", groupBudget, {
      adjacencyEnabled,
      strictPass: true,
    });
    console.log(
      `[proof] adjacencyEnabled=${adjacencyEnabled} → score=${res.score} | reasons: ${res.reasons.join(" | ")}`,
    );
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
