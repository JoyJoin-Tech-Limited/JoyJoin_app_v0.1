import { describe, expect, it } from 'vitest'
import {
  getMiniProgramCenterState,
  mapCenterDestinationToMiniProgramAction,
} from './centerTabRouting'

describe('mini-program center tab routing — hub page architecture', () => {
  it('defaults to discover-state copy and hub destination when no data is loaded yet', () => {
    expect(getMiniProgramCenterState(undefined, undefined)).toEqual({
      label: '去参与',
      showBadge: false,
      action: {
        kind: 'discover',
        navigation: 'switchTab',
        url: '/pages/center-hub/index',
      },
    })
  })

  it('always routes to the center hub page via switchTab regardless of destination', () => {
    expect(mapCenterDestinationToMiniProgramAction({ kind: 'empty' })).toEqual({
      kind: 'empty',
      navigation: 'switchTab',
      url: '/pages/center-hub/index',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-event', eventId: 'event-123' })).toEqual({
      kind: 'matched-event',
      navigation: 'switchTab',
      url: '/pages/center-hub/index',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-pool-unlocked', groupId: 'group-123' })).toEqual({
      kind: 'matched-pool-unlocked',
      navigation: 'switchTab',
      url: '/pages/center-hub/index',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'pending-registration', registrationId: 'registration-123' })).toEqual({
      kind: 'pending-registration',
      navigation: 'switchTab',
      url: '/pages/center-hub/index',
    })

    expect(mapCenterDestinationToMiniProgramAction({ kind: 'matched-pool-future', groupId: 'group-456' })).toEqual({
      kind: 'matched-pool-future',
      navigation: 'switchTab',
      url: '/pages/center-hub/index',
    })
  })

  it('treats explicit empty activity arrays as the discover empty state', () => {
    expect(getMiniProgramCenterState([], [])).toEqual({
      label: '去发现',
      showBadge: false,
      action: {
        kind: 'empty',
        navigation: 'switchTab',
        url: '/pages/center-hub/index',
      },
    })
  })

  it('keeps matched registrations without assigned groups in the matching flow', () => {
    expect(getMiniProgramCenterState([
      {
        id: 'registration-awaiting-group',
        matchStatus: 'matched',
        assignedGroupId: null,
        poolDateTime: '2026-07-29T11:32:00.000Z',
      },
    ], [], new Date('2026-06-25T12:00:00.000Z'))).toEqual({
      label: '排桌中…',
      showBadge: true,
      action: {
        kind: 'pending-registration',
        navigation: 'switchTab',
        url: '/pages/center-hub/index',
      },
    })
  })
})
