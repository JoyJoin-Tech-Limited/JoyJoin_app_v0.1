/**
 * Conservative review threshold for long pool/event lists.
 * 
 * Tiered guidance (see docs/LIST_VIRTUALIZATION.md):
 * - Primary tier (8GB+ RAM, 120Hz): lists up to 50–60 rows often run fine;
 *   this threshold is a sanity-check trigger, not a mandatory virtualize gate.
 * - Degradation tier (4–6GB RAM, 60Hz): this is the point where jank becomes
 *   likely; enable VirtualList fallback or pagination.
 * - Universal: lists >100 rows should always use VirtualList or pagination.
 * 
 * Taro does not ship VirtualList in core; see `docs/LIST_VIRTUALIZATION.md`.
 */
export const MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD = 30

export function isLongListRowCount(count: number): boolean {
  return count > MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD
}

/**
 * Extended threshold for Primary-tier devices (8GB+ RAM, 120Hz).
 * Use this when you have confirmed the device is in the Primary tier
 * via getSystemInfo/benchmarkLevel and want to allow larger non-virtualized lists.
 */
export const MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD_PRIMARY = 60
