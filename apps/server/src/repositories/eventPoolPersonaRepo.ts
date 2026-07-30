import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { eventPoolRegistrations, users, eventPools } from "@shared/schema";
import type { PoolPersonaSnapshotResponse, PoolPersonaStateBand } from "@shared/api";
import { getIntentLabel } from "@shared/constants";
import { resolveArchetype as resolveCanonicalArchetype } from "@shared/personality/archetypeNames";
import { logger } from "../lib/logger";

const THRESHOLDS = {
  archetypeTotal: 4,
  archetypeTopCount: 2,
  industryTotal: 6,
  industryClusterMin: 2,
  intentTotal: 6,
  intentClusterMin: 2,
  demographicTotal: 10,
  demographicClusterMin: 3,
  fullSheetTotal: 16,
} as const;

export const ACTIVE_PERSONA_REGISTRATION_STATUSES = ["pending", "matched"];

function calculateAge(birthdate: Date | string | null | undefined): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function resolveAgeLabel(age: number | null): string {
  if (age === null) return "未知年龄";
  if (age < 25) return "25岁以下";
  if (age < 30) return "25-29岁";
  if (age < 35) return "30-34岁";
  if (age < 40) return "35-39岁";
  return "40岁及以上";
}

function countOccurrences(values: (string | null | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value.trim() === "") continue;
    const normalized = value.trim();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

function topClusters(
  counts: Map<string, number>,
  total: number,
  maxClusters = 5
): Array<{ label: string; count: number; percentage: number }> {
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxClusters);
  return sorted.map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

function resolveIndustryLabel(user: typeof users.$inferSelect): string {
  return (
    user.industryNicheLabel ||
    user.industrySegmentLabel ||
    user.industryCategoryLabel ||
    (user.industryRawInput ? "其他行业" : "未知行业")
  );
}

export function resolvePersonaArchetypeLabel(identifier: string): string {
  const normalized = identifier.trim();
  return resolveCanonicalArchetype(normalized)?.nameCn ?? normalized;
}

export function resolvePersonaIntentLabel(intent: string): string {
  return getIntentLabel(intent.trim());
}

function resolveUserArchetypeLabel(user: typeof users.$inferSelect): string | null {
  const identifier = user.primaryArchetype || user.archetype;
  return identifier ? resolvePersonaArchetypeLabel(identifier) : null;
}

function resolveGenderLabel(gender: string | null | undefined): string {
  if (!gender) return "未填写";
  if (gender.includes("男")) return "男生";
  if (gender.includes("女")) return "女生";
  return "不透露";
}

export function determineStateBand(
  totalRegistrants: number,
  dimensions: PoolPersonaSnapshotResponse["dimensions"]
): PoolPersonaStateBand {
  if (totalRegistrants < 1) return "seed";

  const archetype = dimensions.find((d) => d.key === "archetype");
  const industry = dimensions.find((d) => d.key === "industry");
  const intent = dimensions.find((d) => d.key === "intent");
  const age = dimensions.find((d) => d.key === "age");
  const gender = dimensions.find((d) => d.key === "gender");

  const hasArchetype =
    !!archetype &&
    archetype.total >= THRESHOLDS.archetypeTotal &&
    (archetype.clusters[0]?.count ?? 0) >= THRESHOLDS.archetypeTopCount;

  const hasIndustry =
    !!industry &&
    industry.total >= THRESHOLDS.industryTotal &&
    industry.clusters.filter((c) => c.count >= THRESHOLDS.industryClusterMin).length >= 1;

  const hasIntent =
    !!intent &&
    intent.total >= THRESHOLDS.intentTotal &&
    intent.clusters.filter((c) => c.count >= THRESHOLDS.intentClusterMin).length >= 1;

  const hasDemographics =
    !!age &&
    age.total >= THRESHOLDS.demographicTotal &&
    !!gender &&
    gender.total >= THRESHOLDS.demographicTotal &&
    gender.clusters.filter((c) => c.count >= THRESHOLDS.demographicClusterMin).length >= 1;

  const disclosedCount = [hasArchetype, hasIndustry, hasIntent, hasDemographics].filter(Boolean).length;

  if (totalRegistrants >= THRESHOLDS.fullSheetTotal && disclosedCount >= 4) return "full";
  if (disclosedCount >= 3) return "clear";
  if (disclosedCount >= 2) return "outline";
  if (disclosedCount >= 1 || totalRegistrants >= 3) return "glimmer";
  return "seed";
}

export async function buildPoolPersonaSnapshot(
  poolId: string,
  requestingUserId?: string
): Promise<PoolPersonaSnapshotResponse | null> {
  const startMs = Date.now();

  const [pool] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);

  if (!pool) {
    return null;
  }

  const rows: Array<{ user: typeof users.$inferSelect; registration: typeof eventPoolRegistrations.$inferSelect }> = await db
    .select({
      user: users,
      registration: eventPoolRegistrations,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        inArray(eventPoolRegistrations.matchStatus, ACTIVE_PERSONA_REGISTRATION_STATUSES)
      )
    )
    .orderBy(desc(eventPoolRegistrations.registeredAt));

  const totalRegistrants = rows.length;

  const archetypeCounts = countOccurrences(rows.map((r) => resolveUserArchetypeLabel(r.user)));
  const industryCounts = countOccurrences(rows.map((r) => resolveIndustryLabel(r.user)));

  const intentValues: string[] = [];
  for (const row of rows) {
    const intents = row.registration.eventIntent ?? row.user.intent ?? [];
    for (const intent of intents) {
      if (intent && intent.trim() !== "") {
        intentValues.push(resolvePersonaIntentLabel(intent));
      }
    }
  }
  const intentCounts = countOccurrences(intentValues);

  const ageLabels = rows.map((r) => resolveAgeLabel(calculateAge(r.user.birthdate)));
  const ageCounts = countOccurrences(ageLabels);

  const genderLabels = rows.map((r) => resolveGenderLabel(r.user.gender));
  const genderCounts = countOccurrences(genderLabels);

  const archetypeTotal = archetypeCounts.size > 0 ? rows.filter((r) => resolveUserArchetypeLabel(r.user)).length : 0;
  const industryTotal = industryCounts.size > 0 ? rows.filter((r) => resolveIndustryLabel(r.user) !== "未知行业").length : 0;
  const intentTotal = intentValues.length;
  const ageTotal = ageCounts.size > 0 ? rows.filter((r) => calculateAge(r.user.birthdate) !== null).length : 0;
  const genderTotal = genderCounts.size > 0 ? rows.filter((r) => r.user.gender).length : 0;

  const dimensions: PoolPersonaSnapshotResponse["dimensions"] = [
    {
      key: "archetype",
      label: "社交氛围",
      total: archetypeTotal,
      disclosed: archetypeTotal >= THRESHOLDS.archetypeTotal,
      clusters: topClusters(archetypeCounts, archetypeTotal),
    },
    {
      key: "industry",
      label: "行业背景",
      total: industryTotal,
      disclosed: industryTotal >= THRESHOLDS.industryTotal,
      clusters: topClusters(industryCounts, industryTotal),
    },
    {
      key: "intent",
      label: "报名期待",
      total: intentTotal,
      disclosed: intentTotal >= THRESHOLDS.intentTotal,
      clusters: topClusters(intentCounts, intentTotal),
    },
    {
      key: "age",
      label: "年龄分布",
      total: ageTotal,
      disclosed: ageTotal >= THRESHOLDS.demographicTotal,
      clusters: topClusters(ageCounts, ageTotal),
    },
    {
      key: "gender",
      label: "性别比例",
      total: genderTotal,
      disclosed: genderTotal >= THRESHOLDS.demographicTotal,
      clusters: topClusters(genderCounts, genderTotal),
    },
  ];

  const stateBand = determineStateBand(totalRegistrants, dimensions);

  const latestRegistrationAt = rows[0]?.registration.registeredAt
    ? new Date(rows[0].registration.registeredAt).toISOString()
    : null;

  let userArchetype: string | null = null;
  if (requestingUserId) {
    const requestingRow = rows.find((r) => r.user.id === requestingUserId);
    if (requestingRow) {
      userArchetype = resolveUserArchetypeLabel(requestingRow.user);
    }
  }

  const durationMs = Date.now() - startMs;
  logger.info("[eventPoolPersonaRepo] Snapshot computed", {
    poolId,
    totalRegistrants,
    stateBand,
    durationMs,
  });

  return {
    stateBand,
    totalRegistrants,
    dimensions,
    thresholds: { ...THRESHOLDS },
    latestRegistrationAt,
    snapshotComputedAt: new Date().toISOString(),
    userArchetype,
  };
}
