import { View, Text, Image } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import Button from './Button'
import './JoyJoinSuccessState.scss'

interface JoyJoinSuccessStateProps {
  /** Primary celebration headline (e.g. "报名成功！") */
  title: string
  /** Secondary message (e.g. "我们已收到你的报名，匹配结果将在活动开始前公布") */
  description?: string
  /** Xiaoyue expression — defaults to success pose */
  xiaoyueExpression?: 'actionSuccess' | 'matchSuccess' | 'thanksFeedback'
  /** Auto-dismiss timeout in ms (default 3000, 0 = no auto-dismiss) */
  autoDismissMs?: number
  /** Called when auto-dismiss fires */
  onDismiss?: () => void
  /** Optional manual dismiss button */
  dismissLabel?: string
  /** Optional custom content below */
  children?: ReactNode
  className?: string
}

/**
 * JoyJoinSuccessState — celebration screen with confetti + Xiaoyue.
 *
 * Features:
 * - CSS confetti burst animation (8 particles)
 * - Xiaoyue celebration expression
 * - Auto-dismiss with countdown
 * - Haptic feedback trigger (via parent)
 * - Brand gradient background
 */
export default function JoyJoinSuccessState({
  title,
  description,
  xiaoyueExpression = 'actionSuccess',
  autoDismissMs = 3000,
  onDismiss,
  dismissLabel,
  children,
  className = '',
}: JoyJoinSuccessStateProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (autoDismissMs <= 0) return
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, onDismiss])

  if (!visible) {
    return null
  }

  return (
    <View className={`joyjoin-success-state ${className}`}>
      {/* Confetti particles */}
      <View className='joyjoin-success-state__confetti'>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            className={`joyjoin-success-state__particle joyjoin-success-state__particle--${i + 1}`}
          />
        ))}
      </View>

      <View className='joyjoin-success-state__content'>
        <Image
          className='joyjoin-success-state__mascot'
          src={getXiaoyueExpressionAsset(xiaoyueExpression)}
          mode='aspectFit'
        />
        <Text className='joyjoin-success-state__title'>{title}</Text>
        {description ? (
          <Text className='joyjoin-success-state__description'>{description}</Text>
        ) : null}
        {dismissLabel ? (
          <Button
            variant='secondary'
            className='joyjoin-success-state__dismiss'
            onClick={() => {
              setVisible(false)
              onDismiss?.()
            }}
          >
            {dismissLabel}
          </Button>
        ) : null}
        {children ? (
          <View className='joyjoin-success-state__extra'>{children}</View>
        ) : null}
      </View>
    </View>
  )
}
