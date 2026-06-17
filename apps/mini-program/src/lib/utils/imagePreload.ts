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
 *
 * @param concurrency  Optional cap on parallel getImageInfo calls. Useful for
 *                     heavy bundles (e.g. mascot spritesheets) to avoid
 *                     saturating the image decoder on low-end devices.
 */
export function preloadImages(srcs: string[], concurrency?: number): Promise<boolean[]> {
  if (!concurrency || concurrency <= 0 || srcs.length <= concurrency) {
    return Promise.all(srcs.map(preloadImage))
  }

  return new Promise((resolve) => {
    const results: boolean[] = new Array(srcs.length).fill(false)
    let index = 0
    let running = 0

    const next = () => {
      while (running < concurrency && index < srcs.length) {
        const currentIndex = index++
        running++
        preloadImage(srcs[currentIndex]).then((ok) => {
          results[currentIndex] = ok
          running--
          next()
        })
      }
      if (running === 0 && index >= srcs.length) {
        resolve(results)
      }
    }

    next()
  })
}

/**
 * Preload a list of images, logging summary diagnostics.
 * Use this for high-value asset bundles (e.g. archetype spritesheet + results).
 */
export async function preloadImagesWithDiagnostics(
  srcs: string[],
  context: string,
  concurrency?: number,
): Promise<void> {
  const results = await preloadImages(srcs, concurrency)
  const successCount = results.filter(Boolean).length
  logInfo(`[preloadImages] ${context}`, {
    total: srcs.length,
    success: successCount,
    failed: srcs.length - successCount,
  })
}
