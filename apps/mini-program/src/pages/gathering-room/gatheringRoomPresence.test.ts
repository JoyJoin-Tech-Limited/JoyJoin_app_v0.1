import { describe, expect, it } from 'vitest'

import { resolveGatheringRoomPresence } from './gatheringRoomPresence'

describe('gathering room presence precedence', () => {
  it('keeps confirmed and late members seated while offline', () => {
    expect(resolveGatheringRoomPresence('confirmed', false)).toBe('confirmed')
    expect(resolveGatheringRoomPresence('late', false)).toBe('confirmed')
  })

  it('keeps confirmed members seated while online', () => {
    expect(resolveGatheringRoomPresence('confirmed', true)).toBe('confirmed')
  })

  it('uses live presence only for members without durable attendance', () => {
    expect(resolveGatheringRoomPresence('pending', true)).toBe('present')
    expect(resolveGatheringRoomPresence('pending', false)).toBe('absent')
  })
})
