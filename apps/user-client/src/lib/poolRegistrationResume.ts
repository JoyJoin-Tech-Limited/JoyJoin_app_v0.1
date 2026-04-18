import {
  normalizeEventPoolRegistrationPayload,
  type EventPoolRegistrationPayload,
  type NormalizedEventPoolRegistrationPayload,
} from "@shared/api";

export const BROWSER_POOL_REGISTRATION_RESUME_CONTEXT_KEY =
  "joyjoin.browser.pool_registration_resume";
export const BROWSER_POOL_REGISTRATION_RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type BrowserPoolRegistrationEntitlementCode =
  | "NO_ACTIVE_ENTITLEMENT"
  | "NO_AVAILABLE_EVENT_PACK_CREDITS";

export interface BrowserPoolRegistrationResumeContext {
  kind: "pool-registration";
  userId: string | null;
  poolId: string;
  poolTitle: string | null;
  poolArea: string | null;
  poolDate: string | null;
  poolEventType: string | null;
  draft: NormalizedEventPoolRegistrationPayload;
  resumeStep: 1 | 2 | 3;
  handoffCode?: BrowserPoolRegistrationEntitlementCode;
  paymentStatus: "payment-required" | "paid";
  createdAt: number;
  updatedAt: number;
}

export type BrowserPoolRegistrationResumeContextClearReason =
  | "invalid-resume-context"
  | "expired"
  | "wrong-user";

export type BrowserPoolRegistrationResumeLookupResult =
  | { status: "missing" }
  | { status: "clear"; reason: BrowserPoolRegistrationResumeContextClearReason }
  | { status: "ready"; context: BrowserPoolRegistrationResumeContext };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizePositiveTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeResumeStep(value: unknown): 1 | 2 | 3 {
  switch (value) {
    case 1:
    case 2:
    case 3:
      return value;
    default:
      return 3;
  }
}

function normalizeEntitlementCode(
  value: unknown,
): BrowserPoolRegistrationEntitlementCode | undefined {
  if (
    value === "NO_ACTIVE_ENTITLEMENT" ||
    value === "NO_AVAILABLE_EVENT_PACK_CREDITS"
  ) {
    return value;
  }

  return undefined;
}

function normalizePaymentStatus(
  value: unknown,
): BrowserPoolRegistrationResumeContext["paymentStatus"] {
  return value === "paid" ? "paid" : "payment-required";
}

export function buildBrowserPoolRegistrationResumeContext(
  input: {
    userId?: string | null;
    poolId: string;
    poolTitle?: string | null;
    poolArea?: string | null;
    poolDate?: string | null;
    poolEventType?: string | null;
    draft?: EventPoolRegistrationPayload | null;
    resumeStep?: number;
    handoffCode?: BrowserPoolRegistrationEntitlementCode | null;
    paymentStatus?: BrowserPoolRegistrationResumeContext["paymentStatus"];
    createdAt?: number;
    updatedAt?: number;
  },
  now = Date.now(),
): BrowserPoolRegistrationResumeContext {
  const createdAt = normalizePositiveTimestamp(input.createdAt) ?? now;
  const updatedAt = normalizePositiveTimestamp(input.updatedAt) ?? createdAt;

  return {
    kind: "pool-registration",
    userId: normalizeNonEmptyString(input.userId) ?? null,
    poolId: input.poolId.trim(),
    poolTitle: normalizeNonEmptyString(input.poolTitle),
    poolArea: normalizeNonEmptyString(input.poolArea),
    poolDate: normalizeNonEmptyString(input.poolDate),
    poolEventType: normalizeNonEmptyString(input.poolEventType),
    draft: normalizeEventPoolRegistrationPayload(input.draft),
    resumeStep: normalizeResumeStep(input.resumeStep),
    handoffCode: normalizeEntitlementCode(input.handoffCode),
    paymentStatus: normalizePaymentStatus(input.paymentStatus),
    createdAt,
    updatedAt,
  };
}

export function normalizeBrowserPoolRegistrationResumeContext(
  rawContext: unknown,
): BrowserPoolRegistrationResumeContext | null {
  if (!isRecord(rawContext) || rawContext.kind !== "pool-registration") {
    return null;
  }

  const poolId = normalizeNonEmptyString(rawContext.poolId);
  const createdAt = normalizePositiveTimestamp(rawContext.createdAt);
  const updatedAt = normalizePositiveTimestamp(rawContext.updatedAt);
  const draft = normalizeEventPoolRegistrationPayload(
    rawContext.draft as EventPoolRegistrationPayload | null | undefined,
  );

  if (!poolId || !createdAt || Object.keys(draft).length === 0) {
    return null;
  }

  return {
    kind: "pool-registration",
    userId: normalizeNonEmptyString(rawContext.userId) ?? null,
    poolId,
    poolTitle: normalizeNonEmptyString(rawContext.poolTitle),
    poolArea: normalizeNonEmptyString(rawContext.poolArea),
    poolDate: normalizeNonEmptyString(rawContext.poolDate),
    poolEventType: normalizeNonEmptyString(rawContext.poolEventType),
    draft,
    resumeStep: normalizeResumeStep(rawContext.resumeStep),
    handoffCode: normalizeEntitlementCode(rawContext.handoffCode),
    paymentStatus: normalizePaymentStatus(rawContext.paymentStatus),
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  };
}

export function isBrowserPoolRegistrationResumeContextExpired(
  context: BrowserPoolRegistrationResumeContext,
  now = Date.now(),
): boolean {
  return now - context.updatedAt > BROWSER_POOL_REGISTRATION_RESUME_MAX_AGE_MS;
}

export function resolveBrowserPoolRegistrationResumeContext(input: {
  context: unknown;
  currentUserId?: string | null;
  now?: number;
}): BrowserPoolRegistrationResumeLookupResult {
  if (input.context === undefined || input.context === null || input.context === "") {
    return { status: "missing" };
  }

  const normalizedContext = normalizeBrowserPoolRegistrationResumeContext(input.context);
  if (!normalizedContext) {
    return { status: "clear", reason: "invalid-resume-context" };
  }

  if (isBrowserPoolRegistrationResumeContextExpired(normalizedContext, input.now)) {
    return { status: "clear", reason: "expired" };
  }

  const normalizedCurrentUserId = normalizeNonEmptyString(input.currentUserId);
  if (normalizedCurrentUserId) {
    if (
      !normalizedContext.userId ||
      normalizedContext.userId !== normalizedCurrentUserId
    ) {
      return { status: "clear", reason: "wrong-user" };
    }
  }

  return {
    status: "ready",
    context: normalizedContext,
  };
}

export function markBrowserPoolRegistrationResumeContextPaid(
  context: BrowserPoolRegistrationResumeContext,
  now = Date.now(),
): BrowserPoolRegistrationResumeContext {
  return {
    ...context,
    paymentStatus: "paid",
    updatedAt: now,
  };
}

export function getBrowserPoolRegistrationResumeBudget(
  context: BrowserPoolRegistrationResumeContext,
): string {
  return context.draft.barBudgetRange?.[0] ?? context.draft.budgetRange?.[0] ?? "";
}

export function getBrowserPoolRegistrationResumeNote(
  context: BrowserPoolRegistrationResumeContext,
): string {
  if (context.paymentStatus === "paid") {
    return "权益已经确认，回到报名页后可以直接完成这场报名。";
  }

  if (context.handoffCode === "NO_AVAILABLE_EVENT_PACK_CREDITS") {
    return "这次是为了续上活动权益。支付确认后会直接回到刚才那场报名。";
  }

  return "这次支付是为了继续刚才的报名。支付确认后会直接回到报名页。";
}

export function persistBrowserPoolRegistrationResumeContext(
  context: BrowserPoolRegistrationResumeContext,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    BROWSER_POOL_REGISTRATION_RESUME_CONTEXT_KEY,
    JSON.stringify(context),
  );
}

export function readStoredBrowserPoolRegistrationResumeContext(options?: {
  currentUserId?: string | null;
  now?: number;
}): BrowserPoolRegistrationResumeLookupResult {
  if (typeof window === "undefined") {
    return { status: "missing" };
  }

  let rawContext: string | null = null;

  try {
    rawContext = window.localStorage.getItem(BROWSER_POOL_REGISTRATION_RESUME_CONTEXT_KEY);
  } catch {
    return { status: "missing" };
  }

  if (!rawContext) {
    return { status: "missing" };
  }

  try {
    return resolveBrowserPoolRegistrationResumeContext({
      context: JSON.parse(rawContext),
      currentUserId: options?.currentUserId,
      now: options?.now,
    });
  } catch {
    return { status: "clear", reason: "invalid-resume-context" };
  }
}

export function clearStoredBrowserPoolRegistrationResumeContext(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BROWSER_POOL_REGISTRATION_RESUME_CONTEXT_KEY);
}