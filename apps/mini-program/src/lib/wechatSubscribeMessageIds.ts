/**
 * Pure helpers for WeChat subscribe template ID env parsing (no Taro / logger imports).
 */

export function parseTemplateIds(raw: string | undefined): string[] {
  if (!raw || typeof raw !== 'string') {
    return []
  }

  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

/**
 * Resolves template IDs from build-time env (`TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS`).
 */
export function getWeChatSubscribeTemplateIdsFromEnv(): string[] {
  return parseTemplateIds(process.env.TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS)
}
