import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState, useEffect, useRef } from "react"
import { cdnAsset, localAsset } from "../../lib/utils/cdnAssets"
import { loadBrandDisplayFont } from "../../lib/utils/brandFont"
import Button from "../../components/ui/Button"
import BrandLogo from "../../components/ui/BrandLogo"
import BondingCloud from "../../components/landing/BondingCloud"
import { useStaggerMount } from "../../hooks/useStaggerMount"
import { runMiniProgramRouteTransition } from "../../lib/onboarding/onboardingNavigation"
import { useWeChatLogin } from "../../hooks/auth/useWeChatLogin"
import { onboardingAnalytics } from "../../lib/onboarding/onboardingAnalytics"
import "./index.scss"

/** Phase icons — bundled locally for guaranteed display on landing screen.
 *  (CDN fallback remains for other surfaces; these 6 are critical for first impression.)
 */
const LANDING_PHASE_ICONS: Record<string, string> = {
  'topic-card': localAsset('/assets/landing-phase-icons/phase-topic-card.png'),
  'lie_detective': localAsset('/assets/landing-phase-icons/phase-lie-detective.png'),
  'personality_dice': localAsset('/assets/landing-phase-icons/phase-personality-dice.png'),
  'auction': localAsset('/assets/landing-phase-icons/phase-auction.png'),
  'mini_script': localAsset('/assets/landing-phase-icons/phase-mini-script.png'),
  'quip_battle': localAsset('/assets/landing-phase-icons/phase-quip-battle.png'),
}

/** Mascot — bundled locally for guaranteed display. */
const MASCOT_SRC = localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.png')

export default function MiniProgramLandingPage() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [shakeLegal, setShakeLegal] = useState(false)
  const [mascotSrc, setMascotSrc] = useState(MASCOT_SRC)
  const [mascotError, setMascotError] = useState(false)
  const [phaseIconErrors, setPhaseIconErrors] = useState<Record<string, boolean>>({})
  const isMounted = useStaggerMount()
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin()
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadBrandDisplayFont()
  }, [])

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current)
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
      try {
        await runMiniProgramRouteTransition({
          beforeNavigate: () => setIsPageExiting(true),
          delayMs: 180,
        })
        await Taro.navigateTo({ url })
      } catch {
        setIsPageExiting(false)
      }
    })()
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
          {/* @ts-expect-error Taro TextProps lacks ARIA role typings; WeChat WXML supports it */}
          <Text className="game-preview__title" role="heading" aria-level={3}>6 种破冰玩法，一局解锁</Text>
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
                    className="game-preview__cell-icon"
                    style={{
                      width: '112rpx',
                      height: '112rpx',
                      borderRadius: '24rpx',
                      background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: '48rpx' }}>🎲</Text>
                  </View>
                )}
                <Text className="game-preview__cell-label">{game.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* CTA */}
      <View
        className={`bottom-zone ${isMounted ? "stagger-in stagger-in--4" : "stagger-in-hidden"}`}
      >
        <Button
          variant="brand"
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          loading={isPageExiting}
          onClick={() => {
            if (!hasAcceptedLegal) {
              triggerLegalShake()
              return
            }
            hapticLight()
            navigateWithLegalGate("/pages/onboarding/personality-test/index")
          }}
        >
          测测我的社交氛围
        </Button>

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
            {hasAcceptedLegal && <Text className="landing-page__legal-checkbox-icon">✓</Text>}
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

        {/* Inline login for returning users */}
        <View
          className={`landing-page__login-row ${isMounted ? "stagger-in stagger-in--5" : "stagger-in-hidden"}`}
        >
          <Button
            variant="brand"
            className="landing-page__login-btn"
            disabled={isLoggingIn || isPageExiting}
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
      </View>
    </View>
  )
}
