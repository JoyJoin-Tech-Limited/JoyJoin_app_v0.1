/**
 * Match Compass business logic helpers
 * Preference DNA defaults, strictness utilities, and pool temperature computation.
 */

import type { ArchetypeName } from "../archetypeConfig";

export type GenderComposition = "mixed" | "female_only" | "no_pref";
export type KolComfort = "comfortable" | "neutral" | "avoid";

export interface PreferenceDNA {
  strictness: number;
  preferredDistricts: string[] | null;
  genderComposition: GenderComposition | null;
  acceptPairs: boolean | null;
  kolComfort: KolComfort | null;
  ageMatchPreference: string | null;
  tableVibePreference: string | null;
}

const DEFAULT_DNA: PreferenceDNA = {
  strictness: 50,
  preferredDistricts: null,
  genderComposition: null,
  acceptPairs: true,
  kolComfort: null,
  ageMatchPreference: null,
  tableVibePreference: null,
};

/**
 * Archetype-informed default preferences.
 * Returns a PreferenceDNA shape pre-filled based on the user's primary archetype.
 */
export function buildDefaultPreferencesFromArchetype(
  archetype: string | null | undefined,
): PreferenceDNA {
  const base: PreferenceDNA = { ...DEFAULT_DNA };

  switch (archetype as ArchetypeName | undefined) {
    case "corgi": // 开心柯基
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 40;
      break;
    case "rooster": // 太阳鸡
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 50;
      break;
    case "hamster_praise": // 捧场王仓鼠
      base.acceptPairs = true;
      base.genderComposition = "no_pref";
      base.strictness = 45;
      break;
    case "fox": // 探宝雷达狐
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 55;
      break;
    case "dolphin_calm": // 读空气海豚
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 50;
      break;
    case "spider": // 社交裁缝蛛
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 35;
      break;
    case "koala": // 情绪树洞考拉
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 55;
      break;
    case "octopus": // 脑洞喷泉章鱼
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 40;
      break;
    case "owl": // 追问猫头鹰
      base.acceptPairs = false;
      base.genderComposition = "no_pref";
      base.strictness = 65;
      break;
    case "elephant": // 定海神针大象
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 50;
      break;
    case "turtle": // 慢半拍龟
      base.acceptPairs = true;
      base.genderComposition = "mixed";
      base.strictness = 45;
      break;
    case "cat": // 静音模式猫
      base.acceptPairs = false;
      base.genderComposition = "no_pref";
      base.strictness = 60;
      break;
    default:
      // Unknown archetype: return fully neutral defaults
      break;
  }

  return base;
}

/**
 * Temperature band for a pool based on its overall score or registration vitality.
 * cold < 55, mild 55-69, warm 70-84, fire 85+
 */
export function resolveTemperatureBand(score: number): {
  level: "cold" | "mild" | "warm" | "fire";
  label: string;
} {
  if (score >= 85) return { level: "fire", label: "炽热" };
  if (score >= 70) return { level: "warm", label: "稳健" };
  if (score >= 55) return { level: "mild", label: "温和" };
  return { level: "cold", label: "偏冷" };
}

/**
 * Coerce a nullable strictness to its runtime default (50).
 */
export function coerceStrictness(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return value;
}
