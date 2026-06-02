import { useState, useEffect, useRef, useCallback } from 'react'
import { Text } from '@tarojs/components'
import './TypewriterText.scss'

interface TypewriterTextProps {
  /** Full text to reveal character-by-character */
  text: string
  className?: string
  /** Base ms per character (default 40; clamped to ≥16) */
  speed?: number
  /** Ms to wait before first character (default 120) */
  delay?: number
  /** Set false to show full text immediately (reduced-motion fallback) */
  enabled?: boolean
  /** Show a blinking cursor while typing */
  showCursor?: boolean
  /** Fired once when every character is visible */
  onComplete?: () => void
}

/** Punctuation-to-pause multiplier map */
const PUNCTUATION_PAUSE: Record<string, number> = {
  '。': 2.5,
  '！': 2.5,
  '？': 2.5,
  '…': 2.5,
  '，': 1.5,
  ',': 1.5,
  ';': 1.5,
  '；': 1.5,
  '.': 2,
  '!': 2,
  '?': 2,
}

/** Minimum safe speed to avoid setData floods on low-end devices (≈1 update per frame at 60fps) */
const MIN_SPEED = 16

/**
 * TypewriterText — character-by-character reveal for mascot speech bubbles.
 *
 * Design notes:
 * - Recursive setTimeout (not setInterval) so punctuation pauses feel natural.
 * - Effect re-runs when `text` changes, giving a clean restart on new copy.
 * - `enabled=false` shows full text immediately for reduced-motion / loading states.
 * - `onComplete` is stored in a ref so it never triggers effect re-runs.
 * - Speed is clamped to MIN_SPEED so we don't overwhelm the WeChat setData layer.
 */
export default function TypewriterText({
  text,
  className = '',
  speed = 40,
  delay = 120,
  enabled = true,
  showCursor = false,
  onComplete,
}: TypewriterTextProps) {
  const [visibleLength, setVisibleLength] = useState(0)
  const [done, setDone] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCompleteRef = useRef(onComplete)

  const resolvedSpeed = Math.max(speed, MIN_SPEED)

  // Keep callback fresh without re-triggering the effect
  onCompleteRef.current = onComplete

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      setVisibleLength(text.length)
      setDone(true)
      onCompleteRef.current?.()
      return
    }

    setVisibleLength(0)
    setDone(false)

    let current = 0
    let cancelled = false

    const typeNext = () => {
      if (cancelled) return
      current++
      setVisibleLength(current)

      if (current >= text.length) {
        setDone(true)
        onCompleteRef.current?.()
        return
      }

      const char = text[current - 1] ?? ''
      const multiplier = PUNCTUATION_PAUSE[char] || 1
      timeoutRef.current = setTimeout(typeNext, Math.round(resolvedSpeed * multiplier))
    }

    const startTimer = setTimeout(() => {
      if (cancelled) return
      typeNext()
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      clearTimers()
    }
  }, [text, enabled, resolvedSpeed, delay, clearTimers])

  if (!enabled) {
    return <Text className={className}>{text}</Text>
  }

  return (
    <Text className={className}>
      {text.slice(0, visibleLength)}
      {showCursor && !done && (
        <Text className='typewriter-cursor'>|</Text>
      )}
    </Text>
  )
}
