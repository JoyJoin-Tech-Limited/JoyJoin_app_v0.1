import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { PoolGroupDetailsResponse } from '@shared/api'
import type { GroupAnalysisResponse, PairExplanation } from '@shared/types/groupAnalysis'
import { useEffect, useState } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import {
  type ChemistryTokens,
  type LiveRevealStage,
  type TemperatureCopy,
  type ThemeSummary,
  type ViewerPairSpotlight,
  type WaitingSeatViewModel,
  type WaitingStateCopy,
  type UnifiedRevealTokens,
} from '@shared/features/matching-status'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import AIGCLabel from '../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../hooks/useAIGCLabelsEnabled'
import ChemistryBadge from '../../components/mascot/ChemistryBadge'
import UnifiedRevealCard from './UnifiedRevealCard'
import AbstractPuzzleTable from './components/AbstractPuzzleTable'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { haptics } from '../../lib/utils/haptics'
import { PUZZLE_PIECE_COUNT } from '../../lib/utils/matchingPuzzleAssets'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import { getVibeLabel } from '../../lib/matching/groupDisplay'
import { MATCHING_BG_SRC } from './constants'

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
  shouldReduceMotion: boolean
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
  shouldReduceMotion,
}: MatchingStatusPendingSectionProps) {
  return (
    <>
      <Card className='matching-status__waiting-card'>
        <View className='matching-status__waiting-top'>
          <View className='matching-status__waiting-mascot'>
            <Image
              className='matching-status__waiting-mascot-img'
              src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-match-waiting.webp')}
              mode='aspectFit'
              lazyLoad
            />
          </View>
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
          {!shouldReduceMotion && (
            <>
              <View className='matching-status__waiting-orbit matching-status__waiting-orbit--outer' />
              <View className='matching-status__waiting-orbit matching-status__waiting-orbit--inner' />
            </>
          )}

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
                seat.isNewest && !shouldReduceMotion ? 'matching-status__waiting-seat--new' : '',
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
              <JoyJoinIcon emoji='✨' tier='chemistry' size={32} className='matching-status__waiting-seat-burst-emoji' />
              <Text className='matching-status__waiting-seat-burst-text'>
                {newMemberArchetype ? `${newMemberArchetype} 刚入座` : '这桌刚多了一位新朋友'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text className='matching-status__waiting-progress-status'>{fillStatusText}</Text>

        <Text className='matching-status__waiting-refresh-copy'>
          自动刷新中，约 {refreshCountdown}s 后同步最新进度
        </Text>

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
  unifiedReveal: UnifiedRevealTokens | null
  leadIceBreaker: string | null
  persistedThemeSummary: ThemeSummary | null
  viewerArchetype?: string | null
  /** WP4: optional; when set, dev/beta may show cache vs fresh for group analysis */
  groupAnalysisDebugMeta?: Pick<GroupAnalysisResponse, 'fromCache' | 'generatedAt'> | null
  groupAnalysis?: GroupAnalysisResponse | null
  relatedEventId?: string
}

export function MatchingStatusDetailSections({
  showMatchedDetails,
  showChemistryCard,
  effectiveGroupDetails,
  viewerPairSummaryByMemberId,
  viewerSpotlight,
  chemistryTokens,
  unifiedReveal,
  leadIceBreaker,
  persistedThemeSummary,
  viewerArchetype,
  groupAnalysisDebugMeta,
  groupAnalysis,
  relatedEventId,
}: MatchingStatusDetailSectionsProps) {
  const aigcLabelsEnabled = useAIGCLabelsEnabled()
  return (
    <>
      {showMatchedDetails && effectiveGroupDetails?.members.length ? (
        <Card className='matching-status__squad-card'>
          <View className='matching-status__squad-header'>
            <View className='matching-status__squad-header-left'>
              <ArchetypeHead archetype={viewerArchetype ?? 'corgi'} size={28} className='matching-status__squad-title-icon' variant='head' />
              <Text className='matching-status__squad-title'>你的桌友已就位</Text>
            </View>
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
                    <View className='matching-status__member-avatar'>
                      <ArchetypeHead
                        archetype={member.archetype}
                        size={56}
                        variant='sd'
                        fallbackText={member.displayName ?? undefined}
                      />
                    </View>
                    <Text className='matching-status__member-name'>
                      {member.displayName ?? '神秘嘉宾'}
                    </Text>
                    {pairSummary?.connectionPointsWithRarity?.[0]?.text ?? pairSummary?.connectionPoints?.[0] ? (
                      <Text className='matching-status__member-signal'>
                        {pairSummary.connectionPointsWithRarity?.[0]?.text ?? pairSummary.connectionPoints?.[0]}
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      {showChemistryCard && unifiedReveal ? (
        <Card className='matching-status__chemistry-card'>
          <UnifiedRevealCard
            chemistryTokens={chemistryTokens}
            unifiedReveal={unifiedReveal}
            leadIceBreaker={leadIceBreaker}
            introAngle={viewerSpotlight?.pair.introAngle ?? null}
            groupAnalysisDebugMeta={groupAnalysisDebugMeta ?? undefined}
            aigcMeta={groupAnalysis?.meta?.aigc}
            relatedEventId={relatedEventId}
          />
        </Card>
      ) : null}

      {persistedThemeSummary ? (
        <Card className='matching-status__theme-card'>
          <View className='matching-status__theme-header'>
            {persistedThemeSummary.emoji ? (
              <JoyJoinIcon emoji={persistedThemeSummary.emoji} size={32} className='matching-status__theme-emoji' />
            ) : null}
            <Text className='matching-status__theme-title'>{persistedThemeSummary.title}</Text>
            <AIGCLabel meta={{ aiGenerated: true, labelType: 'ai-generated' }} />
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

          {aigcLabelsEnabled ? (
            <AIContentReportButton
              options={{ reason: '举报桌面主题内容', relatedEventId }}
              className='matching-status__theme-report-button'
            />
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
  unifiedReveal: UnifiedRevealTokens | null
  matchedGroupNumber?: number | null
  shouldReduceMotion: boolean
  hasRevealed: boolean
  puzzlePreludeEnabled: boolean
  persistedThemeSummary: ThemeSummary | null
  resolvedGroupId: string
  liveRevealError: string | null
  relatedEventId?: string
  onStartSquadUnboxing: () => void
  onContinueFromMembers: () => void
  onFinishLiveJourney: () => void
  onRetryLiveReveal: () => void
  onDismissLiveReveal: () => void
}

export function MatchingStatusLiveOverlay({
  liveStage,
  stageTemperature,
  isLoadingLiveGroupDetails,
  effectiveGroupDetails,
  viewerPairSummaryByMemberId,
  viewerSpotlight,
  unifiedReveal,
  matchedGroupNumber,
  shouldReduceMotion,
  hasRevealed,
  puzzlePreludeEnabled,
  persistedThemeSummary,
  resolvedGroupId,
  liveRevealError,
  relatedEventId,
  onStartSquadUnboxing,
  onContinueFromMembers,
  onFinishLiveJourney,
  onRetryLiveReveal,
  onDismissLiveReveal,
}: MatchingStatusLiveOverlayProps) {
  const aigcLabelsEnabled = useAIGCLabelsEnabled()
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(shouldReduceMotion || puzzlePreludeEnabled === false)
  const showPuzzlePrelude = puzzlePreludeEnabled && !hasRevealed && effectiveGroupDetails != null
  const memberCount = effectiveGroupDetails?.members.length ?? 0

  useEffect(() => {
    if (showPuzzlePrelude) {
      squadUnboxingAnalytics.track('match_reveal_prelude_started', {
        groupId: resolvedGroupId,
        screen: 'matching-status',
        variant: 'puzzle_prelude',
        memberCount,
      })
    }
  }, [memberCount, resolvedGroupId, showPuzzlePrelude])

  if (liveStage === 'idle') {
    return null
  }

  const resolvedGroupNumber = matchedGroupNumber ?? effectiveGroupDetails?.group.groupNumber ?? null

  return (
    <View className='matching-status__overlay'>
      <View className='matching-status__overlay-backdrop' />

      {liveStage === 'match' && !liveRevealError ? (
        <View className='matching-status__overlay-card' key='match'>
          <Text className='matching-status__overlay-eyebrow'>{`${DEFAULT_MASCOT_DISPLAY_NAME}来报喜`}</Text>
          <Text className='matching-status__overlay-emoji'>
            <ChemistryBadge chemistry={stageTemperature.iconRef} size={48} />
          </Text>
          <Text className='matching-status__overlay-title'>{stageTemperature.label}</Text>
          <Text className='matching-status__overlay-copy'>{stageTemperature.body}</Text>
          {isLoadingLiveGroupDetails ? (
            <Text className='matching-status__overlay-loading'>正在同步桌友卡片…</Text>
          ) : resolvedGroupId ? (
            <Button
              className='matching-status__overlay-button'
              onClick={() => {
                haptics('medium')
                onStartSquadUnboxing()
              }}
            >
              准备开始揭晓
            </Button>
          ) : (
            <Text className='matching-status__overlay-loading'>正在确认小队信息…</Text>
          )}
        </View>
      ) : null}

      {liveStage === 'match' && liveRevealError ? (
        <View className='matching-status__overlay-card matching-status__overlay-card--error' key='match-error'>
          <Text className='matching-status__overlay-eyebrow'>揭晓遇到小状况</Text>
          <Text className='matching-status__overlay-emoji'>😅</Text>
          <Text className='matching-status__overlay-title'>桌友卡片还在路上</Text>
          <Text className='matching-status__overlay-copy'>{liveRevealError}</Text>
          <View className='matching-status__overlay-actions'>
            <Button className='matching-status__overlay-button' onClick={onRetryLiveReveal}>
              重新加载
            </Button>
            <Button
              variant='secondary'
              className='matching-status__overlay-dismiss-btn'
              onClick={onDismissLiveReveal}
            >
              先看其他信息
            </Button>
          </View>
        </View>
      ) : null}

      {liveStage === 'members' && effectiveGroupDetails ? (
        <View className='matching-status__overlay-card matching-status__overlay-card--members' key='members'>
          {showPuzzlePrelude ? (
            <>
              <Text className='matching-status__prelude-eyebrow'>碎片归位</Text>
              <Text className='matching-status__prelude-title'>
                {isPuzzleComplete
                  ? `第 ${resolvedGroupNumber} 组已经成型`
                  : `第 ${resolvedGroupNumber} 组正在成型`}
              </Text>
              <Text className='matching-status__prelude-copy'>
                {isPuzzleComplete
                  ? '这桌的伙伴已经到齐，准备好揭晓了吗？'
                  : '悦仔正在把这一桌的碎片拼起来…'}
              </Text>

              <AbstractPuzzleTable
                pieceCount={PUZZLE_PIECE_COUNT}
                shouldReduceMotion={shouldReduceMotion}
                onPhaseChange={(phase) => {
                  if (phase === 'complete') {
                    setIsPuzzleComplete(true)
                    squadUnboxingAnalytics.track('match_reveal_prelude_completed', {
                      groupId: resolvedGroupId,
                      screen: 'matching-status',
                      variant: 'puzzle_prelude',
                      memberCount,
                    })
                  }
                }}
                onSkip={() => {
                  setIsPuzzleComplete(true)
                  squadUnboxingAnalytics.track('match_reveal_prelude_skipped', {
                    groupId: resolvedGroupId,
                    screen: 'matching-status',
                    variant: 'puzzle_prelude',
                    memberCount,
                  })
                }}
              />

              <Button
                className='matching-status__overlay-button'
                onClick={() => {
                  haptics('medium')
                  squadUnboxingAnalytics.track('match_reveal_prelude_cta_tapped', {
                    groupId: resolvedGroupId,
                    screen: 'matching-status',
                    variant: 'puzzle_prelude',
                    memberCount,
                    completed: isPuzzleComplete,
                  })
                  onContinueFromMembers()
                }}
                disabled={!isPuzzleComplete}
                loading={!isPuzzleComplete}
              >
                揭晓我的桌友
              </Button>
            </>
          ) : (
            <>
              <Text className='matching-status__overlay-eyebrow'>先看桌友</Text>
              <Text className='matching-status__overlay-title'>这一桌已经为你留好位置</Text>
              <Text className='matching-status__overlay-copy'>
                {unifiedReveal?.spotlight
                  ? `第 ${resolvedGroupNumber} 组已锁定。${unifiedReveal.body}`
                  : unifiedReveal?.headline
                    ? `第 ${resolvedGroupNumber} 组已锁定。${unifiedReveal.headline}`
                    : `第 ${resolvedGroupNumber} 组已锁定，先认识一下今晚会同桌的人。`}
              </Text>

              <View className='matching-status__overlay-member-grid'>
                {effectiveGroupDetails.members.map((member, index) => {
                  const pairSummary = viewerPairSummaryByMemberId.get(member.userId)

                  return (
                    <View
                      key={member.userId}
                      className='matching-status__overlay-member-card'
                      style={{ animationDelay: (shouldReduceMotion || hasRevealed) ? '0ms' : `${index * 120}ms` }}
                    >
                      <View className='matching-status__overlay-member-avatar'>
                        <ArchetypeHead
                          archetype={member.archetype}
                          size={52}
                          variant='sd'
                          fallbackText={member.displayName ?? undefined}
                        />
                      </View>
                      <Text className='matching-status__overlay-member-name'>
                        {member.displayName ?? '神秘嘉宾'}
                      </Text>
                      {pairSummary?.connectionPointsWithRarity?.[0]?.text ?? pairSummary?.connectionPoints?.[0] ? (
                        <Text className='matching-status__overlay-member-note'>
                          {pairSummary.connectionPointsWithRarity?.[0]?.text ?? pairSummary.connectionPoints?.[0]}
                        </Text>
                      ) : pairSummary ? (
                        <Text className='matching-status__overlay-member-note'>
                          默契度 {pairSummary.chemistryScore}
                        </Text>
                      ) : null}
                    </View>
                  )
                })}
              </View>

              <Button className='matching-status__overlay-button' onClick={onContinueFromMembers}>
                {persistedThemeSummary ? '看看今晚主题' : '前往完整详情'}
              </Button>
            </>
          )}
        </View>
      ) : null}

      {liveStage === 'theme' && persistedThemeSummary ? (
        <View className='matching-status__overlay-card matching-status__overlay-card--theme' key='theme'>
          <Text className='matching-status__overlay-eyebrow'>今晚的桌面主题</Text>
          {persistedThemeSummary.emoji ? (
            <JoyJoinIcon emoji={persistedThemeSummary.emoji} size={32} className='matching-status__overlay-emoji' />
          ) : null}
          <AIGCLabel meta={{ aiGenerated: true, labelType: 'ai-generated' }} className='matching-status__overlay-aigc-label' />
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
          {aigcLabelsEnabled ? (
            <AIContentReportButton
              options={{ reason: '举报桌面主题内容', relatedEventId }}
              className='matching-status__overlay-report-button'
            />
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
