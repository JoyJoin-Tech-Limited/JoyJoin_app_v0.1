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

**2026-08-03 — Two-tier approach (deterministic + WeChat msgSecCheck):** For user-input fields handled in request routes that merit semantic moderation, use `validateContentSafeAsync(fieldName, value)` — it runs Tier 0 (deterministic `contentFilter`), then, if Tier 0 is clean and the `contentModerationMsgSecCheckEnabled` flag is on (default `true`), races a WeChat msgSecCheck v2 call against `CONTENT_MODERATION_TIER1_BUDGET_MS` (default 250ms). It **fails open** (flag off, missing `openid`, API error, timeout, or budget exceeded → request proceeds). A risky verdict that returns within budget is enforced synchronously and must be handled like a Tier-0 violation (`contentViolationResponse`); a verdict that only lands after the budget is enforced in the background (log + `recordViolation`, never awaited) and the request has already continued. **Never double-count a violation**: routes record sync-returned Tier-1 violations themselves; the wrapper records only budget-timed-out background ones (both write `content_filter_logs` with `source: 'tier1'`). The WeChat client lives in `apps/server/src/lib/wechatMsgSecCheck.ts` (token cache with single-flight refresh + fire-and-forget warm-up off the critical path). `validateContentSafeAsync` must be `await`ed and the route must hold its own `recordViolation` call.

**2026-08-06 — Severe-fail-closed policy + S2 review queue (content-mod Sprints 1-2):**

- **Emergency rollback is warning-tier only.** Warning-tier (harassment/spam) blocking is gated by the DB feature flag `contentModerationSevereFailClosedEnabled` (default `true`, env `CONTENT_MODERATION_SEVERE_FAIL_CLOSED_ENABLED`, toggleable by super_admin at `/admin/feature-flags`). Flag OFF = warning keyword hits are **ALLOW + log** (no `recordViolation`, no escalation) and a startup warning is logged via `warnIfSevereFailClosedDisabled()`. **Severe-tier (political/pornographic/violent/illegal) blocking is UNCONDITIONAL — no flag weakens it.** The flag read is fail-closed (`getFeatureFlagSync(key, true)` — deliberately NOT the hardcoded-`false` fallback pattern used for the msgSecCheck flag). Registered in `FLAG_ENV_MAP` (featureFlags.ts:194) and `DEFAULT_FLAG_VALUES` (featureFlags.ts:232).
- **Decision table** (contentSafety.ts — rows 1-3 are Tier-0, rows 4-6 are Tier-1): 1) T0 severe → BLOCK (invariant); 2) T0 warning + flag ON → BLOCK; 3) T0 warning + flag OFF → ALLOW + log (the `content_filter_logs` row is still written so the rollback stays observable; a row-3 text is NOT treated as Tier-0-clean, so Tier-1 is not consulted); 4) T0 clean + T1 benign → ALLOW; 5) T0 clean + T1 risky → BLOCK; 6) T0 clean + T1 unavailable → ALLOW + background enforcement. **Tier-1 is consulted ONLY when Tier-0 is clean** (short-circuit at contentSafety.ts:104-121).
- **`checkUserAbuse` + helpers deleted (2026-08-06)** — `recordViolation` in `abuseDetection.ts` is the single enforcement path for the escalation ladder.
- **Review queue:** `content_filter_logs` gained `reviewStatus` (`pending`/`reviewed`/`dismissed`/`actioned`), `reviewedBy`, `reviewedAt`, `missFlag` (误伤), `reviewNote` — additive nullable, migration `0076_content_filter_logs_review.sql` (manual psql for prod). Admin: `GET /api/admin/content-filter/logs` (new `reviewStatus`/`missFlag` filters, reviewer `displayName`), `PATCH /api/admin/content-filter/logs/:id` (operator+, idempotent, audit-logged `CONTENT_FILTER_LOG_REVIEWED` with top-level before/after). Admin UI: `/admin/content-filter` (内容审核日志, SUPER_OPERATOR). `missFlag` mis-hits are the retrain loop into `contentFilter.ts` keyword lists.
- **Coverage:** `contentSafetyDecisionTable.test.ts` locks the six decision-table rows (including flag-OFF paths), plus surface suites `contentSafetyFeedbackRoute`, `contentSafetyChatReports`, `contentSafetyAttendanceStatus`, `contentSafetyGroupOutcomeFreeText`, `contentSafetySubscriptionCancel`, `contentSafetyIcebreakerSurfaces`, and `contentFilterLogsAdmin`; `contentFilterSimulation.test.ts` stays the seeded 1000×15 obfuscation sweep (Tier-0 hit rate ~43.6%; MUST-CATCH zero misses, tier1-residual classes reported in the gap table only).

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

1. **Filtering** — `contentFilter.ts` is the canonical authority for sensitive-word lists (exact substring matching). The recommended entry point for field-level validation is `validateContentSafe()` from `lib/contentSafety.ts` — it wraps the filter, produces a 400-ready response, and logs violations to `content_filter_logs`. Do not move logic to the client or replace it with an LLM call. For request-time user-input fields that warrant semantic moderation, prefer `validateContentSafeAsync()` (see the two-tier addition above) — it keeps the deterministic gate and adds the WeChat msgSecCheck Tier-1 layer behind a fail-open budget. **Warning-tier blocking is gated by `contentModerationSevereFailClosedEnabled` (default `true`); severe-tier blocking is unconditional — no flag weakens it** (see the 2026-08-06 addition). Gated surfaces (validate + `recordViolation` before persist/broadcast): event feedback (per-field sync + ONE concatenated async = 1 WeChat call), group-outcome freeTextSignal, attendance absentReason (pre-WS-broadcast), chat-report description (with `chatReportSubmissionLimiter` 5 req/5 min), undercover-word describe, icebreaker `/start` displayName, subscription cancel reason, lie-detective submit-tags (route-level defense-in-depth).
2. **Escalation** — Warning → 1-hour AI freeze → 24-hour AI freeze → permanent ban. Severe violations count as +2; warnings as +1. Change thresholds deliberately in `abuseDetection.ts`.
3. **Audit** — Ban/unban and report resolution must emit `logAdminAudit(...)` with `USER_BANNED` or `USER_UNBANNED`. Do not silently change `isBanned`.
4. **Reports** — Dual-track: `reports` table for general content, `chatReports` table for group-chat messages. Do not mix flows.

See [`references/moderation-ops.md`](references/moderation-ops.md) for detailed filter specifics, rate-limiting rules, AI token quota details, chat reporting flow, and freeze/unfreeze procedures.

## Violation tracking overview

- `users.violationCount` accumulates across incidents
- `users.aiFrozenUntil` sets a time-bounded AI suspension
- `users.isBanned` is a permanent flag
- `content_filter_logs` table records every blocked content submission (field, violation type, severity, matched keywords, input preview, source, user) for admin review. `source` is `'tier0'` for deterministic hits and `'tier1'` for WeChat msgSecCheck verdicts; sync-returned Tier-1 violations are logged by the route, budget-timed-out background ones by the wrapper. Admin query: `GET /api/admin/content-filter/logs` (filters: userId/violationType/severity/field/date range + `reviewStatus`/`missFlag`). S2 review overlay: `PATCH /api/admin/content-filter/logs/:id` (operator+, idempotent, audit-logged `CONTENT_FILTER_LOG_REVIEWED`) sets `reviewStatus` (`pending`/`reviewed`/`dismissed`/`actioned`), `missFlag` (误伤), `reviewNote`, `reviewedBy`/`reviewedAt` — see the 2026-08-06 addition.
- AI-generated content must pass a post-generation blacklist check (e.g., `tagGenerationService.ts` pattern)

## Quick examples

- **Add a new sensitive-word category**: extend `sensitiveWordLists` in `contentFilter.ts`, choose `warning` or `severe`, and add the corresponding message. Do not hard-code severity in route handlers.
- **Gate a new user-input field for content safety**: import `validateContentSafeAsync` (preferred for request-time user text) or `validateContentSafe` from `lib/contentSafety.ts`, call it before persisting: `const violation = await validateContentSafeAsync('fieldName', value); if (violation) { return contentViolationResponse(violation); }`. The helper auto-logs to `content_filter_logs`; keep the existing `recordViolation(...)` call the route already holds for sync-returned violations.
- **Stress the deterministic filter against gaming**: `contentFilterSimulation.test.ts` runs 1000 seeded virtual users × 15 attempts (15k corpus) mutating the REAL word lists (exact, leet, separators, repeat, optional-letter omission, zero-width, combining marks, homoglyphs, pinyin tones, base64, etc.). MUST-CATCH classes map to the machinery `obfuscatedPattern()` actually claims — a miss there is a blocking bug (e.g. the 2026-08-03 `_`-separator gap: JS `\W` excludes `_`, so `f_u_c_k` bypassed until `[\W0-9_]*`); TIER-1-RESIDUAL classes (CJK homophones, pinyin abbreviations, full-width, homoglyph swaps, reversed/doubled/rot13/base64) are reported in the gap table as WeChat msgSecCheck domain, not asserted. Seed `20260803 + userId` keeps CI deterministic.
- **Add a rate limiter to a new AI endpoint**: import `createRateLimiter` from `rateLimiter.ts`, instantiate with a descriptive `keyPrefix`, and apply as Express middleware. Add a TODO comment noting the in-memory limitation.
- **Debug why a user sees "AI功能暂时冻结"**: check `users.aiFrozenUntil`, then trace `abuseDetection.ts` → `recordViolation` to see which threshold was crossed.
- **Add a user-report API**: create the route behind `requireAuth`, validate with `insertReportSchema`, and insert into the `reports` table. Do not mix with `chatReports`.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| **User is banned but can still act** | Verify the route gates on `users.isBanned` (or the freeze/ban ladder). `checkUserAbuse` was removed 2026-08-06 — `recordViolation` in `abuseDetection.ts` is the single enforcement path, so escalation only happens where routes call it. |
| **Content filter misses obvious spam** | The filter uses exact substring matching. Add the missing keyword to the correct category in `contentFilter.ts`; do not rely on fuzzy logic. |
| **Rate limit is bypassed in production** | The in-memory `Map` does not share state across server instances. If horizontal scaling is active, migrate to Redis or gateway-level limiting. |
| **Violation count seems too high** | Severe violations add +2, warnings add +1. Check `recordViolation` in `abuseDetection.ts` and confirm the severity mapping in `contentFilter.ts`. |
| **Moderation log API returns 500** | Verify that `insertModerationLogSchema` matches the request body and that `adminId` is populated from the session, not the body. |

## Review checklist

- [ ] Content-filter changes include both the keyword list and the corresponding severity/message mapping
- [ ] New rate limiters use a unique `keyPrefix` and include a Redis-migration TODO if attacker-facing
- [ ] Gated user-input routes check the `validateContentSafe()` / `validateContentSafeAsync()` result before persist/broadcast and keep their own `recordViolation` call; `isBanned`/freeze checks remain on protected endpoints (no `checkUserAbuse` — deleted 2026-08-06)
- [ ] Warning-tier blocking respects `contentModerationSevereFailClosedEnabled`; severe-tier blocking is never flag-weakened
- [ ] Review-queue mutations (`PATCH /api/admin/content-filter/logs/:id`) emit `CONTENT_FILTER_LOG_REVIEWED` audit entries with before/after snapshots
- [ ] Ban/unban routes emit `logAdminAudit(...)` with safe `before`/`after` snapshots
- [ ] Report and moderation-log schemas stay aligned with `packages/shared/src/schema.ts`
- [ ] AI-generated content is validated against a blacklist or filter before reaching the user
- [ ] Violation thresholds are changed in `abuseDetection.ts` constants, not inline in routes
- [ ] In-memory rate-limit state is acknowledged as a horizontal-scaling limitation
- [ ] Field-level content validation uses `validateContentSafe()` / `validateContentSafeAsync()` from `lib/contentSafety.ts`, not ad-hoc inline filter calls
- [ ] New user-input fields with free text are wired through `validateContentSafeAsync()` (or `validateContentSafe()` for deterministic-only gates) before DB persistence, with the route's own `recordViolation` call intact
