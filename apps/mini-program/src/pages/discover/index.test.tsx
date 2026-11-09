import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DiscoverPage from './index'

const mocks = vi.hoisted(() => ({
  pools: {
    data: [] as Array<Record<string, unknown>>,
    isLoading: false,
    isError: false,
    isFetching: false,
  },
  savedLocation: null as string | null,
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  invalidateQueries: vi.fn(),
  evictPersistedQuery: vi.fn(),
  track: vi.fn(),
  trackImpression: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: mocks.getStorageSync,
    setStorageSync: mocks.setStorageSync,
    removeStorageSync: mocks.removeStorageSync,
    getCurrentInstance: () => ({ page: { getTabBar: () => null } }),
    pageScrollTo: vi.fn(() => Promise.resolve()),
    createSelectorQuery: () => ({
      select: () => ({ boundingClientRect: () => ({}) }),
      selectViewport: () => ({ scrollOffset: () => ({}) }),
      exec: vi.fn(),
    }),
    navigateTo: vi.fn(() => Promise.resolve()),
    redirectTo: vi.fn(() => Promise.resolve()),
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  },
  usePullDownRefresh: vi.fn(),
  usePageScroll: vi.fn(),
  useDidHide: vi.fn(),
  useDidShow: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: any) => <img {...props} />,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[1] === 'event-pools') return mocks.pools
    if (queryKey[1] === 'my-pool-registrations') return { data: [], isLoading: false }
    return { data: undefined }
  },
}))

vi.mock('@shared/api', () => ({
  getEventPools: vi.fn(),
  getMyPoolRegistrations: vi.fn(),
}))
vi.mock('@shared/districts', () => ({
  getClusterById: (id: string) => id === 'nanshan'
    ? { displayName: '南山中心区', districts: [{ heat: 'live' }] }
    : undefined,
  getClusterIdByDistrictId: () => undefined,
  getClusterIdByDistrictName: (name?: string) => name === '南山区' ? 'nanshan' : undefined,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: {
      id: 'user-1',
      displayName: '测试用户',
      primaryArchetype: 'corgi',
      features: { promoBannerEnabled: false, guidanceQueueEnabled: false },
    },
  }),
}))
vi.mock('../../hooks/useGuidanceQueue', () => ({
  useGuidanceQueue: () => ({ activeTip: null, exiting: false, dismiss: vi.fn() }),
}))
vi.mock('../../hooks/navigation/useCustomTabBarSync', () => ({ useCustomTabBarSync: vi.fn() }))
vi.mock('../../hooks/useNotificationCounts', () => ({
  useNotificationCounts: () => ({ data: { total: 0 } }),
}))

vi.mock('../../lib/api/api', () => ({ apiRequest: vi.fn(), fetchDiscoverShell: vi.fn() }))
vi.mock('../../lib/api/discoverPools', () => ({ loadDiscoverPools: vi.fn() }))
vi.mock('../../lib/api/persistentCache', () => ({ evictPersistedQuery: mocks.evictPersistedQuery }))
vi.mock('../../lib/prefetchEngine', () => ({
  injectDiscoverShellIntoCache: vi.fn(),
  POOLS_QUERY_KEY: ['mini-program', 'event-pools'],
}))
vi.mock('../../lib/onboarding/onboardingRoutes', () => ({
  MINI_PROGRAM_ROUTES: {
    notifications: '/pages/notifications/index',
    alangEvent: '/pages/alang/event/index',
    alangTeaser: '/pages/alang/teaser/index',
    index: '/pages/index/index',
  },
}))
vi.mock('../../lib/onboarding/onboardingAnalytics', () => ({
  onboardingAnalytics: { stepStarted: vi.fn(), interaction: vi.fn() },
}))
vi.mock('../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: mocks.track, trackImpression: mocks.trackImpression },
}))
vi.mock('../../lib/dev/devPoolMocks', () => ({ getDevMockPools: () => [] }))
vi.mock('../../lib/utils/cdnAssets', () => ({
  cdnAsset: (path: string) => path,
  localAsset: (path: string) => path,
}))
vi.mock('../../lib/utils/brandFont', () => ({ loadBrandDisplayFont: vi.fn() }))
vi.mock('../../lib/utils/routePreloadAssets', () => ({
  preloadRouteAssets: vi.fn(),
  preloadPredictiveAssets: vi.fn(),
}))
vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../lib/utils/timeGreeting', () => ({ getTimeGreeting: () => '晚上好' }))
vi.mock('../../lib/utils/discoverHeaderCopy', () => ({ getDiscoverSubtitle: () => '发现适合你的聚会' }))
vi.mock('../../lib/utils/tabEntranceState', () => ({ consumeTabEntrance: () => false }))
vi.mock('../../lib/utils/showRefreshGate', () => ({ shouldRefreshOnShow: () => false }))
vi.mock('../../lib/utils/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn() }))
vi.mock('../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/xiaoyue.webp',
}))
vi.mock('../../lib/alang/alangAccess', () => ({ isStreetBlindBoxLive: () => false }))
vi.mock('../../lib/utils/systemInfo', () => ({
  getSystemInfoCompat: () => ({ windowWidth: 375, reduceMotion: false, benchmarkLevel: 20 }),
}))
vi.mock('../../lib/utils/discoverCounts', () => ({
  buildDiscoverCounts: () => ({ weekCountsByCluster: {}, weekTotal: 0, nextEventByCluster: {} }),
}))

vi.mock('../../components/loading/LoadingScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))
vi.mock('../../components/ui/PageMorphWrapper', () => ({
  default: ({ isLoading, loading, content }: any) => <>{isLoading ? loading : content}</>,
}))
vi.mock('../../components/ui/StatusCard', () => ({
  default: ({ title, description, action }: any) => (
    <div data-testid='discover-status-card'>
      <span>{title}</span>
      <span>{description}</span>
      {action && <button type='button' onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
}))
vi.mock('../../components/mascot/XiaoyueEmptyState', () => ({
  default: ({ title, subtitle, actionLabel, onAction, variant, emotion }: any) => (
    <div data-testid='discover-empty-state' data-variant={variant} data-emotion={emotion}>
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
      {actionLabel && onAction && <button type='button' onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))
vi.mock('../../components/HeroPromoBanner', () => ({ default: () => null }))
vi.mock('../../components/VirtualList', () => ({
  default: ({ items, renderItem, keyExtractor, listClassName }: any) => (
    <div className={listClassName}>
      {items.map((item: any, index: number) => (
        <React.Fragment key={keyExtractor(item)}>{renderItem(item, index, true)}</React.Fragment>
      ))}
    </div>
  ),
}))
vi.mock('../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../components/discover/OracleCard', () => ({
  default: ({ pool }: any) => <button type='button' data-testid={`pool-card-${pool.id}`}>{pool.title}</button>,
}))
vi.mock('../../components/discover/LocationFilterDrawer', () => ({ default: () => null }))
vi.mock('../../components/discover/CityUnlockFeedCard', () => ({
  default: () => <div data-testid='city-unlock-feed-card'>更多城市</div>,
}))
vi.mock('../../components/discover/CityPickerSheet', () => ({ default: () => null }))
vi.mock('../../components/dev/SingleTestBanner', () => ({ default: () => null }))
vi.mock('../../components/alang/AlangDiscoverCard', () => ({ default: () => null }))
vi.mock('../../components/guidance/GuidanceTipCard', () => ({ default: () => null }))
vi.mock('../index/LandingPage', () => ({ default: () => <div>landing</div> }))

function setPools(
  pools: Array<Record<string, unknown>>,
  overrides: { isLoading?: boolean; isError?: boolean; isFetching?: boolean } = {},
) {
  mocks.pools.data = pools
  mocks.pools.isLoading = overrides.isLoading ?? false
  mocks.pools.isError = overrides.isError ?? false
  mocks.pools.isFetching = overrides.isFetching ?? false
}

describe('DiscoverPage editorial empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setPools([])
    mocks.savedLocation = null
    mocks.getStorageSync.mockImplementation((key: string) => (
      key === 'discover_last_location' ? mocks.savedLocation : null
    ))
  })

  it('renders an unfiltered editorial empty state without a CTA and keeps the city entry', () => {
    render(<DiscoverPage />)

    expect(screen.getByTestId('discover-empty-state')).toHaveAttribute('data-variant', 'editorial')
    expect(screen.getByTestId('discover-empty-state')).toHaveAttribute('data-emotion', 'events')
    expect(screen.getByText('当前没有可报名的活动')).toBeInTheDocument()
    expect(screen.getByText('活动上线后，会在这里展示。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument()
    expect(screen.getByTestId('city-unlock-feed-card')).toBeInTheDocument()
  })

  it('retains 清除筛选 only for filtered empty and returns to the unfiltered empty state', () => {
    mocks.savedLocation = JSON.stringify({
      clusterId: 'nanshan',
      districtId: '__all__',
      timestamp: Date.now(),
    })
    render(<DiscoverPage />)

    expect(screen.getByText('当前筛选下，还没有活动')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(mocks.removeStorageSync).toHaveBeenCalledWith('discover_last_location')
    expect(screen.getByText('当前没有可报名的活动')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument()
    expect(screen.getByTestId('city-unlock-feed-card')).toBeInTheDocument()
  })

  it('keeps non-empty pool content and the city entry without mounting the empty state', () => {
    setPools([{ id: 'pool-1', title: '周五饭局', status: 'open', district: '南山区' }])
    render(<DiscoverPage />)

    expect(screen.getByTestId('pool-card-pool-1')).toHaveTextContent('周五饭局')
    expect(screen.queryByTestId('discover-empty-state')).not.toBeInTheDocument()
    expect(screen.getByTestId('city-unlock-feed-card')).toBeInTheDocument()
  })

  it('keeps loading and error branches unchanged and preserves retry wiring', () => {
    setPools([], { isLoading: true })
    const view = render(<DiscoverPage />)
    expect(view.container.querySelectorAll('.oracle-card--skeleton')).toHaveLength(3)
    expect(screen.queryByTestId('discover-empty-state')).not.toBeInTheDocument()

    setPools([], { isError: true })
    view.rerender(<DiscoverPage />)
    expect(screen.getByTestId('discover-status-card')).toHaveTextContent('获取列表遇到小状况')
    expect(screen.queryByTestId('discover-empty-state')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'event-pools'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'my-pool-registrations'] })
    expect(mocks.evictPersistedQuery).toHaveBeenCalledWith(['mini-program', 'event-pools'])
  })
})
