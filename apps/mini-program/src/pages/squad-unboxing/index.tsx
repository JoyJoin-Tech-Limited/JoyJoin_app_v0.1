import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
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
import { BlindBoxLid } from './BlindBoxLid'
import { useResetOnShow } from '../../hooks/useResetOnShow'
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

const SCROLL_DEPTH_BUCKETS = ['tonights_table', 'connection_story', 'actions'] as const

type ScrollDepthBucket = typeof SCROLL_DEPTH_BUCKETS[number]

function useScrollDepthTracking(groupId: string) {
  const reportedRef = useRef<Set<ScrollDepthBucket>>(new Set())

  const reportDepth = useCallback((bucket: ScrollDepthBucket) => {
    if (reportedRef.current.has(bucket)) return
    reportedRef.current.add(bucket)
    squadUnboxingAnalytics.track('squad_unboxing_scroll_depth', {
      groupId,
      screen: 'squad-unboxing',
      bucket,
    })
  }, [groupId])

  return reportDepth
}

function getPageTitle(eventType?: string | null): string {
  if (eventType === 'bar') return '你的酒局桌友来了'
  if (eventType === 'dining') return '你的饭局桌友来了'
  return '你的桌友来了'
}

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
    groupThemeHighlights,
    analysisThemeTags,
    flowState,
    isAnalysisExpanded,
    setIsAnalysisExpanded,
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
  const [announcement, setAnnouncement] = useState('')
  const [scrollToDetailId, setScrollToDetailId] = useState('')
  const [headerReady, setHeaderReady] = useState(false)

  const reportScrollDepth = useScrollDepthTracking(groupId)

  useResetOnShow(() => setHasTappedCard(false))
  useDidShow(() => {
    setFocusedCardIndex(-1)
    setHeaderReady(false)
  })

  useEffect(() => {
    if (flowState !== 'revealed' || members.length === 0) return
    const message = `礼盒打开，发现 ${members.length} 张队友卡片`
    setAnnouncement(message)
    const timer = setTimeout(() => setAnnouncement(''), 1200)
    return () => clearTimeout(timer)
  }, [flowState, members.length])

  useEffect(() => {
    if (authLoading || isLoading) return
    const timer = setTimeout(() => setHeaderReady(true), 120)
    return () => clearTimeout(timer)
  }, [authLoading, isLoading])

  const handleCardFocus = useCallback((index: number) => {
    setFocusedCardIndex((current) => {
      const next = current === index ? -1 : index
      const member = members[index]

      if (next === -1) {
        squadUnboxingAnalytics.track('squad_unboxing_card_detail_dismiss', {
          source: 'deck_tap',
          cardIndex: index,
          focusedUserId: member?.userId,
          previousIndex: current,
          groupId,
          screen: 'squad-unboxing',
        })
      } else {
        setHasTappedCard(true)
        squadUnboxingAnalytics.track('squad_unboxing_card_focus', {
          source: 'deck_tap',
          cardIndex: next,
          focusedUserId: member?.userId,
          previousIndex: current,
          groupId,
          screen: 'squad-unboxing',
        })
      }

      return next
    })
  }, [members, groupId])

  const handleDismissDetail = useCallback(() => {
    setFocusedCardIndex(-1)
    squadUnboxingAnalytics.track('squad_unboxing_card_detail_dismiss', {
      source: 'inline_bar',
      groupId,
      screen: 'squad-unboxing',
    })
  }, [groupId])

  const toggleAnalysis = useCallback(() => {
    setIsAnalysisExpanded((prev) => {
      const next = !prev
      squadUnboxingAnalytics.track(
        next ? 'squad_unboxing_connection_story_expand' : 'squad_unboxing_connection_story_collapse',
        { groupId, screen: 'squad-unboxing' },
      )
      return next
    })
    haptics('light')
  }, [groupId, setIsAnalysisExpanded])

  const focusedMember = members[focusedCardIndex] ?? null
  const focusedViewerPair = focusedMember
    ? (viewerPairByMemberId.get(focusedMember.userId) ?? null)
    : null

  useEffect(() => {
    if (!focusedMember) return
    setScrollToDetailId('inline-detail')
    const timer = setTimeout(() => setScrollToDetailId(''), 600)
    return () => clearTimeout(timer)
  }, [focusedMember])

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

  const handleScroll = useCallback((event: { detail?: { scrollTop?: number; scrollHeight?: number } }) => {
    const scrollTop = event.detail?.scrollTop ?? 0
    if (scrollTop > 120) reportScrollDepth('tonights_table')
    if (scrollTop > 320) reportScrollDepth('connection_story')
    if (scrollTop > 520) reportScrollDepth('actions')
  }, [reportScrollDepth])

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
      <ScrollView
        className='squad-unboxing__scroll'
        scrollY
        enhanced
        showScrollbar={false}
        onScroll={handleScroll}
        scrollIntoView={scrollToDetailId}
      >
        <View className={['squad-unboxing__header', headerReady ? 'squad-unboxing__header--ready' : ''].filter(Boolean).join(' ')}>
          <Image
            className='squad-unboxing__header-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            ariaLabel='欢迎'
          />
          <Text className='squad-unboxing__header-title'>
            {getPageTitle(pool.eventType)}
          </Text>
          <Text className='squad-unboxing__header-tagline'>
            {group.matchExplanation || `${DEFAULT_MASCOT_DISPLAY_NAME}已经把拼图聚齐，准备让你看看今晚会和谁同桌。`}
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
            <View
              className={[
                'squad-unboxing__analysis-bubble-inner',
                headerReady ? 'squad-unboxing__analysis-bubble-inner--ready' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Image
                className={['squad-unboxing__analysis-bubble-mascot', headerReady ? 'squad-unboxing__analysis-bubble-mascot--ready' : ''].filter(Boolean).join(' ')}
                mode='aspectFit'
                src={getXiaoyueExpressionAsset('matchSuccess')}
                aria-hidden='true'
              />
              <View className='squad-unboxing__analysis-bubble-bubble'>
                <TypewriterText
                  className='squad-unboxing__analysis-bubble-text'
                  text={
                    [
                      '拼图完整了！',
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
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--copy-only'>
            <DragRevealRibbon
              shouldReduceMotion={shouldReduceMotion}
              isDegradation={isDegradation}
              enabled={dragRevealEnabled}
              onReveal={handleOpenBox}
            />
            <Text className='squad-unboxing__blind-box-title'>拼图已经聚齐</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              上一页的每一块拼图，都会在这里变成一个真实的队友。轻轻拉开，看看是谁和你坐在同一桌。
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
          <Card className='squad-unboxing__blind-box-card squad-unboxing__blind-box-card--copy-only squad-unboxing__blind-box-card--shaking'>
            <Text className='squad-unboxing__blind-box-title'>盒子正在打开…</Text>
            <Text className='squad-unboxing__blind-box-copy'>
              {`${DEFAULT_MASCOT_DISPLAY_NAME}正在把盒盖掀开，把今晚最值得期待的那一页翻给你看。`}
            </Text>
          </Card>
        ) : null}

        {flowState === 'revealed' ? (
          <>
            <View className='squad-unboxing__stage-spacer' />

            {focusedMember ? (
              <View
                id='inline-detail'
                className={[
                  'squad-unboxing__inline-detail-shell',
                  'squad-unboxing__inline-detail-shell--ready',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <View
                  className='squad-unboxing__inline-detail-dismiss'
                  onClick={handleDismissDetail}
                  hoverClass='squad-unboxing__inline-detail-dismiss--pressed'
                  role='button'
                  aria-label='收起卡片详情'
                >
                  <Text className='squad-unboxing__inline-detail-dismiss-text'>收起</Text>
                  <View className='squad-unboxing__inline-detail-dismiss-chevron' />
                </View>
                <TeammateCardDetail
                  member={focusedMember}
                  viewerPair={focusedViewerPair}
                  visible={flowState === 'revealed'}
                />
              </View>
            ) : null}

            <View className={[
              'squad-unboxing__chapter',
              'squad-unboxing__chapter--meta',
              headerReady ? 'squad-unboxing__chapter--ready' : '',
            ]
              .filter(Boolean)
              .join(' ')}>
              <View className='squad-unboxing__chapter-title-row'>
                <Text className='squad-unboxing__chapter-title'>今晚这桌</Text>
                {group.matchScore != null ? (
                  <View className='squad-unboxing__chapter-badge'>
                    <Text className='squad-unboxing__chapter-badge-text'>
                      默契度 {Math.round(group.matchScore)}%
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className='squad-unboxing__meta-row'>
                <View className='squad-unboxing__meta-label'>
                  <JoyJoinIcon emoji='🎯' size={24} />
                  <Text>类型</Text>
                </View>
                <Text className='squad-unboxing__meta-value'>{getPageTitle(pool.eventType)}</Text>
              </View>

              {group.finalDateTime || pool.dateTime ? (
                <View className='squad-unboxing__meta-row'>
                  <View className='squad-unboxing__meta-label'>
                    <JoyJoinIcon emoji='📅' size={24} />
                    <Text>时间</Text>
                  </View>
                  <Text className='squad-unboxing__meta-value'>
                    {formatDateTime(group.finalDateTime ?? pool.dateTime)}
                  </Text>
                </View>
              ) : null}

              <View className='squad-unboxing__meta-row'>
                <View className='squad-unboxing__meta-label'>
                  <JoyJoinIcon emoji='📍' size={24} />
                  <Text>地点</Text>
                </View>
                <View className='squad-unboxing__meta-value-wrap'>
                  <Text className='squad-unboxing__meta-value'>
                    {group.venueName || [pool.city, pool.district].filter(Boolean).join(' · ') || '地点待定'}
                  </Text>
                  <Text className={`squad-unboxing__meta-status ${group.venueName ? 'squad-unboxing__meta-status--assigned' : 'squad-unboxing__meta-status--pending'}`}>
                    {group.venueName ? '场地已确定，可复制地址导航' : '场地待定，悦仔会在确认后提醒你'}
                  </Text>
                  {group.venueAddress ? (
                    <Text className='squad-unboxing__meta-sub'>{group.venueAddress}</Text>
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

              {group.theme || group.themeEmoji || group.vibe ? (
                <View className='squad-unboxing__meta-row squad-unboxing__meta-row--theme'>
                  <View className='squad-unboxing__meta-label'>
                    {group.themeEmoji ? (
                      <JoyJoinIcon emoji={group.themeEmoji} size={24} />
                    ) : (
                      <JoyJoinIcon emoji='✨' size={24} />
                    )}
                    <Text>主题</Text>
                  </View>
                  <View className='squad-unboxing__meta-value-wrap'>
                    <Text className='squad-unboxing__meta-value'>
                      {group.theme || '今晚的主题'}
                      {group.vibe ? ` · ${getVibeLabel(group.vibe)}` : ''}
                    </Text>
                    {group.subtitle ? (
                      <Text className='squad-unboxing__meta-sub'>{group.subtitle}</Text>
                    ) : null}
                    {groupThemeHighlights.length > 0 ? (
                      <View className='squad-unboxing__meta-highlights'>
                        {groupThemeHighlights.map((highlight) => (
                          <View key={highlight} className='squad-unboxing__meta-highlight'>
                            <Text className='squad-unboxing__meta-highlight-text'>{highlight}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>

            <View className={[
              'squad-unboxing__chapter',
              'squad-unboxing__chapter--analysis',
              headerReady ? 'squad-unboxing__chapter--ready' : '',
            ]
              .filter(Boolean)
              .join(' ')}>
              <View
                className='squad-unboxing__expand-header'
                onClick={toggleAnalysis}
                hoverClass='squad-unboxing__expand-header--pressed'
                role='button'
                aria-expanded={isAnalysisExpanded}
                aria-label={isAnalysisExpanded ? '收起连接解读' : '展开连接解读'}
              >
                <View className='squad-unboxing__expand-title-group'>
                  <Text className='squad-unboxing__chapter-title'>连接解读</Text>
                  <Text className='squad-unboxing__expand-subtitle'>悦仔怎么看这桌的化学反应</Text>
                </View>
                <View
                  className={[
                    'squad-unboxing__expand-chevron',
                    isAnalysisExpanded ? 'squad-unboxing__expand-chevron--open' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden='true'
                />
              </View>

              {isAnalysisExpanded ? (
                <View className={[
                  'squad-unboxing__expand-body',
                  isAnalysisExpanded ? 'squad-unboxing__expand-body--open' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                >
                  <View className='squad-unboxing__analysis-section squad-unboxing__analysis-section--chemistry'>
                    <Text className='squad-unboxing__analysis-section-title'>这桌的火花</Text>
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
                  </View>

                  <View className='squad-unboxing__analysis-section'>
                    <Text className='squad-unboxing__analysis-section-title'>整体氛围</Text>
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
                  </View>

                  <View className='squad-unboxing__analysis-section'>
                    <Text className='squad-unboxing__analysis-section-title'>你最容易从哪里聊开？</Text>
                    {isLoadingAnalysis ? (
                      <View className='squad-unboxing__skeleton-list'>
                        {[0, 1].map((item) => (
                          <View key={item} className='squad-unboxing__skeleton squad-unboxing__skeleton--pair' />
                        ))}
                      </View>
                    ) : viewerPairs.length > 0 ? (
                      <View className='squad-unboxing__pair-list'>
                        {viewerPairs.slice(0, 2).map((pair) => {
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
                              className={[
                                'squad-unboxing__pair-card',
                                headerReady ? 'squad-unboxing__pair-card--ready' : '',
                              ].filter(Boolean).join(' ')}
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
                        {sortedPairExplanations.slice(0, 2).map((pair) => {
                          const pairMembers = pairKeyMemberMap.get(pair.pairKey)
                          const pairLabel = pairMembers
                            ? `${getMemberName(pairMembers[0])} × ${getMemberName(pairMembers[1])}`
                            : pair.pairKey

                          return (
                            <View
                              key={pair.pairKey}
                              className={[
                                'squad-unboxing__pair-card',
                                headerReady ? 'squad-unboxing__pair-card--ready' : '',
                              ].filter(Boolean).join(' ')}
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
                  </View>

                  <View className='squad-unboxing__analysis-section squad-unboxing__analysis-section--last'>
                    <Text className='squad-unboxing__analysis-section-title'>今晚聊什么？</Text>
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
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <View className='squad-unboxing__spacer' />
      </ScrollView>

      <View
        className={[
          'squad-unboxing__stage',
          `squad-unboxing__stage--${flowState}`,
          isDegradation ? 'squad-unboxing__stage--degradation' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={flowState === 'ready' || flowState === 'shaking' ? 'true' : undefined}
        aria-live={flowState === 'revealed' ? 'polite' : undefined}
        aria-atomic={flowState === 'revealed' ? 'true' : undefined}
      >
        {announcement ? (
          <View className='squad-unboxing__stage-announcement' role='status' aria-live='polite' aria-atomic='true'>
            {announcement}
          </View>
        ) : null}
        <View className='squad-unboxing__stage-body'>
          <BlindBoxVisual
            state={flowState === 'shaking' ? 'opening' : flowState === 'revealed' ? 'open' : 'ready'}
          />
        </View>
        {flowState === 'revealed' ? (
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
        ) : null}
        <View className='squad-unboxing__stage-lid'>
          <BlindBoxLid
            state={flowState === 'shaking' ? 'opening' : flowState === 'revealed' ? 'open' : 'ready'}
          />
        </View>
        {flowState === 'revealed' ? (
          <>
            {!hasTappedCard ? (
              <View className={[
                'squad-unboxing__deck-cue',
                headerReady ? 'squad-unboxing__deck-cue--ready' : '',
              ].filter(Boolean).join(' ')}>
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
          </>
        ) : null}
      </View>

      {flowState === 'revealed' && actionDockState === 'ready' ? (
        <View
          className={[
            'squad-unboxing__action-zone',
            headerReady ? 'squad-unboxing__action-zone--ready' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >          <Button
            className='squad-unboxing__confirm-btn'
            onClick={handleConfirmAttendance}
            disabled={isSubmitting || confirmAttendanceMutation.isPending || showSuccessOverlay}
            loading={isSubmitting || confirmAttendanceMutation.isPending}
          >
            {showSuccessOverlay ? '座位已锁定' : isSubmitting ? '确认中…' : '确认出席'}
          </Button>

          <View className='squad-unboxing__action-row'>
            <Button
              variant='secondary'
              className='squad-unboxing__share-btn'
              onClick={handleSharePosterTap}
              disabled={showSuccessOverlay}
            >
              生成队伍海报
            </Button>

            <Button
              variant='secondary'
              className='squad-unboxing__detail-btn'
              onClick={handleOpenGroupDetail}
              disabled={showSuccessOverlay}
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
