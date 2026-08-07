import { createHash } from "node:crypto";

import { FLASH_SHENZHEN_BOUNDS } from "@shared/alang/flashTypes";

import shenzhenBoundaryData from "../data/flash/shenzhen-boundary-gcj02.json";

type Position = readonly [longitude: number, latitude: number];
type LinearRing = readonly Position[];
type Polygon = readonly LinearRing[];
type FlashBoundaryFeature = {
  properties: {
    adcode: number;
    parent?: { adcode?: number };
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: Polygon | readonly Polygon[];
  };
};
type FlashBoundaryCollection = {
  type: "FeatureCollection";
  features: FlashBoundaryFeature[];
};

const SHENZHEN_ADCODE = 440300;
const EXPECTED_BOUNDARY_SEMANTIC_SHA256 = "b691faa581d9330e6dc738dcd11421958ca2d4ddea271b656a56237f9fa6fb0b";
const EXPECTED_DISTRICT_ADCODES = new Set([
  440303,
  440304,
  440305,
  440306,
  440307,
  440308,
  440309,
  440310,
  440311,
]);
const boundary = shenzhenBoundaryData as unknown as FlashBoundaryCollection;

function isPosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number"
    && Number.isFinite(value[0])
    && typeof value[1] === "number"
    && Number.isFinite(value[1]);
}

function isPolygonCoordinates(value: unknown): value is Polygon {
  return Array.isArray(value)
    && value.length > 0
    && value.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(isPosition));
}

function isBoundaryAssetValid(value: FlashBoundaryCollection): boolean {
  if (
    value.type !== "FeatureCollection"
    || !Array.isArray(value.features)
    || value.features.length !== EXPECTED_DISTRICT_ADCODES.size
  ) return false;
  const adcodes = new Set<number>();
  for (const feature of value.features) {
    if (!EXPECTED_DISTRICT_ADCODES.has(feature?.properties?.adcode)) return false;
    if (feature.properties.parent?.adcode !== SHENZHEN_ADCODE) return false;
    if (feature.geometry?.type === "Polygon") {
      if (!isPolygonCoordinates(feature.geometry.coordinates)) return false;
    } else if (feature.geometry?.type === "MultiPolygon") {
      if (!Array.isArray(feature.geometry.coordinates)
        || feature.geometry.coordinates.length === 0
        || !feature.geometry.coordinates.every(isPolygonCoordinates)) return false;
    } else {
      return false;
    }
    adcodes.add(feature.properties.adcode);
  }
  return adcodes.size === EXPECTED_DISTRICT_ADCODES.size
    && [...EXPECTED_DISTRICT_ADCODES].every((adcode) => adcodes.has(adcode));
}

const boundarySemanticSha256 = createHash("sha256").update(JSON.stringify(boundary)).digest("hex");
const boundaryAssetValid = boundarySemanticSha256 === EXPECTED_BOUNDARY_SEMANTIC_SHA256
  && isBoundaryAssetValid(boundary);

export function isFlashShenzhenBoundaryAssetValid(): boolean {
  return boundaryAssetValid;
}

export function isFlashShenzhenBoundaryLicenseApproved(): boolean {
  return process.env.FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256?.trim().toLowerCase()
    === EXPECTED_BOUNDARY_SEMANTIC_SHA256;
}

export function isFlashShenzhenBoundaryReady(): boolean {
  return boundaryAssetValid && isFlashShenzhenBoundaryLicenseApproved();
}

function pointOnSegment(latitude: number, longitude: number, start: Position, end: Position): boolean {
  const [startLongitude, startLatitude] = start;
  const [endLongitude, endLatitude] = end;
  const cross = (longitude - startLongitude) * (endLatitude - startLatitude)
    - (latitude - startLatitude) * (endLongitude - startLongitude);
  if (Math.abs(cross) > 1e-10) return false;
  return longitude >= Math.min(startLongitude, endLongitude) - 1e-10
    && longitude <= Math.max(startLongitude, endLongitude) + 1e-10
    && latitude >= Math.min(startLatitude, endLatitude) - 1e-10
    && latitude <= Math.max(startLatitude, endLatitude) + 1e-10;
}

function pointInRing(latitude: number, longitude: number, ring: LinearRing): boolean {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const currentPoint = ring[current];
    const previousPoint = ring[previous];
    if (pointOnSegment(latitude, longitude, previousPoint, currentPoint)) return true;
    const [currentLongitude, currentLatitude] = currentPoint;
    const [previousLongitude, previousLatitude] = previousPoint;
    const crossesLatitude = (currentLatitude > latitude) !== (previousLatitude > latitude);
    if (!crossesLatitude) continue;
    const boundaryLongitude = ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
      / (previousLatitude - currentLatitude)
      + currentLongitude;
    if (longitude < boundaryLongitude) inside = !inside;
  }
  return inside;
}

function pointInPolygon(latitude: number, longitude: number, polygon: Polygon): boolean {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(latitude, longitude, outerRing)) return false;
  return holes.every((hole) => !pointInRing(latitude, longitude, hole));
}

export function isWithinFlashShenzhenBoundary(latitude: number, longitude: number): boolean {
  if (!boundaryAssetValid || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (
    latitude < FLASH_SHENZHEN_BOUNDS.minLatitude
    || latitude > FLASH_SHENZHEN_BOUNDS.maxLatitude
    || longitude < FLASH_SHENZHEN_BOUNDS.minLongitude
    || longitude > FLASH_SHENZHEN_BOUNDS.maxLongitude
  ) return false;

  return boundary.features.some((feature) => {
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as Polygon]
      : feature.geometry.coordinates as readonly Polygon[];
    return polygons.some((polygon) => pointInPolygon(latitude, longitude, polygon));
  });
}
