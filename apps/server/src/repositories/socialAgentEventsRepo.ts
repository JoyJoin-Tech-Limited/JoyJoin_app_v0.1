import { and, asc, eq, inArray, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import {
  SOCIAL_AGENT_EVENT_KINDS,
  socialAgentEvents,
  type SocialAgentEventKind,
  type SocialAgentEventPayload,
  type SocialAgentEventRow,
} from "@shared/schema";
import type * as schema from "@shared/schema";
import { db } from "../db";

/**
 * Server-only episode facts for M1. There is deliberately no update operation,
 * no cross-session read, and no client-facing route in this module.
 *
 * Session/user FKs are intentionally absent (see migration 0099): facts outlive
 * the 6h session tombstone and are deleted only by the independent 90-day job.
 */
export type SocialAgentEventsDb = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "delete"
>;

export const SOCIAL_AGENT_EVENT_LIST_DEFAULT_LIMIT = 200;
export const SOCIAL_AGENT_EVENT_LIST_MAX_LIMIT = 500;
export const SOCIAL_AGENT_EVENTS_RETENTION_DAYS = 90;
export const SOCIAL_AGENT_EVENTS_RETENTION_MS =
  SOCIAL_AGENT_EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const SOCIAL_AGENT_EVENTS_RETENTION_DEFAULT_BATCH_SIZE = 500;
export const SOCIAL_AGENT_EVENTS_RETENTION_MAX_BATCH_SIZE = 1000;

const MAX_SIGNALS_BYTES = 4096;
const MAX_PAYLOAD_BYTES = 8192;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

function opaqueIdSchema(maxLength: number) {
  return z.string().trim().min(1).max(maxLength).regex(OPAQUE_ID_PATTERN);
}

function machineTokenSchema(maxLength: number) {
  return opaqueIdSchema(maxLength);
}

const idempotencyKeySchema = z.string()
  .trim()
  .min(8)
  .max(80)
  .regex(OPAQUE_ID_PATTERN);
const finiteNonNegativeNumber = z.number().finite().nonnegative();
const finiteNonNegativeInteger = finiteNonNegativeNumber.int();

const signalsSchema = z.record(
  z.union([z.number().finite(), z.boolean()]),
);

/**
 * Only flat, machine-readable values are accepted. In particular there is no
 * prompt, roster, archetype/profile, display-name, note, or arbitrary text key.
 */
const payloadSchema = z.object({
  idempotencyKey: idempotencyKeySchema.optional(),
  reason: machineTokenSchema(80).optional(),
  decision: machineTokenSchema(64).optional(),
  result: machineTokenSchema(64).optional(),
  status: machineTokenSchema(64).optional(),
  errorCode: machineTokenSchema(80).optional(),
  askKind: machineTokenSchema(80).optional(),
  promptVersion: machineTokenSchema(80).optional(),
  provider: machineTokenSchema(40).nullable().optional(),
  model: machineTokenSchema(80).optional(),
  aiCorrelationId: opaqueIdSchema(80).optional(),
  fallbackUsed: z.boolean().optional(),
  fromCache: z.boolean().optional(),
  aiGenerated: z.boolean().optional(),
  latencyMs: finiteNonNegativeNumber.optional(),
  llmCallCount: finiteNonNegativeInteger.optional(),
  inputTokens: finiteNonNegativeInteger.optional(),
  outputTokens: finiteNonNegativeInteger.optional(),
  totalTokens: finiteNonNegativeInteger.optional(),
  promptTokens: finiteNonNegativeInteger.optional(),
  completionTokens: finiteNonNegativeInteger.optional(),
  reasoningTokens: finiteNonNegativeInteger.optional(),
  estimatedCostYuan: finiteNonNegativeNumber.optional(),
  baseTopicSetRevision: finiteNonNegativeInteger.optional(),
  resultRevision: finiteNonNegativeInteger.optional(),
  proactiveEnabled: z.boolean().optional(),
  ignoredStreak: finiteNonNegativeInteger.optional(),
  snapshotScope: z.enum(["action_recovery", "micro_challenge_observation"]).optional(),
  snapshotKey: machineTokenSchema(128).optional(),
  recoveryOffsetSeconds: z.union([z.literal(60), z.literal(180)]).optional(),
  phaseStartedAt: finiteNonNegativeInteger.optional(),
  observationWindowStart: finiteNonNegativeInteger.optional(),
}).strict();

const appendInputSchema = z.object({
  socialSessionId: opaqueIdSchema(80),
  phase: machineTokenSchema(40),
  kind: z.enum(SOCIAL_AGENT_EVENT_KINDS),
  askId: opaqueIdSchema(80).nullish(),
  idempotencyKey: idempotencyKeySchema.nullish(),
  actorUserId: opaqueIdSchema(128).nullish(),
  signals: signalsSchema.nullish(),
  payload: payloadSchema.optional(),
  createdAt: z.date().optional(),
}).strict();

export interface AppendSocialAgentEventInput {
  socialSessionId: string;
  phase: string;
  kind: SocialAgentEventKind;
  askId?: string | null;
  idempotencyKey?: string | null;
  /** Host actor only; participant behaviour must not be written as facts. */
  actorUserId?: string | null;
  /** Aggregate numeric/boolean signals only. */
  signals?: Record<string, number | boolean> | null;
  payload?: SocialAgentEventPayload;
  /** Server/test clock only; never accepted from a client route directly. */
  createdAt?: Date;
}

export interface AppendSocialAgentEventResult {
  event: SocialAgentEventRow;
  /** True only when an existing action_commit claim was returned. */
  replayed: boolean;
}

export interface SocialAgentSessionLlmUsage {
  llmCallCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostYuan: number;
}

function assertJsonBound(value: unknown, maxBytes: number, label: string): void {
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > maxBytes) {
    throw new Error(`${label} exceeds ${maxBytes} bytes`);
  }
}

function normalizeAppendInput(input: AppendSocialAgentEventInput) {
  const parsed = appendInputSchema.parse(input);
  const payload = parsed.payload ?? {};
  const signals = parsed.signals ?? null;

  if (Object.keys(signals ?? {}).length > 64) {
    throw new Error("signals exceeds 64 aggregate fields");
  }
  assertJsonBound(signals, MAX_SIGNALS_BYTES, "signals");
  assertJsonBound(payload, MAX_PAYLOAD_BYTES, "payload");

  const requiresAskId = [
    "ask_created",
    "ask_decision",
    "action_commit",
    "action_failed",
  ].includes(parsed.kind);
  if (requiresAskId && !parsed.askId) {
    throw new Error(`${parsed.kind} requires askId`);
  }

  if (parsed.kind === "action_commit") {
    if (!parsed.idempotencyKey) {
      throw new Error("action_commit requires a top-level idempotencyKey");
    }
    if (payload.idempotencyKey && payload.idempotencyKey !== parsed.idempotencyKey) {
      throw new Error("action_commit payload idempotencyKey must match the claim");
    }
  } else if (parsed.idempotencyKey != null) {
    throw new Error("Only action_commit may claim a top-level idempotencyKey");
  }

  if (parsed.kind === "action_failed" && !payload.idempotencyKey) {
    throw new Error("action_failed requires payload.idempotencyKey for safe retry");
  }
  if (
    parsed.kind === "ask_decision" &&
    payload.decision === "accepted" &&
    !payload.idempotencyKey
  ) {
    throw new Error("Accepted ask_decision requires payload.idempotencyKey");
  }

  return {
    socialSessionId: parsed.socialSessionId,
    phase: parsed.phase,
    kind: parsed.kind,
    askId: parsed.askId ?? null,
    idempotencyKey: parsed.kind === "action_commit" ? parsed.idempotencyKey! : null,
    actorUserId: parsed.actorUserId ?? null,
    signals,
    payload,
    ...(parsed.createdAt ? { createdAt: parsed.createdAt } : {}),
  };
}

/**
 * Append one fact. ON CONFLICT DO NOTHING turns an action_commit unique-claim
 * race into a read of the already committed fact, without aborting a caller's
 * transaction or duplicating history.
 */
export async function appendSocialAgentEvent(
  input: AppendSocialAgentEventInput,
  database: SocialAgentEventsDb = db,
): Promise<AppendSocialAgentEventResult> {
  const values = normalizeAppendInput(input);
  const [inserted] = await database
    .insert(socialAgentEvents)
    .values(values)
    .onConflictDoNothing()
    .returning();

  if (inserted) return { event: inserted, replayed: false };

  if (values.kind === "action_commit" && values.idempotencyKey) {
    const existing = await findSocialAgentActionCommitByIdempotencyKey(
      values.socialSessionId,
      values.idempotencyKey,
      database,
    );
    if (existing) return { event: existing, replayed: true };
  }

  // No other append conflict is expected: ids are DB-generated and non-action
  // events never claim the partial unique key.
  throw new Error("SOCIAL_AGENT_EVENT_APPEND_CONFLICT");
}

export async function findSocialAgentActionCommitByIdempotencyKey(
  socialSessionId: string,
  idempotencyKey: string,
  database: SocialAgentEventsDb = db,
): Promise<SocialAgentEventRow | undefined> {
  const sessionId = opaqueIdSchema(80).parse(socialSessionId);
  const claimKey = idempotencyKeySchema.parse(idempotencyKey);
  const [row] = await database
    .select()
    .from(socialAgentEvents)
    .where(and(
      eq(socialAgentEvents.socialSessionId, sessionId),
      eq(socialAgentEvents.kind, "action_commit"),
      eq(socialAgentEvents.idempotencyKey, claimKey),
    ))
    .limit(1);
  return row;
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) {
    return SOCIAL_AGENT_EVENT_LIST_DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(SOCIAL_AGENT_EVENT_LIST_MAX_LIMIT, Math.floor(limit)));
}

/** Evaluation/recovery only; never expose this session history through a client route. */
export async function listSocialAgentEventsForSession(
  socialSessionId: string,
  options: { limit?: number } = {},
  database: SocialAgentEventsDb = db,
): Promise<SocialAgentEventRow[]> {
  const sessionId = opaqueIdSchema(80).parse(socialSessionId);
  return database
    .select()
    .from(socialAgentEvents)
    .where(eq(socialAgentEvents.socialSessionId, sessionId))
    .orderBy(asc(socialAgentEvents.createdAt), asc(socialAgentEvents.id))
    .limit(normalizeListLimit(options.limit));
}

/** Ask-linked recovery chain: ask_created → decision → commit/failure. */
export async function listSocialAgentEventsForAsk(
  socialSessionId: string,
  askId: string,
  options: { limit?: number } = {},
  database: SocialAgentEventsDb = db,
): Promise<SocialAgentEventRow[]> {
  const sessionId = opaqueIdSchema(80).parse(socialSessionId);
  const parsedAskId = opaqueIdSchema(80).parse(askId);
  return database
    .select()
    .from(socialAgentEvents)
    .where(and(
      eq(socialAgentEvents.socialSessionId, sessionId),
      eq(socialAgentEvents.askId, parsedAskId),
    ))
    .orderBy(asc(socialAgentEvents.createdAt), asc(socialAgentEvents.id))
    .limit(normalizeListLimit(options.limit));
}

function usageNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Agent-only actual attempts (commit + failed), aggregated within one session. */
export async function aggregateSocialAgentSessionLlmUsage(
  socialSessionId: string,
  database: SocialAgentEventsDb = db,
): Promise<SocialAgentSessionLlmUsage> {
  const sessionId = opaqueIdSchema(80).parse(socialSessionId);
  const rows = await database
    .select({ payload: socialAgentEvents.payload })
    .from(socialAgentEvents)
    .where(and(
      eq(socialAgentEvents.socialSessionId, sessionId),
      inArray(socialAgentEvents.kind, ["action_commit", "action_failed"]),
    ));

  let llmCallCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostYuan = 0;
  for (const row of rows) {
    llmCallCount += usageNumber(row.payload.llmCallCount);
    inputTokens += usageNumber(row.payload.inputTokens);
    outputTokens += usageNumber(row.payload.outputTokens);
    estimatedCostYuan += usageNumber(row.payload.estimatedCostYuan);
  }

  return {
    llmCallCount,
    inputTokens,
    outputTokens,
    // Stable micro-yuan precision avoids binary floating-point noise at ¥0.20.
    estimatedCostYuan: Number(estimatedCostYuan.toFixed(6)),
  };
}

export function getSocialAgentEventsRetentionCutoff(now: Date = new Date()): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid retention clock");
  return new Date(now.getTime() - SOCIAL_AGENT_EVENTS_RETENTION_MS);
}

function normalizeRetentionBatchSize(batchSize: number | undefined): number {
  if (batchSize == null || !Number.isFinite(batchSize)) {
    return SOCIAL_AGENT_EVENTS_RETENTION_DEFAULT_BATCH_SIZE;
  }
  return Math.max(
    1,
    Math.min(SOCIAL_AGENT_EVENTS_RETENTION_MAX_BATCH_SIZE, Math.floor(batchSize)),
  );
}

/**
 * Delete one bounded batch strictly older than 90 days. Selection + deletion is
 * idempotent under concurrent cleaners; append-only rows never change cutoff.
 */
export async function deleteExpiredSocialAgentEvents(
  options: { now?: Date; batchSize?: number } = {},
  database: SocialAgentEventsDb = db,
): Promise<number> {
  const cutoff = getSocialAgentEventsRetentionCutoff(options.now ?? new Date());
  const batchSize = normalizeRetentionBatchSize(options.batchSize);
  const expired = await database
    .select({ id: socialAgentEvents.id })
    .from(socialAgentEvents)
    .where(lt(socialAgentEvents.createdAt, cutoff))
    .orderBy(asc(socialAgentEvents.createdAt), asc(socialAgentEvents.id))
    .limit(batchSize);

  if (expired.length === 0) return 0;
  const deleted = await database
    .delete(socialAgentEvents)
    .where(inArray(socialAgentEvents.id, expired.map((row) => row.id)))
    .returning({ id: socialAgentEvents.id });
  return deleted.length;
}
