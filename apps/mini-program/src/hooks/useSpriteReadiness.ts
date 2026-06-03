import { useEffect, useRef, useState } from 'react'
import { logInfo, logWarn } from '../lib/utils/logger'

const FALLBACK_TIMEOUT_MS = 500

interface SpriteReadiness {
  /** True once the image has loaded or the safety timeout fired */
  isReady: boolean
  /** True only if the image loaded successfully before timeout */
  loaded: boolean
  /** True if the image failed to load */
  hasError: boolean
}

/**
 * Track whether a critical image asset is decoded and ready for display.
 *
 * Uses a hidden off-screen <img> element to probe the browser image cache.
 * If the image is already cached, onLoad fires almost immediately.
 * If not cached, we wait up to FALLBACK_TIMEOUT_MS then proceed anyway.
 *
 * FALLBACK: In WeChat Mini Program runtime, `new Image()` may not exist
 * (ReferenceError). When `typeof Image === 'undefined'`, we immediately
 * return `isReady: true` so the slot animation is never gated indefinitely.
 *
 * This prevents the slot-machine animation from starting while the
 * spritesheet is still decoding, without ever blocking the UI indefinitely.
 */
export function useSpriteReadiness(src: string): SpriteReadiness {
  const [isReady, setIsReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setIsReady(true)
      return
    }

    // WeChat Mini Program runtime (JavaScriptCore/V8) does not provide
    // the DOM `Image` constructor. Detect and bail early so the UI never
    // hangs waiting for a probe that can never complete.
    if (typeof Image === 'undefined') {
      logWarn('[useSpriteReadiness] Image constructor not available — proceeding anyway', { src })
      setHasError(true)
      setIsReady(true)
      return
    }

    try {
      const img = new Image()
      imgRef.current = img

      const handleLoad = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        logInfo('[useSpriteReadiness] Sprite ready', { src, elapsed: 'before-timeout' })
        setLoaded(true)
        setIsReady(true)
      }

      const handleError = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        logWarn('[useSpriteReadiness] Sprite failed to load', { src })
        setHasError(true)
        setIsReady(true)
      }

      img.addEventListener('load', handleLoad)
      img.addEventListener('error', handleError)

      // Start loading
      img.src = src

      // If already in browser cache, load event fires synchronously.
      // If not, we give it a short grace window before proceeding.
      timerRef.current = setTimeout(() => {
        logInfo('[useSpriteReadiness] Sprite timeout — proceeding anyway', {
          src,
          timeoutMs: FALLBACK_TIMEOUT_MS,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
        })
        setIsReady(true)
      }, FALLBACK_TIMEOUT_MS)

      return () => {
        img.removeEventListener('load', handleLoad)
        img.removeEventListener('error', handleError)
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        imgRef.current = null
      }
    } catch (probeError) {
      // Any unexpected error during probe setup (e.g., Image exists but
      // addEventListener doesn't) must not block the UI.
      logWarn('[useSpriteReadiness] Probe setup failed — proceeding anyway', {
        src,
        error: probeError instanceof Error ? probeError.message : String(probeError),
      })
      setHasError(true)
      setIsReady(true)
    }
  }, [src])

  return { isReady, loaded, hasError }
}
