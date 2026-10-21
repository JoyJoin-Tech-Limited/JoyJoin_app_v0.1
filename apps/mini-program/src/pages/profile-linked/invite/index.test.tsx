import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InvitePage from './index'

/**
 * Invite page duo-lane pool scoping (对标平台 B1, checkout audit report §3.1).
 *
 * The checkout duo entry navigates here with `?poolId=<checkout pool>`. At
 * checkout time the inviter typically holds NO registration row for that pool
 * (the entitlement gate hands off to payment before the registration insert),
 * so the duo lane must scope to the query poolId first. When the query is
 * absent the page keeps its legacy behavior: first active registration.
 *
 * Covers:
 *  ① query poolId wins over myRegistrations[0] (checkout scenario)
 *  ② query absent → legacy myRegistrations[0] fallback (no regression)
 *  ③ query absent + no registrations → duo lane never fires, referral mode
 */

const mocks = vi.hoisted(() => ({
  getCurrentInstance: vi.fn(),
  createDuoInvite: vi.fn(),
  getReferralStats: vi.fn(),
  getMyPoolRegistrations: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: mocks.getCurrentInstance,
    setClipboardData: vi.fn(),
    showToast: vi.fn(),
  },
  useDidShow: vi.fn(),
  useShareAppMessage: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ ...props }: any) => <div {...props} />,
}))

vi.mock('@shared/api', () => ({
  getReferralStats: mocks.getReferralStats,
  getMyPoolRegistrations: mocks.getMyPoolRegistrations,
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../lib/api/duo', () => ({
  createDuoInvite: mocks.createDuoInvite,
}))

vi.mock('../../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ isLoading: false }),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', features: { duoRegistrationEnabled: true } },
  }),
}))

vi.mock('../../../hooks/usePageTTI', () => ({
  usePageTTI: vi.fn(),
}))

vi.mock('../../../components/loading/LoadingScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('../../../components/ui/Card', () => ({
  default: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: () => null,
}))

vi.mock('../../../lib/ceremonyHeroes', () => ({
  CEREMONY_HEROES: { inviteHeader: '', inviteCoBranded: '' },
}))

const QUERY_POOL_ID = 'pool-checkout-9'
const REGISTRATION_POOL_ID = 'pool-other-1'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<InvitePage />, { wrapper: Wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getReferralStats.mockResolvedValue({
    referralCode: 'REFCODE1',
    successfulInvites: 0,
    platformTotal: 0,
    inviteLink: '',
  })
  mocks.createDuoInvite.mockResolvedValue({
    code: 'duocode1',
    sharePath: `/pages/pool-registration/index?id=pool-x&invitationCode=duocode1&duo=1`,
  })
})

describe('InvitePage — duo lane pool scoping (对标平台 B1)', () => {
  it('① query poolId + ZERO registration rows (checkout scenario) → duo lane still fires for the query pool', async () => {
    // The entitlement gate hands off to checkout BEFORE the registration
    // insert, so the mainstream checkout visitor has no registration row.
    mocks.getCurrentInstance.mockReturnValue({
      router: { params: { poolId: QUERY_POOL_ID } },
    })
    mocks.getMyPoolRegistrations.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(mocks.createDuoInvite).toHaveBeenCalledTimes(1))
    expect(mocks.createDuoInvite).toHaveBeenCalledWith(
      expect.anything(),
      QUERY_POOL_ID,
    )
    // The page renders the pool-scoped duo share surface, not the referral one.
    expect(await screen.findByText('本场同行码')).toBeInTheDocument()
    expect(screen.getByText('同行码只对这场局有效，排桌锁定前截止；同一好友只计入一次。')).toBeInTheDocument()
    expect(screen.queryByText('你的邀请码')).not.toBeInTheDocument()
  })

  it('①b query poolId wins over an unrelated registration pool (never mints a code for the wrong pool)', async () => {
    mocks.getCurrentInstance.mockReturnValue({
      router: { params: { poolId: QUERY_POOL_ID } },
    })
    mocks.getMyPoolRegistrations.mockResolvedValue([
      { poolId: REGISTRATION_POOL_ID },
    ])

    renderPage()

    await waitFor(() => expect(mocks.createDuoInvite).toHaveBeenCalledTimes(1))
    expect(mocks.createDuoInvite).toHaveBeenCalledWith(
      expect.anything(),
      QUERY_POOL_ID,
    )
    expect(mocks.createDuoInvite).not.toHaveBeenCalledWith(
      expect.anything(),
      REGISTRATION_POOL_ID,
    )
  })

  it('② query absent → legacy myRegistrations[0] fallback scopes the duo lane (no regression)', async () => {
    mocks.getCurrentInstance.mockReturnValue({ router: { params: {} } })
    mocks.getMyPoolRegistrations.mockResolvedValue([
      { poolId: REGISTRATION_POOL_ID },
    ])

    renderPage()

    await waitFor(() => expect(mocks.createDuoInvite).toHaveBeenCalledTimes(1))
    expect(mocks.createDuoInvite).toHaveBeenCalledWith(
      expect.anything(),
      REGISTRATION_POOL_ID,
    )
    expect(await screen.findByText('本场同行码')).toBeInTheDocument()
  })

  it('③ query absent + no registrations → duo lane never fires, referral mode stays', async () => {
    mocks.getCurrentInstance.mockReturnValue({ router: { params: {} } })
    mocks.getMyPoolRegistrations.mockResolvedValue([])

    renderPage()

    await waitFor(() =>
      expect(screen.getByText('你的邀请码')).toBeInTheDocument(),
    )
    expect(mocks.createDuoInvite).not.toHaveBeenCalled()
    expect(screen.getByText('邀请链接长期有效，分享给朋友即可。')).toBeInTheDocument()
  })
})
