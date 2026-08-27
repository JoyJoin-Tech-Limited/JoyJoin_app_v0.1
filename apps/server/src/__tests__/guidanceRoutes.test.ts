/**
 * Tests for POST /api/guidance/seen (C4 guidance queue, W1).
 *
 * Sprint contract A3 / Reliability pillar: the write is idempotent
 * first-write-wins via a SINGLE atomic Postgres UPDATE (jsonb_set guarded by
 * `WHERE ... (seen_guidance IS NULL OR NOT (seen_guidance ? tipId))`) — no JS
 * read-modify-write. Concurrent/repeated posts converge on the EARLIEST
 * timestamp; retry after client timeout is safe.
 *
 * The repository is mocked with an in-memory store that faithfully emulates
 * the Postgres semantics: calls serialize on the row lock (FIFO promise
 * chain), the guard re-evaluates inside the lock so a queued second writer
 * sees the committed key and no-ops, and a monotonic test clock makes the
 * loser's would-be timestamp strictly LATER than the winner's.
 */

import express from "express";
import { readFile } from "node:fs/promises";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_USER_ID = "guidance-test-user-1";
const BASE_TS = Date.parse("2026-08-27T10:00:00.000Z");

// ── In-memory emulation of the atomic guarded UPDATE ────────────────────────
let store: Record<string, Record<string, string> | null>;
let clockTick: number;
let lockChain: Promise<void>;
let holdCurrentLock: Promise<void>;
let enteredCriticalSection: (() => void) | null;

const mockMarkGuidanceTipSeen = vi.fn((userId: string, tipId: string) => {
  // Acquire the (emulated) row lock synchronously in call order.
  const prev = lockChain;
  let release!: () => void;
  lockChain = new Promise<void>((r) => (release = r));
  return (async () => {
    await prev; // queue behind the current lock holder
    try {
      if (!(userId in store)) {
        const { GuidanceUserNotFoundError } = await import(
          "../repositories/guidanceRepo"
        );
        throw new GuidanceUserNotFoundError(userId);
      }
      enteredCriticalSection?.();
      await holdCurrentLock; // hold so an overlapping post genuinely queues
      const current = store[userId] ?? null;
      if (current && Object.prototype.hasOwnProperty.call(current, tipId)) {
        // Guard re-evaluated against the committed row → no-op, earliest wins.
        return { seenAt: current[tipId], alreadySeen: true };
      }
      clockTick += 1;
      const seenAt = new Date(BASE_TS + clockTick * 1000).toISOString();
      store[userId] = { ...(current ?? {}), [tipId]: seenAt };
      return { seenAt, alreadySeen: false };
    } finally {
      release();
    }
  })();
});

vi.mock("../repositories/guidanceRepo", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../repositories/guidanceRepo")>();
  return {
    ...original,
    markGuidanceTipSeen: mockMarkGuidanceTipSeen,
  };
});

async function buildTestApp(opts: { authenticated: boolean; userId?: string }) {
  const { registerGuidanceRoutes } = await import("../routes/domains/guidance");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).requestId = "test-request-id";
    if (opts.authenticated) {
      (req as any).session = { userId: opts.userId ?? TEST_USER_ID };
    }
    next();
  });
  registerGuidanceRoutes(app);
  return app;
}

function postSeen(base: string, body: unknown) {
  return fetch(`${base}/api/guidance/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/guidance/seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = { [TEST_USER_ID]: null };
    clockTick = 0;
    lockChain = Promise.resolve();
    holdCurrentLock = Promise.resolve();
    enteredCriticalSection = null;
  });

  it("returns 401 when unauthenticated", async () => {
    const app = await buildTestApp({ authenticated: false });
    await withServer(app, async (base) => {
      const res = await postSeen(base, { tipId: "discover_arrival" });
      expect(res.status).toBe(401);
      expect(mockMarkGuidanceTipSeen).not.toHaveBeenCalled();
    });
  });

  it("returns 400 for an unknown tipId (fail-closed against the shared enum)", async () => {
    const app = await buildTestApp({ authenticated: true });
    await withServer(app, async (base) => {
      const res = await postSeen(base, { tipId: "arbitrary_jsonb_key" });
      expect(res.status).toBe(400);
      expect(mockMarkGuidanceTipSeen).not.toHaveBeenCalled();
      expect(store[TEST_USER_ID]).toBeNull();
    });
  });

  it("returns 400 for a malformed body (missing tipId)", async () => {
    const app = await buildTestApp({ authenticated: true });
    await withServer(app, async (base) => {
      const res = await postSeen(base, { notTipId: "discover_arrival" });
      expect(res.status).toBe(400);
      expect(mockMarkGuidanceTipSeen).not.toHaveBeenCalled();
    });
  });

  it("first post returns 200 with the persisted timestamp", async () => {
    const app = await buildTestApp({ authenticated: true });
    await withServer(app, async (base) => {
      const res = await postSeen(base, { tipId: "discover_arrival" });
      const body: any = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.tipId).toBe("discover_arrival");
      expect(body.alreadySeen).toBe(false);
      expect(typeof body.seenAt).toBe("string");
      expect(Number.isNaN(Date.parse(body.seenAt))).toBe(false);
      expect(store[TEST_USER_ID]).toEqual({ discover_arrival: body.seenAt });
    });
  });

  it("repost is a 200 no-op preserving the earliest timestamp", async () => {
    const app = await buildTestApp({ authenticated: true });
    await withServer(app, async (base) => {
      const firstRes = await postSeen(base, { tipId: "discover_arrival" });
      const firstBody: any = await firstRes.json();
      expect(firstRes.status).toBe(200);
      expect(firstBody.alreadySeen).toBe(false);

      const secondRes = await postSeen(base, { tipId: "discover_arrival" });
      const secondBody: any = await secondRes.json();
      expect(secondRes.status).toBe(200);
      expect(secondBody.success).toBe(true);
      expect(secondBody.alreadySeen).toBe(true);
      // The earliest timestamp survives verbatim.
      expect(secondBody.seenAt).toBe(firstBody.seenAt);
      expect(store[TEST_USER_ID]).toEqual({
        discover_arrival: firstBody.seenAt,
      });
    });
  });

  it("two genuinely overlapping posts converge on the earliest timestamp", async () => {
    const app = await buildTestApp({ authenticated: true });
    // Hold the first writer's critical section until the second post has
    // queued behind the (emulated) row lock — a genuine overlap, not a
    // sequential pair.
    let releaseHold!: () => void;
    holdCurrentLock = new Promise<void>((r) => (releaseHold = r));
    const entered = new Promise<void>((r) => {
      enteredCriticalSection = r;
    });

    await withServer(app, async (base) => {
      const firstPromise = postSeen(base, { tipId: "discover_arrival" });
      await entered; // first writer is inside the critical section, lock held
      const secondPromise = postSeen(base, { tipId: "discover_arrival" });
      // Let the second request travel HTTP → route → repo and queue on the lock.
      await new Promise((r) => setTimeout(r, 25));
      releaseHold(); // first writer commits T1 (BASE_TS + 1s)

      const [firstRes, secondRes] = await Promise.all([firstPromise, secondPromise]);
      const firstBody: any = await firstRes.json();
      const secondBody: any = await secondRes.json();

      expect(firstRes.status).toBe(200);
      expect(secondRes.status).toBe(200);
      expect(firstBody.alreadySeen).toBe(false);
      expect(secondBody.alreadySeen).toBe(true);

      const earliest = new Date(BASE_TS + 1000).toISOString();
      // Both responses and the stored row carry the EARLIEST timestamp; the
      // later writer's would-be timestamp (BASE_TS + 2s) never lands.
      expect(firstBody.seenAt).toBe(earliest);
      expect(secondBody.seenAt).toBe(earliest);
      expect(store[TEST_USER_ID]).toEqual({ discover_arrival: earliest });
    });
  });

  it("returns 404 when the session user row no longer exists", async () => {
    const app = await buildTestApp({
      authenticated: true,
      userId: "deleted-user",
    });
    await withServer(app, async (base) => {
      const res = await postSeen(base, { tipId: "discover_arrival" });
      expect(res.status).toBe(404);
    });
  });

  it("persists via a single atomic UPDATE — no JS read-modify-write", async () => {
    // Amendment 1 lock-in: the first-write-wins mechanism must live in ONE
    // guarded UPDATE statement. A read-then-merge in application code is a
    // lost-update race where the LATER timestamp wins.
    const src = await readFile(
      new URL("../repositories/guidanceRepo.ts", import.meta.url),
      "utf8",
    );
    expect(src).toContain("jsonb_set");
    expect(src).toContain("COALESCE(seen_guidance, '{}'::jsonb)");
    expect(src).toContain("NOT (seen_guidance ?");
    // No application-side read of the column before writing.
    expect(src).not.toMatch(/db\.select\(/);
  });
});
