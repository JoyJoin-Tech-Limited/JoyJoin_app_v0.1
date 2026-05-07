/**
 * WP4 — Show subtle "fresh vs cached" metadata for `GET /api/pool-groups/:id/analysis`
 * only in local dev or when the build sets `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1`
 * (e.g. beta / preview builds). Never on by default for production WeChat releases.
 */
export function shouldShowGroupAnalysisDebugMeta(): boolean {
  try {
    if (process.env.NODE_ENV === 'development') {
      return true
    }
  } catch {
    // ignore
  }
  return process.env.TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG === '1'
}
