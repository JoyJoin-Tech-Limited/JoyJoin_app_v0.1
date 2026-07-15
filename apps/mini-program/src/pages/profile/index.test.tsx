import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  queryStates: new Map<string, Record<string, unknown>>(),
  enabledByKey: new Map<string, boolean>(),
  storyState: {} as Record<string, unknown>,
  storyEnabled: false,
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    navigateTo: state.navigateTo,
    switchTab: state.switchTab,
    showActionSheet: vi.fn(),
    showToast: vi.fn(),
    reLaunch: vi.fn(),
  },
  useDidShow: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: ({ onError: _onError, lazyLoad: _lazyLoad, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: React.HTMLAttributes<HTMLDivElement> & { scrollY?: boolean; enhanced?: boolean; showScrollbar?: boolean }) => <div {...props}>{children}</div>,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: string[]; enabled?: boolean }) => {
    const key = options.queryKey.join('/')
    state.enabledByKey.set(key, options.enabled !== false)
    return {
      data: undefined,
      isLoading: false,
      isError: false,
      ...state.queryStates.get(key),
    }
  },
}))

vi.mock('../../hooks/navigation/useMiniPageGate', () => ({
  useMiniPageGate: () => ({
    authLoading: false,
    authUser: state.user,
    renderGate: (node: React.ReactNode) => node,
  }),
}))

vi.mock('../../hooks/navigation/useCustomTabBarSync', () => ({
  useCustomTabBarSync: vi.fn(),
}))

vi.mock('../../lib/alang/useAlangMission', () => ({
  useStoryArchives: (enabled: boolean) => {
    state.storyEnabled = enabled
    return { data: [], isLoading: false, isError: false, ...state.storyState }
  },
}))

vi.mock('../../lib/alang/alangAccess', () => ({
  shouldShowAlangEntry: () => true,
}))

vi.mock('../../lib/alang/alangAssets', () => ({
  useAlangAssetSource: () => ({ src: '/story.webp', onError: vi.fn(), usingFallback: true }),
}))

vi.mock('../../lib/api/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}))

vi.mock('../../components/mascot/ArchetypeHead', () => ({
  default: () => <div data-testid='archetype-head' />,
}))

vi.mock('../../components/ui/JoyJoinIcon', () => ({
  default: () => <span data-testid='joyjoin-icon' />,
}))

vi.mock('../../components/ui/Card', () => ({
  default: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('../../components/ui/Button', () => ({
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('../../lib/utils/archetypeAssets', () => ({
  ARCHETYPE_ASSET_MAP: {},
}))

vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../lib/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn() }))
vi.mock('../../lib/payment/paymentEntry', () => ({ openMiniProgramPaymentPage: vi.fn() }))
vi.mock('../../lib/api/authSession', () => ({
  clearMiniProgramAuthSession: vi.fn(),
  getApiErrorStatusCode: vi.fn(),
  isUnauthorizedApiError: vi.fn(() => false),
}))

import ProfilePage from './index'

function makeUser(profileRedesignEnabled: boolean) {
  return {
    id: 'profile-user',
    nickname: '小悦',
    displayName: '小悦',
    archetype: 'corgi',
    primaryArchetype: 'corgi',
    nextStep: 'discover',
    experiencePoints: 0,
    profileEssentialComplete: false,
    profileExtendedComplete: false,
    features: { profileRedesignEnabled, alangEnabled: true },
  }
}

describe('Profile approved V4 layout', () => {
  beforeEach(() => {
    state.user = makeUser(true)
    state.queryStates.clear()
    state.enabledByKey.clear()
    state.storyState = { data: [] }
    state.storyEnabled = false
    state.navigateTo.mockReset()
    state.switchTab.mockReset()
  })

  it('shows the complete V4 structure when the flag is true and every count is zero', () => {
    state.queryStates.set('mini-program/shell/profile', {
      data: { stats: { eventsJoined: 0, connectionsCount: 0 } },
    })

    const { getByTestId, getByText } = render(<ProfilePage />)

    expect(getByTestId('profile-v4')).toBeTruthy()
    expect(getByText('0 段故事收藏 · 第一章还在等你出发')).toBeTruthy()
    expect(getByText('当前装备')).toBeTruthy()
    expect(getByText('0 件')).toBeTruthy()
    expect(getByText('更多服务')).toBeTruthy()
  })

  it('keeps V4 visible when one optional request fails', () => {
    state.queryStates.set('mini-program/gamification', { isError: true })
    state.storyState = { isError: true }

    const { getByTestId, getByText, queryByText } = render(<ProfilePage />)

    expect(getByTestId('profile-v4')).toBeTruthy()
    expect(getByText('成长记录稍后会自动刷新')).toBeTruthy()
    expect(getByText('局部加载失败 · 点按仍可进入')).toBeTruthy()
    expect(queryByText('个人资料简洁模式')).toBeNull()
  })

  it('uses compact mode only for an explicit false and stops V4-only requests', () => {
    state.user = makeUser(false)

    const { queryByTestId, getByLabelText } = render(<ProfilePage />)

    expect(queryByTestId('profile-v4')).toBeNull()
    expect(getByLabelText('个人资料简洁模式')).toBeTruthy()
    expect(state.enabledByKey.get('mini-program/gamification')).toBe(false)
    expect(state.storyEnabled).toBe(false)
  })

  it('keeps partner/story entries actionable and services after growth assets', () => {
    const { getByTestId } = render(<ProfilePage />)
    const partnerEntry = getByTestId('profile-partner-equipment-entry')
    const storyEntry = getByTestId('profile-story-entry')
    const growthArchive = getByTestId('profile-growth-archive')
    const services = getByTestId('profile-more-services')

    fireEvent.click(partnerEntry)
    fireEvent.click(storyEntry)

    expect(state.navigateTo).toHaveBeenCalledTimes(2)
    expect(growthArchive.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('places settings in the top navigation, outside the partner card', () => {
    const { getByTestId } = render(<ProfilePage />)
    const settings = getByTestId('profile-top-settings')
    const hero = getByTestId('profile-v4')

    expect(getByTestId('profile-top-navigation').contains(settings)).toBe(true)
    expect(hero.contains(settings)).toBe(false)
  })
})
