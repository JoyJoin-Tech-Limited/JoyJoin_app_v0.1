import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashHomePage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useFlashHome: vi.fn(),
  useFlashStoryFragments: vi.fn(),
  updatePreferences: vi.fn(),
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
    getLocation: vi.fn((options: { success: (value: unknown) => void; fail: (error: unknown) => void }) => {
      void mocks.location().then(options.success, options.fail)
    }),
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
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashHome: mocks.useFlashHome,
  useFlashStoryFragments: mocks.useFlashStoryFragments,
}))
vi.mock('../../../lib/api/api', () => ({
  apiRequest: mocks.updatePreferences,
}))
vi.mock('../../../lib/alang/flashApi', () => ({
  updateFlashPreferences: undefined,
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
    mocks.location.mockResolvedValue({ latitude: 22.54, longitude: 114.05, accuracy: 12 })
    mocks.updatePreferences.mockResolvedValue({})
    mocks.useFlashHome.mockReturnValue({ data: home, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.useFlashStoryFragments.mockReturnValue({ data: [{
      id: 'fragment-1', code: 'fragment-1', category: 'object', title: '双人座位图',
      fact: '图上记录的是两个人之间合适的距离。', unlockedAt: '2026-08-07T00:00:00Z',
      episodeTitle: '一张画了两把椅子的图', npcName: '阿浪', assetUrl: null,
    }] })
    mocks.didShow = undefined
    mocks.didHide = undefined
  })

  it('renders two equal story modes before any location request', async () => {
    render(<FlashHomePage />)

    expect(await screen.findByText('这一次，故事想怎样认识你？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开启更专属的剧情' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入标准剧情' })).toBeInTheDocument()
    expect(document.querySelectorAll('.flash-intro__mode')).toHaveLength(2)
    expect(mocks.location).not.toHaveBeenCalled()
  })

  it('recovers with a retry action when WeChat location never responds', async () => {
    vi.useFakeTimers()
    mocks.location.mockImplementation(() => new Promise(() => undefined))

    try {
      render(<FlashHomePage />)
      fireEvent.click(screen.getByRole('button', { name: '进入标准剧情' }))
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

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))

    expect(await screen.findByText('需要定位，才能参加闪现')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开定位设置' })).toBeInTheDocument()
  })

  it('recovers instead of throwing when the native location API is unavailable', async () => {
    const originalGetLocation = Taro.getLocation
    ;(Taro as unknown as { getLocation?: unknown }).getLocation = undefined

    try {
      render(<FlashHomePage />)
      fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))

      expect(await screen.findByText('这次没有拿到位置')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '重新定位' })).toBeInTheDocument()
    } finally {
      ;(Taro as unknown as { getLocation: typeof originalGetLocation }).getLocation = originalGetLocation
    }
  })

  it('loads online NPCs and story fragments only after the user accepts the disclosure', async () => {
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()
    expect(screen.getByText('南山区 · 还在 1 小时')).toBeInTheDocument()
    expect(screen.getByText('双人座位图')).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(1)
    expect(mocks.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/alang/flash/preferences',
      method: 'PUT',
      data: expect.objectContaining({ personalizationEnabled: false }),
    }))
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(
      { latitude: 22.54, longitude: 114.05, accuracy: 12 },
      true,
    ))
    expect(document.querySelector("img[src*='flash-city-ambient-bg.png']")).toBeTruthy()
  })

  it('uses two dedicated paper-story backgrounds instead of reusing the street scene', async () => {
    render(<FlashHomePage />)

    await screen.findByText('YOUR PARALLEL UNIVERSE')
    const modeCards = document.querySelectorAll('.flash-intro__mode')
    expect(modeCards[0]).toContainElement(document.querySelector("img[src*='parallel-personalized-paper-world-v1.jpg']"))
    expect(modeCards[1]).toContainElement(document.querySelector("img[src*='parallel-standard-paper-world-v1.jpg']"))
    expect(document.querySelector("img[src$='.webp']")).toBeNull()
    expect(document.querySelector("img[src*='street-blind-box-onboarding-fullscreen-v7.jpg']")).toBeNull()
  })

  it('does not depend on a cross-chunk preference wrapper when selecting a story mode', async () => {
    render(<FlashHomePage />)

    await screen.findByText('YOUR PARALLEL UNIVERSE')
    fireEvent.click(document.querySelectorAll('.flash-intro__mode')[1])

    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))
  })

  it('stays on mode selection and allows retry when preference saving fails', async () => {
    mocks.updatePreferences.mockRejectedValueOnce(new Error('network unavailable'))
    render(<FlashHomePage />)

    await screen.findByText('YOUR PARALLEL UNIVERSE')
    const standardMode = document.querySelectorAll('.flash-intro__mode')[1]
    fireEvent.click(standardMode)

    await waitFor(() => expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' })))
    expect(mocks.location).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.flash-intro__mode')).toHaveLength(2)

    mocks.updatePreferences.mockResolvedValueOnce({})
    fireEvent.click(standardMode)

    await waitFor(() => expect(mocks.updatePreferences).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))
  })

  it('discards the location when the page is hidden and asks again on return', async () => {
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))

    act(() => {
      mocks.didHide?.()
      mocks.didShow?.()
    })

    expect(await screen.findByRole('button', { name: '进入标准剧情' })).toBeInTheDocument()
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

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    expect(await screen.findByText('这会儿没有谁出来晃荡')).toBeInTheDocument()
    expect(document.querySelector("img[src*='flash-empty-online.png']")).toBeTruthy()
    expect(screen.getByText('故事还没有翻开')).toBeInTheDocument()
  })

  it('opens the map with safe display metadata but no coordinates in the URL', async () => {
    render(<FlashHomePage />)
    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    fireEvent.click(await screen.findByRole('button', { name: /去找阿浪/ }))

    const url = mocks.navigateTo.mock.calls[0][0].url as string
    expect(url).toContain('appearanceId=appearance-1')
    expect(url).toContain('npcName=%E9%98%BF%E6%B5%AA')
    expect(url).not.toContain('22.54')
    expect(url).not.toContain('114.05')
  })

  it('offers the formal story modes when the legacy Alang flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashHomePage />)
    expect(screen.getByText('更专属的剧情')).toBeInTheDocument()
    expect(screen.getByText('标准剧情')).toBeInTheDocument()
    expect(mocks.location).not.toHaveBeenCalled()
  })
})
