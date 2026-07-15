import {
  alangCoordinateSchema,
  type AlangCoordinate,
} from "./missionTypes.js";

export const ALANG_TEST_COORDINATE_SYSTEM = "gcj02" as const;
export const ALANG_TEST_MIN_DISTANCE_METERS = 10;
export const ALANG_TEST_RECOMMENDED_MIN_DISTANCE_METERS = 100;
export const ALANG_TEST_RECOMMENDED_MAX_DISTANCE_METERS = 300;
export const ALANG_TEST_MAX_DISTANCE_METERS = 2_000;

export type AlangTestPointValidationReason =
  | "invalid_coordinate"
  | "outside_gcj02_bounds"
  | "distance_too_short"
  | "distance_too_long";

export type AlangTestPointValidationResult =
  | {
      valid: true;
      targetLocation: AlangCoordinate;
      companionEndLocation: AlangCoordinate;
      distanceMeters: number;
    }
  | {
      valid: false;
      reason: AlangTestPointValidationReason;
    };

// GCJ-02 is defined for mainland China. These deliberately broad bounds reject
// 0/0, obvious latitude/longitude swaps and overseas coordinates without
// pretending to perform a coordinate-system conversion.
function isInsideGcj02Coverage(coordinate: AlangCoordinate): boolean {
  return coordinate.latitude >= 0.8293
    && coordinate.latitude <= 55.8271
    && coordinate.longitude >= 72.004
    && coordinate.longitude <= 137.8347;
}

export function alangHaversineDistanceMeters(
  from: AlangCoordinate,
  to: AlangCoordinate,
): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude)
      * Math.cos(toLatitude)
      * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine),
  );
}

export function validateAlangTestPointConfiguration(
  targetLocation: unknown,
  companionEndLocation: unknown,
): AlangTestPointValidationResult {
  const target = alangCoordinateSchema.safeParse(targetLocation);
  const companion = alangCoordinateSchema.safeParse(companionEndLocation);
  if (!target.success || !companion.success) {
    return { valid: false, reason: "invalid_coordinate" };
  }

  if (!isInsideGcj02Coverage(target.data) || !isInsideGcj02Coverage(companion.data)) {
    return { valid: false, reason: "outside_gcj02_bounds" };
  }

  const distanceMeters = alangHaversineDistanceMeters(target.data, companion.data);
  if (!Number.isFinite(distanceMeters)) {
    return { valid: false, reason: "invalid_coordinate" };
  }
  if (distanceMeters < ALANG_TEST_MIN_DISTANCE_METERS) {
    return { valid: false, reason: "distance_too_short" };
  }
  if (distanceMeters > ALANG_TEST_MAX_DISTANCE_METERS) {
    return { valid: false, reason: "distance_too_long" };
  }

  return {
    valid: true,
    targetLocation: target.data,
    companionEndLocation: companion.data,
    distanceMeters,
  };
}

export function isAbnormalAlangTestDistance(distanceMeters: unknown): boolean {
  return typeof distanceMeters !== "number"
    || !Number.isFinite(distanceMeters)
    || distanceMeters < 0
    || distanceMeters > ALANG_TEST_MAX_DISTANCE_METERS;
}
