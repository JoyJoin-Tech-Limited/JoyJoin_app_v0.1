import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro, { useRouter, useDidHide } from "@tarojs/taro"
import { useState, useEffect, useRef, useMemo } from "react"
import { CDN_BASE_URL, cdnAsset, localAsset } from "../../lib/utils/cdnAssets"
import { loadBrandDisplayFont } from "../../lib/utils/brandFont"
import Button from "../../components/ui/Button"
import BrandLogo from "../../components/ui/BrandLogo"
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
import { logWarn } from "../../lib/utils/logger"
import TestLoginSheet from "../../components/dev/TestLoginSheet"
import "./index.scss"

/**
 * Blind-box city hero (2026-07-26 redesign). The master composite
 * (box + golden glow + peeking Xiaoyue) is ONE Lovart image so the lighting
 * stays coherent; the floating elements are separate transparent sprites so
 * the entrance can stagger them. All CDN-delivered; the bundled welcome
 * mascot is the resilience fallback when the CDN hero cannot load.
 */
const HERO_SRC = cdnAsset('/assets/lovart/landing/hero-box-xiaoyue-dusk.webp')
const HERO_LQIP_SRC = cdnAsset('/assets/lovart/landing/hero-box-xiaoyue-dusk-lqip.webp')
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
type LandingCtaType = 'new' | 'continue' | 'discover'

const HERO_SRC_TYPE: 'local' | 'cdn' = CDN_BASE_URL ? 'cdn' : 'local'

/** Same window-height probe pattern as ResponsiveSpacer (not exported there). */
function readWindowHeightPx(): number {
  try {
    const wi = Taro.getWindowInfo?.()
    if (wi && typeof wi.windowHeight === 'number') return wi.windowHeight
  } catch {
    /* ignore */
  }
  try {
    const s = Taro.getSystemInfoSync()
    if (typeof s.windowHeight === 'number') return s.windowHeight
  } catch {
    /* ignore */
  }
  return 9999
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
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [shakeLegal, setShakeLegal] = useState(false)
  const [heroState, setHeroState] = useState<HeroState>('loading')
  const [lqipGone, setLqipGone] = useState(false)
  const [failedSprites, setFailedSprites] = useState<ReadonlySet<HeroSpriteKey>>(new Set())
  const [hasIncompleteSession, setHasIncompleteSession] = useState(false)
  const [showTestLogin, setShowTestLogin] = useState(false)
  const [envVersion, setEnvVersion] = useState<string | null>(null)
  const [isShortScreen, setIsShortScreen] = useState(false)
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const isMounted = useStaggerMount()
  const { isDegradation } = useDeviceTier()

  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin({
    referralCode: invitationCode || undefined,
  })
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Mount timestamp — dwell + hero-duration measurements anchor here. */
  const mountedAtRef = useRef(Date.now())
  const networkTypeRef = useRef('unknown')
  const dwellFiredRef = useRef(false)

  useEffect(() => {
    loadBrandDisplayFont()
    const snapshot = readAnonymousAssessmentSession()
    setHasIncompleteSession(!!snapshot && !isAnonymousAssessmentSessionCompleted(snapshot))
    setIsShortScreen(readWindowHeightPx() < 640)
    try {
      const info = Taro.getAccountInfoSync()
      setEnvVersion(info?.miniProgram?.envVersion ?? null)
    } catch {
      // Some Taro versions may throw — ignore.
    }
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
      if (navSafetyTimeoutRef.current) {
        clearTimeout(navSafetyTimeoutRef.current)
      }
    }
  }, [])

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
  const ctaType: LandingCtaType = !isContinueMode ? 'new' : userNextStep === 'discover' ? 'discover' : 'continue'
  const ctaLabel = useMemo(() => {
    if (ctaType === 'new') return '拆开我的盲盒'
    if (ctaType === 'discover') return '进入发现页'
    return '继续开盒'
  }, [ctaType])
  const ctaDisabledClass = hasAcceptedLegal ? "" : " landing-page__cta--disabled"
  const ctaHoverClass = hasAcceptedLegal ? "landing-page__cta-hover" : ""
  const pageClassName = [
    "landing-page",
    isPageExiting ? "landing-page--exiting" : "",
    isShortScreen ? "landing-page--short" : "",
    isDegradation ? "landing-page--low-end" : "",
    reduceMotion ? "landing-page--rm" : "",
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

  // Unmount the LQIP right after its fade-out completes (no DOM residue).
  useEffect(() => {
    if (heroState !== 'ready') return
    const timer = setTimeout(() => setLqipGone(true), 250)
    return () => clearTimeout(timer)
  }, [heroState])

  const handleHeroLoad = () => {
    if (heroState !== 'loading') return
    setHeroState('ready')
    landingAnalytics.trackHeroAsset({
      asset: 'hero-box-xiaoyue-dusk',
      result: 'success',
      srcType: HERO_SRC_TYPE,
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
  }

  const handleHeroError = () => {
    if (heroState !== 'loading') return
    setHeroState('fallback')
    landingAnalytics.trackHeroAsset({
      asset: 'hero-box-xiaoyue-dusk',
      result: 'error',
      srcType: HERO_SRC_TYPE,
      durationMs: Date.now() - mountedAtRef.current,
      networkType: networkTypeRef.current,
    })
    logWarn('[LandingPage] hero image failed, using bundled mascot fallback', {
      src: HERO_SRC,
      networkType: networkTypeRef.current,
    })
  }

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
      srcType: HERO_SRC_TYPE,
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
    hapticLight()
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
    shakeTimerRef.current = setTimeout(() => setShakeLegal(false), 400)
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
          <BrandLogo size='sm' className='landing-page__brand-logo' />
        </View>

        {/* Hero stage: glowing blind box + peeking Xiaoyue + floating elements */}
        <View className='hero-zone'>
          <View className='hero-stage'>
            <View className='hero-stage__scale'>
              <View className='hero-stage__halo' aria-hidden='true'>
                <View className='hero-stage__halo-core' />
              </View>

              <View className='hero-stage__particles' aria-hidden='true'>
                <View className='hero-stage__particle hero-stage__particle--1' />
                <View className='hero-stage__particle hero-stage__particle--2' />
                <View className='hero-stage__particle hero-stage__particle--3' />
              </View>

              {/* City skyline sits behind the hero composite */}
              {renderSprite('buildings')}

              {/* Blur-up placeholder: same geometry as the hero, fades out on
                  load and unmounts right after the fade (no DOM residue). */}
              {heroState !== 'fallback' && !lqipGone && (
                <View
                  className={`hero-stage__lqip${heroState === 'ready' ? ' hero-stage__lqip--out' : ''}`}
                  aria-hidden='true'
                >
                  <Image
                    className='hero-stage__lqip-img'
                    src={HERO_LQIP_SRC}
                    mode='aspectFit'
                    lazyLoad={false}
                    onError={() => {
                      /* the dusk gradient skeleton underneath is enough */
                    }}
                  />
                </View>
              )}

              <View className='hero-stage__breath'>
                {heroState !== 'fallback' ? (
                  <Image
                    className={`hero-stage__hero-img${heroState === 'ready' ? ' hero-stage__hero-img--in' : ''}`}
                    src={HERO_SRC}
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

              {/* Floating elements: dinner/game line + city-exploration line */}
              {renderSprite('cards')}
              {renderSprite('map-pin')}
              {renderSprite('dice')}
              {renderSprite('glass')}
            </View>
          </View>
        </View>

        {/* Copy: mystery headline + one-line mechanism */}
        <View className='hero-text'>
          <Text className='headline'>这座城市，为你<Text className='headline--accent'>藏了一局</Text></Text>
          <Text className='subtitle'>答几道小题，悦仔替你攒一桌聊得来的人</Text>
        </View>

        {/* Dynamic spacer: disappears on short phones so the fixed CTA stays reachable */}
        <ResponsiveSpacer heightRpx={64} collapseBelow={640} />
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
          variant='brand'
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          loading={isPageExiting}
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
            fireDwell('cta_tap')
            if (!hasAcceptedLegal) {
              triggerLegalShake()
              return
            }
            hapticLight()
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

        {/* Inline login for returning users */}
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

        {/* Test login entry — visible only on 体验版 (temp) builds */}
        {envVersion === 'trial' && (
          <View className='landing-page__test-login-row'>
            <View
              className='landing-page__test-login-link'
              onClick={() => {
                hapticLight()
                setShowTestLogin(true)
              }}
              hoverClass='landing-page__test-login-link--hover'
              role='button'
              aria-label='测试账号登录'
            >
              <Text className='landing-page__test-login-link-text'>测试账号登录</Text>
            </View>
          </View>
        )}

        <View className={`landing-page__legal-row ${shakeLegal ? 'shake' : ''}`}>
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
              setHasAcceptedLegal((current) => !current)
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
            <Text className='landing-page__auth-timeout-text'>网络已断开，请检查连接后重试</Text>
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
            <Text className='landing-page__auth-timeout-text'>网络请求超时，请稍后再试</Text>
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

      <TestLoginSheet
        visible={showTestLogin}
        onClose={() => setShowTestLogin(false)}
      />
    </View>
  )
}
