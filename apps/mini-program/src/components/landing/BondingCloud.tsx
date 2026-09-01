import { View, Text } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useEffect, useState } from "react"
import { BRAND_COLORS } from "../../styles/colors"
import { useStaggerMount } from "../../hooks/useStaggerMount"
import "./BondingCloud.scss"
import { getDeviceInfoCompat } from '../../lib/utils/systemInfo'

/* ─── Helpers ──────────────────────────────────────────────────────── */
function hexAlpha(hex: string, alphaPercent: number): string {
  const a = Math.round((alphaPercent / 100) * 255)
    .toString(16)
    .padStart(2, "0")
  return hex + a
}

/* ─── Matching-dimension nodes ─────────────────────────────────────── */
const NODES = [
  {
    id: "personality" as const,
    text: "性格互补",
    x: 15,
    y: 50,
    color: BRAND_COLORS.factorPersonality,
    lineDelay: 0,
  },
  {
    id: "interest" as const,
    text: "兴趣同频",
    x: 50,
    y: 16,
    color: BRAND_COLORS.factorInterest,
    lineDelay: 3,
  },
  {
    id: "background" as const,
    text: "背景多元",
    x: 85,
    y: 50,
    color: BRAND_COLORS.factorTopic,
    lineDelay: 6,
  },
  {
    id: "rapport" as const,
    text: "默契测试",
    x: 50,
    y: 84,
    color: BRAND_COLORS.factorAi,
    lineDelay: 9,
  },
]

/* ─── Component ────────────────────────────────────────────────────── */
export default function BondingCloud({ compact = false }: { compact?: boolean }) {
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isLowEnd, setIsLowEnd] = useState(false)
  const isMounted = useStaggerMount()

  // Detect reduced motion preference + device performance tier
  useEffect(() => {
    try {
      const mq =
        Taro.getApp().config?.window?.prefersReducedMotion ??
        (typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
          : false)
      setReducedMotion(!!mq)
    } catch {
      setReducedMotion(false)
    }

    try {
      const level = (getDeviceInfoCompat().benchmarkLevel ?? -1) as number
      // benchmarkLevel: -1 unknown, 1 low, 50 high
      setIsLowEnd(level >= 0 && level < 20)
    } catch {
      setIsLowEnd(false)
    }
  }, [])

  // Trigger entrance 300ms after mount
  useEffect(() => {
    if (!isMounted || reducedMotion) {
      setEntered(true)
      return
    }
    const t = setTimeout(() => setEntered(true), 300)
    return () => clearTimeout(t)
  }, [isMounted, reducedMotion])

  const showAnimation = entered && !reducedMotion && !isLowEnd

  return (
    <View
      className={[
        "bonding-cloud",
        compact && "bonding-cloud--compact",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Connecting lines with traveling dots */}
      {NODES.map((node) => (
        <View
          key={`line-${node.id}`}
          className={[
            "bonding-line",
            `bonding-line--${node.id}`,
            showAnimation && "bonding-line--active",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <View
            className={[
              "bonding-line__traveler",
              showAnimation && "bonding-line__traveler--active",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ animationDelay: `${node.lineDelay}s` }}
          >
            <View className='bonding-line__traveler-dot' />
          </View>
        </View>
      ))}

      {/* Center hub — the matching core */}
      <View
        className={[
          "bonding-hub",
          showAnimation && "bonding-hub--pulse",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden='true'
      >
        <View className='bonding-hub__core' />
      </View>

      {/* Dimension nodes */}
      {NODES.map((node, index) => (
        <View
          key={node.id}
          className={[
            "bonding-node",
            entered ? "bonding-node--in" : "bonding-node--hidden",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            backgroundColor: hexAlpha(node.color, 8),
            borderColor: hexAlpha(node.color, 20),
            animationDelay: `${index * 0.12}s`,
          }}
          aria-label={node.text}
        >
          <Text
            className='bonding-node__text'
            style={{ color: node.color }}
          >
            {node.text}
          </Text>
        </View>
      ))}
    </View>
  )
}
