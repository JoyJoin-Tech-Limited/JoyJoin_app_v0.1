import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { profileAnalytics } from '../analytics/profileAnalytics'
import { fetchShareQrCodeImage } from '../referral/shareQrCode'
import { haptics } from '../utils/haptics'
import { logError } from '../utils/logger'
import {
  generateProfileCardPoster,
  type ProfileCardPosterInput,
} from '../profile/profileCardPoster'

/**
 * Profile card share action layer (P2-3, 2026-10-22 — PM memo §8).
 * Mirrors the insight-poster pipeline: offline pre-check, QR fail-open,
 * action sheet (保存到相册 / 分享给好友 / 预览), QR temp-file unlink in
 * finally, swipe-back-safe generating state. Analytics events are the
 * re-activated profile_share_card_generated / profile_share_card_error
 * (they were orphaned only because the old pipeline was dead).
 */

export interface UseProfileCardShareInput {
  /** Entry hidden/disabled → taps are ignored. */
  enabled: boolean
  card: Omit<ProfileCardPosterInput, 'qrCodeImagePath'>
}

export interface UseProfileCardShareResult {
  isGenerating: boolean
  handleShare: () => Promise<void>
}

type TaroWithShareImageMenu = typeof Taro & {
  showShareImageMenu?: (options: { path: string }) => Promise<unknown>
}

export function useProfileCardShare(input: UseProfileCardShareInput): UseProfileCardShareResult {
  const { enabled, card } = input
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

  const saveToAlbum = useCallback(async (filePath: string) => {
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
      void Taro.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
    } catch (saveErr) {
      const message = saveErr instanceof Error ? saveErr.message : String(saveErr)
      logError('[ProfileCardPoster] Save to album failed', { message })
      void Taro.showToast({
        title: '没能把卡片存进相册，可能需要你授权一下',
        icon: 'none',
        duration: 2500,
      })
    }
  }, [])

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
        } catch {
          // Menu dismissed — cancel ≠ failure ≠ retry.
        }
      } else if (tapIndex === previewIdx) {
        await Taro.previewImage({ current: filePath, urls: [filePath] })
      }
    },
    [saveToAlbum],
  )

  const handleShare = useCallback(async () => {
    if (!enabled || isGeneratingRef.current) {
      return
    }
    // Guard first, synchronously — a double-tap inside the offline pre-check
    // window must not start a second generation.
    isGeneratingRef.current = true
    haptics('light')

    let qrCodeImagePath: string | undefined
    try {
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
      const filePath = await generateProfileCardPoster({
        ...card,
        qrCodeImagePath,
      })
      profileAnalytics.track('profile_share_card_generated', {
        hasQr: Boolean(qrCodeImagePath),
      })
      if (pageHiddenRef.current) return

      await presentShareOptions(filePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('[ProfileCardPoster] Generation failed', { message })
      profileAnalytics.track('profile_share_card_error', { message: message.slice(0, 120) })
      if (!pageHiddenRef.current) {
        void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      }
    } finally {
      isGeneratingRef.current = false
      if (!pageHiddenRef.current) {
        setIsGenerating(false)
      }
      // QR temp file is baked into the bitmap by now — always unlink.
      if (qrCodeImagePath) {
        try {
          Taro.getFileSystemManager().unlinkSync(qrCodeImagePath)
        } catch {
          // Best-effort cleanup — a leftover temp file only wastes ~50KB.
        }
      }
    }
  }, [enabled, card, presentShareOptions])

  return { isGenerating, handleShare }
}
