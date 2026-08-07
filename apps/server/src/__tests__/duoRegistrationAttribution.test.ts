/**
 * 双人成行 (duo registration) — registration attribution tests.
 *
 * The invitation_uses write in both POST /api/event-pools/:id/register and the
 * payment-fulfillment path is gated by resolveOptionalRegistrationAttribution;
 * these tests lock in the duo pool-scoping decision layer:
 *   - duo code + matching pool  → invitation binding proceeds
 *   - duo code + different pool → discarded (pool_mismatch), no binding
 *   - existing guards (expiry, self-invite) still apply to duo codes
 *   - legacy event-scoped invitations are unaffected by the pool check
 */

import { describe, expect, it } from "vitest";

import { resolveOptionalRegistrationAttribution } from "../lib/eventPoolRegistration";

const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

function duoInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-duo-1",
    inviterId: "user-inviter",
    expiresAt: futureExpiry,
    invitationType: "duo",
    poolId: "pool-a",
    ...overrides,
  };
}

describe("resolveOptionalRegistrationAttribution — duo pool scoping", () => {
  it("binds a duo invitation when the code's pool matches the registration pool", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: duoInvitation(),
    });
    expect(result).toEqual({
      kind: "invitation",
      invitationId: "inv-duo-1",
      inviterId: "user-inviter",
    });
  });

  it("discards a duo invitation presented while registering a DIFFERENT pool", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-b",
      invitation: duoInvitation(),
    });
    expect(result).toEqual({ kind: "discard", reason: "pool_mismatch" });
  });

  it("applies the expiry guard to duo invitations", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: duoInvitation({ expiresAt: new Date(Date.now() - 1000) }),
    });
    expect(result).toEqual({ kind: "discard", reason: "expired_invitation" });
  });

  it("applies the self-invite guard to duo invitations", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-inviter",
      poolId: "pool-a",
      invitation: duoInvitation(),
    });
    expect(result).toEqual({ kind: "discard", reason: "self_invitation" });
  });

  it("legacy event-scoped invitations (no poolId/type) bind regardless of pool", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-b",
      invitation: {
        id: "inv-legacy-1",
        inviterId: "user-inviter",
        expiresAt: futureExpiry,
      },
    });
    expect(result).toEqual({
      kind: "invitation",
      invitationId: "inv-legacy-1",
      inviterId: "user-inviter",
    });
  });

  it("legacy pre_match invitations WITH an event scope still bind (pool check is duo-only)", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-b",
      invitation: {
        id: "inv-legacy-2",
        inviterId: "user-inviter",
        expiresAt: futureExpiry,
        invitationType: "pre_match",
        poolId: null,
      },
    });
    expect(result.kind).toBe("invitation");
  });
});
