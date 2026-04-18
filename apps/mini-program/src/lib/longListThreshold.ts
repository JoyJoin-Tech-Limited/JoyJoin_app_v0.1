/**
 * Heuristic row count above which long pool/event lists should be reviewed for
 * scroll performance (e.g. pagination, segmented fetch, or native recycle/list views).
 * Taro does not ship VirtualList in core; see `docs/LIST_VIRTUALIZATION.md`.
 */
export const MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD = 30

export function isLongListRowCount(count: number): boolean {
  return count > MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD
}
