import { View, Text, Image } from "@tarojs/components"
import Taro, { useDidHide } from "@tarojs/taro"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { localAsset } from "../../lib/utils/cdnAssets"
import { logInfo, logWarn } from "../../lib/utils/logger"
import { onboardingAnalytics } from "../../lib/onboarding/onboardingAnalytics"
import "./PhaseIconCarousel.scss"

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
  { key: "topic-card", label: "话题卡", slogan: "百无禁忌，聊到心底", icon: localAsset("/assets/landing-phase-icons/phase-topic-card.webp") },
  { key: "lie_detective", label: "谎言侦探", slogan: "真假难辨，谁最会演", icon: localAsset("/assets/landing-phase-icons/phase-lie-detective.webp") },
  { key: "personality_dice", label: "人格骰子", slogan: "掷出你的隐藏面", icon: localAsset("/assets/landing-phase-icons/phase-personality-dice.webp") },
  { key: "auction", label: "拍卖", slogan: "敢押上全部筹码吗", icon: localAsset("/assets/landing-phase-icons/phase-auction.webp") },
  { key: "mini_script", label: "迷你剧本杀", slogan: "5分钟全员入戏", icon: localAsset("/assets/landing-phase-icons/phase-mini-script.webp") },
  { key: "quip_battle", label: "机智对决", slogan: "妙语连珠，接招吧", icon: localAsset("/assets/landing-phase-icons/phase-quip-battle.webp") },
]

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
  const lastToggleRef = useRef(0)
  const resetTimerRef = useRef<() => void>(() => {})

  // Refs for stable analytics access (avoid stale closures on rapid interaction)
  const currentIndexRef = useRef(currentIndex)
  const phasesRef = useRef(phases)
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { phasesRef.current = phases }, [phases])

  useEffect(() => {
    if (isVisible) {
      // Birth animation starts immediately; parent stagger mount already gates visibility
      setHasBorn(true)
      return
    }
    setHasBorn(false)
    cycleCountRef.current = 0
  }, [isVisible])

  // WeChat page-hide cleanup: clear all timers when user backgrounds the mini-program
  useDidHide(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null }
  })

  useEffect(() => {
    if (hasBorn && showHint) {
      hintTimerRef.current = setTimeout(() => setShowHint(false), 4500)
      return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current) }
    }
  }, [hasBorn, showHint])

  // Auto-advance timer — self-scheduling inside callback to avoid effect churn.
  // resetTimerRef allows user interaction to restart the interval without re-running the effect.
  useEffect(() => {
    if (!isPlaying || !hasBorn) {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      return
    }
    const scheduleNext = () => {
      const delay = 1300 + Math.random() * 1300
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex(prev => {
          const next = (prev + direction + phases.length) % phases.length
          // Only count cycles when moving forward; reverse steps are not full cycles
          if (direction === 1 && next === 0) {
            cycleCountRef.current += 1
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
          if (Math.random() < 0.2) setDirection(d => (d === 1 ? -1 : 1))
          try { Taro.vibrateShort({ type: "light" }) } catch { /* ignore */ }
          return next
        })
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    resetTimerRef.current = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      scheduleNext()
    }
    return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null } }
  }, [isPlaying, hasBorn, direction, phases.length])

  const containerClassName = useMemo(() =>
    ["phase-carousel", !isPlaying ? "phase-carousel--paused" : "", isDragging ? "phase-carousel--dragging" : ""]
      .filter(Boolean)
      .join(" "),
  [isPlaying, isDragging])

  const togglePlay = useCallback(() => {
    // Debounce rapid taps (300 ms)
    const now = Date.now()
    if (now - lastToggleRef.current < 300) return
    lastToggleRef.current = now

    try { Taro.vibrateShort({ type: "light" }) } catch { /* ignore */ }
    setIsPlaying(prev => {
      const next = !prev
      const idx = currentIndexRef.current
      onboardingAnalytics.interaction("login", next ? "carousel_resumed" : "carousel_paused", { phase: phasesRef.current[idx].key })
      return next
    })
  }, [])

  const onTouchStart = useCallback((e: any) => {
    const touch = e.touches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
    setIsDragging(true)
  }, [])

  const onTouchEnd = useCallback((e: any) => {
    setIsDragging(false)
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartX.current
    const deltaY = touch.clientY - touchStartY.current
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    const SWIPE_THRESHOLD = 40
    const idx = currentIndexRef.current
    const currentPhases = phasesRef.current
    if (deltaX < -SWIPE_THRESHOLD) {
      setCurrentIndex(prev => (prev + 1 + currentPhases.length) % currentPhases.length)
      onboardingAnalytics.interaction("login", "carousel_swipe_left", { phase: currentPhases[idx].key })
      try { Taro.vibrateShort({ type: "light" }) } catch { /* ignore */ }
      resetTimerRef.current()
    } else if (deltaX > SWIPE_THRESHOLD) {
      setCurrentIndex(prev => (prev - 1 + currentPhases.length) % currentPhases.length)
      onboardingAnalytics.interaction("login", "carousel_swipe_right", { phase: currentPhases[idx].key })
      try { Taro.vibrateShort({ type: "light" }) } catch { /* ignore */ }
      resetTimerRef.current()
    }
  }, [])

  const onTouchCancel = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleIconError = useCallback((key: string) => {
    setIconErrors(prev => ({ ...prev, [key]: true }))
  }, [])

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

  return (
    <View
      className={containerClassName}
      onClick={togglePlay}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      role="button"
      aria-label="破冰玩法轮盘，点击暂停，左右滑动切换"
    >
      <View className="phase-carousel__asset-preload" aria-hidden>
        <Image src="/assets/landing-phase-icons/phase-topic-card.webp" />
        <Image src="/assets/landing-phase-icons/phase-lie-detective.webp" />
        <Image src="/assets/landing-phase-icons/phase-personality-dice.webp" />
        <Image src="/assets/landing-phase-icons/phase-auction.webp" />
        <Image src="/assets/landing-phase-icons/phase-mini-script.webp" />
        <Image src="/assets/landing-phase-icons/phase-quip-battle.webp" />
      </View>
      {showHint && hasBorn && (
        <View className="phase-carousel__hint">
          <Text className="phase-carousel__hint-text">点击暂停 · 左右滑动切换</Text>
        </View>
      )}
      <View className="phase-carousel__track">
        {phases.map((phase, i) => {
          const pos = getPosIndex(i)
          const posClass = pos === -1 ? "phase-carousel__item--birth" : `phase-carousel__item--pos-${pos}`
          return (
            <View key={phase.key} className={`phase-carousel__item ${posClass}`} aria-hidden={pos !== 0}>
              {!iconErrors[phase.key] ? (
                <Image className="phase-carousel__item-img" src={phase.icon} mode="aspectFit" lazyLoad={false}
                  {...{ alt: phase.label } as any}
                  onLoad={() => {
                    logInfo('[PhaseIconCarousel] phase icon loaded', { phase: phase.key, src: phase.icon })
                  }}
                  onError={() => {
                    void Taro.getNetworkType().then((res) => {
                      const ctx = {
                        phase: phase.key,
                        src: phase.icon,
                        networkType: res.networkType,
                        env: process.env.NODE_ENV,
                        cdnBase: process.env.TARO_APP_CDN_BASE_URL || '(none)',
                      }
                      logWarn('[PhaseIconCarousel] phase icon load failed', ctx)
                      // eslint-disable-next-line no-console
                      console.warn('[PhaseIconCarousel] phase icon load failed', ctx)
                    })
                    handleIconError(phase.key)
                  }} />
              ) : (
                <View className="phase-carousel__item-fallback">
                  <Text className="phase-carousel__item-fallback-icon">{phase.label}</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
      <View className="phase-carousel__info" aria-live="polite">
        <Text className="phase-carousel__label">{currentPhase.label}</Text>
        <Text className="phase-carousel__slogan">{currentPhase.slogan}</Text>
      </View>
      <View className="phase-carousel__dots">
        {phases.map((_, i) => (
          <View key={i} className={`phase-carousel__dot ${i === currentIndex ? "phase-carousel__dot--active" : ""}`} />
        ))}
      </View>
      {!isPlaying && (
        <View className="phase-carousel__pause-indicator">
          <View className="phase-carousel__play-circle"><Text className="phase-carousel__play-triangle">▶</Text></View>
          <Text className="phase-carousel__pause-hint">点击继续</Text>
        </View>
      )}
    </View>
  )
}
