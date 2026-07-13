import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangConfigPage from './index'

const mocks = vi.hoisted(() => ({
  navigateBack: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useAlangGpsOnce: vi.fn(),
  requestLocation: vi.fn(),
  reverseGeocode: vi.fn(),
  suggestGeoPlaces: vi.fn(),
  searchNearbyGeoPlaces: vi.fn(),
  getWalkingRoute: vi.fn(),
  callReportProgress: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateBack: mocks.navigateBack,
    showToast: vi.fn(),
    setStorageSync: vi.fn(),
    redirectTo: vi.fn(),
  }
  return { default: taro }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Map: (props: any) => <div data-testid='map' {...props} />,
  Button: ({ children, loading: _loading, ...props }: any) => <button {...props}>{children}</button>,
  Input: (props: any) => <input {...props} />,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
}))

vi.mock('../../../lib/alang/useAlangGps', () => ({
  useAlangGpsOnce: mocks.useAlangGpsOnce,
}))

vi.mock('../../../lib/alang/api', () => ({
  haversine: vi.fn(() => 0),
  callReportProgress: mocks.callReportProgress,
}))

vi.mock('@shared/api', () => ({
  reverseGeocode: mocks.reverseGeocode,
  suggestGeoPlaces: mocks.suggestGeoPlaces,
  searchNearbyGeoPlaces: mocks.searchNearbyGeoPlaces,
  getWalkingRoute: mocks.getWalkingRoute,
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title, description, action }: any) => (
    <section data-testid='permission-gate'>
      <h1>{title}</h1>
      <p>{description}</p>
      <button onClick={action?.onClick}>{action?.label}</button>
    </section>
  ),
}))

describe('AlangConfigPage production access gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({
      user: {
        appMode: 'production',
        features: { alangEnabled: true },
      },
      isLoading: false,
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      // A stale query cache must not leak its internal locations through the gate.
      data: {
        content: {
          meta: {
            defaultTargetLocation: { latitude: 22.5431, longitude: 114.0579 },
            defaultCompanionEndLocation: { latitude: 22.5444, longitude: 114.0579 },
          },
          nodes: [],
        },
      },
    })
    mocks.useAlangGpsOnce.mockReturnValue({
      position: null,
      loading: false,
      error: null,
      request: mocks.requestLocation,
    })
  })

  it('renders only the test-permission gate and disables mission loading', () => {
    const { container, getByTestId, queryByTestId } = render(<AlangConfigPage />)

    expect(getByTestId('permission-gate')).toBeInTheDocument()
    expect(container.querySelector('.alang-config__gate')).toBeInTheDocument()
    expect(container.querySelector('.alang-config')).not.toBeInTheDocument()
    expect(queryByTestId('map')).not.toBeInTheDocument()
    expect(mocks.useAlangMissionDetail).toHaveBeenCalledWith('meet-alang', false)
  })

  it('does not request location, POIs, routes, or expose cached coordinates', () => {
    const { container } = render(<AlangConfigPage />)

    expect(container.textContent).not.toContain('22.5431')
    expect(container.textContent).not.toContain('114.0579')
    expect(mocks.requestLocation).not.toHaveBeenCalled()
    expect(mocks.reverseGeocode).not.toHaveBeenCalled()
    expect(mocks.suggestGeoPlaces).not.toHaveBeenCalled()
    expect(mocks.searchNearbyGeoPlaces).not.toHaveBeenCalled()
    expect(mocks.getWalkingRoute).not.toHaveBeenCalled()
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
  })
})
