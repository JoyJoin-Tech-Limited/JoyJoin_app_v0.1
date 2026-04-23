import { View, Text, Image } from '@tarojs/components'
import type { ReactNode } from 'react'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import Button from './Button'
import './JoyJoinErrorState.scss'

interface JoyJoinErrorStateProps {
  /** Primary error headline (e.g. "加载失败") */
  title: string
  /** Secondary guidance (e.g. "请检查网络后重试") */
  description?: string
  /** Xiaoyue expression — defaults to sad/failure pose */
  xiaoyueExpression?: 'actionFailure' | 'neutralInformation'
  /** Retry action */
  onRetry?: () => void
  /** Optional back action (e.g. "返回") */
  onBack?: () => void
  /** Optional custom content */
  children?: ReactNode
  className?: string
}

/**
 * JoyJoinErrorState — beautiful error state with Xiaoyue mascot.
 *
 * Features:
 * - Xiaoyue sad/failure expression
 * - Clear error message
 * - Retry button (primary action)
 * - Optional back button (secondary)
 * - Brand gradient background
 */
export default function JoyJoinErrorState({
  title,
  description,
  xiaoyueExpression = 'actionFailure',
  onRetry,
  onBack,
  children,
  className = '',
}: JoyJoinErrorStateProps) {
  return (
    <View className={`joyjoin-error-state ${className}`}>
      <View className='joyjoin-error-state__content'>
        <Image
          className='joyjoin-error-state__mascot'
          src={getXiaoyueExpressionAsset(xiaoyueExpression)}
          mode='aspectFit'
        />
        <Text className='joyjoin-error-state__title'>{title}</Text>
        {description ? (
          <Text className='joyjoin-error-state__description'>{description}</Text>
        ) : null}
        <View className='joyjoin-error-state__actions'>
          {onRetry ? (
            <Button
              variant='primary'
              className='joyjoin-error-state__retry'
              onClick={onRetry}
            >
              重试
            </Button>
          ) : null}
          {onBack ? (
            <Button
              variant='secondary'
              className='joyjoin-error-state__back'
              onClick={onBack}
            >
              返回
            </Button>
          ) : null}
        </View>
        {children ? (
          <View className='joyjoin-error-state__extra'>{children}</View>
        ) : null}
      </View>
    </View>
  )
}
