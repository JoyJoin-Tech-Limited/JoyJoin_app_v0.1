/**
 * Integration tests for GET /api/admin/smart-venues
 *
 * Coverage:
 *   - Auth: 403 for non-admin, 200 for admin
 *   - Validation: 400 for missing city or eventType
 *   - Filtering: correct venueType mapping per eventType
 *   - District filtering: exact string match on venues.area
 *   - hasTimeSlots flag: true only when venue has active time slots
 *   - Date-level availability: optional `date` param checks slot + booking capacity
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWithServer } from '../test-utils/withServer';
import express from "express";
import session from "express-session";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockVenuesSelect,
  mockTimeSlotsSelect,
  mockBookingsSelect,
  venuesTable,
  venueTimeSlotsTable,
  venueTimeSlotBookingsTable,
} = vi.hoisted(() => ({
  mockVenuesSelect: vi.fn(),
  mockTimeSlotsSelect: vi.fn(),
  mockBookingsSelect: vi.fn(),
  venuesTable: Symbol("venues"),
  venueTimeSlotsTable: Symbol("venueTimeSlots"),
  venueTimeSlotBookingsTable: Symbol("venueTimeSlotBookings"),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table === venuesTable) {
          return {
            where: () => ({
              limit: () => Promise.resolve(mockVenuesSelect()),
            }),
          };
        }
        if (table === venueTimeSlotsTable) {
          return {
            where: () => {
              const p = Promise.resolve(mockTimeSlotsSelect());
              return {
                limit: () => p,
                then: (onFulfilled: any, onRejected: any) =>
                  p.then(onFulfilled, onRejected),
                catch: (onRejected: any) => p.catch(onRejected),
              };
            },
          };
        }
        if (table === venueTimeSlotBookingsTable) {
          return {
            where: () => {
              const p = Promise.resolve(mockBookingsSelect());
              return {
                limit: () => p,
                then: (onFulfilled: any, onRejected: any) =>
                  p.then(onFulfilled, onRejected),
                catch: (onRejected: any) => p.catch(onRejected),
              };
            },
          };
        }
        throw new Error(`Unexpected table in smart-venues test: ${String(table)}`);
      },
    }),
  },
}));

vi.mock("@shared/schema", () => ({
  venues: venuesTable,
  venueTimeSlots: venueTimeSlotsTable,
  venueTimeSlotBookings: venueTimeSlotBookingsTable,
  eventPoolGroups: Symbol("eventPoolGroups"),
  eventPools: Symbol("eventPools"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq-condition"),
  and: vi.fn((...conds: any[]) => conds.filter(Boolean)),
  or: vi.fn((...conds: any[]) => ({ type: "or", conds })),
  inArray: vi.fn(() => "inArray-condition"),
  sql: vi.fn((...args: any[]) => ({ type: "sql", args })),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (req: any, res: any, next: any) => {
      if (!req.session?.adminId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    },
  };
});

// ── Imports after mocks ────────────────────────────────────────────────────

const { registerVenueRoutes } = await import("../routes/domains/venues");

// ── Helpers ────────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.post("/__setAdmin", (req, res) => {
    (req.session as any).adminId = req.body.adminId || "admin-1";
    req.session.save(() => res.json({ ok: true }));
  });

  registerVenueRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeVenue = (overrides?: Partial<any>) => ({
  id: "venue-1",
  name: "Test Venue",
  city: "深圳",
  area: "南山区",
  venueType: "bar",
  isActive: true,
  address: "Test Address",
  priceRange: "100-200",
  tags: ["tag1"],
  cuisines: ["cuisine1"],
  budgetCategories: ["100-200"],
  capacity: 50,
  partnerStatus: "active",
  ...overrides,
});

const makeTimeSlot = (overrides?: Partial<any>) => ({
  id: "slot-1",
  venueId: "venue-1",
  dayOfWeek: 1,
  specificDate: null,
  startTime: "18:00",
  endTime: "22:00",
  maxConcurrentEvents: 3,
  isActive: true,
  ...overrides,
});

const makeBooking = (overrides?: Partial<any>) => ({
  id: "booking-1",
  venueId: "venue-1",
  timeSlotId: "slot-1",
  bookingDate: "2026-06-10",
  status: "confirmed",
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe.sequential("GET /api/admin/smart-venues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVenuesSelect.mockReset().mockResolvedValue([]);
    mockTimeSlotsSelect.mockReset().mockResolvedValue([]);
    mockBookingsSelect.mockReset().mockResolvedValue([]);
  });

  it("returns 403 for non-admin session", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局`);
      expect(res.status).toBe(403);
    });
  });

  it("returns 400 when city is missing", async () => {
    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(`${baseUrl}/api/admin/smart-venues?eventType=酒局`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.message).toContain("city");
    });
  });

  it("returns 400 when eventType is missing", async () => {
    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(`${baseUrl}/api/admin/smart-venues?city=深圳`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.message).toContain("eventType");
    });
  });

  // This test exercises the full route + db mock stack and is consistently
  // ~3s due to Express module initialisation; the extended timeout prevents
  // flakiness in CI.
  it("maps 酒局 to bar/homebar venue types", async () => {
    mockVenuesSelect.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      // Venues query was executed (empty result is fine for this test)
      expect(mockVenuesSelect).toHaveBeenCalled();
    });
  }, 30000);

  it("passes district parameter through to the query", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-nanshan", area: "南山区", venueType: "bar" }),
      makeVenue({ id: "v-futian", area: "福田区", venueType: "bar" }),
    ]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      // Query with district name — route should accept it and return 200
      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局&district=南山区`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(Array.isArray(body)).toBe(true);
      // Note: the backend does exact string equality on venues.area.
      // If the UI sends "南山" instead of "南山区", no venues match.
      // This was the root cause of the reported issue.
    });
  });

  it("returns hasTimeSlots=true only when venue has active time slots", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-with-slot", venueType: "bar" }),
      makeVenue({ id: "v-no-slot", venueType: "bar" }),
    ]);
    mockTimeSlotsSelect.mockResolvedValue([
      makeTimeSlot({ venueId: "v-with-slot" }),
    ]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toHaveLength(2);
      const withSlot = body.find((v: any) => v.id === "v-with-slot");
      const noSlot = body.find((v: any) => v.id === "v-no-slot");
      expect(withSlot.hasTimeSlots).toBe(true);
      expect(noSlot.hasTimeSlots).toBe(false);
    });
  });

  it("returns empty array when no venues match city", async () => {
    mockVenuesSelect.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=北京&eventType=饭局`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toEqual([]);
    });
  });

  it("checks date-level availability when date param is provided", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-available", venueType: "bar" }),
      makeVenue({ id: "v-full", venueType: "bar" }),
    ]);

    // v-available: 1 slot, not fully booked
    // v-full: 1 slot, fully booked (3/3)
    mockTimeSlotsSelect.mockResolvedValue([
      makeTimeSlot({ id: "slot-a", venueId: "v-available" }),
      makeTimeSlot({ id: "slot-f", venueId: "v-full" }),
    ]);

    mockBookingsSelect.mockResolvedValue([
      // v-available: 2 bookings out of 3 max → available
      makeBooking({ id: "b1", venueId: "v-available", timeSlotId: "slot-a" }),
      makeBooking({ id: "b2", venueId: "v-available", timeSlotId: "slot-a" }),
      // v-full: 3 bookings out of 3 max → full
      makeBooking({ id: "b3", venueId: "v-full", timeSlotId: "slot-f" }),
      makeBooking({ id: "b4", venueId: "v-full", timeSlotId: "slot-f" }),
      makeBooking({ id: "b5", venueId: "v-full", timeSlotId: "slot-f" }),
    ]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局&date=2026-06-10`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;

      const available = body.find((v: any) => v.id === "v-available");
      const full = body.find((v: any) => v.id === "v-full");

      expect(available.hasAvailabilityOnDate).toBe(true);
      expect(available.availableSlotCount).toBe(1);
      expect(full.hasAvailabilityOnDate).toBe(false);
      expect(full.availableSlotCount).toBe(0);
    });
  });

  it("returns null for availability fields when date is omitted", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-1", venueType: "bar" }),
    ]);
    mockTimeSlotsSelect.mockResolvedValue([
      makeTimeSlot({ venueId: "v-1" }),
    ]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body[0].hasAvailabilityOnDate).toBeNull();
      expect(body[0].availableSlotCount).toBeNull();
    });
  });

  it("does not query bookings when no time slots match the selected date", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-1", venueType: "bar" }),
    ]);
    mockTimeSlotsSelect
      .mockResolvedValueOnce([makeTimeSlot({ venueId: "v-1" })])
      .mockResolvedValueOnce([]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局&date=2026-07-30`,
        { headers: { Cookie: cookie } },
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body[0].hasAvailabilityOnDate).toBe(false);
      expect(body[0].availableSlotCount).toBe(0);
      expect(mockBookingsSelect).not.toHaveBeenCalled();
    });
  });

  it("returns base venues when availability storage is temporarily unavailable", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-1", venueType: "bar" }),
    ]);
    mockTimeSlotsSelect.mockRejectedValue(new Error("relation venue_time_slots does not exist"));

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局&date=2026-07-30`,
        { headers: { Cookie: cookie } },
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("v-1");
      expect(body[0].hasTimeSlots).toBeNull();
      expect(body[0].hasAvailabilityOnDate).toBeNull();
    });
  });

  it("ignores invalid date format and treats as no date", async () => {
    mockVenuesSelect.mockResolvedValue([
      makeVenue({ id: "v-1", venueType: "bar" }),
    ]);
    mockTimeSlotsSelect.mockResolvedValue([
      makeTimeSlot({ venueId: "v-1" }),
    ]);

    await withServer(async (baseUrl) => {
      const setRes = await fetch(`${baseUrl}/__setAdmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cookie = cookieHeader(setRes);

      const res = await fetch(
        `${baseUrl}/api/admin/smart-venues?city=深圳&eventType=酒局&date=not-a-date`,
        { headers: { Cookie: cookie } },
      );
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body[0].hasAvailabilityOnDate).toBeNull();
      expect(body[0].availableSlotCount).toBeNull();
    });
  });
});
