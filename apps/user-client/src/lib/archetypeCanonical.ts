/**
 * Canonical archetype ordering - single source of truth
 * This order matches the backend ARCHETYPE_NAMES from apps/server/src/archetypeConfig.ts
 * and is used consistently across the app (slot machine, share cards, etc.)
 */

/**
 * Canonical order of 12 archetypes (1-12)
 * This is the definitive ordering used throughout the application
 */
export const ARCHETYPE_CANONICAL_ORDER = [
  "开心柯基",      // 1
  "太阳鸡",        // 2
  "夸夸豚",        // 3
  "机智狐",        // 4
  "淡定海豚",      // 5
  "织网蛛",        // 6
  "暖心熊",        // 7
  "灵感章鱼",      // 8
  "沉思猫头鹰",    // 9
  "定心大象",      // 10
  "稳如龟",        // 11
  "隐身猫",        // 12
] as const;

/**
 * Get the canonical index (1-12) of an archetype
 * @param archetype - The archetype name
 * @returns The 1-based index (1-12), or null if not found
 */
export function getArchetypeIndex(archetype: string): number | null {
  const index = ARCHETYPE_CANONICAL_ORDER.indexOf(archetype as any);
  return index === -1 ? null : index + 1; // Convert to 1-based
}

/**
 * Format archetype index as "XX/12" for display
 * @param index - The 1-based archetype index (1-12)
 * @returns Formatted string like "04/12"
 */
export function formatTypeNo(index: number): string {
  const paddedIndex = String(index).padStart(2, '0');
  return `${paddedIndex}/12`;
}
