/**
 * Tests for gathering room (集结房间) WS presence in wsService.
 *
 * Covers: ROOM_MEMBER_ENTERED / ROOM_MEMBER_LEFT / ROOM_PRESENCE_STATE
 * snapshot, leave-grace flap cancellation (mini-program background/foreground
 * switches), multi-socket users, and ROOM_POKE validation + rate limiting.
 *
 * Uses a real HTTP + WebSocket server on an ephemeral port. The leave grace
 * and poke throttle are shrunk via env overrides (read at module load).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import WebSocket from "ws";

// Shrink timings BEFORE wsService module load (constants are read at import).
process.env.ROOM_LEAVE_GRACE_MS = "200";
process.env.ROOM_POKE_MIN_INTERVAL_MS = "150";

// wsService imports ./db for cookie-session auth; tests use cookie-less
// sockets whose identity comes from message.userId, so a stub is enough.
vi.mock("../db", () => ({
  db: { execute: vi.fn() },
}));

const { wsService } = await import("../wsService");

const GRACE_MS = 200;

interface TestClient {
  ws: WebSocket;
  messages: any[];
}

let server: Server;
let port: number;
const openClients: TestClient[] = [];
const consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

function connect(): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const client: TestClient = { ws, messages: [] };
    ws.on("message", (data) => {
      try {
        client.messages.push(JSON.parse(data.toString()));
      } catch {
        // ignore non-JSON
      }
    });
    ws.on("open", () => {
      openClients.push(client);
      resolve(client);
    });
    ws.on("error", reject);
  });
}

function send(client: TestClient, message: Record<string, unknown>) {
  client.ws.send(JSON.stringify({ timestamp: new Date().toISOString(), ...message }));
}

function joinRoom(client: TestClient, userId: string, eventId: string) {
  send(client, { type: "USER_JOINED", userId, eventId });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMessage(
  client: TestClient,
  predicate: (msg: any) => boolean,
  timeoutMs = 2000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = client.messages.find(predicate);
    if (found) return found;
    await sleep(10);
  }
  throw new Error("Timed out waiting for expected WS message");
}

/** Wait `ms`, then assert no message matching predicate arrived. */
async function expectNoMessage(client: TestClient, predicate: (msg: any) => boolean, ms: number) {
  await sleep(ms);
  expect(client.messages.filter(predicate)).toEqual([]);
}

function close(client: TestClient) {
  try {
    client.ws.close();
  } catch {
    // already closed
  }
}

beforeAll(async () => {
  // wsService logs verbosely (and its fire-and-forget interaction-log fetches
  // fail in tests) — silence console so no rpc log call outlives the run.
  for (const method of ["log", "warn", "error"] as const) {
    consoleSpies.push(vi.spyOn(console, method).mockImplementation(() => {}));
  }
  server = createServer();
  wsService.initialize(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as any).port;
});

afterAll(async () => {
  for (const client of openClients) close(client);
  await new Promise<void>((resolve) => {
    const wss = (wsService as any).wss;
    if (wss) wss.close(() => resolve());
    else resolve();
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Let the fire-and-forget disconnect fetches reject before restoring console.
  await sleep(50);
  for (const spy of consoleSpies) spy.mockRestore();
});

describe("gathering room WS presence", () => {
  it("replies ROOM_PRESENCE_STATE to the joiner and broadcasts ROOM_MEMBER_ENTERED to the room", async () => {
    const eventId = "evt-basic";
    const alice = await connect();
    joinRoom(alice, "alice", eventId);

    const snapshot = await waitForMessage(alice, (m) => m.type === "ROOM_PRESENCE_STATE");
    expect(snapshot.data).toEqual({ eventId, presentUserIds: ["alice"] });

    // Joiner's own socket also receives the ENTERED broadcast (clients dedupe
    // by userId against the snapshot — documented convention).
    const selfEntered = await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_ENTERED");
    expect(selfEntered.data).toEqual({ eventId, userId: "alice" });

    const bob = await connect();
    joinRoom(bob, "bob", eventId);

    // Existing member sees the newcomer enter
    const entered = await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_ENTERED" && m.data.userId === "bob");
    expect(entered.data).toEqual({ eventId, userId: "bob" });

    // Late joiner gets the full picture
    const bobSnapshot = await waitForMessage(bob, (m) => m.type === "ROOM_PRESENCE_STATE");
    expect([...bobSnapshot.data.presentUserIds].sort()).toEqual(["alice", "bob"]);
  });

  it("broadcasts ROOM_MEMBER_LEFT only after the leave grace period", async () => {
    const eventId = "evt-leave";
    const alice = await connect();
    const bob = await connect();
    joinRoom(alice, "alice", eventId);
    joinRoom(bob, "bob", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_ENTERED" && m.data.userId === "bob");

    close(bob);

    const left = await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_LEFT" && m.data.userId === "bob");
    expect(left.data).toEqual({ eventId, userId: "bob" });
  });

  it("cancels ROOM_MEMBER_LEFT when the user rejoins within the grace window (flap tolerance)", async () => {
    const eventId = "evt-flap";
    const alice = await connect();
    joinRoom(alice, "alice", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_PRESENCE_STATE");

    const bob1 = await connect();
    joinRoom(bob1, "bob", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_ENTERED" && m.data.userId === "bob");

    // Simulate background/foreground switch: disconnect and reconnect quickly
    close(bob1);
    await sleep(GRACE_MS / 2);
    const bob2 = await connect();
    joinRoom(bob2, "bob", eventId);
    await waitForMessage(bob2, (m) => m.type === "ROOM_PRESENCE_STATE");

    // Past the grace window: no LEFT, and no duplicate ENTERED for bob
    await sleep(GRACE_MS * 2);
    const leftMessages = alice.messages.filter((m) => m.type === "ROOM_MEMBER_LEFT" && m.data?.userId === "bob");
    const enteredMessages = alice.messages.filter((m) => m.type === "ROOM_MEMBER_ENTERED" && m.data?.userId === "bob");
    expect(leftMessages).toEqual([]);
    expect(enteredMessages).toHaveLength(1);

    // Rejoined socket's snapshot still shows both members
    const snapshot = bob2.messages.find((m) => m.type === "ROOM_PRESENCE_STATE");
    expect([...snapshot.data.presentUserIds].sort()).toEqual(["alice", "bob"]);
  });

  it("keeps a multi-socket user present until their last socket leaves", async () => {
    const eventId = "evt-multisocket";
    const alice = await connect();
    joinRoom(alice, "alice", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_PRESENCE_STATE");

    const bobA = await connect();
    const bobB = await connect();
    joinRoom(bobA, "bob", eventId);
    joinRoom(bobB, "bob", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_ENTERED" && m.data.userId === "bob");

    // Second socket of the same user must not re-broadcast ENTERED
    const enteredCount = alice.messages.filter((m) => m.type === "ROOM_MEMBER_ENTERED" && m.data?.userId === "bob").length;
    expect(enteredCount).toBe(1);

    // Closing one socket: bob stays present past the grace window
    close(bobA);
    await expectNoMessage(alice, (m) => m.type === "ROOM_MEMBER_LEFT" && m.data?.userId === "bob", GRACE_MS * 2);

    // Closing the last socket: LEFT fires after grace
    close(bobB);
    const left = await waitForMessage(alice, (m) => m.type === "ROOM_MEMBER_LEFT" && m.data.userId === "bob");
    expect(left.data.userId).toBe("bob");
  });

  it("relays whitelisted ROOM_POKE messages to the room", async () => {
    const eventId = "evt-poke";
    const alice = await connect();
    const bob = await connect();
    joinRoom(alice, "alice", eventId);
    joinRoom(bob, "bob", eventId);
    await waitForMessage(bob, (m) => m.type === "ROOM_PRESENCE_STATE");

    send(alice, { type: "ROOM_POKE", userId: "alice", eventId, data: { targetUserId: "bob", emoji: "wave" } });

    const poke = await waitForMessage(bob, (m) => m.type === "ROOM_POKE");
    expect(poke.data.fromUserId).toBe("alice");
    expect(poke.data.targetUserId).toBe("bob");
    expect(poke.data.emoji).toBe("wave");
    expect(typeof poke.data.ts).toBe("number");
  });

  it("rejects non-whitelisted poke emoji silently", async () => {
    const eventId = "evt-poke-bad-emoji";
    const alice = await connect();
    const bob = await connect();
    joinRoom(alice, "alice", eventId);
    joinRoom(bob, "bob", eventId);
    await waitForMessage(bob, (m) => m.type === "ROOM_PRESENCE_STATE");

    send(alice, { type: "ROOM_POKE", userId: "alice", eventId, data: { targetUserId: "bob", emoji: "middle-finger" } });
    await expectNoMessage(bob, (m) => m.type === "ROOM_POKE", 300);
  });

  it("ignores pokes from senders not present in the room", async () => {
    const eventId = "evt-poke-outsider";
    const alice = await connect();
    const outsider = await connect();
    joinRoom(alice, "alice", eventId);
    await waitForMessage(alice, (m) => m.type === "ROOM_PRESENCE_STATE");
    // Outsider is connected and joined a DIFFERENT event room
    joinRoom(outsider, "outsider", "evt-elsewhere");
    await waitForMessage(outsider, (m) => m.type === "ROOM_PRESENCE_STATE");

    send(outsider, { type: "ROOM_POKE", userId: "outsider", eventId, data: { targetUserId: "alice", emoji: "wave" } });
    await expectNoMessage(alice, (m) => m.type === "ROOM_POKE", 300);
  });

  it("rate-limits pokes to one per sender per interval", async () => {
    const eventId = "evt-poke-throttle";
    const alice = await connect();
    const bob = await connect();
    joinRoom(alice, "alice", eventId);
    joinRoom(bob, "bob", eventId);
    await waitForMessage(bob, (m) => m.type === "ROOM_PRESENCE_STATE");

    send(alice, { type: "ROOM_POKE", userId: "alice", eventId, data: { targetUserId: "bob", emoji: "hi-five" } });
    await waitForMessage(bob, (m) => m.type === "ROOM_POKE");

    // Immediate second poke is dropped
    send(alice, { type: "ROOM_POKE", userId: "alice", eventId, data: { targetUserId: "bob", emoji: "drink" } });
    await sleep(100);
    expect(bob.messages.filter((m) => m.type === "ROOM_POKE")).toHaveLength(1);

    // After the throttle interval the next poke goes through
    await sleep(150);
    send(alice, { type: "ROOM_POKE", userId: "alice", eventId, data: { targetUserId: "bob", emoji: "drink" } });
    await waitForMessage(bob, (m) => m.type === "ROOM_POKE" && m.data.emoji === "drink");
    expect(bob.messages.filter((m) => m.type === "ROOM_POKE")).toHaveLength(2);
  });
});
