import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { haptics } from '../../lib/utils/haptics'
import { logError } from '../../lib/utils/logger'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import {
  generateProfileSharePoster,
  type ProfilePosterInput,
} from './profilePoster'

export interface UseProfileShareCardOptions {
  displayName: string
  archetype: string | null | undefined
  archetypeName: string | null
  archetypeFamilyName: string | null
  userCity?: string | null
  userAge?: number | null
  topInterests?: unknown[]
  referralCode?: string | null
  /**
   * Degradation-tier devices render the poster at DPR 1 to save memory
   * and reduce export time without a visible quality loss on small screens.
   */
  isDegradation?: boolean
}

export function useProfileShareCard(options: UseProfileShareCardOptions) {
  const [isGenerating, setIsGenerating] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // If the user leaves the page while the loading toast is still visible,
      // make sure it doesn't leak onto the next screen.
      if (isGenerating) {
        try {
          Taro.hideLoading()
        } catch {
          // ignore
        }
      }
    }
  }, [isGenerating])

  const generate = useCallback(async () => {
    const {
      displayName,
      archetype,
      archetypeName,
      archetypeFamilyName,
      userCity,
      userAge,
      topInterests,
      referralCode,
      isDegradation,
    } = options

    if (isGenerating || !archetype) return

    haptics('light')
    profileAnalytics.track('profile_menu_tap', { menu: 'share-card' })

    try {
      const { networkType } = await Taro.getNetworkType()
      if (networkType === 'none') {
        void Taro.showToast({
          title: '网络好像断了，请检查连接后再试',
          icon: 'none',
          duration: 2500,
        })
        return
      }
    } catch {
      // getNetworkType may fail on some devices — proceed anyway
    }

    setIsGenerating(true)
    void Taro.showLoading({ title: '正在生成名片…' })

    try {
      const record = archetypeRegistry[archetype]
      const interests = (topInterests ?? [])
        .filter((i): i is string => typeof i === 'string')

      const input: ProfilePosterInput = {
        displayName,
        archetypeId: archetype,
        archetypeName: archetypeName || record?.name || archetype,
        familyName: archetypeFamilyName,
        tagline: record?.narrative?.tagline,
        summary: record?.narrative?.description,
        city: userCity,
        age: userAge,
        interests,
        referralCode,
        preferredDpr: isDegradation ? 1 : 2,
      }

      const posterPath = await generateProfileSharePoster(input)

      if (!mountedRef.current) return

      profileAnalytics.track('profile_share_card_generated', { archetype })

      // Dismiss the generation spinner before presenting the action sheet;
      // WeChat's native sheet should not sit under a loading overlay.
      try {
        Taro.hideLoading()
      } catch {
        // ignore
      }

      const taroWithShareImageMenu = Taro as typeof Taro & {
        showShareImageMenu?: (options: { path: string }) => Promise<unknown>
      }
      const hasNativeShare = typeof taroWithShareImageMenu.showShareImageMenu === 'function'
      const itemList = ['保存到相册', ...(hasNativeShare ? ['分享给朋友'] : []), '预览海报']

      let tapIndex: number
      try {
        const res = await Taro.showActionSheet({ itemList })
        tapIndex = res.tapIndex
      } catch {
        return
      }

      if (tapIndex === 0) {
        haptics('medium')
        const settingRes = await Taro.getSetting()
        const authKey = 'scope.writePhotosAlbum' as const
        const hasAuth = settingRes.authSetting[authKey] as boolean | undefined
        if (!hasAuth) {
          await Taro.authorize({ scope: authKey })
        }
        await Taro.saveImageToPhotosAlbum({ filePath: posterPath })
        void Taro.showToast({ title: '名片已保存到相册', icon: 'success', duration: 1500 })
      } else if (hasNativeShare && tapIndex === 1) {
        haptics('light')
        await taroWithShareImageMenu.showShareImageMenu!({ path: posterPath })
      } else {
        haptics('light')
        await Taro.previewImage({ current: posterPath, urls: [posterPath] })
      }
    } catch (error) {
      if (!mountedRef.current) return
      const message = error instanceof Error ? error.message : '海报生成失败'
      logError('[Profile] Share poster generation failed', { message })
      profileAnalytics.track('profile_share_card_error', { message })
      void Taro.showToast({ title: '名片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
    } finally {
      if (mountedRef.current) {
        setIsGenerating(false)
        try {
          Taro.hideLoading()
        } catch {
          // ignore
        }
      }
    }
  }, [
    isGenerating,
    options.displayName,
    options.archetype,
    options.archetypeName,
    options.archetypeFamilyName,
    options.userCity,
    options.userAge,
    options.topInterests,
    options.referralCode,
    options.isDegradation,
  ])

  return {
    handleShareCard: generate,
    isGeneratingSharePoster: isGenerating,
  }
}
