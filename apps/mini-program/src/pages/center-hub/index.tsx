import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import { apiRequest } from '../../lib/api/api'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import Button from '../../components/ui/Button'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import FootprintOracleCard from '../../components/events/FootprintOracleCard'
import { CountdownTickProvider } from '../../hooks/useCountdownTick'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { navigateToEventCard } from '../../lib/utils/eventCardNavigation'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { partitionJoinedEventsByDateTime } from '../events/eventPartition'
import './index.scss'

type TabKey = 'ongoing' | 'upcoming' | 'completed'

const EMPTY_STATE_COPY: Record<TabKey, { title: string; subtitle: string }> = {
  ongoing: {
    title: '此刻，还没有进行中的活动',
    subtitle: '活动有进展时，会在这里告诉你。',
  },
  upcoming: {
    title: '还没有待开始的活动',
    subtitle: '有新的安排时，会在这里告诉你。',
  },
  completed: {
    title: '第一段回忆，等你写下',
    subtitle: '活动结束后，可以在这里回看足迹。',
  },
}

function CenterHubContent({
  events,
  activeTab,
  isLoading,
  isError,
  onRetry,
}: {
  events: JoinedEventSummary[]
  activeTab: TabKey
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const { isDegradation } = useDeviceTier()

  const handleEventTap = useCallback((event: JoinedEventSummary) => {
    eventsAnalytics.trackCardTap(event, activeTab)
    navigateToEventCard(event, { isHistorical: activeTab === 'completed' })
  }, [activeTab])

  if (isLoading) {
    return (
      <View className='center-hub__loading' role='status' aria-live='polite'>
        <Image
          className={`center-hub__loading-mascot${isDegradation ? ' center-hub__loading-mascot--no-animation' : ''}`}
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('homeWelcome')}
        />
        <Text className='center-hub__loading-text'>正在加载你的活动…</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View className='center-hub__state' role='alert'>
        <Image
          className={`center-hub__error-mascot${isDegradation ? ' center-hub__error-mascot--no-animation' : ''}`}
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('actionFailure')}
        />
        <Text className='center-hub__state-title'>暂时没拿到活动状态</Text>
        <Text className='center-hub__state-subtitle'>可以重新加载，或先去发现页看看可报名的活动</Text>
        <Button
          className='center-hub__cta'
          onClick={() => {
            haptics('light')
            onRetry()
          }}
        >
          重新加载
        </Button>
      </View>
    )
  }

  if (events.length === 0) {
    return (
      <View className='center-hub__state center-hub__state--empty'>
        <XiaoyueEmptyState
          variant='editorial'
          emotion='events'
          title={EMPTY_STATE_COPY[activeTab].title}
          subtitle={EMPTY_STATE_COPY[activeTab].subtitle}
          actionLabel='去探索活动'
          onAction={() => {
            haptics('light')
            Taro.switchTab({ url: '/pages/discover/index' })
          }}
          size='lg'
        />
      </View>
    )
  }

  return (
    <ScrollView
      className='center-hub__list'
      scrollY
      enableFlex
      scrollWithAnimation
    >
      <View className='center-hub__list-content'>
        <Text className='center-hub__list-header'>你的活动</Text>
        <CountdownTickProvider>
          {events.map((event, index) => (
            <View key={event.id} className='center-hub__card'>
              <FootprintOracleCard
                event={event}
                index={index}
                isDegradation={isDegradation}
                isHistorical={activeTab === 'completed'}
                onClick={handleEventTap}
              />
            </View>
          ))}
        </CountdownTickProvider>
        <View className='center-hub__bottom-spacer' />
      </View>
    </ScrollView>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  // Warm own first-viewport assets + adjacent tabs' assets during idle so
  // the next tab switch paints instantly.
  useEffect(() => {
    preloadRouteAssets('pages/center-hub/index')
    preloadPredictiveAssets('pages/center-hub/index')
  }, [])

  const {
    data: events = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
    staleTime: 30_000,
  })

  const [activeTab, setActiveTab] = useState<TabKey>('ongoing')
  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  useDidShow(() => {
    // Re-show and center-tab re-tap intentionally preserve the selected bucket.
  })

  const partitionedEvents = useMemo(() => partitionJoinedEventsByDateTime(events), [events])
  const displayEvents = partitionedEvents[activeTab]

  const handleTabChange = useCallback((tab: TabKey) => {
    if (tab === activeTab) return
    haptics('light')
    setActiveTab(tab)
    eventsAnalytics.track('events_tab_switch', { tab })
  }, [activeTab])

  return renderGate(
    <PageMorphWrapper
      isLoading={authLoading}
      loading={<LoadingScreen message='正在加载你的活动…' />}
      content={
        <View className={`center-hub ${tabEntranceClass}`}>
          <View className='center-hub__tabs' role='tablist'>
            <View
              className={`center-hub__tab ${activeTab === 'ongoing' ? 'center-hub__tab--active' : ''}`}
              role='tab'
              aria-selected={activeTab === 'ongoing'}
              hoverClass='center-hub__tab--pressed'
              onClick={() => handleTabChange('ongoing')}
            >
              <Text className='center-hub__tab-text'>进行中</Text>
            </View>
            <View
              className={`center-hub__tab ${activeTab === 'upcoming' ? 'center-hub__tab--active' : ''}`}
              role='tab'
              aria-selected={activeTab === 'upcoming'}
              hoverClass='center-hub__tab--pressed'
              onClick={() => handleTabChange('upcoming')}
            >
              <Text className='center-hub__tab-text'>待开始</Text>
            </View>
            <View
              className={`center-hub__tab ${activeTab === 'completed' ? 'center-hub__tab--active' : ''}`}
              role='tab'
              aria-selected={activeTab === 'completed'}
              hoverClass='center-hub__tab--pressed'
              onClick={() => handleTabChange('completed')}
            >
              <Text className='center-hub__tab-text'>已结束</Text>
            </View>
          </View>
          <CenterHubContent
            events={displayEvents}
            activeTab={activeTab}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
          />
        </View>
      }
    />
  )
}
