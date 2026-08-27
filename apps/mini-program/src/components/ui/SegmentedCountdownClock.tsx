import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { computeCountdownResult } from '../../hooks/useEventCountdown'
import { useCountdownTickValue } from '../../hooks/useCountdownTick'
import { usePageVisibility } from '../../hooks/usePageVisibility'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'

const CLOCK_TOTAL_BLOCKS = 12

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatClockPair(value: number): string {
  return pad2(Math.max(0, value))
}

export interface SegmentedCountdownClockProps {
  target: string | null
  enabled: boolean
  /** When omitted the clock falls back to the primary brand color via CSS. */
  accentColor?: string
  clockId: string
  /** Compact vertical layout for the right info rail. */
  compact?: boolean
  /** Optional externally-provided timestamp (ms). When set, the component does
   *  not read the shared CountdownTickProvider and instead derives the readout
   *  from this value. Useful when the consumer already owns a coarser tick. */
  externalNow?: number
  /** Granularity switches — all true by default (days only shown when > 0). */
  showDays?: boolean
  showHours?: boolean
  showMinutes?: boolean
  showSeconds?: boolean
  showProgress?: boolean
}

/**
 * SegmentedCountdownClock — reusable countdown leaf.
 *
 * Extracted from EventSummaryCard so the gathering room (and any future
 * surface) can share the same visual language. The default path reads from
 * CountdownTickProvider; pass `externalNow` to drive the readout from a parent
 * timer instead (e.g., the room's 60s interval).
 */
const SegmentedCountdownClock = React.memo(function SegmentedCountdownClock({
  target,
  enabled,
  accentColor,
  clockId,
  compact = false,
  externalNow,
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
  showProgress = true,
}: SegmentedCountdownClockProps) {
  const tickValue = useCountdownTickValue()
  const { isDegradation } = useDeviceTier()
  const { isPageVisible } = usePageVisibility()
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  const usingExternal = externalNow != null

  // Live gating: motion enabled, primary-tier device, page visible, valid target.
  // When an external timestamp is provided we deliberately skip the provider.
  const live = Boolean(target) && enabled && !isDegradation && !reduceMotion && isPageVisible && !usingExternal

  // While not live (hidden, reduced-motion, low-end, no provider) the readout
  // FREEZES at the last live value.
  const frozenNowRef = useRef<number>(Date.now())
  const tickNow = tickValue?.now
  if (live && tickNow != null) {
    frozenNowRef.current = tickNow
  }
  const now = usingExternal ? externalNow : live && tickNow != null ? tickNow : frozenNowRef.current

  const { display, segments, isUrgent, hasStarted, isLive } = useMemo(
    () => computeCountdownResult(target, enabled, now, 60, live),
    [target, enabled, now, live],
  )

  const prevSegmentsRef = useRef(segments)
  const [pulseSegment, setPulseSegment] = useState<'days' | 'hours' | 'minutes' | 'seconds' | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!segments || !prevSegmentsRef.current) {
      prevSegmentsRef.current = segments
      return
    }

    const prev = prevSegmentsRef.current
    let changed: typeof pulseSegment = null
    if (segments.seconds !== prev.seconds) changed = 'seconds'
    else if (segments.minutes !== prev.minutes) changed = 'minutes'
    else if (segments.hours !== prev.hours) changed = 'hours'
    else if (segments.days !== prev.days) changed = 'days'

    if (changed) {
      setPulseSegment(changed)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => setPulseSegment(null), 160)
    }
    prevSegmentsRef.current = segments

    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [segments])

  if (!display) {
    return null
  }

  const clockStyle = accentColor
    ? ({ '--clock-accent': accentColor } as React.CSSProperties)
    : undefined

  if (hasStarted) {
    return (
      <View
        id={clockId}
        className='segmented-countdown-clock segmented-countdown-clock--started'
        style={clockStyle}
        aria-label={display}
      >
        <View className='segmented-countdown-clock__started-dot' />
        <Text className='segmented-countdown-clock__started-label'>{display}</Text>
      </View>
    )
  }

  if (!segments) {
    return null
  }

  const { days, hours, minutes, seconds, progress } = segments
  const filledBlocks = Math.max(
    0,
    Math.min(CLOCK_TOTAL_BLOCKS, Math.round(progress * CLOCK_TOTAL_BLOCKS)),
  )

  const cells = [
    showDays && days > 0 ? { key: 'days', value: days, unit: '天', pulse: 'days' as const } : null,
    showHours ? { key: 'hours', value: hours, unit: '时', pulse: 'hours' as const } : null,
    showMinutes ? { key: 'minutes', value: minutes, unit: '分', pulse: 'minutes' as const } : null,
    showSeconds ? { key: 'seconds', value: seconds, unit: '秒', pulse: 'seconds' as const } : null,
  ].filter(Boolean) as Array<{ key: string; value: number; unit: string; pulse: 'days' | 'hours' | 'minutes' | 'seconds' }>

  return (
    <View
      id={clockId}
      className={[
        'segmented-countdown-clock',
        compact ? 'segmented-countdown-clock--compact' : '',
      ].filter(Boolean).join(' ')}
      style={clockStyle}
      aria-label={`倒计时 ${display}`}
      aria-live={isLive ? 'polite' : undefined}
      aria-atomic='true'
    >
      <View className='segmented-countdown-clock__digits'>
        {cells.map((cell, index) => (
          <React.Fragment key={cell.key}>
            {index > 0 ? (
              <Text className='segmented-countdown-clock__separator'>:</Text>
            ) : null}
            <View className='segmented-countdown-clock__cell'>
              <Text className={['segmented-countdown-clock__value', pulseSegment === cell.pulse ? 'segmented-countdown-clock__value--pulse' : ''].filter(Boolean).join(' ')}>
                {formatClockPair(cell.value)}
              </Text>
              <Text className='segmented-countdown-clock__unit'>{cell.unit}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {showProgress ? (
        <View className='segmented-countdown-clock__progress' aria-hidden='true'>
          {Array.from({ length: CLOCK_TOTAL_BLOCKS }, (_, i) => {
            const filled = i < filledBlocks
            return (
              <View
                key={i}
                className={[
                  'segmented-countdown-clock__progress-block',
                  filled ? 'segmented-countdown-clock__progress-block--filled' : '',
                  filled && isUrgent && isLive
                    ? 'segmented-countdown-clock__progress-block--urgent'
                    : '',
                ].filter(Boolean).join(' ')}
              />
            )
          })}
        </View>
      ) : null}
    </View>
  )
})

export default SegmentedCountdownClock
