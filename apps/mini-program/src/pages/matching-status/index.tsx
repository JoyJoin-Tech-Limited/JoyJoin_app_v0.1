import { Image, ScrollView, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
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
import { getStatusLabel } from '@shared/features/matching-status'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  MATCHING_NO_MATCH_HERO_SRC,
  MATCHING_WAITING_HERO_SRC,
} from './constants'
import { useMatchingStatusController } from './useMatchingStatusController'
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
    handleBrowsePools,
    handleCancel,
    handleContinueFromMembers,
    handleOpenMatchedJourney,
    handleRefreshWaitingState,
    handleRejoinPool,
    invalidateRegistrationQuery,
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
    switchToEventsTab,
    navigateBackOrEventsTab,
    venueUnlocked,
    viewerPairSummaryByMemberId,
    viewerSpotlight,
    waitingCopy,
    waitingSeats,
  } = controller

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
          <View className='matching-status__error'>
            <StatusCard
              tone='error'
              title='加载匹配信息失败'
              action={{
                label: '返回',
                onClick: navigateBackOrEventsTab,
                variant: 'secondary',
              }}
            />
          </View>
        </View>
      )
    case 'not-found':
      return (
        <View className={rootClassName}>
          <View className='matching-status__error'>
            <StatusCard
              tone='info'
              icon='😕'
              title='未找到报名记录'
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
          <Card className='matching-status__special-card'>
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
        <Text className='matching-status__card-title'>{currentRegistration.poolTitle ?? '活动信息'}</Text>

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

        {(effectiveGroupDetails?.group.venueName || currentRegistration.poolCity) ? (
          <View className='matching-status__info-row'>
            <View className='matching-status__info-label'>
              <JoyJoinIcon emoji='📍' size={24} />
              <Text>地点</Text>
            </View>
            <Text className='matching-status__info-value'>
              {effectiveGroupDetails?.group.venueName ?? currentRegistration.venueName ?? currentRegistration.poolCity}
              {(effectiveGroupDetails?.group.venueAddress ?? currentRegistration.venueAddress)
                ? ` · ${effectiveGroupDetails?.group.venueAddress ?? currentRegistration.venueAddress}`
                : currentRegistration.poolDistrict
                  ? ` · ${currentRegistration.poolDistrict}`
                  : ''}
            </Text>
          </View>
        ) : null}

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

      <View className='matching-status__spacer' />

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
        onContinueFromMembers={handleContinueFromMembers}
        onFinishLiveJourney={finishLiveJourney}
      />
    </ScrollView>
  )
}
