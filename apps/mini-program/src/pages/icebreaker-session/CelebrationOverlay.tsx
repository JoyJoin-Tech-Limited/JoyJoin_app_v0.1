import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { CELEBRATION_FRAME_MAP, type CelebrationFrameKey } from './celebrationAssets'

interface CelebrationOverlayProps {
  visible: boolean
  frameKey: CelebrationFrameKey
  title: string
  subtitle?: string
  children?: React.ReactNode
  autoDismissMs?: number
  onDismiss?: () => void
}

export function CelebrationOverlay({
  visible,
  frameKey,
  title,
  subtitle,
  children,
  autoDismissMs = 3000,
  onDismiss,
}: CelebrationOverlayProps) {
  const [animKey, setAnimKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (visible) setAnimKey((k) => k + 1)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    setIsExiting(false)

    const exitTimer = setTimeout(() => setIsExiting(true), autoDismissMs - 400)
    const dismissTimer = setTimeout(() => {
      onDismiss?.()
    }, autoDismissMs)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(dismissTimer)
    }
  }, [visible, animKey, autoDismissMs, onDismiss])

  if (!visible) return null

  return (
    <View
      key={animKey}
      className={`celebration-overlay${isExiting ? ' celebration-overlay--out' : ''}`}
      catchMove
    >
      <View className='celebration-overlay__backdrop' />

      <Image
        src={CELEBRATION_FRAME_MAP[frameKey]}
        mode='aspectFit'
        className='celebration-overlay__hero'
        lazyLoad
      />

      <View className='celebration-overlay__card'>
        <Text className='celebration-overlay__title'>{title}</Text>
        {subtitle ? <Text className='celebration-overlay__subtitle'>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  )
}
