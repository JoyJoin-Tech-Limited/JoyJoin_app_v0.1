import { View, Text } from '@tarojs/components'
import { useCallback, useState } from 'react'
import { haptics } from '../../../lib/utils/haptics'

interface PoolRegistrationDetailsExpanderProps {
  children?: React.ReactNode
  reduceMotion?: boolean
  /** Start expanded (e.g. a resumed payment draft that already holds details). */
  defaultOpen?: boolean
}

/**
 * PoolRegistrationDetailsExpander — Phase 2 (registration-ceremony-spec-20260817
 * §6): the all-optional details step folded into the intent step as a
 * collapsed-by-default section below the intent grid (「补充细节（可选）」).
 * Mirrors the PoolRegistrationVibePeek text-row toggle pattern —
 * haptics('light') on toggle, reduce-motion-aware instant expand — so both
 * expanders share one interaction grammar.
 */
export default function PoolRegistrationDetailsExpander({
  children,
  reduceMotion = false,
  defaultOpen = false,
}: PoolRegistrationDetailsExpanderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleToggle = useCallback(() => {
    haptics('light')
    setIsOpen((prev) => !prev)
  }, [])

  return (
    <View className='pool-reg-details-expander'>
      <View
        className='pool-reg-details-expander__toggle'
        onClick={handleToggle}
        hoverClass='pool-reg-details-expander__toggle--active'
        role='button'
        aria-label={isOpen ? '收起细节' : '补充细节（可选）'}
      >
        <Text className='pool-reg-details-expander__toggle-text'>
          {isOpen ? '收起细节' : '补充细节（可选）'}
        </Text>
        <Text
          className={[
            'pool-reg-details-expander__toggle-chevron',
            isOpen ? 'pool-reg-details-expander__toggle-chevron--open' : '',
          ].join(' ')}
          aria-hidden='true'
        >
          ›
        </Text>
      </View>

      {isOpen ? (
        <View
          className={[
            'pool-reg-details-expander__content',
            reduceMotion ? 'pool-reg-details-expander__content--reduce-motion' : '',
          ].join(' ')}
        >
          {children}
        </View>
      ) : null}
    </View>
  )
}
