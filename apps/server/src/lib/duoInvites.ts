/**
 * 双人成行 (duo registration) — pure helpers shared by the duo domain router
 * (`routes/domains/duo.ts`) and unit tests.
 *
 * Design spec: docs/design/duo-registration-spec-20260807.md
 * Storage decision: duo invites reuse the `invitations` / `invitation_uses`
 * track re-scoped to a pool (`invitations.poolId` + `invitationType='duo'`),
 * so the existing match-time invitation pipeline keeps working.
 */

export const DUO_INVITATION_TYPE = "duo";

/**
 * Duo invite expiry = the pool's matching lock time. Aligned with
 * `preference_lock_at` semantics (24h before the event); pools without a lock
 * time fall back to the event dateTime.
 */
export function resolveDuoInviteExpiry(pool: {
  preferenceLockAt?: Date | string | null;
  dateTime: Date | string;
}): Date {
  const lock = pool.preferenceLockAt ? new Date(pool.preferenceLockAt) : null;
  return lock ?? new Date(pool.dateTime);
}

/** Mini-program share path carried by the WeChat share card (spec §A.5). */
export function buildDuoSharePath(poolId: string, code: string): string {
  return `/pages/pool-registration/index?id=${poolId}&invitationCode=${code}&duo=1`;
}

export type DuoState = "none" | "waiting" | "bound";

export interface DuoStatusResult {
  state: DuoState;
  friendDisplayName?: string;
  invitedAt?: string;
}

/**
 * Duo status state machine for the current user within one pool.
 *
 * - `none`    — no duo invitation created (inviter side) nor consumed (invitee side)
 * - `waiting` — invitation exists but the pair is not fully bound yet
 * - `bound`   — BOTH users hold registrations in this pool AND the invitee
 *               consumed the inviter's code (an invitation_uses row links them)
 *
 * Handles both directions: the current user can be the inviter or the invitee.
 */
export function resolveDuoStatus(input: {
  /** Inviter side: the current user's own duo invitation for this pool. */
  invitationCreatedAt?: Date | string | null;
  /** Inviter side: an invitation_uses row links an invitee registration in this pool. */
  inviteeRegistered?: boolean;
  inviteeDisplayName?: string | null;
  /** Inviter side: the current user holds a registration in this pool. */
  userRegistered?: boolean;
  /** Invitee side: a duo invitation this user consumed for this pool. */
  consumedInvitationCreatedAt?: Date | string | null;
  inviterRegistered?: boolean;
  inviterDisplayName?: string | null;
}): DuoStatusResult {
  const toIso = (value: Date | string | null | undefined) =>
    value ? new Date(value).toISOString() : undefined;
  const named = (name: string | null | undefined) =>
    name && name.trim() !== "" ? name : undefined;

  // Inviter side — the current user generated a code for this pool.
  if (input.invitationCreatedAt) {
    if (input.inviteeRegistered && input.userRegistered) {
      return {
        state: "bound",
        friendDisplayName: named(input.inviteeDisplayName),
        invitedAt: toIso(input.invitationCreatedAt),
      };
    }
    return {
      state: "waiting",
      friendDisplayName: input.inviteeRegistered ? named(input.inviteeDisplayName) : undefined,
      invitedAt: toIso(input.invitationCreatedAt),
    };
  }

  // Invitee side — the current user consumed someone else's duo code.
  if (input.consumedInvitationCreatedAt) {
    if (input.inviterRegistered) {
      return {
        state: "bound",
        friendDisplayName: named(input.inviterDisplayName),
        invitedAt: toIso(input.consumedInvitationCreatedAt),
      };
    }
    return {
      state: "waiting",
      friendDisplayName: named(input.inviterDisplayName),
      invitedAt: toIso(input.consumedInvitationCreatedAt),
    };
  }

  return { state: "none" };
}
