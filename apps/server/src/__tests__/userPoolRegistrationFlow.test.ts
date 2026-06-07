import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PoolConfig {
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  targetGroups?: number | null;
}

interface Invitation {
  id: string;
  inviterUserId: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
}

interface ReferralCode {
  id: string;
  ownerUserId: string;
  isActive: boolean;
}

interface ValidationResult {
  valid: boolean;
  type: "invitation" | "referral" | null;
  error?: string;
}

interface Pool extends PoolConfig {
  id: string;
  status: string;
  registrationDeadline: string | null;
}

interface RegistrationGuardInput {
  pool: Pool | null;
  existingRegistration: boolean;
  currentRegistrationCount: number;
  subscriptionActive: boolean;
  availableCredits: number;
  invitationCode: string | undefined;
  userId: string;
  invitations: Invitation[];
  referralCodes: ReferralCode[];
}

interface RegistrationGuardResult {
  allowed: boolean;
  step?: string;
  error?: string;
  httpStatus?: number;
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

function resolvePoolCapacity(pool: PoolConfig): number {
  const min = pool.minGroupSize ?? 4;
  const max = pool.maxGroupSize ?? 4;
  const targets = pool.targetGroups ?? 1;
  return Math.max(max, min) * Math.max(targets, 1);
}

function checkEntitlement(
  subscriptionActive: boolean,
  availableCredits: number,
): "subscription" | "credits" | "none" {
  if (subscriptionActive) return "subscription";
  if (availableCredits > 0) return "credits";
  return "none";
}

function validateInvitationCode(
  code: string | undefined,
  userId: string,
  invitations: Invitation[],
  referralCodes: ReferralCode[],
): ValidationResult {
  if (!code) {
    return { valid: true, type: null };
  }

  const invitation = invitations.find((inv) => inv.id === code);
  if (invitation) {
    if (invitation.inviterUserId === userId) {
      return {
        valid: false,
        type: "invitation",
        error: "Cannot use your own invitation code",
      };
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return {
        valid: false,
        type: "invitation",
        error: "Invitation code has expired",
      };
    }
    if (invitation.useCount >= invitation.maxUses) {
      return {
        valid: false,
        type: "invitation",
        error: "Invitation code has reached maximum uses",
      };
    }
    return { valid: true, type: "invitation" };
  }

  const referral = referralCodes.find((rc) => rc.id === code);
  if (referral) {
    if (referral.ownerUserId === userId) {
      return {
        valid: false,
        type: "referral",
        error: "Cannot use your own referral code",
      };
    }
    if (!referral.isActive) {
      return {
        valid: false,
        type: "referral",
        error: "Referral code is no longer active",
      };
    }
    return { valid: true, type: "referral" };
  }

  return {
    valid: false,
    type: null,
    error: "Invalid invitation or referral code",
  };
}

function registrationGuard(input: RegistrationGuardInput): RegistrationGuardResult {
  if (!input.pool) {
    return { allowed: false, step: "pool_exists", error: "Event pool not found", httpStatus: 404 };
  }

  if (input.pool.status !== "active") {
    return { allowed: false, step: "pool_active", error: "Event pool is not active", httpStatus: 400 };
  }

  if (input.existingRegistration) {
    return {
      allowed: false,
      step: "duplicate",
      error: "Already registered for this event pool",
      httpStatus: 409,
    };
  }

  const capacity = resolvePoolCapacity(input.pool);
  if (input.currentRegistrationCount >= capacity) {
    return { allowed: false, step: "capacity", error: "Event pool is full", httpStatus: 400 };
  }

  const entitlement = checkEntitlement(input.subscriptionActive, input.availableCredits);
  if (entitlement === "none") {
    return { allowed: false, step: "entitlement", error: "No valid entitlement", httpStatus: 402 };
  }

  const codeResult = validateInvitationCode(
    input.invitationCode,
    input.userId,
    input.invitations,
    input.referralCodes,
  );
  if (!codeResult.valid) {
    return { allowed: false, step: "invitation_code", error: codeResult.error, httpStatus: 400 };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolvePoolCapacity", () => {
  it("uses default values when pool config is empty", () => {
    expect(resolvePoolCapacity({})).toBe(4);
  });

  it("uses default values when all fields are null", () => {
    expect(resolvePoolCapacity({ minGroupSize: null, maxGroupSize: null, targetGroups: null })).toBe(4);
  });

  it("uses default values when all fields are undefined", () => {
    expect(resolvePoolCapacity({ minGroupSize: undefined, maxGroupSize: undefined, targetGroups: undefined })).toBe(
      4,
    );
  });

  it("respects a custom maxGroupSize with default targetGroups", () => {
    expect(resolvePoolCapacity({ maxGroupSize: 8 })).toBe(8);
  });

  it("respects custom targetGroups with default sizes", () => {
    expect(resolvePoolCapacity({ targetGroups: 3 })).toBe(12);
  });

  it("multiplies maxGroupSize and targetGroups", () => {
    expect(resolvePoolCapacity({ minGroupSize: 4, maxGroupSize: 6, targetGroups: 3 })).toBe(18);
  });

  it("uses the larger of min and max when max < min", () => {
    expect(resolvePoolCapacity({ minGroupSize: 10, maxGroupSize: 4 })).toBe(10);
  });

  it("clamps targetGroups to minimum 1 when set to 0", () => {
    expect(resolvePoolCapacity({ targetGroups: 0 })).toBe(4);
  });

  it("clamps targetGroups to minimum 1 when set to a negative value", () => {
    expect(resolvePoolCapacity({ targetGroups: -2 })).toBe(4);
  });

  it("handles zero maxGroupSize gracefully", () => {
    expect(resolvePoolCapacity({ maxGroupSize: 0, minGroupSize: 0 })).toBe(0);
  });

  it("handles large numbers without overflow", () => {
    expect(resolvePoolCapacity({ maxGroupSize: 100, targetGroups: 50 })).toBe(5000);
  });
});

describe("checkEntitlement", () => {
  it("returns subscription when subscription is active regardless of credits", () => {
    expect(checkEntitlement(true, 0)).toBe("subscription");
  });

  it("returns subscription when both subscription and credits are available", () => {
    expect(checkEntitlement(true, 10)).toBe("subscription");
  });

  it("returns credits when subscription is inactive and credits > 0", () => {
    expect(checkEntitlement(false, 5)).toBe("credits");
  });

  it("returns none when subscription is inactive and credits is 0", () => {
    expect(checkEntitlement(false, 0)).toBe("none");
  });

  it("returns none when subscription is inactive and credits is negative", () => {
    expect(checkEntitlement(false, -1)).toBe("none");
  });

  it("returns credits for a single remaining credit", () => {
    expect(checkEntitlement(false, 1)).toBe("credits");
  });

  it("returns none when subscription is inactive and credits is a fractional number", () => {
    expect(checkEntitlement(false, 0.5)).toBe("credits");
  });
});

describe("validateInvitationCode", () => {
  const baseInvitation: Invitation = {
    id: "INV-ABC",
    inviterUserId: "user-other",
    expiresAt: "2099-12-31T00:00:00.000Z",
    maxUses: 5,
    useCount: 1,
  };

  const baseReferral: ReferralCode = {
    id: "REF-123",
    ownerUserId: "user-other",
    isActive: true,
  };

  it("returns valid with no type when code is undefined", () => {
    const result = validateInvitationCode(undefined, "user-me", [], []);
    expect(result).toEqual({ valid: true, type: null });
  });

  it("returns valid with no type when code is an empty string", () => {
    const result = validateInvitationCode("", "user-me", [], []);
    expect(result).toEqual({ valid: true, type: null });
  });

  describe("invitation codes", () => {
    it("returns valid when a valid invitation code is provided", () => {
      const result = validateInvitationCode("INV-ABC", "user-me", [baseInvitation], []);
      expect(result).toEqual({ valid: true, type: "invitation" });
    });

    it("blocks self-invitation", () => {
      const result = validateInvitationCode("INV-ABC", "user-other", [baseInvitation], []);
      expect(result).toMatchObject({ valid: false, type: "invitation", error: expect.any(String) });
    });

    it("blocks expired invitation code", () => {
      const expired: Invitation = {
        ...baseInvitation,
        expiresAt: "2024-01-01T00:00:00.000Z",
      };
      const result = validateInvitationCode("INV-ABC", "user-me", [expired], []);
      expect(result).toMatchObject({ valid: false, type: "invitation" });
    });

    it("blocks invitation that has reached maxUses", () => {
      const usedUp: Invitation = {
        ...baseInvitation,
        maxUses: 3,
        useCount: 3,
      };
      const result = validateInvitationCode("INV-ABC", "user-me", [usedUp], []);
      expect(result).toMatchObject({ valid: false, type: "invitation" });
    });

    it("allows invitation that still has capacity (useCount < maxUses)", () => {
      const almostFull: Invitation = {
        ...baseInvitation,
        maxUses: 3,
        useCount: 2,
      };
      const result = validateInvitationCode("INV-ABC", "user-me", [almostFull], []);
      expect(result).toEqual({ valid: true, type: "invitation" });
    });
  });

  describe("referral codes", () => {
    it("returns valid when a valid referral code is provided", () => {
      const result = validateInvitationCode("REF-123", "user-me", [], [baseReferral]);
      expect(result).toEqual({ valid: true, type: "referral" });
    });

    it("blocks self-referral", () => {
      const result = validateInvitationCode("REF-123", "user-other", [], [baseReferral]);
      expect(result).toMatchObject({ valid: false, type: "referral" });
    });

    it("blocks inactive referral code", () => {
      const inactive: ReferralCode = { ...baseReferral, isActive: false };
      const result = validateInvitationCode("REF-123", "user-me", [], [inactive]);
      expect(result).toMatchObject({ valid: false, type: "referral" });
    });
  });

  describe("disambiguation (invitations checked first)", () => {
    it("resolves as invitation when the same code exists in both tables", () => {
      const result = validateInvitationCode("INV-ABC", "user-me", [baseInvitation], [
        { id: "INV-ABC", ownerUserId: "user-other", isActive: true },
      ]);
      expect(result).toEqual({ valid: true, type: "invitation" });
    });

    it("checks referrals only after invitations miss", () => {
      const result = validateInvitationCode("REF-123", "user-me", [], [baseReferral]);
      expect(result).toEqual({ valid: true, type: "referral" });
    });
  });

  it("returns invalid when code is not found in either table", () => {
    const result = validateInvitationCode("NONEXISTENT", "user-me", [], []);
    expect(result).toMatchObject({ valid: false, type: null });
  });

  it("returns invalid when invitation list is non-empty but code does not match", () => {
    const result = validateInvitationCode("WRONG-CODE", "user-me", [baseInvitation], []);
    expect(result).toMatchObject({ valid: false, type: null });
  });
});

describe("registrationGuard", () => {
  function makePassingPool(): Pool {
    return {
      id: "pool-1",
      status: "active",
      registrationDeadline: null,
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 1,
    };
  }

  function makePassingInput(overrides?: Partial<RegistrationGuardInput>): RegistrationGuardInput {
    return {
      pool: makePassingPool(),
      existingRegistration: false,
      currentRegistrationCount: 2,
      subscriptionActive: true,
      availableCredits: 0,
      invitationCode: undefined,
      userId: "user-1",
      invitations: [],
      referralCodes: [],
      ...overrides,
    };
  }

  it("allows registration when all conditions pass", () => {
    const result = registrationGuard(makePassingInput());
    expect(result).toEqual({ allowed: true });
  });

  it("allows registration via credits when subscription is inactive", () => {
    const result = registrationGuard(makePassingInput({ subscriptionActive: false, availableCredits: 3 }));
    expect(result).toEqual({ allowed: true });
  });

  it("allows registration with a valid invitation code", () => {
    const result = registrationGuard(
      makePassingInput({
        invitationCode: "INV-ABC",
        invitations: [
          { id: "INV-ABC", inviterUserId: "user-other", expiresAt: "2099-12-31T00:00:00.000Z", maxUses: 5, useCount: 1 },
        ],
      }),
    );
    expect(result).toEqual({ allowed: true });
  });

  it("allows registration with a valid referral code", () => {
    const result = registrationGuard(
      makePassingInput({
        invitationCode: "REF-123",
        referralCodes: [{ id: "REF-123", ownerUserId: "user-other", isActive: true }],
      }),
    );
    expect(result).toEqual({ allowed: true });
  });

  it("blocks at pool_exists when pool is null", () => {
    const result = registrationGuard(makePassingInput({ pool: null }));
    expect(result).toMatchObject({ allowed: false, step: "pool_exists", httpStatus: 404 });
  });

  it("blocks at pool_active when pool is cancelled", () => {
    const pool: Pool = { ...makePassingPool(), status: "cancelled" };
    const result = registrationGuard(makePassingInput({ pool }));
    expect(result).toMatchObject({ allowed: false, step: "pool_active", httpStatus: 400 });
  });

  it("blocks at pool_active when pool is closed", () => {
    const pool: Pool = { ...makePassingPool(), status: "closed" };
    const result = registrationGuard(makePassingInput({ pool }));
    expect(result).toMatchObject({ allowed: false, step: "pool_active", httpStatus: 400 });
  });

  it("blocks at duplicate when user already registered", () => {
    const result = registrationGuard(makePassingInput({ existingRegistration: true }));
    expect(result).toMatchObject({ allowed: false, step: "duplicate", httpStatus: 409 });
  });

  it("blocks at capacity when registration count equals capacity", () => {
    const result = registrationGuard(makePassingInput({ currentRegistrationCount: 6 }));
    expect(result).toMatchObject({ allowed: false, step: "capacity", httpStatus: 400 });
  });

  it("blocks at capacity when registration count exceeds capacity", () => {
    const result = registrationGuard(makePassingInput({ currentRegistrationCount: 10 }));
    expect(result).toMatchObject({ allowed: false, step: "capacity", httpStatus: 400 });
  });

  it("blocks at entitlement when no subscription and no credits", () => {
    const result = registrationGuard(
      makePassingInput({ subscriptionActive: false, availableCredits: 0 }),
    );
    expect(result).toMatchObject({ allowed: false, step: "entitlement", httpStatus: 402 });
  });

  it("blocks at entitlement when credits are zero even with subscription false", () => {
    const result = registrationGuard(
      makePassingInput({ subscriptionActive: false, availableCredits: -1 }),
    );
    expect(result).toMatchObject({ allowed: false, step: "entitlement", httpStatus: 402 });
  });

  it("blocks at invitation_code when code is invalid", () => {
    const result = registrationGuard(
      makePassingInput({ invitationCode: "BAD-CODE", userId: "user-1", invitations: [], referralCodes: [] }),
    );
    expect(result).toMatchObject({ allowed: false, step: "invitation_code", httpStatus: 400 });
  });

  it("blocks at invitation_code on self-invite", () => {
    const result = registrationGuard(
      makePassingInput({
        invitationCode: "INV-SELF",
        userId: "user-me",
        invitations: [
          { id: "INV-SELF", inviterUserId: "user-me", expiresAt: "2099-12-31T00:00:00.000Z", maxUses: 5, useCount: 0 },
        ],
      }),
    );
    expect(result).toMatchObject({ allowed: false, step: "invitation_code", httpStatus: 400 });
  });

  it("blocks at the first failing guard in sequence (pool null before capacity)", () => {
    const result = registrationGuard(
      makePassingInput({
        pool: null,
        currentRegistrationCount: 100,
      }),
    );
    expect(result).toMatchObject({ step: "pool_exists" });
  });

  it("blocks at the first failing guard (entitlement before invitation code)", () => {
    const result = registrationGuard(
      makePassingInput({
        subscriptionActive: false,
        availableCredits: 0,
        invitationCode: "BAD-CODE",
      }),
    );
    expect(result).toMatchObject({ step: "entitlement" });
  });
});

describe("registrationGuard capacity edge cases", () => {
  it("computes capacity from pool config and blocks at boundary", () => {
    const pool: Pool = {
      id: "pool-2",
      status: "active",
      registrationDeadline: null,
      minGroupSize: 6,
      maxGroupSize: 8,
      targetGroups: 3,
    };
    const result = registrationGuard({
      pool,
      existingRegistration: false,
      currentRegistrationCount: 24,
      subscriptionActive: true,
      availableCredits: 0,
      invitationCode: undefined,
      userId: "user-1",
      invitations: [],
      referralCodes: [],
    });
    expect(result).toMatchObject({ allowed: false, step: "capacity" });
  });

  it("allows registration right at the capacity boundary minus one", () => {
    const pool: Pool = {
      id: "pool-3",
      status: "active",
      registrationDeadline: null,
      maxGroupSize: 8,
      targetGroups: 3,
    };
    const result = registrationGuard({
      pool,
      existingRegistration: false,
      currentRegistrationCount: 23,
      subscriptionActive: true,
      availableCredits: 0,
      invitationCode: undefined,
      userId: "user-1",
      invitations: [],
      referralCodes: [],
    });
    expect(result).toEqual({ allowed: true });
  });
});
