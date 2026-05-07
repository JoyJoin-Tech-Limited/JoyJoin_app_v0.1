import { describe, expect, it } from 'vitest'
import {
  getMiniProgramCenterState,
  mapCenterDestinationToMiniProgramAction,
  MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE,
  MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE,
} from './centerTabRouting'

describe('mini-program center tab routing parity', () => {
  it('defaults to discover-state copy and destination when no data is loaded yet', () => {
    expect(getMiniProgramCenterState(undefined, undefined)).toEqual({
      label: '去参与',
      showBadge: false,
      action: {
        kind: 'discover',
        navigation: 'switchTab',
        url: '/pages/discover/index',
      },
    })
  })

  it('maps empty state to the dedicated center-tab empty page', () => {
    expect(mapCenterDestinationToMiniProgramAction({ kind: 'empty' })).toEqual({
      kind: 'empty',
      navigation: 'navigateTo',
      url: MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE,
    })
  })

  it('treats explicit empty activity arrays as the discover empty state', () => {
    // Guards against regression: unauthenticated discover must pass explicit
    // empty activity arrays so the center CTA stays on the discover empty copy.
    expect(getMiniProgramCenterState([], [])).toEqual({
      label: '去发现',
      showBadge: false,
      action: {
        kind: 'empty',
        navigation: 'navigateTo',
        url: MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE,
      },
    })
  })

  it('maps active states to the same intent as the user-client shared logic', () => {
    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-event', eventId: 'event-123' })).toEqual({
      kind: 'matched-event',
      navigation: 'navigateTo',
      url: '/pages/event-detail/index?id=event-123',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-pool-unlocked', groupId: 'group-123' })).toEqual({
      kind: 'matched-pool-unlocked',
      navigation: 'navigateTo',
      url: `${MINI_PROGRAM_POOL_GROUP_DETAIL_ROUTE}?groupId=group-123`,
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'pending-registration', registrationId: 'registration-123' })).toEqual({
      kind: 'pending-registration',
      navigation: 'navigateTo',
      url: '/pages/matching-status/index?registrationId=registration-123',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-pool-future', groupId: 'group-456' })).toEqual({
      kind: 'matched-pool-future',
      navigation: 'navigateTo',
      url: '/pages/squad-unboxing/index?groupId=group-456',
    })
  })
})
