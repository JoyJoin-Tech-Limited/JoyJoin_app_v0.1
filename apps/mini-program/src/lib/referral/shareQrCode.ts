import Taro from '@tarojs/taro'
import { apiRequestBinary } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * Fetch the referral-attributed mini-program code for the share poster
 * (2026-10-14). Server route: POST /api/personality/share-qrcode.
 *
 * Fail-open contract: guests (401), flag off (503), WeChat failures, and
 * transport errors all resolve to undefined — the poster then renders the
 * copy-only CTA band. Never throws, never blocks poster generation.
 */
export async function fetchShareQrCodeImage(): Promise<string | undefined> {
  try {
    const bytes = await apiRequestBinary({
      path: '/api/personality/share-qrcode',
      data: {},
      timeout: 8000,
    })
    if (!bytes || bytes.byteLength === 0) return undefined

    const filePath = `${Taro.env.USER_DATA_PATH}/joyjoin-share-qr-${Date.now()}.png`
    const fs = Taro.getFileSystemManager()
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: bytes,
        success: () => resolve(),
        fail: (err) => reject(new Error(err.errMsg ?? 'writeFile failed')),
      })
    })

    // Validate the image decodes before handing it to canvas — a corrupt or
    // error-body PNG must degrade to the copy-only band, not a blank chip.
    const info = await Taro.getImageInfo({ src: filePath }).catch(() => null)
    if (!info?.width) {
      try { fs.unlinkSync(filePath) } catch { /* best-effort */ }
      return undefined
    }
    return filePath
  } catch (error) {
    logWarn('[shareQrCode] fetch failed; poster falls back to copy-only CTA', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
