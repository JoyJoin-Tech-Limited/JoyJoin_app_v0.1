import { useSdAvatarEnabled } from '../../hooks/useSdAvatarEnabled'
import ArchetypeHeadRenderer from './ArchetypeHeadRenderer'
import SDAvatar from './SDAvatar'
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
 *   sd   — SD pixel sprite via SDAvatar (sd-avatar/v1 family);
 *          only when the viewer's sdAvatarEnabled feature flag is on
 *          AND size >= 40rpx, otherwise falls back to head behaviour.
 *
 * The rendering core lives in ArchetypeHeadRenderer so SDAvatar's head
 * fallback can use it without a circular import.
 */

interface ArchetypeHeadProps {
  archetype?: string | null
  size?: number // rpx
  fallback?: 'initial' | 'none'
  fallbackText?: string
  className?: string
  variant?: 'head' | 'grid' | 'sd'
}

/** SD sprites read as full characters; below this rpx size the head crop
 * stays more legible, so small slots keep the existing head behaviour. */
const SD_VARIANT_MIN_SIZE_RPX = 40

export default function ArchetypeHead({
  archetype,
  size = 80,
  fallback = 'initial',
  fallbackText,
  className = '',
  variant = 'head',
}: ArchetypeHeadProps) {
  const sdAvatarEnabled = useSdAvatarEnabled()

  // SD pixel sprite variant: full-character chibi sprite for 40rpx+
  // roster/list slots, gated by the server-owned sdAvatarEnabled flag.
  if (variant === 'sd' && sdAvatarEnabled && size >= SD_VARIANT_MIN_SIZE_RPX) {
    return (
      <SDAvatar
        archetype={archetype}
        size={size}
        fallback={fallback === 'none' ? 'none' : 'head'}
        fallbackText={fallbackText}
        className={className}
      />
    )
  }

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
