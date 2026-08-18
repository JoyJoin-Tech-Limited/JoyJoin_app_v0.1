import { Text, View, Image } from '@tarojs/components'
import type { GroupAnalysisResponse } from '@shared/types/groupAnalysis'
import type { AIGCMeta } from '@shared/types/aiMeta'
import type { ChemistryTokens, ChemistryType, UnifiedRevealTokens } from '@shared/features/matching-status'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../hooks/useAIGCLabelsEnabled'
import ChemistryBadge from '../../components/mascot/ChemistryBadge'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import { MILESTONE_BADGES, type MilestoneBadgeKey } from '../../lib/milestoneBadges'

export interface UnifiedRevealCardProps {
  chemistryTokens: ChemistryTokens
  unifiedReveal: UnifiedRevealTokens | null
  leadIceBreaker: string | null
  introAngle?: string | null
  groupAnalysisDebugMeta?: Pick<GroupAnalysisResponse, 'fromCache' | 'generatedAt'> | null
  aigcMeta?: AIGCMeta
  relatedEventId?: string
}

// D4 — Map the 4 ChemistryType buckets to the 5 Batch D match-reason heroes.
// Without a per-pair reason, we celebrate the strongest bucket of chemistry.
const CHEMISTRY_TYPE_TO_MATCH_BADGE: Record<ChemistryType, MilestoneBadgeKey> = {
  fire: 'matchReasonExactArchetype',
  warm: 'matchReasonSameArchetypeBand',
  mild: 'matchReasonSameRelationship',
  cold: 'matchReasonSameWorkIndustry',
}

const MATCH_BADGE_LABELS: Record<MilestoneBadgeKey, string> = {
  matchReasonSameRelationship: '关系同步',
  matchReasonSameArchetypeBand: '同频共振',
  matchReasonSameWorkIndustry: '同行相遇',
  matchReasonExactArchetype: '一拍即合',
  matchReasonHometownIndustry: '故乡同行',
  firstEvent: '初次见面',
  streak3: '三场连击',
  quizHalfway: '已经一半了',
  recapStamp: '纪念章',
}

export default function UnifiedRevealCard({
  chemistryTokens,
  unifiedReveal,
  leadIceBreaker,
  introAngle,
  groupAnalysisDebugMeta,
  aigcMeta,
  relatedEventId,
}: UnifiedRevealCardProps) {
  const aigcLabelsEnabled = useAIGCLabelsEnabled()

  if (!unifiedReveal) {
    return null
  }

  const { headline, body, subtitle, groupTags, spotlight } = unifiedReveal
  const effectiveMeta = aigcMeta ?? { aiGenerated: true, labelType: 'ai-generated' as const }

  // D4 — Pick the Batch D match-reason hero that matches the overall chemistry bucket
  const matchBadgeKey = CHEMISTRY_TYPE_TO_MATCH_BADGE[chemistryTokens.iconRef]
  const matchBadgeSrc = MILESTONE_BADGES[matchBadgeKey]
  const matchBadgeLabel = MATCH_BADGE_LABELS[matchBadgeKey]

  return (
    <View className='unified-reveal'>
      {/* D4 — Batch D match-chemistry celebratory hero, paired with the existing 32rpx ChemistryBadge */}
      <View className='unified-reveal__d4-hero-wrap' aria-hidden>
        <Image
          className='unified-reveal__d4-hero'
          mode='aspectFit'
          src={matchBadgeSrc}
          ariaLabel=''
          lazyLoad
        />
        <Text className='unified-reveal__d4-hero-label'>{matchBadgeLabel}</Text>
      </View>

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
        <AIGCLabel meta={effectiveMeta} />
      </View>

      <Text className='unified-reveal__headline'>
        {spotlight ? `你和 ${spotlight.memberName} 最容易先聊开` : headline}
      </Text>

      {spotlight && spotlight.sharedHighlights.length > 0 ? (
        <View className='unified-reveal__highlights'>
          {spotlight.sharedHighlights.map((line, index) => (
            <View key={`highlight-${index}-${line}`} className='unified-reveal__highlight'>
              <Text className='unified-reveal__highlight-dot'>•</Text>
              <Text className='unified-reveal__highlight-text'>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

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

      {aigcLabelsEnabled ? (
        <AIContentReportButton
          options={{ reason: '举报匹配解读内容', relatedEventId }}
          className='unified-reveal__report-button'
        />
      ) : null}

      <GroupAnalysisSourceHint analysis={groupAnalysisDebugMeta ?? undefined} />
    </View>
  )
}
