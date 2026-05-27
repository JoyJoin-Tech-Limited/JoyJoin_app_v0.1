import { View, Text } from '@tarojs/components'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './ProfileArchetypeHero.scss'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily, ARCHETYPE_FAMILY_GRADIENTS } from '@shared/archetypeColors'

export interface ProfileArchetypeHeroProps {
  archetype?: string | null
  displayName: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { head: 64, padding: '24rpx 32rpx', gap: '16rpx' },
  md: { head: 100, padding: '32rpx 40rpx', gap: '24rpx' },
  lg: { head: 140, padding: '48rpx 40rpx', gap: '32rpx' },
}

/**
 * ProfileArchetypeHero — celebratory archetype card used across profile surfaces.
 *
 * Renders a gradient-backed card with the user's archetype head, name,
 * and archetype label. Used in profile tab, edit-profile preview, and
 * onboarding profile-review to maintain visual continuity.
 */
export default function ProfileArchetypeHero({
  archetype,
  displayName,
  size = 'md',
  showLabel = true,
  className = '',
}: ProfileArchetypeHeroProps) {
  const family = getArchetypeFamily(archetype)
  const gradient = ARCHETYPE_FAMILY_GRADIENTS[family]
  const archetypeName = archetype ? (ARCHETYPE_BY_ID[archetype]?.nameCn || archetype) : ''
  const dimensions = SIZE_MAP[size]

  return (
    <View
      className={`profile-archetype-hero ${className}`}
      style={{
        background: gradient,
        padding: dimensions.padding,
        borderRadius: size === 'lg' ? '40rpx' : '32rpx',
      }}
    >
      <View
        className='profile-archetype-hero__inner'
        style={{ gap: dimensions.gap }}
      >
        <ArchetypeHead archetype={archetype} size={dimensions.head} fallbackText={displayName} />
        <View className='profile-archetype-hero__text'>
          <Text className='profile-archetype-hero__name'>{displayName}</Text>
          {showLabel && archetypeName && (
            <Text className='profile-archetype-hero__archetype'>{archetypeName}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
