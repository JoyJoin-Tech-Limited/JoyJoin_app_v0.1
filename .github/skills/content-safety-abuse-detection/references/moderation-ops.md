# Moderation Operations and Detailed Reference

## Current repo anchors

- `apps/server/src/contentFilter.ts` — sensitive-word lists, severity mapping, gibberish/repetition detection
- `apps/server/src/lib/contentSafety.ts` — **preferred entry point for field-level validation.** `validateContentSafe()` wraps the filter, returns a 400-ready JSON shape, auto-logs violations to `content_filter_logs`. Use this for displayName, bio, tags, and other simple text inputs.
- `apps/server/src/abuseDetection.ts` — token quotas, conversation guards, violation escalation, `recordViolation` (single enforcement path; `checkUserAbuse` removed 2026-08-06)
- `apps/server/src/rateLimiter.ts` — `createRateLimiter`, AI/auth/payment/webhook limiters, `chatReportSubmissionLimiter` (5 req/5 min on `POST /api/chat-reports`), in-memory store cleanup
- `apps/server/src/routes.ts` — `/api/admin/users/:id/ban|unban`, `/api/admin/moderation/*`
- `apps/server/src/routes/domains/adminOperations.ts` — `GET /api/admin/content-filter/logs` (paginated content filter log query, filterable by userId/violationType/severity/field/date range + `reviewStatus`/`missFlag`, JOINs users for displayName incl. reviewer) and `PATCH /api/admin/content-filter/logs/:id` (operator+ review overlay, idempotent, audit-logged `CONTENT_FILTER_LOG_REVIEWED`)
- `packages/shared/src/schema.ts` — `users.isBanned`, `users.violationCount`, `users.aiFrozenUntil`, `reports`, `moderationLogs`, `chatReports`, `chatLogs`
- `packages/shared/src/schema/_definitions.ts` — `contentFilterLogs` pgTable, `insertContentFilterLogSchema`
- `apps/server/src/tagGenerationService.ts` — `BLACKLIST_KEYWORDS`, `validateTag` for AI-generated content moderation
- `apps/server/src/lib/adminAuditLogger.ts` — `USER_BANNED`, `USER_UNBANNED` action vocabulary

## Profanity filter specifics

`contentFilter.ts` is the canonical authority for sensitive-word detection. It uses exact substring matching. Do not move filter logic to the client or replace it with an LLM call.

To add a new category:
1. Extend `sensitiveWordLists` with a `ViolationType` entry
2. Choose `warning` or `severe`
3. Add a corresponding message in the `messages` record
4. Do not hard-code severity in route handlers

## Rate-limiting rules

`rateLimiter.ts` uses a local `Map`. This will not share state across server instances. Document any new limiter with a TODO for Redis migration if the endpoint is attacker-facing.

When adding a rate limiter to a new AI endpoint: import `createRateLimiter`, instantiate it with a descriptive `keyPrefix`, and apply it as Express middleware.

## AI token quota and freeze logic

Violation escalation ladder:
- Warning → 1-hour AI freeze → 24-hour AI freeze → permanent ban
- Severe violations count as +2; warnings count as +1
- Thresholds are defined in `abuseDetection.ts` and must be changed deliberately, not ad-hoc in route handlers

To debug why a user sees "AI功能暂时冻结": check `users.aiFrozenUntil` in the DB, then trace `abuseDetection.ts` → `recordViolation` to see which threshold was crossed (`warningFreezeHours`, `tempBanHours`, or `permBan`).

## Chat reporting flow

Reports are dual-track:
- `reports` table: general user/content reports (harassment, fake profile, inappropriate content)
- `chatReports` table: event-group-chat message reports

Keep schemas aligned with `packages/shared/src/schema.ts` and do not mix the two flows in a single UI or API surface.

## Freeze/unfreeze procedures

Ban/unban and report resolution must emit `logAdminAudit(...)` with `action: 'USER_BANNED'` or `'USER_UNBANNED'`. Do not silently change `isBanned`.

## Content filter review queue (2026-08-06, content-mod S2)

- `content_filter_logs` review columns are additive nullable (migration `0076_content_filter_logs_review.sql`, manual psql for prod): `reviewStatus` (`pending` default / `reviewed` / `dismissed` / `actioned`), `reviewedBy`, `reviewedAt`, `missFlag` (误伤, default `false`), `reviewNote`.
- `PATCH /api/admin/content-filter/logs/:id` (operator+, idempotent — no-op when nothing changes) sets the overlay and writes `CONTENT_FILTER_LOG_REVIEWED` to `admin_audit_logs` with top-level `before`/`after` snapshots of `reviewStatus` + `missFlag`.
- `GET /api/admin/content-filter/logs` accepts `reviewStatus` and `missFlag` query filters and returns the reviewer's `displayName`.
- **Retrain loop:** `missFlag = true` (误伤) marks a false-positive block — feed those matched keywords back into `contentFilter.ts` list curation and re-run `contentFilterSimulation.test.ts` (must-catch zero misses stays a blocking requirement).
- Admin UI: `/admin/content-filter` (内容审核日志), visible to `super_admin` + `operator`.

## Content moderation on AI output

The social-tag generator in `tagGenerationService.ts` validates generated tags against `BLACKLIST_KEYWORDS` before returning them. Follow this pattern for new AI-backed features that emit user-visible strings.
