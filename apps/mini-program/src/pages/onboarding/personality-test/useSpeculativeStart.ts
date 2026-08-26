import { useCallback, useEffect, useRef } from 'react'
import { apiRequest } from '../../../lib/api/api'
import { logInfo, logWarn } from '../../../lib/utils/logger'
import type { AssessmentStartResponse } from './types'

export interface SpeculativeStartState {
  status: 'idle' | 'pending' | 'ready' | 'failed'
  promise?: Promise<AssessmentStartResponse>
  payload?: AssessmentStartResponse
  sessionId?: string
  requestId?: number
}

/**
 * Speculative /api/assessment/v4/start prefire (PR-3).
 *
 * The intro phase is a forced-dwell surface, so we fire the start request
 * fire-and-forget while the user reads it. `handleStart` then adopts the
 * ready payload, awaits the in-flight promise, or falls back to today's POST.
 *
 * Server idempotency makes this safe: logged-in users resume their existing
 * incomplete session; guests get one new session here and `handleStart`
 * reuses it by passing the prefired `sessionId` in the body (the server's
 * resume-by-sessionId path) instead of double-creating.
 *
 * Never prefire when a resumable anonymous session exists (resume returns
 * instantly anyway) — the caller gates that via `hasStoredIncompleteSession`.
 */
export function useSpeculativeStart() {
  const speculativeStartRef = useRef<SpeculativeStartState>({ status: 'idle' })
  const requestSeqRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fireSpeculativeStart = useCallback((canUseResult: () => boolean) => {
    const current = speculativeStartRef.current
    if (current.status === 'pending' || current.status === 'ready') return

    const requestId = ++requestSeqRef.current
    const promise = apiRequest<AssessmentStartResponse>({
      path: '/api/assessment/v4/start',
      method: 'POST',
      data: {},
    })
    speculativeStartRef.current = { status: 'pending', promise, requestId }

    promise
      .then((payload) => {
        if (!mountedRef.current) return
        // A newer prefire or a consume-and-reset from handleStart supersedes
        // this resolution — never resurrect a stale ready payload.
        if (speculativeStartRef.current.requestId !== requestId) return
        // Phase already advanced or a session was established another way:
        // keep the sessionId for guest reuse but do not surface the payload.
        if (!canUseResult()) {
          speculativeStartRef.current = {
            status: 'failed',
            sessionId: payload.sessionId,
            requestId,
          }
          return
        }
        speculativeStartRef.current = {
          status: 'ready',
          payload,
          sessionId: payload.sessionId,
          requestId,
        }
        logInfo('[PersonalityTest] Speculative /start prefired', {
          sessionId: payload.sessionId,
        })
      })
      .catch((err: unknown) => {
        if (speculativeStartRef.current.requestId !== requestId) return
        // Silent and cheap by design — handleStart falls back to today's POST.
        speculativeStartRef.current = { status: 'failed', requestId }
        logWarn('[PersonalityTest] Speculative /start prefire failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }, [])

  return { speculativeStartRef, fireSpeculativeStart }
}
