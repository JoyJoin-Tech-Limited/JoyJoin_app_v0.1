import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ICEBREAKER_DRAFT_DEBOUNCE_MS,
  buildIcebreakerDraftKey,
  clearIcebreakerDraft,
  readIcebreakerDraft,
  writeIcebreakerDraft,
} from '../viewModels/draftPersistence'

// P0 E1 (2026-10-20): draft persistence primitives — write / read / clear /
// per-key isolation, all fail-safe against a dead or full store.
const taroRuntime = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    store,
    getStorageSync: vi.fn((key: string) => store.get(key) ?? ''),
    setStorageSync: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeStorageSync: vi.fn((key: string) => {
      store.delete(key)
    }),
  }
})

vi.mock('@tarojs/taro', () => ({
  default: taroRuntime,
}))

describe('draftPersistence (P0 E1)', () => {
  beforeEach(() => {
    taroRuntime.store.clear()
    vi.clearAllMocks()
  })

  it('builds the spec key shape jj_draft_${sessionId}_${phase}_${userId}', () => {
    expect(buildIcebreakerDraftKey('s1', 'quip_battle', 'u9')).toBe('jj_draft_s1_quip_battle_u9')
  })

  it('debounce constant stays within the ≤500ms spec', () => {
    expect(ICEBREAKER_DRAFT_DEBOUNCE_MS).toBeLessThanOrEqual(500)
    expect(ICEBREAKER_DRAFT_DEBOUNCE_MS).toBeGreaterThan(0)
  })

  it('writes then reads back the exact payload', () => {
    const key = buildIcebreakerDraftKey('s1', 'quip_battle', 'u9')
    writeIcebreakerDraft(key, '{"p1":"神回复"}')
    expect(readIcebreakerDraft(key)).toBe('{"p1":"神回复"}')
  })

  it('clears a stored draft; clear is idempotent on a missing key', () => {
    const key = buildIcebreakerDraftKey('s1', 'undercover_word', 'u9')
    writeIcebreakerDraft(key, '圆的，甜的')
    clearIcebreakerDraft(key)
    expect(readIcebreakerDraft(key)).toBeNull()
    expect(() => clearIcebreakerDraft(key)).not.toThrow()
  })

  it('isolates drafts by session / phase / user', () => {
    writeIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u9'), 'A')
    writeIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u2'), 'B')
    writeIcebreakerDraft(buildIcebreakerDraftKey('s1', 'undercover_word', 'u9'), 'C')
    writeIcebreakerDraft(buildIcebreakerDraftKey('s2', 'quip_battle', 'u9'), 'D')

    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u9'))).toBe('A')
    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u2'))).toBe('B')
    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s1', 'undercover_word', 'u9'))).toBe('C')
    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s2', 'quip_battle', 'u9'))).toBe('D')

    clearIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u9'))
    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s1', 'quip_battle', 'u2'))).toBe('B')
    expect(readIcebreakerDraft(buildIcebreakerDraftKey('s1', 'undercover_word', 'u9'))).toBe('C')
  })

  it('reads null for empty / missing values', () => {
    expect(readIcebreakerDraft('jj_draft_nope_nope_nope')).toBeNull()
  })

  it('never throws when the storage bridge is down', () => {
    taroRuntime.getStorageSync.mockImplementationOnce(() => {
      throw new Error('bridge down')
    })
    taroRuntime.setStorageSync.mockImplementationOnce(() => {
      throw new Error('store full')
    })
    taroRuntime.removeStorageSync.mockImplementationOnce(() => {
      throw new Error('bridge down')
    })

    expect(readIcebreakerDraft('k')).toBeNull()
    expect(() => writeIcebreakerDraft('k', 'v')).not.toThrow()
    expect(() => clearIcebreakerDraft('k')).not.toThrow()
  })
})
