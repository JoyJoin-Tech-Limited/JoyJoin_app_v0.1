import { View, Text, Image, Navigator } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState } from "react"
import Button from "../../components/Button"
import "./index.scss"

type LandingHeroKey = "match" | "dinner" | "continue"

const heroFallbackSources: Record<LandingHeroKey, string> = {
  match: "/assets/match.png",
  dinner: "/assets/dinner.png",
  continue: "/assets/continue.png",
}

export default function MiniProgramLandingPage() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [heroSources, setHeroSources] = useState<Record<LandingHeroKey, string>>({
    match: "/assets/match.webp",
    dinner: "/assets/dinner.webp",
    continue: "/assets/continue.webp",
  })
  const ctaDisabledClass = hasAcceptedLegal ? "" : " landing-page__cta--disabled"
  const ctaHoverClass = hasAcceptedLegal ? "landing-page__cta-hover" : ""

  const navigateWithLegalGate = (url: string) => {
    if (!hasAcceptedLegal) {
      return
    }

    void Taro.navigateTo({ url })
  }

  const handleHeroError = (key: LandingHeroKey) => {
    setHeroSources((current) => {
      if (current[key] === heroFallbackSources[key]) {
        return current
      }

      return {
        ...current,
        [key]: heroFallbackSources[key],
      }
    })
  }

  return (
    <View className="landing-page">
      <View className="content-zone">
        <View className="logo-container">
          <View className="logo-bg"></View>
          <Image src="/assets/box_logo_archetypes.png" className="logo-img" mode="aspectFit" />
        </View>

        <View className="hero-cards">
          <View className="landing-page__orbit landing-page__orbit--left" />
          <View className="landing-page__orbit landing-page__orbit--right" />

          <View className="card card-left">
            <View className="card-img-wrap">
              <Image
                src={heroSources.match}
                className="card-img"
                mode="aspectFill"
                onError={() => handleHeroError("match")}
              />
            </View>
            <View className="card-text">
              <Text>匹配</Text>
            </View>
          </View>

          <View className="card card-center">
            <View className="card-img-wrap">
              <Image
                src={heroSources.dinner}
                className="card-img"
                mode="aspectFill"
                onError={() => handleHeroError("dinner")}
              />
            </View>
            <View className="card-text">
              <Text>悦聚</Text>
            </View>
          </View>

          <View className="card card-right">
            <View className="card-img-wrap">
              <Image
                src={heroSources.continue}
                className="card-img"
                mode="aspectFill"
                onError={() => handleHeroError("continue")}
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
        </View>
      </View>

      <View className="bottom-zone">
        <Button
          className={"landing-page__cta landing-page__cta--primary" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          disabled={!hasAcceptedLegal}
          onClick={() => navigateWithLegalGate("/pages/onboarding/personality-test/index")}
        >
          看看我会遇见谁
        </Button>

        <Button
          className={"landing-page__cta landing-page__cta--login" + ctaDisabledClass}
          hoverClass={ctaHoverClass}
          disabled={!hasAcceptedLegal}
          onClick={() => navigateWithLegalGate("/pages/login/index")}
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
