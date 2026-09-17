import Taro from '@tarojs/taro'
import { logInfo, logWarn } from '../utils/logger'
import { getWeChatSubscribeTemplateIdsFromEnv } from './wechatSubscribeMessageIds'

/**
 * Resolves WeChat subscribe-message template IDs from build-time env
 * (`TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS`, comma-separated in repo `.env`).
 */
export function getWeChatSubscribeTemplateIds(): string[] {
  return getWeChatSubscribeTemplateIdsFromEnv()
}

/** Per-template grant verdicts from wx.requestSubscribeMessage. */
export interface SubscribeGrantResult {
  accepted: string[]
  rejected: string[]
  /** 'ban' = user muted the template in WeChat settings (unrecoverable in-app). */
  banned: string[]
}

/**
 * Requests subscription to pool / match–related service messages (WeChat only).
 * Must be invoked from a user gesture (e.g. button tap). No-op when no template IDs
 * are configured or when not running in the WeChat mini program.
 * Returns the per-template verdicts so callers can meter accept/reject/ban rates.
 */
export async function requestPoolMatchSubscribeMessage(): Promise<SubscribeGrantResult | null> {
  if (process.env.TARO_ENV !== 'weapp') {
    return null
  }

  const tmplIds = getWeChatSubscribeTemplateIds()

  if (tmplIds.length === 0) {
    logInfo('[Subscribe] Skipped — TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS not set')
    return null
  }

  if (typeof Taro.requestSubscribeMessage !== 'function') {
    logWarn('[Subscribe] requestSubscribeMessage not available on this runtime')
    return null
  }

  try {
    // WeChat uses `tmplIds`; Taro's Option is a union with Alipay `entityIds` — assert for weapp-only builds.
    const res = await Taro.requestSubscribeMessage({ tmplIds } as Parameters<typeof Taro.requestSubscribeMessage>[0])
    const raw = res as unknown as Record<string, string>
    const result: SubscribeGrantResult = { accepted: [], rejected: [], banned: [] }
    for (const id of tmplIds) {
      const verdict = raw[id]
      if (verdict === 'accept') result.accepted.push(id)
      else if (verdict === 'reject') result.rejected.push(id)
      else if (verdict === 'ban') result.banned.push(id)
    }
    logInfo('[Subscribe] requestSubscribeMessage completed', {
      count: tmplIds.length,
      accepted: result.accepted.length,
      rejected: result.rejected.length,
      banned: result.banned.length,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logWarn('[Subscribe] requestSubscribeMessage failed', { message })
    return null
  }
}
