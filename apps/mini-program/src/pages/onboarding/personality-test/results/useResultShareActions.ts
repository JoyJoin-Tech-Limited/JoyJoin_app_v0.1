import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import type { ArchetypeCardVariant } from '../archetypeVariants'
import type { ArchetypeVisual } from '../visuals'
import { apiRequestBinary } from '../../../../lib/api/api'
import { haptics } from '../../../../lib/utils/haptics'
import { logError, logInfo, logWarn } from '../../../../lib/utils/logger'
import { getMascotDisplayName } from '../../../../lib/mascot/mascotDisplay'
import { fetchShareQrCodeImage } from '../../../../lib/referral/shareQrCode'
import { generatePersonalitySquarePoster, type PersonalitySquarePosterInput } from '../../../../lib/utils/momentsPosterFactory'
import { generatePersonalitySharePoster, type PersonalitySharePosterInput } from './sharePoster'
import { resolveCurrentCanvasImage, type TypicalityLabel } from './resultHelpers'
import type { useOnboardingAnalytics } from '../../../../hooks/onboarding/useOnboardingAnalytics'

type ResultPageAnalytics = ReturnType<typeof useOnboardingAnalytics>
type PreResolvedImage = { asset: string; path: string; width?: number; height?: number } | null
type PosterKind = 'portrait' | 'square'
type PosterCacheEntry = { key: string; path: string; resolvedImagePath: string }
type WorkPhase = 'idle' | 'generating' | 'retry' | 'action'

type GeneratedPosterSet = {
  portraitPath: string
  squarePath?: string
  portraitGenerated: boolean
  squareGenerated: boolean
  hasQr: boolean
  resolvedImagePath: string
}

const POSTER_RETRY_DELAY_MS = 1500

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'errMsg' in error) {
    return String((error as { errMsg?: unknown }).errMsg ?? error)
  }
  return String(error)
}

function isCancellation(error: unknown): boolean {
  return /cancel/i.test(errorMessage(error))
}

function isAlbumDenial(error: unknown): boolean {
  return /auth|deny|denied|permission/i.test(errorMessage(error))
}

function isTransientGenerationError(error: unknown): boolean {
  return /timeout|network|offline|abort|failed to fetch/i.test(errorMessage(error))
}

export interface ResultShareActionsDeps {
  displayArchetype: string | null
  displayArchetypeName: string
  displayAsset: string
  visual: ArchetypeVisual
  variants: ArchetypeCardVariant[]
  shareLine: string
  summary: string
  traitEntries: Array<{ key: string; label: string; value: number }>
  skillSet?: ArchetypeSkillSet
  typicalityLabel?: TypicalityLabel
  energyLevel?: number
  archetypeRank?: number
  serialNumber: string | undefined
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
    skillSet,
    typicalityLabel,
    energyLevel,
    archetypeRank,
    serialNumber,
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

  const posterCacheRef = useRef<Record<PosterKind, PosterCacheEntry | null>>({
    portrait: null,
    square: null,
  })
  const epochRef = useRef(0)
  const mountedRef = useRef(true)
  const pageHiddenRef = useRef(false)
  const operationInFlightRef = useRef(false)
  const workPhaseRef = useRef<WorkPhase>('idle')
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCancelRef = useRef<(() => void) | null>(null)
  const activeActionPathsRef = useRef(new Map<string, number>())
  const deferredCleanupPathsRef = useRef(new Set<string>())

  const selectedVariant = variants[selectedVariantIndex]
  const sharedPosterKey = {
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    visual,
    selectedVariant,
    cardNickname,
    shareLine,
    summary,
    skillSet,
    typicalityLabel,
    energyLevel,
    archetypeRank,
    serialNumber,
    user: user ? ((user as { id?: string }).id ?? 'authenticated') : 'guest',
  }
  const portraitCacheKey = JSON.stringify({ kind: 'portrait', ...sharedPosterKey })
  const squareCacheKey = JSON.stringify({
    kind: 'square',
    ...sharedPosterKey,
    traitEntries: traitEntries.slice(0, 3).map(({ label, value }) => ({ label, value })),
    isDegradation: deviceTier.isDegradation,
  })
  const observedKeysRef = useRef({ portrait: portraitCacheKey, square: squareCacheKey })

  const isEpochCurrent = useCallback((epoch: number) => (
    mountedRef.current && epochRef.current === epoch
  ), [])
  const canPresentUi = useCallback((epoch: number) => (
    isEpochCurrent(epoch) && !pageHiddenRef.current
  ), [isEpochCurrent])

  const unlinkOwnedFile = useCallback((path: string) => {
    if (!path) return
    try {
      Taro.getFileSystemManager().unlinkSync(path)
    } catch {
      // Best-effort: a missing/already-removed owned temp file needs no UI.
    }
  }, [])

  const cleanupOwnedFile = useCallback((path: string, force = false) => {
    if (!path) return
    if (!force && (activeActionPathsRef.current.get(path) ?? 0) > 0) {
      deferredCleanupPathsRef.current.add(path)
      return
    }
    deferredCleanupPathsRef.current.delete(path)
    unlinkOwnedFile(path)
  }, [unlinkOwnedFile])

  const retainActionPaths = useCallback((paths: string[]) => {
    paths.filter(Boolean).forEach((path) => {
      activeActionPathsRef.current.set(path, (activeActionPathsRef.current.get(path) ?? 0) + 1)
    })
  }, [])

  const releaseActionPaths = useCallback((paths: string[]) => {
    paths.filter(Boolean).forEach((path) => {
      const nextCount = Math.max((activeActionPathsRef.current.get(path) ?? 1) - 1, 0)
      if (nextCount === 0) activeActionPathsRef.current.delete(path)
      else activeActionPathsRef.current.set(path, nextCount)

      const stillCached = posterCacheRef.current.portrait?.path === path
        || posterCacheRef.current.square?.path === path
      if (
        nextCount === 0
        && deferredCleanupPathsRef.current.has(path)
        && !stillCached
      ) {
        deferredCleanupPathsRef.current.delete(path)
        unlinkOwnedFile(path)
      }
    })
  }, [unlinkOwnedFile])

  const discardCachedPoster = useCallback((kind: PosterKind) => {
    const entry = posterCacheRef.current[kind]
    posterCacheRef.current[kind] = null
    if (entry) cleanupOwnedFile(entry.path)
    if (kind === 'portrait') setSharePosterPath('')
    else setSquarePosterPath('')
  }, [cleanupOwnedFile])

  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
    const cancel = retryCancelRef.current
    retryCancelRef.current = null
    cancel?.()
  }, [])

  const invalidateInFlight = useCallback(() => {
    epochRef.current += 1
    cancelRetry()
    operationInFlightRef.current = false
    workPhaseRef.current = 'idle'
    if (mountedRef.current) {
      setIsGeneratingPoster(false)
      setGenerationPhase('')
    }
  }, [cancelRetry])

  const clearSharePoster = useCallback(() => {
    invalidateInFlight()
    discardCachedPoster('portrait')
    discardCachedPoster('square')
    setPosterError(false)
  }, [discardCachedPoster, invalidateInFlight])

  const readValidPoster = useCallback((kind: PosterKind, key: string) => {
    const entry = posterCacheRef.current[kind]
    if (!entry) return null
    const currentResolvedImagePath = preResolvedImageRef.current?.path ?? ''
    if (entry.key !== key || entry.resolvedImagePath !== currentResolvedImagePath) {
      discardCachedPoster(kind)
      return null
    }
    try {
      Taro.getFileSystemManager().accessSync(entry.path)
      return entry
    } catch {
      // The OS/WeChat may evict temp files independently of React state.
      posterCacheRef.current[kind] = null
      if (kind === 'portrait') setSharePosterPath('')
      else setSquarePosterPath('')
      return null
    }
  }, [discardCachedPoster, preResolvedImageRef])

  useEffect(() => {
    const previous = observedKeysRef.current
    const portraitChanged = previous.portrait !== portraitCacheKey
    const squareChanged = previous.square !== squareCacheKey
    if (portraitChanged || squareChanged) {
      invalidateInFlight()
      if (portraitChanged) discardCachedPoster('portrait')
      if (squareChanged) discardCachedPoster('square')
      setPosterError(false)
    }
    observedKeysRef.current = { portrait: portraitCacheKey, square: squareCacheKey }
  }, [discardCachedPoster, invalidateInFlight, portraitCacheKey, squareCacheKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      epochRef.current += 1
      cancelRetry()
      operationInFlightRef.current = false
      workPhaseRef.current = 'idle'
      const ownedPaths = new Set([
        posterCacheRef.current.portrait?.path,
        posterCacheRef.current.square?.path,
        ...deferredCleanupPathsRef.current,
      ])
      posterCacheRef.current = { portrait: null, square: null }
      deferredCleanupPathsRef.current.clear()
      ownedPaths.forEach((path) => {
        if (path) cleanupOwnedFile(path, true)
      })
    }
  }, [cancelRetry, cleanupOwnedFile])

  useDidHide(() => {
    pageHiddenRef.current = true
    // Native preview/share/settings also hide the page. They run in `action`
    // phase and must keep both the pending action and its poster files alive.
    if (workPhaseRef.current === 'generating' || workPhaseRef.current === 'retry') {
      invalidateInFlight()
    }
  })
  useDidShow(() => {
    pageHiddenRef.current = false
  })

  const requestAlbumAccess = useCallback(async (epoch: number): Promise<boolean> => {
    if (isEpochCurrent(epoch)) {
      analytics.interaction('share_save_permission_denied', { primaryArchetype: displayArchetypeName })
    }
    try {
      const { confirm } = await Taro.showModal({
        title: '需要相册权限',
        content: '保存卡片到相册需要您授权访问相册。',
        confirmText: '去设置',
        cancelText: '取消',
      })
      if (!confirm || !mountedRef.current) return false
      await Taro.openSetting()
      if (!mountedRef.current) return false
      // openSetting resolves after the native settings page closes. Recheck
      // immediately and resume this exact save; never require another tap.
      const rechecked = await Taro.getSetting()
      return rechecked.authSetting['scope.writePhotosAlbum'] === true
    } catch {
      // Settings/modal cancellation is a neutral permission outcome. The
      // already-generated poster remains cached for an understandable retry.
      return false
    }
  }, [analytics, displayArchetypeName, isEpochCurrent])

  const reportSaveFailure = useCallback((saveErr: unknown, label: string, epoch: number) => {
    if (!isEpochCurrent(epoch) || isCancellation(saveErr) || isAlbumDenial(saveErr)) return
    const error = errorMessage(saveErr)
    logError('[PersonalityResults] Save to album failed', {
      error,
      option: label,
      primaryArchetype: displayArchetypeName,
    })
    analytics.interaction('share_save_failed', { error, option: label, primaryArchetype: displayArchetypeName })
    if (canPresentUi(epoch)) {
      void Taro.showToast({
        title: `${getMascotDisplayName(user)}没能把卡片存进相册，可能需要你授权一下~`,
        icon: 'none',
        duration: 2500,
      })
    }
  }, [analytics, canPresentUi, displayArchetypeName, isEpochCurrent, user])

  const saveToAlbum = useCallback(async (filePath: string, label: string, epoch: number) => {
    try {
      const settingRes = await Taro.getSetting()
      if (!mountedRef.current) return
      if (settingRes.authSetting['scope.writePhotosAlbum'] === false) {
        const granted = await requestAlbumAccess(epoch)
        if (!granted) return
      }
    } catch (error) {
      reportSaveFailure(error, label, epoch)
      return
    }

    const save = () => Taro.saveImageToPhotosAlbum({ filePath })
    try {
      await save()
    } catch (error) {
      if (isCancellation(error)) return
      if (isAlbumDenial(error)) {
        const granted = await requestAlbumAccess(epoch)
        if (!granted) return
        try {
          // Same path, same pending user action — no regeneration or new tap.
          await save()
        } catch (retryError) {
          if (!isCancellation(retryError) && !isAlbumDenial(retryError)) {
            reportSaveFailure(retryError, label, epoch)
          }
          return
        }
      } else {
        reportSaveFailure(error, label, epoch)
        return
      }
    }

    if (isEpochCurrent(epoch)) {
      haptics('success')
      analytics.interaction('share_save_success', { option: label, primaryArchetype: displayArchetypeName })
      if (canPresentUi(epoch)) {
        void Taro.showToast({ title: `${label}已保存`, icon: 'success', duration: 2000 })
      }
    }
  }, [analytics, canPresentUi, displayArchetypeName, isEpochCurrent, reportSaveFailure, requestAlbumAccess])

  /** Present actions only after generation has fully settled. */
  const presentShareOptions = useCallback(async (
    posterPath: string,
    momentsPath: string | undefined,
    epoch: number,
  ) => {
    const retainedPaths = [posterPath, ...(momentsPath ? [momentsPath] : [])]
    retainActionPaths(retainedPaths)
    try {
      if (!canPresentUi(epoch)) return
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
        if (isEpochCurrent(epoch)) {
          analytics.interaction('share_action_dismissed', { primaryArchetype: displayArchetypeName })
        }
        return
      }
      if (!isEpochCurrent(epoch)) return

      const saveIdx = 0
      const shareIdx = hasNativeShareMenu ? 1 : -1
      const momentsIdx = hasMoments ? (hasNativeShareMenu ? 2 : 1) : -1
      const previewIdx = itemList.length - 1

      if (tapIndex === saveIdx) {
        haptics('medium')
        await saveToAlbum(posterPath, '氛围卡', epoch)
      } else if (tapIndex === shareIdx) {
        haptics('light')
        analytics.interaction('share_action_selected', { option: 'share', primaryArchetype: displayArchetypeName })
        try {
          await taroWithShareImageMenu.showShareImageMenu!({ path: posterPath })
        } catch {
          // Native share dismissal is not a generation/save failure.
        }
      } else if (tapIndex === momentsIdx) {
        haptics('medium')
        analytics.interaction('share_action_selected', { option: 'moments', primaryArchetype: displayArchetypeName })
        await saveToAlbum(momentsPath!, '朋友圈卡片', epoch)
      } else if (tapIndex === previewIdx) {
        haptics('light')
        analytics.interaction('share_action_selected', { option: 'preview', primaryArchetype: displayArchetypeName })
        const urls = momentsPath ? [posterPath, momentsPath] : [posterPath]
        try {
          await Taro.previewImage({ current: posterPath, urls })
        } catch {
          // Preview dismissal is neutral; cached files stay available.
        }
      }
    } finally {
      releaseActionPaths(retainedPaths)
    }
  }, [analytics, canPresentUi, displayArchetypeName, isEpochCurrent, releaseActionPaths, retainActionPaths, saveToAlbum])

  const generatePosterSetOnce = useCallback(async (
    epoch: number,
    cachedPortrait: PosterCacheEntry | null,
    cachedSquare: PosterCacheEntry | null,
  ): Promise<GeneratedPosterSet | null> => {
    if (!displayArchetype) return null

    let qrCodeImagePath: string | undefined
    let qrCodePromise: Promise<string | undefined> | null = null
    let qrAwaited = false
    let nextPortraitPath = cachedPortrait?.path ?? ''
    let nextSquarePath = cachedSquare?.path
    let portraitGenerated = false
    let squareGenerated = false
    let succeeded = false

    try {
      let offline = false
      try {
        const { networkType } = await Taro.getNetworkType()
        offline = networkType === 'none'
      } catch {
        // Network pre-check is best-effort; local/pre-resolved art still works.
      }
      if (!isEpochCurrent(epoch)) return null

      const accentColor = selectedVariant?.accentColor ?? (visual.accent || '#8B5CF6')
      const accentSoft = selectedVariant?.accentSoft ?? visual.accentSoft
      const canvasArchetypeAsset = visual.asset || displayAsset
      qrCodePromise = !offline && user
        ? fetchShareQrCodeImage().catch(() => undefined)
        : Promise.resolve(undefined)

      // Offline generation is intentional: a cached/local asset can produce a
      // copy-only poster. If no candidate resolves, the error remains honest.
      const resolvedArchetypeImage = await resolveCurrentCanvasImage(
        displayArchetype,
        [displayAsset, canvasArchetypeAsset, visual.assetPng],
        preResolvedImageRef.current,
        Taro.getImageInfo,
      )
      if (!isEpochCurrent(epoch)) return null
      preResolvedImageRef.current = resolvedArchetypeImage
      setGenerationPhase('正在渲染全息卡面…')
      qrCodeImagePath = await qrCodePromise
      qrAwaited = true
      if (!isEpochCurrent(epoch)) return null

      if (!cachedPortrait) {
        const posterInput: PersonalitySharePosterInput = {
          archetype: displayArchetypeName,
          tagline: visual.tagline || visual.description || summary,
          shareLine,
          accentColor,
          accentSoft,
          archetypeAsset: canvasArchetypeAsset,
          archetypeAssetPng: visual.assetPng,
          preResolvedImagePath: resolvedArchetypeImage.path,
          confidenceLabel: typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined,
          rarityLabel:
            typeof visual.rarityPercentage === 'number'
              ? `稀有度 ${Math.round(visual.rarityPercentage)}%`
              : undefined,
          activeSkillTitle: skillSet?.activeSkill.name ?? '',
          activeSkillEffect: skillSet?.activeSkill.shortEffect ?? '',
          passiveSkillTitle: skillSet?.passiveSkill.name ?? '',
          passiveSkillEffect: skillSet?.passiveSkill.shortEffect ?? '',
          energyLevel,
          archetypeRank,
          serialNumber,
          qrCodeImagePath,
        }
        nextPortraitPath = await generatePersonalitySharePoster(posterInput)
        portraitGenerated = true
      }
      if (!isEpochCurrent(epoch)) return null

      if (!deviceTier.isDegradation && !cachedSquare) {
        try {
          const squareInput: PersonalitySquarePosterInput = {
            archetype: displayArchetypeName,
            tagline: visual.tagline || visual.description || summary,
            shareLine,
            archetypeAsset: canvasArchetypeAsset,
            archetypeAssetPng: visual.assetPng,
            preResolvedImagePath: resolvedArchetypeImage.path,
            accentColor,
            accentSoft,
            traitEntries: traitEntries.slice(0, 3).map(({ label, value }) => ({ label, value })),
            energyLevel,
            skillSet: skillSet
              ? { activeSkill: { name: skillSet.activeSkill.name }, passiveSkill: { name: skillSet.passiveSkill.name } }
              : undefined,
            archetypeRank,
            serialNumber,
            typicalityChip: typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined,
            qrCodeImagePath,
          }
          if (isEpochCurrent(epoch)) setGenerationPhase('正在生成朋友圈卡片…')
          nextSquarePath = await generatePersonalitySquarePoster(squareInput)
          squareGenerated = true
        } catch (squareErr) {
          if (isEpochCurrent(epoch)) {
            logWarn('[PersonalityResults] Square poster generation failed, degrading to portrait-only', {
              error: errorMessage(squareErr),
            })
          }
        }
      }
      if (!isEpochCurrent(epoch)) return null

      succeeded = true
      return {
        portraitPath: nextPortraitPath,
        squarePath: nextSquarePath,
        portraitGenerated,
        squareGenerated,
        hasQr: Boolean(qrCodeImagePath),
        resolvedImagePath: resolvedArchetypeImage.path,
      }
    } catch (error) {
      if (cachedPortrait && isEpochCurrent(epoch)) {
        // A valid portrait remains fully actionable when only the optional
        // square regeneration cannot resolve its inputs.
        logWarn('[PersonalityResults] Square poster regeneration failed, keeping portrait-only share', {
          error: errorMessage(error),
        })
        succeeded = true
        return {
          portraitPath: cachedPortrait.path,
          squarePath: undefined,
          portraitGenerated: false,
          squareGenerated: false,
          hasQr: false,
          resolvedImagePath: cachedPortrait.resolvedImagePath,
        }
      }
      throw error
    } finally {
      // A stale/unmounted generator can still finish in the background. Its
      // late files are owned by this flow and must never enter the cache.
      if (!succeeded) {
        if (portraitGenerated && nextPortraitPath) unlinkOwnedFile(nextPortraitPath)
        if (squareGenerated && nextSquarePath) unlinkOwnedFile(nextSquarePath)
      }
      if (qrAwaited) {
        if (qrCodeImagePath) unlinkOwnedFile(qrCodeImagePath)
      } else if (qrCodePromise) {
        // Art resolution can fail before the parallel QR request settles.
        // Attach ownership now so its late temp file cannot leak.
        void qrCodePromise.then((path) => {
          if (path) unlinkOwnedFile(path)
        })
      }
    }
  }, [
    archetypeRank,
    deviceTier.isDegradation,
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    energyLevel,
    isEpochCurrent,
    preResolvedImageRef,
    selectedVariant,
    serialNumber,
    shareLine,
    skillSet,
    summary,
    traitEntries,
    typicalityLabel,
    unlinkOwnedFile,
    user,
    visual,
  ])

  const waitForPosterRetry = useCallback(() => new Promise<boolean>((resolve) => {
    retryCancelRef.current = () => resolve(false)
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      retryCancelRef.current = null
      resolve(true)
    }, POSTER_RETRY_DELAY_MS)
  }), [])

  const handleGeneratePoster = useCallback(async () => {
    if (operationInFlightRef.current || !displayArchetype) return

    operationInFlightRef.current = true
    const epoch = ++epochRef.current
    workPhaseRef.current = 'generating'
    setPosterError(false)

    const cachedPortrait = readValidPoster('portrait', portraitCacheKey)
    const cachedSquare = deviceTier.isDegradation
      ? null
      : readValidPoster('square', squareCacheKey)
    const needsPortrait = !cachedPortrait
    const needsSquare = !deviceTier.isDegradation && !cachedSquare

    try {
      if (!needsPortrait && !needsSquare && cachedPortrait) {
        workPhaseRef.current = 'action'
        await presentShareOptions(cachedPortrait.path, cachedSquare?.path, epoch)
        return
      }

      setIsGeneratingPoster(true)
      setGenerationPhase('准备素材中…')
      let generated: GeneratedPosterSet | null = null
      let hasRetried = false

      while (isEpochCurrent(epoch)) {
        try {
          generated = await generatePosterSetOnce(epoch, cachedPortrait, cachedSquare)
          break
        } catch (error) {
          if (!isEpochCurrent(epoch)) return
          if (isTransientGenerationError(error) && !hasRetried) {
            hasRetried = true
            workPhaseRef.current = 'retry'
            const message = errorMessage(error)
            logWarn('[PersonalityResults] Poster generation failed with transient error, auto-retrying', {
              message,
              primaryArchetype: displayArchetypeName,
            })
            if (canPresentUi(epoch)) {
              void Taro.showToast({ title: '正在重试...', icon: 'loading', duration: 1200 })
            }
            setGenerationPhase('')
            const shouldRetry = await waitForPosterRetry()
            if (!shouldRetry || !isEpochCurrent(epoch)) return
            workPhaseRef.current = 'generating'
            continue
          }
          throw error
        }
      }

      if (!generated || !isEpochCurrent(epoch)) {
        if (generated?.portraitGenerated) unlinkOwnedFile(generated.portraitPath)
        if (generated?.squareGenerated && generated.squarePath) unlinkOwnedFile(generated.squarePath)
        return
      }
      if (generated.portraitGenerated) {
        const previous = posterCacheRef.current.portrait
        posterCacheRef.current.portrait = {
          key: portraitCacheKey,
          path: generated.portraitPath,
          resolvedImagePath: generated.resolvedImagePath,
        }
        if (previous && previous.path !== generated.portraitPath) cleanupOwnedFile(previous.path)
        setSharePosterPath(generated.portraitPath)
      }
      if (generated.squareGenerated && generated.squarePath) {
        const previous = posterCacheRef.current.square
        posterCacheRef.current.square = {
          key: squareCacheKey,
          path: generated.squarePath,
          resolvedImagePath: generated.resolvedImagePath,
        }
        if (previous && previous.path !== generated.squarePath) cleanupOwnedFile(previous.path)
        setSquarePosterPath(generated.squarePath)
      } else if (needsSquare && !generated.squarePath) {
        setSquarePosterPath('')
      }

      if (generated.portraitGenerated || generated.squareGenerated) {
        haptics('success')
        logInfo('[PersonalityResults] Poster generated', {
          primaryArchetype: displayArchetypeName,
          variant: selectedVariant?.name,
          hasMoments: Boolean(generated.squarePath),
          hasQr: generated.hasQr,
        })
        if (canPresentUi(epoch)) {
          void Taro.showToast({ title: '氛围卡已生成', icon: 'success', duration: 1500 })
        }
      }

      workPhaseRef.current = 'action'
      setIsGeneratingPoster(false)
      setGenerationPhase('')
      await presentShareOptions(generated.portraitPath, generated.squarePath, epoch)
    } catch (error) {
      if (!isEpochCurrent(epoch)) return
      const rawMessage = errorMessage(error)
      const message = rawMessage && rawMessage !== 'undefined'
        ? rawMessage
        : '海报没生成成功，稍后再试'
      haptics('warning')
      analytics.errorOccurred('poster_generation_failed', message)
      logError('[PersonalityResults] Failed to generate poster', {
        message,
        primaryArchetype: displayArchetypeName,
      })
      if (canPresentUi(epoch)) {
        void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      }
      setPosterError(true)
    } finally {
      if (isEpochCurrent(epoch)) {
        operationInFlightRef.current = false
        workPhaseRef.current = 'idle'
        setIsGeneratingPoster(false)
        setGenerationPhase('')
      }
    }
  }, [
    analytics,
    canPresentUi,
    cleanupOwnedFile,
    deviceTier.isDegradation,
    displayArchetype,
    displayArchetypeName,
    generatePosterSetOnce,
    isEpochCurrent,
    portraitCacheKey,
    presentShareOptions,
    readValidPoster,
    selectedVariant?.name,
    squareCacheKey,
    unlinkOwnedFile,
    waitForPosterRetry,
  ])

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
