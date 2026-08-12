import ArchetypeHeadRenderer from './ArchetypeHeadRenderer'
import './ArchetypeHead.scss'

/**
 * ArchetypeHead — proprietary head icon for the 12 JoyJoin archetypes.
 *
 * Replaces user initials in avatar contexts. Shows the character's head
 * extracted from the full-body illustration at 240×240px WebP.
 *
 * The 240px source gives @2x crispness at 120rpx display size and
 * acceptable quality at 180rpx (@3x). WeChat downscales automatically;
 * no @2x/@3x suffixes are used (avoids the @3x@3x double-suffix bug).
 *
 * Variants:
 *   head — default head crop via ArchetypeHeadRenderer
 *   grid — circular grid icon via ArchetypeHeadRenderer
 *
 * The rendering core lives in ArchetypeHeadRenderer.
 */

interface ArchetypeHeadProps {
  archetype?: string | null
  size?: number // rpx
  fallback?: 'initial' | 'none'
  fallbackText?: string
  className?: string
  variant?: 'head' | 'grid'
}

export default function ArchetypeHead({
  archetype,
  size = 80,
  fallback = 'initial',
  fallbackText,
  className = '',
  variant = 'head',
}: ArchetypeHeadProps) {
  return (
    <ArchetypeHeadRenderer
      archetype={archetype}
      size={size}
      variant={variant === 'grid' ? 'grid' : 'head'}
      fallback={fallback}
      fallbackText={fallbackText}
      className={className}
    />
  )
}
