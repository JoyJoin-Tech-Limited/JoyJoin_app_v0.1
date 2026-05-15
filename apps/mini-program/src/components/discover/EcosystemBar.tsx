import { View, Text } from '@tarojs/components'
import ArchetypeGlyph from '../mascot/ArchetypeGlyph'
import { getArchetypeFamily, ARCHETYPE_FAMILY_COLORS } from '@shared/archetypeColors'

interface EcosystemBarProps {
  archetypes: string[]
  userArchetype: string | null
  registrationCount: number
}

export default function EcosystemBar({
  archetypes,
  userArchetype,
  registrationCount,
}: EcosystemBarProps) {
  const visible = archetypes.slice(0, 5)
  const hasMore = registrationCount > visible.length
  const moreCount = hasMore ? registrationCount - visible.length : 0
  const emptyLabel = registrationCount > 0
    ? `${registrationCount} 位探索者已入池`
    : '首批入池位置待点亮'

  return (
    <View className='ecosystem-bar'>
      <View className='ecosystem-bar__glyphs'>
        {visible.length === 0 ? (
          <View className='ecosystem-bar__empty-state'>
            <View className='ecosystem-bar__empty-glyph' />
            <Text className='ecosystem-bar__empty'>{emptyLabel}</Text>
          </View>
        ) : visible.map((archetype, index) => {
          const isUser = archetype === userArchetype
          const family = getArchetypeFamily(archetype)
          const highlightColor = ARCHETYPE_FAMILY_COLORS[family] || '#8B5CF6'

          return (
            <View
              key={`${archetype}-${index}`}
              className='ecosystem-bar__glyph-wrap'
              style={index > 0 ? { marginLeft: '-10rpx' } : {}}
            >
              <ArchetypeGlyph
                archetype={archetype}
                size={40}
                highlighted={isUser}
                highlightColor={highlightColor}
              />
            </View>
          )
        })}

        {visible.length > 0 && hasMore && (
          <Text className='ecosystem-bar__more'>+{moreCount}</Text>
        )}
      </View>
    </View>
  )
}
