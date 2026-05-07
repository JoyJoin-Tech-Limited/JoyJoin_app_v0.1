import { describe, expect, it } from 'vitest'
import { isMiniProgramUserScopedQueryKey } from './authSessionQueryKeys'

describe('mini-program auth session query key rules', () => {
  // Guards against regression: guest Discover must not keep the authenticated
  // coupons summary after a public-route auth loss.
  it('treats coupons as user-scoped while keeping pricing shared', () => {
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'coupons'])).toBe(true)
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'pricing'])).toBe(false)
  })

  it('matches parameterized user-scoped queries without clearing pool data', () => {
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'gamification-history', 20])).toBe(true)
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'pool-registration', 'reg-1'])).toBe(true)
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'event-pools'])).toBe(false)
    expect(isMiniProgramUserScopedQueryKey(['mini-program', 'event-pool', 'pool-1'])).toBe(false)
  })
})
