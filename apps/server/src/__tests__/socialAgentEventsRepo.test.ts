import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
    and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
    asc: vi.fn((column: unknown) => ({ op: "asc", column })),
    lt: vi.fn((column: unknown, value: unknown) => ({ op: "lt", column, value })),
    inArray: vi.fn((column: unknown, values: unknown[]) => ({ op: "inArray", column, values })),
  };
});

import { socialAgentEvents, type SocialAgentEventRow } from "@shared/schema";
import {
  aggregateSocialAgentSessionLlmUsage,
  appendSocialAgentEvent,
  deleteExpiredSocialAgentEvents,
  findSocialAgentActionCommitByIdempotencyKey,
  getSocialAgentEventsRetentionCutoff,
  listSocialAgentEventsForAsk,
  listSocialAgentEventsForSession,
  SOCIAL_AGENT_EVENTS_RETENTION_MS,
  type AppendSocialAgentEventInput,
} from "../repositories/socialAgentEventsRepo";
import {
  createSocialAgentEventsRetentionScheduler,
  type SocialAgentEventsRetentionDependencies,
} from "../lib/socialAgentEventsRetention";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const DEFAULT_CREATED_AT = new Date("2026-10-26T00:00:00.000Z");
const COLUMN_KEYS = new Map<object, keyof SocialAgentEventRow>([
  [socialAgentEvents.id, "id"],
  [socialAgentEvents.socialSessionId, "socialSessionId"],
  [socialAgentEvents.phase, "phase"],
  [socialAgentEvents.kind, "kind"],
  [socialAgentEvents.askId, "askId"],
  [socialAgentEvents.idempotencyKey, "idempotencyKey"],
  [socialAgentEvents.actorUserId, "actorUserId"],
  [socialAgentEvents.signals, "signals"],
  [socialAgentEvents.payload, "payload"],
  [socialAgentEvents.createdAt, "createdAt"],
]);

function operand(row: SocialAgentEventRow, value: unknown): unknown {
  if (COLUMN_KEYS.has(value as object)) {
    return row[COLUMN_KEYS.get(value as object)!];
  }
  return value;
}

function compare(left: unknown, right: unknown): number {
  const a = left instanceof Date ? left.getTime() : left;
  const b = right instanceof Date ? right.getTime() : right;
  if (a === b) return 0;
  return (a as any) < (b as any) ? -1 : 1;
}

function matches(row: SocialAgentEventRow, condition: any): boolean {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((child: unknown) => matches(row, child));
  }
  if (condition.op === "eq") {
    return compare(operand(row, condition.column), operand(row, condition.value)) === 0;
  }
  if (condition.op === "lt") {
    return compare(operand(row, condition.column), operand(row, condition.value)) < 0;
  }
  if (condition.op === "inArray") {
    return condition.values.some(
      (value: unknown) => compare(operand(row, condition.column), value) === 0,
    );
  }
  throw new Error(`Unsupported mock condition: ${condition.op}`);
}

function project(row: SocialAgentEventRow, selection?: Record<string, unknown>): any {
  if (!selection) return { ...row };
  return Object.fromEntries(
    Object.entries(selection).map(([key, column]) => [key, operand(row, column)]),
  );
}

/** In-memory implementation of only the Drizzle chains used by the real repo. */
function createDbHarness() {
  let rows: SocialAgentEventRow[] = [];
  let nextId = 1;
  const insertCalls: any[] = [];
  const update = vi.fn(() => {
    throw new Error("Episode facts are append-only");
  });

  const db = {
    update,
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        insertCalls.push(values);
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (
                values.idempotencyKey != null &&
                rows.some((row) =>
                  row.socialSessionId === values.socialSessionId &&
                  row.idempotencyKey === values.idempotencyKey
                )
              ) {
                // Models the partial unique claim: NULL keys never conflict.
                return [];
              }
              const row: SocialAgentEventRow = {
                id: `event-${String(nextId++).padStart(6, "0")}`,
                socialSessionId: values.socialSessionId,
                phase: values.phase,
                kind: values.kind,
                askId: values.askId ?? null,
                idempotencyKey: values.idempotencyKey ?? null,
                actorUserId: values.actorUserId ?? null,
                signals: values.signals ?? null,
                payload: values.payload ?? {},
                createdAt: values.createdAt ?? DEFAULT_CREATED_AT,
              };
              rows.push(row);
              return [{ ...row }];
            }),
          })),
        };
      }),
    })),
    select: vi.fn((selection?: Record<string, unknown>) => {
      const query = {
        condition: undefined as any,
        orders: [] as any[],
        limit: undefined as number | undefined,
      };
      const execute = async () => {
        const selected = rows
          .filter((row) => matches(row, query.condition))
          .sort((left, right) => {
            for (const order of query.orders) {
              const result = compare(operand(left, order.column), operand(right, order.column));
              if (result !== 0) return result;
            }
            return 0;
          })
          .slice(0, query.limit ?? rows.length);
        return selected.map((row) => project(row, selection));
      };
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn((condition: unknown) => {
          query.condition = condition;
          return chain;
        }),
        orderBy: vi.fn((...orders: unknown[]) => {
          query.orders = orders;
          return chain;
        }),
        limit: vi.fn((limit: number) => {
          query.limit = limit;
          return execute();
        }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          execute().then(resolve, reject),
      };
      return chain;
    }),
    delete: vi.fn(() => ({
      where: vi.fn((condition: unknown) => ({
        returning: vi.fn(async (selection?: Record<string, unknown>) => {
          const deleted = rows.filter((row) => matches(row, condition));
          const deletedIds = new Set(deleted.map((row) => row.id));
          rows = rows.filter((row) => !deletedIds.has(row.id));
          return deleted.map((row) => project(row, selection));
        }),
      })),
    })),
  };

  return {
    db: db as any,
    update,
    insertCalls,
    get rows() {
      return rows;
    },
  };
}

function appendEvent(
  harness: ReturnType<typeof createDbHarness>,
  overrides: Partial<AppendSocialAgentEventInput> = {},
) {
  return appendSocialAgentEvent({
    socialSessionId: "session-1",
    phase: "warmup",
    kind: "signal_snapshot",
    actorUserId: "host-1",
    payload: {},
    ...overrides,
  }, harness.db);
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("socialAgentEventsRepo — append and idempotency claims", () => {
  let harness: ReturnType<typeof createDbHarness>;

  beforeEach(() => {
    harness = createDbHarness();
  });

  it("does not let decision/failure keys claim uniqueness; failed → same-key retry → commit succeeds", async () => {
    const key = "retry-key-0001";
    const decision = await appendEvent(harness, {
      kind: "ask_decision",
      askId: "ask-1",
      idempotencyKey: null,
      payload: { decision: "accepted", idempotencyKey: key },
    });
    const failed = await appendEvent(harness, {
      kind: "action_failed",
      askId: "ask-1",
      idempotencyKey: null,
      payload: { result: "failed", errorCode: "llm_error", idempotencyKey: key },
    });
    const committed = await appendEvent(harness, {
      kind: "action_commit",
      askId: "ask-1",
      idempotencyKey: key,
      payload: { result: "succeeded", resultRevision: 2, idempotencyKey: key },
    });

    expect(decision.event.idempotencyKey).toBeNull();
    expect(failed.event.idempotencyKey).toBeNull();
    expect(failed.event.payload.idempotencyKey).toBe(key);
    expect(committed.replayed).toBe(false);
    expect(committed.event.idempotencyKey).toBe(key);
    expect(harness.rows).toHaveLength(3);
    await expect(findSocialAgentActionCommitByIdempotencyKey("session-1", key, harness.db))
      .resolves.toMatchObject({ id: committed.event.id, kind: "action_commit" });
  });

  it("returns the existing action_commit on unique-claim replay without duplicating facts", async () => {
    const input: Partial<AppendSocialAgentEventInput> = {
      kind: "action_commit",
      askId: "ask-1",
      idempotencyKey: "retry-key-0002",
      payload: { result: "succeeded", resultRevision: 4 },
    };
    const first = await appendEvent(harness, input);
    const replay = await appendEvent(harness, {
      ...input,
      payload: { result: "succeeded", resultRevision: 99 },
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.event.id).toBe(first.event.id);
    expect(replay.event.payload.resultRevision).toBe(4);
    expect(harness.rows).toHaveLength(1);
  });

  it("allows the same commit key in a different session but rejects non-action claims", async () => {
    const key = "retry-key-0003";
    await appendEvent(harness, {
      kind: "action_commit",
      askId: "ask-1",
      idempotencyKey: key,
      payload: { result: "succeeded" },
    });
    const otherSession = await appendEvent(harness, {
      socialSessionId: "session-2",
      kind: "action_commit",
      askId: "ask-2",
      idempotencyKey: key,
      payload: { result: "succeeded" },
    });
    expect(otherSession.replayed).toBe(false);

    await expect(appendEvent(harness, {
      kind: "ask_decision",
      askId: "ask-3",
      idempotencyKey: key,
      payload: { decision: "ignored" },
    })).rejects.toThrow("Only action_commit");
    await expect(appendEvent(harness, {
      kind: "action_commit",
      askId: "ask-4",
      payload: { result: "succeeded" },
    })).rejects.toThrow("requires a top-level idempotencyKey");
  });

  it("rejects raw prompt/roster/profile/free-text and non-finite or nested signals", async () => {
    for (const payload of [
      { prompt: "raw prompt" },
      { roster: [{ displayName: "private name" }] },
      { archetype: "开心柯基" },
      { note: "free text" },
      { estimatedCostYuan: Number.NaN },
      { inputTokens: Number.POSITIVE_INFINITY },
    ]) {
      await expect(appendEvent(harness, { payload: payload as any })).rejects.toThrow();
    }
    await expect(appendEvent(harness, {
      signals: { roster: [{ userId: "participant-1" }] } as any,
    })).rejects.toThrow();
    await expect(appendEvent(harness, {
      signals: { mixText: "private profile text" } as any,
    })).rejects.toThrow();
    expect(harness.rows).toHaveLength(0);
  });
});

describe("socialAgentEventsRepo — ordering and agent-only usage", () => {
  let harness: ReturnType<typeof createDbHarness>;

  beforeEach(() => {
    harness = createDbHarness();
  });

  it("lists session/ask facts oldest-first without any history update operation", async () => {
    const late = await appendEvent(harness, {
      kind: "policy_changed",
      createdAt: new Date("2026-10-26T10:03:00Z"),
      payload: { proactiveEnabled: false },
    });
    const early = await appendEvent(harness, {
      kind: "ask_created",
      askId: "ask-1",
      createdAt: new Date("2026-10-26T10:01:00Z"),
      payload: { reason: "topic_stall" },
    });
    const middle = await appendEvent(harness, {
      kind: "signal_snapshot",
      askId: "ask-1",
      createdAt: new Date("2026-10-26T10:02:00Z"),
      signals: { completionRate: 0.5, fallbackUsed: false },
      payload: { snapshotScope: "action_recovery", recoveryOffsetSeconds: 60 },
    });
    await appendEvent(harness, {
      kind: "ask_created",
      askId: "ask-2",
      createdAt: new Date("2026-10-26T10:04:00Z"),
      payload: { reason: "pulse_low" },
    });

    const sessionRows = await listSocialAgentEventsForSession("session-1", {}, harness.db);
    expect(sessionRows.map((row) => row.id)).toEqual([
      early.event.id,
      middle.event.id,
      late.event.id,
      harness.rows[3].id,
    ]);
    const askRows = await listSocialAgentEventsForAsk("session-1", "ask-1", {}, harness.db);
    expect(askRows.map((row) => row.id)).toEqual([early.event.id, middle.event.id]);
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("aggregates actual action attempts only and does not double-count commit replay", async () => {
    await appendEvent(harness, {
      kind: "ask_created",
      askId: "ask-1",
      payload: { llmCallCount: 99, estimatedCostYuan: 99 },
    });
    await appendEvent(harness, {
      kind: "action_failed",
      askId: "ask-1",
      payload: {
        result: "failed",
        idempotencyKey: "usage-key-001",
        llmCallCount: 1,
        inputTokens: 100,
        outputTokens: 40,
        estimatedCostYuan: 0.05,
      },
    });
    const commitInput: Partial<AppendSocialAgentEventInput> = {
      kind: "action_commit",
      askId: "ask-2",
      idempotencyKey: "usage-key-002",
      payload: {
        result: "succeeded",
        llmCallCount: 1,
        inputTokens: 50,
        outputTokens: 20,
        estimatedCostYuan: 0.15,
      },
    };
    await appendEvent(harness, commitInput);
    await appendEvent(harness, commitInput);

    await expect(aggregateSocialAgentSessionLlmUsage("session-1", harness.db)).resolves.toEqual({
      llmCallCount: 2,
      inputTokens: 150,
      outputTokens: 60,
      estimatedCostYuan: 0.2,
    });
  });
});

describe("socialAgentEventsRepo — independent 90-day retention", () => {
  let harness: ReturnType<typeof createDbHarness>;

  beforeEach(() => {
    harness = createDbHarness();
  });

  it("keeps 89-day and exact-cutoff rows while deleting rows older than 90 days", async () => {
    const eightyNineDays = await appendEvent(harness, { createdAt: daysBefore(NOW, 89) });
    const exactlyNinetyDays = await appendEvent(harness, { createdAt: daysBefore(NOW, 90) });
    const justExpired = await appendEvent(harness, {
      createdAt: new Date(daysBefore(NOW, 90).getTime() - 1),
    });

    expect(getSocialAgentEventsRetentionCutoff(NOW).getTime())
      .toBe(NOW.getTime() - SOCIAL_AGENT_EVENTS_RETENTION_MS);
    await expect(deleteExpiredSocialAgentEvents({ now: NOW, batchSize: 10 }, harness.db))
      .resolves.toBe(1);
    expect(harness.rows.map((row) => row.id)).toEqual([
      eightyNineDays.event.id,
      exactlyNinetyDays.event.id,
    ]);
    expect(harness.rows.some((row) => row.id === justExpired.event.id)).toBe(false);
  });

  it("deletes oldest-first in bounded batches", async () => {
    for (let index = 0; index < 5; index += 1) {
      await appendEvent(harness, {
        createdAt: new Date(daysBefore(NOW, 91).getTime() + index * 1000),
      });
    }

    await expect(deleteExpiredSocialAgentEvents({ now: NOW, batchSize: 2 }, harness.db))
      .resolves.toBe(2);
    expect(harness.rows.map((row) => row.id)).toEqual(["event-000003", "event-000004", "event-000005"]);
    await expect(deleteExpiredSocialAgentEvents({ now: NOW, batchSize: 2 }, harness.db))
      .resolves.toBe(2);
    await expect(deleteExpiredSocialAgentEvents({ now: NOW, batchSize: 2 }, harness.db))
      .resolves.toBe(1);
    await expect(deleteExpiredSocialAgentEvents({ now: NOW, batchSize: 2 }, harness.db))
      .resolves.toBe(0);
  });

  it("caps each scheduler run and reuses one cutoff clock across batches", async () => {
    const deleteBatch = vi.fn(async () => 2);
    const scheduler = createSocialAgentEventsRetentionScheduler({
      logger: { info: vi.fn(), error: vi.fn() },
      now: () => NOW,
      deleteBatch,
      batchSize: 2,
      maxBatchesPerRun: 2,
      intervalMs: 60_000,
    });

    const result = await scheduler.runOnce();
    expect(deleteBatch).toHaveBeenCalledTimes(2);
    expect(deleteBatch.mock.calls).toEqual([
      [{ now: NOW, batchSize: 2 }],
      [{ now: NOW, batchSize: 2 }],
    ]);
    expect(result).toEqual({ deletedCount: 4, batchCount: 2, hasMore: true, failed: false });
  });

  it("logs cleanup failure fail-open and succeeds on a later run", async () => {
    const error = Object.assign(new Error("relation temporarily unavailable"), { code: "42P01" });
    const deleteBatch = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(0);
    const logger = { info: vi.fn(), error: vi.fn() };
    const scheduler = createSocialAgentEventsRetentionScheduler({
      logger,
      now: () => NOW,
      deleteBatch,
      batchSize: 500,
      maxBatchesPerRun: 20,
      intervalMs: 60_000,
    });

    await expect(scheduler.runOnce()).resolves.toMatchObject({ failed: true, hasMore: true });
    expect(scheduler.isStopped()).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "[SocialAgentEventsRetention] cleanup failed; will retry next interval",
      expect.objectContaining({ failOpen: true, willRetryNextInterval: true, code: "42P01" }),
    );
    await expect(scheduler.runOnce()).resolves.toMatchObject({ failed: false, deletedCount: 0 });
  });

  it("locks migration and startup to partial claims and an independent scheduler", () => {
    const migration = readFileSync(
      new URL("../../migrations/0099_social_agent_events.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_social_agent_events_action_commit_idempotency"');
    expect(migration).toContain('WHERE "idempotency_key" IS NOT NULL');
    expect(migration).toContain('"kind" = \'action_commit\' AND "idempotency_key" IS NOT NULL');
    expect(migration).toContain('"kind" <> \'action_commit\' AND "idempotency_key" IS NULL');
    expect(migration).not.toContain("REFERENCES");

    const retentionSource = readFileSync(
      new URL("../lib/socialAgentEventsRetention.ts", import.meta.url),
      "utf8",
    );
    expect(retentionSource).not.toContain("socialIcebreakerSweep");
    expect(retentionSource).not.toContain("sweepExpiredSessions");
    const startupSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
    expect(startupSource).toContain('from "./lib/socialAgentEventsRetention"');
    expect(startupSource).toContain("startSocialAgentEventsRetentionScheduler();");
  });
});
