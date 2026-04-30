import { Text, View } from '@tarojs/components'
import type { GroupAnalysisResponse } from '@shared/types/groupAnalysis'
import ChemistryBadge from '../../components/ChemistryBadge'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import type { ChemistryTokens, UnifiedRevealTokens } from './matchingStatusViewModels'

export interface UnifiedRevealCardProps {
  chemistryTokens: ChemistryTokens
  unifiedReveal: UnifiedRevealTokens | null
  leadIceBreaker: string | null
  introAngle?: string | null
  groupAnalysisDebugMeta?: Pick<GroupAnalysisResponse, 'fromCache' | 'generatedAt'> | null
}

export default function UnifiedRevealCard({
  chemistryTokens,
  unifiedReveal,
  leadIceBreaker,
  introAngle,
  groupAnalysisDebugMeta,
}: UnifiedRevealCardProps) {
  if (!unifiedReveal) {
    return null
  }

  const { headline, body, subtitle, groupTags, spotlight } = unifiedReveal

  return (
    <View className='unified-reveal'>
      <View className='unified-reveal__top'>
        <View className='unified-reveal__badge-row'>
          <ChemistryBadge
            chemistry={chemistryTokens.iconRef}
            size={32}
            className='unified-reveal__badge'
          />
          <Text className='unified-reveal__label'>{chemistryTokens.label}</Text>
        </View>
        {spotlight?.chemistryScore ? (
          <Text className='unified-reveal__score'>默契 {spotlight.chemistryScore}</Text>
        ) : null}
      </View>

      <Text className='unified-reveal__headline'>
        {spotlight ? `你和 ${spotlight.memberName} 最容易先聊开` : headline}
      </Text>

      <Text className='unified-reveal__body'>{body}</Text>

      {subtitle ? (
        <Text className='unified-reveal__subtitle'>{subtitle}</Text>
      ) : null}

      {introAngle ? (
        <Text className='unified-reveal__intro-angle'>开场：{introAngle}</Text>
      ) : null}

      {spotlight?.connectionPointsWithRarity.length ? (
        <View className='unified-reveal__pill-row'>
          {spotlight.connectionPointsWithRarity.slice(0, 3).map((point, index) => (
            <ConnectionPointPill key={`cp-${index}-${point.text}`} text={point.text} rarity={point.rarity} />
          ))}
        </View>
      ) : groupTags.length ? (
        <View className='unified-reveal__pill-row'>
          {groupTags.slice(0, 3).map((tag, index) => (
            <ConnectionPointPill key={`tag-${index}-${tag}`} text={tag} rarity='common' />
          ))}
        </View>
      ) : null}

      {leadIceBreaker ? (
        <Text className='unified-reveal__prompt'>破冰建议：{leadIceBreaker}</Text>
      ) : null}

      <GroupAnalysisSourceHint analysis={groupAnalysisDebugMeta ?? undefined} />
    </View>
  )
}
