import { View, Text, Image, Navigator } from "@tarojs/components"
import { PhaseHeaderIcon } from "../icebreaker-session/phaseUtils"
import Taro from "@tarojs/taro"
import { useState } from "react"
import Button from "../../components/ui/Button"
import BrandLogo from "../../components/ui/BrandLogo"
import BondingCloud from "../../components/landing/BondingCloud"
import { useStaggerMount } from "../../hooks/useStaggerMount"
import { getXiaoyueExpressionAsset } from "../../lib/mascot/xiaoyueExpressions"
import { runMiniProgramRouteTransition } from "../../lib/onboarding/onboardingNavigation"
import "./index.scss"

export default function MiniProgramLandingPage() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [mascotSrc, setMascotSrc] = useState(getXiaoyueExpressionAsset("homeWelcome"))
  const isMounted = useStaggerMount()

  const ctaDisabledClass = hasAcceptedLegal ? "" : " landing-page__cta--disabled"
  const ctaHoverClass = hasAcceptedLegal ? "landing-page__cta-hover" : ""
  const pageClassName = ["landing-page", isPageExiting ? "landing-page--exiting" : ""]
    .filter(Boolean)
    .join(" ")

  const navigateWithLegalGate = (url: string) => {
    if (!hasAcceptedLegal) {
      return
    }

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
          {mascotSrc !== '' ? (
            <Image
              className="hero-mascot"
              src={mascotSrc}
              mode="aspectFit"
              ariaLabel="悦仔"
              onError={() => setMascotSrc('')}
            />
          ) : (
            <View className="hero-mascot-fallback">
              <BrandLogo size="lg" />
            </View>
          )}
          <View className="hero-text">
            <Text className="headline">你的命格里，藏着谁</Text>
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
          <Text className="game-preview__title" role="heading" aria-level={3}>局里可能玩到</Text>
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
                <PhaseHeaderIcon phase={game.phase} size={112} />
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
          disabled={!hasAcceptedLegal}
          loading={isPageExiting}
          onClick={() => navigateWithLegalGate("/pages/onboarding/personality-test/index")}
        >
          测测我的社交 vibe →
        </Button>

        <View className="landing-page__legal-row">
          <View
            className={
              "landing-page__legal-checkbox" +
              (hasAcceptedLegal ? " landing-page__legal-checkbox--checked" : "")
            }
            onClick={() => setHasAcceptedLegal((current) => !current)}
          >
            {hasAcceptedLegal && <Text className="landing-page__legal-checkbox-icon">✓</Text>}
          </View>

          <View className="landing-page__legal-text">
            <Text>我已阅读并同意</Text>
            <Navigator url="/pages/terms/index" className="landing-page__legal-link">《用户协议》</Navigator>
            <Text>和</Text>
            <Navigator url="/pages/terms/index?section=privacy" className="landing-page__legal-link">《隐私政策》</Navigator>
          </View>
        </View>

        {!hasAcceptedLegal ? (
          <Text className="landing-page__legal-helper">请先勾选协议后继续测试或登录</Text>
        ) : null}
      </View>
    </View>
  )
}
