import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro, { useRouter, useDidHide } from "@tarojs/taro"
import { useState, useEffect, useRef, useMemo } from "react"
import { cdnAsset, localAsset } from "../../lib/utils/cdnAssets"
import { loadBrandDisplayFont } from "../../lib/utils/brandFont"
import Button from "../../components/ui/Button"
import BrandLogo from "../../components/ui/BrandLogo"
import ArchetypeHead from "../../components/mascot/ArchetypeHead"
import { useStaggerMount } from "../../hooks/useStaggerMount"
import { useDeviceTier } from "../../hooks/useDeviceTier"
import { ResponsiveSpacer } from "../../components/ui/ResponsiveSpacer"
import { runMiniProgramRouteTransition, navigateToMiniProgramNextStep } from "../../lib/onboarding/onboardingNavigation"
import { MINI_PROGRAM_ROUTES } from "../../lib/onboarding/onboardingRoutes"
import { useWeChatLogin } from "../../hooks/auth/useWeChatLogin"
import { useResetOnShow } from "../../hooks/useResetOnShow"
import { readAnonymousAssessmentSession, isAnonymousAssessmentSessionCompleted } from "../../lib/auth/anonymousOnboarding"
import { onboardingAnalytics } from "../../lib/onboarding/onboardingAnalytics"
import { landingAnalytics } from "../../lib/analytics/landingAnalytics"
import { getSystemReducedMotion } from "../../lib/utils/accessibility"
import { getWindowInfoCompat } from "../../lib/utils/systemInfo"
import { getErrorForSurface } from "@shared/copy/errorBaselines"
import { logInfo, logWarn } from "../../lib/utils/logger"
import { computeBurstOffsets, type BurstOffset, type BurstRect } from "./mechanismBurst"
import "./index.scss"

/**
 * Blind-box city hero (2026-07-26 redesign). The master composite
 * (box + golden glow + peeking Xiaoyue) is ONE Lovart image so the lighting
 * stays coherent; the floating elements are separate transparent sprites so
 * the entrance can stagger them. All CDN-delivered; the bundled welcome
 * mascot is the resilience fallback when the CDN hero cannot load.
 */
// Hero composite + LQIP are BUNDLED locally (main package, ~115KB total) —
// guaranteed to render on-device regardless of CDN reachability. WeChat can
// silently hang a CDN <Image> (no onLoad/onError), which blanked the hero
// on some devices. 3-tier chain (2026-09-01): local package copy first; if
// that errors (e.g. asset dropped from an uploaded package), fall back to
// the CDN copy; if that errors or the 6s guard fires, the bundled mascot.
// The floating sprites remain CDN-only (decorative, failure-safe).
const HERO_LOCAL_SRC = localAsset('/assets/lovart/landing/hero-box-xiaoyue-dusk.webp')
const HERO_CDN_SRC = cdnAsset('/assets/lovart/landing/hero-box-xiaoyue-dusk.webp')
const HERO_FALLBACK_SRC = localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp')

const HERO_SPRITES = [
  { key: 'buildings', src: cdnAsset('/assets/lovart/landing/sprite-buildings.webp') },
  { key: 'cards', src: cdnAsset('/assets/lovart/landing/sprite-cards.webp') },
  { key: 'map-pin', src: cdnAsset('/assets/lovart/landing/sprite-map-pin.webp') },
  { key: 'dice', src: cdnAsset('/assets/lovart/landing/sprite-dice.webp') },
  { key: 'glass', src: cdnAsset('/assets/lovart/landing/sprite-glass.webp') },
] as const

type HeroSpriteKey = (typeof HERO_SPRITES)[number]['key']
type HeroState = 'loading' | 'ready' | 'fallback'
type LandingCtaType = 'new' | 'continue' | 'discover' | 'loggedOut'
/** ?auth=logout|expired marks the landing as the post-logout re-auth door
 *  (the standalone pages/login/index was retired 2026-09-01). */
type LoggedOutMode = 'logout' | 'expired'

/** Persisted legal acceptance — returning users who already agreed to the
 *  用户协议/隐私政策 must not be forced to re-check the box on every login
 *  (2026-09-01). Versioned key: bump when the terms materially change and
 *  re-consent is required. */
const LEGAL_ACCEPTED_STORAGE_KEY = 'joyjoin_legal_accepted_v1'

function readLegalAccepted(): boolean {
  try {
    return Taro.getStorageSync(LEGAL_ACCEPTED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistLegalAccepted(): void {
  try {
    Taro.setStorageSync(LEGAL_ACCEPTED_STORAGE_KEY, '1')
  } catch {
    /* non-critical — the box simply starts unchecked next visit */
  }
}

/**
 * E3 盒子吐卡 (mechanism-first landing, 2026-07-31): six canonical archetype
 * grid heads burst out of the box mouth and land as a "table row" strip,
 * enacting 答题 → 攒一桌 → 线下见 instead of telling it. The set is fixed
 * (not rotated) so screenshot review + the asset-check gate stay stable.
 * Grid heads are bundled locally (pool-registration seats) — zero new
 * package weight; the strip pin reuses the already-fetched CDN sprite.
 */
const MECHANISM_HEADS = ['corgi', 'fox', 'rooster', 'koala', 'cat', 'dolphin_calm'] as const

const MAP_PIN_SPRITE_SRC = HERO_SPRITES.find((s) => s.key === 'map-pin')!.src

/** Hero composite + LQIP are bundled locally (see HERO_LOCAL_SRC above);
 *  analytics srcType records which tier actually rendered. */
type HeroSrcStage = 'local' | 'cdn'

/** Max wait for the CDN hero asset to fire onLoad/onError before forcing the
 *  bundled mascot fallback. WeChat devices can silently hang a pending
 *  <Image> with no callback; 6s bounds the blank-frame window on slow nets
 *  while staying well under the auth-gate timeout (8s) so a slow hero never
 *  delays the user's first interaction. */
const HERO_LOAD_TIMEOUT_MS = 6_000

/** Same window-height probe pattern as ResponsiveSpacer (not exported there). */
function readWindowHeightPx(): number {
  return getWindowInfoCompat().windowHeight ?? 9999
}

function toDwellBucket(dwellMs: number): '<3s' | '3-8s' | '8-15s' | '15-30s' | '>=30s' {
  if (dwellMs < 3000) return '<3s'
  if (dwellMs < 8000) return '3-8s'
  if (dwellMs < 15000) return '8-15s'
  if (dwellMs < 30000) return '15-30s'
  return '>=30s'
}

interface MiniProgramLandingPageProps {
  isAuthLoading?: boolean
  isAuthTimedOut?: boolean
  isOffline?: boolean
  onAuthRetry?: () => void
  onAuthDismiss?: () => void
  /** Server-driven nextStep for authenticated returning users. */
  userNextStep?: string | null
}

export default function MiniProgramLandingPage({
  isAuthLoading = false,
  isAuthTimedOut = false,
  isOffline = false,
  onAuthRetry,
  onAuthDismiss,
  userNextStep = null,
}: MiniProgramLandingPageProps) {
  const router = useRouter()
  const invitationCode = router.params.invitationCode ?? ''
  // Post-logout re-auth entry (?auth=logout|expired): welcome-back copy,
  // single login CTA, mechanism rendered settled (no burst — the mechanism
  // explains the product to NEW users; returning users already know it).
  const loggedOutMode: LoggedOutMode | null =
    router.params.auth === 'logout' || router.params.auth === 'expired'
      ? router.params.auth
      : null
  // Dev/screenshot review: ?freeze=burst pins the heads at the box mouth
  // (mid-burst state) so H5 capture can review the choreography frozen.
  const freezeBurst = router.params.freeze === 'burst'
  // Legal consent starts checked for anyone who has accepted before
  // (persisted) and for every post-logout re-auth entry — a returning user
  // re-logging in has already consented; only brand-new guests must tick.
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(
    () => loggedOutMode != null || readLegalAccepted(),
  )
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [shakeLegal, setShakeLegal] = useState(false)
  const [showLegalHint, setShowLegalHint] = useState(false)
  const [legalHintSeq, setLegalHintSeq] = useState(0)
  const [heroState, setHeroState] = useState<HeroState>('loading')
  const [heroSrcStage, setHeroSrcStage] = useState<HeroSrcStage>('local')
  const [failedSprites, setFailedSprites] = useState<ReadonlySet<HeroSpriteKey>>(new Set())
  const [hasIncompleteSession, setHasIncompleteSession] = useState(false)
  const [isShortScreen, setIsShortScreen] = useState(false)
  // Mid tier (2026-09-01): the 700–880px window band (iPhone 12/13/14,
  // 11 Pro, 12 mini ≈ 1560–1623rpx usable) previously fell into the
  // default 1733rpx composition and hard-clipped the hero copy behind the
  // CTA. Short tier now starts at 700px (was 640) to catch iPhone 8/SE.
  const [isMidScreen, setIsMidScreen] = useState(false)
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const isMounted = useStaggerMount()
  const { isDegradation } = useDeviceTier()
  // E3 burst: per-seat "from" offsets (box mouth → seat) measured at runtime.
  // null = not measured / measurement failed (heads then fade in place via
  // the --settled class). burstSettled flips the seats from the inline
  // from-transform to identity through the CSS transition.
  const [burstFrom, setBurstFrom] = useState<ReadonlyArray<BurstOffset> | null>(null)
  const [burstSettled, setBurstSettled] = useState(false)
  const burstSeqRef = useRef(0)
  const burstTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin({
    referralCode: invitationCode || undefined,
  })
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const legalHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Mount timestamp — dwell + hero-duration measurements anchor here. */
  const mountedAtRef = useRef(Date.now())
  const networkTypeRef = useRef('unknown')
  const dwellFiredRef = useRef(false)
  const heroStateRef = useRef<HeroState>('loading')

  useEffect(() => {
    loadBrandDisplayFont()
    const snapshot = readAnonymousAssessmentSession()
    setHasIncompleteSession(!!snapshot && !isAnonymousAssessmentSessionCompleted(snapshot))
    const windowHeightPx = readWindowHeightPx()
    setIsShortScreen(windowHeightPx < 700)
    setIsMidScreen(windowHeightPx >= 700 && windowHeightPx < 880)
    void Taro.getNetworkType()
      .then((res) => {
        networkTypeRef.current = res.networkType
      })
      .catch(() => {
        /* keep 'unknown' */
      })
  }, [])

  // Reset navigation loading state when the user swipes back or foregrounds
  // the landing page so the CTA never stays stuck on the ellipsis spinner.
  useResetOnShow(() => setIsPageExiting(false))

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current)
      }
      if (legalHintTimerRef.current) {
        clearTimeout(legalHintTimerRef.current)
      }
      if (navSafetyTimeoutRef.current) {
        clearTimeout(navSafetyTimeoutRef.current)
      }
      burstTimersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // E3 盒子吐卡: measure the box-mouth anchor + seat rects once the entrance
  // settles, then hand the flight to a CSS transition (inline "from"
  // transform → identity). Runs on the --entered clock; RM/low-end tiers
  // never measure (their CSS renders the settled composition statically).
  // boundingClientRect returns post-transform coordinates, so the --mid /
  // --short stage scales are handled for free.
  const mechanismAnimated = !reduceMotion && !isDegradation && !loggedOutMode

  const measureMechanismBurst = async (mode: 'settle' | 'freeze') => {
    const seq = ++burstSeqRef.current
    try {
      const [mouth, seats] = await new Promise<[
        BurstRect | null,
        BurstRect[] | null,
      ]>((resolve) => {
        Taro.createSelectorQuery()
          .select('#box-mouth-anchor')
          .boundingClientRect()
          .selectAll('.mechanism-strip__seat')
          .boundingClientRect()
          .exec((res) => {
            resolve([
              (res?.[0] as BurstRect) ?? null,
              (res?.[1] as BurstRect[]) ?? null,
            ])
          })
      })
      if (!mouth || !seats || seats.length === 0) {
        throw new Error('mechanism rects unavailable')
      }
      const from = computeBurstOffsets(mouth, seats)
      if (seq !== burstSeqRef.current) return
      setBurstFrom(from)
      setBurstSettled(false)
      if (mode === 'settle') {
        const timer = setTimeout(() => {
          if (seq === burstSeqRef.current) setBurstSettled(true)
        }, 80)
        burstTimersRef.current.push(timer)
      }
    } catch (err) {
      if (seq !== burstSeqRef.current) return
      logWarn('[LandingPage] mechanism measure failed; fading heads in place', {
        error: err instanceof Error ? err.message : String(err),
      })
      setBurstFrom(null)
      setBurstSettled(true)
    }
  }

  // Tap-the-box replay: heads fly back into the mouth (transition reverses
  // to the cached from-offsets) and burst again. User-triggered, so it is
  // free under the passive-time budget.
  const handleMechanismReplay = () => {
    if (!mechanismAnimated || freezeBurst || !burstSettled || !burstFrom) return
    hapticLight()
    landingAnalytics.trackMechanismReplay({
      dwellMs: Date.now() - mountedAtRef.current,
    })
    setBurstSettled(false)
    const timer = setTimeout(() => setBurstSettled(true), 620)
    burstTimersRef.current.push(timer)
  }

  useEffect(() => {
    if (!isMounted || heroState !== 'ready' || !mechanismAnimated) return
    const timer = setTimeout(() => {
      void measureMechanismBurst(freezeBurst ? 'freeze' : 'settle')
    }, 520)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, heroState, mechanismAnimated, freezeBurst])

  // Hero fallback swaps the box for the bundled mascot — the "out of the
  // box" metaphor no longer reads, so settle the strip immediately (heads
  // fade in place) instead of leaving it hidden forever. Skipped under
  // freeze=burst so the review frame stays frozen.
  useEffect(() => {
    if (heroState === 'fallback' && !freezeBurst) setBurstSettled(true)
  }, [heroState, freezeBurst])

  const hapticLight = () => {
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      /* ignore unsupported devices */
    }
  }

  // For authenticated returning users, any server-driven nextStep (including
  // 'discover') means they should continue rather than restart onboarding.
  // Guests only enter continue mode when they have an incomplete anonymous
  // session or an unfinished onboarding nextStep before discover.
  const isContinueMode = hasIncompleteSession || !!userNextStep
  const ctaType: LandingCtaType = loggedOutMode
    ? 'loggedOut'
    : !isContinueMode
      ? 'new'
      : userNextStep === 'discover'
        ? 'discover'
        : 'continue'
  const ctaLabel = useMemo(() => {
    if (ctaType === 'loggedOut') return '微信一键登录'
    if (ctaType === 'new') return '测测我的聚会气场'
    if (ctaType === 'discover') return '进入发现页'
    return '接着测'
  }, [ctaType])
  const ctaDisabledClass = hasAcceptedLegal ? "" : " landing-page__cta--disabled"
  const ctaHoverClass = hasAcceptedLegal ? "landing-page__cta-hover" : ""
  const pageClassName = [
    "landing-page",
    isPageExiting ? "landing-page--exiting" : "",
    isShortScreen ? "landing-page--short" : "",
    isMidScreen ? "landing-page--mid" : "",
    isDegradation ? "landing-page--low-end" : "",
    reduceMotion ? "landing-page--rm" : "",
    loggedOutMode ? "landing-page--logged-out" : "",
    isMounted ? "landing-page--entered" : "",
  ]
    .filter(Boolean)
    .join(" ")

  const ctaTypeRef = useRef<LandingCtaType>(ctaType)
  ctaTypeRef.current = ctaType

  const fireDwell = (exitAction: 'cta_tap' | 'login_tap' | 'page_leave' | 'app_hide') => {
    if (dwellFiredRef.current) return
    dwellFiredRef.current = true
    const dwellMs = Date.now() - mountedAtRef.current
    landingAnalytics.trackDwell({
      dwellMs,
      dwellBucket: toDwellBucket(dwellMs),
      exitAction,
      // Read via ref: the unmount cleanup closes over the first render's
      // fireDwell, and ctaType can flip from 'new' to 'continue' once the
      // anonymous-session snapshot resolves.
      ctaTypeShown: ctaTypeRef.current,
    })
  }
  // Single-fire dwell on first exit signal: CTA/login tap (below), page hide,
  // or unmount — whichever comes first.
  useDidHide(() => fireDwell('app_hide'))
  useEffect(() => () => fireDwell('page_leave'), []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── On-device root-cause probe (hero saga, 2026-09-01) ──────────────────
  // The hero has "failed" across several fixes because each fix guessed a
  // different failure mode. These two probes make ONE vConsole screenshot
  // decisive:
  //   1. getImageInfo on the bundled asset — success proves the file is in
  //      the uploaded package AND decodable on this device; fail errMsg
  //      distinguishes "not found" (packaging) from decode failure.
  //   2. computedStyle on the rendered <Image> 1.5s after 'ready' — if the
  //      file decodes but the stage is blank, opacity/clipPath here shows
  //      whether the entrance animation (hero-peek clip-path) froze the
  //      composite, vs a decoder that reported success but rendered nothing.
  useEffect(() => {
    if (!isMounted) return
    try {
      Taro.getImageInfo({
        src: HERO_LOCAL_SRC,
        success: (res) => {
          logInfo('[LandingPage] hero-probe: bundled asset decodes on device', {
            width: res.width,
            height: res.height,
            orientation: res.orientation,
          })
        },
        fail: (err) => {
          logWarn('[LandingPage] hero-probe: bundled asset unavailable/undecodable', {
            src: HERO_LOCAL_SRC,
            errMsg: err?.errMsg ?? 'unknown',
          })
        },
      })
    } catch {
      /* probe unsupported — diagnostics must never break the page */
    }
  }, [isMounted])

  useEffect(() => {
    if (heroState !== 'ready') return
    const timer = setTimeout(() => {
      try {
        Taro.createSelectorQuery()
          .select('.hero-stage__hero-img')
          .fields({ computedStyle: ['opacity', 'clipPath', 'visibility'] }, (res) => {
            logInfo('[LandingPage] hero-probe: computed style 1.5s after ready', {
              opacity: (res as { opacity?: string } | null)?.opacity,
              clipPath: (res as { clipPath?: string } | null)?.clipPath,
              visibility: (res as { visibility?: string } | null)?.visibility,
            })
          })
          .exec()
      } catch {
        /* probe unsupported */
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [heroState])

  const handleHeroLoad = () => {
    if (heroState !== 'loading') return
    heroStateRef.current = 'ready'
    setHeroState('ready')
    logInfo('[LandingPage] hero <Image> onLoad fired', { srcType: heroSrcStage })
    landingAnalytics.trackHeroAsset({
      asset: 'hero-box-xiaoyue-dusk',
      result: 'success',
      srcType: heroSrcStage,
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
  }

  const handleHeroError = () => {
    if (heroState !== 'loading') return
    // Tier 1 (bundled local) failed — e.g. the asset was dropped from the
    // uploaded package by the unused-file filter. Try the CDN copy before
    // giving up to the mascot fallback.
    if (heroSrcStage === 'local') {
      setHeroSrcStage('cdn')
      landingAnalytics.trackHeroAsset({
        asset: 'hero-box-xiaoyue-dusk',
        result: 'error',
        srcType: 'local',
        durationMs: Date.now() - mountedAtRef.current,
        networkType: networkTypeRef.current,
      })
      logWarn('[LandingPage] bundled hero failed, retrying via CDN', {
        src: HERO_LOCAL_SRC,
        networkType: networkTypeRef.current,
      })
      return
    }
    heroStateRef.current = 'fallback'
    setHeroState('fallback')
    landingAnalytics.trackHeroAsset({
      asset: 'hero-box-xiaoyue-dusk',
      result: 'error',
      srcType: 'cdn',
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
    logWarn('[LandingPage] hero image failed on both tiers, using bundled mascot fallback', {
      src: HERO_CDN_SRC,
      networkType: networkTypeRef.current,
    })
  }

  // Hard timeout guard: if the CDN hero neither fires onLoad nor onError
  // (WeChat devices can hang a pending <Image> silently — no callback at all),
  // force the locally-bundled mascot fallback so the landing never sits on an
  // invisible heroState='loading' frame. Modeled on the auth-gate / AI-pipeline
  // timeout pattern. The 'ready' path is unaffected (fast path wins by clearing
  // this timer), and tracks as a distinct timeout outcome.
  useEffect(() => {
    if (heroState !== 'loading') return
    if (!isMounted) return
    const timer = setTimeout(() => {
      if (heroStateRef.current !== 'loading') return
      heroStateRef.current = 'fallback'
      setHeroState('fallback')
      setBurstSettled(true)
      landingAnalytics.trackHeroAsset({
        asset: 'hero-box-xiaoyue-dusk',
        result: 'timeout',
        srcType: heroSrcStage,
        durationMs: Date.now() - mountedAtRef.current,
        networkType: networkTypeRef.current,
      })
      logWarn('[LandingPage] hero asset timed out with no load event; using bundled mascot fallback', {
        src: heroSrcStage === 'local' ? HERO_LOCAL_SRC : HERO_CDN_SRC,
        timeoutMs: HERO_LOAD_TIMEOUT_MS,
      })
    }, HERO_LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [heroState, isMounted, heroSrcStage])

  const handleFallbackLoad = () => {
    landingAnalytics.trackHeroAsset({
      asset: 'hero-box-xiaoyue-dusk',
      result: 'fallback',
      srcType: 'local',
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
  }

  const handleSpriteError = (key: HeroSpriteKey) => {
    setFailedSprites((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
    // Sprites are decorative: failures are tracked (error-only to keep the
    // metric noise-free) and the element is simply removed from the stage.
    landingAnalytics.trackHeroAsset({
      asset: `sprite-${key}`,
      result: 'error',
      srcType: 'cdn',
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
  }

  const renderSprite = (key: HeroSpriteKey) => {
    if (failedSprites.has(key)) return null
    const sprite = HERO_SPRITES.find((item) => item.key === key)
    if (!sprite) return null
    return (
      <Image
        className={`hero-stage__sprite hero-stage__sprite--${key}`}
        src={sprite.src}
        mode='aspectFit'
        lazyLoad={false}
        aria-hidden='true'
        onError={() => handleSpriteError(key)}
      />
    )
  }

  const triggerLegalShake = () => {
    setShakeLegal(true)
    setLegalHintSeq((seq) => seq + 1)
    setShowLegalHint(true)
    hapticLight()
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
    shakeTimerRef.current = setTimeout(() => setShakeLegal(false), 400)
    if (legalHintTimerRef.current) clearTimeout(legalHintTimerRef.current)
    legalHintTimerRef.current = setTimeout(() => setShowLegalHint(false), 2500)
  }

  const navigateWithLegalGate = (url: string) => {
    void (async () => {
      // Clear any previous safety timeout before starting a new navigation.
      if (navSafetyTimeoutRef.current) {
        clearTimeout(navSafetyTimeoutRef.current)
        navSafetyTimeoutRef.current = null
      }

      try {
        await runMiniProgramRouteTransition({
          beforeNavigate: () => setIsPageExiting(true),
          delayMs: 180,
        })
        await Taro.redirectTo({ url })
      } catch (err) {
        setIsPageExiting(false)
        logWarn('[LandingPage] Navigation failed', {
          url,
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        // Always clear the safety timeout once navigation settles (success or failure).
        if (navSafetyTimeoutRef.current) {
          clearTimeout(navSafetyTimeoutRef.current)
          navSafetyTimeoutRef.current = null
        }
      }
    })()

    // Safety timeout: if Taro.navigateTo hangs silently (e.g. subpackage download
    // stuck), reset the button state after 5s so the user can retry.
    navSafetyTimeoutRef.current = setTimeout(() => {
      logWarn('[LandingPage] Navigation safety timeout fired — resetting button state')
      setIsPageExiting(false)
    }, 5000)
  }

  return (
    <View className={pageClassName}>
      {/* Hidden preload: keeps the bundled fallback mascot decodable and inside
          the WeChat package (DevTools strips string-only references). */}
      <View className='landing-page__asset-preload' aria-hidden>
        <Image src={HERO_FALLBACK_SRC} />
      </View>

      <View className='content-zone'>
        {/* Brand watermark — className sizing (SCSS) instead of the component's
            inline-rpx preset because the H5 preview drops inline rpx and
            balloons the logo, which then clips the copy zone below it. */}
        <View className='brand-mark'>
          <BrandLogo size='md' className='landing-page__brand-logo' />
        </View>

        {/* Hero stage: glowing blind box + peeking Xiaoyue + floating elements.
            Tapping the stage replays the E3 burst (user-triggered delight). */}
        <View className='hero-zone'>
          <View className='hero-stage' onClick={handleMechanismReplay}>
            <View className='hero-stage__scale'>
              {/* z0: Dusk horizon wash (P2 warm palette band) */}
              <View className='hero-stage__dusk-wash' aria-hidden='true' />

              {/* Zero-size anchor at the box mouth — the E3 burst measures
                  this at runtime instead of hardcoding rpx coordinates. */}
              <View id='box-mouth-anchor' className='hero-stage__box-mouth-anchor' aria-hidden='true' />
              <View className='hero-stage__halo' aria-hidden='true'>
                <View className='hero-stage__halo-core' />
              </View>

              {/* z2: Warm glow bridge (P2 — hero to mechanism strip) */}
              <View className='hero-stage__glow-bridge' aria-hidden='true' />

              <View className='hero-stage__particles' aria-hidden='true'>
                <View className='hero-stage__particle hero-stage__particle--1' />
                <View className='hero-stage__particle hero-stage__particle--2' />
                <View className='hero-stage__particle hero-stage__particle--3' />
              </View>

              {/* City skyline sits behind the hero composite */}
              {renderSprite('buildings')}

              <View className='hero-stage__breath'>
                {heroState !== 'fallback' ? (
                  <Image
                    className={`hero-stage__hero-img${heroState === 'ready' ? ' hero-stage__hero-img--in' : ''}`}
                    src={heroSrcStage === 'local' ? HERO_LOCAL_SRC : HERO_CDN_SRC}
                    mode='aspectFit'
                    lazyLoad={false}
                    ariaLabel='半开的紫色盲盒透出金光，悦仔从盒后好奇地探出头'
                    onLoad={handleHeroLoad}
                    onError={handleHeroError}
                  />
                ) : (
                  <Image
                    className='hero-stage__hero-fallback'
                    src={HERO_FALLBACK_SRC}
                    mode='aspectFit'
                    lazyLoad={false}
                    ariaLabel='悦仔'
                    onLoad={handleFallbackLoad}
                    onError={() => {
                      /* already reported via the hero error path */
                    }}
                  />
                )}
              </View>

              {/* Floating elements: city skyline + activity hints (refined 2026-09-02).
                  5 sprites — buildings (backdrop), cards (quiz), map-pin (destination),
                  dice (games), glass (social). All layered ON TOP of the hero. */}
              {renderSprite('cards')}
              {renderSprite('map-pin')}
              {renderSprite('dice')}
              {renderSprite('glass')}
            </View>
          </View>
        </View>

        {/* E3 mechanism strip: the box "deals" a table — six archetype seats
            burst from the box mouth into a row, then a connector draws to the
            destination pin. Settled state is a legible static composition. */}
        <View
          className={`mechanism-strip${burstSettled ? ' mechanism-strip--settled' : ''}`}
          aria-hidden='true'
        >
          <View className='mechanism-strip__seats'>
            {MECHANISM_HEADS.map((key, index) => {
              const from = !burstSettled && burstFrom ? burstFrom[index] : undefined
              const seatStyle: Record<string, string> = {}
              if (from) {
                seatStyle.transform = `translate(${from.dx}px, ${from.dy}px) scale(0.3)`
                // freeze=burst is a review frame: keep the frozen heads
                // visible at the mouth (otherwise the capture shows an
                // empty strip).
                seatStyle.opacity = freezeBurst ? '1' : '0'
              }
              return (
                <View key={key} className='mechanism-strip__seat' style={seatStyle}>
                  {/* className sizing (SCSS) wins over ArchetypeHead's inline
                      rpx, which the H5 preview drops (BrandLogo pattern). */}
                  <ArchetypeHead
                    archetype={key}
                    size={isShortScreen ? 48 : isMidScreen ? 72 : 80}
                    variant='grid'
                    fallback='none'
                    className='mechanism-strip__head'
                  />
                </View>
              )
            })}
          </View>
          <View className='mechanism-strip__connector' />
          {!failedSprites.has('map-pin') && (
            <Image
              className='mechanism-strip__pin'
              src={MAP_PIN_SPRITE_SRC}
              mode='aspectFit'
              lazyLoad={false}
            />
          )}
        </View>
        {!loggedOutMode && (
          <Text className='mechanism-caption' aria-hidden='true'>
            ① 答小题 · ② 攒一桌 · ③ 见真人
          </Text>
        )}

        {/* Copy: mystery headline + one-line mechanism. The subtitle's three
            beats carry the E2 gold-underline cascade (drawn in sequence).
            loggedOut: welcome-back script — the city remembers you; no
            re-selling, no mechanism explainer. */}
        <View className='hero-text'>
          {loggedOutMode ? (
            <>
              <Text className='headline'>这座城市还亮着，<Text className='headline--accent'>你的位置还留着</Text></Text>
              <Text className='subtitle'>
                {loggedOutMode === 'expired'
                  ? '登录状态已过期，一键登录即可继续'
                  : '微信一键登录，回到你的小局'}
              </Text>
            </>
          ) : (
            <>
              <Text className='headline'>这座城市，为你<Text className='headline--accent'>藏了一局</Text></Text>
              <Text className='subtitle'>
                <Text className='subtitle__beat subtitle__beat--1'>答几道小题，</Text>
                <Text className='subtitle__beat subtitle__beat--2'>悦仔替你攒一桌聊得来的人，</Text>
                <Text className='subtitle__beat subtitle__beat--3'>线下见</Text>
              </Text>
            </>
          )}
        </View>

        {/* Dynamic spacer: collapses on short phones (<700px → null) so the
            fixed CTA stays reachable; mid tier keeps a slimmer 24rpx gap. */}
        <ResponsiveSpacer heightRpx={isMidScreen ? 24 : 64} collapseBelow={700} />
      </View>

      {/* CTA */}
      <View
        className={`bottom-zone ${isAuthLoading && !isAuthTimedOut ? "bottom-zone--gated" : ""}`}
        aria-hidden={isAuthLoading && !isAuthTimedOut ? "true" : undefined}
        aria-busy={isAuthLoading && !isAuthTimedOut ? "true" : undefined}
      >
        {/* Warm auth-hint — tells the user WHY CTAs are briefly disabled */}
        {isAuthLoading && !isAuthTimedOut && (
          <View className='landing-page__auth-hint'>
            <View className='landing-page__auth-spinner' />
            <Text className='landing-page__auth-hint-text'>正在连接服务器，请稍候...</Text>
          </View>
        )}

        <Button
          variant={ctaType === 'loggedOut' ? 'wechat' : 'brand'}
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          loading={ctaType === 'loggedOut' ? isLoggingIn : isPageExiting}
          disabled={isAuthLoading || isOffline}
          onClick={() => {
            landingAnalytics.trackCtaTap({
              ctaType,
              userNextStep,
              hasIncompleteSession,
              blockedByLegal: !hasAcceptedLegal,
              dwellMs: Date.now() - mountedAtRef.current,
              heroReady: heroState !== 'loading',
            })
            fireDwell(ctaType === 'loggedOut' ? 'login_tap' : 'cta_tap')
            if (!hasAcceptedLegal) {
              triggerLegalShake()
              return
            }
            hapticLight()
            if (ctaType === 'loggedOut') {
              landingAnalytics.trackLoggedOutLoginTap({
                authEntry: loggedOutMode ?? 'logout',
                dwellMs: Date.now() - mountedAtRef.current,
              })
              void handleWeChatLogin()
              return
            }
            if (isContinueMode && userNextStep) {
              // Returning from onboarding: resume where they left off.
              // Authenticated users use their server nextStep (including discover).
              setIsPageExiting(true)
              void navigateToMiniProgramNextStep(userNextStep, { mode: 'root' })
                .catch((err) => {
                  logWarn('[LandingPage] Continue to nextStep failed; falling back to personality test', {
                    nextStep: userNextStep,
                    error: err instanceof Error ? err.message : String(err),
                  })
                  navigateWithLegalGate(MINI_PROGRAM_ROUTES.personalityTest)
                })
            } else {
              navigateWithLegalGate(MINI_PROGRAM_ROUTES.personalityTest)
            }
          }}
        >
          {ctaLabel}
        </Button>

        {/* Inline login for returning users — hidden in loggedOut mode,
            where the primary CTA IS the login (one door). */}
        {!loggedOutMode && (
          <View className='landing-page__login-row'>
            <Button
              variant='brand'
              className='landing-page__login-btn'
              disabled={isAuthLoading || isLoggingIn || isPageExiting || isOffline}
              loading={isLoggingIn}
              onClick={() => {
                hapticLight()
                onboardingAnalytics.interaction('login', 'landing_login_clicked')
                fireDwell('login_tap')
                void handleWeChatLogin()
              }}
            >
              已有账号？立即登录
            </Button>
          </View>
        )}

        <View className={`landing-page__legal-row ${shakeLegal ? 'shake' : ''}`}>
          {showLegalHint && (
            <View key={legalHintSeq} className='landing-page__legal-hint' aria-hidden='true'>
              <Text className='landing-page__legal-hint-text'>
                {ctaType === 'new' ? '先勾选协议，再开始测' : ctaType === 'loggedOut' ? '先勾选协议，再登录' : '先勾选协议，再继续'}
              </Text>
            </View>
          )}
          <View
            className={
              "landing-page__legal-checkbox" +
              (hasAcceptedLegal ? " landing-page__legal-checkbox--checked" : "")
            }
            role='checkbox'
            aria-checked={hasAcceptedLegal}
            aria-label='同意用户协议和隐私政策'
            onClick={() => {
              hapticLight()
              setHasAcceptedLegal((current) => {
                if (!current) persistLegalAccepted()
                return !current
              })
              if (legalHintTimerRef.current) {
                clearTimeout(legalHintTimerRef.current)
                legalHintTimerRef.current = null
              }
              setShowLegalHint(false)
            }}
          >
            {hasAcceptedLegal && <View className='landing-page__legal-checkbox-mark' aria-hidden='true' />}
          </View>

          <View className='landing-page__legal-text'>
            <Text>我已阅读并同意</Text>
            <Navigator url={MINI_PROGRAM_ROUTES.terms} className='landing-page__legal-link'>《用户协议》</Navigator>
            <Text>和</Text>
            <Navigator url={`${MINI_PROGRAM_ROUTES.terms}?section=privacy`} className='landing-page__legal-link'>《隐私政策》</Navigator>
          </View>

          <Text aria-live='polite' className='landing-page__sr-only'>
            {shakeLegal ? '请先阅读并同意用户协议和隐私政策' : ''}
          </Text>
        </View>
      </View>

      {/* Offline banner — shown when network is completely unavailable.
          Rendered outside the gated bottom-zone so the retry CTA stays
          tappable. Separate from isAuthTimedOut (slow network) because
          the root cause and remediation are different. */}
      {isOffline && (
        <View className='landing-page__auth-timeout' role='alert' aria-live='polite'>
          <View className='landing-page__auth-timeout-status'>
            <View className='landing-page__auth-timeout-spinner' aria-hidden='true' />
            <Text className='landing-page__auth-timeout-text'>{getErrorForSurface('offline-preflight', 'inline-error')}</Text>
          </View>
          <View className='landing-page__auth-timeout-actions'>
            <View
              className='landing-page__auth-timeout-btn landing-page__auth-timeout-btn--primary'
              hoverClass='landing-page__auth-timeout-btn--hover'
              onClick={() => onAuthRetry?.()}
              role='button'
              aria-label='重新检查网络'
            >
              <Text className='landing-page__auth-timeout-btn-text'>重试</Text>
            </View>
          </View>
        </View>
      )}

      {/* Auth timeout banner — rendered outside the gated bottom-zone so it
          remains tappable even when CTAs are locked. */}
      {isAuthTimedOut && (
        <View className='landing-page__auth-timeout' role='alert' aria-live='polite'>
          <View className='landing-page__auth-timeout-status'>
            <View className='landing-page__auth-timeout-spinner' aria-hidden='true' />
            <Text className='landing-page__auth-timeout-text'>{getErrorForSurface('auth-timeout', 'inline-error')}</Text>
          </View>
          <View className='landing-page__auth-timeout-actions'>
            <View
              className='landing-page__auth-timeout-btn landing-page__auth-timeout-btn--primary'
              hoverClass='landing-page__auth-timeout-btn--hover'
              onClick={() => onAuthRetry?.()}
              role='button'
              aria-label='重试验证'
            >
              <Text className='landing-page__auth-timeout-btn-text'>再试一次</Text>
            </View>
            <View
              className='landing-page__auth-timeout-btn'
              hoverClass='landing-page__auth-timeout-btn--hover'
              onClick={() => onAuthDismiss?.()}
              role='button'
              aria-label='跳过验证继续'
            >
              <Text className='landing-page__auth-timeout-btn-text'>先逛逛</Text>
            </View>
          </View>
        </View>
      )}

    </View>
  )
}
