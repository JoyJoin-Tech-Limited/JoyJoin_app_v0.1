import { Image, Text, View } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { localAsset } from '../../lib/utils/cdnAssets'

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

  const labelMap: Record<string, string> = {
    fire: '高能',
    warm: '暖场',
    cold: '慢热',
    mild: '自然',
  }

  const assetKey = assetMap[chemistry]
  const fallbackLabel = labelMap[chemistry] ?? '匹配'

  if (hasError) {
    return (
      <Text className={className} style={{ fontSize: sizeStr, lineHeight: sizeStr, fontWeight: 700 }}>
        {fallbackLabel}
      </Text>
    )
  }

  const src = localAsset(`/assets/icons/chemistry-badges/${assetKey}.webp`)

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
