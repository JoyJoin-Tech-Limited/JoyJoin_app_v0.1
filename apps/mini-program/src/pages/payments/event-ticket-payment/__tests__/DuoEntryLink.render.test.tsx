import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DuoEntryLink from '../components/DuoEntryLink'

/**
 * DuoEntryLink render contract (T46 P1a, contract AC-07).
 * Pattern: RefundGuaranteeLine.render.test.tsx + GuestEventPreviewSection
 * (QueryClientProvider over a mocked duo-status read).
 *
 * Covers: disabled gate → null + no fetch; loading → null (silent); error →
 * null (fail-closed); state `none` → row renders + one impression; state
 * `waiting`/`bound` → null (a duo lane already exists); tap → light haptic +
 * duo_entry_link_tap + invite-page navigation; impression ref-dedup per page
 * visit; source-lock — zero amount/urgency words and zero red-line vocabulary
 * in the component source.
 */

const { mockGetDuoStatus } = vi.hoisted(() => ({ mockGetDuoStatus: vi.fn() }))
const { mockNavigateTo } = vi.hoisted(() => ({ mockNavigateTo: vi.fn() }))
const { mockHaptics } = vi.hoisted(() => ({ mockHaptics: vi.fn() }))
const { mockDiscoverAnalytics } = vi.hoisted(() => ({
  mockDiscoverAnalytics: {
    trackDuoEntryLinkImpression: vi.fn(),
    trackDuoEntryLinkTap: vi.fn(),
  },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => {
    const { hoverClass: _hoverClass, ...rest } = props as Record<string, unknown>
    return <div {...rest} />
  },
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: { navigateTo: mockNavigateTo },
}))

vi.mock('../../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../../lib/api/duo', () => ({
  getDuoStatus: mockGetDuoStatus,
}))

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: mockHaptics,
}))

vi.mock('../../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: mockDiscoverAnalytics,
}))

const MAIN_TEXT = '和朋友一起？邀 TA 同行，排进同一桌'
const HINT_TEXT = '同行有奖励'
const POOL_ID = 'pool-duo-1'

function renderLink({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DuoEntryLink poolId={POOL_ID} enabled={enabled} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DuoEntryLink — conditional render matrix (AC-07)', () => {
  it('enabled=false → renders nothing and never fetches duo-status', () => {
    const { container } = renderLink({ enabled: false })

    expect(container.firstChild).toBeNull()
    expect(mockGetDuoStatus).not.toHaveBeenCalled()
    expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).not.toHaveBeenCalled()
  })

  it('while the duo-status read is in flight → silent null (no skeleton, no placeholder)', () => {
    mockGetDuoStatus.mockReturnValueOnce(new Promise(() => {}))
    const { container } = renderLink()

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(MAIN_TEXT)).not.toBeInTheDocument()
  })

  it('fetch error → renders nothing (fail-closed)', async () => {
    mockGetDuoStatus.mockRejectedValueOnce(new Error('network down'))
    const { container } = renderLink()

    await waitFor(() => expect(mockGetDuoStatus).toHaveBeenCalledTimes(1))
    expect(container.firstChild).toBeNull()
    expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).not.toHaveBeenCalled()
  })

  it('state `none` → the row renders with the canonical copy, hint, and chevron', async () => {
    mockGetDuoStatus.mockResolvedValueOnce({ state: 'none' })
    const { container } = renderLink()

    await waitFor(() => expect(screen.getByText(MAIN_TEXT)).toBeInTheDocument())
    expect(screen.getByText(HINT_TEXT)).toBeInTheDocument()
    expect(container.querySelector('.ticket-duo-link')).not.toBeNull()
    expect(container.querySelector('.ticket-duo-link__text')).not.toBeNull()
    expect(container.querySelector('.ticket-duo-link__hint')).not.toBeNull()
    expect(container.querySelector('.ticket-duo-link__arrow')?.textContent).toBe('›')
    // Text-link register only — no card/button/badge chrome on the row.
    const row = container.querySelector('.ticket-duo-link') as HTMLElement
    expect(row.classList.length).toBe(1)
    expect(row.getAttribute('role')).toBe('button')
  })

  it('state `waiting` (a duo lane already in flight) → renders nothing', async () => {
    mockGetDuoStatus.mockResolvedValueOnce({ state: 'waiting', invitedAt: '2026-10-21T00:00:00.000Z' })
    const { container } = renderLink()

    await waitFor(() => expect(mockGetDuoStatus).toHaveBeenCalledTimes(1))
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(MAIN_TEXT)).not.toBeInTheDocument()
    expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).not.toHaveBeenCalled()
  })

  it('state `bound` (duo already seated together) → renders nothing', async () => {
    mockGetDuoStatus.mockResolvedValueOnce({ state: 'bound', friendDisplayName: '栗子' })
    const { container } = renderLink()

    await waitFor(() => expect(mockGetDuoStatus).toHaveBeenCalledTimes(1))
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(MAIN_TEXT)).not.toBeInTheDocument()
  })
})

describe('DuoEntryLink — interaction + metering (AC-07)', () => {
  it('tap → haptics(light) + duo_entry_link_tap + invite landing page navigation', async () => {
    mockGetDuoStatus.mockResolvedValueOnce({ state: 'none' })
    const { container } = renderLink()

    await waitFor(() => expect(screen.getByText(MAIN_TEXT)).toBeInTheDocument())
    fireEvent.click(container.querySelector('.ticket-duo-link') as HTMLElement)

    expect(mockHaptics).toHaveBeenCalledWith('light')
    expect(mockDiscoverAnalytics.trackDuoEntryLinkTap).toHaveBeenCalledTimes(1)
    expect(mockDiscoverAnalytics.trackDuoEntryLinkTap).toHaveBeenCalledWith({ poolId: POOL_ID })
    expect(mockNavigateTo).toHaveBeenCalledTimes(1)
    expect(mockNavigateTo).toHaveBeenCalledWith({ url: '/pages/profile-linked/invite/index' })
  })

  it('row impression fires exactly once per page visit even across rerenders', async () => {
    mockGetDuoStatus.mockResolvedValue({ state: 'none' })
    const { rerender } = renderLink()

    await waitFor(() =>
      expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).toHaveBeenCalledTimes(1),
    )
    expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).toHaveBeenCalledWith({ poolId: POOL_ID })

    // Re-renders (e.g. parent pricing state settling) must not re-meter.
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DuoEntryLink poolId={POOL_ID} enabled />
      </QueryClientProvider>,
    )
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DuoEntryLink poolId={POOL_ID} enabled />
      </QueryClientProvider>,
    )
    expect(mockDiscoverAnalytics.trackDuoEntryLinkImpression).toHaveBeenCalledTimes(1)
  })
})

describe('DuoEntryLink — copy red-line source lock (AC-07)', () => {
  it('component source contains zero amount/urgency words and zero red-line vocabulary', () => {
    const sourcePath = join(__dirname, '..', 'components', 'DuoEntryLink.tsx')
    const source = readFileSync(sourcePath, 'utf8')

    // Amount / cash-out vocabulary — the entry must never carry a number, an
    // amount, or a withdrawal promise; reward rules live on the landing page.
    expect(source).not.toMatch(/¥/)
    expect(source).not.toContain('立得')
    expect(source).not.toContain('现金')
    expect(source).not.toContain('提现')

    // 🔴 red-line vocabulary — zero hits anywhere in the component source
    // (copy AND comments).
    expect(source).not.toContain('匹配')
    expect(source).not.toContain('社交')
    expect(source).not.toContain('灵魂')
    expect(source).not.toContain('AI')
    expect(source).not.toContain('算法')
    expect(source).not.toContain('智能')
  })
})
