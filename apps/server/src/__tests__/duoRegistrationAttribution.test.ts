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

import {
  resolveDuoBindingResult,
  resolveOptionalRegistrationAttribution,
} from "../lib/eventPoolRegistration";

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

/**
 * 双人成行 S1 (one-partner-per-pool) — the write-side guard layer of
 * resolveOptionalRegistrationAttribution (sprint-contract
 * duo-s1-one-partner-per-pool AC-1/AC-2/AC-7/AC-8). The resolver stays pure:
 * call sites pre-fetch the two availability facts via
 * repositories/duoBindingRepo and pass them in; refusal is a discard, never
 * a thrown error, so registration/payment is never blocked.
 */
describe("resolveOptionalRegistrationAttribution — S1 one-partner-per-pool guard", () => {
  it("discards with duo_partner_taken when the invitation already has a live consumer", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee-2",
      poolId: "pool-a",
      invitation: duoInvitation(),
      duo: { invitationAlreadyBound: true, userAlreadyBoundInPool: false },
    });
    expect(result).toEqual({ kind: "discard", reason: "duo_partner_taken" });
  });

  it("discards with duo_already_bound when the user already holds a valid binding in the pool", () => {
    // A is bound with C (either role), then presents B's code for the same pool.
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-a",
      poolId: "pool-a",
      invitation: duoInvitation({ id: "inv-duo-b", inviterId: "user-b" }),
      duo: { invitationAlreadyBound: false, userAlreadyBoundInPool: true },
    });
    expect(result).toEqual({ kind: "discard", reason: "duo_already_bound" });
  });

  it("partner_taken takes precedence when both guard facts are true", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-a",
      poolId: "pool-a",
      invitation: duoInvitation(),
      duo: { invitationAlreadyBound: true, userAlreadyBoundInPool: true },
    });
    expect(result).toEqual({ kind: "discard", reason: "duo_partner_taken" });
  });

  it("binds when both guard facts are false (first consumer, first binding)", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: duoInvitation(),
      duo: { invitationAlreadyBound: false, userAlreadyBoundInPool: false },
    });
    expect(result).toEqual({
      kind: "invitation",
      invitationId: "inv-duo-1",
      inviterId: "user-inviter",
    });
  });

  it("stays backward-compatible when the availability probe was not run (duo omitted)", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: duoInvitation(),
    });
    expect(result.kind).toBe("invitation");
  });

  it("ignores the duo guard for non-duo invitations even when facts are supplied", () => {
    // Legacy event-scoped invitations are multi-use by design — the guard must
    // not leak into them even if a caller mis-wires the facts.
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: {
        id: "inv-legacy-3",
        inviterId: "user-inviter",
        expiresAt: futureExpiry,
        invitationType: "pre_match",
        poolId: null,
      },
      duo: { invitationAlreadyBound: true, userAlreadyBoundInPool: true },
    });
    expect(result).toEqual({
      kind: "invitation",
      invitationId: "inv-legacy-3",
      inviterId: "user-inviter",
    });
  });

  it("pool_mismatch fires before the duo guard (cross-pool presentation is structural)", () => {
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-b",
      invitation: duoInvitation(), // scoped to pool-a
      duo: { invitationAlreadyBound: false, userAlreadyBoundInPool: false },
    });
    expect(result).toEqual({ kind: "discard", reason: "pool_mismatch" });
  });

  it("AC-8: invitee may bind a new code after the inviter cancels (residual use row filtered by the inviter-registration join)", () => {
    // poolRegistrationCancel deletes use rows by the CANCELLED user's own
    // registration id only, so an inviter cancel leaves the invitee's use row
    // behind. duoBindingRepo's invitee-side probe joins the inviter's
    // registration (topology locked in duoBindingRepo.test.ts), so the
    // residual row no longer counts as a binding and both flags read false —
    // the invitee is NOT locked out of accepting another code.
    const result = resolveOptionalRegistrationAttribution({
      userId: "user-invitee",
      poolId: "pool-a",
      invitation: duoInvitation({ id: "inv-duo-new", inviterId: "user-new-inviter" }),
      duo: { invitationAlreadyBound: false, userAlreadyBoundInPool: false },
    });
    expect(result).toEqual({
      kind: "invitation",
      invitationId: "inv-duo-new",
      inviterId: "user-new-inviter",
    });
  });

  it("expiry and self-invite still outrank the duo guard", () => {
    expect(
      resolveOptionalRegistrationAttribution({
        userId: "user-invitee",
        poolId: "pool-a",
        invitation: duoInvitation({ expiresAt: new Date(Date.now() - 1000) }),
        duo: { invitationAlreadyBound: true, userAlreadyBoundInPool: true },
      }),
    ).toEqual({ kind: "discard", reason: "expired_invitation" });

    expect(
      resolveOptionalRegistrationAttribution({
        userId: "user-inviter",
        poolId: "pool-a",
        invitation: duoInvitation(),
        duo: { invitationAlreadyBound: false, userAlreadyBoundInPool: false },
      }),
    ).toEqual({ kind: "discard", reason: "self_invitation" });
  });
});

describe("resolveDuoBindingResult — registration response mapping", () => {
  it("maps a bound invitation to { state: 'bound' }", () => {
    expect(
      resolveDuoBindingResult({
        invitationType: "duo",
        attribution: {
          kind: "invitation",
          invitationId: "inv-duo-1",
          inviterId: "user-inviter",
        },
      }),
    ).toEqual({ state: "bound" });
  });

  it.each([
    { discardReason: "duo_already_bound" as const, reason: "already_bound" },
    { discardReason: "duo_partner_taken" as const, reason: "partner_taken" },
    { discardReason: "expired_invitation" as const, reason: "expired" },
    { discardReason: "pool_mismatch" as const, reason: "pool_mismatch" },
  ])(
    "maps discard $discardReason → unavailable/$reason",
    ({ discardReason, reason }) => {
      expect(
        resolveDuoBindingResult({
          invitationType: "duo",
          attribution: { kind: "discard", reason: discardReason },
        }),
      ).toEqual({ state: "unavailable", reason });
    },
  );

  it("omits duoBinding for discards without duo semantics (self_invitation)", () => {
    expect(
      resolveDuoBindingResult({
        invitationType: "duo",
        attribution: { kind: "discard", reason: "self_invitation" },
      }),
    ).toBeUndefined();
  });

  it("omits duoBinding for non-duo codes (legacy invitation / referral / invalid)", () => {
    expect(
      resolveDuoBindingResult({
        invitationType: "pre_match",
        attribution: {
          kind: "invitation",
          invitationId: "inv-1",
          inviterId: "user-inviter",
        },
      }),
    ).toBeUndefined();
    expect(
      resolveDuoBindingResult({
        invitationType: undefined,
        attribution: { kind: "discard", reason: "invalid_code" },
      }),
    ).toBeUndefined();
  });
});
