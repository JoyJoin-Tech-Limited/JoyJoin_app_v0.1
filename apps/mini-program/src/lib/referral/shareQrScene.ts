/**
 * Share-QR scene parsing (2026-10-14).
 *
 * The personality share poster carries a wxacode.getUnlimited mini-program
 * code whose `scene` is `ic=<referralCode>` (built server-side by
 * apps/server/src/lib/wechatShareQrCode.ts). WeChat delivers the scene as a
 * URL-encoded `scene` query param when a friend long-presses the poster and
 * opens the code. This module decodes it back into a referral code for
 * persistPendingReferralCode — the rest of the attribution pipeline
 * (login handoff → session.pendingReferralCode) is unchanged.
 *
 * Fail-closed on shape: anything that is not exactly `ic=<whitelisted code>`
 * yields '' and is ignored.
 */
export const SHARE_QR_SCENE_PREFIX = 'ic='

const SCENE_CODE_PATTERN = /^[a-z0-9]+$/i

export function parseShareQrSceneCode(scene: string | null | undefined): string {
  if (!scene || typeof scene !== 'string') return ''
  let decoded = scene
  try {
    decoded = decodeURIComponent(scene)
  } catch {
    // Malformed encoding — fall through with the raw value.
  }
  if (!decoded.startsWith(SHARE_QR_SCENE_PREFIX)) return ''
  const code = decoded.slice(SHARE_QR_SCENE_PREFIX.length).trim()
  if (!code || !SCENE_CODE_PATTERN.test(code)) return ''
  return decoded.length > 32 ? '' : code
}
