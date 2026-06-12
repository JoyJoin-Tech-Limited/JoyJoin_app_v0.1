# Moderation Operations and Detailed Reference

## Current repo anchors

- `apps/server/src/contentFilter.ts` — sensitive-word lists, severity mapping, gibberish/repetition detection
- `apps/server/src/lib/contentSafety.ts` — **preferred entry point for field-level validation.** `validateContentSafe()` wraps the filter, returns a 400-ready JSON shape, auto-logs violations to `content_filter_logs`. Use this for displayName, bio, tags, and other simple text inputs.
- `apps/server/src/abuseDetection.ts` — `checkUserAbuse`, token quotas, conversation guards, violation escalation, `recordViolation`
- `apps/server/src/rateLimiter.ts` — `createRateLimiter`, AI/auth/payment/webhook limiters, in-memory store cleanup
- `apps/server/src/routes.ts` — `/api/admin/users/:id/ban|unban`, `/api/admin/moderation/*`, `/api/registration/chat/message` abuse gate
- `apps/server/src/routes/domains/adminOperations.ts` — `GET /api/admin/content-filter/logs` (paginated content filter log query, filterable by userId/violationType/severity/field/date range, JOINs users for displayName)
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

## Content moderation on AI output

The social-tag generator in `tagGenerationService.ts` validates generated tags against `BLACKLIST_KEYWORDS` before returning them. Follow this pattern for new AI-backed features that emit user-visible strings.
