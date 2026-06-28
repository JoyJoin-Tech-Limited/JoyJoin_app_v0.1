import { View } from '@tarojs/components'
import BrandLogo from '../ui/BrandLogo'
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
  const sizeStr = `${size}rpx`
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
