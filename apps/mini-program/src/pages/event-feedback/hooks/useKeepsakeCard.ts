import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { trackFeedbackEvent } from '../../../lib/analytics/feedbackAnalytics'
import { fetchShareQrCodeImage } from '../../../lib/referral/shareQrCode'
import { haptics } from '../../../lib/utils/haptics'
import { logError } from '../../../lib/utils/logger'
import { generateKeepsakeCard, type KeepsakePerson } from '../keepsakeCard'

/**
 * 互选纪念卡 save flow — event-feedback premium uplift item 19 (2026-10-16).
 *
 * Mirrors useInsightPosterShare's discipline: offline pre-check, QR temp file
 * lifecycle (unlink in finally), getSetting → showModal → openSetting
 * permission chain, leave-page race guard, swipe-back-safe busy state.
 * Direct save-to-album on tap — NO action sheet and no share option: the
 * feature is a passive keepsake, not a conversion surface (WeChat bans
 * incentivized sharing).
 */

export interface UseKeepsakeCardInput {
  /** hasMatches — taps are ignored when the entry is not rendered. */
  enabled: boolean
  eventId: string
  viewer: KeepsakePerson
  matches: KeepsakePerson[]
  eventDayLabel?: string
}

export interface UseKeepsakeCardResult {
  isKeepsakeGenerating: boolean
  handleKeepsakeSave: () => Promise<void>
}

export function useKeepsakeCard({
  enabled,
  eventId,
  viewer,
  matches,
  eventDayLabel,
}: UseKeepsakeCardInput): UseKeepsakeCardResult {
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

  const handleKeepsakeSave = useCallback(async () => {
    if (!enabled || isGeneratingRef.current) return
    // Guard first, synchronously — a double-tap inside the offline pre-check
    // window must not start a second generation.
    isGeneratingRef.current = true
    haptics('light')

    let qrCodeImagePath: string | undefined
    try {
      // Offline pre-check — generation needs CDN images to resolve.
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
      const filePath = await generateKeepsakeCard({ viewer, matches, eventDayLabel, qrCodeImagePath })
      if (pageHiddenRef.current) return

      // Permission chain (insight-poster precedent): an explicitly-denied
      // scope routes to settings; first-time asks happen inside saveImage.
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
      haptics('light')
      trackFeedbackEvent('feedback_keepsake_save', { eventId, matchCount: matches.length })
      void Taro.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('[KeepsakeCard] Save flow failed', { message })
      if (!pageHiddenRef.current) {
        void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      }
    } finally {
      isGeneratingRef.current = false
      if (!pageHiddenRef.current) {
        setIsGenerating(false)
      }
      // QR temp file is baked into the bitmap by now — always unlink
      // (per-tap regeneration means this path runs on every tap).
      if (qrCodeImagePath) {
        try {
          Taro.getFileSystemManager().unlinkSync(qrCodeImagePath)
        } catch {
          // Best-effort cleanup — a leftover temp file only wastes ~50KB.
        }
      }
    }
  }, [enabled, eventId, viewer, matches, eventDayLabel])

  return { isKeepsakeGenerating: isGenerating, handleKeepsakeSave }
}
