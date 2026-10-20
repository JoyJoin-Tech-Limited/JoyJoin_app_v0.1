import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { fetchShareQrCodeImage } from '../../../lib/referral/shareQrCode'
import { haptics } from '../../../lib/utils/haptics'
import { logError, logInfo } from '../../../lib/utils/logger'
import { emitMomentCardAction } from '../momentCardTelemetry'
import {
  generateRecapSharePoster,
  type RecapSharePosterInput,
} from '../recapSharePoster'

/**
 * Recap share-poster action layer (2026-10-20, spec 规格一, mirrors
 * lib/onboarding/useInsightPosterShare.ts AC-03/AC-04 discipline):
 *
 *   tap 「存下这张高光卡」/「直接存卡」 → offline pre-check → generate →
 *   action sheet 保存到相册 / 分享给好友 / 预览 (showShareImageMenu capability
 *   degradation) → album save rides the getSetting→showModal→openSetting
 *   permission chain → success toast 「已保存到相册」. QR temp file is always
 *   unlinked in the generation finally (per-tap regeneration).
 *
 * Telemetry reuses the EXISTING moment-card-event whitelist (server zero
 * change): save success → {action:'save'}; share-menu invoked →
 * {action:'share'}; both fire-and-forget (a dropped event never blocks or
 * alters the UI). The 'generate' numerator stays with the moment-panel open
 * (emitMomentCardGenerateOnce) — poster generation itself is logInfo-only.
 */

export interface UseRecapSharePosterInput {
  /** Flag + entry visibility result — taps are ignored while disabled. */
  enabled: boolean
  socialSessionId: string
  tierName?: string
  dateLabel?: string
  ownMedalTitle?: string
  highlightQuote: string
  tablemateArchetypeAssets: string[]
  tablemateCount: number
  /** Page-resolved AIGC label flag (same value the in-app rows use). */
  aigcLabelsEnabled: boolean
  /** True when the resolved quote came from an AI-generated source. */
  quoteAigc: boolean
}

export interface UseRecapSharePosterResult {
  isGenerating: boolean
  handleShare: () => Promise<void>
}

type TaroWithShareImageMenu = typeof Taro & {
  showShareImageMenu?: (options: { path: string }) => Promise<unknown>
}

export function useRecapSharePoster(input: UseRecapSharePosterInput): UseRecapSharePosterResult {
  const {
    enabled,
    socialSessionId,
    tierName,
    dateLabel,
    ownMedalTitle,
    highlightQuote,
    tablemateArchetypeAssets,
    tablemateCount,
    aigcLabelsEnabled,
    quoteAigc,
  } = input

  const [isGenerating, setIsGenerating] = useState(false)
  const isGeneratingRef = useRef(false)
  // Leave-page race guard: generation may settle while the page is hidden
  // (page stack keeps it alive). Post-await UI steps are skipped when hidden.
  const pageHiddenRef = useRef(false)

  useDidHide(() => {
    pageHiddenRef.current = true
  })
  useDidShow(() => {
    pageHiddenRef.current = false
  })
  // Swipe-back safety: a hide mid-generation must not strand the busy state.
  useResetOnShow(setIsGenerating)

  const saveToAlbum = useCallback(
    async (filePath: string) => {
      try {
        const settingRes = await Taro.getSetting()
        const hasAuth = settingRes.authSetting['scope.writePhotosAlbum'] as boolean | undefined

        if (hasAuth === false) {
          const { confirm } = await Taro.showModal({
            title: '需要相册权限',
            content: '保存卡片到相册需要您授权访问相册。',
            confirmText: '去设置',
            cancelText: '取消',
          })
          if (confirm) {
            await Taro.openSetting()
          }
          return
        }

        await Taro.saveImageToPhotosAlbum({ filePath })
        haptics('success')
        // Fire-and-forget: telemetry failure never touches the success toast.
        emitMomentCardAction(socialSessionId, 'save')
        void Taro.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
      } catch (saveErr) {
        const message = saveErr instanceof Error ? saveErr.message : String(saveErr)
        logError('[RecapSharePoster] Save to album failed', { message })
        void Taro.showToast({
          title: '没能把卡片存进相册，可能需要你授权一下',
          icon: 'none',
          duration: 2500,
        })
      }
    },
    [socialSessionId],
  )

  const presentShareOptions = useCallback(
    async (filePath: string) => {
      const taroWithShareImageMenu = Taro as TaroWithShareImageMenu
      const hasNativeShareMenu = typeof taroWithShareImageMenu.showShareImageMenu === 'function'
      const itemList = ['保存到相册', ...(hasNativeShareMenu ? ['分享给好友'] : []), '预览']

      let tapIndex = -1
      try {
        const res = await Taro.showActionSheet({ itemList })
        tapIndex = res.tapIndex
      } catch {
        // User dismissed the sheet — not a failure, no telemetry.
        return
      }

      const saveIdx = 0
      const shareIdx = hasNativeShareMenu ? 1 : -1
      const previewIdx = itemList.length - 1

      if (tapIndex === saveIdx) {
        await saveToAlbum(filePath)
      } else if (tapIndex === shareIdx) {
        try {
          await taroWithShareImageMenu.showShareImageMenu!({ path: filePath })
          // Menu invoked successfully = shared; a dismissal rejects and is
          // intentionally NOT treated as failure (cancel ≠ failure ≠ retry).
          emitMomentCardAction(socialSessionId, 'share')
        } catch {
          // Menu dismissed.
        }
      } else if (tapIndex === previewIdx) {
        await Taro.previewImage({ current: filePath, urls: [filePath] })
      }
    },
    [saveToAlbum, socialSessionId],
  )

  const handleShare = useCallback(async () => {
    if (!enabled || !socialSessionId || isGeneratingRef.current) {
      return
    }
    // Guard first, synchronously — the offline pre-check below awaits, and a
    // double-tap inside that window must not start a second generation.
    isGeneratingRef.current = true
    haptics('light')

    let qrCodeImagePath: string | undefined
    try {
      // Offline pre-check — poster generation needs CDN images to resolve.
      try {
        const { networkType } = await Taro.getNetworkType()
        if (networkType === 'none') {
          void Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2500 })
          return
        }
      } catch {
        // getNetworkType may fail on some devices — proceed anyway.
      }

      setIsGenerating(true)

      qrCodeImagePath = await fetchShareQrCodeImage()
      const posterInput: RecapSharePosterInput = {
        tierName,
        dateLabel,
        ownMedalTitle,
        highlightQuote,
        tablemateArchetypeAssets,
        tablemateCount,
        qrCodeImagePath,
        hasAigcLabel: aigcLabelsEnabled && quoteAigc,
      }
      const filePath = await generateRecapSharePoster(posterInput)
      logInfo('[RecapSharePoster] created', { hasQr: Boolean(qrCodeImagePath) })
      if (pageHiddenRef.current) return

      await presentShareOptions(filePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('[RecapSharePoster] Generation failed', { message })
      if (!pageHiddenRef.current) {
        void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      }
    } finally {
      isGeneratingRef.current = false
      if (!pageHiddenRef.current) {
        setIsGenerating(false)
      }
      // QR temp file is baked into the bitmap by now — always unlink
      // (per-tap regeneration means this path runs on every tap; success and
      // failure share the same finally, mirroring the results-page precedent).
      if (qrCodeImagePath) {
        try {
          Taro.getFileSystemManager().unlinkSync(qrCodeImagePath)
        } catch {
          // Best-effort cleanup — a leftover temp file only wastes ~50KB.
        }
      }
    }
  }, [
    enabled,
    socialSessionId,
    tierName,
    dateLabel,
    ownMedalTitle,
    highlightQuote,
    tablemateArchetypeAssets,
    tablemateCount,
    aigcLabelsEnabled,
    quoteAigc,
    presentShareOptions,
  ])

  return { isGenerating, handleShare }
}
