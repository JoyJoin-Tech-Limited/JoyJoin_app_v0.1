import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import type { ProfileTaglineEvidence, ProfileTaglineLine } from '@shared/ai/onboarding'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { fetchShareQrCodeImage } from '../referral/shareQrCode'
import { haptics } from '../utils/haptics'
import { logError } from '../utils/logger'
import { generateInsightPoster } from './insightPoster'

/**
 * Onboarding-local insight-poster share action layer
 * (sprint insight-share-poster, AC-03/AC-04).
 *
 * Deliberately reimplemented here instead of extracting the results-page
 * share layer: `sharePoster.ts` / `useResultShareActions.ts` /
 * `momentsPosterFactory.ts` carry active user WIP and must not be touched.
 * The permission chain, offline pre-check, action-sheet order and QR temp
 * file lifecycle mirror the results implementation by pattern.
 */

export interface InsightPosterAnalytics {
  interaction: (action: string, metadata?: Record<string, unknown>) => void
  errorOccurred: (errorType: string, errorMessage: string, metadata?: Record<string, unknown>) => void
}

export interface UseInsightPosterShareInput {
  /** AC-01 visibility matrix result — taps are ignored while hidden. */
  enabled: boolean
  analytics: InsightPosterAnalytics
  /** Resolved page display name (incl. the '悦聚用户' fallback). */
  displayName: string
  archetypeName?: string
  archetypeAsset?: string
  accentText?: string
  lines: ProfileTaglineLine[]
  evidence: ProfileTaglineEvidence[]
  /** The page-resolved AIGC label flag (same value the in-app footer uses). */
  aigcLabelsEnabled: boolean
}

export interface UseInsightPosterShareResult {
  isGenerating: boolean
  handleShare: () => Promise<void>
}

type TaroWithShareImageMenu = typeof Taro & {
  showShareImageMenu?: (options: { path: string }) => Promise<unknown>
}

export function useInsightPosterShare(input: UseInsightPosterShareInput): UseInsightPosterShareResult {
  const {
    enabled,
    analytics,
    displayName,
    archetypeName,
    archetypeAsset,
    accentText,
    lines,
    evidence,
    aigcLabelsEnabled,
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
    async (filePath: string, meta: Record<string, unknown>) => {
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
        analytics.interaction('insight_poster_shared', { ...meta, option: 'album' })
        void Taro.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
      } catch (saveErr) {
        const message = saveErr instanceof Error ? saveErr.message : String(saveErr)
        logError('[InsightPoster] Save to album failed', { message })
        void Taro.showToast({
          title: '没能把卡片存进相册，可能需要你授权一下',
          icon: 'none',
          duration: 2500,
        })
      }
    },
    [analytics],
  )

  const presentShareOptions = useCallback(
    async (filePath: string, meta: Record<string, unknown>) => {
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
        await saveToAlbum(filePath, meta)
      } else if (tapIndex === shareIdx) {
        try {
          await taroWithShareImageMenu.showShareImageMenu!({ path: filePath })
          // AC-04: menu invoked successfully = shared (option 'menu'); a
          // dismissal rejects and is intentionally NOT treated as failure.
          analytics.interaction('insight_poster_shared', { ...meta, option: 'menu' })
        } catch {
          // Menu dismissed — cancel ≠ failure ≠ retry.
        }
      } else if (tapIndex === previewIdx) {
        await Taro.previewImage({ current: filePath, urls: [filePath] })
      }
    },
    [analytics, saveToAlbum],
  )

  const handleShare = useCallback(async () => {
    if (!enabled || isGeneratingRef.current) {
      return
    }
    // Guard first, synchronously — the offline pre-check below awaits, and a
    // double-tap inside that window must not start a second generation.
    isGeneratingRef.current = true
    haptics('light')

    const hasAigcLabel = aigcLabelsEnabled && lines.some((line) => line.aigc)
    // AC-04 anonymous payload — no identity fields ride these events.
    const baseMeta: Record<string, unknown> = {
      shape: 'v2',
      lineCount: lines.length,
      hasReveal: lines.some((line) => line.role === 'reveal'),
      aigcLabel: hasAigcLabel,
    }

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
      const filePath = await generateInsightPoster({
        displayName,
        archetypeName,
        archetypeAsset,
        accentText,
        lines,
        evidence,
        qrCodeImagePath,
        hasAigcLabel,
      })
      analytics.interaction('insight_poster_created', {
        ...baseMeta,
        hasQr: Boolean(qrCodeImagePath),
      })
      if (pageHiddenRef.current) return

      await presentShareOptions(filePath, { ...baseMeta, hasQr: Boolean(qrCodeImagePath) })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('[InsightPoster] Generation failed', { message })
      analytics.errorOccurred('insight_poster_failed', message)
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
    analytics,
    displayName,
    archetypeName,
    archetypeAsset,
    accentText,
    lines,
    evidence,
    aigcLabelsEnabled,
    presentShareOptions,
  ])

  return { isGenerating, handleShare }
}
