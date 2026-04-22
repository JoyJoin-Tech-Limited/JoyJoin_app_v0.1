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

# content-safety-abuse-detection

## Purpose

This skill owns the server's trust-and-safety layer: deterministic content
filtering, behavioral abuse detection, rate limiting, user-level penalties,
and admin moderation surfaces. It does **not** own auth gating or RBAC
policy — those live in `auth-session-and-safety-boundaries` and
`admin-audit-and-rbac-governance`.

## When to use this skill

Use this skill when you are:

- adding or changing content-filter logic (sensitive-word lists, severity tiers,
  gibberish/repetition detection)
- modifying abuse-detection thresholds (token quotas, conversation turn limits,
  message-rate floors, duplicate-message guards)
- implementing or reviewing user ban/unban flows, violation counting, or
  freeze-until logic
- adding admin moderation endpoints (reports, moderation logs, stats)
- working with chat-report or user-report tables and schemas
- tuning rate-limit windows for AI, auth, payment, or webhook endpoints
- adding content-moderation guards to AI-generated output (e.g. social-tag
  blacklists)

## When NOT to use this skill

- task is about auth session policy or route gating (use
  `auth-session-and-safety-boundaries`)
- task is about admin RBAC matrices or audit-log obligations (use
  `admin-audit-and-rbac-governance`)
- task is purely about observability, metrics, or logging infrastructure (use
  `platform-observability-and-ops`)
- task is about generic code review with no safety focus (use `code-review`)

## Core rules

1. **Keep filtering deterministic and server-side.**
   `contentFilter.ts` is the canonical authority for sensitive-word detection.
   Do not move filter logic to the client or replace it with an LLM call.

2. **Respect the violation escalation ladder.**
   Warning → 1-hour AI freeze → 24-hour AI freeze → permanent ban.
   Severe violations count as +2; warnings count as +1. Thresholds are
   defined in `abuseDetection.ts` and must be changed deliberately, not
   ad-hoc in route handlers.

3. **Rate limits are in-memory today.**
   `rateLimiter.ts` uses a local `Map`. This will not share state across
   server instances. Document any new limiter with a TODO for Redis migration
   if the endpoint is attacker-facing.

4. **Always pair moderation mutations with audit logs.**
   Ban/unban and report resolution must emit `logAdminAudit(...)` with
   `action: 'USER_BANNED'` or `'USER_UNBANNED'`. Do not silently change
   `isBanned`.

5. **Reports are dual-track.**
   - `reports` table: general user/content reports (harassment, fake profile,
     inappropriate content).
   - `chatReports` table: event-group-chat message reports.
   Keep schemas aligned with `packages/shared/src/schema.ts` and do not mix
   the two flows in a single UI or API surface.

6. **Content moderation on AI output is a post-generation filter.**
   The social-tag generator in `tagGenerationService.ts` validates generated
   tags against `BLACKLIST_KEYWORDS` before returning them. Follow this
   pattern for new AI-backed features that emit user-visible strings.

## Current repo anchors

- `apps/server/src/contentFilter.ts` — sensitive-word lists, severity mapping,
  gibberish/repetition detection.
- `apps/server/src/abuseDetection.ts` — `checkUserAbuse`, token quotas,
  conversation guards, violation escalation, `recordViolation`.
- `apps/server/src/rateLimiter.ts` — `createRateLimiter`, AI/auth/payment/
  webhook limiters, in-memory store cleanup.
- `apps/server/src/routes.ts` — `/api/admin/users/:id/ban|unban`,
  `/api/admin/moderation/*`, `/api/registration/chat/message` abuse gate.
- `packages/shared/src/schema.ts` — `users.isBanned`, `users.violationCount`,
  `users.aiFrozenUntil`, `reports`, `moderationLogs`, `chatReports`, `chatLogs`.
- `apps/server/src/tagGenerationService.ts` — `BLACKLIST_KEYWORDS`,
  `validateTag` for AI-generated content moderation.
- `apps/server/src/lib/adminAuditLogger.ts` — `USER_BANNED`, `USER_UNBANNED`
  action vocabulary.

## Quick examples

- **Add a new sensitive-word category**: extend `sensitiveWordLists` in
  `contentFilter.ts` with a `ViolationType` entry, choose `warning` or `severe`,
  and add a corresponding message in the `messages` record. Do not hard-code
  severity in route handlers.
- **Add a rate limiter to a new AI endpoint**: import `createRateLimiter` from
  `rateLimiter.ts`, instantiate it with a descriptive `keyPrefix`, and apply it
  as Express middleware. Add a TODO comment noting the in-memory limitation.
- **Debug why a user sees "AI功能暂时冻结"**: check `users.aiFrozenUntil` in
  the DB, then trace `abuseDetection.ts` → `recordViolation` to see which
  threshold was crossed (`warningFreezeHours`, `tempBanHours`, or `permBan`).
- **Add a user-report API**: create the route in `routes.ts` behind
  `requireAuth`, validate with `insertReportSchema` from `@shared/schema`,
  and insert into the `reports` table. Do not mix this with `chatReports`.

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

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `admin-audit-and-rbac-governance` | admin moderation routes need RBAC mapping or audit-log obligations |
| `auth-session-and-safety-boundaries` | auth gating, session middleware, or fail-closed route policy changes |
| `platform-observability-and-ops` | adding metrics, alerts, or structured logging around abuse/moderation events |
| `llm-runtime-safety-and-integration` | AI-generated output needs prompt-level safety or fallback behavior beyond post-generation filtering |
| `server-domain-architecture` | new moderation routes need placement in `routes/domains/*` or repository extraction |
| `reliability-and-state-integrity` | moderation workflows need idempotency, transaction guards, or retry safety |

## Canonical references

- `apps/server/src/contentFilter.ts`
- `apps/server/src/abuseDetection.ts`
- `apps/server/src/rateLimiter.ts`
- `apps/server/src/routes.ts`
- `apps/server/src/tagGenerationService.ts`
- `apps/server/src/lib/adminAuditLogger.ts`
- `packages/shared/src/schema.ts`
