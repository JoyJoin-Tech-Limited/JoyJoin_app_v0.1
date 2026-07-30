import {
  normalizeEventPoolRegistrationPayload,
  type EventPoolRegistrationPayload,
} from "@shared/api";
import {
  insertEventPoolRegistrationSchema,
  type InsertEventPoolRegistration,
} from "@shared/schema";

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
      reason: "expired_invitation" | "self_invitation" | "self_referral" | "invalid_code";
    };

export function resolveOptionalRegistrationAttribution(input: {
  userId: string;
  now?: Date;
  invitation?: {
    id: string;
    inviterId: string;
    expiresAt: Date | string | null;
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

  const parseResult = insertEventPoolRegistrationSchema.safeParse({
    poolId: input.poolId,
    userId: input.userId,
    budgetRange: normalizedPayload.budgetRange ?? [],
    preferredLanguages: normalizedPayload.preferredLanguages ?? [],
    eventIntent: normalizedPayload.eventIntent ?? [],
    cuisinePreferences: normalizedPayload.cuisinePreferences ?? [],
    dietaryRestrictions: normalizedPayload.dietaryRestrictions ?? [],
    tasteIntensity: normalizedPayload.tasteIntensity ?? [],
    barThemes: normalizedPayload.barThemes ?? [],
    alcoholComfort: normalizedPayload.alcoholComfort ?? [],
    barBudgetRange: normalizedPayload.barBudgetRange ?? [],
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
