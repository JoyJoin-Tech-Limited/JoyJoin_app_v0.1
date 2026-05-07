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

/**
 * Requests subscription to pool / match–related service messages (WeChat only).
 * Must be invoked from a user gesture (e.g. button tap). No-op when no template IDs
 * are configured or when not running in the WeChat mini program.
 */
export async function requestPoolMatchSubscribeMessage(): Promise<void> {
  if (process.env.TARO_ENV !== 'weapp') {
    return
  }

  const tmplIds = getWeChatSubscribeTemplateIds()

  if (tmplIds.length === 0) {
    logInfo('[Subscribe] Skipped — TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS not set')
    return
  }

  if (typeof Taro.requestSubscribeMessage !== 'function') {
    logWarn('[Subscribe] requestSubscribeMessage not available on this runtime')
    return
  }

  try {
    // WeChat uses `tmplIds`; Taro's Option is a union with Alipay `entityIds` — assert for weapp-only builds.
    await Taro.requestSubscribeMessage({ tmplIds } as Parameters<typeof Taro.requestSubscribeMessage>[0])
    logInfo('[Subscribe] requestSubscribeMessage completed', { count: tmplIds.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logWarn('[Subscribe] requestSubscribeMessage failed', { message })
  }
}
