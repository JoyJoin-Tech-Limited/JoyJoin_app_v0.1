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
  userSocialTag?: string
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
  userSocialTag,
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

  const resolvedTag = useMemo(() => {
    const raw = userSocialTag || userName || ''
    return stripEmojis(raw).trim()
  }, [userSocialTag, userName])

  const eyebrowText = resolvedTag
    ? `写给「${resolvedTag}」的小信`
    : archetypeName
      ? `写给「${archetypeName}」的小信`
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
      <View className={rootClasses} aria-busy='true' aria-label='悦仔正在准备活动简报'>
        <View className='xiaoyue-letter-card__paper xiaoyue-letter-card__paper--loading'>
          <View className='xiaoyue-letter-card__header'>
            <View className='xiaoyue-letter-card__mascot-wrap xiaoyue-letter-card__mascot-wrap--skeleton'>
              <View className='xiaoyue-letter-card__skeleton-mascot' />
            </View>
            <View className='xiaoyue-letter-card__title-block xiaoyue-letter-card__title-block--loading'>
              <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--medium' />
            </View>
          </View>
          <View className='xiaoyue-letter-card__skeleton-body'>
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--long' />
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--long' />
            <View className='xiaoyue-letter-card__skeleton-line xiaoyue-letter-card__skeleton-line--medium' />
            <View className='xiaoyue-letter-card__skeleton-chips'>
              <View className='xiaoyue-letter-card__skeleton-chip' />
              <View className='xiaoyue-letter-card__skeleton-chip' />
              <View className='xiaoyue-letter-card__skeleton-chip' />
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={rootClasses}>
      <View className='xiaoyue-letter-card__paper'>
        <View className='xiaoyue-letter-card__header'>
          <View
            className={[
              'xiaoyue-letter-card__mascot-wrap',
              visible && !reduceMotion ? 'xiaoyue-letter-card__mascot-wrap--bob' : '',
            ].join(' ')}
          >
            <XiaoyueSpriteAnimator
              state={spriteState}
              size='120rpx'
              showGlow
              autoPlay
              transitionMs={300}
            />
          </View>

          <View className='xiaoyue-letter-card__title-block'>
            <Text
              className='xiaoyue-letter-card__eyebrow'
              style={archetypeTokens ? { color: archetypeTokens.primary } : undefined}
            >
              {eyebrowText}
            </Text>
          </View>
        </View>

        <Text className='xiaoyue-letter-card__insight'>{cleanInsight}</Text>

        <Text className='xiaoyue-letter-card__promise'>{cleanPromise}</Text>

        {cleanReasons.length > 0 ? (
          <View className='xiaoyue-letter-card__reasons'>
            {cleanReasons.map((reason, index) => (
              <MatchPromiseChip key={`reason-${index}-${reason}`} reason={reason} index={index} animate={visible && !reduceMotion} />
            ))}
          </View>
        ) : null}

        <View className='xiaoyue-letter-card__trust-seal' aria-label={trustLabel}>
          <View className='xiaoyue-letter-card__trust-check' aria-hidden='true' />
          <Text className='xiaoyue-letter-card__trust-text'>{trustLabel}</Text>
        </View>

        <Text className='xiaoyue-letter-card__signoff'>—— {DEFAULT_MASCOT_DISPLAY_NAME}</Text>
      </View>
    </View>
  )
}
