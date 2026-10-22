import { z } from 'zod'

/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report, contract AC-01) — shared contract for
 * the in-session user-content report route
 * `POST /api/social-icebreaker/:socialSessionId/report-content`.
 *
 * The client sends a STRUCTURED reference to the reported content; the server
 * re-snapshots the original text from session state / the participants roster
 * at report time (evidence integrity — the snapshot never passes through the
 * content filter, G4). Only the reporter's free-text `note` is gated.
 *
 * `groupMirrorReason` and `miniscriptVoteNote` are server-ready kinds with no
 * client mount point yet (the client does not render other members' group
 * mirror reasons or vote notes today — verifier R1 P0-1); they live in this
 * union so a future render surface can mount reporting without a contract
 * change.
 */
export const UGC_CONTENT_KINDS = [
  'quipAnswer',
  'undercoverDescription',
  'lieStatement',
  'groupMirrorReason',
  'miniscriptVoteNote',
  'displayName',
] as const

export type UgcContentKind = (typeof UGC_CONTENT_KINDS)[number]

/**
 * Locator semantics per kind (all locators optional — the server falls back to
 * the author's latest matching entry when omitted):
 *  - quipAnswer:           promptId (quipBattlePrompts[].id), index within the author's answers
 *  - undercoverDescription: round (UndercoverWordRound.roundNumber), index within the round
 *  - lieStatement:         index (LieDetectiveStatement.index, 1-based)
 *  - groupMirrorReason:    promptId (GroupMirrorQuestion.id)
 *  - miniscriptVoteNote:   — (at most one why per author per round)
 *  - displayName:          — (snapshot from the participants roster)
 */
export const ugcContentRefSchema = z.object({
  kind: z.enum(UGC_CONTENT_KINDS),
  promptId: z.string().min(1).max(64).optional(),
  round: z.number().int().min(0).optional(),
  index: z.number().int().min(0).optional(),
})

export type UgcContentRef = z.infer<typeof ugcContentRefSchema>

/**
 * `phase` is the client-attested phase where the content was seen; it only
 * feeds the machine-parseable `[icebreaker:<phase>]` description prefix, so it
 * is charset-locked to keep that prefix parseable.
 */
export const icebreakerUgcReportBodySchema = z.object({
  phase: z.string().regex(/^[a-z_]{1,32}$/),
  targetUserId: z.string().min(1).max(64),
  contentRef: ugcContentRefSchema,
  note: z.string().trim().min(1).max(500).optional(),
})

export type IcebreakerUgcReportBody = z.infer<typeof icebreakerUgcReportBodySchema>

/** `reports.category` value used for all icebreaker UGC reports (existing enum value — no new category). */
export const UGC_REPORT_CATEGORY = 'inappropriate_content' as const
