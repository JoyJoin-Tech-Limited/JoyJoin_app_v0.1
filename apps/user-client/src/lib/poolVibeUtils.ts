import { archetypeConfig } from "@/lib/archetypes";
import type { OverallChemistry } from "@shared/types/groupAnalysis";

/** Derive OverallChemistry from avgMatchScore (0-100 scale) */
export function deriveChemistryFromScore(avgMatchScore: number): OverallChemistry {
  if (avgMatchScore >= 85) return "fire";
  if (avgMatchScore >= 70) return "warm";
  if (avgMatchScore >= 55) return "mild";
  return "cold";
}

/** Derive OverallChemistry from sampleArchetypes (average energy level) */
export function deriveChemistryFromArchetypes(sampleArchetypes: string[]): OverallChemistry {
  if (!sampleArchetypes || sampleArchetypes.length === 0) return "warm"; // default
  const totalEnergy = sampleArchetypes.reduce((sum, a) => {
    return sum + (archetypeConfig[a]?.energyLevel ?? 65);
  }, 0);
  const avgEnergy = totalEnergy / sampleArchetypes.length;
  if (avgEnergy >= 82) return "fire";
  if (avgEnergy >= 65) return "warm";
  if (avgEnergy >= 48) return "mild";
  return "cold";
}

/** Get a short, contextual FitHint from archetype composition */
export function getFitHintFromArchetypes(
  sampleArchetypes: string[],
  eventType: "饭局" | "酒局",
  isGirlsNight?: boolean
): { icon: string; text: string } | null {
  if (isGirlsNight) return { icon: "💫", text: "Girl Gang 专属" };
  if (!sampleArchetypes || sampleArchetypes.length === 0) return null;
  const chemistry = deriveChemistryFromArchetypes(sampleArchetypes);
  const hints: Record<OverallChemistry, { icon: string; text: string }> = {
    fire: { icon: "🔥", text: eventType === "酒局" ? "高能酒局" : "活力聚会" },
    warm: { icon: "✨", text: "深聊友好" },
    mild: { icon: "💬", text: "轻松相聊" },
    cold: { icon: "🌱", text: "慢热深度" },
  };
  return hints[chemistry];
}

/** Derive 2–4 connection cues from pool stats for the ConnectionCuePanel */
export function deriveConnectionCues(
  archetypeBreakdown: Record<string, number>,
  avgMatchScore: number,
  totalRegistrations: number
): Array<{ icon: string; text: string }> {
  const cues: Array<{ icon: string; text: string }> = [];
  const archetypes = Object.keys(archetypeBreakdown);

  // High avg match score → personal fit cue
  if (avgMatchScore >= 72) {
    cues.push({ icon: "🎯", text: "适配度高" });
  }

  // Multiple different archetypes → complementary vibes
  if (archetypes.length >= 3) {
    cues.push({ icon: "✨", text: "性格互补" });
  }

  // Check for mix of high and low energy archetypes → diverse energy
  // Default 0: unknown archetypes conservatively excluded from high-energy bucket
  // Default 65: unknown archetypes conservatively excluded from low-energy bucket (neutral)
  const highEnergy = archetypes.filter(a => (archetypeConfig[a]?.energyLevel ?? 0) >= 75);
  const lowEnergy = archetypes.filter(a => (archetypeConfig[a]?.energyLevel ?? 65) < 55);
  if (highEnergy.length > 0 && lowEnergy.length > 0) {
    cues.push({ icon: "🌍", text: "能量互补" });
  } else if (archetypes.length >= 4) {
    cues.push({ icon: "🌍", text: "背景多元" });
  }

  // Growing pool → good conversation potential
  if (totalRegistrations >= 4) {
    cues.push({ icon: "💫", text: "聊感活跃" });
  } else if (totalRegistrations > 0 && cues.length < 2) {
    cues.push({ icon: "🌱", text: "亲密小圈" });
  }

  return cues.slice(0, 4);
}
