import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient } from '@tanstack/react-query'
import {
  nextPollInterval,
  baselinePollCount,
  countIdlePolls,
  idlePollReduction,
  useIdlePollBackoff,
  IDLE_POLL_BASE_MS,
  IDLE_POLL_MAX_MS,
} from '../hooks/useIdlePollBackoff'

describe('W9 AC-W9.5 — idle poll backoff', () => {
  it('ramps 3s → 6s → 12s and caps', () => {
    expect(IDLE_POLL_BASE_MS).toBe(3000)
    expect(nextPollInterval(0)).toBe(3000)
    expect(nextPollInterval(2)).toBe(3000)
    expect(nextPollInterval(3)).toBe(6000)
    expect(nextPollInterval(5)).toBe(6000)
    expect(nextPollInterval(6)).toBe(12_000)
    expect(nextPollInterval(999)).toBe(IDLE_POLL_MAX_MS)
    // Defensive: invalid input degrades to the base interval.
    expect(nextPollInterval(Number.NaN)).toBe(3000)
    expect(nextPollInterval(-5)).toBe(3000)
  })

  it('cuts idle polls by ≥50% over a 60s unchanged window', () => {
    expect(baselinePollCount(60_000)).toBe(21)
    expect(countIdlePolls(60_000)).toBe(9)
    expect(idlePollReduction(60_000)).toBeGreaterThanOrEqual(0.5)
  })

  it('approaches the 75% steady-state reduction on a long idle window', () => {
    // 5 min idle: 101 baseline polls → well under 35 backed-off polls.
    expect(idlePollReduction(5 * 60_000)).toBeGreaterThanOrEqual(0.65)
  })

  it('pauses while disabled', () => {
    const { result } = renderHook(() => useIdlePollBackoff(false))
    expect(result.current.intervalFor({ state: { data: undefined } })).toBe(false)
  })

  it('backs off on repeated identical data and resets on change', () => {
    const { result } = renderHook(() => useIdlePollBackoff(true))
    const stable = { v: 1 }
    const query = { state: { data: stable } }

    // 1st sight → base; then unchanged increments only from the 2nd call.
    expect(result.current.intervalFor(query)).toBe(3000)
    expect(result.current.intervalFor(query)).toBe(3000) // unchanged 1
    expect(result.current.intervalFor(query)).toBe(3000) // unchanged 2
    expect(result.current.intervalFor(query)).toBe(6000) // unchanged 3

    // A new data reference (structural sharing breaks) resets to base.
    expect(result.current.intervalFor({ state: { data: { v: 2 } } })).toBe(3000)
  })

  it('reset() returns to the base interval', () => {
    const { result } = renderHook(() => useIdlePollBackoff(true))
    const query = { state: { data: { v: 1 } } }
    result.current.intervalFor(query)
    result.current.intervalFor(query)
    result.current.intervalFor(query)
    result.current.intervalFor(query) // now at 6s
    result.current.reset()
    expect(result.current.intervalFor(query)).toBe(3000)
  })
})

describe('perf-W3 — poll failures hold the base cadence', () => {
  it('does not back off while the query is in error', () => {
    const { result } = renderHook(() => useIdlePollBackoff(true))
    const stable = { v: 1 }
    const errorQuery = { state: { data: stable, status: 'error' } }
    for (let i = 0; i < 8; i += 1) {
      expect(result.current.intervalFor(errorQuery)).toBe(IDLE_POLL_BASE_MS)
    }
  })

  it('recovers at the base interval instead of the pre-outage cap', () => {
    const { result } = renderHook(() => useIdlePollBackoff(true))
    const stable = { v: 1 }
    const okQuery = { state: { data: stable, status: 'success' } }
    // Drive the backoff to the 12s cap first.
    expect(result.current.intervalFor(okQuery)).toBe(3000)
    for (let i = 0; i < 6; i += 1) result.current.intervalFor(okQuery)
    expect(result.current.intervalFor(okQuery)).toBe(IDLE_POLL_MAX_MS)

    // An outage must clear the unchanged streak…
    result.current.intervalFor({ state: { data: stable, status: 'error' } })
    // …so the first successful poll after recovery is prompt, not capped.
    expect(result.current.intervalFor(okQuery)).toBe(IDLE_POLL_BASE_MS)
  })
})

describe('perf-W5 — idle payload reference stability', () => {
  it('structurally-shared payloads keep their reference and back off', () => {
    // Volatile server fields (lastSeenAt / expiresAt) are intentionally absent —
    // the parallel backend task omits them so TanStack structural sharing holds
    // the reference across polls. This test locks the client contract.
    const client = new QueryClient()
    const key = ['mini-program', 'social-icebreaker-session', 'social_w9']
    const payload = {
      socialSessionId: 'social_w9',
      icebreakerSessionId: 'ib_w9',
      currentPhase: 'micro_challenge',
      hostUserId: 'host',
      playerCount: 4,
      completedPhases: ['warmup'],
    }

    client.setQueryData(key, payload)
    const firstRef = client.getQueryData(key)
    // A fresh, deeply-equal payload (as a new poll would parse) — structural
    // sharing must hand back the previous reference.
    client.setQueryData(key, JSON.parse(JSON.stringify(payload)))
    const secondRef = client.getQueryData(key)
    expect(secondRef).toBe(firstRef)

    const { result } = renderHook(() => useIdlePollBackoff(true))
    const query = { state: { data: secondRef, status: 'success' } }
    expect(result.current.intervalFor(query)).toBe(3000)
    expect(result.current.intervalFor(query)).toBe(3000)
    expect(result.current.intervalFor(query)).toBe(3000)
    expect(result.current.intervalFor(query)).toBe(6000)
  })
})

describe('G1 — idle backoff resets on activity, not only on re-show', () => {
  const source = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')

  const sliceBetween = (start: string, end: string): string => {
    const from = source.indexOf(start)
    const to = source.indexOf(end, from + start.length)
    expect(from).toBeGreaterThanOrEqual(0)
    expect(to).toBeGreaterThan(from)
    return source.slice(from, to)
  }

  it('resets inside the SOCIAL_GROUP_BEAT handler', () => {
    const handler = sliceBetween('const handleGroupBeat = useCallback(', 'useWebSocket({')
    expect(handler).toContain('resetIdlePoll()')
    expect(handler).toContain('resetIdlePoll]')
  })

  it('resets when a pending action settles (true → false)', () => {
    const effect = sliceBetween(
      'const { intervalFor: pollIntervalFor',
      'useKeepScreenOn(',
    )
    expect(effect).toContain('prevPendingActionRef.current !== null')
    expect(effect).toContain('pendingAction === null')
    expect(effect).toContain('resetIdlePoll()')
  })
})
