import Taro from '@tarojs/taro'
import { logInfo, logWarn } from './logger'

/**
 * Preload a single image into the WeChat image cache using getImageInfo.
 *
 * This is the most reliable mini-program priming method — it downloads and
 * decodes the image before it is needed by <Image> or CSS background-image.
 *
 * @returns Promise<boolean>  true if cached successfully
 */
export function preloadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(false)
      return
    }
    // Taro may still return a rejecting promise even when fail/success
    // callbacks are provided. Catch it so the rejection never surfaces
    // as an unhandled promise rejection in vConsole.
    Taro.getImageInfo({
      src,
      success: () => resolve(true),
      fail: (err) => {
        logWarn('[preloadImage] Failed to preload', { src, err: err.errMsg })
        resolve(false)
      },
    }).catch(() => resolve(false))
  })
}

/**
 * Fire-and-forget batch preload. Failures are silent — we still get cache
 * hits for anything that succeeded.
 */
export function preloadImages(srcs: string[]): Promise<boolean[]> {
  return Promise.all(srcs.map(preloadImage))
}

/**
 * Preload a list of images, logging summary diagnostics.
 * Use this for high-value asset bundles (e.g. archetype spritesheet + results).
 */
export async function preloadImagesWithDiagnostics(
  srcs: string[],
  context: string,
): Promise<void> {
  const results = await preloadImages(srcs)
  const successCount = results.filter(Boolean).length
  logInfo(`[preloadImages] ${context}`, {
    total: srcs.length,
    success: successCount,
    failed: srcs.length - successCount,
  })
}
