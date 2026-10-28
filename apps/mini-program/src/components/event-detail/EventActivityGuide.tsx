import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { buildGenericEventActivityGuide } from '@shared/copy/eventActivityGuide'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { haptics } from '../../lib/utils/haptics'

/**
 * EventActivityGuide — optional, collapsed-by-default arrival expectations.
 *
 * event-detail has no authoritative tier/vibe/runPlan, so this surface always
 * uses the shared generic four-step model and labels it approximate. It never
 * infers a phase from tier, never claims next/total, and is not part of booking
 * or payment. No SCSS side-effect import: pages/event-detail/index.scss @use's
 * the companion stylesheet so the rules stay in the owning page bundle.
 */
const EXIT_MS = 150

export default function EventActivityGuide() {
  const guide = buildGenericEventActivityGuide()
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    [],
  )

  const handleToggle = () => {
    haptics('light')
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }

    if (reduceMotion) {
      const next = !isExpanded
      setIsExpanded(next)
      setIsMounted(next)
      setIsExiting(false)
      return
    }

    if (isExpanded) {
      setIsExpanded(false)
      setIsExiting(true)
      exitTimerRef.current = setTimeout(() => {
        setIsMounted(false)
        setIsExiting(false)
        exitTimerRef.current = null
      }, EXIT_MS)
      return
    }

    setIsExpanded(true)
    setIsMounted(true)
    setIsExiting(false)
  }

  const rootClass = [
    'event-activity-guide',
    isExpanded ? 'event-activity-guide--expanded' : '',
    reduceMotion ? 'event-activity-guide--rm' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass}>
      <Text className='event-activity-guide__title'>{guide.title}</Text>
      <View
        className='event-activity-guide__summary'
        hoverClass='event-activity-guide__summary--pressed'
        role='button'
        aria-label={`${guide.summary}，${isExpanded ? guide.collapseLabel : guide.expandLabel}`}
        aria-expanded={isExpanded}
        aria-controls='event-activity-guide-steps'
        onClick={handleToggle}
      >
        <Text className='event-activity-guide__summary-text'>{guide.summary}</Text>
        <View className='event-activity-guide__action'>
          <Text className='event-activity-guide__action-label'>
            {isExpanded ? guide.collapseLabel : guide.expandLabel}
          </Text>
          <View className='event-activity-guide__chevron' aria-hidden='true' />
        </View>
      </View>

      {isMounted ? (
        <View
          id='event-activity-guide-steps'
          className={`event-activity-guide__steps${
            isExiting ? ' event-activity-guide__steps--exit' : ''
          }`}
        >
          <View role='list'>
            {guide.steps.map((step) => (
              <View key={step.id} className='event-activity-guide__step' role='listitem'>
                <View className='event-activity-guide__step-dot' aria-hidden='true' />
                <Text className='event-activity-guide__step-text'>{step.text}</Text>
              </View>
            ))}
          </View>
          <Text className='event-activity-guide__note'>{guide.approximateNote}</Text>
        </View>
      ) : null}
    </View>
  )
}
