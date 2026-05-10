import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './TapReaction.scss'

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

export interface ReactionItem {
  emoji: string
  label: string
  count?: number
}

export interface TapReactionProps {
  reactions: ReactionItem[]
  onReact: (index: number) => void
  selectedIndex?: number
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

/**
 * TapReaction — tap emoji row to react (rose / tomato / coin / heart).
 *
 * Replaces ThrowEmoji.
 * Static emoji row with press feedback and selection glow.
 * Reduced motion: border color change only.
 */
export default function TapReaction({
  reactions,
  onReact,
  selectedIndex,
  reducedMotion,
}: TapReactionProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const [justTapped, setJustTapped] = useState<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleTap = useCallback(
    (index: number) => {
      onReact(index)
      if (!isReduced) {
        setJustTapped(index)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setJustTapped((prev) => (prev === index ? null : prev)), 200)
      }
    },
    [onReact],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }
  }, [])

  return (
    <View className='gesture-tap-reaction'>
      {reactions.map((item, index) => {
        const isSelected = selectedIndex === index
        const isPulsing = justTapped === index

        return (
          <View
            key={index}
            className={`gesture-tap-reaction__item${isSelected ? ' gesture-tap-reaction__item--selected' : ''}${isPulsing ? ' gesture-tap-reaction__item--pulse' : ''}`}
            onClick={() => handleTap(index)}
          >
            <Text className='gesture-tap-reaction__emoji'>{item.emoji}</Text>
            <Text className='gesture-tap-reaction__label'>{item.label}</Text>
            {typeof item.count === 'number' && (
              <Text className='gesture-tap-reaction__count'>{item.count}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}
