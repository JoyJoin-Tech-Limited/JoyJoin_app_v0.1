import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAcknowledgmentAssignmentStorageKey,
  buildAcknowledgmentViewStorageKey,
  claimAcknowledgmentBeatExposure,
} from '../viewModels/acknowledgmentBeatExposureStore'

const taroRuntime = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  return {
    store,
    getStorageSync: vi.fn((key: string) => store.get(key) ?? ''),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      store.set(key, value)
    }),
  }
})

vi.mock('@tarojs/taro', () => ({ default: taroRuntime }))

describe('acknowledgment beat exposure store', () => {
  beforeEach(() => {
    taroRuntime.store.clear()
    vi.clearAllMocks()
  })

  it('does not repeat assignment after a component remount', () => {
    const key = buildAcknowledgmentAssignmentStorageKey('group-1')
    expect(claimAcknowledgmentBeatExposure(key)).toBe(true)
    // A fresh component instance sees the same persisted claim.
    expect(claimAcknowledgmentBeatExposure(key)).toBe(false)
    expect(buildAcknowledgmentAssignmentStorageKey('group-2')).not.toBe(key)
  })

  it('dedupes a topic across remounts but allows new topics and revisions', () => {
    const first = buildAcknowledgmentViewStorageKey('group-1', 1, 'topic-a')
    expect(claimAcknowledgmentBeatExposure(first)).toBe(true)
    expect(claimAcknowledgmentBeatExposure(first)).toBe(false)
    expect(claimAcknowledgmentBeatExposure(
      buildAcknowledgmentViewStorageKey('group-1', 1, 'topic-b'),
    )).toBe(true)
    expect(claimAcknowledgmentBeatExposure(
      buildAcknowledgmentViewStorageKey('group-1', 2, 'topic-a'),
    )).toBe(true)
  })

  it('fails open when storage is unavailable', () => {
    taroRuntime.getStorageSync.mockImplementationOnce(() => {
      throw new Error('storage disabled')
    })
    expect(claimAcknowledgmentBeatExposure('any-key')).toBe(true)
  })
})
