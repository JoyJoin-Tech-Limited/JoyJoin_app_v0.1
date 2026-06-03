import { View, Text, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { localAsset } from "../../lib/utils/cdnAssets"
import { onboardingAnalytics } from "../../lib/onboarding/onboardingAnalytics"

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
      false
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

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ─── Component ────────────────────────────────────────────────────── */
export default function PhaseIconCarousel({ isVisible }: PhaseIconCarouselProps) {
  const [phases, setPhases] = useState<PhaseDef[]>(PHASES)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [hasBorn, setHasBorn] = useState(false)
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({})
  const [direction, setDirection] = useState<1 | -1>(1)
  const [showHint, setShowHint] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const cycleCountRef = useRef(0)

  // Accessibility + performance tier detection
  const { reducedMotion, isLowEnd } = useMemo(() => {
    return {
      reducedMotion: checkReducedMotion(),
      isLowEnd: checkIsLowEnd(),
    }
  }, [])

  // Don't render for reduced-motion or low-end users
  if (reducedMotion || isLowEnd) return null

  const allIconsFailed = Object.keys(iconErrors).length >= phases.length

  // Birth animation: icons spread from center
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setHasBorn(true), 200)
      return () => clearTimeout(timer)
    }
    setHasBorn(false)
  }, [isVisible])

  // Hint auto-dismiss
  useEffect(() => {
    if (hasBorn && showHint) {
      hintTimerRef.current = setTimeout(() => setShowHint(false), 4500)
      return () => {
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      }
    }
  }, [hasBorn, showHint])

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
      const delay = 1300 + Math.random() * 1300
      timeoutRef.current = setTimeout(() => {
        advanceBy(direction)
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
  }, [isPlaying, hasBorn, direction, phases.length])

  const advanceBy = useCallback(
    (dir: 1 | -1) => {
      setCurrentIndex(prev => {
        const next = (prev + dir + phases.length) % phases.length
        // Track cycle completion for shuffle
        if (next === 0) {
          cycleCountRef.current += 1
          // Shuffle every 2 complete cycles for fresh surprise
          if (cycleCountRef.current >= 2) {
            cycleCountRef.current = 0
            setPhases(prevPhases => {
              const currentItem = prevPhases[prev]
              const others = prevPhases.filter((_, i) => i !== prev)
              const shuffled = shuffleArray(others)
              const nextPhases = [...shuffled]
              nextPhases.splice(prev, 0, currentItem)
              return nextPhases
            })
          }
        }
        // 20% chance to flip direction
        if (Math.random() < 0.2) {
          setDirection(d => (d === 1 ? -1 : 1))
        }
        // Light haptic
        try {
          Taro.vibrateShort({ type: "light" })
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [phases.length]
  )

  const togglePlay = useCallback(() => {
    try {
      Taro.vibrateShort({ type: "light" })
    } catch {
      /* ignore */
    }
    setIsPlaying(prev => {
      const next = !prev
      onboardingAnalytics.interaction(
        "login",
        next ? "carousel_resumed" : "carousel_paused",
        { phase: phases[currentIndex].key }
      )
      return next
    })
  }, [currentIndex, phases])

  // Swipe handlers
  const onTouchStart = useCallback((e: any) => {
    const touch = e.touches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
    setIsDragging(true)
  }, [])

  const onTouchEnd = useCallback(
    (e: any) => {
      setIsDragging(false)
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = touch.clientY - touchStartY.current

      // Ignore vertical scrolls
      if (Math.abs(deltaY) > Math.abs(deltaX)) return

      const SWIPE_THRESHOLD = 40
      if (deltaX < -SWIPE_THRESHOLD) {
        // Swipe left → advance forward
        advanceBy(1)
        onboardingAnalytics.interaction("login", "carousel_swipe_left", {
          phase: phases[currentIndex].key,
        })
      } else if (deltaX > SWIPE_THRESHOLD) {
        // Swipe right → go back
        advanceBy(-1)
        onboardingAnalytics.interaction("login", "carousel_swipe_right", {
          phase: phases[currentIndex].key,
        })
      }
    },
    [advanceBy, currentIndex, phases]
  )

  const getPosIndex = (itemIndex: number) => {
    if (!hasBorn) return -1
    const rawPos = (itemIndex - currentIndex + phases.length) % phases.length
    if (direction === -1) {
      if (rawPos === 0) return 0
      if (rawPos === 1) return 5
      if (rawPos === 2) return 4
      if (rawPos === 3) return 3
      if (rawPos === 4) return 2
      if (rawPos === 5) return 1
    }
    return rawPos
  }

  const currentPhase = phases[currentIndex]

  // Unified fallback when every icon fails to load
  if (allIconsFailed) {
    return (
      <View className="phase-carousel phase-carousel--fallback">
        <View className="phase-carousel__fallback-inner">
          <Text className="phase-carousel__fallback-emoji">🎲</Text>
          <Text className="phase-carousel__fallback-label">6 种破冰玩法</Text>
          <Text className="phase-carousel__fallback-sublabel">话题卡 · 谎言侦探 · 人格骰子 · 拍卖 · 迷你剧本杀 · 机智对决</Text>
        </View>
      </View>
    )
  }

  return (
    <View
      className={[
        "phase-carousel",
        !isPlaying ? "phase-carousel--paused" : "",
        isDragging ? "phase-carousel--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={togglePlay}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label="破冰玩法轮盘，点击暂停，左右滑动切换"
    >
      {/* First-use hint */}
      {showHint && hasBorn && (
        <View className="phase-carousel__hint">
          <Text className="phase-carousel__hint-text">点击暂停 · 左右滑动切换</Text>
        </View>
      )}

      {/* Turntable track */}
      <View className="phase-carousel__track">
        {phases.map((phase, i) => {
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
                  <Text className="phase-carousel__item-fallback-icon">?</Text>
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
        {phases.map((_, i) => (
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
