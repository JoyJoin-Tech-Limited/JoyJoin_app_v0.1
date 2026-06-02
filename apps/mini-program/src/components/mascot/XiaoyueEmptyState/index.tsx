import { View, Image, Text } from '@tarojs/components'
import { useState } from 'react'
import { cdnAsset } from '@/lib/utils/cdnAssets'

interface XiaoyueEmptyStateProps {
  emotion: 'coaching' | 'celebration' | 'waiting' | 'sad' | 'curious' | 'events'
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = { sm: 160, md: 200, lg: 240 }

const EMOTION_MAP: Record<string, string> = {
  coaching:    'xiaoyue-coach-guide',
  celebration: 'xiaoyue-home-welcome',
  waiting:     'xiaoyue-match-waiting',
  sad:         'xiaoyue-neutral-information',
  curious:     'xiaoyue-connections-empty',
  events:      'xiaoyue-events-empty',
}

export default function XiaoyueEmptyState({
  emotion, title, subtitle, actionLabel, onAction, size = 'md'
}: XiaoyueEmptyStateProps) {
  const [imgError, setImgError] = useState(false)
  const dim = SIZE_MAP[size]
  return (
    <View className='xiaoyue-empty-state'>
      {!imgError ? (
        <Image
          className='xiaoyue-empty-state__mascot'
          src={cdnAsset(`/assets/personality/xiaoyue/${EMOTION_MAP[emotion]}.webp`)}
          style={{ width: `${dim}rpx`, height: `${dim}rpx` }}
          mode='aspectFit'
          lazyLoad
          onError={() => setImgError(true)}
        />
      ) : (
        <View
          className='xiaoyue-empty-state__mascot-fallback'
          style={{
            width: `${dim}rpx`,
            height: `${dim}rpx`,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: `${dim * 0.4}rpx` }}>✨</Text>
        </View>
      )}
      <Text className='xiaoyue-empty-state__title'>{title}</Text>
      {subtitle && <Text className='xiaoyue-empty-state__subtitle'>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View className='xiaoyue-empty-state__action' onClick={onAction}>
          <Text className='xiaoyue-empty-state__action-text'>{actionLabel}</Text>
        </View>
      )}
    </View>
  )
}
