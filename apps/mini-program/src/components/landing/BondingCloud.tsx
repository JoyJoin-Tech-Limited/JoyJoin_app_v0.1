import { View, Text, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useMemo, useState } from "react"
import "./BondingCloud.scss"

// ─── JoyJoin Brand Palette for AI Cloud ───────────────────────────
const BRAND_COLORS = [
  "#8B5CF6", // Vibrant Purple — AI / magic
  "#FF9B85", // Warm Coral — human warmth
  "#A8C5DD", // Sky Blue — trust / calm
  "#9ACD32", // Fresh Green — growth / connection
  "#F5F1E8", // Warm Beige — soft accent
]

// ─── Cycling Bonding Factors ──────────────────────────────────────
// These represent the proprietary matching dimensions + AI icebreaking
const BONDING_FACTORS = [
  { label: "兴趣契合", color: "#FF9B85" },
  { label: "性格互补", color: "#8B5CF6" },
  { label: "AI 破冰", color: "#9ACD32" },
  { label: "惊喜话题", color: "#A8C5DD" },
  { label: "氛围共振", color: "#F5B75F" },
]

// ─── Game Toolkit Items (decorative) ──────────────────────────────
// Maps to existing phase-icon assets in the mini-program.
// 话题卡 has no dedicated asset yet — uses a placeholder icon path.
const FALLBACK_ICON = "/assets/icons/phase-icons/phase-warmup.webp"

const GAME_TOOLKIT = [
  {
    key: "topic_card",
    label: "话题卡",
    icon: "/assets/icons/phase-icons/phase-topic-card.webp",
  },
  {
    key: "undercover",
    label: "谁是卧底",
    icon: "/assets/icons/phase-icons/phase-undercover-word.webp",
  },
  {
    key: "personality_dice",
    label: "性格骰子",
    icon: "/assets/icons/phase-icons/phase-personality-dice.webp",
  },
  {
    key: "micro_challenge",
    label: "微挑战",
    icon: "/assets/icons/phase-icons/phase-micro-challenge.webp",
  },
  {
    key: "mini_script",
    label: "迷你剧本杀",
    icon: "/assets/icons/phase-icons/phase-mini-script.webp",
  },
]

// ─── SVG ViewBox Dimensions ───────────────────────────────────────
const VB_WIDTH = 400
const VB_HEIGHT = 200

interface DotSpec {
  id: number
  cx: number
  cy: number
  r: number
  fill: string
  opacity: number
  pulseDur: number
  floatDur: number
  floatDist: number
}

/**
 * BondingCloud — Landing-page visual showcase for AI matching + icebreaking.
 *
 * • SVG particle field (TasteCloud adaptation) with SMIL float/pulse
 * • Device-aware dot count — degrades gracefully on low-end hardware
 * • Cycling "bonding factor" pills overlaid on the cloud
 * • Decorative game toolkit strip below (话题卡, 卧底, 骰子, 微挑战, 剧本杀)
 */
export default function BondingCloud() {
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set())

  // Device-tier aware dot generation (stable per mount)
  const dots = useMemo<DotSpec[]>(() => {
    let count = 80
    let enableFloat = true

    try {
      const info = Taro.getSystemInfoSync()
      const bench = (info as { benchmarkLevel?: number }).benchmarkLevel ?? 0
      if (bench < 10) {
        count = 20
        enableFloat = false
      } else if (bench < 20) {
        count = 40
      }
    } catch {
      // Fallback to default count if API unavailable
    }

    return Array.from({ length: count }, (_, i) => {
      const baseOpacity = 0.3 + Math.random() * 0.7
      return {
        id: i,
        cx: 40 + Math.random() * (VB_WIDTH - 80),
        cy: 20 + Math.random() * (VB_HEIGHT - 40),
        r: 2 + Math.random() * 4,
        fill: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)],
        opacity: baseOpacity,
        pulseDur: 2 + Math.random() * 3,
        floatDur: 3 + Math.random() * 4,
        floatDist: enableFloat ? 3 + Math.random() * 5 : 0,
      }
    })
  }, [])

  return (
    <View className="bonding-cloud">
      {/* ── Particle Cloud ───────────────────────────────────────── */}
      <View className="bonding-cloud__canvas">
        <svg
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          className="bonding-cloud__svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={dot.fill}
              opacity={dot.opacity}
            >
              {/* Opacity pulse — always enabled */}
              <animate
                attributeName="opacity"
                values={`${dot.opacity};${dot.opacity * 0.35};${dot.opacity}`}
                dur={`${dot.pulseDur}s`}
                repeatCount="indefinite"
              />
              {/* Vertical float — disabled on low-end devices */}
              {dot.floatDist > 0 && (
                <animate
                  attributeName="cy"
                  values={`${dot.cy};${dot.cy - dot.floatDist};${dot.cy}`}
                  dur={`${dot.floatDur}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </svg>

        {/* Cycling factor pills, centered over the cloud */}
        <View className="bonding-cloud__pills">
          {BONDING_FACTORS.map((factor, idx) => (
            <View
              key={factor.label}
              className="bonding-cloud__pill"
              style={{
                animationDelay: `${idx * 2.5}s`,
                backgroundColor: `${factor.color}18`, // 10% opacity hex
                borderColor: `${factor.color}36`,     // 21% opacity hex
              }}
            >
              <Text
                className="bonding-cloud__pill-text"
                style={{ color: factor.color }}
              >
                {factor.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Game Toolkit Strip (decorative) ──────────────────────── */}
      <View className="bonding-cloud__toolkit">
        <View className="bonding-cloud__toolkit-header">
          <View className="bonding-cloud__sparkle" />
          <Text className="bonding-cloud__toolkit-label">AI 破冰工具箱</Text>
        </View>

        <View className="bonding-cloud__toolkit-row">
          {GAME_TOOLKIT.map((game) => (
            <View key={game.key} className="bonding-cloud__toolkit-item">
              <View className="bonding-cloud__toolkit-icon-wrap">
                <Image
                  src={failedIcons.has(game.key) ? FALLBACK_ICON : game.icon}
                  className="bonding-cloud__toolkit-icon"
                  mode="aspectFit"
                  lazyLoad
                  onError={() =>
                    setFailedIcons((prev) => new Set(prev).add(game.key))
                  }
                />
              </View>
              <Text className="bonding-cloud__toolkit-name">{game.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
