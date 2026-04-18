import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  MatchingHero,
  MatchingStatusDetailSections,
  MatchingStatusLiveOverlay,
  MatchingStatusPendingSection,
} from './MatchingStatusSections'
import {
  formatDateTime,
  getStatusLabel,
  MATCHING_NO_MATCH_HERO_SRC,
  MATCHING_WAITING_HERO_SRC,
} from './matchingStatusViewModels'
import { useMatchingStatusController } from './useMatchingStatusController'
import './index.scss'

export default function MatchingStatusPage() {
  const router = useRouter()
  const registrationId = router.params.registrationId ?? ''

  const {
    authLoading,
    isLoading,
    fetchError,
    registration,
    rootClassName,
    shouldReduceMotion,
    matchStatus,
    resolvedGroupId,
    matchedData,
    effectiveGroupDetails,
    effectiveEventDateTime,
    countdown,
    isCancelled,
    isNoMatchState,
    venueUnlocked,
    waitingCopy,
    currentFill,
    minGroupSize,
    maxGroupSize,
    seatsNeeded,
    fillStatusText,
    waitingSeats,
    newMemberJoined,
    newMemberArchetype,
    refreshCountdown,
    persistedThemeSummary,
    viewerPairSummaryByMemberId,
    viewerSpotlight,
    chemistryTokens,
    leadIceBreaker,
    groupAnalysis,
    liveRevealError,
    liveStage,
    isLoadingLiveGroupDetails,
    handleRefreshWaitingState,
    handleOpenMatchedJourney,
    handleBrowsePools,
    handleRejoinPool,
    handleCancel,
    isCancelling,
    handleContinueFromMembers,
    finishLiveJourney,
    similarPools,
    invalidateRegistrationQuery,
    switchToEventsTab,
    navigateBackOrEventsTab,
    stageTemperature,
  } = useMatchingStatusController({ registrationId, routerParams: router.params })

  if (authLoading || isLoading) {
    return <LoadingScreen message='加载匹配状态…' />
  }

  if (fetchError || !registration) {
    return (
      <View className={rootClassName}>
        <View className='matching-status__error'>
          <Text className='matching-status__error-icon'>😕</Text>
          <Text className='matching-status__error-text'>
            {fetchError ? '加载匹配信息失败' : '未找到报名记录'}
          </Text>
          <Button
            variant='secondary'
            className='matching-status__error-btn'
            onClick={navigateBackOrEventsTab}
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  if (isCancelled) {
    return (
      <View className={rootClassName}>
        <Card className='matching-status__special-card'>
          <Text className='matching-status__special-icon'>😔</Text>
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
  }

  if (isNoMatchState) {
    return (
      <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
        <MatchingHero heroSrc={MATCHING_NO_MATCH_HERO_SRC} className='matching-status__hero--no-match' />

        <Card className='matching-status__special-card matching-status__special-card--stacked'>
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
                  {pool.eventType ?? registration.poolEventType}
                  {pool.city ? ` · ${pool.city}` : ''}
                  {pool.district ? ` ${pool.district}` : ''}
                </Text>
                <Text className='matching-status__similar-meta'>
                  {formatDateTime(pool.dateTime)}
                  {typeof pool.registrationCount === 'number' ? ` · 已有 ${pool.registrationCount} 人入座` : ''}
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

  return (
    <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
      {matchStatus === 'pending' ? (
        <MatchingHero heroSrc={MATCHING_WAITING_HERO_SRC} className='matching-status__hero--waiting' />
      ) : null}

      <View className={`matching-status__header${matchStatus === 'pending' ? ' matching-status__header--with-hero' : ''}`}>
        <Text className='matching-status__status-emoji'>
          {matchStatus === 'matched' ? '🎉' : matchStatus === 'completed' ? '✅' : '⏳'}
        </Text>
        <Text className='matching-status__status-title'>{getStatusLabel(matchStatus)}</Text>
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
          onRefreshWaitingState={handleRefreshWaitingState}
        />
      ) : null}

      <Card className='matching-status__card'>
        <Text className='matching-status__card-title'>{registration.poolTitle ?? '活动信息'}</Text>

        {registration.poolEventType ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>🎯 类型</Text>
            <Text className='matching-status__info-value'>{registration.poolEventType}</Text>
          </View>
        ) : null}

        {(effectiveEventDateTime ?? registration.poolDateTime) ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📅 时间</Text>
            <Text className='matching-status__info-value'>
              {formatDateTime(effectiveEventDateTime ?? registration.poolDateTime)}
            </Text>
          </View>
        ) : null}

        {(effectiveGroupDetails?.group.venueName || registration.poolCity) ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📍 地点</Text>
            <Text className='matching-status__info-value'>
              {effectiveGroupDetails?.group.venueName ?? registration.venueName ?? registration.poolCity}
              {(effectiveGroupDetails?.group.venueAddress ?? registration.venueAddress) ? ` · ${effectiveGroupDetails?.group.venueAddress ?? registration.venueAddress}` : registration.poolDistrict ? ` · ${registration.poolDistrict}` : ''}
            </Text>
          </View>
        ) : null}

        {registration.matchScore != null ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>💯 匹配分</Text>
            <Text className='matching-status__info-value matching-status__info-value--score'>
              {registration.matchScore}
            </Text>
          </View>
        ) : null}
      </Card>

      {liveRevealError ? (
        <Card className='matching-status__notice-card'>
          <Text className='matching-status__notice-text'>{liveRevealError}</Text>
        </Card>
      ) : null}

      <MatchingStatusDetailSections
        showMatchedDetails={matchStatus === 'matched'}
        showChemistryCard={Boolean(
          matchStatus === 'matched' && (viewerSpotlight || groupAnalysis?.overallChemistry || leadIceBreaker),
        )}
        effectiveGroupDetails={effectiveGroupDetails}
        viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
        viewerSpotlight={viewerSpotlight}
        chemistryTokens={chemistryTokens}
        leadIceBreaker={leadIceBreaker}
        persistedThemeSummary={persistedThemeSummary}
        groupAnalysisDebugMeta={
          groupAnalysis
            ? { fromCache: groupAnalysis.fromCache, generatedAt: groupAnalysis.generatedAt }
            : null
        }
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
            <Text className='matching-status__loading-text'>匹配已经完成，桌友卡片和主题揭晓马上就会到位。</Text>
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
          <Button
            variant='primary'
            className='matching-status__back-btn'
            onClick={switchToEventsTab}
          >
            查看更多活动
          </Button>
        ) : null}
      </View>

      <View className='matching-status__spacer' />

      <MatchingStatusLiveOverlay
        liveStage={liveStage}
        stageTemperature={stageTemperature}
        isLoadingLiveGroupDetails={isLoadingLiveGroupDetails}
        effectiveGroupDetails={effectiveGroupDetails}
        viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
        viewerSpotlight={viewerSpotlight}
        matchedGroupNumber={matchedData?.groupNumber}
        shouldReduceMotion={shouldReduceMotion}
        persistedThemeSummary={persistedThemeSummary}
        resolvedGroupId={resolvedGroupId}
        onContinueFromMembers={handleContinueFromMembers}
        onFinishLiveJourney={finishLiveJourney}
      />
    </ScrollView>
  )
}
