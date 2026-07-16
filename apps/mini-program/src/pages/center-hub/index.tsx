import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import Button from '../../components/ui/Button'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import FootprintOracleCard from '../../components/events/FootprintOracleCard'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import './index.scss'

function CenterHubContent({
  events,
  isLoading,
  isError,
}: {
  events: JoinedEventSummary[]
  isLoading: boolean
  isError: boolean
}) {
  const { isDegradation } = useDeviceTier()

  const handleEventTap = (event: JoinedEventSummary) => {
    Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(event.id)}`,
    })
  }

  if (isLoading) {
    return (
      <View className='center-hub__loading'>
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
      <View className='center-hub__state'>
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
            Taro.reLaunch({ url: '/pages/center-hub/index' })
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
        <View className='center-hub__empty-hero'>
          <View className='center-hub__empty-deco' aria-hidden='true'>
            <View className='center-hub__empty-deco-dot center-hub__empty-deco-dot--1' />
            <View className='center-hub__empty-deco-dot center-hub__empty-deco-dot--2' />
            <View className='center-hub__empty-deco-dot center-hub__empty-deco-dot--3' />
          </View>
          <View className='center-hub__empty-glow'>
            <Image
              className='center-hub__empty-mascot'
              src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
              mode='aspectFit'
              aria-label='悦仔'
            />
          </View>
          <Text className='center-hub__empty-title'>暂无进行中的活动</Text>
          <Text className='center-hub__empty-subtitle'>报名成功后，你的匹配进度和小队揭晓会出现在这里。</Text>
          <View
            className='center-hub__empty-cta'
            hoverClass='center-hub__empty-cta--pressed'
            onClick={() => {
              haptics('light')
              Taro.switchTab({ url: '/pages/discover/index' })
            }}
            role='button'
            aria-label='去探索活动'
          >
            <Text className='center-hub__empty-cta-text'>去探索活动</Text>
          </View>
        </View>

        <View className='center-hub__flow-card'>
          <Text className='center-hub__flow-title'>活动流程</Text>
          <View className='center-hub__flow-steps'>
            <View className='center-hub__flow-step'>
              <View className='center-hub__flow-step-indicator center-hub__flow-step-indicator--active'>
                <Image
                  className='center-hub__flow-step-img'
                  src={cdnAsset('/assets/icons/flow-icons/flow-1.webp')}
                  mode='aspectFit'
                />
              </View>
              <Text className='center-hub__flow-step-label'>报名成功</Text>
            </View>
            <View className='center-hub__flow-connector' aria-hidden='true' />
            <View className='center-hub__flow-step'>
              <View className='center-hub__flow-step-indicator'>
                <Image
                  className='center-hub__flow-step-img'
                  src={cdnAsset('/assets/icons/flow-icons/flow-2.webp')}
                  mode='aspectFit'
                />
              </View>
              <Text className='center-hub__flow-step-label'>等待匹配</Text>
            </View>
            <View className='center-hub__flow-connector' aria-hidden='true' />
            <View className='center-hub__flow-step'>
              <View className='center-hub__flow-step-indicator'>
                <Image
                  className='center-hub__flow-step-img'
                  src={cdnAsset('/assets/icons/flow-icons/flow-3.webp')}
                  mode='aspectFit'
                />
              </View>
              <Text className='center-hub__flow-step-label'>小队揭晓</Text>
            </View>
            <View className='center-hub__flow-connector' aria-hidden='true' />
            <View className='center-hub__flow-step'>
              <View className='center-hub__flow-step-indicator center-hub__flow-step-indicator--active'>
                <Image
                  className='center-hub__flow-step-img'
                  src={cdnAsset('/assets/icons/flow-icons/flow-4.webp')}
                  mode='aspectFit'
                />
              </View>
              <Text className='center-hub__flow-step-label'>确认出席</Text>
            </View>
          </View>
        </View>
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
      <Text className='center-hub__list-header'>你的活动</Text>
      {events.map((event, index) => (
        <View key={event.id} className='center-hub__card'>
          <FootprintOracleCard
            event={event}
            index={index}
            isDegradation={isDegradation}
            onClick={handleEventTap}
          />
        </View>
      ))}
      <View className='center-hub__bottom-spacer' />
    </ScrollView>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  const {
    data: events = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
  })

  return renderGate(
    <PageMorphWrapper
      isLoading={authLoading}
      loading={<LoadingScreen message='正在加载你的活动…' />}
      content={
        <View className='center-hub tab-page-enter'>
          <CenterHubContent
            events={events}
            isLoading={isLoading}
            isError={isError}
          />
        </View>
      }
    />
  )
}
