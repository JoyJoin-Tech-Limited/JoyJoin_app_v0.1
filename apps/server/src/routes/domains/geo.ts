import type {
  GeoCoordinate,
  GeoMapErrorCode,
  GeoPlace,
  GeoPlacesResponse,
  ReverseGeocodeResponse,
  WalkingRouteSuccessResponse,
} from "@shared/api";
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { geoEndpointLimiter, publicGeoEndpointLimiter } from "../../rateLimiter";

const TENCENT_MAP_BASE_URL = "https://apis.map.qq.com";
const TENCENT_MAP_TIMEOUT_MS = 4_000;
const CACHE_MAX_ENTRIES = 200;
const REVERSE_CACHE_TTL_MS = 5 * 60_000;
const PLACE_CACHE_TTL_MS = 60_000;
const WALKING_CACHE_TTL_MS = 30_000;
const MAX_WALKING_POLYLINE_POINTS = 2_000;
const MAX_WALKING_POLYLINE_CHARACTERS = 64_000;

const coordinateSchema = z.object({
  // Tencent Maps and the mini-program Map component both receive GCJ-02.
  // A numeric coordinate cannot self-identify its datum, so the API enforces
  // the GCJ-02 field contract and valid latitude/longitude ranges.
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

const reverseGeocodeSchema = coordinateSchema;

const suggestPlacesSchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  region: z.literal("深圳").optional().default("深圳"),
  location: coordinateSchema.optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
}).strict();

const searchPlacesSchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  location: coordinateSchema,
  radiusMeters: z.number().int().min(50).max(5_000).optional().default(1_000),
  limit: z.number().int().min(1).max(20).optional().default(10),
}).strict();

const walkingRouteSchema = z.object({
  from: coordinateSchema,
  to: coordinateSchema,
}).strict();

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh insertion order so the size bound behaves as a small LRU.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(entryKey);
    }

    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }

    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
  }
}

const reverseCache = new TtlCache<ReverseGeocodeResponse>(
  REVERSE_CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
);
const suggestionCache = new TtlCache<GeoPlacesResponse>(
  PLACE_CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
);
const searchCache = new TtlCache<GeoPlacesResponse>(
  PLACE_CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
);
const walkingCache = new TtlCache<WalkingRouteSuccessResponse>(
  WALKING_CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
);

type UpstreamErrorCode = "MAP_UPSTREAM_TIMEOUT" | "MAP_UPSTREAM_ERROR";

class TencentMapRequestError extends Error {
  constructor(readonly code: UpstreamErrorCode) {
    super(code);
    this.name = "TencentMapRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function isValidCoordinate(coordinate: GeoCoordinate): boolean {
  return coordinate.latitude >= -90
    && coordinate.latitude <= 90
    && coordinate.longitude >= -180
    && coordinate.longitude <= 180;
}

function readTencentStatus(payload: unknown): number | undefined {
  if (!isRecord(payload)) return undefined;
  return toFiniteNumber(payload.status);
}

function buildTencentUrl(
  path: string,
  apiKey: string,
  params: Record<string, string>,
): URL {
  const url = new URL(path, TENCENT_MAP_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);
  url.searchParams.set("output", "json");
  return url;
}

async function fetchTencentJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TENCENT_MAP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new TencentMapRequestError("MAP_UPSTREAM_ERROR");

    try {
      return await response.json();
    } catch {
      throw new TencentMapRequestError("MAP_UPSTREAM_ERROR");
    }
  } catch (error) {
    if (error instanceof TencentMapRequestError) throw error;

    const errorName = isRecord(error) ? toNonEmptyString(error.name) : undefined;
    if (controller.signal.aborted || errorName === "AbortError" || errorName === "TimeoutError") {
      throw new TencentMapRequestError("MAP_UPSTREAM_TIMEOUT");
    }
    throw new TencentMapRequestError("MAP_UPSTREAM_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

function mapTencentPlace(value: unknown): GeoPlace | null {
  if (!isRecord(value) || !isRecord(value.location)) return null;

  const latitude = toFiniteNumber(value.location.lat);
  const longitude = toFiniteNumber(value.location.lng);
  const id = toNonEmptyString(value.id);
  const name = toNonEmptyString(value.title) ?? toNonEmptyString(value.name);
  if (latitude === undefined || longitude === undefined || !id || !name) return null;

  const location: GeoCoordinate = { latitude, longitude };
  if (!isValidCoordinate(location)) return null;

  const place: GeoPlace = { id, name, location };
  const address = toNonEmptyString(value.address);
  const category = toNonEmptyString(value.category);
  const distance = toFiniteNumber(value._distance) ?? toFiniteNumber(value.distance);
  if (address) place.address = address;
  if (category) place.category = category;
  if (distance !== undefined && distance >= 0) place.distanceMeters = Math.round(distance);
  return place;
}

function decodeTencentPolyline(value: unknown): GeoCoordinate[] {
  let encoded: Array<number | undefined> = [];
  if (Array.isArray(value)) {
    if (value.length > MAX_WALKING_POLYLINE_POINTS * 2) return [];
    encoded = value.map(toFiniteNumber);
  } else if (typeof value === "string") {
    if (value.length > MAX_WALKING_POLYLINE_CHARACTERS) return [];
    const parts = value.split(",");
    if (parts.length > MAX_WALKING_POLYLINE_POINTS * 2) return [];
    encoded = parts.map(toFiniteNumber);
  }

  if (encoded.length < 4 || encoded.length % 2 !== 0 || encoded.some((item) => item === undefined)) {
    return [];
  }

  const decoded = encoded as number[];
  for (let index = 2; index < decoded.length; index += 1) {
    decoded[index] = decoded[index - 2] + decoded[index] / 1_000_000;
  }

  const points: GeoCoordinate[] = [];
  for (let index = 0; index < decoded.length; index += 2) {
    const point = {
      latitude: decoded[index],
      longitude: decoded[index + 1],
    };
    if (!isValidCoordinate(point)) return [];
    points.push(point);
  }
  return points;
}

function normalizeCity(value: unknown): string | undefined {
  return toNonEmptyString(value)?.replace(/市$/, "");
}

function detectDistrictFromCoords(latitude: number, longitude: number): string | null {
  const districts = [
    { name: "南山区", minLat: 22.45, maxLat: 22.60, minLng: 113.85, maxLng: 114.05 },
    { name: "福田区", minLat: 22.50, maxLat: 22.58, minLng: 114.00, maxLng: 114.15 },
    { name: "罗湖区", minLat: 22.52, maxLat: 22.60, minLng: 114.10, maxLng: 114.20 },
    { name: "宝安区", minLat: 22.52, maxLat: 22.85, minLng: 113.75, maxLng: 113.95 },
    { name: "龙岗区", minLat: 22.55, maxLat: 22.80, minLng: 114.15, maxLng: 114.45 },
  ];

  return districts.find((district) => (
    latitude >= district.minLat
    && latitude <= district.maxLat
    && longitude >= district.minLng
    && longitude <= district.maxLng
  ))?.name ?? null;
}

function buildLocalReverseFallback(
  coordinate: GeoCoordinate,
  code: GeoMapErrorCode,
): ReverseGeocodeResponse {
  const district = detectDistrictFromCoords(coordinate.latitude, coordinate.longitude);
  return {
    success: Boolean(district),
    city: district ? "深圳" : undefined,
    district: district ?? undefined,
    name: district ?? undefined,
    source: "local",
    code,
    error: district ? undefined : mapErrorMessage(code),
  };
}

function mapErrorMessage(code: GeoMapErrorCode): string {
  switch (code) {
    case "MAP_INVALID_REQUEST":
      return "地图请求参数不正确";
    case "MAP_NOT_CONFIGURED":
      return "地图服务暂未配置";
    case "MAP_UPSTREAM_TIMEOUT":
      return "地图服务响应超时";
    case "MAP_NO_ROUTE":
      return "暂未找到可用的步行路线";
    case "MAP_UPSTREAM_ERROR":
    default:
      return "地图服务暂时不可用";
  }
}

function statusForMapError(code: GeoMapErrorCode): number {
  switch (code) {
    case "MAP_INVALID_REQUEST":
      return 400;
    case "MAP_NO_ROUTE":
      return 404;
    case "MAP_NOT_CONFIGURED":
      return 503;
    case "MAP_UPSTREAM_TIMEOUT":
      return 504;
    case "MAP_UPSTREAM_ERROR":
    default:
      return 502;
  }
}

function sendMapFailure(
  res: Response,
  code: GeoMapErrorCode,
  extra: Record<string, unknown> = {},
): Response {
  return res.status(statusForMapError(code)).json({
    success: false,
    code,
    error: mapErrorMessage(code),
    ...extra,
  });
}

function logUpstreamFailure(
  req: Request,
  endpoint: string,
  code: GeoMapErrorCode,
  status?: number,
): void {
  logger.warn("[Geo] Tencent Maps request failed", {
    request_id: req.requestId,
    endpoint,
    code,
    upstreamStatus: status,
  });
}

function coordinateCacheKey(coordinate: GeoCoordinate): string {
  return `${coordinate.latitude.toFixed(6)},${coordinate.longitude.toFixed(6)}`;
}

function requireGeoProxyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!requireAuthenticatedUserId(req, res)) return;
  next();
}

export async function reverseGeocodeCoordinate(
  coordinate: GeoCoordinate,
  options: { cache?: boolean } = {},
): Promise<ReverseGeocodeResponse> {
  const useCache = options.cache !== false;
  const cacheKey = useCache ? coordinateCacheKey(coordinate) : null;
  if (cacheKey) {
    const cached = reverseCache.get(cacheKey);
    if (cached) return cached;
  }

  const apiKey = process.env.TENCENT_MAP_KEY;
  if (!apiKey) return buildLocalReverseFallback(coordinate, "MAP_NOT_CONFIGURED");

  const url = buildTencentUrl("/ws/geocoder/v1/", apiKey, {
    location: `${coordinate.latitude.toFixed(6)},${coordinate.longitude.toFixed(6)}`,
    get_poi: "1",
  });

  try {
    const payload = await fetchTencentJson(url);
    const status = readTencentStatus(payload);
    if (status !== 0 || !isRecord(payload) || !isRecord(payload.result)) {
      return buildLocalReverseFallback(coordinate, "MAP_UPSTREAM_ERROR");
    }

    const result = payload.result;
    const addressComponent = isRecord(result.address_component) ? result.address_component : {};
    const formattedAddresses = isRecord(result.formatted_addresses) ? result.formatted_addresses : {};
    const adInfo = isRecord(result.ad_info) ? result.ad_info : {};
    const poi = Array.isArray(result.pois)
      ? result.pois.map(mapTencentPlace).find((item): item is GeoPlace => item !== null)
      : undefined;
    const address = toNonEmptyString(result.address);
    const response: ReverseGeocodeResponse = {
      success: true,
      city: normalizeCity(addressComponent.city ?? addressComponent.province),
      district: toNonEmptyString(addressComponent.district),
      name: toNonEmptyString(formattedAddresses.recommend) ?? poi?.name ?? address,
      address,
      adcode: toNonEmptyString(adInfo.adcode ?? addressComponent.adcode),
      poi,
      source: "tencent",
    };
    if (cacheKey) reverseCache.set(cacheKey, response);
    return response;
  } catch (error) {
    const code = error instanceof TencentMapRequestError
      ? error.code
      : "MAP_UPSTREAM_ERROR";
    return buildLocalReverseFallback(coordinate, code);
  }
}

export function registerGeoRoutes(app: Express): void {
  app.post("/api/geo/reverse-geocode", publicGeoEndpointLimiter, async (req, res) => {
    const parsed = reverseGeocodeSchema.safeParse(req.body);
    if (!parsed.success) return sendMapFailure(res, "MAP_INVALID_REQUEST");

    const response = await reverseGeocodeCoordinate(parsed.data);
    if (response.source !== "tencent" && response.code) {
      logUpstreamFailure(req, "reverse-geocode", response.code);
    }
    return res.json(response);
  });

  app.post("/api/geo/ip-locate", publicGeoEndpointLimiter, async (req, res) => {
    const apiKey = process.env.TENCENT_MAP_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        source: "no_key",
        code: "MAP_NOT_CONFIGURED",
        error: mapErrorMessage("MAP_NOT_CONFIGURED"),
      });
    }

    const forwarded = req.headers["x-forwarded-for"];
    const clientIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const params: Record<string, string> = {};
    if (clientIp) params.ip = clientIp;
    const url = buildTencentUrl("/ws/location/v1/ip", apiKey, params);

    try {
      const payload = await fetchTencentJson(url);
      const status = readTencentStatus(payload);
      if (status !== 0 || !isRecord(payload) || !isRecord(payload.result)) {
        logUpstreamFailure(req, "ip-locate", "MAP_UPSTREAM_ERROR", status);
        return res.json({
          success: false,
          source: "tencent_ip",
          code: "MAP_UPSTREAM_ERROR",
          error: mapErrorMessage("MAP_UPSTREAM_ERROR"),
        });
      }

      return res.json({
        success: true,
        city: normalizeCity(payload.result.city ?? payload.result.adcode),
        province: toNonEmptyString(payload.result.province),
        source: "tencent_ip",
      });
    } catch (error) {
      const code = error instanceof TencentMapRequestError
        ? error.code
        : "MAP_UPSTREAM_ERROR";
      logUpstreamFailure(req, "ip-locate", code);
      return res.json({
        success: false,
        source: "error",
        code,
        error: mapErrorMessage(code),
      });
    }
  });

  app.post(
    "/api/geo/places/suggest",
    requireGeoProxyAuth,
    geoEndpointLimiter,
    async (req, res) => {
    const parsed = suggestPlacesSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendMapFailure(res, "MAP_INVALID_REQUEST", { places: [] });
    }

    const { keyword, region, location, limit } = parsed.data;
    const cacheKey = [
      keyword.toLocaleLowerCase("zh-CN"),
      region,
      location ? coordinateCacheKey(location) : "no-location",
      limit,
    ].join("|");
    const cached = suggestionCache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = process.env.TENCENT_MAP_KEY;
    if (!apiKey) {
      return sendMapFailure(res, "MAP_NOT_CONFIGURED", { places: [] });
    }

    const params: Record<string, string> = {
      keyword,
      region,
      region_fix: "1",
      page_index: "1",
      page_size: String(limit),
    };
    if (location) {
      params.location = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
    }
    const url = buildTencentUrl("/ws/place/v1/suggestion", apiKey, params);

    try {
      const payload = await fetchTencentJson(url);
      const status = readTencentStatus(payload);
      if (status !== 0 || !isRecord(payload) || !Array.isArray(payload.data)) {
        logUpstreamFailure(req, "places-suggest", "MAP_UPSTREAM_ERROR", status);
        return sendMapFailure(res, "MAP_UPSTREAM_ERROR", { places: [] });
      }

      const response: GeoPlacesResponse = {
        success: true,
        places: payload.data
          .map(mapTencentPlace)
          .filter((item): item is GeoPlace => item !== null)
          .slice(0, limit),
        source: "tencent",
      };
      suggestionCache.set(cacheKey, response);
      return res.json(response);
    } catch (error) {
      const code = error instanceof TencentMapRequestError
        ? error.code
        : "MAP_UPSTREAM_ERROR";
      logUpstreamFailure(req, "places-suggest", code);
      return sendMapFailure(res, code, { places: [] });
    }
    },
  );

  app.post(
    "/api/geo/places/search",
    requireGeoProxyAuth,
    geoEndpointLimiter,
    async (req, res) => {
    const parsed = searchPlacesSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendMapFailure(res, "MAP_INVALID_REQUEST", { places: [] });
    }

    const { keyword, location, radiusMeters, limit } = parsed.data;
    const cacheKey = [
      keyword.toLocaleLowerCase("zh-CN"),
      coordinateCacheKey(location),
      radiusMeters,
      limit,
    ].join("|");
    const cached = searchCache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = process.env.TENCENT_MAP_KEY;
    if (!apiKey) {
      return sendMapFailure(res, "MAP_NOT_CONFIGURED", { places: [] });
    }

    const url = buildTencentUrl("/ws/place/v1/search", apiKey, {
      keyword,
      boundary: `nearby(${location.latitude.toFixed(6)},${location.longitude.toFixed(6)},${radiusMeters})`,
      orderby: "_distance",
      page_index: "1",
      page_size: String(limit),
    });

    try {
      const payload = await fetchTencentJson(url);
      const status = readTencentStatus(payload);
      if (status !== 0 || !isRecord(payload) || !Array.isArray(payload.data)) {
        logUpstreamFailure(req, "places-search", "MAP_UPSTREAM_ERROR", status);
        return sendMapFailure(res, "MAP_UPSTREAM_ERROR", { places: [] });
      }

      const response: GeoPlacesResponse = {
        success: true,
        places: payload.data
          .map(mapTencentPlace)
          .filter((item): item is GeoPlace => item !== null)
          .slice(0, limit),
        source: "tencent",
      };
      searchCache.set(cacheKey, response);
      return res.json(response);
    } catch (error) {
      const code = error instanceof TencentMapRequestError
        ? error.code
        : "MAP_UPSTREAM_ERROR";
      logUpstreamFailure(req, "places-search", code);
      return sendMapFailure(res, code, { places: [] });
    }
    },
  );

  app.post(
    "/api/geo/walking-route",
    requireGeoProxyAuth,
    geoEndpointLimiter,
    async (req, res) => {
    const parsed = walkingRouteSchema.safeParse(req.body);
    if (!parsed.success) return sendMapFailure(res, "MAP_INVALID_REQUEST");

    const { from, to } = parsed.data;
    const cacheKey = `${coordinateCacheKey(from)}|${coordinateCacheKey(to)}`;
    const cached = walkingCache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = process.env.TENCENT_MAP_KEY;
    if (!apiKey) return sendMapFailure(res, "MAP_NOT_CONFIGURED");

    const url = buildTencentUrl("/ws/direction/v1/walking", apiKey, {
      from: `${from.latitude.toFixed(6)},${from.longitude.toFixed(6)}`,
      to: `${to.latitude.toFixed(6)},${to.longitude.toFixed(6)}`,
    });

    try {
      const payload = await fetchTencentJson(url);
      const status = readTencentStatus(payload);
      if (status !== 0 || !isRecord(payload) || !isRecord(payload.result)) {
        logUpstreamFailure(req, "walking-route", "MAP_UPSTREAM_ERROR", status);
        return sendMapFailure(res, "MAP_UPSTREAM_ERROR");
      }

      const routes = payload.result.routes;
      if (!Array.isArray(routes) || !isRecord(routes[0])) {
        return sendMapFailure(res, "MAP_NO_ROUTE");
      }

      const route = routes[0];
      const distanceMeters = toFiniteNumber(route.distance);
      const durationSeconds = toFiniteNumber(route.duration);
      const polyline = decodeTencentPolyline(route.polyline);
      if (
        distanceMeters === undefined
        || durationSeconds === undefined
        || distanceMeters < 0
        || durationSeconds < 0
        || polyline.length < 2
      ) {
        logUpstreamFailure(req, "walking-route", "MAP_UPSTREAM_ERROR", status);
        return sendMapFailure(res, "MAP_UPSTREAM_ERROR");
      }

      const response: WalkingRouteSuccessResponse = {
        success: true,
        distanceMeters: Math.round(distanceMeters),
        durationSeconds: Math.round(durationSeconds),
        polyline,
        source: "tencent",
      };
      walkingCache.set(cacheKey, response);
      return res.json(response);
    } catch (error) {
      const code = error instanceof TencentMapRequestError
        ? error.code
        : "MAP_UPSTREAM_ERROR";
      logUpstreamFailure(req, "walking-route", code);
      return sendMapFailure(res, code);
    }
    },
  );
}
