import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { ARCHETYPE_BY_ID } from '@shared/personality'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import XiaoyueSpriteAnimator from '../../../components/mascot/XiaoyueSpriteAnimator'
import MatchPromiseChip from './MatchPromiseChip'
import { stripEmojis } from '../../../lib/utils/emojiGuard'
import './XiaoyueLetterCard.scss'

interface XiaoyueLetterCardProps {
  insight: string
  matchingPromise: string
  reasons: string[]
  trustLabel: string
  userName?: string
  userArchetype?: string
  visible: boolean
  reduceMotion: boolean
  isLoading?: boolean
}

export default function XiaoyueLetterCard({
  insight,
  matchingPromise,
  reasons,
  trustLabel,
  userName,
  userArchetype,
  visible,
  reduceMotion,
  isLoading = false,
}: XiaoyueLetterCardProps) {
  const [spriteState, setSpriteState] = useState<'welcome' | 'coach'>('welcome')

  useEffect(() => {
    if (isLoading) return
    const timer = setTimeout(() => setSpriteState('coach'), 1400)
    return () => clearTimeout(timer)
  }, [isLoading])

  const archetypeTokens = useMemo(
    () => (userArchetype ? getArchetypeTokens(userArchetype) : null),
    [userArchetype],
  )
  const archetypeName = useMemo(
    () => (userArchetype ? ARCHETYPE_BY_ID[userArchetype]?.nameCn : null),
    [userArchetype],
  )

  const eyebrowText = archetypeName
    ? `写给${userName ? ` ${stripEmojis(userName)}` : ''}「${archetypeName}」的小信`
    : `加入前的一封小信`

  const cleanInsight = stripEmojis(insight)
  const cleanPromise = stripEmojis(matchingPromise)
  const cleanReasons = reasons.map(stripEmojis).filter(Boolean)

  const rootClasses = [
    'xiaoyue-letter-card',
    visible ? (reduceMotion ? 'xiaoyue-letter-card--visible' : 'xiaoyue-letter-card--enter') : 'xiaoyue-letter-card--hidden',
  ].join(' ')

  if (isLoading) {
    return (
      <View className={rootClasses}>
        <View className='xiaoyue-letter-card__paper xiaoyue-letter-card__paper--loading'>
          <View className='xiaoyue-letter-card__skeleton'>
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--long' />
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--medium' />
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--short' />
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--long' />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={rootClasses}>
      <View className='xiaoyue-letter-card__mascot-wrap'>
        <XiaoyueSpriteAnimator
          state={spriteState}
          size='120rpx'
          showGlow
          autoPlay
          transitionMs={300}
        />
      </View>

      <View className='xiaoyue-letter-card__paper'>
        <View className='xiaoyue-letter-card__tail' />
        <Text className='xiaoyue-letter-card__eyebrow' style={archetypeTokens ? { color: archetypeTokens.primary } : undefined}>
          {eyebrowText}
        </Text>
        <Text className='xiaoyue-letter-card__insight'>{cleanInsight}</Text>
        <Text className='xiaoyue-letter-card__promise'>{cleanPromise}</Text>

        {cleanReasons.length > 0 ? (
          <View className='xiaoyue-letter-card__reasons'>
            {cleanReasons.map((reason, index) => (
              <MatchPromiseChip key={reason} reason={reason} index={index} animate={visible && !reduceMotion} />
            ))}
          </View>
        ) : null}

        <View className='xiaoyue-letter-card__trust-seal'>
          <View className='xiaoyue-letter-card__trust-check' />
          <Text className='xiaoyue-letter-card__trust-text'>{trustLabel}</Text>
        </View>

        <Text className='xiaoyue-letter-card__signoff'>—— {DEFAULT_MASCOT_DISPLAY_NAME}</Text>
      </View>
    </View>
  )
}
