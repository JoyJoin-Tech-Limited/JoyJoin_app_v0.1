import express from "express";
import session from "express-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

/**
 * G0 (2026-11-10) — connection selection HTTP contract.
 *
 *   PUT /api/events/:eventId/connection-selection
 *     409 SELECTION_UNAVAILABLE      flag OFF (legacy deploy)
 *     400 INVALID_SELECTION          non-array / non-string payload
 *     400 TOO_MANY_SELECTIONS        6th distinct peer (server authority)
 *     409 SELECTION_WINDOW_CLOSED    outside [opensAt, revealAt)
 *     403 FEEDBACK_NOT_ELIGIBLE      viewer never sat at the table
 *     200 { connectionSelection }    idempotent full replace
 *
 *   POST /api/events/:eventId/feedback
 *     the cap + window gate run BEFORE moderation and BEFORE any write, so a
 *     rejected selection cannot burn the WeChat budget or half-persist.
 *
 * The repository is mocked here — its transition semantics are covered by
 * connectionSelectionRepo.test.ts.
 */

const mockResolveFeedbackState = vi.fn();
const mockRecordViolation = vi.fn();
const mockCheckTextWithMsgSecCheck = vi.fn();
const mockGetFeatureFlag = vi.fn();

const selectionCtx = vi.hoisted(() => ({
  getConnectionSelectionWindow: vi.fn(),
  replaceConnectionSelection: vi.fn(),
  applyConnectionSelectionsForEvent: vi.fn(),
  countOwnSelections: vi.fn(),
  getOwnSelectedPeerIds: vi.fn(),
}));

const rosterCtx = vi.hoisted(() => ({
  validateTablemateSelection: vi.fn(),
}));

const storageCtx = vi.hoisted(() => ({
  createEventFeedback: vi.fn(),
  getMutualConnections: vi.fn(),
  getUser: vi.fn(),
  updateUserWechatId: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
  getFeatureFlagSync: vi.fn(),
  refreshFeatureFlag: vi.fn(),
  listFeatureFlags: vi.fn(),
}));

vi.mock("../lib/wechatMsgSecCheck", () => ({
  checkTextWithMsgSecCheck: mockCheckTextWithMsgSecCheck,
  warmWechatAccessToken: vi.fn(),
}));

vi.mock("../lib/feedbackStateResolver", () => ({
  resolveFeedbackState: mockResolveFeedbackState,
  FEEDBACK_OPEN_OFFSET_MS: 3 * 60 * 60 * 1000,
  FEEDBACK_ELIGIBLE_MATCH_STATUSES: ["matched", "completed"],
}));

vi.mock("../repositories/connectionSelectionRepo", () => ({
  ...selectionCtx,
}));

vi.mock("../repositories/eventTableRosterRepo", () => ({
  ...rosterCtx,
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          const rows = table === events ? [{ id: "event-1" }] : [];
          const pending = Promise.resolve(rows) as Promise<typeof rows> & { limit: unknown };
          pending.limit = vi.fn(() => Promise.resolve(rows));
          return pending;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ execute: vi.fn(() => Promise.resolve()) })),
    })),
  },
}));

vi.mock("../abuseDetection", () => ({ recordViolation: mockRecordViolation }));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../storage", () => ({ storage: storageCtx }));

import { events } from "@shared/schema";

const { registerSocialRoutes } = await import("../routes/domains/social");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({ secret: "test-secret", resave: false, saveUninitialized: false }),
  );
  app.post("/__test__/login/:userId", (req, res) => {
    (req.session as any).userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  registerSocialRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);

function cookieHeader(response: Response): string {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function login(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: "POST" });
  return cookieHeader(response);
}

const OPEN_WINDOW = {
  window: {
    state: "open",
    opensAt: new Date("2026-11-10T14:00:00.000Z"),
    closesAt: new Date("2026-11-11T13:00:00.000Z"),
    revealAt: new Date("2026-11-11T13:00:00.000Z"),
  },
  source: "derived" as const,
};

const CLOSED_WINDOW = {
  window: { ...OPEN_WINDOW.window, state: "closed" as const },
  source: "derived" as const,
};

function buildFeedbackPayload(overrides: Record<string, unknown> = {}) {
  return {
    atmosphereScore: 4,
    hasNewConnections: false,
    feedback: "氛围很好",
    ...overrides,
  };
}

async function putSelection(baseUrl: string, cookie: string, eventId: string, body: unknown) {
  return fetch(`${baseUrl}/api/events/${eventId}/connection-selection`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFeatureFlag.mockResolvedValue(true);
  mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
  mockResolveFeedbackState.mockResolvedValue({ state: "open", canonicalEventId: "event-1" });
  selectionCtx.getConnectionSelectionWindow.mockResolvedValue(OPEN_WINDOW);
  selectionCtx.replaceConnectionSelection.mockImplementation(async (params: any) => ({
    selectedCount: params.peerIds.length,
    withdrawn: 0,
    declinedRevealed: 0,
  }));
  selectionCtx.applyConnectionSelectionsForEvent.mockImplementation(async (params: any) => ({
    acceptedPeerIds: [...params.peerIds],
    rejectedPeerIds: [],
    transitions: [],
  }));
  selectionCtx.countOwnSelections.mockResolvedValue(0);
  selectionCtx.getOwnSelectedPeerIds.mockReset();
  selectionCtx.getOwnSelectedPeerIds.mockResolvedValue([]);
  rosterCtx.validateTablemateSelection.mockReset();
  rosterCtx.validateTablemateSelection.mockImplementation(async (params: any) => ({
    invalidPeerIds: [],
    roster: {
      userIds: [...params.peerIds, params.viewerId],
      source: "event_attendance",
      tableScoped: false,
    },
  }));
  storageCtx.createEventFeedback.mockImplementation(async (_userId: string, data: any) => ({
    id: "fb-1",
    connections: data.connections ?? [],
  }));
  storageCtx.getMutualConnections.mockResolvedValue([]);
  storageCtx.getUser.mockResolvedValue({ id: "user-1", wechatContactId: null });
});

describe('PUT /api/events/:eventId/connection-selection', () => {
  it('replaces the selection and returns the server-owned window', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1", "peer-2"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.connectionSelection).toMatchObject({
        state: "open",
        revealed: false,
        revealAt: "2026-11-11T13:00:00.000Z",
        maxSelections: 5,
        selectedCount: 2,
      });
      expect(selectionCtx.replaceConnectionSelection).toHaveBeenCalledWith({
        eventId: "event-1",
        callerId: "user-1",
        peerIds: ["peer-1", "peer-2"],
        revealAt: OPEN_WINDOW.window.revealAt,
      });
    });
  });

  it('rejects the 6th distinct peer with 400 TOO_MANY_SELECTIONS and writes nothing', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("TOO_MANY_SELECTIONS");
      expect(selectionCtx.replaceConnectionSelection).not.toHaveBeenCalled();
    });
  });

  it('accepts exactly 5 peers', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["p1", "p2", "p3", "p4", "p5"],
      });

      expect(response.status).toBe(200);
      expect(selectionCtx.replaceConnectionSelection).toHaveBeenCalledTimes(1);
    });
  });

  it('dedupes and drops self-selection before counting the cap', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1", "peer-1", "user-1", "peer-2"],
      });

      expect(response.status).toBe(200);
      expect(selectionCtx.replaceConnectionSelection).toHaveBeenCalledWith(
        expect.objectContaining({ peerIds: ["peer-1", "peer-2"] }),
      );
    });
  });

  it('is idempotent — the same body twice converges and both return 200', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const body = { selectedUserIds: ["peer-1"] };

      const first = await putSelection(baseUrl, cookie, "event-1", body);
      const second = await putSelection(baseUrl, cookie, "event-1", body);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(selectionCtx.replaceConnectionSelection).toHaveBeenCalledTimes(2);
      expect(selectionCtx.replaceConnectionSelection.mock.calls[0][0]).toEqual(
        selectionCtx.replaceConnectionSelection.mock.calls[1][0],
      );
    });
  });

  it('clears the selection with an empty array', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", { selectedUserIds: [] });
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.connectionSelection.selectedCount).toBe(0);
      expect(selectionCtx.replaceConnectionSelection).toHaveBeenCalledWith(
        expect.objectContaining({ peerIds: [] }),
      );
    });
  });

  it('returns 409 SELECTION_WINDOW_CLOSED after the reveal instant', async () => {
    selectionCtx.getConnectionSelectionWindow.mockResolvedValue(CLOSED_WINDOW);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(409);
      expect(body.code).toBe("SELECTION_WINDOW_CLOSED");
      expect(selectionCtx.replaceConnectionSelection).not.toHaveBeenCalled();
    });
  });

  it('returns 409 SELECTION_WINDOW_CLOSED when the event has no resolvable start', async () => {
    selectionCtx.getConnectionSelectionWindow.mockResolvedValue(null);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(409);
      expect(body.code).toBe("SELECTION_WINDOW_CLOSED");
    });
  });

  it('returns 409 SELECTION_UNAVAILABLE when the flag is OFF', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(409);
      expect(body.code).toBe("SELECTION_UNAVAILABLE");
      expect(selectionCtx.replaceConnectionSelection).not.toHaveBeenCalled();
    });
  });

  it('returns 400 INVALID_SELECTION for a non-array payload', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: "peer-1",
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_SELECTION");
    });
  });

  it('returns 403 FEEDBACK_NOT_ELIGIBLE when the viewer never sat at the table', async () => {
    mockResolveFeedbackState.mockResolvedValue({ state: "ineligible", canonicalEventId: null });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(403);
      expect(body.code).toBe("FEEDBACK_NOT_ELIGIBLE");
      expect(selectionCtx.replaceConnectionSelection).not.toHaveBeenCalled();
    });
  });

  it('requires auth', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-1/connection-selection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedUserIds: [] }),
      });

      expect(response.status).toBe(401);
    });
  });

  it('rejects a peer outside the table with 400 INVALID_TABLEMATE_SELECTION and writes nothing', async () => {
    rosterCtx.validateTablemateSelection.mockResolvedValueOnce({
      invalidPeerIds: ["stranger-9"],
      roster: { userIds: ["user-1", "peer-1"], source: "pool_group", tableScoped: true },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", {
        selectedUserIds: ["peer-1", "stranger-9"],
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_TABLEMATE_SELECTION");
      expect(selectionCtx.replaceConnectionSelection).not.toHaveBeenCalled();
      // The gate received the caller's own canonical event + viewer.
      expect(rosterCtx.validateTablemateSelection).toHaveBeenCalledWith({
        canonicalEventId: "event-1",
        viewerId: "user-1",
        peerIds: ["peer-1", "stranger-9"],
        route: "PUT /api/events/:eventId/connection-selection",
      });
    });
  });

  it('does not consult the roster when clearing the selection', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await putSelection(baseUrl, cookie, "event-1", { selectedUserIds: [] });

      expect(response.status).toBe(200);
      expect(rosterCtx.validateTablemateSelection).not.toHaveBeenCalled();
    });
  });

  it('never awards feedback XP', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      await putSelection(baseUrl, cookie, "event-1", { selectedUserIds: ["peer-1"] });

      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });
});

describe('POST /api/events/:eventId/feedback — selection cap + window', () => {
  it('rejects the 6th peer with 400 TOO_MANY_SELECTIONS before moderation/persist', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["p1", "p2", "p3", "p4", "p5", "p6"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("TOO_MANY_SELECTIONS");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
      expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  it('enforces the cap even when the flag is OFF (W1 hardening, not flag-gated)', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["p1", "p2", "p3", "p4", "p5", "p6"] })),
      });

      expect(response.status).toBe(400);
    });
  });

  it('enforces the cap across requests — a prior PUT plus a POST cannot exceed 5', async () => {
    // The caller already holds 4 distinct peers from PUT /connection-selection.
    selectionCtx.getOwnSelectedPeerIds.mockResolvedValue(["p1", "p2", "p3", "p4"]);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["p5", "p6"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("TOO_MANY_SELECTIONS");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });

  it('counts the union, not the sum, when a POST repeats peers already saved by PUT', async () => {
    // Regression: a PUT of 5 followed by a POST repeating the same 5 must not
    // be read as 10 selections.
    selectionCtx.getOwnSelectedPeerIds.mockResolvedValue(["p1", "p2", "p3", "p4", "p5"]);
    storageCtx.createEventFeedback.mockResolvedValue({ id: "feedback-1" });
    storageCtx.getMutualConnections.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["p1", "p2", "p3", "p4", "p5"] })),
      });

      expect(response.status).toBe(200);
    });
  });

  it('returns 409 SELECTION_WINDOW_CLOSED when selections arrive after the reveal', async () => {
    selectionCtx.getConnectionSelectionWindow.mockResolvedValue(CLOSED_WINDOW);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["peer-1"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(409);
      expect(body.code).toBe("SELECTION_WINDOW_CLOSED");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });

  it('still accepts a zero-selection feedback after the reveal (rating is not blocked)', async () => {
    selectionCtx.getConnectionSelectionWindow.mockResolvedValue(CLOSED_WINDOW);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: [] })),
      });

      expect(response.status).toBe(200);
      expect(storageCtx.createEventFeedback).toHaveBeenCalledTimes(1);
    });
  });

  it('flag OFF ignores the window entirely (legacy behaviour)', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);
    selectionCtx.getConnectionSelectionWindow.mockResolvedValue(CLOSED_WINDOW);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["peer-1"] })),
      });

      expect(response.status).toBe(200);
      // The window lookup is V2-only — legacy never pays for it.
      expect(selectionCtx.getConnectionSelectionWindow).not.toHaveBeenCalled();
    });
  });

  it('omits connectionSelection from the response when the flag is OFF', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["peer-1"] })),
      });
      const body = (await response.json()) as any;

      expect(body).not.toHaveProperty("connectionSelection");
      expect(body.mutualMatches).toEqual([]);
    });
  });

  it('includes the server-owned window on the V2 response', async () => {
    // POST unions with what PUT already stored, so the response reports the
    // caller's authoritative OWN set (not just this payload).
    selectionCtx.getOwnSelectedPeerIds.mockResolvedValue(["peer-0", "peer-1", "peer-2"]);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["peer-1", "peer-2"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.connectionSelection).toMatchObject({
        state: "open",
        revealAt: "2026-11-11T13:00:00.000Z",
        maxSelections: 5,
        selectedCount: 3,
        selectedUserIds: ["peer-0", "peer-1", "peer-2"],
      });
    });
  });

  it('rejects a non-tablemate with 400 INVALID_TABLEMATE_SELECTION before moderation/persist', async () => {
    rosterCtx.validateTablemateSelection.mockResolvedValueOnce({
      invalidPeerIds: ["stranger-9"],
      roster: { userIds: ["user-1", "peer-1"], source: "event_attendance", tableScoped: false },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["peer-1", "stranger-9"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_TABLEMATE_SELECTION");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
      expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
      expect(mockRecordViolation).not.toHaveBeenCalled();
    });
  });

  it('applies the tablemate gate even when the flag is OFF (security, not V2 behaviour)', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);
    rosterCtx.validateTablemateSelection.mockResolvedValueOnce({
      invalidPeerIds: ["stranger-9"],
      roster: { userIds: ["user-1"], source: "event_attendance", tableScoped: false },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(buildFeedbackPayload({ connections: ["stranger-9"] })),
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_TABLEMATE_SELECTION");
      expect(storageCtx.createEventFeedback).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/events/:eventId/feedback-state — connectionSelection', () => {
  it('omits the block when the flag is OFF (byte-identical legacy payload)', async () => {
    mockGetFeatureFlag.mockResolvedValue(false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback-state`, {
        headers: { cookie },
      });
      const body = (await response.json()) as any;

      expect(body).toEqual({ state: "open" });
      expect(selectionCtx.getConnectionSelectionWindow).not.toHaveBeenCalled();
    });
  });

  it('returns the caller OWN selected ids so the edit screen can prefill', async () => {
    // The caller previously selected 3 peers; two of them are their own
    // outgoing rows, one is a mutual row. All three are prefilled.
    selectionCtx.getOwnSelectedPeerIds.mockResolvedValue(["peer-1", "peer-2", "peer-3"]);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "user-1");
      const response = await fetch(`${baseUrl}/api/events/event-1/feedback-state`, {
        headers: { cookie },
      });
      const body = (await response.json()) as any;

      expect(body.state).toBe("open");
      expect(body.connectionSelection).toEqual({
        state: "open",
        revealed: false,
        opensAt: "2026-11-10T14:00:00.000Z",
        closesAt: "2026-11-11T13:00:00.000Z",
        revealAt: "2026-11-11T13:00:00.000Z",
        maxSelections: 5,
        selectedCount: 3,
        selectedUserIds: ["peer-1", "peer-2", "peer-3"],
      });
      // Queried for the REQUESTER only — the shape can never carry someone
      // else's selection (no "who picked me" list).
      expect(selectionCtx.getOwnSelectedPeerIds).toHaveBeenCalledWith("event-1", "user-1");
      // Ids only: no WeChat ids, names or archetypes ride along.
      expect(Object.keys(body.connectionSelection)).not.toContain("peers");
      expect(Object.keys(body.connectionSelection)).not.toContain("wechatContactId");
      expect(JSON.stringify(body)).not.toContain("stranger-");
    });
  });

  it('never leaks another user selection into the requester payload', async () => {
    // Even if the repository returned a row the viewer has no claim to, the
    // route asks for `getOwnSelectedPeerIds(canonicalEventId, requesterId)` —
    // a different logged-in user gets their own answer.
    selectionCtx.getOwnSelectedPeerIds.mockImplementation(async (_eventId: string, viewerId: string) =>
      viewerId === "user-2" ? ["peer-9"] : ["peer-1"],
    );

    await withServer(async (baseUrl) => {
      const cookieOne = await login(baseUrl, "user-1");
      const first = (await (
        await fetch(`${baseUrl}/api/events/event-1/feedback-state`, { headers: { cookie: cookieOne } })
      ).json()) as any;

      const cookieTwo = await login(baseUrl, "user-2");
      const second = (await (
        await fetch(`${baseUrl}/api/events/event-1/feedback-state`, { headers: { cookie: cookieTwo } })
      ).json()) as any;

      expect(first.connectionSelection.selectedUserIds).toEqual(["peer-1"]);
      expect(second.connectionSelection.selectedUserIds).toEqual(["peer-9"]);
      expect(JSON.stringify(first)).not.toContain("peer-9");
      expect(JSON.stringify(second)).not.toContain("peer-1");
    });
  });
});
