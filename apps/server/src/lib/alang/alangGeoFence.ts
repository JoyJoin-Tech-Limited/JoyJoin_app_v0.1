import type { AlangProgressStage, AlangGpsPoint } from "@shared/alang/missionTypes";
import {
  ALANG_ARRIVAL_RADIUS_METERS,
  ALANG_ARRIVAL_MIN_STABLE_COUNT,
  ALANG_GPS_DESIRED_ACCURACY,
} from "@shared/alang/constants";

export interface GpsArrivalResult {
  arrived: boolean;
  distanceMeters: number;
  radiusMeters: number;
  stableCount: number;
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function checkGpsArrival(
  userLat: number,
  userLng: number,
  target: { lat: number; lng: number; radiusMeters?: number },
  history: AlangGpsPoint[]
): GpsArrivalResult {
  const radiusMeters = target.radiusMeters ?? ALANG_ARRIVAL_RADIUS_METERS;
  const distanceMeters = haversine(userLat, userLng, target.lat, target.lng);

  if (distanceMeters > radiusMeters) {
    return { arrived: false, distanceMeters, radiusMeters, stableCount: 0 };
  }

  // `history` includes the current report. Count each point exactly once.
  const recent = history.slice(-ALANG_ARRIVAL_MIN_STABLE_COUNT);
  let stableCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const p = recent[i];
    const d = haversine(p.lat, p.lng, target.lat, target.lng);
    const accuracyIsStable = p.accuracy === undefined || p.accuracy <= ALANG_GPS_DESIRED_ACCURACY;
    if (d <= radiusMeters && accuracyIsStable) {
      stableCount++;
    } else {
      break;
    }
  }

  return {
    arrived: stableCount >= ALANG_ARRIVAL_MIN_STABLE_COUNT,
    distanceMeters,
    radiusMeters,
    stableCount,
  };
}

export function computeStageFromNodeType(nodeType: string): AlangProgressStage {
  switch (nodeType) {
    case "event_card":
      return "not_started";
    case "event_detail":
      return "configuring";
    case "search_gate":
      return "searching";
    case "found_scene":
      return "found";
    case "dialogue":
      return "dialogue";
    case "companion_start":
    case "companion_move":
      return "companion";
    case "arrival_gate":
    case "user_confirm":
      return "arrived";
    case "closing":
      return "closing";
    case "result_card":
      return "result";
    default:
      return "not_started";
  }
}

export function shouldAutoAdvance(nodeType: string): boolean {
  return ["event_card", "event_detail", "found_scene", "companion_start", "closing", "result_card"].includes(nodeType);
}

export function isGpsNode(nodeType: string): boolean {
  return ["search_gate", "companion_move"].includes(nodeType);
}
