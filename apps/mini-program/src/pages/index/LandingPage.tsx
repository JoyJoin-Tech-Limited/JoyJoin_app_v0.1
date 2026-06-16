import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro, { useRouter } from "@tarojs/taro"
import { useState, useEffect, useRef, useMemo } from "react"
import { cdnAsset, localAsset } from "../../lib/utils/cdnAssets"
import { loadBrandDisplayFont } from "../../lib/utils/brandFont"
import Button from "../../components/ui/Button"
import BrandLogo from "../../components/ui/BrandLogo"
import BondingCloud from "../../components/landing/BondingCloud"
import PhaseIconCarousel from "../../components/landing/PhaseIconCarousel"
import { useStaggerMount } from "../../hooks/useStaggerMount"
import { useDeviceTier } from "../../hooks/useDeviceTier"
import { runMiniProgramRouteTransition, navigateToMiniProgramNextStep } from "../../lib/onboarding/onboardingNavigation"
import { MINI_PROGRAM_ROUTES } from "../../lib/onboarding/onboardingRoutes"
import { useWeChatLogin } from "../../hooks/auth/useWeChatLogin"
import { useResetOnShow } from "../../hooks/useResetOnShow"
import { readAnonymousAssessmentSession, isAnonymousAssessmentSessionCompleted } from "../../lib/auth/anonymousOnboarding"
import { onboardingAnalytics } from "../../lib/onboarding/onboardingAnalytics"
import { logWarn } from "../../lib/utils/logger"
import "./index.scss"

/** Phase icons — bundled locally for guaranteed display on landing screen.
 *  (CDN fallback remains for other surfaces; these 6 are critical for first impression.)
 */
const LANDING_PHASE_ICONS: Record<string, string> = {
  'topic-card': localAsset('/assets/landing-phase-icons/phase-topic-card.webp'),
  'lie_detective': localAsset('/assets/landing-phase-icons/phase-lie-detective.webp'),
  'personality_dice': localAsset('/assets/landing-phase-icons/phase-personality-dice.webp'),
  'auction': localAsset('/assets/landing-phase-icons/phase-auction.webp'),
  'mini_script': localAsset('/assets/landing-phase-icons/phase-mini-script.webp'),
  'quip_battle': localAsset('/assets/landing-phase-icons/phase-quip-battle.webp'),
}

/** Mascot — bundled locally for guaranteed display. */
const MASCOT_SRC = localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.png')

interface MiniProgramLandingPageProps {
  isAuthLoading?: boolean
  isAuthTimedOut?: boolean
  onAuthRetry?: () => void
  onAuthDismiss?: () => void
  /** Server-driven nextStep for authenticated returning users. */
  userNextStep?: string | null
}

export default function MiniProgramLandingPage({
  isAuthLoading = false,
  isAuthTimedOut = false,
  onAuthRetry,
  onAuthDismiss,
  userNextStep = null,
}: MiniProgramLandingPageProps) {
  const router = useRouter()
  const invitationCode = router.params.invitationCode ?? ''
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [shakeLegal, setShakeLegal] = useState(false)
  const [mascotSrc, setMascotSrc] = useState(MASCOT_SRC)
  const [mascotError, setMascotError] = useState(false)
  const [phaseIconErrors, setPhaseIconErrors] = useState<Record<string, boolean>>({})
  const [hasIncompleteSession, setHasIncompleteSession] = useState(false)
  const isMounted = useStaggerMount()

  const reduceMotion = useMemo(() => {
    try {
      const mq = (Taro.getApp() as any).config?.window?.prefersReducedMotion
      if (mq != null) return !!mq
    } catch { /* ignore */ }
    try {
      const info = Taro.getSystemInfoSync()
      return !!(info as any).reduceMotion
    } catch {
      return false
    }
  }, [])
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin({
    referralCode: invitationCode || undefined,
  })
  const deviceTier = useDeviceTier()
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadBrandDisplayFont()
    const snapshot = readAnonymousAssessmentSession()
    setHasIncompleteSession(!!snapshot && !isAnonymousAssessmentSessionCompleted(snapshot))
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
  const ctaLabel = useMemo(() => {
    if (!isContinueMode) return '测测我的社交氛围'
    if (userNextStep === 'discover') return '进入发现页'
    if (userNextStep) return '继续完善档案'
    return '继续完成测试'
  }, [isContinueMode, userNextStep])
  const ctaDisabledClass = hasAcceptedLegal ? "" : " landing-page__cta--disabled"
  const ctaHoverClass = hasAcceptedLegal ? "landing-page__cta-hover" : ""
  const pageClassName = ["landing-page", isPageExiting ? "landing-page--exiting" : ""]
    .filter(Boolean)
    .join(" ")

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
      <View className="content-zone">
        {/* Brand watermark */}
        <View
          className={`brand-mark ${isMounted ? "stagger-in stagger-in--0" : "stagger-in-hidden"}`}
        >
          <BrandLogo size="md" />
        </View>

        {/* Hero: mascot + headline */}
        <View
          className={`hero-zone ${isMounted ? "stagger-in stagger-in--1" : "stagger-in-hidden"}`}
        >
          {!mascotError ? (
            <Image
              className="hero-mascot"
              src={mascotSrc}
              mode="aspectFit"
              ariaLabel="悦仔"
              lazyLoad={false}
              onError={() => setMascotError(true)}
            />
          ) : (
            <View className="hero-mascot-fallback">
              <BrandLogo size="lg" />
            </View>
          )}
          <View className="hero-text">
            <Text className="headline">你的<Text className="headline--accent">命格</Text>里，藏着谁</Text>
            <Text className="subtitle">测出你的氛围命格，找到最聊得来的 4-6 人小局</Text>
          </View>
        </View>

        {/* BondingCloud */}
        <View
          className={`bonding-cloud-wrap ${isMounted ? "stagger-in stagger-in--2" : "stagger-in-hidden"}`}
        >
          <BondingCloud />
        </View>

        {/* Game preview */}
        <View
          className={`game-preview ${isMounted ? "stagger-in stagger-in--3" : "stagger-in-hidden"}`}
        >
          <View className="game-preview__title" role="heading" aria-level={3}>
            <View className="game-preview__title-sheen" />
            <View className="game-preview__title-star game-preview__title-star--tl">✦</View>
            <View className="game-preview__title-star game-preview__title-star--tr">✦</View>
            <View className="game-preview__title-star game-preview__title-star--bl">✦</View>
            <View className="game-preview__title-star game-preview__title-star--br">✦</View>
            <Text>氛围引擎 · 10+ 种玩法随局定制</Text>
          </View>
          {reduceMotion || deviceTier.isDegradation ? (
            <View className="game-preview__grid">
              {[
                { phase: 'topic-card' as const, label: '话题卡' },
                { phase: 'lie_detective' as const, label: '谎言侦探' },
                { phase: 'personality_dice' as const, label: '人格骰子' },
                { phase: 'auction' as const, label: '拍卖' },
                { phase: 'mini_script' as const, label: '迷你剧本杀' },
                { phase: 'quip_battle' as const, label: '机智对决' },
              ].map((game, index) => (
                <View
                  key={game.phase}
                  className={`game-preview__cell ${isMounted ? "game-preview__cell--in" : "game-preview__cell--hidden"}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                  aria-label={game.label}
                >
                  {!phaseIconErrors[game.phase] ? (
                    <Image
                      className="game-preview__cell-icon"
                      src={LANDING_PHASE_ICONS[game.phase]}
                      mode="aspectFit"
                      style={{ width: '112rpx', height: '112rpx', verticalAlign: 'middle' }}
                      lazyLoad={false}
                      onError={() => setPhaseIconErrors(prev => ({ ...prev, [game.phase]: true }))}
                    />
                  ) : (
                    <View
                      className="game-preview__cell-icon game-preview__cell-icon--fallback"
                      aria-hidden="true"
                    >
                      <Text className="game-preview__cell-fallback-text">{game.label[0]}</Text>
                    </View>
                  )}
                  <Text className="game-preview__cell-label">{game.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <PhaseIconCarousel isVisible={isMounted} />
          )}
        </View>
      </View>

      {/* CTA */}
      <View
        className={`bottom-zone ${isAuthLoading && !isAuthTimedOut ? "bottom-zone--gated" : ""} ${isMounted ? "stagger-in stagger-in--4" : "stagger-in-hidden"}`}
        aria-hidden={isAuthLoading && !isAuthTimedOut ? "true" : undefined}
        aria-busy={isAuthLoading && !isAuthTimedOut ? "true" : undefined}
      >
        {/* Warm auth-hint — tells the user WHY CTAs are briefly disabled */}
        {isAuthLoading && !isAuthTimedOut && (
          <View className="landing-page__auth-hint">
            <Text className="landing-page__auth-hint-text">悦仔正在确认你的派对身份</Text>
            <View className="landing-page__auth-hint-dots">
              <View className="landing-page__auth-hint-dot" />
              <View className="landing-page__auth-hint-dot" />
              <View className="landing-page__auth-hint-dot" />
            </View>
          </View>
        )}

        <Button
          variant="brand"
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          loading={isPageExiting}
          disabled={isAuthLoading}
          onClick={() => {
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
        <View
          className={`landing-page__login-row ${isMounted ? "stagger-in stagger-in--5" : "stagger-in-hidden"}`}
        >
          <Button
            variant="brand"
            className="landing-page__login-btn"
            disabled={isAuthLoading || isLoggingIn || isPageExiting}
            loading={isLoggingIn}
            onClick={() => {
              hapticLight()
              onboardingAnalytics.interaction('login', 'landing_login_clicked')
              void handleWeChatLogin()
            }}
          >
            已有账号？立即登录
          </Button>
        </View>

        <View className={`landing-page__legal-row ${shakeLegal ? 'shake' : ''}`}>
          <View
            className={
              "landing-page__legal-checkbox" +
              (hasAcceptedLegal ? " landing-page__legal-checkbox--checked" : "")
            }
            role="checkbox"
            aria-checked={hasAcceptedLegal}
            aria-label="同意用户协议和隐私政策"
            onClick={() => {
              hapticLight()
              setHasAcceptedLegal((current) => !current)
            }}
          >
            {hasAcceptedLegal && <View className="landing-page__legal-checkbox-mark" aria-hidden="true" />}
          </View>

          <View className="landing-page__legal-text">
            <Text>我已阅读并同意</Text>
            <Navigator url="/pages/terms/index" className="landing-page__legal-link">《用户协议》</Navigator>
            <Text>和</Text>
            <Navigator url="/pages/terms/index?section=privacy" className="landing-page__legal-link">《隐私政策》</Navigator>
          </View>

          <Text aria-live="polite" className="landing-page__sr-only">
            {shakeLegal ? '请先阅读并同意用户协议和隐私政策' : ''}
          </Text>
        </View>
      </View>

      {/* Auth timeout banner — rendered outside the gated bottom-zone so it
          remains tappable even when CTAs are locked. */}
      {isAuthTimedOut && (
        <View className="landing-page__auth-timeout" role="alert" aria-live="polite">
          <Text className="landing-page__auth-timeout-text">网络有点慢，悦仔帮你再连一次？</Text>
          <View className="landing-page__auth-timeout-actions">
            <View
              className="landing-page__auth-timeout-btn landing-page__auth-timeout-btn--primary"
              hoverClass="landing-page__auth-timeout-btn--hover"
              onClick={() => onAuthRetry?.()}
              role="button"
              aria-label="重试验证"
            >
              <Text className="landing-page__auth-timeout-btn-text">再试一次</Text>
            </View>
            <View
              className="landing-page__auth-timeout-btn"
              hoverClass="landing-page__auth-timeout-btn--hover"
              onClick={() => onAuthDismiss?.()}
              role="button"
              aria-label="跳过验证继续"
            >
              <Text className="landing-page__auth-timeout-btn-text">先逛逛</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
