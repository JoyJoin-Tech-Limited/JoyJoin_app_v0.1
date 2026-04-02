import { describe, expect, it } from "vitest";
import { describePoolRegistrationAvailability } from "../lib/poolRegistrationRules";

describe("pool registration rules", () => {
  const basePool = {
    status: "active",
    registrationDeadline: "2099-01-01T00:00:00.000Z",
    minGroupSize: 4,
    maxGroupSize: 6,
    targetGroups: 1,
  };

  it("blocks registration after the deadline", () => {
    const result = describePoolRegistrationAvailability(
      { ...basePool, registrationDeadline: "2024-01-01T00:00:00.000Z" },
      0,
      new Date("2024-02-01T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      allowed: false,
      status: 410,
      code: "REGISTRATION_DEADLINE_PASSED",
    });
  });

  it("blocks registration when the pool is full", () => {
    const result = describePoolRegistrationAvailability(basePool, 6);

    expect(result).toMatchObject({
      allowed: false,
      status: 400,
      code: "POOL_FULL",
    });
  });
});
