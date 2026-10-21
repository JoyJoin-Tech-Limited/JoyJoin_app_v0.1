import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { EVENT_FAQ_ITEMS } from '@shared/copy/eventFaqCopy'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { haptics } from '../../lib/utils/haptics'

/**
 * EventFaqAccordion — 详情页常见问题手风琴 (对标平台 P0e, 2026-10-20).
 *
 * Trust-surface Q&A list under the EventFlowStrip. Frozen behavior (design
 * spec §5.3.3):
 *   - ONE item open at a time. Switching = the old answer exits first
 *     (opacity→0, 150ms) and the new answer mounts only after the old block
 *     unmounts (at 150ms) — sequential, never double-mounted, so the swap
 *     cannot thrash layout (spec §5.2.3: height/width/margin animation and
 *     CLS are hard-banned). Full sequence 150 + 250 = 400ms.
 *   - The new answer enters with opacity 0→1 + translateY(8rpx→0), 250ms,
 *     cubic-bezier(0.22,1,0.36,1); the chevron is a CSS border glyph with a
 *     transform-only 200ms rotation on the same curve. No height animation,
 *     no springs, no colored answer blocks.
 *   - Q row = touch target ≥88rpx, hoverClass tint rgba($color-primary,0.06)
 *     120ms, tap fires haptics('light').
 *   - Reduced motion: instant swap, zero animation (JS --rm modifier +
 *     media-query belt-and-braces in the SCSS).
 *
 * Copy: all question/answer strings render verbatim from the frozen
 * `EVENT_FAQ_ITEMS` module — zero hardcoded FAQ copy in this component.
 *
 * Promise-behavior order lock (copy module's 依赖提示, 2026-10-20): the
 * `cancel_refund` item states the PRD §1.5 pre-reveal full-refund promise,
 * so it renders ONLY when `preRevealRefundEnabled === true` — the same
 * fail-closed read the checkout's RefundGuaranteeLine consumes. The other
 * seven items render unconditionally; the whole accordion is full-launch
 * with no feature-flag wrapper.
 *
 * Subpackage WXSS rule: no side-effect SCSS import here — the page SCSS
 * `@use`s this component's SCSS (see pages/event-detail/index.scss).
 */

interface EventFaqAccordionProps {
  /** Server-resolved `user.features.preRevealRefundEnabled` (=== true). */
  preRevealRefundEnabled: boolean
}

/** Stable copy-module id of the promise-locked refund item. */
const CANCEL_REFUND_ITEM_ID = 'cancel_refund'

/** Old-answer exit duration (spec §5.3.3). The new answer mounts at this
 *  boundary and enters over 250ms → total switch = 400ms. */
const EXIT_MS = 150

export default function EventFaqAccordion({
  preRevealRefundEnabled,
}: EventFaqAccordionProps) {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  // openId = logical open target (drives chevron + aria-expanded);
  // visibleId = the answer block actually mounted. During a switch the two
  // diverge for exactly EXIT_MS: openId has already moved to the new item
  // (chevrons rotate immediately) while visibleId still shows the old block
  // fading out — exit-then-enter with no double-mount.
  const [openId, setOpenId] = useState<string | null>(null)
  const [visibleId, setVisibleId] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    []
  )

  const items = preRevealRefundEnabled
    ? EVENT_FAQ_ITEMS
    : EVENT_FAQ_ITEMS.filter((item) => item.id !== CANCEL_REFUND_ITEM_ID)

  const handleToggle = (itemId: string) => {
    haptics('light')
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    // Reduced motion: instant swap, no timers, zero animation.
    if (reduceMotion) {
      const next = openId === itemId ? null : itemId
      setOpenId(next)
      setVisibleId(next)
      setExiting(false)
      return
    }
    if (openId === itemId) {
      // Close current: chevron rotates back now; answer fades 150ms, unmounts.
      setOpenId(null)
      setExiting(true)
      exitTimerRef.current = setTimeout(() => {
        setVisibleId(null)
        setExiting(false)
      }, EXIT_MS)
      return
    }
    if (visibleId !== null) {
      // Switch: new chevron turns now, old answer exits first, new mounts
      // at the 150ms boundary with its own 250ms entrance.
      setOpenId(itemId)
      setExiting(true)
      exitTimerRef.current = setTimeout(() => {
        setVisibleId(itemId)
        setExiting(false)
      }, EXIT_MS)
      return
    }
    // Fresh open (nothing mounted): mount + enter immediately.
    setOpenId(itemId)
    setVisibleId(itemId)
    setExiting(false)
  }

  const rootClass = ['event-faq-accordion', reduceMotion ? 'event-faq-accordion--rm' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass} role='list'>
      {items.map((item) => {
        const isOpen = openId === item.id
        const isMounted = visibleId === item.id
        return (
          <View
            key={item.id}
            className={`event-faq-accordion__item${
              isOpen ? ' event-faq-accordion__item--open' : ''
            }`}
            role='listitem'
          >
            <View
              className='event-faq-accordion__row'
              hoverClass='event-faq-accordion__row--pressed'
              role='button'
              aria-expanded={isOpen}
              onClick={() => handleToggle(item.id)}
            >
              <Text className='event-faq-accordion__question'>{item.question}</Text>
              {/* CSS border glyph — no emoji chevron (spec §P0e) */}
              <View className='event-faq-accordion__chevron' aria-hidden='true' />
            </View>
            {isMounted ? (
              <View
                id={`event-faq-answer-${item.id}`}
                className={`event-faq-accordion__answer${
                  exiting ? ' event-faq-accordion__answer--exit' : ''
                }`}
              >
                <Text className='event-faq-accordion__answer-text'>{item.answer}</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
