import { getClusterIdByDistrictName } from '@shared/districts'

/**
 * 发现页「偏好区域」抽屉的计数工具（2026-09-30 精细化批次）。
 * Feed 过滤与抽屉计数必须共用同一个 cluster 映射——
 * 这里与 pages/discover/index.tsx 的 displayPools 一样走
 * getClusterIdByDistrictName，保证计数与筛选永远不会分歧。
 */

export const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface DiscoverCountsInput {
  district?: string | null
  dateTime?: string | Date | null
}

export interface DiscoverCounts {
  /** 本周（now..now+7d）每个 cluster 的可报名场次数 */
  weekCountsByCluster: Record<string, number>
  /** 本周总数 */
  weekTotal: number
  /** 每个 cluster 本周内最近一场的 dateTime（ISO），用于「周六 1 场」变体 */
  nextEventByCluster: Record<string, string>
}

export function buildDiscoverCounts(
  pools: DiscoverCountsInput[],
  now: Date = new Date(),
): DiscoverCounts {
  const windowEnd = now.getTime() + WEEK_WINDOW_MS
  const weekCountsByCluster: Record<string, number> = {}
  const nextEventByCluster: Record<string, string> = {}
  let weekTotal = 0

  for (const pool of pools) {
    const dateMs = pool.dateTime ? new Date(pool.dateTime).getTime() : NaN
    if (Number.isNaN(dateMs) || dateMs > windowEnd) continue
    const clusterId = pool.district ? getClusterIdByDistrictName(pool.district) : undefined
    if (!clusterId) continue

    weekCountsByCluster[clusterId] = (weekCountsByCluster[clusterId] ?? 0) + 1
    weekTotal += 1

    const prev = nextEventByCluster[clusterId]
    if (!prev || dateMs < new Date(prev).getTime()) {
      nextEventByCluster[clusterId] = new Date(dateMs).toISOString()
    }
  }

  return { weekCountsByCluster, weekTotal, nextEventByCluster }
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 下一场标签：今天 / 明天 / 周X（超过本周窗口时退回周X，缺失退回「近期」）。 */
export function formatNextEventLabel(iso: string | Date | undefined, now: Date = new Date()): string {
  if (!iso) return '近期'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '近期'

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOf(date) - startOf(now)) / (24 * 60 * 60 * 1000))
  if (dayDiff <= 0) return '今天'
  if (dayDiff === 1) return '明天'
  return WEEKDAY_CN[date.getDay()]
}
