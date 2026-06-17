import { useEffect, useRef } from 'react'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { logInfo } from '../lib/utils/logger'

/**
 * Lightweight time-to-first-interactive (TTI) instrumentation for mini-program pages.
 *
 * Measures the interval between page load (useLoad/useDidShow) and the moment the
 * page becomes ready for interaction. The measurement is additive: it never blocks
 * render, never throws, and reports are best-effort.
 *
 * Budgets:
 *  - Cold start (e.g. first open after app launch): <= 2000 ms
 *  - Warm/preloaded start (e.g. subpackage already downloaded): <= 800 ms
 *
 * Reporting channels:
 *  1. Realtime log manager via logInfo (primary).
 *  2. wx.reportAnalytics fallback when available (WeChat custom event).
 */

export const PAGE_TTI_COLD_BUDGET_MS = 2000
export const PAGE_TTI_WARM_BUDGET_MS = 800

/** Heuristic cold-start window: page loads within this many ms of app launch are treated as cold. */
const COLD_START_WINDOW_MS = 3000

let cachedAppLaunchTimestamp: number | null = null

function getAppLaunchTimestamp(): number {
  if (cachedAppLaunchTimestamp !== null) {
    return cachedAppLaunchTimestamp
  }

  let timestamp = Date.now()
  try {
    const baseInfo = Taro.getAppBaseInfo?.() as { startTime?: number } | undefined
    if (baseInfo && typeof baseInfo.startTime === 'number') {
      timestamp = baseInfo.startTime
    }
  } catch {
    // Ignore: getAppBaseInfo may not be available in all runtimes (e.g. H5).
  }

  cachedAppLaunchTimestamp = timestamp
  return timestamp
}

/** Resets internal state. Exported for tests only. */
export function __resetPageTTITestState(): void {
  cachedAppLaunchTimestamp = null
}

/** Overrides the cached app launch timestamp. Exported for tests only. */
export function __setAppLaunchTimestampForTests(timestamp: number): void {
  cachedAppLaunchTimestamp = timestamp
}

export interface UsePageTTIOptions {
  /** Page identifier used in logs/analytics (e.g. 'edit-profile'). */
  pageName: string
  /**
   * Optional readiness flag. When provided, TTI is measured until `ready` becomes true.
   * When omitted, TTI is reported on the first effect flush after mount.
   */
  ready?: boolean
  /** Disable instrumentation for this page instance. */
  disabled?: boolean
}

function reportTTI(pageName: string, ttiMs: number, startTime: number): void {
  const isCold = startTime - getAppLaunchTimestamp() < COLD_START_WINDOW_MS
  const budgetMs = isCold ? PAGE_TTI_COLD_BUDGET_MS : PAGE_TTI_WARM_BUDGET_MS
  const withinBudget = ttiMs <= budgetMs

  logInfo('[PageTTI] page interactive', {
    page: pageName,
    ttiMs,
    isCold,
    withinBudget,
    budgetMs,
    startTime,
  })

  if (typeof wx !== 'undefined' && typeof wx.reportAnalytics === 'function') {
    wx.reportAnalytics('page_tti', {
      page: pageName,
      ttiMs: String(ttiMs),
      isCold: String(isCold),
      withinBudget: String(withinBudget),
      budgetMs: String(budgetMs),
    })
  }
}

export function usePageTTI({ pageName, ready, disabled }: UsePageTTIOptions): void {
  const startTimeRef = useRef<number>(0)
  const reportedRef = useRef(false)

  useLoad(() => {
    if (disabled) return
    startTimeRef.current = Date.now()
  })

  useDidShow(() => {
    if (disabled) return
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now()
    }
  })

  useEffect(() => {
    if (disabled) return
    if (reportedRef.current) return
    if (startTimeRef.current === 0) return

    // When `ready` is provided, wait for the first truthy transition.
    if (ready !== undefined && !ready) return

    reportedRef.current = true

    // Defer reporting by one tick so the current render flush is not blocked.
    const timer = setTimeout(() => {
      const ttiMs = Date.now() - startTimeRef.current
      if (ttiMs >= 0) {
        reportTTI(pageName, ttiMs, startTimeRef.current)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [disabled, pageName, ready])
}
