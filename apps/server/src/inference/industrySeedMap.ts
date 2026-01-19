/**
 * Seed库 - 精确匹配映射表
 * 响应时间目标: <10ms
 * 
 * This now uses auto-generated seed map from occupations with manual overrides
 */

import { GENERATED_SEED_MAP, generateMergedSeedMap } from './generateSeedMap';

export interface SeedMatch {
  category: string;
  segment: string;
  niche?: string;
  confidence: number;
}

// Manual overrides for special cases or legacy compatibility
const MANUAL_OVERRIDES = new Map<string, SeedMatch>([
  // Add manual overrides here if needed for special cases
  // These will override the auto-generated mappings
]);

// Use merged seed map (auto-generated + manual overrides)
export const INDUSTRY_SEED_MAP = generateMergedSeedMap(MANUAL_OVERRIDES);

export function matchSeed(input: string): SeedMatch | null {
  const normalized = input.trim();
  return INDUSTRY_SEED_MAP.get(normalized) || null;
}
