import { View, Text } from '@tarojs/components'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './ProfileArchetypeHero.scss'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily } from '@shared/archetypeColors'

export interface ProfileArchetypeHeroProps {
  archetype?: string | null
  displayName: string
  age?: number | string | null
  city?: string | null
  bio?: string | null
  /** One-line mutual-context copy rendered below the bio (e.g. connection cards). */
  contextLine?: string | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
  /** Called when the empty-bio CTA is tapped. */
  onBioCta?: () => void
}

const HEAD_SIZE_MAP = {
  sm: 64,
  md: 100,
  lg: 140,
}

function formatAge(age: number | string | null | undefined): string | null {
  if (age == null) return null
  const s = String(age).trim()
  if (s === '') return null
  // Preserve age-range strings like "25-29" returned by the connection API.
  if (/\D/.test(s)) {
    return s
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n}岁`
}

/**
 * ProfileArchetypeHero — celebratory archetype card used across profile surfaces.
 *
 * Renders a gradient-backed card with the user's archetype head, name,
 * archetype label, and optional richer metadata (age, city, bio).
 * Missing fields collapse cleanly so the card never shows placeholder gaps.
 */
export default function ProfileArchetypeHero({
  archetype,
  displayName,
  age,
  city,
  bio,
  contextLine,
  size = 'md',
  showLabel = true,
  className = '',
  onBioCta,
}: ProfileArchetypeHeroProps) {
  const family = getArchetypeFamily(archetype)
  const archetypeName = archetype ? (ARCHETYPE_BY_ID[archetype]?.nameCn || archetype) : ''

  const ageText = formatAge(age)
  const cityText = city && city.trim().length > 0 ? city.trim() : null
  const bioText = bio && bio.trim().length > 0 ? bio.trim() : null
  const hasMeta = Boolean(ageText || cityText)
  const showBioCta = !bioText && !!onBioCta

  return (
    <View
      className={`profile-archetype-hero profile-archetype-hero--${size} profile-archetype-hero--family-${family} ${className}`}
    >
      <View className='profile-archetype-hero__inner'>
        <ArchetypeHead archetype={archetype} size={HEAD_SIZE_MAP[size]} fallbackText={displayName} />
        <View className='profile-archetype-hero__text'>
          <Text className='profile-archetype-hero__name'>{displayName}</Text>
          {showLabel && archetypeName && (
            <Text className='profile-archetype-hero__archetype'>{archetypeName}</Text>
          )}

          {hasMeta && (
            <View className='profile-archetype-hero__meta'>
              {ageText && (
                <View className='profile-archetype-hero__chip'>
                  <Text className='profile-archetype-hero__chip-text'>{ageText}</Text>
                </View>
              )}
              {cityText && (
                <View className='profile-archetype-hero__chip'>
                  <Text className='profile-archetype-hero__chip-text'>{cityText}</Text>
                </View>
              )}
            </View>
          )}

          {bioText && (
            <Text className='profile-archetype-hero__bio'>{bioText}</Text>
          )}

          {showBioCta && (
            <View
              className='profile-archetype-hero__bio-cta'
              hoverClass='profile-archetype-hero__bio-cta--pressed'
              onClick={onBioCta}
              aria-label='写一句你的社交签名'
            >
              <Text className='profile-archetype-hero__bio-cta-text'>
                写一句你的社交签名，让别人一眼记住你
              </Text>
              <View className='profile-archetype-hero__bio-cta-chevron' />
            </View>
          )}

          {contextLine && (
            <Text className='profile-archetype-hero__context'>{contextLine}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
