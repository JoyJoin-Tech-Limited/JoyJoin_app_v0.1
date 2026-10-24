import type { apiRequest } from './api'

/**
 * Duo registration (双人成行) API client.
 *
 * Server contract (implemented in parallel on the server side):
 *   POST /api/pools/:id/duo-invites → { code, sharePath }   (idempotent per user+pool)
 *   GET  /api/pools/:id/duo-status  → { state, friendDisplayName?, invitedAt?, viewerRole?, pendingSide? }
 *   GET  /api/duo-invites/:code     → { inviter, poolId, status, inviterRegistered? } (404 invalid / 410 expired)
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

/** Which side of a duo pair a user is on (S3, additive optional on waiting). */
export type DuoRole = 'inviter' | 'invitee'

export interface DuoStatusResponse {
  state: DuoStatusState
  friendDisplayName?: string
  invitedAt?: string
  /**
   * S3 (additive optional, AC-0): which side of the pair the current viewer
   * is on. Emitted together with `pendingSide` on every `waiting` response;
   * `bound`/`none` responses carry no direction fields. Older servers omit
   * both — the client must then fall back to the D1 copy and never render
   * 「就等你」(AC-3, Reliability pillar).
   */
  viewerRole?: DuoRole
  /**
   * S3 (additive optional, AC-0): which side of the pair has NOT registered
   * yet. `viewerRole === pendingSide` means the viewer is the one being
   * waited on (「就等你」). The combination viewerRole='invitee' &&
   * pendingSide='invitee' is unreachable by construction (use rows are
   * written at registration time); a defensive renderer falls back to D1.
   */
  pendingSide?: DuoRole
}

export type DuoInviteStatus = 'active' | 'expired' | 'invalid'

export interface DuoInviteInfoResponse {
  inviter: { displayName: string }
  poolId: string
  status: DuoInviteStatus
  /**
   * S3 (additive optional, AC-0): whether the inviter already holds a
   * registration in this pool — the pre-registration invitee's ONLY
   * 「就等你」 data source (duo-status stays `none` for them until their own
   * registration writes the use row). Boolean only; the inviter's userId
   * never leaves the server (Security pillar).
   */
  inviterRegistered?: boolean
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
