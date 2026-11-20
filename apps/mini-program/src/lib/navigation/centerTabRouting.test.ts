import { describe, expect, it } from 'vitest'
import type { CenterTabDestination } from '@joyjoin/shared/centerTabRouting'
import {
  getMiniProgramCenterState,
  mapCenterDestinationToMiniProgramAction,
} from './centerTabRouting'

const HUB = '/pages/center-hub/index'
const DISCOVER = '/pages/discover/index'
const EVENT_DETAIL = '/pages/event-detail/index'
const POOL_GROUP_DETAIL = '/pages/pool-group-detail/index'

/**
 * The center CTA used to discard the destination that `resolveCenterTabDestination`
 * had just computed and always switchTab to the hub — which duplicates 足迹, so
 * "where is my event" had two answers and neither became reflex. These tests lock
 * the contextual contract: a resolved destination is rendered faithfully, and the
 * hub is only reached when there is genuinely nothing more specific to open.
 */
describe('mini-program center tab routing — contextual destination', () => {
  it('defaults to discover-state copy and the discover feed when no data is loaded yet', () => {
    expect(getMiniProgramCenterState(undefined, undefined)).toEqual({
      label: '去参与',
      showBadge: false,
      action: {
        kind: 'discover',
        navigation: 'switchTab',
        url: DISCOVER,
      },
    })
  })

  it.each<[CenterTabDestination, 'switchTab' | 'navigateTo', string]>([
    [{ kind: 'discover' }, 'switchTab', DISCOVER],
    [{ kind: 'empty' }, 'switchTab', DISCOVER],
    [
      { kind: 'matched-event', eventId: 'event-123' },
      'navigateTo',
      `${EVENT_DETAIL}?id=event-123`,
    ],
    [
      { kind: 'matched-pool-unlocked', groupId: 'group-123' },
      'navigateTo',
      `${POOL_GROUP_DETAIL}?id=group-123`,
    ],
    [
      { kind: 'matched-pool-future', groupId: 'group-456' },
      'navigateTo',
      `${POOL_GROUP_DETAIL}?id=group-456`,
    ],
    // 排桌中 has no verified deep-link parameter contract, so it stays on the
    // hub: a broken destination is worse than a hub that renders 排桌中 honestly.
    [{ kind: 'pending-registration', registrationId: 'registration-123' }, 'switchTab', HUB],
  ])('maps %o to %s %s', (destination, navigation, url) => {
    expect(mapCenterDestinationToMiniProgramAction(destination)).toEqual({
      kind: destination.kind,
      navigation,
      url,
    })
  })

  it('treats explicit empty activity arrays as the discover empty state', () => {
    expect(getMiniProgramCenterState([], [])).toEqual({
      label: '去发现',
      showBadge: false,
      action: {
        kind: 'empty',
        navigation: 'switchTab',
        url: DISCOVER,
      },
    })
  })

  it('keeps matched registrations without assigned groups in the matching flow', () => {
    expect(
      getMiniProgramCenterState(
        [
          {
            id: 'registration-awaiting-group',
            matchStatus: 'matched',
            assignedGroupId: null,
            poolDateTime: '2026-07-29T11:32:00.000Z',
          },
        ],
        [],
        new Date('2026-06-25T12:00:00.000Z')
      )
    ).toEqual({
      label: '排桌中…',
      showBadge: true,
      action: {
        kind: 'pending-registration',
        navigation: 'switchTab',
        url: HUB,
      },
    })
  })
})
