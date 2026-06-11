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
] as const;

export type EventPoolRegistrationInsertValues = Pick<
  InsertEventPoolRegistration,
  "poolId" | "userId" | (typeof EVENT_POOL_REGISTRATION_FIELDS)[number]
>;

export function buildEventPoolRegistrationInsert(input: {
  poolId: string;
  userId: string;
  payload?: EventPoolRegistrationPayload | null;
}): {
  invitationCode?: string;
  values: EventPoolRegistrationInsertValues;
} {
  const normalizedPayload = normalizeEventPoolRegistrationPayload(input.payload);

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