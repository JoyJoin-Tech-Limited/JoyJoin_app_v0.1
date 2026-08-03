import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import type { ArchetypeTheme } from '../lib/paymentRitualState'

interface Props {
  visible: boolean
  theme: ArchetypeTheme
  archetypeDisplayName: string | null
  autoDismissMs?: number
  onDismiss?: () => void
}

export default function RitualCelebrationOverlay({
  visible,
  theme,
  archetypeDisplayName,
  autoDismissMs = 1500,
  onDismiss,
}: Props) {
  const [isExiting, setIsExiting] = useState(false)
  const onDismissRef = useRef(onDismiss)

  // Gate particle count on device tier (low-end = fewer particles or skip)
  const particleCount = useMemo(() => {
    try {
      const benchmark = Taro.getSystemInfoSync().benchmarkLevel ?? 20
      return benchmark <= 15 ? 10 : benchmark <= 25 ? 25 : 40
    } catch {
      return 25
    }
  }, [])

  // Stabilize callback to prevent timer reset on parent re-render
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!visible) {
      setIsExiting(false)
      return
    }

    const exitTimer = setTimeout(() => setIsExiting(true), autoDismissMs - 300)
    const dismissTimer = setTimeout(() => {
      onDismissRef.current?.()
    }, autoDismissMs)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(dismissTimer)
    }
  }, [visible, autoDismissMs])

  if (!visible) return null

  const subtitle = archetypeDisplayName
    ? `作为${archetypeDisplayName}的你，找到了属于自己的位置`
    : '你找到了属于自己的位置'

  return (
    <View
      className={`ritual-celebration${isExiting ? ' ritual-celebration--out' : ''}`}
      catchMove
      role='dialog'
      aria-modal='true'
      aria-live='polite'
    >
      <View className='ritual-celebration__backdrop' />

      <View className='ritual-celebration__burst'>
        <ParticleBurst
          trigger={visible && !isExiting}
          type='confetti'
          count={particleCount}
          spotlightColor={theme.accentBold}
        />
      </View>

      <View className='ritual-celebration__content'>
        <Image
          src={getXiaoyueExpressionAsset('actionSuccess')}
          mode='aspectFit'
          className='ritual-celebration__xiaoyue'
          lazyLoad
          onError={() => {}}
        />
        <Text className='ritual-celebration__title'>欢迎加入 JoyJoin 社群</Text>
        <Text className='ritual-celebration__subtitle'>{subtitle}</Text>
      </View>
    </View>
  )
}
