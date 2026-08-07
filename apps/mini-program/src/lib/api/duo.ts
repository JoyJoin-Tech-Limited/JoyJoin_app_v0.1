import type { apiRequest } from './api'

/**
 * Duo registration (双人成行) API client.
 *
 * Server contract (implemented in parallel on the server side):
 *   POST /api/pools/:id/duo-invites → { code, sharePath }   (idempotent per user+pool)
 *   GET  /api/pools/:id/duo-status  → { state, friendDisplayName?, invitedAt? }
 *   GET  /api/duo-invites/:code     → { inviter, poolId, status } (404 invalid / 410 expired)
 *
 * Mirrors the @shared/api function style: each function takes the mini-program
 * `apiRequest` implementation as its first argument.
 */

type ApiRequest = typeof apiRequest

export interface DuoInviteCreateResponse {
  code: string
  sharePath: string
}

export type DuoStatusState = 'none' | 'waiting' | 'bound'

export interface DuoStatusResponse {
  state: DuoStatusState
  friendDisplayName?: string
  invitedAt?: string
}

export type DuoInviteStatus = 'active' | 'expired' | 'invalid'

export interface DuoInviteInfoResponse {
  inviter: { displayName: string }
  poolId: string
  status: DuoInviteStatus
}

export function createDuoInvite(request: ApiRequest, poolId: string): Promise<DuoInviteCreateResponse> {
  return request<DuoInviteCreateResponse>({
    path: `/api/pools/${encodeURIComponent(poolId)}/duo-invites`,
    method: 'POST',
  })
}

export function getDuoStatus(request: ApiRequest, poolId: string): Promise<DuoStatusResponse> {
  return request<DuoStatusResponse>({
    path: `/api/pools/${encodeURIComponent(poolId)}/duo-status`,
  })
}

export function getDuoInviteInfo(request: ApiRequest, code: string): Promise<DuoInviteInfoResponse> {
  return request<DuoInviteInfoResponse>({
    path: `/api/duo-invites/${encodeURIComponent(code)}`,
    handleUnauthorized: false,
  })
}
