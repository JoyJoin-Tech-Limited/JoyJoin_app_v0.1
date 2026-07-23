import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withServerForApp as withServer } from "../test-utils/withServer";

const realFetch = globalThis.fetch;
const originalTencentMapKey = process.env.TENCENT_MAP_KEY;
let upstreamFetch: ReturnType<typeof vi.fn<typeof fetch>>;

interface WalkingRouteBody {
  success: boolean;
  distanceMeters: number;
  durationSeconds: number;
  source: string;
  polyline: Array<{ latitude: number; longitude: number }>;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchProxy(): void {
  upstreamFetch = vi.fn<typeof fetch>();
  const fetchProxy: typeof fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://apis.map.qq.com")) {
      return upstreamFetch(input, init);
    }
    return realFetch(input, init);
  };
  vi.stubGlobal("fetch", fetchProxy);
}

async function buildTestApp(authenticated = true) {
  const { registerGeoRoutes } = await import("../routes/domains/geo");
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      (req as any).user = { id: "geo-test-user" };
      next();
    });
  }
  registerGeoRoutes(app);
  return app;
}

async function buildAdminTestApp() {
  const { registerGeoRoutes } = await import("../routes/domains/geo");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { adminAccountId: "geo-test-admin" };
    next();
  });
  registerGeoRoutes(app);
  return app;
}

async function postJson(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  body: unknown,
): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("geo routes", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TENCENT_MAP_KEY = "test-tencent-map-key";
    installFetchProxy();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalTencentMapKey === undefined) {
      delete process.env.TENCENT_MAP_KEY;
    } else {
      process.env.TENCENT_MAP_KEY = originalTencentMapKey;
    }
  });

  it("validates the public latitude/longitude request contract", async () => {
    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/search", {
        keyword: "公园",
        location: { lat: 22.5431, lng: 114.0579 },
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "MAP_INVALID_REQUEST",
        places: [],
      });
      expect(upstreamFetch).not.toHaveBeenCalled();
    });
  });

  it("rejects unauthenticated access to metered place and route proxies", async () => {
    const app = await buildTestApp(false);
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/suggest", {
        keyword: "公园",
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
      expect(upstreamFetch).not.toHaveBeenCalled();
    });
  });

  it("allows an authenticated admin session to use metered place search", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      data: [{
        id: "poi-admin",
        title: "深圳人才公园",
        address: "南山区科苑南路",
        location: { lat: 22.5111, lng: 113.9421 },
      }],
    }));

    const app = await buildAdminTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/suggest", {
        keyword: "人才公园",
        location: { latitude: 22.5431, longitude: 114.0579 },
        limit: 5,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        places: [{ id: "poi-admin", name: "深圳人才公园" }],
      });
    });
  });

  it("rate limits login-free reverse geocoding and IP location by client IP", async () => {
    upstreamFetch.mockResolvedValue(jsonResponse({
      status: 0,
      result: {
        address: "广东省深圳市南山区",
        address_component: { city: "深圳市", district: "南山区" },
        ad_info: { adcode: 440305 },
      },
    }));

    const app = await buildTestApp(false);
    await withServer(app, async (_baseUrl, request) => {
      for (let index = 0; index < 60; index += 1) {
        const response = await postJson(request, "/api/geo/reverse-geocode", {
          latitude: 22.54042,
          longitude: 113.93457,
        });
        expect(response.status).toBe(200);
      }

      const limited = await postJson(request, "/api/geo/ip-locate", {});
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBeTruthy();
      await expect(limited.json()).resolves.toMatchObject({
        message: "请求过于频繁，请稍后再试",
      });
      expect(upstreamFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("extends reverse geocoding with name, address, POI, and adcode", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      message: "query ok",
      result: {
        address: "广东省深圳市南山区深南大道10000号",
        formatted_addresses: { recommend: "腾讯大厦" },
        address_component: {
          province: "广东省",
          city: "深圳市",
          district: "南山区",
        },
        ad_info: { adcode: 440305 },
        pois: [{
          id: "poi-tencent-building",
          title: "腾讯大厦",
          address: "深南大道10000号",
          category: "房产小区:商务楼宇",
          _distance: 18,
          location: { lat: 22.54042, lng: 113.93457 },
        }],
      },
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/reverse-geocode", {
        latitude: 22.54042,
        longitude: 113.93457,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        city: "深圳",
        district: "南山区",
        name: "腾讯大厦",
        address: "广东省深圳市南山区深南大道10000号",
        adcode: "440305",
        source: "tencent",
        poi: {
          id: "poi-tencent-building",
          name: "腾讯大厦",
          distanceMeters: 18,
          location: { latitude: 22.54042, longitude: 113.93457 },
        },
      });

      const upstreamUrl = new URL(String(upstreamFetch.mock.calls[0]?.[0]));
      expect(upstreamUrl.pathname).toBe("/ws/geocoder/v1/");
      expect(upstreamUrl.searchParams.get("get_poi")).toBe("1");
    });
  });

  it("maps suggestion results and serves identical requests from the TTL cache", async () => {
    upstreamFetch.mockResolvedValue(jsonResponse({
      status: 0,
      count: 1,
      data: [{
        id: "poi-park",
        title: "深圳人才公园",
        address: "科苑南路3329号",
        category: "旅游景点:公园",
        _distance: 321.4,
        location: { lat: 22.5133, lng: 113.9454 },
      }],
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const requestBody = {
        keyword: "人才公园",
        region: "深圳",
        location: { latitude: 22.5431, longitude: 114.0579 },
        limit: 5,
      };
      const first = await postJson(request, "/api/geo/places/suggest", requestBody);
      const second = await postJson(request, "/api/geo/places/suggest", requestBody);

      expect(first.status).toBe(200);
      await expect(first.json()).resolves.toMatchObject({
        success: true,
        source: "tencent",
        places: [{
          id: "poi-park",
          name: "深圳人才公园",
          category: "旅游景点:公园",
          distanceMeters: 321,
          location: { latitude: 22.5133, longitude: 113.9454 },
        }],
      });
      expect(second.status).toBe(200);
      expect(upstreamFetch).toHaveBeenCalledTimes(1);

      const upstreamUrl = new URL(String(upstreamFetch.mock.calls[0]?.[0]));
      expect(upstreamUrl.searchParams.get("region")).toBe("深圳");
      expect(upstreamUrl.searchParams.get("page_size")).toBe("5");
    });
  });

  it("maps nearby search results and distances", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      count: 1,
      data: [{
        id: "poi-store",
        title: "便利店",
        address: "福田区测试路1号",
        category: "购物:便利店",
        _distance: 86,
        location: { lat: 22.5435, lng: 114.0583 },
      }],
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/search", {
        keyword: "便利店",
        location: { latitude: 22.5431, longitude: 114.0579 },
        radiusMeters: 800,
        limit: 3,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        places: [{ id: "poi-store", name: "便利店", distanceMeters: 86 }],
      });

      const upstreamUrl = new URL(String(upstreamFetch.mock.calls[0]?.[0]));
      expect(upstreamUrl.pathname).toBe("/ws/place/v1/search");
      expect(upstreamUrl.searchParams.get("boundary"))
        .toBe("nearby(22.543100,114.057900,800)");
    });
  });

  it("returns MAP_NOT_CONFIGURED without calling Tencent when the key is missing", async () => {
    delete process.env.TENCENT_MAP_KEY;
    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/suggest", {
        keyword: "公园",
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "MAP_NOT_CONFIGURED",
        places: [],
      });
      expect(upstreamFetch).not.toHaveBeenCalled();
    });
  });

  it("maps a non-zero Tencent status to MAP_UPSTREAM_ERROR", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 199,
      message: "key unavailable",
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/search", {
        keyword: "长椅",
        location: { latitude: 22.5441, longitude: 114.0589 },
      });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "MAP_UPSTREAM_ERROR",
        places: [],
      });
    });
  });

  it("maps an aborted Tencent request to MAP_UPSTREAM_TIMEOUT", async () => {
    const abortError = new Error("request aborted");
    abortError.name = "AbortError";
    upstreamFetch.mockRejectedValueOnce(abortError);

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/places/suggest", {
        keyword: "咖啡",
        location: { latitude: 22.5451, longitude: 114.0599 },
      });

      expect(response.status).toBe(504);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "MAP_UPSTREAM_TIMEOUT",
        places: [],
      });
    });
  });

  it("decodes Tencent's compressed walking polyline into latitude/longitude points", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      result: {
        routes: [{
          distance: 1250.4,
          duration: 901.2,
          polyline: [22.5431, 114.0579, 500, 600, 400, -200],
        }],
      },
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/walking-route", {
        from: { latitude: 22.5431, longitude: 114.0579 },
        to: { latitude: 22.544, longitude: 114.0583 },
      });
      const body = await response.json() as WalkingRouteBody;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        distanceMeters: 1250,
        durationSeconds: 901,
        source: "tencent",
      });
      expect(body.polyline).toHaveLength(3);
      expect(body.polyline[0].latitude).toBeCloseTo(22.5431, 6);
      expect(body.polyline[0].longitude).toBeCloseTo(114.0579, 6);
      expect(body.polyline[1].latitude).toBeCloseTo(22.5436, 6);
      expect(body.polyline[1].longitude).toBeCloseTo(114.0585, 6);
      expect(body.polyline[2].latitude).toBeCloseTo(22.544, 6);
      expect(body.polyline[2].longitude).toBeCloseTo(114.0583, 6);
    });
  });

  it("returns MAP_NO_ROUTE instead of fabricating a walking route", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      result: { routes: [] },
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/walking-route", {
        from: { latitude: 22.5461, longitude: 114.0609 },
        to: { latitude: 22.5471, longitude: 114.0619 },
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        success: false,
        code: "MAP_NO_ROUTE",
        error: "暂未找到可用的步行路线",
      });
    });
  });

  it("rejects an oversized upstream walking polyline instead of caching it", async () => {
    upstreamFetch.mockResolvedValueOnce(jsonResponse({
      status: 0,
      result: {
        routes: [{
          distance: 100,
          duration: 90,
          polyline: new Array(4_002).fill(1),
        }],
      },
    }));

    const app = await buildTestApp();
    await withServer(app, async (_baseUrl, request) => {
      const response = await postJson(request, "/api/geo/walking-route", {
        from: { latitude: 22.55, longitude: 114.06 },
        to: { latitude: 22.551, longitude: 114.061 },
      });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "MAP_UPSTREAM_ERROR",
      });
    });
  });
});
