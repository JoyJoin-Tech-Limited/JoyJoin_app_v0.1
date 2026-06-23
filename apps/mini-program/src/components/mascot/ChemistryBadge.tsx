import { Image, Text, View } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'

interface ChemistryBadgeProps {
  chemistry: 'fire' | 'warm' | 'cold' | 'mild'
  size?: number
  className?: string
}

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
  const assetKey = assetMap[chemistry]
  const fallbackLabel = labelMap[chemistry] ?? '匹配'
  const { src, onError, isLocal } = useCdnFirstSrc(`/assets/icons/chemistry-badges/${assetKey}.webp`)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    if (isLocal) {
      setHasError(true)
    } else {
      onError()
    }
  }, [isLocal, onError])

  const sizeStr = `${size}rpx`

  if (hasError) {
    return (
      <Text className={className} style={{ fontSize: sizeStr, lineHeight: sizeStr, fontWeight: 700 }}>
        {fallbackLabel}
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
