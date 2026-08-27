/**
 * Guidance queue API helpers (C4 onboarding guidance iteration, 2026-08-27).
 *
 * `markGuidanceSeen` persists a tip's seen-state server-side via
 * `POST /api/guidance/seen` — atomic first-write-wins on the server, so
 * retries and reposts are safe no-ops preserving the earliest timestamp.
 */

import { apiRequest } from '../api/api'
import type { GuidanceTipId, MarkGuidanceSeenResponse } from '@shared/api'

export function markGuidanceSeen(tipId: GuidanceTipId): Promise<MarkGuidanceSeenResponse> {
  return apiRequest<MarkGuidanceSeenResponse>({
    path: '/api/guidance/seen',
    method: 'POST',
    data: { tipId },
    handleUnauthorized: false,
  })
}
