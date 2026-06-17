import type { QueryKey } from '@tanstack/react-query'

export const MINI_PROGRAM_USER_SCOPED_QUERY_KEY_PREFIXES = [
  ['mini-program', 'auth-user'],
  ['mini-program', 'coupons'],
  ['mini-program', 'gamification'],
  ['mini-program', 'gamification-history'],
  ['mini-program', 'notification-counts'],
  ['mini-program', 'my-pool-registrations'],
  ['mini-program', 'my-blind-box-events'],
  ['mini-program', 'joined-events'],
  ['mini-program', 'connections'],
  ['mini-program', 'shell/discover'],
  ['mini-program', 'shell/events'],
  ['mini-program', 'shell/profile'],
  ['mini-program', 'shell/connections'],
  ['mini-program', 'referral-stats'],
  ['mini-program', 'pool-registration'],
] as const

function doesQueryKeyStartWith(queryKey: QueryKey, prefix: readonly unknown[]): boolean {
  if (queryKey.length < prefix.length) {
    return false
  }

  return prefix.every((segment, index) => queryKey[index] === segment)
}

export function isMiniProgramUserScopedQueryKey(queryKey: QueryKey): boolean {
  return MINI_PROGRAM_USER_SCOPED_QUERY_KEY_PREFIXES.some((prefix) =>
    doesQueryKeyStartWith(queryKey, prefix)
  )
}
