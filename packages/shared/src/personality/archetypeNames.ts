/**
 * Canonical 12-Archetype Ordering - Single Source of Truth
 * 原型标准顺序 - 唯一数据源
 *
 * This module defines the canonical ordering of the 12 archetypes used across
 * the entire application. Both server and client MUST import from this module
 * to prevent ordering drift.
 *
 * v2.0 — ID-decoupled architecture:
 * - Keys are stable machine IDs (never change)
 * - Display names (nameCn) can iterate independently
 * - Asset keys map to Lovart illustration pipeline
 *
 * Used for:
 * - Backend archetype configuration
 * - Slot machine ordering in user-client
 * - TYPE numbering in share cards (e.g., #01/12)
 * - Any feature requiring consistent archetype enumeration
 */

export interface ArchetypeDefinition {
  /** Stable machine ID — never changes, used for all internal lookups */
  id: string
  /** Human-facing display name (Chinese) — can iterate independently */
  nameCn: string
  /** Lovart asset pipeline key */
  assetKey: string
  /** 1-based canonical order (1-12) */
  order: number
}

/**
 * Canonical archetype definitions (12 archetypes)
 * DO NOT modify the order or IDs without careful consideration of all dependent systems
 */
export const ARCHETYPE_DEFINITIONS: ArchetypeDefinition[] = [
  { id: 'corgi', nameCn: '气氛组柯基', assetKey: 'corgi', order: 1 },      // #01  High X+P, energy 95
  { id: 'rooster', nameCn: '情绪稳定鸡', assetKey: 'rooster', order: 2 },     // #02  High E+P+C, energy 90
  { id: 'hamster_praise', nameCn: '捧场王仓鼠', assetKey: 'hamster_praise', order: 3 }, // #03  High A+P, was dolphin_praise
  { id: 'fox', nameCn: '探宝雷达狐', assetKey: 'fox', order: 4 },         // #04  High O+X, low A, energy 82
  { id: 'dolphin_calm', nameCn: '读空气海豚', assetKey: 'dolphin_calm', order: 5 },   // #05  Balanced E+A, energy 75
  { id: 'spider', nameCn: '社交裁缝蛛', assetKey: 'spider', order: 6 },      // #06  High C+A, energy 72
  { id: 'koala', nameCn: '情绪树洞考拉', assetKey: 'koala', order: 7 },      // #07  High A+E, low X, was bear
  { id: 'octopus', nameCn: '脑洞喷泉章鱼', assetKey: 'octopus', order: 8 },    // #08  High O, low C, energy 68
  { id: 'owl', nameCn: '追问猫头鹰', assetKey: 'owl', order: 9 },       // #09  High O+C, low X+P, energy 55
  { id: 'elephant', nameCn: '定海神针大象', assetKey: 'elephant', order: 10 },  // #10  High C+E, low X+O, energy 52
  { id: 'turtle', nameCn: '慢半拍龟', assetKey: 'turtle', order: 11 },      // #11  High C+E, very low X, energy 38
  { id: 'cat', nameCn: '静音模式猫', assetKey: 'cat', order: 12 },        // #12  Low X+A+P, energy 30
]

/**
 * Canonical ordering as ID array (for consumers that only need IDs)
 */
export const ARCHETYPE_CANONICAL_ORDER = ARCHETYPE_DEFINITIONS.map((a) => a.id)

/**
 * Total count of archetypes
 */
export const ARCHETYPE_COUNT = 12

/**
 * Type for archetype IDs (derived from canonical definitions)
 */
export type ArchetypeId = (typeof ARCHETYPE_DEFINITIONS)[number]['id']

/**
 * @deprecated Use ArchetypeId instead. Retained for migration compatibility.
 */
export type ArchetypeName = ArchetypeId

/**
 * Lookup map: ID → definition
 */
export const ARCHETYPE_BY_ID: Record<string, ArchetypeDefinition> = Object.fromEntries(
  ARCHETYPE_DEFINITIONS.map((def) => [def.id, def]),
)

/**
 * Lookup map: display name → definition
 * Useful for migration, LLM prompt resolution, and external data ingestion
 */
export const ARCHETYPE_BY_NAME_CN: Record<string, ArchetypeDefinition> = Object.fromEntries(
  ARCHETYPE_DEFINITIONS.map((def) => [def.nameCn, def]),
)

/**
 * Legacy name → ID migration map
 * Used for one-time data migration and external API compatibility
 */
export const ARCHETYPE_LEGACY_NAME_MAP: Record<string, string> = {
  开心柯基: 'corgi',
  太阳鸡: 'rooster',
  夸夸豚: 'hamster_praise',
  机智狐: 'fox',
  淡定海豚: 'dolphin_calm',
  织网蛛: 'spider',
  暖心熊: 'koala',
  灵感章鱼: 'octopus',
  沉思猫头鹰: 'owl',
  定心大象: 'elephant',
  稳如龟: 'turtle',
  隐身猫: 'cat',
}

/**
 * Get the 1-based index of an archetype in the canonical order
 * @param id - The archetype ID
 * @returns 1-based index (1-12), or null if not found
 * @example
 * getArchetypeIndex("corgi") // returns 1
 * getArchetypeIndex("cat") // returns 12
 */
export function getArchetypeIndex(id: string): number | null {
  const index = ARCHETYPE_DEFINITIONS.findIndex((def) => def.id === id)
  return index >= 0 ? index + 1 : null
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
  return `${String(index).padStart(2, '0')}/${ARCHETYPE_COUNT}`
}

/**
 * Get formatted TYPE number directly from archetype ID
 * @param id - The archetype ID
 * @returns Formatted TYPE string like "01/12", or "00/12" if not found
 * @example
 * getArchetypeTypeNo("corgi") // returns "01/12"
 * getArchetypeTypeNo("fox") // returns "04/12"
 * getArchetypeTypeNo("不存在") // returns "00/12"
 */
export function getArchetypeTypeNo(id: string): string {
  const index = getArchetypeIndex(id)
  return index !== null ? formatTypeNo(index) : formatTypeNo(0)
}

/**
 * Resolve an archetype identifier (ID, display name, or legacy name) to a canonical definition
 * @param identifier - ID, nameCn, or legacy Chinese name
 * @returns ArchetypeDefinition or null
 */
export function resolveArchetype(identifier: string): ArchetypeDefinition | null {
  // Try ID first
  const byId = ARCHETYPE_BY_ID[identifier]
  if (byId) return byId

  // Try current display name
  const byName = ARCHETYPE_BY_NAME_CN[identifier]
  if (byName) return byName

  // Try legacy name
  const legacyId = ARCHETYPE_LEGACY_NAME_MAP[identifier]
  if (legacyId) return ARCHETYPE_BY_ID[legacyId] ?? null

  return null
}
