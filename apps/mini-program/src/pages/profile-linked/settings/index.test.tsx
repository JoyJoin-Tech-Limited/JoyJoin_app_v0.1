import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES,
  MINI_PROGRAM_ROUTES,
} from '../../../lib/onboarding/onboardingRoutes'
import ProfileSettingsPage from './index'

const mocks = vi.hoisted(() => ({
  getUserCoupons: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  reLaunch: vi.fn(),
  apiRequest: vi.fn(),
  clearAuthSession: vi.fn(),
  openPayment: vi.fn(),
  haptics: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('@shared/api', () => ({
  getUserCoupons: mocks.getUserCoupons,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    navigateTo: mocks.navigateTo,
    switchTab: mocks.switchTab,
    showModal: mocks.showModal,
    showToast: mocks.showToast,
    reLaunch: mocks.reLaunch,
  },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, hoverStayTime: _hoverStayTime, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, loading, disabled, ...props }: any) => (
    <button {...props} disabled={disabled || loading}>{loading ? '正在处理' : children}</button>
  ),
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
}))

vi.mock('../../../hooks/navigation/useMiniPageGate', () => ({
  useMiniPageGate: () => ({
    authLoading: false,
    authUser: { id: 'current-user' },
    renderGate: (content: ReactNode) => content,
  }),
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('../../../lib/api/authSession', () => ({
  clearMiniProgramAuthSession: mocks.clearAuthSession,
  getApiErrorStatusCode: () => 500,
  isUnauthorizedApiError: () => false,
}))

vi.mock('../../../lib/payment/paymentEntry', () => ({
  openMiniProgramPaymentPage: mocks.openPayment,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../../lib/utils/logger', () => ({
  logError: mocks.logError,
  logInfo: mocks.logInfo,
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<ProfileSettingsPage />, { wrapper: Wrapper })
}

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserCoupons.mockResolvedValue({ count: 2, availableCount: 1, coupons: [] })
    mocks.navigateTo.mockResolvedValue(undefined)
    mocks.switchTab.mockResolvedValue(undefined)
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.showToast.mockResolvedValue(undefined)
    mocks.reLaunch.mockResolvedValue(undefined)
    mocks.apiRequest.mockResolvedValue({ message: 'ok' })
    mocks.openPayment.mockResolvedValue(undefined)
  })

  it('is registered in the existing Profile-linked subpackage', () => {
    expect(MINI_PROGRAM_ROUTES.profileSettings).toBe('/pages/profile-linked/settings/index')
    expect(MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES).toContain('settings/index')
  })

  it('collects every former Profile service action on the new page', async () => {
    renderPage()

    expect(screen.getByText('设置与服务')).toBeInTheDocument()
    for (const label of ['编辑资料', '奖励福利', '邀请好友', '我的权益', '我的足迹', '服务条款', '退出登录']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(await screen.findByText('2 项')).toBeInTheDocument()
  })

  it('reuses the existing Profile destinations', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }))
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.editProfile }))

    fireEvent.click(screen.getByRole('button', { name: '奖励福利' }))
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.rewards }))

    fireEvent.click(screen.getByRole('button', { name: '邀请好友' }))
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.invite }))

    fireEvent.click(screen.getByRole('button', { name: '我的权益' }))
    await waitFor(() => expect(mocks.openPayment).toHaveBeenCalledWith({ currentUserId: 'current-user' }))

    fireEvent.click(screen.getByRole('button', { name: '我的足迹' }))
    await waitFor(() => expect(mocks.switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events }))

    fireEvent.click(screen.getByRole('button', { name: '服务条款' }))
    await waitFor(() => expect(mocks.navigateTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.terms }))
  })

  it('shows an explicit reward loading state', () => {
    mocks.getUserCoupons.mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByText('正在读取')).toBeInTheDocument()
  })

  it('shows navigation progress and recovers in place when opening fails', async () => {
    const navigation = createDeferred<void>()
    mocks.navigateTo.mockReturnValueOnce(navigation.promise)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }))
    expect(screen.getByRole('button', { name: '编辑资料，正在打开' })).toBeInTheDocument()
    expect(screen.getByText('正在打开…')).toBeInTheDocument()

    navigation.reject(new Error('navigation failed'))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith({
      title: '页面没有打开，请稍后再试',
      icon: 'none',
    }))
    expect(screen.getByText('更新昵称、介绍与个人信息')).toBeInTheDocument()
  })

  it('still unlocks the workflow when optional failure logging throws', async () => {
    mocks.navigateTo.mockRejectedValueOnce(new Error('navigation failed'))
    mocks.logError.mockImplementationOnce(() => {
      throw new Error('realtime logger unavailable')
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith({
      title: '页面没有打开，请稍后再试',
      icon: 'none',
    }))
    expect(screen.getByRole('button', { name: '编辑资料' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('does not log out when the confirmation is cancelled', async () => {
    mocks.showModal.mockResolvedValueOnce({ confirm: false, cancel: true })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    await waitFor(() => expect(mocks.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '退出登录',
      confirmText: '确认退出',
      cancelText: '再等等',
    })))
    expect(mocks.apiRequest).not.toHaveBeenCalled()
  })

  it('locks the button while logging out, clears the session, and relaunches login', async () => {
    const logout = createDeferred<{ message: string }>()
    mocks.apiRequest.mockReturnValueOnce(logout.promise)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(await screen.findByRole('button', { name: '正在退出登录' })).toBeDisabled()

    logout.resolve({ message: 'ok' })
    await waitFor(() => expect(mocks.clearAuthSession).toHaveBeenCalledWith({ mode: 'hard' }))
    expect(mocks.reLaunch).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.login })
  })
})
