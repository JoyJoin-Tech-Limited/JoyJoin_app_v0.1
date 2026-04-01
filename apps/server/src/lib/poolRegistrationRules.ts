type EventPoolAvailabilityInput = {
  status: string | null;
  registrationDeadline: Date | string | null;
  minGroupSize: number | null;
  maxGroupSize: number | null;
  targetGroups: number | null;
};

export type EventPoolAvailabilityResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 400 | 410;
      code:
        | "POOL_CANCELLED"
        | "POOL_CLOSED"
        | "REGISTRATION_DEADLINE_PASSED"
        | "POOL_FULL";
      message: string;
    };

export function describePoolRegistrationAvailability(
  pool: EventPoolAvailabilityInput,
  registrationCount: number,
  now: Date = new Date(),
): EventPoolAvailabilityResult {
  if (pool.status === "cancelled") {
    return {
      allowed: false,
      status: 400,
      code: "POOL_CANCELLED",
      message: "This event pool has been cancelled",
    };
  }

  if (pool.status !== "active") {
    return {
      allowed: false,
      status: 400,
      code: "POOL_CLOSED",
      message: "This event pool is no longer accepting registrations",
    };
  }

  if (pool.registrationDeadline) {
    const deadline = new Date(pool.registrationDeadline);
    if (!Number.isNaN(deadline.getTime()) && deadline <= now) {
      return {
        allowed: false,
        status: 410,
        code: "REGISTRATION_DEADLINE_PASSED",
        message: "Registration for this event pool has closed",
      };
    }
  }

  const minGroupSize = Math.max(pool.minGroupSize ?? 0, 1);
  const maxGroupSize = Math.max(pool.maxGroupSize ?? minGroupSize, minGroupSize);
  const targetGroups = Math.max(pool.targetGroups ?? 1, 1);
  const capacity = maxGroupSize * targetGroups;

  if (registrationCount >= capacity) {
    return {
      allowed: false,
      status: 400,
      code: "POOL_FULL",
      message: "This event pool is already full",
    };
  }

  return { allowed: true };
}
