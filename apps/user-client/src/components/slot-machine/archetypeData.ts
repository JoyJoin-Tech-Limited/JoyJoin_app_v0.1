/**
 * Archetype image & color registry for slot machine and preview components
 */

import { ARCHETYPE_CANONICAL_ORDER } from "@shared/personality/archetypeNames";
import corgiImg from "@/assets/corgi_transparent_1.png";
import foxImg from "@/assets/fox_transparent_2.png";
import bearImg from "@/assets/koala_transparent_3.png";
import spiderImg from "@/assets/spider_transparent_4.png";
import pigImg from "@/assets/hamster_praise_transparent_5.png";
import chickenImg from "@/assets/rooster_transparent_6.png";
import dolphinImg from "@/assets/dolphin_calm_transparent_7.png";
import owlImg from "@/assets/owl_transparent_8.png";
import turtleImg from "@/assets/turtle_transparent_9.png";
import catImg from "@/assets/cat_transparent_10.png";
import elephantImg from "@/assets/elephant_transparent_11.png";
import octopusImg from "@/assets/octopus_transparent_12.png";

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
  "corgi": {
    id: "corgi",
    name: "corgi",
    image: corgiImg,
    color: [43, 96, 56], // amber
    emoji: "🐕",
  },
  "rooster": {
    id: "chicken",
    name: "rooster",
    image: chickenImg,
    color: [50, 90, 55], // yellow
    emoji: "🐔",
  },
  "hamster_praise": {
    id: "pig",
    name: "hamster_praise",
    image: pigImg,
    color: [340, 75, 65], // pink
    emoji: "🐷",
  },
  "fox": {
    id: "fox",
    name: "fox",
    image: foxImg,
    color: [25, 95, 53], // orange
    emoji: "🦊",
  },
  "dolphin_calm": {
    id: "dolphin",
    name: "dolphin_calm",
    image: dolphinImg,
    color: [187, 85, 53], // cyan
    emoji: "🐬",
  },
  "spider": {
    id: "spider",
    name: "spider",
    image: spiderImg,
    color: [220, 50, 45], // blue-gray
    emoji: "🕷️",
  },
  "koala": {
    id: "bear",
    name: "koala",
    image: bearImg,
    color: [24, 80, 50], // warm brown
    emoji: "🐻",
  },
  "octopus": {
    id: "octopus",
    name: "octopus",
    image: octopusImg,
    color: [271, 91, 65], // purple
    emoji: "🐙",
  },
  "owl": {
    id: "owl",
    name: "owl",
    image: owlImg,
    color: [260, 50, 50], // deep purple
    emoji: "🦉",
  },
  "elephant": {
    id: "elephant",
    name: "elephant",
    image: elephantImg,
    color: [200, 30, 55], // gray-blue
    emoji: "🐘",
  },
  "turtle": {
    id: "turtle",
    name: "turtle",
    image: turtleImg,
    color: [150, 60, 45], // green
    emoji: "🐢",
  },
  "cat": {
    id: "cat",
    name: "cat",
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
  return ARCHETYPE_DATA[name] || ARCHETYPE_DATA["corgi"];
}

/** Get archetype color as CSS HSL string */
export function getArchetypeColorHSL(name: string): string {
  const info = getArchetypeInfo(name);
  return `hsl(${info.color[0]}, ${info.color[1]}%, ${info.color[2]}%)`;
}

/**
 * Validate an archetype name and return the canonical version with index
 * Returns { name: canonical name, index: 0-based index } if valid, or null if not found
 */
export function validateArchetypeName(name: string): { name: string; index: number } | null {
  // Exact match
  const exactIndex = ARCHETYPE_NAMES.indexOf(name as any);
  if (exactIndex >= 0) {
    return { name, index: exactIndex };
  }
  
  // Trimmed match
  const trimmed = name.trim();
  const foundIndex = ARCHETYPE_NAMES.findIndex(n => n.trim() === trimmed);
  if (foundIndex >= 0) {
    return { name: ARCHETYPE_NAMES[foundIndex], index: foundIndex };
  }
  
  // Normalized match (on trimmed version to handle combined issues)
  const normalized = trimmed.normalize('NFC');
  const foundNormalizedIndex = ARCHETYPE_NAMES.findIndex(n => n.trim().normalize('NFC') === normalized);
  if (foundNormalizedIndex >= 0) {
    return { name: ARCHETYPE_NAMES[foundNormalizedIndex], index: foundNormalizedIndex };
  }
  
  return null;
}
