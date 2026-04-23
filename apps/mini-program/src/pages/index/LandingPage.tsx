import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState } from "react"
import Button from "../../components/Button"
import { MINI_PROGRAM_ROUTES } from "../../lib/onboardingRoutes"
import { getXiaoyueExpressionAsset } from "../../lib/xiaoyueExpressions"
import { runMiniProgramRouteTransition } from "../../lib/onboardingNavigation"
import "./index.scss"

export default function MiniProgramLandingPage() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
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
        <View className="logo-container">
          <View className="logo-aura"></View>
          <Image src="/assets/box_logo_archetypes.png" className="logo-img" mode="aspectFit" />
        </View>

        <View className="hero-cards">
          <View className="landing-page__orbit landing-page__orbit--left" />
          <View className="landing-page__orbit landing-page__orbit--right" />

          <View className="card card-left">
            <View className="card-img-wrap">
              <Image
                src="/assets/match.webp"
                className="card-img"
                mode="aspectFill"
              />
            </View>
            <View className="card-text">
              <Text>匹配</Text>
            </View>
          </View>

          <View className="card card-center">
            <View className="card-img-wrap">
              <Image
                src="/assets/dinner.webp"
                className="card-img"
                mode="aspectFill"
              />
            </View>
            <View className="card-text">
              <Text>悦聚</Text>
            </View>
          </View>

          <View className="card card-right">
            <View className="card-img-wrap">
              <Image
                src="/assets/continue.webp"
                className="card-img"
                mode="aspectFill"
              />
            </View>
            <View className="card-text">
              <Text>延续</Text>
            </View>
          </View>
        </View>

        <View className="text-content">
          <Text className="headline">让对的相遇不再错过</Text>
          <Text className="subtitle">通过氛围测试，找到你的氛围原型，遇见志同道合的ta</Text>
          <View className="badges">
            {["🧠 氛围测试", "🎯 算法匹配", "👥 4-6人局"].map((label) => (
              <View key={label} className="badge">
                <Text>{label}</Text>
              </View>
            ))}
          </View>

          <View className="landing-page__xiaoyue-wrap">
            <Image
              className="landing-page__xiaoyue"
              src={getXiaoyueExpressionAsset("homeWelcome")}
              mode="aspectFit"
            />
            <Text className="landing-page__xiaoyue-caption">小悦在这等你</Text>
          </View>
        </View>
      </View>

      <View className="bottom-zone">
        <Button
          variant="brand"
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          disabled={!hasAcceptedLegal}
          onClick={() => navigateWithLegalGate(MINI_PROGRAM_ROUTES.personalityTest)}
        >
          看看我会遇见谁
        </Button>

        <Button
          variant="brand"
          className={"landing-page__cta landing-page__cta--login" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          disabled={!hasAcceptedLegal}
          onClick={() => navigateWithLegalGate(MINI_PROGRAM_ROUTES.login)}
        >
          已有账号？登录
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
            <Navigator url={MINI_PROGRAM_ROUTES.terms} className="landing-page__legal-link">《用户协议》</Navigator>
            <Text>和</Text>
            <Navigator url={`${MINI_PROGRAM_ROUTES.terms}?section=privacy`} className="landing-page__legal-link">《隐私政策》</Navigator>
          </View>
        </View>

        {!hasAcceptedLegal ? (
          <Text className="landing-page__legal-helper">请先勾选协议后继续测试或登录</Text>
        ) : null}
      </View>
    </View>
  )
}
