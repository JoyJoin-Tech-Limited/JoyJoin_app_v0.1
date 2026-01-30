/**
 * Archetype image & color registry for slot machine and preview components
 */

import { ARCHETYPE_CANONICAL_ORDER } from "@shared/personality/archetypeNames";
import corgiImg from "@/assets/开心柯基_transparent_1.png";
import foxImg from "@/assets/机智狐_transparent_2.png";
import bearImg from "@/assets/暖心熊_transparent_3.png";
import spiderImg from "@/assets/织网蛛_transparent_4.png";
import pigImg from "@/assets/夸夸豚_transparent_5.png";
import chickenImg from "@/assets/太阳鸡_transparent_6.png";
import dolphinImg from "@/assets/淡定海豚_transparent_7.png";
import owlImg from "@/assets/沉思猫头鹰_transparent_8.png";
import turtleImg from "@/assets/稳如龟_transparent_9.png";
import catImg from "@/assets/隐身猫_transparent_10.png";
import elephantImg from "@/assets/定心大象_transparent_11.png";
import octopusImg from "@/assets/灵感章鱼_transparent_12.png";

export interface ArchetypeInfo {
  id: string;
  name: string;
  image: string;
  /** HSL color values: [hue, saturation%, lightness%] */
  color: [number, number, number];
  emoji: string;
}

/**
 * Canonical archetype definitions
 * Order is imported from shared module (@shared/personality/archetypeNames)
 * to ensure consistency with backend and prevent drift
 */
const CANONICAL_ARCHETYPES: Record<string, ArchetypeInfo> = {
  "开心柯基": {
    id: "corgi",
    name: "开心柯基",
    image: corgiImg,
    color: [43, 96, 56], // amber
    emoji: "🐕",
  },
  "太阳鸡": {
    id: "chicken",
    name: "太阳鸡",
    image: chickenImg,
    color: [50, 90, 55], // yellow
    emoji: "🐔",
  },
  "夸夸豚": {
    id: "pig",
    name: "夸夸豚",
    image: pigImg,
    color: [340, 75, 65], // pink
    emoji: "🐷",
  },
  "机智狐": {
    id: "fox",
    name: "机智狐",
    image: foxImg,
    color: [25, 95, 53], // orange
    emoji: "🦊",
  },
  "淡定海豚": {
    id: "dolphin",
    name: "淡定海豚",
    image: dolphinImg,
    color: [187, 85, 53], // cyan
    emoji: "🐬",
  },
  "织网蛛": {
    id: "spider",
    name: "织网蛛",
    image: spiderImg,
    color: [220, 50, 45], // blue-gray
    emoji: "🕷️",
  },
  "暖心熊": {
    id: "bear",
    name: "暖心熊",
    image: bearImg,
    color: [24, 80, 50], // warm brown
    emoji: "🐻",
  },
  "灵感章鱼": {
    id: "octopus",
    name: "灵感章鱼",
    image: octopusImg,
    color: [271, 91, 65], // purple
    emoji: "🐙",
  },
  "沉思猫头鹰": {
    id: "owl",
    name: "沉思猫头鹰",
    image: owlImg,
    color: [260, 50, 50], // deep purple
    emoji: "🦉",
  },
  "定心大象": {
    id: "elephant",
    name: "定心大象",
    image: elephantImg,
    color: [200, 30, 55], // gray-blue
    emoji: "🐘",
  },
  "稳如龟": {
    id: "turtle",
    name: "稳如龟",
    image: turtleImg,
    color: [150, 60, 45], // green
    emoji: "🐢",
  },
  "隐身猫": {
    id: "cat",
    name: "隐身猫",
    image: catImg,
    color: [280, 40, 55], // muted purple
    emoji: "🐱",
  },
};

/** Archetype name aliases (maps shortened/variant names to canonical names) */
const ARCHETYPE_ALIASES: Record<string, string> = {
  // No aliases needed - all names match backend canonical names
};

/** Combined archetype data with aliases resolved */
export const ARCHETYPE_DATA: Record<string, ArchetypeInfo> = {
  ...CANONICAL_ARCHETYPES,
  // Add alias entries pointing to same info (with corrected name display)
  ...Object.fromEntries(
    Object.entries(ARCHETYPE_ALIASES).map(([alias, canonical]) => [
      alias,
      { ...CANONICAL_ARCHETYPES[canonical], name: alias },
    ])
  ),
};

/** List of all archetype names for slot machine cycling - derived from shared canonical order */
export const ARCHETYPE_NAMES = [...ARCHETYPE_CANONICAL_ORDER];

/** Get archetype info with fallback */
export function getArchetypeInfo(name: string): ArchetypeInfo {
  return ARCHETYPE_DATA[name] || ARCHETYPE_DATA["开心柯基"];
}

/** Get archetype color as CSS HSL string */
export function getArchetypeColorHSL(name: string): string {
  const info = getArchetypeInfo(name);
  return `hsl(${info.color[0]}, ${info.color[1]}%, ${info.color[2]}%)`;
}

/**
 * Validate an archetype name and return the canonical version
 * Returns the input if valid, or null if not found
 */
export function validateArchetypeName(name: string): string | null {
  // Exact match
  if (ARCHETYPE_NAMES.includes(name as any)) {
    return name;
  }
  
  // Trimmed match
  const trimmed = name.trim();
  const found = ARCHETYPE_NAMES.find(n => n.trim() === trimmed);
  if (found) return found;
  
  // Normalized match
  const normalized = name.normalize('NFC');
  const foundNormalized = ARCHETYPE_NAMES.find(n => n.normalize('NFC') === normalized);
  if (foundNormalized) return foundNormalized;
  
  return null;
}
