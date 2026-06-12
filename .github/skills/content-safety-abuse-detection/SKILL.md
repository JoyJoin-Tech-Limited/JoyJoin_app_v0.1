---
name: content-safety-abuse-detection
description: >-
  Abuse detection, content filtering, user moderation, and trust-and-safety
  mechanics for the JoyJoin platform. Use when implementing or reviewing
  profanity/sensitive-word filtering, rate-limiting, user bans, violation
  tracking, AI token quotas, chat reporting, or admin moderation workflows.
  Trigger phrases: "abuse detection", "content filter", "ban user", "moderation",
  "profanity filter", "rate limit", "violation count", "sensitive word",
  "chat report", "ai frozen".
---

# Content Safety and Abuse Detection

**Core rule:** Keep filtering deterministic and server-side. Respect the violation escalation ladder. Always pair moderation mutations with audit logs. Keep reports dual-track.

**2026-06-12 addition — Universal field-level content gate:** For server-side simple field-level validation (displayName, bio, tags, etc.), call `validateContentSafe(fieldName, value)` from `apps/server/src/lib/contentSafety.ts` instead of directly accessing `contentFilter.ts`. This helper calls the exact-substring filter, returns a 400-ready response shape on violation, and writes an auditable row to the `content_filter_logs` table. See Quick examples below.

## When to use this skill

Use this skill when you are:

- adding or changing content-filter logic (sensitive-word lists, severity tiers, gibberish/repetition detection)
- modifying abuse-detection thresholds (token quotas, conversation turn limits, message-rate floors, duplicate-message guards)
- implementing or reviewing user ban/unban flows, violation counting, or freeze-until logic
- adding admin moderation endpoints (reports, moderation logs, stats)
- working with chat-report or user-report tables and schemas
- tuning rate-limit windows for AI, auth, payment, or webhook endpoints
- adding content-moderation guards to AI-generated output

## When NOT to use this skill

- task is about auth session policy or route gating → use `auth-session-and-safety-boundaries`
- task is about admin RBAC matrices or audit-log obligations → use `admin-audit-and-rbac-governance`
- task is purely about observability, metrics, or logging infrastructure → use `platform-observability-and-ops`
- task is about generic code review with no safety focus → use `code-review`

## Moderation workflow overview

1. **Filtering** — `contentFilter.ts` is the canonical authority for sensitive-word lists (exact substring matching). The recommended entry point for field-level validation is `validateContentSafe()` from `lib/contentSafety.ts` — it wraps the filter, produces a 400-ready response, and logs violations to `content_filter_logs`. Do not move logic to the client or replace it with an LLM call.
2. **Escalation** — Warning → 1-hour AI freeze → 24-hour AI freeze → permanent ban. Severe violations count as +2; warnings as +1. Change thresholds deliberately in `abuseDetection.ts`.
3. **Audit** — Ban/unban and report resolution must emit `logAdminAudit(...)` with `USER_BANNED` or `USER_UNBANNED`. Do not silently change `isBanned`.
4. **Reports** — Dual-track: `reports` table for general content, `chatReports` table for group-chat messages. Do not mix flows.

See [`references/moderation-ops.md`](references/moderation-ops.md) for detailed filter specifics, rate-limiting rules, AI token quota details, chat reporting flow, and freeze/unfreeze procedures.

## Violation tracking overview

- `users.violationCount` accumulates across incidents
- `users.aiFrozenUntil` sets a time-bounded AI suspension
- `users.isBanned` is a permanent flag
- `content_filter_logs` table records every blocked content submission (field, violation type, severity, matched keywords, input preview, source, user) for admin review. Auto-populated by `validateContentSafe` on each violation. Admin query: `GET /api/admin/content-filter/logs`.
- AI-generated content must pass a post-generation blacklist check (e.g., `tagGenerationService.ts` pattern)

## Quick examples

- **Add a new sensitive-word category**: extend `sensitiveWordLists` in `contentFilter.ts`, choose `warning` or `severe`, and add the corresponding message. Do not hard-code severity in route handlers.
- **Gate a new user-input field for content safety**: import `validateContentSafe` from `lib/contentSafety.ts`, call it before persisting: `const violation = validateContentSafe('fieldName', value); if (violation) { return contentViolationResponse(violation); }`. The helper auto-logs to `content_filter_logs`.
- **Add a rate limiter to a new AI endpoint**: import `createRateLimiter` from `rateLimiter.ts`, instantiate with a descriptive `keyPrefix`, and apply as Express middleware. Add a TODO comment noting the in-memory limitation.
- **Debug why a user sees "AI功能暂时冻结"**: check `users.aiFrozenUntil`, then trace `abuseDetection.ts` → `recordViolation` to see which threshold was crossed.
- **Add a user-report API**: create the route behind `requireAuth`, validate with `insertReportSchema`, and insert into the `reports` table. Do not mix with `chatReports`.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| **User is banned but can still send chat messages** | Chat routes may not call `checkUserAbuse`. Add the check or verify `isBanned` is queried in the chat message handler. |
| **Content filter misses obvious spam** | The filter uses exact substring matching. Add the missing keyword to the correct category in `contentFilter.ts`; do not rely on fuzzy logic. |
| **Rate limit is bypassed in production** | The in-memory `Map` does not share state across server instances. If horizontal scaling is active, migrate to Redis or gateway-level limiting. |
| **Violation count seems too high** | Severe violations add +2, warnings add +1. Check `recordViolation` in `abuseDetection.ts` and confirm the severity mapping in `contentFilter.ts`. |
| **Moderation log API returns 500** | Verify that `insertModerationLogSchema` matches the request body and that `adminId` is populated from the session, not the body. |

## Review checklist

- [ ] Content-filter changes include both the keyword list and the corresponding severity/message mapping
- [ ] New rate limiters use a unique `keyPrefix` and include a Redis-migration TODO if attacker-facing
- [ ] `checkUserAbuse` is called on all user-generated-message endpoints that need protection
- [ ] Ban/unban routes emit `logAdminAudit(...)` with safe `before`/`after` snapshots
- [ ] Report and moderation-log schemas stay aligned with `packages/shared/src/schema.ts`
- [ ] AI-generated content is validated against a blacklist or filter before reaching the user
- [ ] Violation thresholds are changed in `abuseDetection.ts` constants, not inline in routes
- [ ] In-memory rate-limit state is acknowledged as a horizontal-scaling limitation
- [ ] Field-level content validation uses `validateContentSafe()` from `lib/contentSafety.ts`, not ad-hoc inline filter calls
- [ ] New user-input fields with free text are wired through `validateContentSafe()` before DB persistence
