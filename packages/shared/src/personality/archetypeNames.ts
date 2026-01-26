/**
 * Canonical 12-Archetype Ordering - Single Source of Truth
 * 原型标准顺序 - 唯一数据源
 * 
 * This module defines the canonical ordering of the 12 archetypes used across
 * the entire application. Both server and client MUST import from this module
 * to prevent ordering drift.
 * 
 * Used for:
 * - Backend archetype configuration
 * - Slot machine ordering in user-client
 * - TYPE numbering in share cards (e.g., #01/12)
 * - Any feature requiring consistent archetype enumeration
 */

/**
 * Canonical archetype ordering (12 archetypes)
 * DO NOT modify this order without careful consideration of all dependent systems
 */
export const ARCHETYPE_CANONICAL_ORDER = [
  "开心柯基",      // #01
  "太阳鸡",        // #02
  "夸夸豚",        // #03
  "机智狐",        // #04
  "淡定海豚",      // #05
  "织网蛛",        // #06
  "暖心熊",        // #07
  "灵感章鱼",      // #08
  "沉思猫头鹰",    // #09
  "定心大象",      // #10
  "稳如龟",        // #11
  "隐身猫",        // #12
] as const;

/**
 * Total count of archetypes
 */
export const ARCHETYPE_COUNT = 12;

/**
 * Type for archetype names (derived from canonical order)
 */
export type ArchetypeName = typeof ARCHETYPE_CANONICAL_ORDER[number];

/**
 * Get the 1-based index of an archetype in the canonical order
 * @param archetype - The archetype name (Chinese)
 * @returns 1-based index (1-12), or null if not found
 * @example
 * getArchetypeIndex("开心柯基") // returns 1
 * getArchetypeIndex("隐身猫") // returns 12
 */
export function getArchetypeIndex(archetype: string): number | null {
  const index = ARCHETYPE_CANONICAL_ORDER.indexOf(archetype as ArchetypeName);
  return index >= 0 ? index + 1 : null;
}

/**
 * Format archetype TYPE number for display (e.g., "04/12")
 * @param index - 1-based index (1-12)
 * @returns Formatted string like "01/12", "04/12", etc.
 * @example
 * formatTypeNo(1) // returns "01/12"
 * formatTypeNo(4) // returns "04/12"
 */
export function formatTypeNo(index: number): string {
  return `${String(index).padStart(2, '0')}/${ARCHETYPE_COUNT}`;
}

/**
 * Get formatted TYPE number directly from archetype name
 * @param archetype - The archetype name (Chinese)
 * @returns Formatted TYPE string like "01/12", or "00/12" if not found
 * @example
 * getArchetypeTypeNo("开心柯基") // returns "01/12"
 * getArchetypeTypeNo("机智狐") // returns "04/12"
 * getArchetypeTypeNo("不存在") // returns "00/12"
 */
export function getArchetypeTypeNo(archetype: string): string {
  const index = getArchetypeIndex(archetype);
  return index !== null ? formatTypeNo(index) : formatTypeNo(0);
}
