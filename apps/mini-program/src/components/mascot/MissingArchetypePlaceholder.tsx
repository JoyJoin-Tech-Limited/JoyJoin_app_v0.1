import { View } from '@tarojs/components'
import BrandLogo from '../ui/BrandLogo'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'
import './MissingArchetypePlaceholder.scss'

interface MissingArchetypePlaceholderProps {
  size?: number
  className?: string
}

/**
 * MissingArchetypePlaceholder
 *
 * Brand-safe placeholder used when a teammate has no archetype assigned.
 * Replaces the old initials-circle fallback with the JoyJoin logo mark
 * so we never show abstract letters for people.
 */
export default function MissingArchetypePlaceholder({
  size = 80,
  className = '',
}: MissingArchetypePlaceholderProps) {
  // Inline rpx is dropped by the H5 style parser (AGENTS.md §3) — emit
  // computed px (pixel-identical on WeChat native; JoyJoinIcon convention).
  const windowWidth = getWindowInfoCompat().windowWidth || 375
  const sizeStr = `${Math.round((size * windowWidth) / 750)}px`
  const logoSize = Math.round(size * 0.55)

  return (
    <View
      className={`missing-archetype-placeholder ${className}`}
      style={{ width: sizeStr, height: sizeStr }}
      aria-label='未知人格原型'
    >
      <BrandLogo width={logoSize} height={logoSize} ariaLabel='JoyJoin' />
    </View>
  )
}
