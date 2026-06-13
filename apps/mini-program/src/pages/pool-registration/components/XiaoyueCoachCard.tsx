import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import XiaoyueSpriteAnimator from '../../../components/mascot/XiaoyueSpriteAnimator'
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
}: XiaoyueCoachCardProps) {
  const archetypeTokens = useMemo(
    () => (userArchetype ? getArchetypeTokens(userArchetype) : null),
    [userArchetype],
  )

  return (
    <View className={`xiaoyue-coach-card ${className}`}>
      <View className='xiaoyue-coach-card__mascot-wrap'>
        <XiaoyueSpriteAnimator
          state='coach'
          size='112rpx'
          showGlow
          autoPlay
          transitionMs={300}
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
