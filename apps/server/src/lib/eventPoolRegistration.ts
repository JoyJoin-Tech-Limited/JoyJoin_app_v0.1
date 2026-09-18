import {
  normalizeEventPoolRegistrationPayload,
  type EventPoolRegistrationPayload,
} from "@shared/api";
import {
  normalizeBudgetTierIds,
  UNMAPPABLE_BLIND_BOX_BUDGET_LABEL,
} from "@shared/budgetTiers";
import type { ErrorCode } from "@shared/copy/errorBaselines";
import {
  insertEventPoolRegistrationSchema,
  type InsertEventPoolRegistration,
} from "@shared/schema";
import { normalizeBudgetRangeForWrite } from "./budgetTierWrite";

/**
 * Machine-readable codes for budget-tier validation at the registration funnel
 * (T6-strict). Typed against the shared `ErrorCode` union so removing a code
 * from the copy contract fails the build instead of silently regressing to the
 * generic client fallback.
 */
export type BudgetTierValidationCode = Extract<
  ErrorCode,
  "INVALID_BUDGET_TIER" | "BUDGET_TIER_REQUIRED"
>;

/** Thrown for a missing budget (`BUDGET_TIER_REQUIRED`) or a value that is not
 *  a canonical registry tier and not the B3-pending blind-box label
 *  (`INVALID_BUDGET_TIER`). Carries `code` so routes can surface it verbatim. */
export class BudgetTierValidationError extends Error {
  readonly code: BudgetTierValidationCode;

  constructor(code: BudgetTierValidationCode, message: string) {
    super(message);
    this.name = "BudgetTierValidationError";
    this.code = code;
  }
}

/**
 * T6-strict required-budget gate (decision B5: `min(1)` = yes, `max(1)` = no).
 *
 * Enforced at the route/funnel boundary, NOT on
 * `insertEventPoolRegistrationSchema`, because legitimate direct-Drizzle
 * writers omit budget (test-admin register, single-test seed, payment
 * fulfilment fallback `?? []`) and never pass through that Zod schema — see
 * sprint-contract.budget-t6-strict-20260916 §3.
 *
 * Event-type tolerant: 饭局 clients send `budgetRange`, 酒局 clients send
 * `barBudgetRange`, so "supplied" means at least one of the two. Validation
 * runs on the normalized payload, so an all-whitespace array counts as empty.
 */
export function assertBudgetTierSupplied(
  payload?: EventPoolRegistrationPayload | null,
): void {
  const normalized = normalizeEventPoolRegistrationPayload(payload);
  const supplied =
    (normalized.budgetRange?.length ?? 0) + (normalized.barBudgetRange?.length ?? 0);
  if (supplied === 0) {
    throw new BudgetTierValidationError("BUDGET_TIER_REQUIRED", "请先选择预算区间");
  }
}

/**
 * Strict allow-list check on the normalized values (T6-strict).
 *
 * Legacy labels have already been mapped to canonical ids by the normalizer, so
 * a legacy label passes because it normalizes cleanly. The blind-box unmappable
 * label (see `UNMAPPABLE_BLIND_BOX_BUDGET_LABEL`) has no registry counterpart
 * and is the B3-pending label — it stays tolerated
 * (decision B3 is OPEN, do not decide it here); every other non-registry value
 * (or a tier id from the wrong event-type namespace) fails closed.
 */
function assertBudgetTiersAllowed(normalizedPayload: {
  budgetRange?: string[];
  barBudgetRange?: string[];
}): void {
  const rejected = [
    ...normalizeBudgetTierIds(normalizedPayload.budgetRange, { eventType: "饭局" })
      .unknown,
    ...normalizeBudgetTierIds(normalizedPayload.barBudgetRange, { eventType: "酒局" })
      .unknown,
  ].filter((value) => value !== UNMAPPABLE_BLIND_BOX_BUDGET_LABEL);

  if (rejected.length > 0) {
    throw new BudgetTierValidationError("INVALID_BUDGET_TIER", "预算区间不在可选范围内");
  }
}

const EVENT_POOL_REGISTRATION_FIELDS = [
  "budgetRange",
  "preferredLanguages",
  "eventIntent",
  "cuisinePreferences",
  "dietaryRestrictions",
  "tasteIntensity",
  "barThemes",
  "alcoholComfort",
  "barBudgetRange",
  "preferenceStrictness",
  "acceptPairs",
  "genderCompositionPreference",
  "preferredDistricts",
  "kolComfortLevel",
] as const;

export type EventPoolRegistrationInsertValues = Pick<
  InsertEventPoolRegistration,
  "poolId" | "userId" | (typeof EVENT_POOL_REGISTRATION_FIELDS)[number]
>;

export interface EventPoolRegistrationPreferenceDNA {
  strictness: number;
  acceptPairs: boolean | null;
  genderComposition: string | null;
  preferredDistricts: string[] | null;
  kolComfort: string | null;
}

type OptionalRegistrationAttribution =
  | { kind: "invitation"; invitationId: string; inviterId: string }
  | { kind: "referral"; referralCodeId: string; inviterId: string }
  | {
      kind: "discard";
      reason: "expired_invitation" | "self_invitation" | "self_referral" | "invalid_code" | "pool_mismatch";
    };

export function resolveOptionalRegistrationAttribution(input: {
  userId: string;
  now?: Date;
  /** Pool being registered into — duo invitations are pool-scoped. */
  poolId?: string;
  invitation?: {
    id: string;
    inviterId: string;
    expiresAt: Date | string | null;
    /** 双人成行 duo invitations carry poolId + invitationType='duo'. */
    invitationType?: string | null;
    poolId?: string | null;
  } | null;
  referral?: {
    id: string;
    userId: string;
  } | null;
}): OptionalRegistrationAttribution {
  if (input.invitation) {
    if (
      input.invitation.expiresAt &&
      new Date(input.invitation.expiresAt) < (input.now ?? new Date())
    ) {
      return { kind: "discard", reason: "expired_invitation" };
    }

    if (input.invitation.inviterId === input.userId) {
      return { kind: "discard", reason: "self_invitation" };
    }

    // Duo invitations bind only within their own pool — a duo code presented
    // while registering a different pool must not write invitation_uses.
    if (
      input.invitation.invitationType === "duo" &&
      input.invitation.poolId &&
      input.poolId &&
      input.invitation.poolId !== input.poolId
    ) {
      return { kind: "discard", reason: "pool_mismatch" };
    }

    return {
      kind: "invitation",
      invitationId: input.invitation.id,
      inviterId: input.invitation.inviterId,
    };
  }

  if (input.referral) {
    if (input.referral.userId === input.userId) {
      return { kind: "discard", reason: "self_referral" };
    }

    return {
      kind: "referral",
      referralCodeId: input.referral.id,
      inviterId: input.referral.userId,
    };
  }

  return { kind: "discard", reason: "invalid_code" };
}

export function isSessionPendingReferralCode(
  submittedCode: string,
  pendingReferralCode: string | undefined,
): boolean {
  return (
    typeof pendingReferralCode === "string" &&
    pendingReferralCode.trim() !== "" &&
    submittedCode.trim() === pendingReferralCode.trim()
  );
}

export function buildEventPoolRegistrationInsert(input: {
  poolId: string;
  userId: string;
  payload?: EventPoolRegistrationPayload | null;
  preferenceDNA?: EventPoolRegistrationPreferenceDNA | null;
}): {
  invitationCode?: string;
  values: EventPoolRegistrationInsertValues;
} {
  const normalizedPayload = normalizeEventPoolRegistrationPayload(input.payload);
  const dna = input.preferenceDNA;

  // T6-strict: reject non-registry values AFTER normalization (legacy labels
  // have become ids by now; the B3-pending unmappable label stays exempt).
  // Fail-closed and pure — no DB/resolver dependency can block registration.
  assertBudgetTiersAllowed(normalizedPayload);

  // L1 write normalization: `budget_range` is the 饭局 (dining) namespace and
  // `bar_budget_range` is the 酒局 (drinks) namespace. Legacy labels are mapped
  // to canonical ids here so both registration routes (free + register-with-
  // payment) persist canonical values; unmappable values are preserved+logged.
  const budgetRange = normalizeBudgetRangeForWrite(
    normalizedPayload.budgetRange,
    "饭局",
    "eventPoolRegistration.budgetRange",
  );
  const barBudgetRange = normalizeBudgetRangeForWrite(
    normalizedPayload.barBudgetRange,
    "酒局",
    "eventPoolRegistration.barBudgetRange",
  );

  const parseResult = insertEventPoolRegistrationSchema.safeParse({
    poolId: input.poolId,
    userId: input.userId,
    budgetRange,
    preferredLanguages: normalizedPayload.preferredLanguages ?? [],
    eventIntent: normalizedPayload.eventIntent ?? [],
    cuisinePreferences: normalizedPayload.cuisinePreferences ?? [],
    dietaryRestrictions: normalizedPayload.dietaryRestrictions ?? [],
    tasteIntensity: normalizedPayload.tasteIntensity ?? [],
    barThemes: normalizedPayload.barThemes ?? [],
    alcoholComfort: normalizedPayload.alcoholComfort ?? [],
    barBudgetRange,
    preferenceStrictness: dna?.strictness ?? 50,
    acceptPairs: dna?.acceptPairs ?? true,
    genderCompositionPreference: dna?.genderComposition ?? null,
    preferredDistricts: dna?.preferredDistricts ?? null,
    kolComfortLevel: dna?.kolComfort ?? null,
  });

  if (!parseResult.success) {
    const error = new Error("Invalid registration payload") as Error & { validationErrors?: unknown };
    error.validationErrors = parseResult.error.flatten();
    throw error;
  }

  const values = parseResult.data as EventPoolRegistrationInsertValues;

  return {
    invitationCode: normalizedPayload.invitationCode,
    values,
  };
}
