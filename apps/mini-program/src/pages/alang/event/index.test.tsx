import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashHomePage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useFlashHome: vi.fn(),
  useFlashStoryFragments: vi.fn(),
  permission: vi.fn(),
  location: vi.fn(),
  navigateTo: vi.fn(),
  refetch: vi.fn(),
  didShow: undefined as (() => void) | undefined,
  didHide: undefined as (() => void) | undefined,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    setNavigationBarTitle: vi.fn(),
    navigateTo: mocks.navigateTo,
    redirectTo: vi.fn(),
    openSetting: vi.fn(),
    showToast: vi.fn(),
  },
  useDidShow: vi.fn((callback: () => void) => { mocks.didShow = callback }),
  useDidHide: vi.fn((callback: () => void) => { mocks.didHide = callback }),
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/flashApi', () => ({
  getFlashLocationPermission: mocks.permission,
  getOneShotFlashLocation: mocks.location,
}))
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashHome: mocks.useFlashHome,
  useFlashStoryFragments: mocks.useFlashStoryFragments,
}))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: vi.fn() }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const home = {
  serverNow: '2026-07-20T12:00:00+08:00',
  onlineNpcs: [{
    id: 'npc-1', slug: 'alang', name: '阿浪', animal: '灰狼', appearanceId: 'appearance-1',
    invitation: '我有点好奇那边是什么样。', districtName: '南山区', remainingSeconds: 3600,
  }],
  myTasks: [],
  preferenceSummary: { personalizationEnabled: true },
}

describe('formal Flash home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.permission.mockResolvedValue('granted')
    mocks.location.mockResolvedValue({ latitude: 22.54, longitude: 114.05, accuracy: 12 })
    mocks.useFlashHome.mockReturnValue({ data: home, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.useFlashStoryFragments.mockReturnValue({ data: [{
      id: 'fragment-1', code: 'fragment-1', category: 'object', title: '双人座位图',
      fact: '图上记录的是两个人之间合适的距离。', unlockedAt: '2026-08-07T00:00:00Z',
      episodeTitle: '一张画了两把椅子的图', npcName: '阿浪', assetUrl: null,
    }] })
    mocks.didShow = undefined
    mocks.didHide = undefined
  })

  it('renders the intro before any location request', async () => {
    render(<FlashHomePage />)

    expect(await screen.findByText('今天，会碰见谁呢？')).toBeInTheDocument()
    expect(screen.getByText('看看谁在附近')).toBeInTheDocument()
    expect(screen.getByText('先读取当前位置；选中角色后，地图会在前台持续更新位置，离开页面立即停止。')).toBeInTheDocument()
    expect(document.querySelector("img[src*='street-blind-box-onboarding-fullscreen-v7.jpg']")).toBeTruthy()
    expect(mocks.location).not.toHaveBeenCalled()
  })

  it('recovers with a retry action when WeChat location never responds', async () => {
    vi.useFakeTimers()
    mocks.location.mockImplementation(() => new Promise(() => undefined))

    try {
      render(<FlashHomePage />)
      fireEvent.click(screen.getByText('看看谁在附近'))
      await act(async () => { await Promise.resolve() })

      expect(screen.getByText('看看深圳哪里有角色在线…')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(12_000) })
      expect(screen.getByText('这次没有拿到位置')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '重新定位' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the permission action when native location reports user denial', async () => {
    mocks.location.mockRejectedValue({ errMsg: 'getLocation:fail auth deny' })
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByText('看看谁在附近'))

    expect(await screen.findByText('需要定位，才能参加闪现')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开定位设置' })).toBeInTheDocument()
  })

  it('loads online NPCs and story fragments only after the user accepts the disclosure', async () => {
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByText('看看谁在附近'))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()
    expect(screen.getByText('南山区 · 还在 1 小时')).toBeInTheDocument()
    expect(screen.getByText('双人座位图')).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(
      { latitude: 22.54, longitude: 114.05, accuracy: 12 },
      true,
    ))
    expect(document.querySelector("img[src*='flash-city-ambient-bg.png']")).toBeTruthy()
  })

  it('discards the location when the page is hidden and asks again on return', async () => {
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByRole('button'))
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))

    act(() => {
      mocks.didHide?.()
      mocks.didShow?.()
    })

    expect(await screen.findByRole('button', { name: '看看谁在附近' })).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(null, false))
  })

  it('uses branded empty-state art without requesting extra data', async () => {
    mocks.useFlashStoryFragments.mockReturnValue({ data: [] })
    mocks.useFlashHome.mockReturnValue({
      data: { ...home, onlineNpcs: [], myTasks: [] },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByText('看看谁在附近'))
    expect(await screen.findByText('这会儿没有谁出来晃荡')).toBeInTheDocument()
    expect(document.querySelector("img[src*='flash-empty-online.png']")).toBeTruthy()
    expect(screen.getByText('故事还没有翻开')).toBeInTheDocument()
  })

  it('opens the map with safe display metadata but no coordinates in the URL', async () => {
    render(<FlashHomePage />)
    fireEvent.click(await screen.findByText('看看谁在附近'))
    fireEvent.click(await screen.findByRole('button', { name: /去找阿浪/ }))

    const url = mocks.navigateTo.mock.calls[0][0].url as string
    expect(url).toContain('appearanceId=appearance-1')
    expect(url).toContain('npcName=%E9%98%BF%E6%B5%AA')
    expect(url).not.toContain('22.54')
    expect(url).not.toContain('114.05')
  })

  it('fails closed when the server feature flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashHomePage />)
    expect(screen.getByText('闪现正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.location).not.toHaveBeenCalled()
  })
})
