import { describe, expect, it, vi } from 'vitest'
import type { DiscoverShellResponse, EventPoolSummary } from '@shared/api'
import { loadDiscoverPools } from './discoverPools'

const pool = { id: 'pool-1', title: '周五酒局' } as EventPoolSummary

function shellWith(items: EventPoolSummary[]): DiscoverShellResponse {
  return {
    user: { nextStep: 'discover', primaryArchetype: null },
    pools: { items: items as DiscoverShellResponse['pools']['items'], hasMore: false },
    myRegistrations: { ids: [], statuses: {} },
    meta: { cacheKey: 'test', serverTime: new Date().toISOString() },
  }
}

describe('loadDiscoverPools', () => {
  it('returns shell pools without calling the legacy endpoint', async () => {
    const fetchLegacyPools = vi.fn()

    const result = await loadDiscoverPools({
      fetchShell: vi.fn().mockResolvedValue(shellWith([pool])),
      fetchLegacyPools,
      onShellLoaded: vi.fn(),
    })

    expect(result).toEqual([pool])
    expect(fetchLegacyPools).not.toHaveBeenCalled()
  })

  it('checks the canonical endpoint when the shell returns an empty list', async () => {
    const result = await loadDiscoverPools({
      fetchShell: vi.fn().mockResolvedValue(shellWith([])),
      fetchLegacyPools: vi.fn().mockResolvedValue([pool]),
      onShellLoaded: vi.fn(),
    })

    expect(result).toEqual([pool])
  })

  it('falls back to the canonical endpoint when the shell fails', async () => {
    const result = await loadDiscoverPools({
      fetchShell: vi.fn().mockRejectedValue(new Error('shell unavailable')),
      fetchLegacyPools: vi.fn().mockResolvedValue([pool]),
      onShellLoaded: vi.fn(),
    })

    expect(result).toEqual([pool])
  })
})
