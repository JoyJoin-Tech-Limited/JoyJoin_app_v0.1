import type { Request } from "express";
import {
  getLocationFromIP,
  getPrivacySafeIpIdentifiers,
  type LocationEventType,
} from "../services/ipGeolocationService.js";
import {
  insertUserLocationSnapshot,
  refreshAggregateForDateCityEvent,
} from "../repositories/userLocationRepo.js";
import { logger } from "./logger.js";

export function getClientIP(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  const raw =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (Array.isArray(forwarded) ? forwarded[0] : undefined);
  const ip = raw || req.socket?.remoteAddress || req.ip || null;
  return ip || null;
}

export async function captureLocationSnapshot(
  req: Request,
  eventType: LocationEventType,
  userId: string | null
): Promise<void> {
  const ip = getClientIP(req);
  if (!ip) {
    logger.debug("[captureLocationSnapshot] No client IP available");
    return;
  }

  const location = getLocationFromIP(ip);
  const { hashedIp, anonymizedIp, saltDate } = getPrivacySafeIpIdentifiers(ip);

  try {
    await insertUserLocationSnapshot({
      userId,
      eventType,
      hashedIp,
      anonymizedIp,
      ipSaltDate: saltDate,
      country: location.country,
      province: location.province,
      city: location.city,
      district: location.district,
      isp: location.isp,
      isMainland: location.isMainland,
      lookupSource: location.source,
    });

    // Keep aggregates fresh in near-real-time.
    await refreshAggregateForDateCityEvent(
      saltDate,
      location.province ?? "未知",
      location.city ?? "未知",
      eventType
    );
  } catch (err) {
    // Capture is best-effort; never block the user flow.
    logger.warn("[captureLocationSnapshot] Failed to persist location snapshot", { err, eventType, userId });
  }
}
