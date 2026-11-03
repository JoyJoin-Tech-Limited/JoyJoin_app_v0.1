import type { SocialSessionState } from '@shared/socialIcebreaker'

type RefetchResult = {
  error?: unknown
  isError?: boolean
}

type SocialActionSyncOptions = {
  applyState: (state: SocialSessionState) => void
  refetch: () => Promise<RefetchResult>
  onSyncError: (error: unknown) => void
}

function getResponseState(response: unknown): SocialSessionState | null {
  if (!response || typeof response !== 'object' || !('state' in response)) {
    return null
  }

  const state = (response as { state?: unknown }).state
  if (
    !state ||
    typeof state !== 'object' ||
    typeof (state as { socialSessionId?: unknown }).socialSessionId !== 'string' ||
    typeof (state as { currentPhase?: unknown }).currentPhase !== 'string'
  ) {
    return null
  }

  return state as SocialSessionState
}

function reportRefetchFailure(result: RefetchResult, onSyncError: (error: unknown) => void): void {
  if (result.isError || result.error) {
    onSyncError(result.error ?? new Error('Social session refresh failed'))
  }
}

/**
 * Applies the authoritative state carried by a successful mutation immediately.
 * The follow-up poll is then only reconciliation: it must never make the original
 * user action look failed or keep its button waiting on a second network request.
 */
export async function syncSocialActionResponse(
  response: unknown,
  { applyState, refetch, onSyncError }: SocialActionSyncOptions,
): Promise<void> {
  const responseState = getResponseState(response)

  if (responseState) {
    try {
      applyState(responseState)
    } catch (error) {
      onSyncError(error)
    }

    void refetch()
      .then((result) => reportRefetchFailure(result, onSyncError))
      .catch(onSyncError)
    return
  }

  try {
    reportRefetchFailure(await refetch(), onSyncError)
  } catch (error) {
    onSyncError(error)
  }
}

type ApiErrorLike = {
  statusCode?: unknown
  data?: unknown
}

/**
 * Host advance is a CAS on the current phase; the loser of a same-host
 * double-tap (two devices, or a stalled retry) gets 409 `PHASE_CONFLICT`.
 * That is not "your tap failed" — the table did move — so it must not be
 * surfaced as an error toast.
 */
export function isPhaseConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const { statusCode, data } = error as ApiErrorLike
  if (statusCode !== 409 || !data || typeof data !== 'object') {
    return false
  }

  return (data as { code?: unknown }).code === 'PHASE_CONFLICT'
}

/**
 * Adopts the authoritative state carried by a `PHASE_CONFLICT` 409 (the
 * server re-reads the session for exactly this purpose), then reconciles with
 * the poll. Returns false for every other error so callers keep their existing
 * failure path untouched.
 */
export async function syncPhaseConflictResponse(
  error: unknown,
  options: SocialActionSyncOptions,
): Promise<boolean> {
  if (!isPhaseConflictError(error)) {
    return false
  }

  const conflictState = getResponseState((error as ApiErrorLike).data)
  await syncSocialActionResponse(
    conflictState ? { state: conflictState } : {},
    options,
  )
  return true
}

