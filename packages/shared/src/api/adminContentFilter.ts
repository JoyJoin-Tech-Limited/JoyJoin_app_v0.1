/**
 * Shared admin content-filter log DTO contract (Sprint S2 moderation review queue).
 *
 * Lives in `packages/shared` so the server validates + returns the typed
 * allow-list DTO and the admin-client (separate execution lane) derives its
 * view model from the same source of truth. DTO lock order: this module lands
 * first; the UI lane builds against it.
 */
import { z } from "zod";

/**
 * Review state of a content filter log row.
 * `pending`  — untouched (column default; existing rows read this).
 * `reviewed` — operator marked the block as handled/legit.
 * `dismissed`— operator overturned the block.
 * `actioned` — operator took a follow-up action on the user.
 * Mirrored by the DB CHECK `content_filter_logs_review_status_check`.
 */
export const ContentFilterReviewStatuses = [
  "pending",
  "reviewed",
  "dismissed",
  "actioned",
] as const;

export type ContentFilterReviewStatus = (typeof ContentFilterReviewStatuses)[number];

/** PATCH /api/admin/content-filter/logs/:id body. At least one field required. */
export const contentFilterLogReviewSchema = z
  .object({
    reviewStatus: z.enum(ContentFilterReviewStatuses).optional(),
    missFlag: z.boolean().optional(),
    note: z.string().max(500).optional(),
  })
  .refine(
    (v) =>
      v.reviewStatus !== undefined ||
      v.missFlag !== undefined ||
      (v.note ?? "").trim().length > 0,
    { message: "at least one field required" },
  );

export type ContentFilterLogReviewBody = z.infer<typeof contentFilterLogReviewSchema>;

/**
 * Allow-list GET/PATCH row DTO for the admin content filter logs surface.
 * Includes the S2 review overlay columns + reviewer displayName (aliased join).
 * Deny-list: no user PII beyond displayName, no full inputPreview truncation
 * concerns (inputPreview is already truncated at write time by contentSafety).
 */
export interface AdminContentFilterLogRow {
  id: string;
  userId: string | null;
  displayName: string | null;
  field: string;
  violationType: string;
  severity: string;
  matchedKeywords: string[];
  inputPreview: string | null;
  source: string | null;
  createdAt: Date | string | null;
  reviewStatus: ContentFilterReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  missFlag: boolean;
  reviewNote: string | null;
  reviewedByDisplayName: string | null;
}

/** GET /api/admin/content-filter/logs query params (all optional). */
export interface AdminContentFilterLogsQuery {
  userId?: string;
  violationType?: string;
  severity?: string;
  field?: string;
  reviewStatus?: ContentFilterReviewStatus;
  missFlag?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** PATCH response: whether an effective change was applied + the fresh row. */
export interface AdminContentFilterLogReviewResponse {
  changed: boolean;
  row: AdminContentFilterLogRow;
}
