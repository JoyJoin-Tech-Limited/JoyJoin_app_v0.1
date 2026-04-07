import { archetypeCategories, archetypeConfig } from "@/lib/archetypes";
import { getArchetypeCompatibility } from "@/lib/archetypeCompatibility";

export interface PoolEnergySlice {
  key: "highEnergy" | "mediumEnergy" | "lowEnergy" | "veryLowEnergy";
  label: string;
  colorClass: string;
  count: number;
  percentage: number;
}

const ENERGY_METADATA: Record<PoolEnergySlice["key"], { label: string; colorClass: string }> = {
  highEnergy: { label: "活跃能量", colorClass: "from-amber-400 to-orange-500" },
  mediumEnergy: { label: "社交流动", colorClass: "from-fuchsia-400 to-violet-500" },
  lowEnergy: { label: "深聊沉淀", colorClass: "from-sky-400 to-indigo-500" },
  veryLowEnergy: { label: "低压陪伴", colorClass: "from-emerald-400 to-teal-500" },
};

export function getEnergySlices(
  archetypeDistribution: Record<string, number>,
): PoolEnergySlice[] {
  const total = Object.values(archetypeDistribution).reduce((sum, count) => sum + count, 0);

  return (Object.keys(ENERGY_METADATA) as PoolEnergySlice["key"][])
    .map((key) => {
      const count = archetypeCategories[key].reduce(
        (sum, archetype) => sum + (archetypeDistribution[archetype] ?? 0),
        0,
      );
      return {
        key,
        label: ENERGY_METADATA[key].label,
        colorClass: ENERGY_METADATA[key].colorClass,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    })
    .filter((slice) => slice.count > 0);
}

export function getPoolVibeLabel(archetypeDistribution: Record<string, number>): string {
  const slices = getEnergySlices(archetypeDistribution);
  if (slices.length === 0) return "静待成形";

  const topSlice = [...slices].sort((a, b) => b.count - a.count)[0];
  if (!topSlice) return "静待成形";

  const total = Object.values(archetypeDistribution).reduce((sum, count) => sum + count, 0);
  const uniqueArchetypes = Object.keys(archetypeDistribution).filter(
    (archetype) => archetypeDistribution[archetype] > 0,
  ).length;

  if (uniqueArchetypes >= 5 && total >= 4) return "均衡";
  if (topSlice.key === "highEnergy") return "活跃";
  if (topSlice.key === "mediumEnergy") return "流动";
  if (topSlice.key === "lowEnergy") return "深度";
  return "低压";
}

export function getPoolWarmthScore(
  archetypeDistribution: Record<string, number>,
  userArchetype?: string | null,
): number {
  if (!userArchetype) return 58;

  let weightedScore = 0;
  let total = 0;

  for (const [archetype, count] of Object.entries(archetypeDistribution)) {
    if (!count) continue;
    weightedScore += getArchetypeCompatibility(userArchetype, archetype) * count;
    total += count;
  }

  return total > 0 ? Math.round(weightedScore / total) : 58;
}

export function getPoolWarmthLabel(score: number): string {
  if (score >= 82) return "特别对味";
  if (score >= 72) return "正在升温";
  if (score >= 60) return "气场不错";
  return "还在调频";
}

export function getPoolMicroSignals(
  archetypeDistribution: Record<string, number>,
): string[] {
  const sorted = Object.entries(archetypeDistribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (sorted.length === 0) {
    return ["新朋友正在加入", "气场会随人数继续更新"];
  }

  return sorted.map(([archetype]) => {
    const config = archetypeConfig[archetype];
    return config?.tagline ?? archetype;
  });
}
