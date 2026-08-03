import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import ProfilePage from './index'

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  queryStates: new Map<string, Record<string, unknown>>(),
  enabledByKey: new Map<string, boolean>(),
  storyState: {} as Record<string, unknown>,
  storyEnabled: false,
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  showToast: vi.fn(),
  equipmentRefetch: vi.fn(),
  systemInfo: {} as Record<string, unknown>,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    navigateTo: state.navigateTo,
    switchTab: state.switchTab,
    showActionSheet: vi.fn(),
    showToast: state.showToast,
    reLaunch: vi.fn(),
    getSystemInfoSync: () => state.systemInfo,
  },
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
}))

vi.mock('../../lib/analytics/profileAnalytics', () => ({
  profileAnalytics: { track: vi.fn() },
}))

vi.mock('../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => true,
}))

vi.mock('../../lib/utils/frameBudget', () => ({
  getDegradationTier: () => Promise.resolve('minimal'),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img {...props} />,
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
      refetch: state.equipmentRefetch,
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
    features: {
      profileRedesignEnabled,
      alangEnabled: true,
      profilePixelAvatarEnabled: true,
      equipmentRewardsEnabled: true,
      personalStoryEnabled: true,
    },
  }
}

describe('Profile approved V4 layout', () => {
  beforeEach(() => {
    state.user = makeUser(true)
    state.queryStates.clear()
    state.enabledByKey.clear()
    state.storyState = { data: [] }
    state.storyEnabled = false
    state.systemInfo = {}
    state.queryStates.set('mini-program/equipment/me', {
      data: {
        archetypeId: 'corgi',
        outfit: {
          topItemId: 'top-1',
          bottomItemId: 'bottom-1',
          shoesItemId: 'shoes-1',
          accessoryItemId: 'accessory-1',
          version: 1,
        },
        inventory: [
          ['top-1', 'top', '像素夹克'],
          ['bottom-1', 'bottom', '像素长裤'],
          ['shoes-1', 'shoes', '像素球鞋'],
          ['accessory-1', 'accessory', '像素徽章'],
        ].map(([id, slot, name]) => ({
          id: `inventory-${id}`,
          itemId: id,
          acquiredAt: '2026-07-15T00:00:00.000Z',
          sourceType: 'initial',
          item: {
            id,
            slug: id,
            slot,
            name,
            rarity: 'common',
            assetKey: `equipment/starter/corgi/${slot}/v1`,
          },
        })),
        recentItems: [],
        wallet: { fragmentBalance: 0, pityMisses: 0, pityTarget: 4 },
        pendingEntitlements: [],
        rewardsEnabled: true,
      },
    })
    state.navigateTo.mockReset()
    state.switchTab.mockReset()
    state.showToast.mockReset()
    state.equipmentRefetch.mockReset()
  })

  it('shows the complete V4 structure when the flag is true and every count is zero', () => {
    state.queryStates.set('mini-program/shell/profile', {
      data: { stats: { eventsJoined: 0, connectionsCount: 0 } },
    })

    const { getByTestId, getByText, queryByText } = render(<ProfilePage />)

    expect(getByTestId('profile-v4')).toBeTruthy()
    expect(getByText('只根据你真实参加过的相遇，一章一章继续写下去。')).toBeTruthy()
    expect(getByText('当前装备')).toBeTruthy()
    expect(getByText('4 件')).toBeTruthy()
    expect(queryByText('更多服务')).toBeNull()
    expect(queryByText('退出登录')).toBeNull()
  })

  it('does not layer the code placeholder behind an available pixel character', () => {
    const { container } = render(<ProfilePage />)

    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    expect(container.querySelector('.pixel-avatar')).toBeNull()
  })

  it('shows the actual starter-equipment art in every filled slot', () => {
    const { container } = render(<ProfilePage />)
    const equipmentArt = Array.from(container.querySelectorAll<HTMLImageElement>('.profile-page__equipment-slot-art'))

    expect(equipmentArt).toHaveLength(4)
    equipmentArt.forEach((image) => {
      expect(image.src).toMatch(/thumb-v2\.[a-f0-9]{12}\.webp/)
    })
  })

  it('falls back to a product placeholder after slot art fails without showing a text glyph', async () => {
    const { container, rerender } = render(<ProfilePage />)
    const initialArt = Array.from(container.querySelectorAll<HTMLImageElement>('.profile-page__equipment-slot-art'))

    fireEvent.error(initialArt[0])

    expect(container.querySelectorAll('.profile-page__equipment-slot-art')).toHaveLength(4)
    expect(container.querySelectorAll('.profile-page__equipment-slot-art--placeholder')).toHaveLength(1)
    expect(container.querySelectorAll('.profile-page__equipment-slot-glyph')).toHaveLength(0)

    const cachedEquipment = state.queryStates.get('mini-program/equipment/me')
    const cachedData = cachedEquipment?.data as {
      inventory: Array<{
        item: { id: string; assetKey: string }
      }>
    }
    state.queryStates.set('mini-program/equipment/me', {
      ...cachedEquipment,
      data: {
        ...cachedData,
        inventory: cachedData.inventory.map((entry) => entry.item.id === 'top-1'
          ? {
            ...entry,
            item: {
              ...entry.item,
              assetKey: 'equipment/starter/corgi/bottom/v1',
            },
          }
          : entry),
      },
    })

    rerender(<ProfilePage />)

    await waitFor(() => {
      expect(container.querySelectorAll('.profile-page__equipment-slot-art')).toHaveLength(4)
      expect(container.querySelectorAll('.profile-page__equipment-slot-art--placeholder')).toHaveLength(0)
      expect(container.querySelectorAll('.profile-page__equipment-slot-glyph')).toHaveLength(0)
    })
  })

  it('shows a recovery state instead of an undressed avatar when the outfit payload is missing', () => {
    state.queryStates.set('mini-program/equipment/me', {
      data: {
        archetypeId: 'corgi',
        outfit: undefined,
        inventory: [],
        recentItems: [],
        wallet: { fragmentBalance: 0, pityMisses: 0, pityTarget: 4 },
        pendingEntitlements: [],
        rewardsEnabled: true,
      },
    })

    const { container, getAllByText, getByText } = render(<ProfilePage />)

    expect(getByText('装备暂未同步')).toBeTruthy()
    expect(getAllByText('待重试').length).toBeGreaterThan(0)
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeNull()
    expect(container.querySelector('.profile-page__partner-image')).toBeNull()
  })

  it('does not claim zero equipment while the first equipment request is loading', () => {
    state.queryStates.set('mini-program/equipment/me', {
      data: undefined,
      isLoading: true,
      isError: false,
    })

    const { container, getByText, queryByText } = render(<ProfilePage />)

    expect(getByText('装备同步中…')).toBeTruthy()
    expect(queryByText('0 件')).toBeNull()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeNull()
  })

  it('falls back to the retry state when equipment sync stalls past the UI deadline', () => {
    vi.useFakeTimers()
    try {
      state.queryStates.set('mini-program/equipment/me', {
        data: undefined,
        isLoading: true,
        isError: false,
      })

      const { container, getByText, queryByText } = render(<ProfilePage />)

      expect(getByText('装备同步中…')).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(8000)
      })

      expect(getByText('装备暂未同步')).toBeTruthy()
      expect(queryByText('装备同步中…')).toBeNull()
      expect(container.querySelector('.pixel-avatar-composite__body')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers retry after equipment sync fails without showing an empty outfit', () => {
    state.queryStates.set('mini-program/equipment/me', {
      data: undefined,
      isLoading: false,
      isError: true,
    })

    const { container, getByRole, getByText, queryByText } = render(<ProfilePage />)

    expect(getByText('装备暂未同步')).toBeTruthy()
    expect(queryByText('0 件')).toBeNull()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeNull()

    fireEvent.click(getByRole('button', { name: '重新同步装备' }))
    expect(state.equipmentRefetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the cached outfit visible when a background refresh fails', () => {
    const cachedEquipment = state.queryStates.get('mini-program/equipment/me')
    state.queryStates.set('mini-program/equipment/me', {
      ...cachedEquipment,
      isError: true,
    })

    const { container, getByText, queryByText } = render(<ProfilePage />)

    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    expect(getByText('4 件')).toBeTruthy()
    expect(getByText('上次同步')).toBeTruthy()
    expect(queryByText('装备暂未同步')).toBeNull()
  })

  it('keeps V4 visible when one optional request fails', () => {
    state.queryStates.set('mini-program/gamification', { isError: true })

    const { getByTestId, getByText, queryByText } = render(<ProfilePage />)

    expect(getByTestId('profile-v4')).toBeTruthy()
    expect(getByText('成长记录稍后会自动刷新')).toBeTruthy()
    expect(getByText('不使用姓名、定位或未发生的情节')).toBeTruthy()
    expect(queryByText('个人资料简洁模式')).toBeNull()
  })

  it('uses compact mode only for an explicit false and stops V4-only requests', () => {
    state.user = makeUser(false)

    const { queryByTestId, getByLabelText } = render(<ProfilePage />)

    expect(queryByTestId('profile-v4')).toBeNull()
    expect(getByLabelText('个人资料简洁模式')).toBeTruthy()
    expect(state.enabledByKey.get('mini-program/gamification')).toBe(false)
    expect(state.enabledByKey.get('mini-program/equipment/me')).toBe(false)
  })

  it('keeps the two primary Profile entries actionable without service clutter', () => {
    const { getByTestId, queryByTestId } = render(<ProfilePage />)
    const partnerEntry = getByTestId('profile-partner-equipment-entry')
    const storyEntry = getByTestId('profile-story-entry')

    fireEvent.click(partnerEntry)
    fireEvent.click(storyEntry)

    expect(state.navigateTo).toHaveBeenCalledTimes(2)
    expect(queryByTestId('profile-more-services')).toBeNull()
  })

  it('renders story artwork eagerly from the main package', () => {
    const { container } = render(<ProfilePage />)
    const artwork = container.querySelector('.profile-page__story-image')

    expect(artwork?.getAttribute('src')).toBe('/assets/lovart/alang-result-candidate.webp')
    expect(artwork?.hasAttribute('lazyload')).toBe(false)
  })

  it('shows a visible reason when the my-image subpackage does not open', async () => {
    state.navigateTo.mockImplementationOnce(({ fail }: { fail?: (error: Error) => void }) => {
      fail?.(new Error('subpackage unavailable'))
    })
    state.showToast.mockResolvedValueOnce(undefined)
    const { getByTestId } = render(<ProfilePage />)

    fireEvent.click(getByTestId('profile-partner-equipment-entry'))

    await waitFor(() => expect(state.showToast).toHaveBeenCalledWith({
      title: '形象加载失败，请稍后重试',
      icon: 'none',
    }))
  })

  it('hides the personal story surface while its rollout flag is disabled', () => {
    state.user = {
      ...makeUser(true),
      features: {
        ...makeUser(true).features,
        personalStoryEnabled: false,
      },
    }

    const { queryByTestId } = render(<ProfilePage />)

    expect(queryByTestId('profile-story-entry')).toBeNull()
    expect(state.navigateTo).not.toHaveBeenCalled()
  })

  it('places settings below the profile content, outside the top navigation', () => {
    const { getByTestId } = render(<ProfilePage />)
    const settings = getByTestId('profile-settings-entry')
    const story = getByTestId('profile-growth-archive')

    expect(getByTestId('profile-top-navigation').contains(settings)).toBe(false)
    expect(story.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(settings)
    expect(state.navigateTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.profileSettings })
  })

  it('shows a visible recovery message when the settings subpackage does not open', async () => {
    state.navigateTo.mockRejectedValueOnce(new Error('subpackage unavailable'))
    state.showToast.mockResolvedValueOnce(undefined)
    const { getByTestId } = render(<ProfilePage />)

    fireEvent.click(getByTestId('profile-settings-entry'))

    await waitFor(() => expect(state.showToast).toHaveBeenCalledWith({
      title: '设置没有打开，请稍后再试',
      icon: 'none',
    }))
  })

  it('keeps the archetype circle icon visible in pixel mode', () => {
    const { container, getAllByTestId } = render(<ProfilePage />)

    // Request-4 regression lock: the circle icon renders even with the pixel
    // avatar on. The corner class emblem was removed (2026-07-29) as redundant
    // with this circle icon.
    expect(container.querySelector('.profile-page__identity-avatar')).toBeTruthy()
    expect(container.querySelector('.profile-page__partner-emblem')).toBeNull()
    expect(getAllByTestId('archetype-head').length).toBeGreaterThanOrEqual(1)

    // Pixel-on: grounded above the equipment bar — no --no-entry modifiers.
    expect(container.querySelector('.profile-page__partner-visual--no-entry')).toBeNull()
    expect(container.querySelector('.profile-page__identity-rail--no-entry')).toBeNull()
  })

  it('opens the personality report when tapping the identity copy card', () => {
    state.navigateTo.mockClear()
    ;(profileAnalytics.track as ReturnType<typeof vi.fn>).mockClear()

    const { getByTestId } = render(<ProfilePage />)
    fireEvent.click(getByTestId('profile-identity-copy-card'))

    expect(state.navigateTo).toHaveBeenCalledWith({
      url: `${MINI_PROGRAM_ROUTES.personalityTestResults}?source=profile`,
    })
    expect(profileAnalytics.track).toHaveBeenCalledWith(
      'profile_personality_action_tap',
      { source: 'v17_card' },
    )
  })

  it('shows the archetype tagline as a bio fallback and prompts to review the report', () => {
    const { getByText } = render(<ProfilePage />)

    expect(getByText('瞬间破冰的气氛点火手')).toBeTruthy()
    expect(getByText('回看报告')).toBeTruthy()
  })

  it('prompts the personality test when no archetype exists', () => {
    state.user = {
      ...makeUser(true),
      archetype: null,
      primaryArchetype: null,
    }
    state.navigateTo.mockClear()
    ;(profileAnalytics.track as ReturnType<typeof vi.fn>).mockClear()

    const { getByText, getByTestId } = render(<ProfilePage />)
    expect(getByText('测测你的社交原型')).toBeTruthy()

    fireEvent.click(getByTestId('profile-identity-copy-card'))
    expect(state.navigateTo).toHaveBeenCalledWith({
      url: `${MINI_PROGRAM_ROUTES.personalityTest}?source=profile`,
    })
    expect(profileAnalytics.track).toHaveBeenCalledWith(
      'profile_personality_action_tap',
      { source: 'v17_card' },
    )
  })

  it('uses a state-aware edit-profile caption on the completion stat card', () => {
    state.queryStates.set('mini-program/shell/profile', {
      data: { stats: { connectionsCount: 0 } },
    })

    const { getByText, rerender } = render(<ProfilePage />)
    expect(getByText('去完善')).toBeTruthy()

    state.user = { ...state.user, profileEssentialComplete: true, profileExtendedComplete: true }
    state.queryStates.set('mini-program/shell/profile', {
      data: { stats: { connectionsCount: 0 } },
    })
    rerender(<ProfilePage />)
    expect(getByText('查看资料')).toBeTruthy()
  })

  it('emits the fallback-row analytics source when the compact personality action is used', () => {
    state.user = makeUser(false)
    state.navigateTo.mockClear()
    ;(profileAnalytics.track as ReturnType<typeof vi.fn>).mockClear()

    const { getByLabelText } = render(<ProfilePage />)
    fireEvent.click(getByLabelText('查看人格结果'))

    expect(state.navigateTo).toHaveBeenCalledWith({
      url: `${MINI_PROGRAM_ROUTES.personalityTestResults}?source=profile`,
    })
    expect(profileAnalytics.track).toHaveBeenCalledWith(
      'profile_personality_action_tap',
      { source: 'fallback_row' },
    )
  })

  it('grounds the avatar on the stage floor when the pixel avatar is off', () => {
    state.user = {
      ...makeUser(true),
      features: {
        ...makeUser(true).features,
        profilePixelAvatarEnabled: false,
      },
    }

    const { container, queryByTestId } = render(<ProfilePage />)

    // Circle icon still renders (request 4) in both pixel and non-pixel modes.
    expect(container.querySelector('.profile-page__identity-avatar')).toBeTruthy()
    expect(queryByTestId('profile-partner-equipment-entry')).toBeNull()
    expect(queryByTestId('profile-partner-breath')).toBeTruthy()

    // No equipment bar → both the avatar and the card rail drop to the
    // stage floor via the --no-entry modifiers.
    expect(container.querySelector('.profile-page__partner-visual--no-entry')).toBeTruthy()
    expect(container.querySelector('.profile-page__identity-rail--no-entry')).toBeTruthy()
  })

  it('wraps the partner avatar in a breathing animation layer', () => {
    const { getByTestId } = render(<ProfilePage />)

    expect(getByTestId('profile-partner-breath')).toBeTruthy()
  })

  it('gates the breathing animation off on degradation-tier devices', () => {
    state.systemInfo = { benchmarkLevel: 10 }
    const { container } = render(<ProfilePage />)

    expect(container.querySelector('.profile-page__partner-breath--no-breath')).toBeTruthy()
    expect(container.querySelector('.profile-page__partner-platform--no-pulse')).toBeTruthy()
  })

  it('shows a toast when the personality report does not open', async () => {
    state.navigateTo.mockRejectedValueOnce(new Error('navigation failed'))
    state.showToast.mockResolvedValueOnce(undefined)
    const { getByTestId } = render(<ProfilePage />)

    fireEvent.click(getByTestId('profile-identity-copy-card'))

    await waitFor(() => expect(state.showToast).toHaveBeenCalledWith({
      title: '报告没有打开，请稍后再试',
      icon: 'none',
    }))
  })

  it('shows a toast when the personality test entry does not open', async () => {
    state.user = {
      ...makeUser(true),
      archetype: null,
      primaryArchetype: null,
    }
    state.navigateTo.mockRejectedValueOnce(new Error('navigation failed'))
    state.showToast.mockResolvedValueOnce(undefined)
    const { getByTestId } = render(<ProfilePage />)

    fireEvent.click(getByTestId('profile-identity-copy-card'))

    await waitFor(() => expect(state.showToast).toHaveBeenCalledWith({
      title: '测评没有打开，请稍后再试',
      icon: 'none',
    }))
  })

  it('renders the level plate with the current level and never mounts it on gamification error', () => {
    state.queryStates.set('mini-program/gamification', {
      data: {
        experiencePoints: 40,
        currentLevel: 1,
        levelConfig: { nameCn: '新芽' },
        nextLevelInfo: { xpNeeded: 100, progress: 40 },
      },
    })

    const { container, getByText } = render(<ProfilePage />)

    expect(container.querySelector('.profile-page__level-plate')).toBeTruthy()
    expect(getByText('Lv.1 新芽')).toBeTruthy()

    state.queryStates.set('mini-program/gamification', { isError: true })
    const errorRender = render(<ProfilePage />)

    expect(errorRender.getByText('成长记录稍后会自动刷新')).toBeTruthy()
    expect(errorRender.container.querySelector('.profile-page__level-plate')).toBeNull()
  })
})
