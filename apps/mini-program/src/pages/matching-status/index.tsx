import { CustomWrapper, Image, ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef } from 'react'
import { useRouter, useDidShow } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getMyPoolRegistrations } from '@shared/api'
import { getStatusLabel } from '@shared/features/matching-status'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import StatusCard from '../../components/ui/StatusCard'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import {
  MatchingHero,
  MatchingStatusDetailSections,
  MatchingStatusLiveOverlay,
  MatchingStatusPendingSection,
} from './MatchingStatusSections'
import { MatchCompassShell } from './MatchCompassSections'
import { haptics } from '../../lib/utils/haptics'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  MATCHING_NO_MATCH_HERO_SRC,
  MATCHING_WAITING_HERO_SRC,
} from './constants'
import MatchHistorySection from './MatchHistorySection'
import { useMatchingStatusController } from './useMatchingStatusController'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { apiRequest } from '../../lib/api/api'
import { REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'
import './index.scss'

export default function MatchingStatusPage() {
  const router = useRouter()
  const registrationId = router.params.registrationId ?? ''
  const controller = useMatchingStatusController({
    registrationId,
    routerParams: router.params,
  })

  const {
    chemistryTokens,
    unifiedReveal,
    countdown,
    currentFill,
    effectiveEventDateTime,
    effectiveGroupDetails,
    fillStatusText,
    finishLiveJourney,
    groupAnalysis,
    hasRevealed,
    handleBrowsePools: _handleBrowsePools,
    handleCancel: _handleCancel,
    handleContinueFromMembers,
    handleOpenMatchedJourney: _handleOpenMatchedJourney,
    handleRefreshWaitingState: _handleRefreshWaitingState,
    handleRejoinPool: _handleRejoinPool,
    invalidateRegistrationQuery: _invalidateRegistrationQuery,
    handleRetryLiveReveal: _handleRetryLiveReveal,
    handleDismissLiveReveal: _handleDismissLiveReveal,
    isCancelling,
    isLoadingLiveGroupDetails,
    leadIceBreaker,
    liveRevealError,
    liveStage,
    matchStatus,
    matchedData,
    maxGroupSize,
    minGroupSize,
    newMemberArchetype,
    newMemberJoined,
    persistedThemeSummary,
    refreshCountdown,
    resolvedGroupId,
    rootClassName,
    seatsNeeded,
    screenState,
    shouldReduceMotion,
    similarPools,
    stageTemperature,
    switchToEventsTab: _switchToEventsTab,
    navigateBackOrEventsTab: _navigateBackOrEventsTab,
    venueUnlocked,
    viewerPairSummaryByMemberId,
    viewerSpotlight,
    waitingCopy,
    waitingSeats,
    matchCompassEnabled,
    matchCompass,
    isMatchCompassFetching,
    handleUpdateMatchCompass,
    matchingLiveRevealEnabled,
  } = controller

  const handleBrowsePools = () => { haptics('light'); _handleBrowsePools() }
  const handleCancel = () => { haptics('light'); _handleCancel() }
  const handleOpenMatchedJourney = () => { haptics('medium'); _handleOpenMatchedJourney() }
  const handleRefreshWaitingState = () => { haptics('light'); _handleRefreshWaitingState() }

  const hasDidShowRef = useRef(false)
  useDidShow(() => {
    // Skip the first show (mount) to avoid duplicating the initial query fetch.
    if (!hasDidShowRef.current) {
      hasDidShowRef.current = true
      return
    }
    _handleRefreshWaitingState()
  })
  const handleRejoinPool = (poolId: string) => { haptics('light'); _handleRejoinPool(poolId) }
  const invalidateRegistrationQuery = () => { haptics('light'); _invalidateRegistrationQuery() }
  const handleRetryLiveReveal = () => { haptics('light'); _handleRetryLiveReveal() }
  const handleDismissLiveReveal = () => { haptics('light'); _handleDismissLiveReveal() }
  const switchToEventsTab = () => { haptics('light'); _switchToEventsTab() }
  const navigateBackOrEventsTab = () => { haptics('light'); _navigateBackOrEventsTab() }

  const { data: allRegistrations } = useQuery({
    queryKey: [...REGISTRATIONS_QUERY_KEY],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: screenState.kind === 'ready' || screenState.kind === 'no-match' || screenState.kind === 'cancelled',
    staleTime: 60_000,
    refetchInterval: 30_000,
  })

  const historicalMatches = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(
      (r) =>
        r.id !== registrationId &&
        r.assignedGroupId != null &&
        (r.matchStatus === 'matched' || r.matchStatus === 'completed'),
    )
  }, [allRegistrations, registrationId])

  const { isPrimary } = useDeviceTier()
  const enableAnimations = isPrimary && !shouldReduceMotion

  // Celebration haptic when user gets matched — fire only on transition to matched,
  // not on every re-mount (e.g., swipe-back), to avoid repetitive haptic noise.
  const prevMatchStatusRef = useRef(matchStatus)
  useEffect(() => {
    const prev = prevMatchStatusRef.current
    const now = matchStatus
    prevMatchStatusRef.current = now
    if (now === 'matched' && prev !== 'matched' && !shouldReduceMotion) {
      haptics('success')
    }
  }, [matchStatus, shouldReduceMotion])

  switch (screenState.kind) {
    case 'loading':
      return (
        <View className='matching-status__loading-shake'>
          <LoadingScreen message='正在编织你的缘分线…' />
        </View>
      )
    case 'error':
      return (
        <View className={rootClassName}>
          <View className={`matching-status__error ${enableAnimations ? 'matching-status__special-state--enter' : ''}`}>
            <StatusCard
              tone='error'
              title={getErrorMessage('load-failed')}
              action={{
                label: '返回',
                onClick: navigateBackOrEventsTab,
                variant: 'secondary',
              }}
            />
            <View className='matching-status__error-actions'>
              <Button
                variant='primary'
                className='matching-status__error-retry-btn'
                onClick={invalidateRegistrationQuery}
              >
                重试
              </Button>
            </View>
          </View>
        </View>
      )
    case 'not-found':
      return (
        <View className={rootClassName}>
          <View className={`matching-status__error ${enableAnimations ? 'matching-status__special-state--enter' : ''}`}>
            <StatusCard
              tone='info'
              icon='😕'
              title='没有找到报名记录'
              action={{
                label: '返回',
                onClick: navigateBackOrEventsTab,
                variant: 'secondary',
              }}
            />
          </View>
        </View>
      )
    case 'cancelled':
      return (
        <View className={rootClassName}>
          <Card className={`matching-status__special-card ${enableAnimations ? 'matching-status__special-state--enter' : ''}`}>
            <JoyJoinIcon emoji='😕' size={88} className='matching-status__special-icon' />
            <Text className='matching-status__special-title'>这场活动已取消</Text>
            <Text className='matching-status__special-text'>
              很抱歉，这场活动未能按计划进行。你可以回到发现页，重新挑一场更适合你的局。
            </Text>
            <View className='matching-status__actions'>
              <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
                去看看别的活动
              </Button>
              <Button
                variant='secondary'
                className='matching-status__secondary-btn'
                onClick={switchToEventsTab}
              >
                返回我的活动
              </Button>
            </View>
          </Card>
        </View>
      )
    case 'no-match': {
      const currentRegistration = screenState.registration

      return (
        <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
          <MatchingHero
            heroSrc={MATCHING_NO_MATCH_HERO_SRC}
            className='matching-status__hero--no-match'
          />

          <Card className={`matching-status__special-card matching-status__special-card--stacked ${enableAnimations ? 'matching-status__special-state--enter' : ''}`}>
            <Image
              className='matching-status__special-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('optOutReassure')}
            />
            <Text className='matching-status__special-title'>这次还没等到合适的一桌</Text>
            <Text className='matching-status__special-text'>
              {countdown.label}。与其勉强凑桌，我们更想把你留给更对味的人。
            </Text>
            <View className='matching-status__actions'>
              <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
                看看别的活动
              </Button>
              <Button
                variant='secondary'
                className='matching-status__secondary-btn'
                onClick={invalidateRegistrationQuery}
              >
                刷新状态
              </Button>
            </View>
          </Card>

          {similarPools.length > 0 ? (
            <View className='matching-status__similar-section'>
              <Text className='matching-status__similar-title'>附近还有这些局</Text>
              {similarPools.map((pool) => (
                <Card key={pool.id} className='matching-status__similar-card'>
                  <Text className='matching-status__similar-name'>{pool.title ?? '推荐活动'}</Text>
                  <Text className='matching-status__similar-meta'>
                    {pool.eventType ?? currentRegistration.poolEventType}
                    {pool.city ? ` · ${pool.city}` : ''}
                    {pool.district ? ` ${pool.district}` : ''}
                  </Text>
                  <Text className='matching-status__similar-meta'>
                    {formatDateTime(pool.dateTime)}
                    {typeof pool.registrationCount === 'number'
                      ? ` · 已有 ${pool.registrationCount} 人入座`
                      : ''}
                  </Text>
                  <Button
                    variant='secondary'
                    className='matching-status__similar-btn'
                    onClick={() => handleRejoinPool(pool.id)}
                  >
                    重新报名这场
                  </Button>
                </Card>
              ))}
            </View>
          ) : null}

          <View className='matching-status__spacer' />
        </ScrollView>
      )
    }
    case 'ready':
      break
  }

  const currentRegistration = screenState.registration

  const groupAnalysisDebugMeta = groupAnalysis
    ? {
        fromCache: groupAnalysis.fromCache,
        generatedAt: groupAnalysis.generatedAt,
      }
    : null

  return (
    <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
      {matchStatus === 'pending' ? (
        <MatchingHero
          heroSrc={MATCHING_WAITING_HERO_SRC}
          className='matching-status__hero--waiting'
        />
      ) : null}

      <View
        className={`matching-status__header${matchStatus === 'pending' ? ' matching-status__header--with-hero' : ''}`}
      >
        <View
          className={`matching-status__status-dot matching-status__status-dot--${matchStatus}`}
        />
        {matchStatus === 'pending' ? (
          <JoyJoinIcon emoji='⏳' size={44} className='matching-status__header-icon' />
        ) : matchStatus === 'matched' ? (
          <JoyJoinIcon emoji='🎉' size={44} className='matching-status__header-icon' />
        ) : matchStatus === 'completed' ? (
          <JoyJoinIcon emoji='✅' size={44} className='matching-status__header-icon' />
        ) : null}
        <Text className='matching-status__status-title'>
          {getStatusLabel(matchStatus)}
        </Text>
        {matchStatus === 'pending' ? (
          <View className='matching-status__dots'>
            <View className='matching-status__dot matching-status__dot--1' />
            <View className='matching-status__dot matching-status__dot--2' />
            <View className='matching-status__dot matching-status__dot--3' />
          </View>
        ) : null}
        <Text className='matching-status__status-hint'>
          {matchStatus === 'pending'
            ? `${countdown.label}，等待更多人加入…`
            : venueUnlocked
              ? '桌友和活动信息都已逐步解锁，继续查看今晚的安排。'
              : '桌友已经锁定，活动详情会在下一页继续逐步揭晓。'}
        </Text>
      </View>

      {matchStatus === 'pending' && matchCompassEnabled ? (
        <MatchCompassShell
          data={matchCompass}
          onUpdate={handleUpdateMatchCompass}
          shouldReduceMotion={shouldReduceMotion}
          isUpdating={isMatchCompassFetching}
        />
      ) : null}

      {matchStatus === 'pending' ? (
        <MatchingStatusPendingSection
          newMemberJoined={newMemberJoined}
          newMemberArchetype={newMemberArchetype}
          waitingCopy={waitingCopy}
          currentFill={currentFill}
          maxGroupSize={maxGroupSize}
          minGroupSize={minGroupSize}
          seatsNeeded={seatsNeeded}
          waitingSeats={waitingSeats}
          fillStatusText={fillStatusText}
          refreshCountdown={refreshCountdown}
          shouldReduceMotion={shouldReduceMotion}
        />
      ) : null}

      <Card className='matching-status__card'>
        <View className='matching-status__card-title-row'>
          <JoyJoinIcon emoji='📋' size={28} className='matching-status__card-title-icon' />
          <Text className='matching-status__card-title'>{currentRegistration.poolTitle ?? '活动信息'}</Text>
        </View>

        {currentRegistration.poolEventType ? (
          <View className='matching-status__info-row'>
            <View className='matching-status__info-label'>
              <JoyJoinIcon emoji='🎯' size={24} />
              <Text>类型</Text>
            </View>
            <Text className='matching-status__info-value'>{currentRegistration.poolEventType}</Text>
          </View>
        ) : null}

        {(effectiveEventDateTime ?? currentRegistration.poolDateTime) ? (
          <View className='matching-status__info-row'>
            <View className='matching-status__info-label'>
              <JoyJoinIcon emoji='📅' size={24} />
              <Text>时间</Text>
            </View>
            <Text className='matching-status__info-value'>
              {formatDateTime(
                effectiveEventDateTime ?? currentRegistration.poolDateTime,
              )}
            </Text>
          </View>
        ) : null}

        <View className='matching-status__info-row'>
          <View className='matching-status__info-label'>
            <JoyJoinIcon emoji='📍' size={24} />
            <Text>地点</Text>
          </View>
          <Text className='matching-status__info-value'>
            {effectiveGroupDetails?.group.venueName || currentRegistration.venueName || (effectiveGroupDetails?.group.venueAssignmentStatus === 'unassigned' ? '地点待定' : currentRegistration.poolCity || '地点待定')}
            {effectiveGroupDetails?.group.venueAddress || currentRegistration.venueAddress
              ? ` · ${effectiveGroupDetails?.group.venueAddress ?? currentRegistration.venueAddress}`
              : currentRegistration.poolDistrict && (effectiveGroupDetails?.group.venueName || currentRegistration.venueName)
                ? ` · ${currentRegistration.poolDistrict}`
                : ''}
          </Text>
        </View>

        {currentRegistration.matchScore != null ? (
          <View className='matching-status__info-row'>
            <View className='matching-status__info-label'>
              <JoyJoinIcon emoji='👥' size={24} />
              <Text>匹配分</Text>
            </View>
            <Text className='matching-status__info-value matching-status__info-value--score'>
              {currentRegistration.matchScore}
            </Text>
          </View>
        ) : null}
      </Card>

      {liveRevealError ? (
        <Card className='matching-status__notice-card'>
          <Text className='matching-status__notice-text'>{liveRevealError}</Text>
          <View className='matching-status__notice-actions'>
            <Button
              variant='secondary'
              className='matching-status__notice-btn'
              onClick={handleRetryLiveReveal}
            >
              刷新
            </Button>
            <Button
              variant='secondary'
              className='matching-status__notice-dismiss-btn'
              onClick={handleDismissLiveReveal}
            >
              关闭
            </Button>
          </View>
        </Card>
      ) : null}

      <MatchingStatusDetailSections
        showMatchedDetails={matchStatus === 'matched'}
        showChemistryCard={Boolean(
          matchStatus === 'matched' && (viewerSpotlight || groupAnalysis?.overallChemistry || leadIceBreaker || unifiedReveal),
        )}
        effectiveGroupDetails={effectiveGroupDetails}
        viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
        viewerSpotlight={viewerSpotlight}
        chemistryTokens={chemistryTokens}
        unifiedReveal={unifiedReveal}
        leadIceBreaker={leadIceBreaker}
        persistedThemeSummary={persistedThemeSummary}
        groupAnalysisDebugMeta={groupAnalysisDebugMeta}
      />

      <View className='matching-status__actions'>
        {matchStatus === 'matched' && resolvedGroupId ? (
          <Button className='matching-status__cta-btn' onClick={handleOpenMatchedJourney}>
            查看活动详情
          </Button>
        ) : null}

        {matchStatus === 'matched' && !resolvedGroupId ? (
          <Card className='matching-status__loading-card'>
            <Text className='matching-status__loading-title'>正在整理你的小队信息</Text>
            <Text className='matching-status__loading-text'>
              匹配已经完成，桌友卡片和主题揭晓马上就会到位。
            </Text>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={invalidateRegistrationQuery}
            >
              立即刷新
            </Button>
          </Card>
        ) : null}

        {matchStatus === 'pending' ? (
          <Button
            variant='secondary'
            className='matching-status__secondary-btn'
            onClick={handleRefreshWaitingState}
          >
            刷新匹配进度
          </Button>
        ) : null}

        {matchStatus === 'pending' ? (
          <View className='matching-status__cancel-row'>
            <Image
              className='matching-status__cancel-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('optOutReassure')}
            />
            <Button
              variant='secondary'
              className='matching-status__cancel-btn'
              onClick={handleCancel}
              disabled={isCancelling}
              loading={isCancelling}
            >
              {isCancelling ? '取消中…' : '取消报名'}
            </Button>
          </View>
        ) : null}

        {matchStatus === 'completed' ? (
          <Button variant='primary' className='matching-status__back-btn' onClick={switchToEventsTab}>
            查看更多活动
          </Button>
        ) : null}
      </View>

      {historicalMatches.length > 0 ? (
        <MatchHistorySection
          matches={historicalMatches}
          shouldReduceMotion={shouldReduceMotion}
        />
      ) : null}

      <View className='matching-status__spacer' />

      {matchingLiveRevealEnabled && (
        <CustomWrapper>
          <MatchingStatusLiveOverlay
            liveStage={liveStage}
            stageTemperature={stageTemperature}
            isLoadingLiveGroupDetails={isLoadingLiveGroupDetails}
            effectiveGroupDetails={effectiveGroupDetails}
            viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
            viewerSpotlight={viewerSpotlight}
            unifiedReveal={unifiedReveal}
            matchedGroupNumber={matchedData?.groupNumber}
            shouldReduceMotion={shouldReduceMotion}
            hasRevealed={hasRevealed}
            persistedThemeSummary={persistedThemeSummary}
            resolvedGroupId={resolvedGroupId}
            liveRevealError={liveRevealError}
            onContinueFromMembers={handleContinueFromMembers}
            onFinishLiveJourney={finishLiveJourney}
            onRetryLiveReveal={handleRetryLiveReveal}
            onDismissLiveReveal={handleDismissLiveReveal}
          />
        </CustomWrapper>
      )}
    </ScrollView>
  )
}
