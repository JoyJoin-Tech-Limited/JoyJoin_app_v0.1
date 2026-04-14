import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_PAGE_PATHS } from './onboardingRoutes'
import {
  buildPendingOrderContext,
  decidePendingOrderAutoResume,
  MINI_PROGRAM_PENDING_ORDER_MAX_AGE_MS,
  resolvePendingOrder,
} from './paymentPendingOrder'

const NOW = 1_710_000_000_000

function createPendingOrderContext(
  overrides: Partial<ReturnType<typeof buildPendingOrderContext>> = {},
) {
  return buildPendingOrderContext(
    {
      orderId: 'order-123',
      type: 'event_bundle',
      userId: 'user-123',
      createdAt: NOW,
      ...overrides,
    },
    NOW,
  )
}

describe('mini-program pending-order recovery', () => {
  it('waits for auth resolution before attempting auto-resume', () => {
    expect(
      decidePendingOrderAutoResume({
        authResolved: false,
        isAuthenticated: false,
        currentRoute: MINI_PROGRAM_PAGE_PATHS.discover,
        currentUserId: 'user-123',
        orderId: 'order-123',
        context: createPendingOrderContext(),
        now: NOW,
      }),
    ).toEqual({
      action: 'wait',
      reason: 'auth-pending',
    })
  })

  // Guards against regression: foreground app resume should only reopen
  // verification for a fresh order owned by the authenticated user.
  it('resumes a fresh same-user order outside the payment flow', () => {
    expect(
      decidePendingOrderAutoResume({
        authResolved: true,
        isAuthenticated: true,
        currentRoute: MINI_PROGRAM_PAGE_PATHS.discover,
        currentUserId: 'user-123',
        orderId: 'order-123',
        context: createPendingOrderContext(),
        now: NOW,
      }),
    ).toMatchObject({
      action: 'resume',
      orderId: 'order-123',
    })
  })

  it('suppresses auto-resume after the user explicitly leaves verification', () => {
    const context = createPendingOrderContext({ manualLeave: true })

    expect(
      resolvePendingOrder({
        orderId: 'order-123',
        context,
        currentUserId: 'user-123',
        now: NOW,
      }),
    ).toMatchObject({
      status: 'ready',
      orderId: 'order-123',
      context,
    })

    expect(
      decidePendingOrderAutoResume({
        authResolved: true,
        isAuthenticated: true,
        currentRoute: MINI_PROGRAM_PAGE_PATHS.discover,
        currentUserId: 'user-123',
        orderId: 'order-123',
        context,
        now: NOW,
      }),
    ).toEqual({
      action: 'wait',
      reason: 'manual-leave',
    })
  })

  it('skips auto-resume while already inside the payment flow', () => {
    expect(
      decidePendingOrderAutoResume({
        authResolved: true,
        isAuthenticated: true,
        currentRoute: MINI_PROGRAM_PAGE_PATHS.paymentVerification,
        currentUserId: 'user-123',
        orderId: 'order-123',
        context: createPendingOrderContext(),
        now: NOW,
      }),
    ).toEqual({
      action: 'wait',
      reason: 'payment-flow-route',
    })
  })

  it('clears stale order state once the resume window expires', () => {
    expect(
      resolvePendingOrder({
        orderId: 'order-123',
        context: createPendingOrderContext({
          createdAt: NOW - MINI_PROGRAM_PENDING_ORDER_MAX_AGE_MS - 1,
        }),
        currentUserId: 'user-123',
        now: NOW,
      }),
    ).toEqual({
      status: 'clear',
      reason: 'expired',
    })
  })

  it('clears another user\'s pending order instead of resuming it', () => {
    expect(
      resolvePendingOrder({
        orderId: 'order-123',
        context: createPendingOrderContext({ userId: 'user-999' }),
        currentUserId: 'user-123',
        now: NOW,
      }),
    ).toEqual({
      status: 'clear',
      reason: 'wrong-user',
    })
  })

  // Guards against regression: authenticated resume must fail closed when the
  // stored pending order was never bound to a specific user.
  it('clears a user-unbound pending order for an authenticated resume', () => {
    expect(
      resolvePendingOrder({
        orderId: 'order-123',
        context: createPendingOrderContext({ userId: null }),
        currentUserId: 'user-123',
        now: NOW,
      }),
    ).toEqual({
      status: 'clear',
      reason: 'wrong-user',
    })
  })

  it('treats legacy context without createdAt as invalid and clearable', () => {
    expect(
      resolvePendingOrder({
        orderId: 'order-123',
        context: {
          orderId: 'order-123',
          type: 'event_bundle',
        },
        currentUserId: 'user-123',
        now: NOW,
      }),
    ).toEqual({
      status: 'clear',
      reason: 'invalid-context',
    })
  })
})
