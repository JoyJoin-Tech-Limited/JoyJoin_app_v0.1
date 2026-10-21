/**
 * P1c 游客预告卡 (对标平台 contract AC-08) — client-server contract tests.
 *
 * Three contracts locked without booting the heavy userEventPools route file:
 *   1. Flag registration: guestEventPreviewEnabled in FLAG_ENV_MAP (env
 *      GUEST_EVENT_PREVIEW_ENABLED) with an explicit false default, so the
 *      admin /admin/feature-flags toggle shows a stable dark default.
 *   2. Route wiring: GET /api/event-pools/guest-preview is registered in
 *      userEventPools.ts WITHOUT requireAuth, behind guestEventPreviewLimiter,
 *      BEFORE /api/event-pools/:id (param-route swallowing guard), and its
 *      handler never emits a status error page.
 *   3. DTO: the server projection keys match the shared Zod schema exactly,
 *      the schema is strict (extra PII keys fail parse), and no PII tokens
 *      appear in the projection.
 *
 * Contract: .git/.orchestration/sprints/sprint-contract.benchmark-full-implementation.md
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

const ROUTE_SOURCE_PATH = resolve(__dirname, "../routes/domains/userEventPools.ts");
const LIB_SOURCE_PATH = resolve(__dirname, "../lib/guestEventPreview.ts");

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import("../lib/featureFlags");
const {
  guestEventPreviewItemSchema,
  guestEventPreviewResponseSchema,
} = await import("@shared/api");

const PII_TOKEN_BLOCKLIST = [
  "userId",
  "displayName",
  "avatarUrl",
  "wechatOpenId",
  "wechatId",
  "phone",
  "email",
  "realName",
  "nickname",
  "gender",
  "age",
  "archetype",
  "openid",
];

// ── 1. flag registration ────────────────────────────────────────────────────

describe("guestEventPreviewEnabled flag registration", () => {
  it("maps to GUEST_EVENT_PREVIEW_ENABLED (DB-backed, admin-toggleable)", () => {
    expect(FLAG_ENV_MAP.guestEventPreviewEnabled).toBe("GUEST_EVENT_PREVIEW_ENABLED");
  });

  it("ships dark with an explicit false default", () => {
    expect(DEFAULT_FLAG_VALUES.guestEventPreviewEnabled).toBe(false);
  });
});

// ── 2. route wiring (source scan — the route file is too heavy to boot) ─────

describe("GET /api/event-pools/guest-preview route wiring", () => {
  const routeSource = readFileSync(ROUTE_SOURCE_PATH, "utf-8");
  const guestRegistrationIndex = routeSource.indexOf(
    'app.get("/api/event-pools/guest-preview"',
  );
  const detailRouteIndex = routeSource.indexOf('app.get("/api/event-pools/:id"');
  const handlerBlock = routeSource.slice(guestRegistrationIndex, detailRouteIndex);

  it("is registered in userEventPools.ts", () => {
    expect(guestRegistrationIndex).toBeGreaterThanOrEqual(0);
    expect(detailRouteIndex).toBeGreaterThanOrEqual(0);
  });

  it("is registered BEFORE /api/event-pools/:id so the param route cannot swallow it", () => {
    expect(guestRegistrationIndex).toBeLessThan(detailRouteIndex);
  });

  it("carries NO requireAuth (guests must reach it)", () => {
    expect(handlerBlock).not.toContain("requireAuth");
  });

  it("is rate-limited by guestEventPreviewLimiter", () => {
    expect(
      routeSource.match(
        /app\.get\("\/api\/event-pools\/guest-preview",\s*guestEventPreviewLimiter/,
      ),
    ).not.toBeNull();
  });

  it("delegates to buildGuestEventPreview and never emits an error status (fail-closed)", () => {
    expect(handlerBlock).toContain("buildGuestEventPreview");
    expect(handlerBlock).toContain("res.json(items)");
    expect(handlerBlock).not.toContain("res.status(");
  });
});

// ── 3. client-server DTO contract ───────────────────────────────────────────

describe("guest event preview DTO contract", () => {
  const libSource = readFileSync(LIB_SOURCE_PATH, "utf-8");
  const projectionMatch = libSource.match(
    /previewPools\.map\(\(pool\) => \(\s*\{([\s\S]*?)\}\s*\)\);/,
  );

  it("server projection exists in lib/guestEventPreview.ts", () => {
    expect(projectionMatch).not.toBeNull();
  });

  const projectionKeys = Array.from(
    projectionMatch?.[1].matchAll(/(\w+)\s*:/g) ?? [],
  ).map((match) => match[1]);
  const schemaKeys = Object.keys(guestEventPreviewItemSchema.shape).sort();

  it("projection keys exactly match the shared Zod schema", () => {
    expect(projectionKeys.sort()).toEqual(schemaKeys);
    expect(schemaKeys).toEqual(
      ["id", "title", "dateTime", "district", "eventType", "spotsLeft"].sort(),
    );
  });

  it("projection carries no PII tokens", () => {
    const projectionText = projectionMatch?.[1] ?? "";
    for (const token of PII_TOKEN_BLOCKLIST) {
      expect(projectionText).not.toContain(token);
    }
  });

  it("accepts a canonical server-shaped payload", () => {
    const payload = [
      {
        id: "pool-1",
        title: "周五夜聊酒局",
        dateTime: "2026-11-07T12:00:00.000Z",
        district: "南山区",
        eventType: "饭局",
        spotsLeft: 2,
      },
      {
        id: "pool-2",
        title: "周末微醺夜",
        dateTime: "2026-11-08T13:00:00.000Z",
        district: null,
        eventType: "酒局",
        spotsLeft: 0,
      },
      {
        id: "pool-3",
        title: "港风午茶",
        dateTime: "2026-11-09T06:00:00.000Z",
        district: "福田区",
        eventType: "饭局",
        spotsLeft: 6,
      },
    ];
    const parsed = guestEventPreviewResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toHaveLength(3);
    }
  });

  it("rejects items carrying extra PII keys (strict schema guard)", () => {
    const tainted = [
      {
        id: "pool-1",
        title: "周五夜聊酒局",
        dateTime: "2026-11-07T12:00:00.000Z",
        district: "南山区",
        eventType: "饭局",
        spotsLeft: 2,
        userId: "user-123",
        displayName: "张三",
      },
    ];
    expect(guestEventPreviewResponseSchema.safeParse(tainted).success).toBe(false);
  });

  it("rejects a negative or non-integer spotsLeft", () => {
    const base = {
      id: "pool-1",
      title: "周五夜聊酒局",
      dateTime: "2026-11-07T12:00:00.000Z",
      district: "南山区",
      eventType: "饭局",
    };
    expect(
      guestEventPreviewItemSchema.safeParse({ ...base, spotsLeft: -1 }).success,
    ).toBe(false);
    expect(
      guestEventPreviewItemSchema.safeParse({ ...base, spotsLeft: 1.5 }).success,
    ).toBe(false);
  });
});
