import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import type { ArchetypeCardVariant } from '../archetypeVariants'
import type { ArchetypeVisual } from '../visuals'
import type { AnonymousAssessmentTopMatch } from '../../../../lib/auth/anonymousOnboarding'
import { apiRequestBinary } from '../../../../lib/api/api'
import { haptics } from '../../../../lib/utils/haptics'
import { logError, logInfo, logWarn } from '../../../../lib/utils/logger'
import { getMascotDisplayName } from '../../../../lib/mascot/mascotDisplay'
import { generateMingCardImage } from '../../../../lib/utils/mingCardImage'
import { generatePersonalitySquarePoster, type PersonalitySquarePosterInput } from '../../../../lib/utils/momentsPosterFactory'
import { generatePersonalitySharePoster, type PersonalitySharePosterInput } from './sharePoster'
import { ARCHETYPE_SEQUENCE, resolveCurrentCanvasImage, type TypicalityLabel } from './resultHelpers'
import type { useOnboardingAnalytics } from '../../../../hooks/onboarding/useOnboardingAnalytics'

type ResultPageAnalytics = ReturnType<typeof useOnboardingAnalytics>
type PreResolvedImage = { asset: string; path: string; width?: number; height?: number } | null

export interface ResultShareActionsDeps {
  displayArchetype: string | null
  displayArchetypeName: string
  displayAsset: string
  visual: ArchetypeVisual
  variants: ArchetypeCardVariant[]
  shareLine: string
  summary: string
  traitEntries: Array<{ key: string; label: string; value: number }>
  topMatches: AnonymousAssessmentTopMatch[]
  skillSet?: ArchetypeSkillSet
  typicalityLabel?: TypicalityLabel
  energyLevel?: number
  archetypeRank?: number
  serialNumber: string
  isDecisive?: boolean
  secondaryDisplayName?: string
  deviceTier: { isDegradation: boolean }
  shareAnimatedClipEnabled: boolean
  analytics: ResultPageAnalytics
  user: Parameters<typeof getMascotDisplayName>[0]
  preResolvedImageRef: React.MutableRefObject<PreResolvedImage>
}

/**
 * Poster / share-clip generation for the results page (extracted 2026-08-11 to
 * keep index.tsx under the repo size gate). Owns the poster, square-poster and
 * animated-clip states; any generation failure fails open to the static poster.
 */
export function useResultShareActions(deps: ResultShareActionsDeps) {
  const {
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    visual,
    variants,
    shareLine,
    summary,
    traitEntries,
    topMatches,
    skillSet,
    typicalityLabel,
    energyLevel,
    archetypeRank,
    serialNumber,
    isDecisive,
    secondaryDisplayName,
    deviceTier,
    shareAnimatedClipEnabled,
    analytics,
    user,
    preResolvedImageRef,
  } = deps

  const [sharePosterPath, setSharePosterPath] = useState('')
  const [squarePosterPath, setSquarePosterPath] = useState('')
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)
  const [isGeneratingClip, setIsGeneratingClip] = useState(false)
  const [posterError, setPosterError] = useState(false)
  const [generationPhase, setGenerationPhase] = useState('')
  const [cardNickname] = useState('')
  const [selectedVariantIndex] = useState(0)
  const posterRetryRef = useRef(false)
  const handleGeneratePosterRef = useRef<(() => Promise<void>) | null>(null)

  // Invalidate stale poster when user changes card personalization
  useEffect(() => {
    if (sharePosterPath) {
      setSharePosterPath('')
    }
    if (squarePosterPath) {
      setSquarePosterPath('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantIndex, cardNickname])

  const clearSharePoster = useCallback(() => {
    setSharePosterPath('')
  }, [])

  /**
   * Present a frictionless action sheet for sharing the generated poster.
   * Options: save to album, share to friends, or preview.
   */
  const presentShareOptions = useCallback(async (posterPath: string, momentsPath?: string) => {
    const taroWithShareImageMenu = Taro as typeof Taro & {
      showShareImageMenu?: (options: { path: string }) => Promise<unknown>
    }
    const hasNativeShareMenu = typeof taroWithShareImageMenu.showShareImageMenu === 'function'
    const hasMoments = Boolean(momentsPath)

    const itemList = [
      '保存到相册',
      ...(hasNativeShareMenu ? ['分享给朋友'] : []),
      ...(hasMoments ? ['保存朋友圈卡片'] : []),
      '预览海报',
    ]

    let tapIndex: number
    try {
      const res = await Taro.showActionSheet({ itemList })
      tapIndex = res.tapIndex
    } catch {
      analytics.interaction('share_action_dismissed', { primaryArchetype: displayArchetypeName })
      return
    }

    // Map tapIndex back to action, accounting for dynamic itemList
    const saveIdx = 0
    const shareIdx = hasNativeShareMenu ? 1 : -1
    const momentsIdx = hasMoments ? (hasNativeShareMenu ? 2 : 1) : -1
    const previewIdx = itemList.length - 1

    const saveToAlbum = async (filePath: string, label: string) => {
      try {
        const settingRes = await Taro.getSetting()
        const authKey = 'scope.writePhotosAlbum' as const
        const hasAuth = settingRes.authSetting[authKey] as boolean | undefined

        if (hasAuth === false) {
          analytics.interaction('share_save_permission_denied', { primaryArchetype: displayArchetypeName })
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
        analytics.interaction('share_save_success', { option: label, primaryArchetype: displayArchetypeName })
        void Taro.showToast({ title: `${label}已保存`, icon: 'success', duration: 2000 })
      } catch (saveErr) {
        const error = String(saveErr)
        logError('[PersonalityResults] Save to album failed', { error, option: label, primaryArchetype: displayArchetypeName })
        analytics.interaction('share_save_failed', { error, option: label, primaryArchetype: displayArchetypeName })
        void Taro.showToast({
          title: `${getMascotDisplayName(user)}没能把卡片存进相册，可能需要你授权一下~`,
          icon: 'none',
          duration: 2500,
        })
      }
    }

    if (tapIndex === saveIdx) {
      haptics('medium')
      await saveToAlbum(posterPath, '氛围卡')
    } else if (tapIndex === shareIdx) {
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'share', primaryArchetype: displayArchetypeName })
      await taroWithShareImageMenu.showShareImageMenu!({ path: posterPath })
    } else if (tapIndex === momentsIdx) {
      haptics('medium')
      analytics.interaction('share_action_selected', { option: 'moments', primaryArchetype: displayArchetypeName })
      await saveToAlbum(momentsPath!, '朋友圈卡片')
    } else if (tapIndex === previewIdx) {
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'preview', primaryArchetype: displayArchetypeName })
      const urls = momentsPath ? [posterPath, momentsPath] : [posterPath]
      await Taro.previewImage({ current: posterPath, urls })
    }
  }, [analytics, displayArchetypeName, user])

  const handleGeneratePoster = useCallback(async () => {
    if (isGeneratingPoster || !displayArchetype) {
      return
    }

    // Offline pre-check — poster generation requires CDN images
    try {
      const { networkType } = await Taro.getNetworkType()
      if (networkType === 'none') {
        void Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2500 })
        return
      }
    } catch {
      // getNetworkType may fail on some devices — proceed anyway
    }

    setIsGeneratingPoster(true)
    setPosterError(false)
    setGenerationPhase('准备素材中…')

    try {
      const selectedVariant = variants[selectedVariantIndex]
      const accentColor = selectedVariant?.accentColor ?? (visual.accent || '#8B5CF6')
      const accentSoft = selectedVariant?.accentSoft ?? visual.accentSoft

      // Canvas drawImage requires a network-resolvable URL. The local
      // subpackage path (/pages/onboarding/assets/...) works for <Image>
      // preloading but is not guaranteed to resolve inside canvas. Prefer
      // the CDN asset for canvas drawing; fall back to the local bundled
      // path only when the CDN asset is missing.
      // `displayAsset` is the subpackage local WebP; `visual.asset` is
      // the CDN/main-package path.
      const canvasArchetypeAsset = visual.asset || displayAsset

      // The reveal can transition between archetypes before the background
      // preload finishes. Resolve the current asset at save time so both the
      // outer poster and the centered collectible-card avatar use this exact
      // result, never an earlier reel character.
      const resolvedArchetypeImage = await resolveCurrentCanvasImage(
        displayArchetype,
        [displayAsset, canvasArchetypeAsset, visual.assetPng],
        preResolvedImageRef.current,
        Taro.getImageInfo,
      )
      preResolvedImageRef.current = resolvedArchetypeImage

      // Slice 4 (2026-07-19): canonical 命格卡 for the poster hero panel.
      // Fail-open: generation failure just means the poster uses raw archetype art.
      setGenerationPhase('正在绘制命格卡…')
      const archetypeSequenceIndex = ARCHETYPE_SEQUENCE.indexOf(displayArchetype)
      if (archetypeSequenceIndex < 0) {
        // Canonical-order drift guard (review concern C2) — never print a wrong set number silently.
        logWarn('[PersonalityResults] displayArchetype missing from ARCHETYPE_SEQUENCE; card footer falls back to No.01', { archetype: displayArchetype })
      }
      const mingCardImagePath = await generateMingCardImage({
        name: displayArchetypeName,
        badge: typicalityLabel?.prefix ?? '典型',
        // Keep collectible-card keywords on the same canonical archetype key
        // as its character, skills, color, energy, rarity, and numbering.
        keywords: visual.traits.slice(0, 3),
        blendLine: isDecisive === false && secondaryDisplayName
          ? `隐约有${secondaryDisplayName}的影子`
          : undefined,
        accent: accentColor,
        index: archetypeSequenceIndex >= 0 ? archetypeSequenceIndex + 1 : 1,
        artImagePath: resolvedArchetypeImage.path,
        artImageSize: {
          width: resolvedArchetypeImage.width || 480,
          height: resolvedArchetypeImage.height || 480,
        },
      }) ?? undefined

      const posterInput: PersonalitySharePosterInput = {
        archetype: displayArchetypeName,
        nickname: cardNickname || visual.nickname || displayArchetypeName,
        tagline: visual.tagline || visual.description || summary,
        shareLine,
        accentColor,
        accentSoft,
        archetypeAsset: canvasArchetypeAsset,
        archetypeAssetPng: visual.assetPng,
        preResolvedImagePath: resolvedArchetypeImage.path,
        mingCardImagePath,
        confidenceLabel: typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined,
        rarityLabel:
          typeof visual.rarityPercentage === 'number'
            ? `稀有度 ${Math.round(visual.rarityPercentage)}%`
            : undefined,
        activeSkillTitle: skillSet?.activeSkill.name ?? '瞬间点亮全场',
        activeSkillEffect: skillSet?.activeSkill.shortEffect ?? '把陌生局迅速带到更舒服的节奏。',
        passiveSkillTitle: skillSet?.passiveSkill.name ?? '气场持续发光',
        passiveSkillEffect: skillSet?.passiveSkill.shortEffect ?? '不用刻意用力，也会让人想靠近你。',
        topMatches: topMatches.map((match) => ({
          archetype: match.archetype,
          score: Number(match.score) || 0,
        })),
        traitEntries: traitEntries.map(({ label, value }) => ({ label, value })),
        subtitle: visual.nickname || displayArchetypeName,
        energyLevel,
        archetypeRank,
        serialNumber,
      }

      setGenerationPhase('正在渲染全息卡面…')
      const nextPosterPath = await generatePersonalitySharePoster(posterInput)
      setSharePosterPath(nextPosterPath)

      // Generate square Moments poster (best-effort; degrades on low-end devices)
      let nextSquarePath: string | undefined
      if (!deviceTier.isDegradation) {
        try {
          const squareInput: PersonalitySquarePosterInput = {
            archetype: displayArchetypeName,
            subtitle: visual.nickname || displayArchetypeName,
            tagline: visual.tagline || visual.description || summary,
            shareLine,
            rarityPercentage: typeof visual.rarityPercentage === 'number' ? visual.rarityPercentage : 0,
            archetypeAsset: canvasArchetypeAsset,
            archetypeAssetPng: visual.assetPng,
            preResolvedImagePath: resolvedArchetypeImage.path,
            traitEntries: traitEntries.slice(0, 3).map(({ label, value }) => ({ label, value })),
            energyLevel,
            skillSet: skillSet
              ? { activeSkill: { name: skillSet.activeSkill.name }, passiveSkill: { name: skillSet.passiveSkill.name } }
              : undefined,
            archetypeRank,
            serialNumber,
          }
          setGenerationPhase('正在生成朋友圈卡片…')
          nextSquarePath = await generatePersonalitySquarePoster(squareInput)
          setSquarePosterPath(nextSquarePath)
        } catch (squareErr) {
          logWarn('[PersonalityResults] Square poster generation failed, degrading to portrait-only', {
            error: squareErr instanceof Error ? squareErr.message : String(squareErr),
          })
        }
      }

      haptics('success')
      logInfo('[PersonalityResults] Poster generated', {
        primaryArchetype: displayArchetypeName,
        variant: selectedVariant?.name,
        hasMoments: Boolean(nextSquarePath),
      })
      void Taro.showToast({ title: '氛围卡已生成', icon: 'success', duration: 1500 })

      // Present frictionless sharing options
      await presentShareOptions(nextPosterPath, nextSquarePath)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '海报没生成成功，稍后再试'
      const isTransientError = error instanceof Error && /timeout|network|offline|abort|failed to fetch/i.test(error.message)

      // Auto-retry once on transient (network/timeout) errors before surfacing to user
      if (isTransientError && !posterRetryRef.current) {
        posterRetryRef.current = true
        logWarn('[PersonalityResults] Poster generation failed with transient error, auto-retrying', {
          message,
          primaryArchetype: displayArchetypeName,
        })
        void Taro.showToast({ title: '正在重试...', icon: 'loading', duration: 1200 })
        // Reset state so the retry callback can re-enter generation
        setIsGeneratingPoster(false)
        setGenerationPhase('')
        setTimeout(() => {
          handleGeneratePosterRef.current?.()
        }, 1500)
        return
      }

      posterRetryRef.current = false
      haptics('warning')
      analytics.errorOccurred('poster_generation_failed', message)
      logError('[PersonalityResults] Failed to generate poster', {
        message,
        primaryArchetype: displayArchetypeName,
      })
      void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      setPosterError(true)
    } finally {
      setIsGeneratingPoster(false)
      setGenerationPhase('')
    }
  }, [
    analytics,
    archetypeRank,
    deviceTier.isDegradation,
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    energyLevel,
    isGeneratingPoster,
    presentShareOptions,
    serialNumber,
    shareLine,
    skillSet,
    summary,
    topMatches,
    traitEntries,
    typicalityLabel,
    variants,
    visual,
  ])
  // Keep a ref to the latest handleGeneratePoster so the retry timeout
  // can call the most recent closure (with correct isGeneratingPoster state).
  handleGeneratePosterRef.current = handleGeneratePoster

  /**
   * Phase 3 / B3 (2026-08-01): animated share clip.
   * POSTs the reveal identity to the server, which composes a muted MP4
   * (canvas frames + ffmpeg) and returns the bytes; we write them to a temp
   * file and save to the photo album. Any failure falls back to the static
   * poster CTA (the button simply reports the clip is unavailable).
   */
  const handleGenerateClip = useCallback(async () => {
    if (isGeneratingClip || !displayArchetype || !shareAnimatedClipEnabled) return

    try {
      const { networkType } = await Taro.getNetworkType()
      if (networkType === 'none') {
        void Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2500 })
        return
      }
    } catch {
      // network check best-effort
    }

    setIsGeneratingClip(true)
    analytics.interaction('share_clip_generate_start', { primaryArchetype: displayArchetypeName })

    try {
      const archetypeNameCn = ARCHETYPE_BY_ID[displayArchetype]?.nameCn ?? displayArchetypeName
      const mp4 = await apiRequestBinary({
        path: '/api/personality/share-clip',
        data: {
          archetype: displayArchetype,
          archetypeNameCn,
          blendLine: shareLine?.slice(0, 48) || undefined,
          archetypeImageUrl: displayAsset?.startsWith('https://joyjoinapp.com/static/')
            ? displayAsset
            : undefined,
        },
        timeout: 30000,
      })

      // Write MP4 bytes to a temp file, then save to the photo album
      const filePath = `${Taro.env.USER_DATA_PATH}/joyjoin-share-clip-${Date.now()}.mp4`
      const fs = Taro.getFileSystemManager()
      await new Promise<void>((resolve, reject) => {
        fs.writeFile({
          filePath,
          data: mp4,
          success: () => resolve(),
          fail: (err) => reject(new Error(err.errMsg ?? 'writeFile failed')),
        })
      })

      await Taro.saveVideoToPhotosAlbum({ filePath })
      haptics('success')
      analytics.interaction('share_clip_save_success', { primaryArchetype: displayArchetypeName })
      void Taro.showToast({ title: '动态短片已保存', icon: 'success', duration: 2000 })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logWarn('[PersonalityResults] animated share clip failed', {
        error: message,
        primaryArchetype: displayArchetypeName,
      })
      analytics.interaction('share_clip_save_failed', {
        error: message,
        primaryArchetype: displayArchetypeName,
      })
      void Taro.showToast({
        title: '动态短片暂时生成不了，先用静态卡面分享吧~',
        icon: 'none',
        duration: 2500,
      })
    } finally {
      setIsGeneratingClip(false)
    }
  }, [
    analytics,
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    isGeneratingClip,
    shareAnimatedClipEnabled,
    shareLine,
  ])

  return {
    sharePosterPath,
    squarePosterPath,
    isGeneratingPoster,
    isGeneratingClip,
    posterError,
    generationPhase,
    selectedVariantIndex,
    clearSharePoster,
    handleGeneratePoster,
    handleGenerateClip,
  }
}
