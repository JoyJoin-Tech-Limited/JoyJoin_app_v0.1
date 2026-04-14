import type { User } from "@shared/schema";
import { SENSITIVE_AUTH_USER_FIELD_NAMES, type SanitizedAuthUser } from "@shared/api";

const SENSITIVE_AUTH_USER_FIELDS = new Set<string>(SENSITIVE_AUTH_USER_FIELD_NAMES);

export function sanitizeAuthUser(user: User): SanitizedAuthUser;
export function sanitizeAuthUser<T extends Record<string, unknown>>(user: T): Partial<T>;

export function sanitizeAuthUser<T extends Record<string, unknown>>(user: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(user).filter(([key]) => !SENSITIVE_AUTH_USER_FIELDS.has(key))
  ) as Partial<T>;
}