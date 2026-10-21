import { View, Text, Image } from '@tarojs/components'
import { Fragment, useState } from 'react'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { localAsset } from '../../lib/utils/cdnAssets'

/**
 * EventFlowStrip — 详情页「怎么参加」4 拍流程条 (转化 P0c, 2026-10-20).
 *
 * Trust-surface "expectation display", NOT a progress stepper: the four
 * frozen canonical beats (订座 → 悦仔排桌 → 集结房间等开席 → 现场入座) answer
 * "然后呢?" right after the info card. `role='list'` semantics, four
 * equal-width nodes, 1rpx connector hairlines between them.
 *
 * Wow (design spec §5.3.1, locked): connectors draw one-shot scaleX(0→1)
 * 300ms cubic-bezier(0.22,1,0.36,1), each starting 80ms after the node icons
 * land (nodes fade + translateY(8rpx→0) 250ms, same curve) — the full
 * sequence is 250 + 80 + 300 = 630ms ≤ 700ms. No loops, no replay; the
 * reduced-motion tier renders the fully static strip. Mounted only after
 * event data resolves (page-level early returns), so the draw never runs
 * during the skeleton phase.
 *
 * Icons reuse the bundled `src/assets/icons/ui/` glyphs via `localAsset()`
 * (GuidanceTipCard pattern — no CDN-primary cold-start emoji flash, zero new
 * assets, no emojiToIconMap change). A glyph that fails to decode demotes to
 * an 8rpx brand dot.
 *
 * Subpackage WXSS rule: no side-effect SCSS import here — the page SCSS
 * `@use`s this component's SCSS (see pages/event-detail/index.scss).
 */

interface FlowStep {
  /** Frozen canonical label (一字不改, canonical terms only). */
  label: string
  /** Bundled ui glyph path (src/assets/icons/ui/). */
  glyph: string
}

const FLOW_STEPS: readonly FlowStep[] = [
  { label: '订座', glyph: '/assets/icons/ui/icon-ticket.webp' },
  { label: '悦仔排桌', glyph: '/assets/icons/ui/icon-status.webp' },
  { label: '集结房间等开席', glyph: '/assets/icons/ui/icon-people.webp' },
  { label: '现场入座', glyph: '/assets/icons/ui/icon-location.webp' },
]

export default function EventFlowStrip() {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  // Glyph resilience: a bundled icon that fails to decode demotes that node
  // to an 8rpx brand dot instead of rendering a broken image.
  const [failedGlyphs, setFailedGlyphs] = useState<readonly string[]>([])

  const rootClass = ['event-flow-strip', reduceMotion ? 'event-flow-strip--rm' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass}>
      <Text className='event-flow-strip__title'>怎么参加</Text>
      <View className='event-flow-strip__track' role='list' aria-label='参加流程'>
        {FLOW_STEPS.map((step, index) => {
          const glyphSrc = failedGlyphs.includes(step.label) ? null : localAsset(step.glyph)
          const node = (
            <View
              key={step.label}
              className={`event-flow-strip__node${
                index === 0 ? ' event-flow-strip__node--first' : ''
              }`}
              role='listitem'
            >
              <View className='event-flow-strip__node-icon' aria-hidden='true'>
                {glyphSrc ? (
                  <Image
                    className='event-flow-strip__node-glyph'
                    src={glyphSrc}
                    mode='aspectFit'
                    lazyLoad={false}
                    onError={() =>
                      setFailedGlyphs((prev) =>
                        prev.includes(step.label) ? prev : [...prev, step.label]
                      )
                    }
                  />
                ) : (
                  <View className='event-flow-strip__node-dot' />
                )}
              </View>
              <Text className='event-flow-strip__node-label'>{step.label}</Text>
            </View>
          )
          if (index === 0) return node
          return (
            <Fragment key={step.label}>
              {/* Connector hairline between nodes — the one-shot scaleX draw
                  is its whole life; static after landing. */}
              <View className='event-flow-strip__connector' aria-hidden='true' />
              {node}
            </Fragment>
          )
        })}
      </View>
    </View>
  )
}
