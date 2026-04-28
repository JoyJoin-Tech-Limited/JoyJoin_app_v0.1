import { View, Image, Text } from '@tarojs/components'

/**
 * ArchetypeHead — proprietary head icon for the 12 JoyJoin archetypes.
 *
 * Replaces user initials in avatar contexts. Shows the character's head
 * extracted from the full-body illustration at 40/80/120px (1×/2×/3×).
 *
 * Assets: assets/icons/archetype/archetype-{key}-head{@2x|@3x}.png
 */

interface ArchetypeHeadProps {
  archetype?: string | null
  size?: number // rpx
  fallback?: 'initial' | 'none'
  fallbackText?: string
}

const HEAD_PATHS: Record<string, string> = {
  corgi: '/assets/icons/archetype/archetype-corgi-head@3x.png',
  rooster: '/assets/icons/archetype/archetype-rooster-head@3x.png',
  hamster_praise: '/assets/icons/archetype/archetype-hamster_praise-head@3x.png',
  fox: '/assets/icons/archetype/archetype-fox-head@3x.png',
  dolphin_calm: '/assets/icons/archetype/archetype-dolphin_calm-head@3x.png',
  spider: '/assets/icons/archetype/archetype-spider-head@3x.png',
  koala: '/assets/icons/archetype/archetype-koala-head@3x.png',
  octopus: '/assets/icons/archetype/archetype-octopus-head@3x.png',
  owl: '/assets/icons/archetype/archetype-owl-head@3x.png',
  elephant: '/assets/icons/archetype/archetype-elephant-head@3x.png',
  turtle: '/assets/icons/archetype/archetype-turtle-head@3x.png',
  cat: '/assets/icons/archetype/archetype-cat-head@3x.png',
}

function getFallbackInitial(text?: string): string {
  if (!text) return '?'
  return text.charAt(0).toUpperCase()
}

export default function ArchetypeHead({
  archetype,
  size = 80,
  fallback = 'initial',
  fallbackText,
}: ArchetypeHeadProps) {
  const src = archetype ? HEAD_PATHS[archetype] : undefined
  const sizeStr = `${size}rpx`

  if (!src) {
    if (fallback === 'none') return null
    return (
      <View
        className='archetype-head archetype-head--fallback'
        style={{ width: sizeStr, height: sizeStr }}
      >
        <Text>{getFallbackInitial(fallbackText)}</Text>
      </View>
    )
  }

  return (
    <View className='archetype-head'>
      <Image
        src={src}
        mode='aspectFit'
        style={{ width: sizeStr, height: sizeStr }}
        lazyLoad={false}
      />
    </View>
  )
}
