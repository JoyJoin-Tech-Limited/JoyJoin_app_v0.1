import { Image, Text, View } from '@tarojs/components'
import { useState, useCallback } from 'react'

interface ChemistryBadgeProps {
  chemistry: 'fire' | 'warm' | 'cold' | 'mild'
  size?: number
  className?: string
}

/**
 * ChemistryBadge — proprietary icon for matching status chemistry types.
 *
 * Maps chemistry type directly to asset (bypasses emoji lookup to ensure
 * unique assets per chemistry type, even when emoji overlaps with other
 * contexts like mood icons).
 */
export default function ChemistryBadge({
  chemistry,
  size = 32,
  className = '',
}: ChemistryBadgeProps) {
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  const sizeStr = `${size}rpx`

  const assetMap: Record<string, string> = {
    fire: 'chem-fire',
    warm: 'chem-warm',
    cold: 'chem-sprout',
    mild: 'chem-chat',
  }

  const emojiMap: Record<string, string> = {
    fire: '🔥',
    warm: '✨',
    cold: '🌱',
    mild: '💬',
  }

  const assetKey = assetMap[chemistry]
  const fallbackEmoji = emojiMap[chemistry]

  if (hasError) {
    return (
      <Text className={className} style={{ fontSize: sizeStr, lineHeight: sizeStr }}>
        {fallbackEmoji}
      </Text>
    )
  }

  let src: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    src = require(`../../assets/icons/chemistry-badges/${assetKey}.png`) as string
  } catch {
    return (
      <Text className={className} style={{ fontSize: sizeStr, lineHeight: sizeStr }}>
        {fallbackEmoji}
      </Text>
    )
  }

  return (
    <Image
      className={className}
      src={src}
      style={{ width: sizeStr, height: sizeStr }}
      lazyLoad
      onError={handleError}
    />
  )
}
