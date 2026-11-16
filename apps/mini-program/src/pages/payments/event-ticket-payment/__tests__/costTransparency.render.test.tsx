import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getTiersForEventType, UNMAPPABLE_BLIND_BOX_BUDGET_LABEL, type BudgetEventType } from '@shared/budgetTiers'
import EventTicketPaymentPage from '../index'

const page = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')
const sheet = readFileSync(
  resolve(__dirname, '../../../../components/event-ticket-payment/IcebreakerInclusionSheet.tsx'),
  'utf8',
)
const cost = readFileSync(
  resolve(__dirname, '../../../../components/event-ticket-payment/CostBreakdown.tsx'),
  'utf8',
)
const pageStyles = readFileSync(resolve(__dirname, '../index.scss'), 'utf8')

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  apiRequest: vi.fn(),
  getEventPool: vi.fn(),
  getUserCoupons: vi.fn(),
  registerWithPayment: vi.fn(),
  readContext: vi.fn(),
  requestPayment: vi.fn(),
  createSelectorQuery: vi.fn(),
  nextTick: vi.fn((callback: () => void) => callback()),
  features: {} as Record<string, unknown>,
  actionBarHeight: 160,
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { poolId: 'pool-1' } } }),
    nextTick: mocks.nextTick,
    createSelectorQuery: mocks.createSelectorQuery,
    requestPayment: mocks.requestPayment,
    eventCenter: { on: vi.fn(), off: vi.fn(), trigger: vi.fn() },
    showToast: vi.fn(),
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    setNavigationBarTitle: vi.fn(),
  },
  useDidShow: vi.fn(),
}))

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getEventPool: mocks.getEventPool,
    getUserCoupons: mocks.getUserCoupons,
    registerForPool: vi.fn(),
    registerForPoolWithPayment: mocks.registerWithPayment,
    createMiniProgramPaymentIntent: vi.fn(),
    reconcilePayment: vi.fn(),
  }
})

vi.mock('../../../../lib/api/api', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', features: mocks.features } }),
}))
vi.mock('../../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ tier: 'primary', isDegradation: true }),
}))
vi.mock('../../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: true }),
}))
vi.mock('../../../../hooks/useLoadingDeadline', () => ({
  useLoadingDeadline: () => ({ isStale: false }),
}))
vi.mock('../../../../hooks/useResetOnShow', () => ({ useResetOnShow: vi.fn() }))
vi.mock('../../../../lib/payment/paymentPendingOrderStorage', () => ({
  readStoredPaymentReturnContext: mocks.readContext,
  persistPaymentReturnContext: vi.fn(),
  clearPaymentReturnContextStorage: vi.fn(),
}))
vi.mock('../../../../lib/payment/paymentPendingOrder', () => ({
  markPaymentReturnContextPaid: (context: unknown) => context,
}))
vi.mock('../../../../lib/api/registrationCacheBust', () => ({ bustRegistrationCaches: vi.fn() }))
vi.mock('../../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: mocks.track },
}))
vi.mock('../../../../lib/analytics/interactionLatency', () => ({
  interactionLatency: { startInteraction: vi.fn(), trackInteraction: vi.fn() },
}))
vi.mock('../../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/assets/test-mascot.webp',
}))

vi.mock('../../../../components/reservation/ReservationTicket', () => ({
  default: ({ children, footer }: { children?: ReactNode; footer?: ReactNode }) => (
    <section className='reservation-ticket'>
      <div>{children}</div>
      <div>{footer}</div>
    </section>
  ),
}))
vi.mock('../../../../components/reservation/RegistrationSuccessCeremony', () => ({
  default: () => null,
}))
vi.mock('../../../../components/ui/StatusCard', () => ({ default: () => null }))
vi.mock('../components/DuoEntryLink', () => ({ default: () => null }))
vi.mock('../components/XiaoyuePaymentReceipt', () => ({
  default: () => null,
  captureSameOrderReceipt: vi.fn(() => null),
}))
vi.mock('../components/TicketPlanSelection', () => ({
  default: ({ onSelectPlan }: { onSelectPlan: (plan: string) => void }) => (
    <div>
      {(['pack_3', 'pack_6', 'vip_monthly'] as const).map((plan) => (
        <button key={plan} type='button' onClick={() => onSelectPlan(plan)}>{`plan-${plan}`}</button>
      ))}
    </div>
  ),
}))
vi.mock('../../../../components/payments/TicketOrderSkeleton', () => ({
  default: () => null,
  getTicketCtaLabel: (isPaying: boolean, isCreating: boolean) =>
    isPaying ? (isCreating ? '请稍候…' : '支付中…') : '确认订座',
}))

describe('event-ticket-payment cost transparency integration', () => {
  it.each(['pack_3', 'pack_6', 'vip_monthly'])(
    '%s enters the eighth state only through the existing selectedPlan branch',
    (plan) => {
      expect(page).toContain(`selectedPlan === '${plan}'`)
      const branchStart = page.indexOf('const isMultiEventPurchase =')
      expect(branchStart).toBeGreaterThan(-1)
      const branch = page.slice(branchStart, branchStart + 240)
      expect(branch).toContain(`selectedPlan === '${plan}'`)
      expect(branch).not.toContain('paidCents')
      expect(branch).not.toContain('displayName')
      expect(branch).not.toContain('priceInCents')
    },
  )

  it('uses one paidCents value while suppressing tonight total for the eighth state', () => {
    expect(page).toContain('const paidCents = finalPrice')
    expect(page).toContain('const tonightTotalLabel = isMultiEventPurchase')
    expect(page).toContain('formatTonightTotal(paidCents, budgetTierIds)')
    expect(page).toContain('paidCents={paidCents}')
    expect(cost).toContain('COST_ROW_PURCHASE')
    expect(page).toContain('COST_ACTION_PURCHASE')
  })

  it('passes only derived labels to the presentational sheet', () => {
    expect(page).toContain('const onSiteBudgetLabel = formatOnSiteBudget(budgetTierIds)')
    expect(page).toContain('onSiteBudgetLabel={onSiteBudgetLabel}')
    expect(page).toContain('onSiteHint={onSiteHint}')
    expect(sheet).not.toContain('formatOnSiteBudget(')
    expect(sheet).not.toContain('formatTonightTotal(')
    expect(sheet).not.toContain('Taro.request(')
    expect(sheet).not.toContain('apiRequest')
  })

  it('measures the real action bar and invalidates on every dynamic footer row', () => {
    expect(page).toContain('Taro.createSelectorQuery()')
    expect(page).toContain(".select('.ticket-footer')")
    expect(page).toContain('setActionBarHeightPx')
    expect(page).toContain('actionBarHeightPx}px')
    expect(page).not.toContain('ticket-bottom-spacer--with-guarantee')
    for (const dependency of [
      'cancelCount',
      'payment.status',
      'payment.error',
      'preRevealRefundEnabled',
      'showRefundNarrativeStack',
    ]) {
      expect(page).toContain(dependency)
    }
  })

  it('locks the payment-only white card to the approved 32rpx radius token', () => {
    const overrideStart = pageStyles.indexOf('.ticket-page .reservation-ticket {')
    expect(overrideStart).toBeGreaterThan(-1)
    const override = pageStyles.slice(overrideStart, pageStyles.indexOf('}', overrideStart) + 1)
    expect(override).toContain('border-radius: $card-radius;')
    expect(override).not.toContain('$card-radius-lg')
  })
})

const tierIdAt = (eventType: BudgetEventType, order: number): string => {
  const tier = getTiersForEventType(eventType).find((candidate) => candidate.order === order)
  if (!tier) throw new Error(`Missing canonical ${eventType} tier at order ${order}`)
  return tier.id
}

const DRINKS_RANGE_ID = tierIdAt('酒局', 1)
const DRINKS_BELOW_ID = tierIdAt('酒局', 0)
const DINING_LOWER_ID = tierIdAt('饭局', 1)
const DINING_UPPER_ID = tierIdAt('饭局', 2)
const rangeText = (min: number, max: number) => `¥${min}–${max}`
const upperText = (max: number) => `¥${max} 以内`

interface CheckoutOptions {
  draft?: Record<string, unknown>
  eventType?: BudgetEventType
  coupons?: Array<Record<string, unknown>>
  refundEnabled?: boolean
  singlePriceCents?: number
}

function renderCheckout(options: CheckoutOptions = {}) {
  const draft = options.draft ?? { barBudgetRange: [DRINKS_RANGE_ID] }
  mocks.features = {
    checkoutSubscriptionUpsellEnabled: true,
    preRevealRefundEnabled: options.refundEnabled === true,
  }
  mocks.getEventPool.mockResolvedValue({
    id: 'pool-1',
    title: '周六晚测试局',
    eventType: options.eventType ?? '酒局',
    status: 'active',
    district: '南山区',
    city: '深圳',
    dateTime: '2026-11-21T19:30:00+08:00',
    registrationCount: 4,
    currentParticipants: 4,
  })
  mocks.getUserCoupons.mockResolvedValue({ coupons: options.coupons ?? [] })
  mocks.readContext.mockReturnValue({
    status: 'ready',
    context: {
      kind: 'pool-registration',
      userId: 'user-1',
      poolId: 'pool-1',
      draft,
      paymentStatus: 'payment-required',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  })
  mocks.apiRequest.mockImplementation(({ path }: { path: string }) => {
    if (path === '/api/payments/ritual-context') {
      return Promise.resolve({
        plans: [
          { planType: 'event_single', priceInCents: options.singlePriceCents ?? 8800 },
          { planType: 'pack_3', displayName: '三连局包', description: '3 场局名额', priceInCents: 21100 },
          { planType: 'pack_6', displayName: '六连局包', description: '6 场局名额', priceInCents: 37000 },
        ],
        // Deliberately no displayName/description: the page must not expose
        // resolveVipMonthlyOffer's selector fallback as order-derived copy.
        subscriptionPlans: [{ planType: 'monthly', priceCents: 9800 }],
      })
    }
    if (path === '/api/subscription/status') {
      return Promise.resolve({ hasActiveSubscription: false })
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`))
  })

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <EventTicketPaymentPage />
    </QueryClientProvider>,
  )
  return screen.findByText('今晚的费用').then(() => result)
}

beforeEach(() => {
  mocks.features = { checkoutSubscriptionUpsellEnabled: true, preRevealRefundEnabled: false }
  mocks.actionBarHeight = 160
  mocks.createSelectorQuery.mockImplementation(() => {
    const query = {
      select: vi.fn().mockReturnThis(),
      boundingClientRect: vi.fn().mockReturnThis(),
      exec: vi.fn((callback: (result: unknown[]) => void) => callback([{ height: mocks.actionBarHeight }])),
    }
    return query
  })
  mocks.registerWithPayment.mockResolvedValue({ paymentId: 'payment-1', wechatOrderId: 'order-1' })
  mocks.requestPayment.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('event-ticket-payment real page wiring', () => {
  it('does not leak the vip selector display-name fallback into an order missing product copy', async () => {
    const { container } = await renderCheckout()
    fireEvent.click(screen.getByText('plan-vip_monthly'))
    await screen.findByText('本次购买')

    const block = container.querySelector('.cost-breakdown')
    expect(block?.textContent).toContain('本次购买')
    expect(block?.textContent).not.toContain('悦聚月卡')
    expect(block?.querySelector('.cost-breakdown__hint--purchase')).toBeNull()
  })

  it.each([
    { plan: 'pack_3', paidLabel: '¥211', productCopy: '三连局包 · 3 场局名额' },
    { plan: 'pack_6', paidLabel: '¥370', productCopy: '六连局包 · 6 场局名额' },
    { plan: 'vip_monthly', paidLabel: '¥98', productCopy: null },
  ])('%s shares paidCents and uses 本次实付 without tonight total', async ({ plan, paidLabel, productCopy }) => {
    const { container } = await renderCheckout()
    fireEvent.click(screen.getByText(`plan-${plan}`))
    await screen.findByText('本次购买')

    const cardAmount = container.querySelector('.cost-breakdown__group .cost-breakdown__amount')
    const actionLabel = container.querySelector('.ticket-footer__price-label')
    const actionAmount = container.querySelector('.ticket-footer__price-value')
    expect(cardAmount?.textContent).toBe(paidLabel)
    expect(actionAmount?.textContent).toBe(paidLabel)
    expect(actionLabel?.textContent).toBe('本次实付')
    expect(container.querySelector('.cost-breakdown__total')).toBeNull()
    expect(container.querySelector('.cost-breakdown__divider')).toBeNull()
    if (productCopy) expect(screen.getByText(productCopy)).toBeInTheDocument()
  })

  it('tracks exactly one open and close with the same poolId', async () => {
    await renderCheckout()
    fireEvent.click(screen.getByText('费用怎么算 ›'))
    await screen.findByText('不包含在报名费里')

    const opens = mocks.track.mock.calls.filter((call) => call[0] === 'ticket_inclusion_sheet_open')
    expect(opens).toHaveLength(1)
    expect(opens[0]).toEqual(['ticket_inclusion_sheet_open', undefined, { poolId: 'pool-1' }])

    fireEvent.click(screen.getByText('×'))
    await waitFor(() => expect(screen.queryByText('不包含在报名费里')).not.toBeInTheDocument())
    const closes = mocks.track.mock.calls.filter((call) => call[0] === 'ticket_inclusion_sheet_close')
    expect(closes).toHaveLength(1)
    expect(closes[0]).toEqual(['ticket_inclusion_sheet_close', undefined, { poolId: 'pool-1' }])
  })

  it('state 1 — standard single renders the real derived total', async () => {
    const { container } = await renderCheckout()
    expect(screen.getByText(rangeText(168, 238))).toBeInTheDocument()
    expect(container.querySelectorAll('.cost-breakdown__divider')).toHaveLength(1)
  })

  it('state 2 — WELCOME20 uses the discounted actual payable', async () => {
    await renderCheckout({
      coupons: [{
        id: 'coupon-1',
        code: 'WELCOME20',
        discountType: 'fixed_amount',
        discountValue: 2000,
        isUsed: false,
        status: 'available',
      }],
    })
    await screen.findByText(rangeText(148, 218))
    expect(screen.getAllByText('¥68').length).toBeGreaterThanOrEqual(2)
  })

  it('state 4 — null minimum renders upper bounds through the page', async () => {
    await renderCheckout({ draft: { barBudgetRange: [DRINKS_BELOW_ID] } })
    expect(screen.getByText(upperText(80))).toBeInTheDocument()
    expect(screen.getByText(upperText(168))).toBeInTheDocument()
  })

  it('state 5 — dining multi-select aggregates real canonical tiers', async () => {
    await renderCheckout({
      eventType: '饭局',
      draft: { budgetRange: [DINING_LOWER_ID, DINING_UPPER_ID] },
    })
    expect(screen.getByText(rangeText(150, 300))).toBeInTheDocument()
    expect(screen.getByText(rangeText(238, 388))).toBeInTheDocument()
    expect(screen.getByText('现场餐食，同桌 AA')).toBeInTheDocument()
  })

  it('state 6 — a real zero-payable order shows plan inclusion and on-site-only total', async () => {
    await renderCheckout({ singlePriceCents: 0 })
    await screen.findByText('本场无需再付报名费')
    const block = document.querySelector('.cost-breakdown')
    expect(block?.textContent).toContain('已含在权益里')
    expect(block?.textContent).not.toContain('¥0')
    expect(block?.querySelector('.cost-breakdown__amount-value')?.textContent).toBe(rangeText(80, 150))
    expect(block?.querySelector('.cost-breakdown__total-amount-value')?.textContent).toBe(rangeText(80, 150))
  })

  it.each([
    { name: 'state 7 missing budget', draft: {} },
    { name: 'state 8 unmappable budget', draft: { barBudgetRange: [UNMAPPABLE_BLIND_BOX_BUDGET_LABEL] } },
  ])('$name fails closed on the real page', async ({ draft }) => {
    const { container } = await renderCheckout({ draft })
    expect(screen.getByText('现场 AA')).toBeInTheDocument()
    expect(screen.getByText('具体金额以门店菜单为准')).toBeInTheDocument()
    expect(screen.queryByText('今晚大约')).not.toBeInTheDocument()
    expect(container.querySelector('.cost-breakdown__divider')).toBeNull()
  })

  it('re-measures the reserve for refund two-line + cancel-note combination', async () => {
    const { container } = await renderCheckout({ refundEnabled: true })
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(2)
    const spacer = container.querySelector('.ticket-bottom-spacer')
    await waitFor(() => expect(spacer).toHaveStyle({ height: '160px' }))

    mocks.actionBarHeight = 224
    mocks.requestPayment.mockRejectedValue({ errMsg: 'requestPayment:fail cancel' })
    fireEvent.click(screen.getByText('确认订座'))
    await screen.findByText('你的选择已保存，随时回来继续')
    await waitFor(() => expect(spacer).toHaveStyle({ height: '224px' }))
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(2)
  })

  it('covers payment error + retry with refund rows and updates the reserve', async () => {
    const { container } = await renderCheckout({ refundEnabled: true })
    mocks.actionBarHeight = 256
    mocks.requestPayment.mockRejectedValue({ errMsg: 'requestPayment:fail network' })
    fireEvent.click(screen.getByText('确认订座'))

    await screen.findByText('重试支付')
    expect(screen.getByText('支付未成功，请重试')).toBeInTheDocument()
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(2)
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '256px' }))

    mocks.actionBarHeight = 160
    fireEvent.click(screen.getByText('重试支付'))
    await screen.findByText('确认订座')
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '160px' }))
  })

  it('re-measures refund-off + cancel-note without introducing a guarantee row', async () => {
    const { container } = await renderCheckout({ refundEnabled: false })
    mocks.actionBarHeight = 192
    mocks.requestPayment.mockRejectedValue({ errMsg: 'requestPayment:fail cancel' })
    fireEvent.click(screen.getByText('确认订座'))

    await screen.findByText('你的选择已保存，随时回来继续')
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '192px' }))
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(0)
  })

  it('re-measures refund-off + payment error/retry without introducing a guarantee row', async () => {
    const { container } = await renderCheckout({ refundEnabled: false })
    mocks.actionBarHeight = 208
    mocks.requestPayment.mockRejectedValue({ errMsg: 'requestPayment:fail network' })
    fireEvent.click(screen.getByText('确认订座'))

    await screen.findByText('重试支付')
    expect(screen.getByText('支付未成功，请重试')).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '208px' }))
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(0)

    mocks.actionBarHeight = 160
    fireEvent.click(screen.getByText('重试支付'))
    await screen.findByText('确认订座')
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '160px' }))
  })

  it('keeps the refund-off baseline free of guarantee rows', async () => {
    const { container } = await renderCheckout({ refundEnabled: false })
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(0)
    await waitFor(() => expect(container.querySelector('.ticket-bottom-spacer')).toHaveStyle({ height: '160px' }))
  })
})
