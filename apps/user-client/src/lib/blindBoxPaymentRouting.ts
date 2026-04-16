import type { PoolRegistrationSummary } from "@shared/api";

import {
  type BrowserPoolRegistrationResumeContext,
} from "@/lib/poolRegistrationResume";
import { getDiscoverJoinRoute } from "@/lib/poolRegistrationRouting";

export const BLIND_BOX_PAYMENT_MODE_ENTITLEMENT_RESUME = "entitlement-resume";

export type BrowserPendingOrderType = "event" | "event_bundle" | "entitlement_resume";
export type BrowserPaymentPageMode = "default" | "entitlement-resume";

export interface BrowserPendingOrderContext {
  type?: BrowserPendingOrderType;
  eventRegistration?: {
    poolId?: string | null;
  } | null;
  returnContext?: BrowserPoolRegistrationResumeContext | null;
}

export interface BlindBoxConfirmationDestination {
  kind: "discover" | "events" | "matching" | "registration";
  label: string;
  path: string;
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildEventBrowserPendingOrderContext(
  eventData: unknown,
): BrowserPendingOrderContext {
  const poolId =
    eventData && typeof eventData === "object"
      ? getNonEmptyString((eventData as Record<string, unknown>).poolId)
      : null;

  return {
    type: "event",
    eventRegistration: poolId ? { poolId } : null,
  };
}

export function buildEntitlementResumeBrowserPendingOrderContext(
  returnContext: BrowserPoolRegistrationResumeContext,
): BrowserPendingOrderContext {
  return {
    type: "entitlement_resume",
    returnContext,
  };
}

export function getBlindBoxPaymentPageModeFromUrl(url: string): BrowserPaymentPageMode {
  const normalizedUrl = url.split("#")[0];
  const query = normalizedUrl.includes("?")
    ? normalizedUrl.slice(normalizedUrl.indexOf("?"))
    : "";
  const mode = new URLSearchParams(query).get("mode");

  return mode === BLIND_BOX_PAYMENT_MODE_ENTITLEMENT_RESUME
    ? "entitlement-resume"
    : "default";
}

export function getBlindBoxEntitlementResumePaymentRoute(): string {
  return `/blindbox/payment?mode=${encodeURIComponent(BLIND_BOX_PAYMENT_MODE_ENTITLEMENT_RESUME)}`;
}

export function resolveEventPaymentRegistrationId(
  registrations: PoolRegistrationSummary[] | null | undefined,
  context: BrowserPendingOrderContext | null | undefined,
): string | null {
  const poolId = getNonEmptyString(context?.eventRegistration?.poolId);
  if (!poolId || !registrations?.length) {
    return null;
  }

  const candidates = registrations.filter(
    (registration) => getNonEmptyString(registration.poolId) === poolId,
  );

  if (candidates.length === 0) {
    return null;
  }

  const candidate =
    candidates.find((registration) => registration.matchStatus === "pending") ??
    candidates.find((registration) => registration.matchStatus === "matched") ??
    candidates.find((registration) => registration.matchStatus === "unmatched") ??
    candidates.find((registration) => registration.matchStatus !== "completed") ??
    candidates[0];

  return getNonEmptyString(candidate?.id);
}

export function getBlindBoxConfirmationDestination(
  context: BrowserPendingOrderContext | null | undefined,
  registrationId?: string | null,
): BlindBoxConfirmationDestination {
  if (context?.type === "entitlement_resume") {
    const poolId = getNonEmptyString(context.returnContext?.poolId);

    if (poolId) {
      return {
        kind: "registration",
        label: "报名页",
        path: getDiscoverJoinRoute(poolId),
      };
    }
  }

  if (context?.type === "event" && registrationId) {
    return {
      kind: "matching",
      label: "匹配进度",
      path: `/pool-matching/${registrationId}`,
    };
  }

  if (context?.type === "event") {
    return {
      kind: "events",
      label: "活动页",
      path: "/events",
    };
  }

  return {
    kind: "discover",
    label: "探索页",
    path: "/discover",
  };
}
