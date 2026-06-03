import { View, Text, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { localAsset } from "../../lib/utils/cdnAssets"

export interface PhaseIconCarouselProps {
  isVisible: boolean
}

interface PhaseDef {
  key: string
  label: string
  slogan: string
  icon: string
}

const PHASES: PhaseDef[] = [
  {
    key: "topic-card",
    label: "话题卡",
    slogan: "百无禁忌，聊到心底",
    icon: localAsset("/assets/landing-phase-icons/phase-topic-card.png"),
  },
  {
    key: "lie_detective",
    label: "谎言侦探",
    slogan: "真假难辨，谁最会演",
    icon: localAsset("/assets/landing-phase-icons/phase-lie-detective.png"),
  },
  {
    key: "personality_dice",
    label: "人格骰子",
    slogan: "掷出你的隐藏面",
    icon: localAsset("/assets/landing-phase-icons/phase-personality-dice.png"),
  },
  {
    key: "auction",
    label: "拍卖",
    slogan: "敢押上全部筹码吗",
    icon: localAsset("/assets/landing-phase-icons/phase-auction.png"),
  },
  {
    key: "mini_script",
    label: "迷你剧本杀",
    slogan: "5分钟全员入戏",
    icon: localAsset("/assets/landing-phase-icons/phase-mini-script.png"),
  },
  {
    key: "quip_battle",
    label: "机智对决",
    slogan: "妙语连珠，接招吧",
    icon: localAsset("/assets/landing-phase-icons/phase-quip-battle.png"),
  },
]

/* ─── Helpers ──────────────────────────────────────────────────────── */
function checkReducedMotion(): boolean {
  try {
    const mq =
      (Taro.getApp() as any).config?.window?.prefersReducedMotion ??
      (typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false)
    return !!mq
  } catch {
    return false
  }
}

function checkIsLowEnd(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    const level = (info.benchmarkLevel ?? -1) as number
    return level >= 0 && level < 20
  } catch {
    return false
  }
}

/* ─── Component ────────────────────────────────────────────────────── */
export default function PhaseIconCarousel({ isVisible }: PhaseIconCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [hasBorn, setHasBorn] = useState(false)
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({})
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accessibility + performance tier detection
  const { reducedMotion, isLowEnd } = useMemo(() => {
    return {
      reducedMotion: checkReducedMotion(),
      isLowEnd: checkIsLowEnd(),
    }
  }, [])

  // Don't render for reduced-motion or low-end users
  // (LandingPage falls back to static grid)
  if (reducedMotion || isLowEnd) return null

  // Birth animation: icons spread from center
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setHasBorn(true), 200)
      return () => clearTimeout(timer)
    }
    setHasBorn(false)
  }, [isVisible])

  // Auto-play with organic, unpredictable intervals
  useEffect(() => {
    if (!isPlaying || !hasBorn) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const scheduleNext = () => {
      // Organic rhythm: 1.3–2.6s, weighted toward shorter pauses
      const delay = 1300 + Math.random() * 1300
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % PHASES.length)
        scheduleNext()
      }, delay)
    }

    scheduleNext()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isPlaying, hasBorn])

  const togglePlay = useCallback(() => {
    try {
      Taro.vibrateShort({ type: "light" })
    } catch {
      /* ignore unsupported devices */
    }
    setIsPlaying(prev => !prev)
  }, [])

  const getPosIndex = (itemIndex: number) => {
    if (!hasBorn) return -1
    return (itemIndex - currentIndex + PHASES.length) % PHASES.length
  }

  const currentPhase = PHASES[currentIndex]

  return (
    <View
      className={`phase-carousel ${!isPlaying ? "phase-carousel--paused" : ""}`}
      onClick={togglePlay}
      aria-label="破冰玩法轮盘，点击暂停或继续"
    >
      {/* Turntable track */}
      <View className="phase-carousel__track">
        {PHASES.map((phase, i) => {
          const pos = getPosIndex(i)
          const posClass =
            pos === -1
              ? "phase-carousel__item--birth"
              : `phase-carousel__item--pos-${pos}`

          return (
            <View
              key={phase.key}
              className={`phase-carousel__item ${posClass}`}
              aria-hidden={pos !== 0}
            >
              {!iconErrors[phase.key] ? (
                <Image
                  className="phase-carousel__item-img"
                  src={phase.icon}
                  mode="aspectFit"
                  lazyLoad={false}
                  onError={() =>
                    setIconErrors(prev => ({ ...prev, [phase.key]: true }))
                  }
                />
              ) : (
                <View className="phase-carousel__item-fallback">
                  <Text className="phase-carousel__item-fallback-emoji">🎲</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* Active phase info */}
      <View className="phase-carousel__info" aria-live="polite">
        <Text className="phase-carousel__label">{currentPhase.label}</Text>
        <Text className="phase-carousel__slogan">{currentPhase.slogan}</Text>
      </View>

      {/* Dot indicators */}
      <View className="phase-carousel__dots">
        {PHASES.map((_, i) => (
          <View
            key={i}
            className={`phase-carousel__dot ${i === currentIndex ? "phase-carousel__dot--active" : ""}`}
          />
        ))}
      </View>

      {/* Pause indicator overlay */}
      {!isPlaying && (
        <View className="phase-carousel__pause-indicator">
          <View className="phase-carousel__play-circle">
            <Text className="phase-carousel__play-triangle">▶</Text>
          </View>
          <Text className="phase-carousel__pause-hint">点击继续</Text>
        </View>
      )}
    </View>
  )
}
