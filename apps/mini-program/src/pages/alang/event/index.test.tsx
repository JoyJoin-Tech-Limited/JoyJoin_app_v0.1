import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashHomePage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useFlashHome: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  permission: vi.fn(),
  location: vi.fn(),
  navigateTo: vi.fn(),
  refetch: vi.fn(),
  didShow: undefined as (() => void) | undefined,
  didHide: undefined as (() => void) | undefined,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: mocks.getStorageSync,
    setStorageSync: mocks.setStorageSync,
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
  getFlashApiErrorCode: (error: { code?: string } | undefined) => error?.code,
  getFlashLocationPermission: mocks.permission,
  getOneShotFlashLocation: mocks.location,
}))
vi.mock('../../../lib/alang/useFlash', () => ({ useFlashHome: mocks.useFlashHome }))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: vi.fn() }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const home = {
  serverNow: '2026-07-20T12:00:00+08:00',
  onlineNpcs: [{
    id: 'npc-1', slug: 'alang', name: '阿浪', animal: '灰狼', appearanceId: 'appearance-1',
    invitation: '我有点好奇那边是什么样。', districtName: '南山区', remainingSeconds: 3600,
  }],
  myTasks: [{
    id: 'assignment-1', assignmentId: 'assignment-1', npc: { id: 'npc-2', slug: 'momo', name: '默默' },
    title: '找一个安静角落', category: '独处放松', status: 'accepted',
  }],
  preferenceSummary: { personalizationEnabled: true },
}

async function acceptFlashIntro() {
  fireEvent.click(await screen.findByText('开启一次定位'))
}

describe('formal Flash home', () => {
  it('keeps API error-code locals outside the async page component scope', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/pages/alang/event/index.tsx'), 'utf8')
    const pageComponent = source.slice(source.indexOf('export default function FlashHomePage'))

    expect(pageComponent).not.toContain('getFlashApiErrorCode(')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.didShow = undefined
    mocks.didHide = undefined
    mocks.permission.mockResolvedValue('granted')
    mocks.location.mockResolvedValue({ latitude: 22.54, longitude: 114.05, accuracy: 12 })
    mocks.useFlashHome.mockReturnValue({ data: home, isLoading: false, isError: false, refetch: mocks.refetch })
  })

  it('renders the intro before any location request', async () => {
    render(<FlashHomePage />)
    expect(mocks.location).not.toHaveBeenCalled()
    act(() => { mocks.didShow?.() })

    expect(await screen.findByText('今天，会碰见谁呢？')).toBeInTheDocument()
    expect(screen.getByText('开启一次定位')).toBeInTheDocument()
    expect(screen.getByText('只读取这一次位置，不会后台追踪。')).toBeInTheDocument()
    expect(mocks.location).not.toHaveBeenCalled()
  })

  it('loads online NPCs and tasks only after one-shot location is available', async () => {
    render(<FlashHomePage />)
    expect(mocks.location).not.toHaveBeenCalled()
    act(() => { mocks.didShow?.() })
    await acceptFlashIntro()

    expect(await screen.findByText('阿浪')).toBeInTheDocument()
    expect(Array.from(document.querySelectorAll('img')).some((image) =>
      image.getAttribute('src')?.endsWith('/pages/alang/assets/ui/flash-city-ambient-bg.png'),
    )).toBe(true)
    expect(screen.getByText('南山区 · 还在 1 小时')).toBeInTheDocument()
    expect(screen.getByText('找一个安静角落')).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(1)
    expect(mocks.permission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(
      { latitude: 22.54, longitude: 114.05, accuracy: 12 },
      true,
    ))
  })

  it('discards the one-shot location on hide and asks again on return', async () => {
    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    await acceptFlashIntro()
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))

    act(() => {
      mocks.didHide?.()
      mocks.didShow?.()
    })

    expect(await screen.findByText('今天，会碰见谁呢？')).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.useFlashHome).toHaveBeenLastCalledWith(null, false))
  })

  it('opens the radar with safe display metadata but no coordinates', async () => {
    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    await acceptFlashIntro()
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
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.location).not.toHaveBeenCalled()
  })

  it('starts from the active page lifecycle when auth resolves after the first show', async () => {
    mocks.useAuth.mockReturnValue({ user: undefined })
    const view = render(<FlashHomePage />)

    act(() => { mocks.didShow?.() })
    expect(mocks.location).not.toHaveBeenCalled()

    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    view.rerender(<FlashHomePage />)

    await acceptFlashIntro()
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()
  })

  it('starts from the mounted page when the native didShow callback is missed', async () => {
    render(<FlashHomePage />)

    await acceptFlashIntro()
    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('阿浪')).toBeInTheDocument()
  })

  it('shows a retryable Shenzhen verification state when the server cannot verify location', async () => {
    mocks.useFlashHome.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { code: 'FLASH_LOCATION_UNAVAILABLE' },
      refetch: mocks.refetch,
    })

    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    await acceptFlashIntro()

    expect(await screen.findByText('暂时无法确认你是否在深圳')).toBeInTheDocument()
    expect(screen.getByText(/可以稍后再试/)).toBeInTheDocument()
    expect(screen.queryByText('街头盲盒暂时没打开')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新读取' }))
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows a retry action when one-shot location fails', async () => {
    mocks.location.mockRejectedValueOnce(new Error('getLocation:fail timeout'))

    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    await acceptFlashIntro()

    expect(await screen.findByText('这次没有拿到位置')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新定位' }))

    await waitFor(() => expect(mocks.location).toHaveBeenCalledTimes(2))
    expect(mocks.permission).toHaveBeenCalledTimes(2)
  })

  it('recovers from a suspended checking state after the page is hidden and shown', async () => {
    mocks.location.mockReturnValue(new Promise(() => undefined))

    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    fireEvent.click(screen.getByText('开启一次定位'))
    expect(screen.getByText('看看深圳哪里有角色在线…')).toBeInTheDocument()
    expect(document.querySelector('.flash-location-compiler-scope-v4')).toBeTruthy()
    const locationCallsBeforeHide = mocks.location.mock.calls.length

    act(() => {
      mocks.didHide?.()
      mocks.didShow?.()
    })

    expect(await screen.findByText('今天，会碰见谁呢？')).toBeInTheDocument()
    expect(mocks.location).toHaveBeenCalledTimes(locationCallsBeforeHide)
  })

  it('leaves locating even when the page stays visible and the device API never settles', async () => {
    vi.useFakeTimers()
    mocks.location.mockReturnValue(new Promise(() => undefined))

    render(<FlashHomePage />)
    act(() => { mocks.didShow?.() })
    fireEvent.click(screen.getByText('开启一次定位'))
    expect(screen.getByText('看看深圳哪里有角色在线…')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(12_000)

    expect(screen.getByText('这次没有拿到位置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新定位' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
