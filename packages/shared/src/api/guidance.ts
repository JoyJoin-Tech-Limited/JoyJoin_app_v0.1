import { z } from 'zod'

/**
 * Guidance queue (C4 onboarding guidance iteration, 2026-08-27) — shared
 * client/server contract.
 *
 * The tip-id enum is the SINGLE source of truth for which guidance tips the
 * platform knows about. The server validates `POST /api/guidance/seen` bodies
 * against it (unknown tipId → 400, fail-closed) and the mini-program guidance
 * registry (`lib/guidance/registry.ts`) must keep its registered tip ids a
 * subset of this enum — locked by the client-side registry ⊆ enum contract
 * test so a registry id the enum doesn't know fails CI instead of 400ing
 * silently on dismiss.
 *
 * Extension rule: later waves APPEND new ids here (tab tips, spotlight,
 * flash/blind-box entries). Never rename or remove an id — seen-state is
 * persisted server-side in `users.seen_guidance` keyed by these ids.
 */
export const GUIDANCE_TIP_IDS = [
  /** W1: discover first-arrival coachmark (absorbed from the legacy
   *  storage-keyed arrival tip in pages/discover). */
  'discover_arrival',
] as const

export type GuidanceTipId = (typeof GUIDANCE_TIP_IDS)[number]

export const guidanceTipIdSchema = z.enum(GUIDANCE_TIP_IDS)

/**
 * Persisted seen-state shape: `users.seen_guidance` jsonb —
 * `{ [tipId]: isoDate }`. NULL in the DB means the empty map (handled in
 * code, no backfill). First-write-wins: the earliest timestamp survives.
 */
export type SeenGuidanceMap = Partial<Record<GuidanceTipId, string>> & Record<string, string>

/** POST /api/guidance/seen request body — a single tipId (no batch shape). */
export const markGuidanceSeenBodySchema = z
  .object({
    tipId: guidanceTipIdSchema,
  })
  .strict()

export type MarkGuidanceSeenBody = z.infer<typeof markGuidanceSeenBodySchema>

export interface MarkGuidanceSeenResponse {
  success: true
  tipId: GuidanceTipId
  /** ISO timestamp persisted for this tip — the EARLIEST write wins; a repost
   *  echoes the original timestamp unchanged. */
  seenAt: string
  /** true when the tip was already recorded (idempotent no-op repost). */
  alreadySeen: boolean
}
