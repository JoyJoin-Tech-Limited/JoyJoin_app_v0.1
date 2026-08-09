import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashHomePage from './index'

const mocks = vi.hoisted(() => ({
  useFlashHome: vi.fn(),
  useFlashStoryFragments: vi.fn(),
  updatePreferences: vi.fn(),
  navigateTo: vi.fn(),
  refetch: vi.fn(),
  getStorage: vi.fn(),
  setStorage: vi.fn(),
  didShow: undefined as (() => void) | undefined,
  didHide: undefined as (() => void) | undefined,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    setNavigationBarTitle: vi.fn(),
    navigateTo: mocks.navigateTo,
    redirectTo: vi.fn(),
    showToast: vi.fn(),
    getStorageSync: mocks.getStorage,
    setStorageSync: mocks.setStorage,
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
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashHome: mocks.useFlashHome,
  useFlashStoryFragments: mocks.useFlashStoryFragments,
  useUpdateFlashPreferences: () => ({
    mutateAsync: mocks.updatePreferences,
    isPending: false,
  }),
}))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: vi.fn() }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const home = {
  serverNow: '2026-08-09T12:00:00+08:00',
  canonicalScreen: 'home',
  onlineNpcs: [{
    id: 'npc-1', slug: 'alang', name: '阿浪', animal: '灰狼', appearanceId: 'appearance-1',
    invitation: '我有点好奇那边是什么样。', districtName: '南山区', remainingSeconds: 3600,
  }],
  myTasks: [],
  preferenceSummary: { personalizationEnabled: true },
}

describe('formal Street Blind Box home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorage.mockReturnValue(undefined)
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

  it('shows story-mode introduction before loading the location-free home', async () => {
    render(<FlashHomePage />)

    expect(await screen.findByText('这一次，故事想怎样认识你？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开启更专属的剧情' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '进入标准剧情' })).toBeInTheDocument()
    expect(mocks.useFlashHome).toHaveBeenLastCalledWith(false)
  })

  it('saves the selection, marks the introduction acknowledged, and loads home without GPS', async () => {
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()
    expect(mocks.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({
      personalizationEnabled: false,
    }))
    expect(mocks.setStorage).toHaveBeenCalledWith('jj_flash_intro_ack', 'flash-intro-v1')
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(true))
    expect((Taro as unknown as { getLocation?: unknown }).getLocation).toBeUndefined()
  })

  it('skips the introduction on later opens', async () => {
    mocks.getStorage.mockReturnValue('flash-intro-v1')
    render(<FlashHomePage />)

    expect(await screen.findByText('阿浪')).toBeInTheDocument()
    expect(screen.queryByText('这一次，故事想怎样认识你？')).not.toBeInTheDocument()
    expect(mocks.updatePreferences).not.toHaveBeenCalled()
  })

  it('keeps story personalization reopenable from the home settings entry', async () => {
    mocks.getStorage.mockReturnValue('flash-intro-v1')
    render(<FlashHomePage />)

    const settingsEntry = await screen.findByRole('button', {
      name: '打开剧情偏好，当前已开启专属剧情',
    })
    expect(screen.getByText('专属剧情已开启')).toBeInTheDocument()

    fireEvent.click(settingsEntry)
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/preferences/index',
    }))
  })

  it('shows a recovery message when story preferences cannot open', async () => {
    mocks.getStorage.mockReturnValue('flash-intro-v1')
    mocks.navigateTo.mockRejectedValueOnce(new Error('subpackage unavailable'))
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByTestId('flash-story-preferences-entry'))
    await waitFor(() => expect(Taro.showToast).toHaveBeenCalledWith({
      title: '暂时打不开，请稍后再试',
      icon: 'none',
    }))
  })

  it('does not re-show the introduction after backgrounding in the same visit', async () => {
    render(<FlashHomePage />)
    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()

    act(() => {
      mocks.didHide?.()
      mocks.didShow?.()
    })

    expect(screen.queryByText('这一次，故事想怎样认识你？')).not.toBeInTheDocument()
  })

  it('keeps the introduction available when preference saving fails', async () => {
    mocks.updatePreferences.mockRejectedValueOnce(new Error('network unavailable'))
    render(<FlashHomePage />)

    fireEvent.click(await screen.findByRole('button', { name: '进入标准剧情' }))
    await waitFor(() => expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' })))
    expect(mocks.setStorage).not.toHaveBeenCalled()
    expect(screen.getByText('这一次，故事想怎样认识你？')).toBeInTheDocument()
  })

  it('preserves manual-hold labels and forwards the mode to the map', async () => {
    mocks.getStorage.mockReturnValue('flash-intro-v1')
    mocks.useFlashHome.mockReturnValue({
      data: {
        ...home,
        onlineNpcs: [{ ...home.onlineNpcs[0], remainingSeconds: undefined, availabilityMode: 'manual_hold' }],
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashHomePage />)

    expect(await screen.findByText('南山区 · 测试期间在线')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /去找阿浪/ }))
    expect(mocks.navigateTo.mock.calls[0][0].url).toContain('availabilityMode=manual_hold')
  })

  it('uses dedicated paper-story backgrounds for the first introduction', async () => {
    render(<FlashHomePage />)

    await screen.findByText('YOUR PARALLEL UNIVERSE')
    const modeCards = document.querySelectorAll('.flash-intro__mode')
    expect(modeCards[0]).toContainElement(document.querySelector("img[src*='parallel-personalized-paper-world-v1.jpg']"))
    expect(modeCards[1]).toContainElement(document.querySelector("img[src*='parallel-standard-paper-world-v1.jpg']"))
  })

  it('opens the map with display metadata but no coordinates in the URL', async () => {
    mocks.getStorage.mockReturnValue('flash-intro-v1')
    render(<FlashHomePage />)
    fireEvent.click(await screen.findByRole('button', { name: /去找阿浪/ }))

    const url = mocks.navigateTo.mock.calls[0][0].url as string
    expect(url).toContain('appearanceId=appearance-1')
    expect(url).not.toContain('22.54')
    expect(url).not.toContain('114.05')
  })
})
