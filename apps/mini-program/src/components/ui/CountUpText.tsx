import { Text } from '@tarojs/components'
import { useCountUp } from '../../hooks/useCountUp'

export interface CountUpTextProps {
  /** Target numeric value. */
  value: number
  /** Optional suffix rendered after the number (e.g. "%"). */
  suffix?: string
  /** Additional CSS class for the Text node. */
  className?: string
  /** Inline styles for the Text node. */
  style?: React.CSSProperties
  /** Whether the count-up animation should run. */
  enabled?: boolean
  /** Animation duration in milliseconds. */
  duration?: number
  /** Delay before counting starts, in milliseconds. */
  delay?: number
  /** Respect reduced-motion settings; if omitted the hook reads the system setting. */
  prefersReducedMotion?: boolean
}

/**
 * Isolated count-up number display.
 *
 * Encapsulates `useCountUp` so only this tiny Text node re-renders on each
 * animation frame, instead of the parent page or card.
 */
export function CountUpText({
  value,
  suffix,
  className,
  style,
  enabled = true,
  duration,
  delay = 0,
  prefersReducedMotion,
}: CountUpTextProps) {
  // reducedMotion gating is delegated to the underlying useCountUp hook,
  // which reads the system setting and accepts an explicit override.
  const display = useCountUp(value, { enabled, delay, duration, prefersReducedMotion })
  return (
    <Text className={className} style={style}>
      {String(display)}
      {suffix}
    </Text>
  )
}
