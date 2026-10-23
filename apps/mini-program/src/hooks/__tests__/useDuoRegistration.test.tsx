import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * S2 双人成行 invitee 角色分离 — hook 行为合同（sprint
 * duo-s2-invitee-role-separation）。页面是 useDuoRegistration 的薄壳，
 * 所以 AC-2/AC-4/AC-7/AC-8/D-6/D-9 的行为断言都钉在这一层（仓库对
 * pool-registration 页面的既定测试词汇：hook 行为测试 + 组件渲染测试 +
 * 页面接线 source-lock）。
 */

vi.mock('@tarojs/taro', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/taro')>('@tarojs/taro')
  const useDidShow = vi.fn()
  const useShareAppMessage = vi.fn()
  // The hook uses both the default export (Taro.useShareAppMessage) and the
  // named useDidShow — both levels must carry the additions. The aliased
  // mock module's default export isn't on the TaroStatic type, hence the cast.
  const actualDefault = (actual as { default?: Record<string, unknown> }).default ?? {}
  return {
    ...actual,
    default: { ...actualDefault, useDidShow, useShareAppMessage },
    useDidShow,
    useShareAppMessage,
  }
})

vi.mock('../../lib/api/duo', () => ({
  createDuoInvite: vi.fn(),
  getDuoStatus: vi.fn(),
  getDuoInviteInfo: vi.fn(),
}))

vi.mock('../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: vi.fn() },
}))

vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../lib/utils/logger', () => ({ logWarn: vi.fn(), logInfo: vi.fn(), logError: vi.fn() }))

import { createDuoInvite, getDuoStatus, getDuoInviteInfo } from '../../lib/api/duo'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { useDuoRegistration, type UseDuoRegistrationOptions } from '../useDuoRegistration'

const mockCreateDuoInvite = vi.mocked(createDuoInvite)
const mockGetDuoStatus = vi.mocked(getDuoStatus)
const mockGetDuoInviteInfo = vi.mocked(getDuoInviteInfo)
const mockTrack = vi.mocked(discoverAnalytics.track)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function makeOptions(overrides: Partial<UseDuoRegistrationOptions> = {}): UseDuoRegistrationOptions {
  return {
    apiRequest: vi.fn() as never,
    poolId: 'pool-1',
    poolTitle: '周末咖啡局',
    eventType: '饭局',
    invitationCode: '',
    isDuoInvite: false,
    inviteArrival: false,
    enabled: true,
    step: 0,
    stepBrief: 0,
    authLoading: false,
    reduceMotion: false,
    meRegistered: false,
    onInviteInvalid: vi.fn(),
    onInviteCreateError: vi.fn(),
    onDuoDeclinedSolo: vi.fn(),
    ...overrides,
  }
}

const ACTIVE_INVITE = {
  inviter: { displayName: '阿明' },
  poolId: 'pool-1',
  status: 'active' as const,
  inviterRegistered: false,
}

function mockInviteeLanding() {
  mockGetDuoStatus.mockResolvedValue({ state: 'none' })
  mockGetDuoInviteInfo.mockResolvedValue(ACTIVE_INVITE)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDuoStatus.mockResolvedValue({ state: 'none' })
  mockGetDuoInviteInfo.mockResolvedValue(ACTIVE_INVITE)
  mockCreateDuoInvite.mockResolvedValue({ code: 'abc123def456', sharePath: '/share' })
})

describe('useDuoRegistration — S2 invitee 落地（AC-2/D-2/D-8）', () => {
  it('invitee 落地：segmented 显示态为 2人，guest 卡出现，POST 建码 spy = 0', async () => {
    mockInviteeLanding()
    const { result } = renderHook(
      () =>
        useDuoRegistration(
          makeOptions({ invitationCode: 'abc123def456', isDuoInvite: true, inviteArrival: true }),
        ),
      { wrapper: createWrapper() },
    )

    // 显示态即 2人（resolveInitialDuoMode 的 inviteArrival 预选，不是 'solo'
    // —— AC-2 禁止实现成 solo，否则被邀请人会以为邀请没生效）。
    expect(result.current.duoMode).toBe('duo')

    await waitFor(() => expect(result.current.duoCardState).toBe('guest'))
    expect(result.current.duoRole).toBe('invitee')
    expect(result.current.guestLoading).toBe(false)
    expect(result.current.guestDuoCopy).toEqual({
      line1: '阿明 这局给你留了个位置',
      line2: '报名后你们会被排进同一桌',
    })
    // AC-2 硬断言：落地全程没有任何 POST /duo-invites。
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(0)
  })

  it('lookup 加载中：guestLoading 骨架窗打开（D-8），数据落地后关闭', async () => {
    let resolveLookup: (value: typeof ACTIVE_INVITE) => void = () => undefined
    mockGetDuoInviteInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve
        }),
    )
    const { result } = renderHook(
      () =>
        useDuoRegistration(
          makeOptions({ invitationCode: 'abc123def456', isDuoInvite: true, inviteArrival: true }),
        ),
      { wrapper: createWrapper() },
    )

    // duo-status 先落地后，lookup 仍在途 → 骨架窗 + guest 态。
    await waitFor(() => expect(result.current.duoCardState).toBe('guest'))
    expect(result.current.guestLoading).toBe(true)
    expect(result.current.guestDuoCopy).toBeUndefined()
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(0)

    await act(async () => resolveLookup(ACTIVE_INVITE))
    await waitFor(() => expect(result.current.guestLoading).toBe(false))
    expect(result.current.guestDuoCopy?.line1).toBe('阿明 这局给你留了个位置')
  })

  it('guest 态点「2人」：no-op，POST 仍为 0（D-2 spy）', async () => {
    mockInviteeLanding()
    const { result } = renderHook(
      () =>
        useDuoRegistration(
          makeOptions({ invitationCode: 'abc123def456', isDuoInvite: true, inviteArrival: true }),
        ),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.duoCardState).toBe('guest'))

    await act(async () => {
      await result.current.selectDuoMode('duo')
    })
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(0)
    expect(result.current.duoMode).toBe('duo')
  })
})

describe('useDuoRegistration — S2 solo 确认弹窗（AC-4/D-6/D-9）', () => {
  async function renderGuestWithDialog() {
    mockInviteeLanding()
    const options = makeOptions({
      invitationCode: 'abc123def456',
      isDuoInvite: true,
      inviteArrival: true,
    })
    const rendered = renderHook(() => useDuoRegistration(options), { wrapper: createWrapper() })
    await waitFor(() => expect(rendered.result.current.duoCardState).toBe('guest'))
    await act(async () => {
      await rendered.result.current.selectDuoMode('solo')
    })
    return { options, ...rendered }
  }

  it('点「1人」不直接切换：弹窗打开，thumb 冻结在 2人侧，无埋点无建码', async () => {
    const { result } = await renderGuestWithDialog()

    expect(result.current.isSoloConfirmOpen).toBe(true)
    // thumb 冻结：duoMode 保持 'duo'，segmented 仍显示 2人。
    expect(result.current.duoMode).toBe('duo')
    expect(result.current.duoCardState).toBe('guest')
    // duo_segment_select 改为确认后触发（D-10）——弹窗存续期间零埋点。
    expect(mockTrack).not.toHaveBeenCalledWith('duo_segment_select', 'pool-1', expect.anything())
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(0)
  })

  it('「还是一起去」：关闭弹窗，mode 仍 duo，全程无 duo_segment_select', async () => {
    const { result } = await renderGuestWithDialog()

    act(() => result.current.confirmStayTogether())

    expect(result.current.isSoloConfirmOpen).toBe(false)
    expect(result.current.duoMode).toBe('duo')
    expect(result.current.duoDeclinedSolo).toBe(false)
    expect(result.current.duoCardState).toBe('guest')
    expect(mockTrack).not.toHaveBeenCalledWith('duo_segment_select', 'pool-1', expect.anything())
  })

  it('「就我一个人」：确认后才滑动——solo + collapsed + 会话级 decline + 确认后埋点（含 role）', async () => {
    const { result, options } = await renderGuestWithDialog()

    act(() => result.current.confirmGoSolo())

    expect(result.current.isSoloConfirmOpen).toBe(false)
    expect(result.current.duoMode).toBe('solo')
    expect(result.current.duoDeclinedSolo).toBe(true)
    // 卡片回 collapsed（guest 表面被 decline 压制）。
    expect(result.current.duoCardState).toBe('collapsed')
    // AC-5：确认后触发 duo_segment_select（恰好一次），metadata 增 role。
    // 注：hook 同时会发 duo_card_impression / duo_banner_impression，这里只
    // 钉 duo_segment_select 的次数与载荷。
    const segmentSelectCalls = mockTrack.mock.calls.filter(([event]) => event === 'duo_segment_select')
    expect(segmentSelectCalls).toEqual([
      ['duo_segment_select', 'pool-1', { mode: 'solo', role: 'invitee' }],
    ])
    // Dependencies：通知页面压制归因（payload 不再携带 invitationCode）。
    expect(options.onDuoDeclinedSolo).toHaveBeenCalledTimes(1)
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(0)
  })

  it('decline 后横幅/guest 表面不再出现（showDuoBanner 仍为真但 guestArrival 被压制）', async () => {
    const { result } = await renderGuestWithDialog()
    expect(result.current.showDuoBanner).toBe(true)

    act(() => result.current.confirmGoSolo())

    // D-1 真值源 showDuoBanner 不变（lookup 仍 active），但 decline 压制了
    // guest 表面与跨 step 横幅（页面用 duoDeclinedSolo 门控横幅）。
    expect(result.current.duoDeclinedSolo).toBe(true)
    expect(result.current.duoCardState).toBe('collapsed')
  })

  it('D-9 互斥：弹窗打开时 openDuoSheet 会关闭弹窗（反之亦然）', async () => {
    const { result } = await renderGuestWithDialog()
    expect(result.current.isSoloConfirmOpen).toBe(true)

    act(() => result.current.openDuoSheet())
    expect(result.current.isSoloConfirmOpen).toBe(false)
    expect(result.current.isDuoSheetOpen).toBe(true)
  })

  it('D-6 触发守卫：meRegistered 时不出弹窗，直接切换并照常埋点', async () => {
    mockInviteeLanding()
    const { result } = renderHook(
      () =>
        useDuoRegistration(
          makeOptions({
            invitationCode: 'abc123def456',
            isDuoInvite: true,
            inviteArrival: true,
            meRegistered: true,
          }),
        ),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.duoCardState).toBe('guest'))

    await act(async () => {
      await result.current.selectDuoMode('solo')
    })

    expect(result.current.isSoloConfirmOpen).toBe(false)
    expect(result.current.duoMode).toBe('solo')
    expect(mockTrack).toHaveBeenCalledWith('duo_segment_select', 'pool-1', {
      mode: 'solo',
      role: 'invitee',
    })
  })
})

describe('useDuoRegistration — S2 role 权威与回退（AC-7/AC-8）', () => {
  it('AC-8 优先级：duo-status viewerRole=inviter 压过 active lookup — 不出现 guest', async () => {
    mockGetDuoStatus.mockResolvedValue({
      state: 'waiting',
      viewerRole: 'inviter',
      pendingSide: 'invitee',
      invitedAt: '2026-10-23T10:00:00.000Z',
    })
    const { result } = renderHook(
      () =>
        useDuoRegistration(
          makeOptions({ invitationCode: 'abc123def456', isDuoInvite: true, inviteArrival: true }),
        ),
      { wrapper: createWrapper() },
    )

    // mode='duo' + 无分享时间戳 → expanded（发起人视角），绝不渲染 guest。
    await waitFor(() => expect(result.current.duoCardState).toBe('expanded'))
    expect(result.current.duoRole).toBe('inviter')
  })

  it('AC-7：lookup 404 → role none + onInviteInvalid + segmented 回 1人 + 允许建码', async () => {
    const err = Object.assign(new Error('not found'), { statusCode: 404 })
    mockGetDuoInviteInfo.mockRejectedValue(err)
    const options = makeOptions({
      invitationCode: 'abc123def456',
      isDuoInvite: true,
      inviteArrival: true,
    })
    const { result } = renderHook(() => useDuoRegistration(options), { wrapper: createWrapper() })

    await waitFor(() => expect(options.onInviteInvalid).toHaveBeenCalledTimes(1))

    // D-8：segmented 回 1人，role 落回 none，guest 表面不渲染。
    expect(result.current.duoMode).toBe('solo')
    expect(result.current.duoRole).toBe('none')
    expect(result.current.duoCardState).toBe('collapsed')
    expect(result.current.showDuoBanner).toBe(false)
    expect(result.current.guestLoading).toBe(false)

    // 允许建码（回退为非 invitee 行为）。
    await act(async () => {
      await result.current.selectDuoMode('duo')
    })
    expect(mockTrack).toHaveBeenCalledWith('duo_segment_select', 'pool-1', {
      mode: 'duo',
      role: 'none',
    })
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(1)
  })

  it('AC-7：lookup 410 与 404 同路径（一次性 toast + 回 1人）', async () => {
    const err = Object.assign(new Error('gone'), { statusCode: 410 })
    mockGetDuoInviteInfo.mockRejectedValue(err)
    const options = makeOptions({
      invitationCode: 'abc123def456',
      isDuoInvite: true,
      inviteArrival: true,
    })
    renderHook(() => useDuoRegistration(options), { wrapper: createWrapper() })

    await waitFor(() => expect(options.onInviteInvalid).toHaveBeenCalledTimes(1))
  })

  it('Reliability：lookup 非 404/410 失败 → 非 invitee 行为（骨架窗关闭、可建码、不卡中间态）', async () => {
    const err = Object.assign(new Error('network down'), { statusCode: 500 })
    mockGetDuoInviteInfo.mockRejectedValue(err)
    const options = makeOptions({
      invitationCode: 'abc123def456',
      isDuoInvite: true,
      inviteArrival: true,
    })
    const { result } = renderHook(() => useDuoRegistration(options), { wrapper: createWrapper() })

    // 等骨架窗关闭（失败标记落位）。
    await waitFor(() => expect(result.current.guestLoading).toBe(false))

    // 无 toast（非 404/410）、无 guest 表面、role none。
    expect(options.onInviteInvalid).not.toHaveBeenCalled()
    expect(result.current.duoRole).toBe('none')
    expect(result.current.showDuoBanner).toBe(false)
    // inviteArrival 的本地预选保留（expanded），点 1人 直接切换无弹窗。
    expect(result.current.duoCardState).toBe('expanded')
    await act(async () => {
      await result.current.selectDuoMode('solo')
    })
    expect(result.current.isSoloConfirmOpen).toBe(false)
    expect(result.current.duoMode).toBe('solo')
  })

  it('AC-6 回归：非邀请落地用户行为逐字不变（collapsed → 点 2人 建码 + 埋点带 role）', async () => {
    const { result } = renderHook(() => useDuoRegistration(makeOptions()), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.duoCardState).toBe('collapsed'))
    expect(result.current.duoRole).toBe('none')

    await act(async () => {
      await result.current.selectDuoMode('duo')
    })
    expect(mockTrack).toHaveBeenCalledWith('duo_segment_select', 'pool-1', {
      mode: 'duo',
      role: 'none',
    })
    expect(mockCreateDuoInvite).toHaveBeenCalledTimes(1)
    expect(result.current.duoMode).toBe('duo')
  })
})
