import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import XiaoyueSpriteAnimator, { type XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import './XiaoyueCoachCard.scss'

interface XiaoyueCoachCardProps {
  step: number
  eyebrow: string
  title: string
  copy: string
  children?: React.ReactNode
  footer?: React.ReactNode
  userArchetype?: string
  className?: string
  visible?: boolean
  reduceMotion?: boolean
  spriteState?: XiaoyueSpriteState
  onSpriteComplete?: () => void
}

export default function XiaoyueCoachCard({
  step,
  eyebrow,
  title,
  copy,
  children,
  footer,
  userArchetype,
  className = '',
  visible = true,
  reduceMotion = false,
  spriteState = 'coach',
  onSpriteComplete,
}: XiaoyueCoachCardProps) {
  const archetypeTokens = useMemo(
    () => (userArchetype ? getArchetypeTokens(userArchetype) : null),
    [userArchetype],
  )

  const rootClasses = [
    'xiaoyue-coach-card',
    visible ? (reduceMotion ? 'xiaoyue-coach-card--visible' : 'xiaoyue-coach-card--enter') : 'xiaoyue-coach-card--hidden',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClasses}>
      <View className='xiaoyue-coach-card__mascot-wrap' aria-hidden='true'>
        <XiaoyueSpriteAnimator
          state={spriteState}
          size='112rpx'
          showGlow
          autoPlay
          transitionMs={300}
          onComplete={onSpriteComplete}
        />
      </View>

      <View className='xiaoyue-coach-card__paper'>
        <View className='xiaoyue-coach-card__tail' />
        <Text
          className='xiaoyue-coach-card__eyebrow'
          style={archetypeTokens ? { color: archetypeTokens.primary } : undefined}
        >
          {eyebrow}
        </Text>
        <Text className='xiaoyue-coach-card__title'>{title}</Text>
        <Text className='xiaoyue-coach-card__copy'>{copy}</Text>

        {children ? <View className='xiaoyue-coach-card__body'>{children}</View> : null}

        {footer ? (
          <View className='xiaoyue-coach-card__footer'>{footer}</View>
        ) : (
          <Text className='xiaoyue-coach-card__signoff'>—— {DEFAULT_MASCOT_DISPLAY_NAME}</Text>
        )}
      </View>
    </View>
  )
}
