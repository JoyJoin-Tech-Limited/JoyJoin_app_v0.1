import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSchemaReady: vi.fn(),
  list: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("../repositories/flashRepo", () => ({
  isFlashSchemaReady: mocks.isSchemaReady,
  listActiveFlashManualHolds: mocks.list,
  startFlashManualHold: mocks.start,
  stopFlashManualHold: mocks.stop,
}));
vi.mock("../services/flashService", () => ({
  isFlashManualHoldRuntimeAvailable: (appMode?: string) => appMode === "staging",
}));

const {
  getFlashManualHoldStatus,
  startFlashManualHoldForAdmin,
  stopFlashManualHoldForAdmin,
} = await import("../services/flashManualHoldService");

const row = {
  appearanceId: "11111111-1111-4111-8111-111111111111",
  startsAt: new Date("2026-08-08T15:00:00.000Z"),
  startedBy: "admin-1",
  npcId: "22222222-2222-4222-8222-222222222222",
  npcSlug: "shiqi",
  npcName: "拾柒",
  locationId: "33333333-3333-4333-8333-333333333333",
  locationName: "深圳人才公园",
  district: "南山区",
  locationAddress: "人才公园开放公共区域",
};

describe("staging-only Flash manual hold service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_MODE", "production");
    mocks.isSchemaReady.mockResolvedValue(true);
    mocks.list.mockResolvedValue([row]);
    mocks.start.mockResolvedValue({ ok: true, created: true, hold: row });
    mocks.stop.mockResolvedValue({ ...row, endsAt: new Date("2026-08-08T16:00:00.000Z") });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(["production", "", undefined])("fails closed outside staging (%s)", async (appMode) => {
    await expect(startFlashManualHoldForAdmin({
      npcId: row.npcId,
      locationId: row.locationId,
      actorId: "admin-1",
      appMode,
    })).rejects.toMatchObject({ code: "FLASH_MANUAL_HOLD_PRODUCTION_FORBIDDEN", status: 403 });
    expect(mocks.isSchemaReady).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("returns only safe operational metadata from staging status", async () => {
    const status = await getFlashManualHoldStatus("staging");
    expect(status).toEqual({
      available: true,
      schemaReady: true,
      activeHolds: [{
        appearanceId: row.appearanceId,
        startedAt: "2026-08-08T15:00:00.000Z",
        npc: { id: row.npcId, slug: "shiqi", name: "拾柒" },
        location: {
          id: row.locationId,
          name: "深圳人才公园",
          district: "南山区",
          address: "人才公园开放公共区域",
        },
      }],
    });
    expect(JSON.stringify(status)).not.toContain("latitude");
    expect(JSON.stringify(status)).not.toContain("longitude");
  });

  it("preserves idempotent repository starts and maps eligibility conflicts", async () => {
    mocks.start.mockResolvedValueOnce({ ok: true, created: false, hold: row });
    await expect(startFlashManualHoldForAdmin({
      npcId: row.npcId,
      locationId: row.locationId,
      actorId: "admin-1",
      appMode: "staging",
    })).resolves.toMatchObject({ created: false, hold: { appearanceId: row.appearanceId } });

    mocks.start.mockResolvedValueOnce({ ok: false, code: "FLASH_MANUAL_HOLD_NOT_ELIGIBLE" });
    await expect(startFlashManualHoldForAdmin({
      npcId: row.npcId,
      locationId: row.locationId,
      actorId: "admin-1",
      appMode: "staging",
    })).rejects.toMatchObject({ code: "FLASH_MANUAL_HOLD_NOT_ELIGIBLE", status: 409 });
  });

  it("fails before writing when the additive schema is not ready", async () => {
    mocks.isSchemaReady.mockResolvedValueOnce(false);

    await expect(startFlashManualHoldForAdmin({
      npcId: row.npcId,
      locationId: row.locationId,
      actorId: "admin-1",
      appMode: "staging",
    })).rejects.toMatchObject({ code: "FLASH_MANUAL_HOLD_SCHEMA_NOT_READY", status: 503 });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it.each([
    ["FLASH_MANUAL_HOLD_SCHEDULED_CONFLICT", "正在正式班次"],
    ["FLASH_MANUAL_HOLD_LOCATION_CONFLICT", "另一个地点"],
  ] as const)("maps repository conflict %s to an actionable 409", async (code, message) => {
    mocks.start.mockResolvedValueOnce({ ok: false, code });

    await expect(startFlashManualHoldForAdmin({
      npcId: row.npcId,
      locationId: row.locationId,
      actorId: "admin-1",
      appMode: "staging",
    })).rejects.toMatchObject({ code, status: 409, message: expect.stringContaining(message) });
  });

  it("makes repeated stop requests idempotent", async () => {
    await expect(stopFlashManualHoldForAdmin({
      appearanceId: row.appearanceId,
      actorId: "admin-1",
      appMode: "staging",
    })).resolves.toMatchObject({ stopped: true, hold: { appearanceId: row.appearanceId } });

    mocks.stop.mockResolvedValueOnce(null);
    await expect(stopFlashManualHoldForAdmin({
      appearanceId: row.appearanceId,
      actorId: "admin-1",
      appMode: "staging",
    })).resolves.toEqual({ stopped: false, hold: null });
  });
});
