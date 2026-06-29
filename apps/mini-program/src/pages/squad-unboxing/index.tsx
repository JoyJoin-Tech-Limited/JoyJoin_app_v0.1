import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useCallback, useRef, useState } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useJoyJoinNavigation } from '../../hooks/navigation/useJoyJoinNavigation'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import ChemistryBadge from '../../components/mascot/ChemistryBadge'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Card from '../../components/ui/Card'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { GroupAnalysisSourceHint } from '../../components/GroupAnalysisSourceHint'
import Button from '../../components/ui/Button'
import TypewriterText from '../../components/ui/TypewriterText'
import { haptics } from '../../lib/utils/haptics'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import { BlindBoxVisual } from './BlindBoxVisual'
import DragRevealRibbon from './DragRevealRibbon'
import SquadDeckStage from './SquadDeckStage'
import TeammateCardDetail from './TeammateCardDetail'
import {
  formatDateTime,
  getMemberName,
  getVibeLabel,
} from './squadUnboxingViewModels'
import { useSquadUnboxingController } from './useSquadUnboxingController'
import './index.scss'

export default function SquadUnboxingPage() {
  const router = useRouter()
  const groupId = router.params.groupId ?? ''
  const { isExiting, navigateBack } = useJoyJoinNavigation()

  const {
    authLoading,
    isLoading,
    fetchError,
    poolGroup,
    group,
    pool,
    members,
    currentUserId,
    groupAnalysis,
    isLoadingAnalysis,
    chemistryTokens,
    sortedPairExplanations,
    pairKeyMemberMap,
    viewerPairs,
    viewerPairByMemberId,
    viewerSpotlight,
    groupThemeHighlights,
    analysisThemeTags,
    flowState,
    analysisStage,
    actionDockState,
    rootClassName,
    shouldReduceMotion,
    confirmAttendanceMutation,
    isSubmitting,
    showSuccessOverlay,
    archetypeMixCopy,
    handleOpenBox,
    handleConfirmAttendance,
    handleOpenGroupDetail,
    handleSharePosterTap,
    handleSkip,
    refetch,
  } = useSquadUnboxingController({ groupId, routerParams: router.params })

  const { isDegradation } = useDeviceTier()
  const { user: currentUser } = useAuthGuard()
  const dragRevealEnabled = currentUser?.features?.squadUnboxingDragRevealEnabled ?? true

  const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
  const [hasTappedCard, setHasTappedCard] = useState(false)

  const handleCardFocus = useCallback((index: number) => {
    setFocusedCardIndex((current) => {
      const next = current === index ? -1 : index
      if (next !== -1) {
        setHasTappedCard(true)
      }
      const member = members[next >= 0 ? next : index]
      squadUnboxingAnalytics.track('squad_unboxing_card_focus', {
        source: 'deck_tap',
        cardIndex: next >= 0 ? next : index,
        focusedUserId: member?.userId,
        previousIndex: current,
        groupId,
        screen: 'squad-unboxing',
      })
      return next
    })
  }, [members, groupId])

  const focusedMember = members[focusedCardIndex] ?? null
  const focusedViewerPair = focusedMember
    ? (viewerPairByMemberId.get(focusedMember.userId) ?? null)
    : null

  const prevVenueStatusRef = useRef<string | null>(null)

  const handleCopyVenue = useCallback(() => {
    const address = [group?.venueName, group?.venueAddress].filter(Boolean).join(' ')
    if (!address) return
    haptics('light')
    Taro.setClipboardData({
      data: address,
      success: () => {
        Taro.showToast({ title: '地址已复制', icon: 'success', duration: 1500 })
      },
    })
  }, [group?.venueName, group?.venueAddress])

  useEffect(() => {
    if (!groupId || !group) return
    const currentStatus = group.venueAssignmentStatus
    if (prevVenueStatusRef.current === 'unassigned' && currentStatus === 'assigned' && group.venueName) {
      Taro.showToast({ title: '场地已确定', icon: 'success', duration: 2000 })
    }
    prevVenueStatusRef.current = currentStatus ?? null
  }, [groupId, group])

  const pageClassName = [rootClassName, isExiting ? 'squad-unboxing--exiting' : ''].filter(Boolean).join(' ')

  if (authLoading || isLoading) {
    return <LoadingScreen message='揭晓小队中…' />
  }

  if (fetchError || !poolGroup || !group || !pool) {
    return (
      <View className={pageClassName}>
        <View className='squad-unboxing__error'>
          <Image
            className='squad-unboxing__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='widthFix'
            lazyLoad
            ariaLabel='加载失败'
          />
          <Text className='squad-unboxing__error-text'>
            {fetchError ? '加载小队信息没成功' : '没有找到小队信息'}
          </Text>
          <View className='squad-unboxing__error-actions'>
            {fetchError ? (
              <Button variant='primary' className='squad-unboxing__error-btn' onClick={() => refetch()} loading={isLoading}>
                重试
              </Button>
            ) : null}
            <Button variant='secondary' className='squad-unboxing__error-btn' onClick={() => navigateBack()}>
              返回
            </Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={pageClassName}>
      <ScrollView className='squad-unboxing__scroll' scrollY enhanced showScrollbar={false}>
        <View className='squad-unboxing__header'>
          <Image
            className='squad-unboxing__header-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            ariaLabel='欢迎'
          />
          <Text className='squad-unboxing__header-title'>
            你的{pool.eventType === 'bar' ? '酒局' : '饭局'}桌友来了
          </Text>
          <Text className='squad-unboxing__header-tagline'>
            {group.matchExplanation || pool.description || `${DEFAULT_MASCOT_DISPLAY_NAME}已经把这一桌锁定，准备让你看看今晚会和谁同桌。`}
          </Text>
          <View className='squad-unboxing__header-meta'>
            {group.groupNumber ? (
              <Text className='squad-unboxing__header-group-num'>第 {group.groupNumber} 组</Text>
            ) : null}
            {group.matchScore != null ? (
              <Text className='squad-unboxing__header-score'>默契度 {Math.round(group.matchScore)}%</Text>
            ) : null}
          </View>
        </View>

        {flowState === 'revealed' ? (
          <View className='squad-unboxing__analysis-bubble'>
            <View className='squad-unboxing__analysis-bubble-inner'>
              <Image
                className='squad-unboxing__analysis-bubble-mascot'
                mode='aspectFit'
                src={getXiaoyueExpressionAsset('matchSuccess')}
                aria-hidden='true'
              />
              <View className='squad-unboxing__analysis-bubble-bubble'>
                <TypewriterText
                  className='squad-unboxing__analysis-bubble-text'
                  text={
                    [
                      '盒子打开了！',
                      archetypeMixCopy,
                      groupAnalysis?.groupThemeCompanion ||
                        group.matchExplanation ||
                        `${DEFAULT_MASCOT_DISPLAY_NAME}觉得这桌会聊得很自然。`,
                    ]
                      .filter(Boolean)
                      .join('')
                  }
                  speed={45}
                  delay={180}
                  maxDuration={3000}
                  enabled={!shouldReduceMotion}
                  showCursor={false}
                  onComplete={() => {
                    squadUnboxingAnalytics.track('squad_unboxing_bubble_reveal_complete', {
                      groupId,
                      screen: 'squad-unboxing',
                    })
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}

        {flowState === 'ready' ? (
          <Card className='squad-unboxing__blind-box-card'>
            <DragRevealRibbon
              shouldReduceMotion={shouldReduceMotion}
              isDegradation={isDegradation}
              enabled={dragRevealEnabled}
              onReveal={handleOpenBox}
            />
            <Text className='squad-unboxing__blind-box-title'>你的桌友来了</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              这一桌 {members.length} 位桌友已经就位。先开盒，再看为什么你们会被放在同一桌。
            </Text>
            {group.theme || group.themeEmoji ? (
              <View className='squad-unboxing__blind-box-theme-pill'>
                <Text className='squad-unboxing__blind-box-theme-text'>
                  {group.themeEmoji ? `${group.themeEmoji} ` : ''}
                  {group.theme || '今晚成桌'}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {flowState === 'shaking' ? (
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--shaking'>
            <Image
              className='squad-unboxing__reveal-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('loadingReveal')}
              ariaLabel='正在揭晓'
            />
            <BlindBoxVisual state='opening' shouldReduceMotion={shouldReduceMotion} />
            <Text className='squad-unboxing__blind-box-title'>盒子正在打开…</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              {`${DEFAULT_MASCOT_DISPLAY_NAME}正在把盒盖掀开，把今晚最值得期待的那一页翻给你看。`}
            </Text>
          </Card>
        ) : null}

        {flowState === 'revealed' ? (
          <>
            <View className='squad-unboxing__reveal-shell'>
              <Card className='squad-unboxing__reveal-hero'>
                <Text className='squad-unboxing__section-label'>盒子打开了</Text>
                <BlindBoxVisual state='open' shouldReduceMotion={shouldReduceMotion} />
                <Text className='squad-unboxing__reveal-title'>这一桌已经为你留好位置</Text>
                <Text className='squad-unboxing__reveal-copy'>
                  先认一眼桌友，再看看你会先和谁聊开。
                </Text>

                <View className='squad-unboxing__viewer-spotlight'>
                  <View className='squad-unboxing__viewer-spotlight-top'>
                    <Text className='squad-unboxing__viewer-spotlight-eyebrow'>先给你看</Text>
                    {viewerSpotlight ? (
                      <Text className='squad-unboxing__viewer-spotlight-score'>
                        默契 {viewerSpotlight.pair.chemistryScore}
                      </Text>
                    ) : null}
                  </View>
                  <Text className='squad-unboxing__viewer-spotlight-title'>
                    {viewerSpotlight
                      ? `你会先和 ${getMemberName(viewerSpotlight.otherMember)} 聊开`
                      : isLoadingAnalysis
                        ? `${DEFAULT_MASCOT_DISPLAY_NAME}正在替你挑出最先聊开的桌友`
                        : '先看看这一桌为什么会把你放在这里'}
                  </Text>
                  <Text className='squad-unboxing__viewer-spotlight-copy'>
                    {viewerSpotlight?.pair.connectionPointsWithRarity?.[0]?.text ?? viewerSpotlight?.pair.connectionPoints?.[0]
                      ? `第一句很可能会从「${viewerSpotlight.pair.connectionPointsWithRarity?.[0]?.text ?? viewerSpotlight.pair.connectionPoints?.[0]}」开始。`
                      : viewerSpotlight
                        ? viewerSpotlight.pair.explanation
                        : isLoadingAnalysis
                          ? '分析正在补齐，下面会先把桌友和整体氛围揭晓给你。'
                          : group.matchExplanation || `往下看，${DEFAULT_MASCOT_DISPLAY_NAME}会把这桌的连接点慢慢揭晓给你。`}
                  </Text>
                  {(viewerSpotlight?.pair.connectionPointsWithRarity?.length ?? viewerSpotlight?.pair.connectionPoints?.length) ? (
                    <View className='squad-unboxing__viewer-spotlight-pills'>
                      {(viewerSpotlight.pair.connectionPointsWithRarity ?? viewerSpotlight.pair.connectionPoints.slice(0, 2).map((text) => ({ text, rarity: 'common' as const }))).slice(0, 2).map((point) => (
                        <ConnectionPointPill key={point.text} text={point.text} rarity={point.rarity} />
                      ))}
                    </View>
                  ) : null}
                </View>
              </Card>

              <Text className='squad-unboxing__section-label'>今晚同桌的是</Text>
              {!hasTappedCard ? (
                <View className='squad-unboxing__deck-cue'>
                  <Image
                    className='squad-unboxing__deck-cue-mascot'
                    mode='aspectFit'
                    src={getXiaoyueExpressionAsset('coachGuide')}
                    aria-hidden='true'
                  />
                  <Text className='squad-unboxing__deck-cue-text'>
                    点击卡片，看看你和这桌的连接
                  </Text>
                </View>
              ) : null}
              <SquadDeckStage
                members={members}
                currentUserId={currentUserId}
                viewerPairByMemberId={viewerPairByMemberId}
                focusedIndex={focusedCardIndex}
                hasTappedCard={hasTappedCard}
                reduceMotion={shouldReduceMotion}
                isDegradation={isDegradation}
                onFocusChange={handleCardFocus}
              />
              <Text className='squad-unboxing__deck-hint'>点击任意卡片，看看你们的连接</Text>
              <TeammateCardDetail
                member={focusedMember}
                viewerPair={focusedViewerPair}
                visible={flowState === 'revealed'}
              />
            </View>

            <Card className='squad-unboxing__info-card'>
              <View className='squad-unboxing__info-copy'>
                <Text className='squad-unboxing__info-title'>为什么是这桌？</Text>
                <Text className='squad-unboxing__info-description'>
                  {group.matchExplanation || '这桌的组合已经锁定，下面会把更细的分析慢慢揭晓给你。'}
                </Text>
              </View>

              {pool.eventType ? (
                <View className='squad-unboxing__info-row'>
                  <View className='squad-unboxing__info-label'>
                    <JoyJoinIcon emoji='🎯' size={24} />
                    <Text>活动类型</Text>
                  </View>
                  <Text className='squad-unboxing__info-value'>{pool.eventType}</Text>
                </View>
              ) : null}

              {group.finalDateTime || pool.dateTime ? (
                <View className='squad-unboxing__info-row'>
                  <View className='squad-unboxing__info-label'>
                    <JoyJoinIcon emoji='📅' size={24} />
                    <Text>时间</Text>
                  </View>
                  <Text className='squad-unboxing__info-value'>
                    {formatDateTime(group.finalDateTime ?? pool.dateTime)}
                  </Text>
                </View>
              ) : null}

              <View className='squad-unboxing__info-row'>
                <View className='squad-unboxing__info-label'>
                  <JoyJoinIcon emoji='📍' size={24} />
                  <Text>地点</Text>
                </View>
                <View className='squad-unboxing__info-value-wrap'>
                  <Text className='squad-unboxing__info-value'>
                    {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '地点待定'}
                  </Text>
                  {group.venueAddress ? (
                    <Text className='squad-unboxing__info-sub'>{group.venueAddress}</Text>
                  ) : null}
                  {group.venueName ? (
                    <View
                      className='squad-unboxing__info-action'
                      hoverClass='squad-unboxing__info-action--pressed'
                      onClick={handleCopyVenue}
                    >
                      <Text className='squad-unboxing__info-action-text'>复制地址</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>

            {group.theme || group.themeEmoji ? (
              <Card className='squad-unboxing__theme-card'>
                <View className='squad-unboxing__theme-header'>
                  {group.themeEmoji ? (
                    <JoyJoinIcon emoji={group.themeEmoji} size={32} className='squad-unboxing__theme-emoji' />
                  ) : null}
                  <Text className='squad-unboxing__theme-title'>{group.theme || '今晚的主题'}</Text>
                </View>
                {group.subtitle ? (
                  <Text className='squad-unboxing__theme-subtitle'>{group.subtitle}</Text>
                ) : null}
                {group.vibe ? (
                  <View className='squad-unboxing__theme-vibe'>
                    <Text className='squad-unboxing__theme-vibe-label'>氛围：</Text>
                    <Text className='squad-unboxing__theme-vibe-value'>{getVibeLabel(group.vibe)}</Text>
                  </View>
                ) : null}
                {groupThemeHighlights.length > 0 ? (
                  <View className='squad-unboxing__theme-highlights'>
                    {groupThemeHighlights.map((highlight) => (
                      <View key={highlight} className='squad-unboxing__theme-highlight'>
                        <Text className='squad-unboxing__theme-highlight-text'>· {highlight}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {analysisStage > 0 ? (
              <View className='squad-unboxing__analysis-stack'>
                {analysisStage >= 1 ? (
                  <Card className='squad-unboxing__analysis-card squad-unboxing__analysis-card--chemistry'>
                    <Text className='squad-unboxing__section-label'>这桌的火花</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton squad-unboxing__skeleton--banner' />
                    ) : (
                      <>
                        <View className={`squad-unboxing__chemistry-chip ${chemistryTokens.chipClassName}`}>
                          <ChemistryBadge
                            chemistry={chemistryTokens.iconRef}
                            size={28}
                            className='squad-unboxing__chemistry-emoji'
                          />
                          <Text className='squad-unboxing__chemistry-title'>{chemistryTokens.title}</Text>
                        </View>
                        <Text className='squad-unboxing__analysis-text'>{chemistryTokens.description}</Text>
                      </>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 2 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>这桌的整体氛围</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line' />
                        <View className='squad-unboxing__skeleton squad-unboxing__skeleton--line squad-unboxing__skeleton--line-short' />
                      </View>
                    ) : groupAnalysis ? (
                      <>
                        {analysisThemeTags.length > 0 ? (
                          <View className='squad-unboxing__tag-row'>
                            {analysisThemeTags.map((tag) => (
                              <View key={tag} className='squad-unboxing__tag-chip'>
                                <Text className='squad-unboxing__tag-chip-text'>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {groupAnalysis.groupThemeCompanion ? (
                          <Text className='squad-unboxing__analysis-text'>
                            {groupAnalysis.groupThemeCompanion}
                          </Text>
                        ) : null}
                        <Text className='squad-unboxing__analysis-text'>{groupAnalysis.groupDynamics}</Text>
                        <GroupAnalysisSourceHint analysis={groupAnalysis} />
                      </>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>{group.matchExplanation}</Text>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 3 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>你和这桌最容易从哪里聊开？</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        {[0, 1].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--pair' />
                        ))}
                      </View>
                    ) : viewerPairs.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {viewerPairs.slice(0, 2).map((pair, index) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const otherMember = pairMembers?.find((member) => member.userId !== currentUserId)
                          const pairLabel = otherMember
                            ? `你 × ${getMemberName(otherMember)}`
                            : pairMembers
                              ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                              : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className='squad-unboxing__pair-card'
                              style={{ animationDelay: shouldReduceMotion ? '0ms' : `${index * 140}ms` }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{pair.chemistryScore}</Text>
                              </View>
                              {(pair.connectionPointsWithRarity?.length ?? pair.connectionPoints.length) > 0 ? (
                                <View className='squad-unboxing__pair-pill-row'>
                                  {(pair.connectionPointsWithRarity ?? pair.connectionPoints.slice(0, 3).map((text) => ({ text, rarity: 'common' as const }))).slice(0, 3).map((point) => (
                                    <ConnectionPointPill key={point.text} text={point.text} rarity={point.rarity} />
                                  ))}
                                </View>
                              ) : null}
                              <Text className='squad-unboxing__pair-copy'>{pair.explanation}</Text>
                              {pair.introAngle ? (
                                <Text className='squad-unboxing__pair-intro'>开场：{pair.introAngle}</Text>
                              ) : null}
                            </View>
                          )
                        })}
                      </View>
                    ) : sortedPairExplanations.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {sortedPairExplanations.slice(0, 2).map((pair, index) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const pairLabel = pairMembers
                            ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                            : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className='squad-unboxing__pair-card'
                              style={{ animationDelay: shouldReduceMotion ? '0ms' : `${index * 140}ms` }}
                            >
                              <View className='squad-unboxing__pair-top'>
                                <Text className='squad-unboxing__pair-label'>{pairLabel}</Text>
                                <Text className='squad-unboxing__pair-score'>{pair.chemistryScore}</Text>
                              </View>
                              <Text className='squad-unboxing__pair-copy'>{pair.explanation}</Text>
                              {pair.introAngle ? (
                                <Text className='squad-unboxing__pair-intro'>开场：{pair.introAngle}</Text>
                              ) : null}
                            </View>
                          )
                        })}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        {group.matchExplanation || '这桌有不少潜在共同点，见面后会更快找到节奏。'}
                      </Text>
                    )}
                  </Card>
                ) : null}

                {analysisStage >= 4 ? (
                  <Card className='squad-unboxing__analysis-card'>
                    <Text className='squad-unboxing__section-label'>今晚聊什么？</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__topic-row'>
                        {[0, 1, 2].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--topic' />
                        ))}
                      </View>
                    ) : groupAnalysis?.iceBreakers && groupAnalysis.iceBreakers.length > 0 ? (
                      <View className='squad-unboxing__topic-row'>
                        {groupAnalysis.iceBreakers.map((topic, index) => (
                          <View
                            key={`${topic}-${index}`}
                            className='squad-unboxing__topic-chip'
                            style={{ animationDelay: shouldReduceMotion ? '0ms' : `${index * 120}ms` }}
                          >
                            <Text className='squad-unboxing__topic-chip-text'>{topic}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className='squad-unboxing__analysis-text'>
                        先从彼此最近最上头的一件事聊起，通常都能很快破冰。
                      </Text>
                    )}
                  </Card>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View className='squad-unboxing__spacer' />
      </ScrollView>

      {flowState === 'revealed' && actionDockState === 'ready' ? (
        <View className='squad-unboxing__action-zone squad-unboxing__action-zone--ready'>
          <View className='squad-unboxing__action-copy'>
            <Text className='squad-unboxing__action-eyebrow'>揭晓完成</Text>
            <Text className='squad-unboxing__action-title'>
              如果这桌感觉对味，就把今晚定下来。
            </Text>
          </View>

          <Button
            className='squad-unboxing__confirm-btn'
            onClick={handleConfirmAttendance}
            disabled={isSubmitting || confirmAttendanceMutation.isPending}
            loading={isSubmitting || confirmAttendanceMutation.isPending}
          >
            {showSuccessOverlay ? '座位已锁定' : isSubmitting ? '确认中…' : '确认出席'}
          </Button>

          <View className='squad-unboxing__action-row'>
            <Button
              variant='secondary'
              className='squad-unboxing__share-btn'
              onClick={handleSharePosterTap}
            >
              生成队伍海报
            </Button>

            <Button
              variant='secondary'
              className='squad-unboxing__detail-btn'
              onClick={handleOpenGroupDetail}
            >
              查看活动详情
            </Button>
          </View>

          <View
            className='squad-unboxing__skip-link'
            hoverClass='squad-unboxing__skip-link--pressed'
            onClick={handleSkip}
            role='button'
            aria-label='稍后再看'
          >
            <Text>稍后再看</Text>
          </View>
        </View>
      ) : null}

      {showSuccessOverlay ? (
        <View className='squad-unboxing__success-overlay' role='status' aria-live='polite'>
          <View className='squad-unboxing__success-card'>
            <Image
              className='squad-unboxing__success-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('actionSuccess')}
              aria-hidden='true'
            />
            <Text className='squad-unboxing__success-title'>座位已锁定</Text>
            <Text className='squad-unboxing__success-subtitle'>解锁新羁绊 · 准备见面吧</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
