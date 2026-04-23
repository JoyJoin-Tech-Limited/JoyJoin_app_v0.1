import { View, Text, Image } from '@tarojs/components'
import type { ReactNode } from 'react'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import Button from './Button'
import './JoyJoinEmptyState.scss'

interface JoyJoinEmptyStateProps {
  /** Primary headline (e.g. "还没有待参加的活动") */
  title: string
  /** Secondary hint (e.g. "去「发现」页面看看有什么好玩的") */
  subtitle?: string
  /** Xiaoyue expression for the empty state mood */
  xiaoyueExpression?: 'coachGuide' | 'neutralInformation' | 'homeWelcome'
  /** Optional primary CTA */
  action?: {
    label: string
    onClick: () => void
  }
  /** Optional custom content below the CTA */
  children?: ReactNode
  className?: string
}

/**
 * JoyJoinEmptyState — beautiful empty state with Xiaoyue mascot.
 *
 * Features:
 * - Xiaoyue mascot illustration (centered)
 * - Headline in brand font
 * - Subtitle with helpful guidance
 * - Optional primary CTA
 * - Brand gradient background
 * - prefers-reduced-motion support
 */
export default function JoyJoinEmptyState({
  title,
  subtitle,
  xiaoyueExpression = 'coachGuide',
  action,
  children,
  className = '',
}: JoyJoinEmptyStateProps) {
  return (
    <View className={`joyjoin-empty-state ${className}`}>
      <View className='joyjoin-empty-state__content'>
        <Image
          className='joyjoin-empty-state__mascot'
          src={getXiaoyueExpressionAsset(xiaoyueExpression)}
          mode='aspectFit'
        />
        <Text className='joyjoin-empty-state__title'>{title}</Text>
        {subtitle ? (
          <Text className='joyjoin-empty-state__subtitle'>{subtitle}</Text>
        ) : null}
        {action ? (
          <Button
            variant='primary'
            className='joyjoin-empty-state__action'
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ) : null}
        {children ? (
          <View className='joyjoin-empty-state__extra'>{children}</View>
        ) : null}
      </View>
    </View>
  )
}
