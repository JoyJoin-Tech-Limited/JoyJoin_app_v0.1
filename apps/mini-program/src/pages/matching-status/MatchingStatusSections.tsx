import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { PoolGroupDetailsResponse } from '@shared/api'
import type { GroupAnalysisResponse, PairExplanation } from '@shared/types/groupAnalysis'
import Button from '../../components/Button'
import Card from '../../components/Card'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
import {
  getVibeLabel,
  MATCHING_BG_SRC,
  type ChemistryTokens,
  type LiveRevealStage,
  type TemperatureCopy,
  type ThemeSummary,
  type ViewerPairSpotlight,
  type WaitingSeatViewModel,
  type WaitingStateCopy,
} from './matchingStatusViewModels'

export function MatchingHero({ heroSrc, className = '' }: { heroSrc: string; className?: string }) {
  return (
    <View className={`matching-status__hero${className ? ` ${className}` : ''}`}>
      <Image className='matching-status__hero-bg' src={MATCHING_BG_SRC} mode='aspectFill' lazyLoad />
      <View className='matching-status__hero-glow' />
      <Image className='matching-status__hero-image' src={heroSrc} mode='aspectFit' lazyLoad />
    </View>
  )
}

interface MatchingStatusPendingSectionProps {
  newMemberJoined: boolean
  newMemberArchetype: string | null
  waitingCopy: WaitingStateCopy
  currentFill: number
  maxGroupSize: number
  minGroupSize: number
  seatsNeeded: number
  waitingSeats: WaitingSeatViewModel[]
  fillStatusText: string
  refreshCountdown: number
  onRefreshWaitingState: () => void
}

export function MatchingStatusPendingSection({
  newMemberJoined,
  newMemberArchetype,
  waitingCopy,
  currentFill,
  maxGroupSize,
  minGroupSize,
  seatsNeeded,
  waitingSeats,
  fillStatusText,
  refreshCountdown,
  onRefreshWaitingState,
}: MatchingStatusPendingSectionProps) {
  return (
    <>
      {newMemberJoined ? (
        <View className='matching-status__arrival-toast'>
          <Text className='matching-status__arrival-emoji'>✨</Text>
          <Text className='matching-status__arrival-text'>
            {newMemberArchetype ? `${newMemberArchetype} 刚刚入座了` : '刚有新朋友加入这桌'}
          </Text>
        </View>
      ) : null}

      <Card className='matching-status__waiting-card'>
        <View className='matching-status__waiting-top'>
          <Image
            className='matching-status__waiting-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('matchWaiting')}
          />
          {waitingCopy.badge ? (
            <Text className='matching-status__waiting-badge'>{waitingCopy.badge}</Text>
          ) : null}
          <Text className='matching-status__waiting-title'>{waitingCopy.headline}</Text>
          <Text className='matching-status__waiting-copy'>{waitingCopy.subtext}</Text>
        </View>

        <View className='matching-status__waiting-progress-top'>
          <Text className='matching-status__waiting-progress-label'>成桌进度</Text>
          <Text className='matching-status__waiting-progress-count'>
            {currentFill}/{maxGroupSize} 人
          </Text>
        </View>

        <View className='matching-status__waiting-scene'>
          <View className='matching-status__waiting-orbit matching-status__waiting-orbit--outer' />
          <View className='matching-status__waiting-orbit matching-status__waiting-orbit--inner' />

          <View className='matching-status__waiting-table'>
            <Text className='matching-status__waiting-table-eyebrow'>正在聚齐</Text>
            <Text className='matching-status__waiting-table-count'>
              {currentFill}/{maxGroupSize}
            </Text>
            <Text className='matching-status__waiting-table-copy'>
              {currentFill >= minGroupSize ? '已经够开桌了' : `还差 ${seatsNeeded} 位成桌`}
            </Text>
          </View>

          {waitingSeats.map((seat) => (
            <View
              key={`seat-${seat.seatNumber}`}
              className={[
                'matching-status__waiting-seat',
                seat.layoutClassName,
                seat.isFilled ? 'matching-status__waiting-seat--filled' : '',
                seat.isThreshold ? 'matching-status__waiting-seat--threshold' : '',
                seat.isBonusSeat ? 'matching-status__waiting-seat--bonus' : '',
                seat.isNewest ? 'matching-status__waiting-seat--new' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <View className='matching-status__waiting-seat-core'>
                <Text className='matching-status__waiting-seat-mark'>{seat.seatMark}</Text>
              </View>
              {seat.caption ? (
                <Text className='matching-status__waiting-seat-caption'>{seat.caption}</Text>
              ) : null}
            </View>
          ))}

          {newMemberJoined ? (
            <View className='matching-status__waiting-seat-burst'>
              <Text className='matching-status__waiting-seat-burst-emoji'>✨</Text>
              <Text className='matching-status__waiting-seat-burst-text'>
                {newMemberArchetype ? `${newMemberArchetype} 刚入座` : '这桌刚多了一位新朋友'}
              </Text>
            </View>
          ) : null}
        </View>

        <View className='matching-status__waiting-metrics'>
          <View className='matching-status__waiting-metric'>
            <Text className='matching-status__waiting-metric-label'>已入座</Text>
            <Text className='matching-status__waiting-metric-value'>{currentFill} 位</Text>
          </View>
          <View className='matching-status__waiting-metric'>
            <Text className='matching-status__waiting-metric-label'>成桌门槛</Text>
            <Text className='matching-status__waiting-metric-value'>{minGroupSize} 位</Text>
          </View>
          <View className='matching-status__waiting-metric'>
            <Text className='matching-status__waiting-metric-label'>满员上限</Text>
            <Text className='matching-status__waiting-metric-value'>{maxGroupSize} 位</Text>
          </View>
        </View>

        <Text className='matching-status__waiting-progress-status'>{fillStatusText}</Text>

        <View className='matching-status__waiting-refresh'>
          <Text className='matching-status__waiting-refresh-copy'>
            自动刷新中，约 {refreshCountdown}s 后同步最新进度
          </Text>
          <Button
            variant='secondary'
            className='matching-status__waiting-refresh-btn'
            onClick={onRefreshWaitingState}
          >
            立即刷新
          </Button>
        </View>

        <Text className='matching-status__waiting-hint'>{waitingCopy.nextStepHint}</Text>
      </Card>
    </>
  )
}

interface MatchingStatusDetailSectionsProps {
  showMatchedDetails: boolean
  showChemistryCard: boolean
  effectiveGroupDetails: PoolGroupDetailsResponse | null
  viewerPairSummaryByMemberId: Map<string, PairExplanation>
  viewerSpotlight: ViewerPairSpotlight | null
  chemistryTokens: ChemistryTokens
  leadIceBreaker: string | null
  persistedThemeSummary: ThemeSummary | null
  /** WP4: optional; when set, dev/beta may show cache vs fresh for group analysis */
  groupAnalysisDebugMeta?: Pick<GroupAnalysisResponse, 'fromCache' | 'generatedAt'> | null
}

export function MatchingStatusDetailSections({
  showMatchedDetails,
  showChemistryCard,
  effectiveGroupDetails,
  viewerPairSummaryByMemberId,
  viewerSpotlight,
  chemistryTokens,
  leadIceBreaker,
  persistedThemeSummary,
  groupAnalysisDebugMeta,
}: MatchingStatusDetailSectionsProps) {
  return (
    <>
      {showMatchedDetails && effectiveGroupDetails?.members.length ? (
        <Card className='matching-status__squad-card'>
          <View className='matching-status__squad-header'>
            <Text className='matching-status__squad-title'>你的桌友已就位</Text>
            <Text className='matching-status__squad-meta'>
              {effectiveGroupDetails.group.memberCount || effectiveGroupDetails.members.length} 人同桌
            </Text>
          </View>
          <ScrollView className='matching-status__member-scroll' scrollX enhanced showScrollbar={false}>
            <View className='matching-status__member-row'>
              {effectiveGroupDetails.members.map((member) => {
                const pairSummary = viewerPairSummaryByMemberId.get(member.userId)

                return (
                  <View key={member.userId} className='matching-status__member-chip'>
                    <Text className='matching-status__member-initial'>
                      {(member.displayName ?? '神').slice(0, 1)}
                    </Text>
                    <Text className='matching-status__member-name'>
                      {member.displayName ?? '神秘嘉宾'}
                    </Text>
                    {pairSummary?.connectionPoints?.[0] ? (
                      <Text className='matching-status__member-signal'>
                        {pairSummary.connectionPoints[0]}
                      </Text>
                    ) : member.archetype ? (
                      <Text className='matching-status__member-archetype'>{member.archetype}</Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      {showChemistryCard ? (
        <Card className='matching-status__chemistry-card'>
          <View className='matching-status__chemistry-top'>
            <View className='matching-status__chemistry-badge'>
              <Text className='matching-status__chemistry-emoji'>{chemistryTokens.emoji}</Text>
              <Text className='matching-status__chemistry-badge-text'>{chemistryTokens.label}</Text>
            </View>
            {viewerSpotlight ? (
              <Text className='matching-status__chemistry-score'>默契 {viewerSpotlight.pair.chemistryScore}</Text>
            ) : null}
          </View>

          <Text className='matching-status__chemistry-title'>
            {viewerSpotlight
              ? `你和 ${viewerSpotlight.otherMemberName} 最容易先聊开`
              : '这桌的聊天化学反应已经有了'}
          </Text>
          <Text className='matching-status__chemistry-copy'>
            {viewerSpotlight?.pair.explanation ?? chemistryTokens.body}
          </Text>
          {viewerSpotlight?.pair.introAngle ? (
            <Text className='matching-status__chemistry-intro-angle'>
              开场：{viewerSpotlight.pair.introAngle}
            </Text>
          ) : null}

          {viewerSpotlight?.pair.connectionPoints?.length ? (
            <View className='matching-status__chemistry-pill-row'>
              {viewerSpotlight.pair.connectionPoints.slice(0, 3).map((point) => (
                <View key={point} className='matching-status__chemistry-pill'>
                  <Text className='matching-status__chemistry-pill-text'>{point}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {leadIceBreaker ? (
            <Text className='matching-status__chemistry-prompt'>破冰建议：{leadIceBreaker}</Text>
          ) : null}
          <GroupAnalysisSourceHint analysis={groupAnalysisDebugMeta ?? undefined} />
        </Card>
      ) : null}

      {persistedThemeSummary ? (
        <Card className='matching-status__theme-card'>
          <View className='matching-status__theme-header'>
            {persistedThemeSummary.emoji ? (
              <Text className='matching-status__theme-emoji'>{persistedThemeSummary.emoji}</Text>
            ) : null}
            <Text className='matching-status__theme-title'>{persistedThemeSummary.title}</Text>
          </View>

          {persistedThemeSummary.subtitle ? (
            <Text className='matching-status__theme-tagline'>{persistedThemeSummary.subtitle}</Text>
          ) : null}

          {persistedThemeSummary.vibe ? (
            <View className='matching-status__theme-vibe'>
              <Text className='matching-status__theme-vibe-label'>氛围：</Text>
              <Text className='matching-status__theme-vibe-value'>
                {getVibeLabel(persistedThemeSummary.vibe)}
              </Text>
            </View>
          ) : null}

          {persistedThemeSummary.highlights.length > 0 ? (
            <View className='matching-status__theme-highlights'>
              {persistedThemeSummary.highlights.map((highlight, index) => (
                <View key={`${highlight}-${index}`} className='matching-status__theme-highlight'>
                  <Text className='matching-status__theme-highlight-dot'>•</Text>
                  <Text className='matching-status__theme-highlight-text'>{highlight}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}
    </>
  )
}

interface MatchingStatusLiveOverlayProps {
  liveStage: LiveRevealStage
  stageTemperature: TemperatureCopy
  isLoadingLiveGroupDetails: boolean
  effectiveGroupDetails: PoolGroupDetailsResponse | null
  viewerPairSummaryByMemberId: Map<string, PairExplanation>
  viewerSpotlight: ViewerPairSpotlight | null
  matchedGroupNumber?: number | null
  shouldReduceMotion: boolean
  persistedThemeSummary: ThemeSummary | null
  resolvedGroupId: string
  onContinueFromMembers: () => void
  onFinishLiveJourney: () => void
}

export function MatchingStatusLiveOverlay({
  liveStage,
  stageTemperature,
  isLoadingLiveGroupDetails,
  effectiveGroupDetails,
  viewerPairSummaryByMemberId,
  viewerSpotlight,
  matchedGroupNumber,
  shouldReduceMotion,
  persistedThemeSummary,
  resolvedGroupId,
  onContinueFromMembers,
  onFinishLiveJourney,
}: MatchingStatusLiveOverlayProps) {
  if (liveStage === 'idle') {
    return null
  }

  const resolvedGroupNumber = matchedGroupNumber ?? effectiveGroupDetails?.group.groupNumber ?? null

  return (
    <View className='matching-status__overlay'>
      <View className='matching-status__overlay-backdrop' />

      {liveStage === 'match' ? (
        <View className='matching-status__overlay-card'>
          <Text className='matching-status__overlay-eyebrow'>小悦来报喜</Text>
          <Text className='matching-status__overlay-emoji'>{stageTemperature.emoji}</Text>
          <Text className='matching-status__overlay-title'>{stageTemperature.label}</Text>
          <Text className='matching-status__overlay-copy'>{stageTemperature.body}</Text>
          <Text className='matching-status__overlay-loading'>
            {isLoadingLiveGroupDetails ? '正在同步桌友卡片…' : '准备开始揭晓'}
          </Text>
        </View>
      ) : null}

      {liveStage === 'members' && effectiveGroupDetails ? (
        <View className='matching-status__overlay-card matching-status__overlay-card--members'>
          <Text className='matching-status__overlay-eyebrow'>先看桌友</Text>
          <Text className='matching-status__overlay-title'>这一桌已经为你留好位置</Text>
          <Text className='matching-status__overlay-copy'>
            {viewerSpotlight
              ? `第 ${resolvedGroupNumber} 组已锁定。你和 ${viewerSpotlight.otherMemberName} 会先从「${viewerSpotlight.pair.connectionPoints?.[0] ?? '一个共同话题'}」聊开。`
              : `第 ${resolvedGroupNumber} 组已锁定，先认识一下今晚会同桌的人。`}
          </Text>

          <View className='matching-status__overlay-member-grid'>
            {effectiveGroupDetails.members.map((member, index) => {
              const pairSummary = viewerPairSummaryByMemberId.get(member.userId)

              return (
                <View
                  key={member.userId}
                  className='matching-status__overlay-member-card'
                  style={{ animationDelay: shouldReduceMotion ? '0ms' : `${index * 120}ms` }}
                >
                  <Text className='matching-status__overlay-member-initial'>
                    {(member.displayName ?? '神').slice(0, 1)}
                  </Text>
                  <Text className='matching-status__overlay-member-name'>
                    {member.displayName ?? '神秘嘉宾'}
                  </Text>
                  {pairSummary?.connectionPoints?.[0] ? (
                    <Text className='matching-status__overlay-member-note'>
                      {pairSummary.connectionPoints[0]}
                    </Text>
                  ) : pairSummary ? (
                    <Text className='matching-status__overlay-member-note'>
                      默契度 {pairSummary.chemistryScore}
                    </Text>
                  ) : member.archetype ? (
                    <Text className='matching-status__overlay-member-note'>{member.archetype}</Text>
                  ) : null}
                </View>
              )
            })}
          </View>

          <Button className='matching-status__overlay-button' onClick={onContinueFromMembers}>
            {persistedThemeSummary ? '看看今晚主题' : '前往完整详情'}
          </Button>
        </View>
      ) : null}

      {liveStage === 'theme' && persistedThemeSummary ? (
        <View className='matching-status__overlay-card matching-status__overlay-card--theme'>
          <Text className='matching-status__overlay-eyebrow'>今晚的桌面主题</Text>
          {persistedThemeSummary.emoji ? (
            <Text className='matching-status__overlay-emoji'>{persistedThemeSummary.emoji}</Text>
          ) : null}
          <Text className='matching-status__overlay-title'>{persistedThemeSummary.title}</Text>
          {persistedThemeSummary.subtitle ? (
            <Text className='matching-status__overlay-copy'>{persistedThemeSummary.subtitle}</Text>
          ) : null}
          {persistedThemeSummary.vibe ? (
            <Text className='matching-status__overlay-tag'>
              {getVibeLabel(persistedThemeSummary.vibe)}
            </Text>
          ) : null}
          {persistedThemeSummary.highlights.length > 0 ? (
            <View className='matching-status__overlay-highlight-list'>
              {persistedThemeSummary.highlights.map((highlight, index) => (
                <Text key={`${highlight}-${index}`} className='matching-status__overlay-highlight-item'>
                  · {highlight}
                </Text>
              ))}
            </View>
          ) : null}
          <Text className='matching-status__overlay-next-step'>
            主题已经落定，下一页继续看完整时间、地点和这桌的出席安排。
          </Text>
          <Button className='matching-status__overlay-button' onClick={onFinishLiveJourney}>
            {resolvedGroupId ? '查看完整活动详情' : '继续前往下一步'}
          </Button>
        </View>
      ) : null}
    </View>
  )
}