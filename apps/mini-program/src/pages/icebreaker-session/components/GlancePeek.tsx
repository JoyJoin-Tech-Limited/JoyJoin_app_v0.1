import { useState, type ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import { GLANCE_PEEK_TRIGGER_HINT } from '../viewModels/glanceStackModel'

export interface GlancePeekProps {
  /** Hairline summary fragment on the closed trigger (e.g. "2/6"). */
  summary: string
  children: ReactNode
  className?: string
}

/**
 * L3 hold-to-peek (spec §4.1; gesture adopted §8 Q2 — hold-to-reveal,
 * release-to-hide). The trigger is a hairline micro-fragment; the content is
 * context only — nothing inside a peek is ever required to act (playbook
 * §3.7). Content mounts on hold so the closed state costs zero render.
 */
export function GlancePeek({ summary, children, className }: GlancePeekProps) {
  const [open, setOpen] = useState(false)

  return (
    <View
      className={`glance-peek${open ? ' glance-peek--open' : ''}${className ? ` ${className}` : ''}`}
      onTouchStart={() => setOpen(true)}
      onTouchEnd={() => setOpen(false)}
      onTouchCancel={() => setOpen(false)}
    >
      <Text className='glance-peek__trigger'>
        {summary ? `${summary} · ${GLANCE_PEEK_TRIGGER_HINT}` : GLANCE_PEEK_TRIGGER_HINT}
      </Text>
      {open ? <View className='glance-peek__content'>{children}</View> : null}
    </View>
  )
}
