# WeCom Ops Notification System — Design & Specification

> **Status:** Draft for review  
> **Author:** Product Manager  
> **Date:** 2026-06-08  
> **Canonical references:** `PRODUCT_REQUIREMENTS.md`, `apps/server/src/lib/wecomNotifier.ts`, `docs/automations/README.md`, `AGENTS.md`

---

## Problem Statement

JoyJoin's operational team currently receives WeCom notifications for only two events: **venue unassigned alerts** and **city unlock threshold triggers**. As the platform grows, ops needs real-time visibility into user activity, payment health, matching outcomes, and risk signals — without logging into the admin portal every few minutes. A structured, layered notification system ensures ops knows what matters, when it matters, and can escalate appropriately.

### Target Users

- **Operations team** (primary): daily monitoring, user/ticket triage, venue coordination, payment issue investigation
- **Super admins** (secondary): sensitive-action surveillance, abuse/refund decisions
- **Off-duty rotation** (tertiary): on-call escalation for P0 failures

---

## Part A: Notification Specification Table

### Legend

- **Priority:** P0 = Immediate alert (wake ops up); P1 = Same-day attention; P2 = Informational / daily digest
- **Existing:** ✓ = already implemented in `wecomNotifier.ts`; △ = partial / needs expansion; ✗ = not implemented
- **Channel suggestion:** which WeCom bot to target (see §Architecture — multi-webhook design)

| # | Trigger Event | Trigger Condition (state change) | Payload Fields | Priority | Est. Dev Effort | Notes / Caveats | Existing? |
|---|--------------|----------------------------------|---------------|----------|----------------|-----------------|-----------|
| **1** | **🎉 Onboarding Complete** | User transitions `nextStep` from `profile-review` to `discover`. (i.e., `hasSeenProfileReview=true` AND all onboarding flags set) | `displayName`, `gender`, `age` (calc from DOB), `primaryArchetype` (emoji + name), `currentCity`, `educationLevel`, `occupationId` / `industryNicheLabel`, `intent[]`, `lifeStage`, `relationshipStatus`, `onboardingDuration` (minutes from signup → complete), `referralSource` (if from invitation code) | P1 | 1–2 days | • **PII sensitivity** (see §C.1): send `age` or `ageRange` only, not raw birthdate. Name intentionally included — ops needs to recognize users during support.<br>• Avoid noise: deduplicate per user (only fire once).<br>• Include `archetype` for staff to validate archetype distribution feels healthy.<br>• Mention `onboardingDuration` to spot friction (if >30 min → ops checks funnel). | ✗ |
| **2** | **💳 Event Registration + Payment** | `payments.status` transitions `pending` → `completed` AND `payments.paymentType='event'` AND related `eventPoolRegistrations` exists | `displayName`, `poolTitle`, `poolCity·district`, `poolDateTime`, `finalAmount` (¥), `originalAmount` (¥), `discountAmount` (¥), `couponUsed` (code + value), `userAge`, `userGender`, `userArchetype`, `isFirstPayment` (bool) | P1 | 1–2 days | • **This is the highest-value ops notification.** Revenue events need ops awareness — if a paid event fills, ops can plan venue/staffing.<br>• Fire AFTER payment confirmation, not on registration alone (free events skip this trigger).<br>• Include `isFirstPayment` flag so ops can welcome first-time payers.<br>• If `discountAmount > 0`, highlight coupon code used — ops may need to verify promo abuse. | ✗ |
| **3** | **🌟 First Payment Ever (New Paying User)** | `payments.status` → `completed` AND this is the user's first-ever completed payment (any type) | `displayName`, `paymentType` (subscription/event/bundle), `finalAmount` (¥), `archetype`, `daysSinceSignup` (how long they waited before paying) | P1 | 0.5 day | • **Leading indicator for monetization health.** Track how many new users convert and how fast.<br>• Payload light — we just need to know "a new payer arrived".<br>• Dedup: only fire once per user (flag `hasEverPaid` or query `SELECT count(*) FROM payments WHERE userId=X AND status='completed' = 1`).<br>• Combine with #2 if they pay on first registration (dedup so only one fires). | ✗ |
| **4** | **🔗 Pool Matching Complete** | `eventPools.status` transitions `matching` → `matched`. Server finishes `poolMatchingService.ts` run. | `poolTitle`, `poolCity·district`, `totalRegistrations`, `matchedCount`, `unmatchedCount`, `groupsFormed`, `avgOverallScore`, `avgChemistryScore`, `genderBalanceSummary` (e.g., "5♂ 7♀ → 3 groups"), `matchDurationMin` (how long matching took) | P1 | 1 day | • Ops needs to know matching worked AND whether there were unmatched users (who need follow-up).<br>• If `unmatchedCount > 0`, include "需人工关注" flag.<br>• Venue assignment is separate (#5).<br>• Consider rate: pools match at most a few times/day (not a noisy trigger). | ✗ |
| **5** | **🏠 Group Formation + Venue Assignment Result** | After `venueAssignmentService.ts` runs against a matched pool. Aggregate result of all group assignments. | `poolTitle`, `poolDate`, `groupsTotal`, `venuesAssigned`, `venuesUnassigned`, `unassignedReasonBreakdown`, `topVenueAssigned` (name + area) | P1 | 0.5 day | • **Partially covered by existing #6 (venue unassigned), but lacks the "success" side.** Ops needs the full picture: X/Y groups assigned successfully, plus the unassigned details.<br>• Only fire after ALL groups processed, not per-group (avoid 6 messages for 6 groups).<br>• Include link to admin pool detail page. | △ |
| **6** | **⚠️ Venue Unassigned** (existing) | One or more groups in a pool have no venue after `venueAssignmentService.ts` completes | Already implemented: `poolTitle`, `poolCity·district`, `poolDate`, `unassignedCount`, `reasonBreakdown` | P0 | — | • **Already live.** Keep as-is. Consider adding admin deep-link (see template).<br>• P0 because unassigned groups directly impact event-day delivery. | ✓ |
| **7** | **🚩 User Report / Abuse Flag** | User submits a report (post-event feedback, user profile report, icebreaker chat report). Single report fires immediately. | `reporterDisplayName` (pseudonymized), `reportedUserDisplayName`, `reportReason` (category + free text), `eventContext` (pool title + date if event-related), `severity` (auto-tagged: harassment/spam/unsafe/inappropriate) | P1 → P0 if severity=high | 1–2 days | • **Trust & safety is critical.** High-severity reports (harassment, safety) should @mention on-duty ops staff.<br>• Reporter name: pseudonymized to "User ABC" to avoid retaliation concerns; keep user ID in payload for admin lookup.<br>• Must include a link to admin moderation page.<br>• Rate-limit: max 1 notification per 5 min per reported user (prevent abuse-of-notifications). | ✗ |
| **8** | **↩️ Refund Processed** | Admin completes a refund (`refundAttempts.status` → `success`). | `adminName` (who processed), `userDisplayName`, `amount` (¥), `paymentType`, `reason` (admin-entered), `originalPaymentDate`, `paymentId` (for cross-reference) | P1 | 0.5 day | • Financial audit trail — every refund visible to the whole ops team, not just the processing admin.<br>• Include refund attempt history count for this user (flag if >1 refund in 30 days).<br>• Link to admin refund report page. | ✗ |
| **9** | **🗑️ User Account Deletion** | User initiates account deletion (soft-delete, `deleted_at` set). | `displayName`, `archetype`, `accountAgeDays`, `totalPayments` (¥), `totalEventsAttended`, `deletionReason` (if provided), `daysSinceLastLogin` | P2 | 0.5 day | • Informational — ops can't react, but trend matters. Spike in deletions after a bad event = signal.<br>• Aggregate in weekly digest rather than per-event if volume >5/day.<br>• Do NOT include PII beyond displayName (no phone, no WeChat ID). | ✗ |
| **10** | **❌ Failed Payment + Retry Exhausted** | `payments.status` → `failed` after all retry attempts exhausted (WeChat Pay retries or server-side retry logic). | `userDisplayName`, `paymentType`, `finalAmount` (¥), `paymentMethod` (WeChat Pay), `failureReason` (insufficient balance / user cancelled / timeout), `retryCount`, `relatedEntity` (pool title / subscription plan) | P1 | 1 day | • Lost revenue opportunity. Ops may want to reach out to the user or check if payment config is broken.<br>• First failure should NOT notify (noisy — many users cancel mid-flow). Only notify when retries exhausted and payment is definitively dead.<br>• Include link to user's payment history in admin. | ✗ |
| **11** | **🔒 Admin Action: Manual Override or Ban** | Super-admin or operator performs a high-risk action: user ban, manual match override, attendance override, forced group reassignment, manual payment status change | `adminName`, `actionType` (ban / override / reassign / payment_fix), `targetUserDisplayName` (+ ID), `reason`, `beforeState` / `afterState` (JSON diff or summary) | P1 (P0 for ban) | 1 day | • **Accountability and audit trail.** Every sensitive admin action should be visible to the whole team, not just the audit log.<br>• Already logged to `admin_audit_logs` table — this is a WeCom relay.<br>• Ban = P0 because it directly impacts user experience and may trigger user complaints.<br>• Dedup: only fire once per action (audit log entry has unique ID). | ✗ |
| **12** | **⛔ Event Pool Cancelled + Impact** | Admin changes `eventPools.status` from `active/matching` → `cancelled`. | `poolTitle`, `poolCity·district`, `poolDate`, `registeredUserCount` (total affected), `matchedGroupCount` (groups dissolved), `totalRevenueImpact` (¥ sum of completed payments), `cancellationReason`, `adminName` | P0 | 0.5 day | • **Direct user impact.** Cancelling a pool means messaging X users, handling refunds, managing fallout. Ops needs to know immediately.<br>• Include `revenueImpact` so ops can prioritize.<br>• Should @mention on-duty ops lead. | ✗ |
| **13** | **📊 Low Registration Pool Alert** | Scheduled check (48h before `registrationDeadline`): `totalRegistrations < targetGroups × minGroupSize × 0.5` (<50% capacity). Check once per pool. | `poolTitle`, `poolCity·district`, `poolDate`, `currentRegistrations`, `targetRegistrations` (min to fill), `percentFilled`, `daysUntilDeadline` | P1 | 1 day | • **Prevent cancelled events.** Ops can act: promote the pool, adjust targeting, or proactively cancel.<br>• Only fire once per pool (idempotent — mark `pool_wecom_low_registration_alerted`).<br>• Consider a second "critical" alert at 24h if still <30% filled (then P0).<br>• Notify at 48h mark, not at creation (too early = false alarms). | ✗ |
| **14** | **💥 System Health Anomaly / Error Spike** | >5% error rate on any critical endpoint in 5-min window, or >10 consecutive payment failures, or matching service crash/exception cascade. | `errorRate` (%), `affectedEndpoint(s)`, `timeWindow`, `sampleCount`, `lastErrorSample` (truncated message), `serviceName` | P0 | 1–2 days | • **Wake-ops-up alert.** Overlaps with Prometheus alerting — if alertmanager exists, route through it.<br>• Include link to Grafana dashboard / logs.<br>• Consider separate "Critical" bot that alerts even off-hours. | ✗ |
| **15** | **🏙️ City Unlock Threshold** (existing) | `user_city_interests` count hits 50 (collecting → researching transition) | Already implemented: `city`, `count`, `threshold` | P1 | — | • **Already live.** Keep as-is. | ✓ |

### Notification Summary by Priority

| Priority | Events | Target Response | Channel |
|----------|--------|----------------|---------|
| **P0** | #6 Venue Unassigned, #12 Pool Cancelled, #14 System Health Anomaly | Within 30 min (including off-hours) | Critical bot + @all or @on-duty |
| **P1** | #1 Onboarding Complete, #2 Reg+Payment, #3 First Payment, #4 Matching Complete, #5 Venue Assignment (aggregate), #7 Abuse Flag, #8 Refund, #10 Failed Payment, #11 Admin Override, #13 Low Registration | Within 4 hours (same business day) | Ops bot (no @all) |
| **P2** | #9 Account Deletion | Daily digest | Ops bot, batched |

---

## Part B: Architecture Notes

### B.1 Service Layer — Where Dispatch Lives

**Current state:** `apps/server/src/lib/wecomNotifier.ts` is a single-file utility with `sendWeComMarkdown()` as the core dispatch function, plus three convenience wrappers (`notifyCityUnlockThreshold`, `notifyVenueUnassigned`, `notifyVenueOnboardingStatusChange`).

**Proposed evolution:** Keep the same lightweight, zero-dependency dispatch pattern. Add a **notification registry** to reduce boilerplate:

```
apps/server/src/lib/
├── wecomNotifier.ts              ← Core dispatch (existing, unchanged)
│   ├── sendWeComMarkdown()       ← Handles HTTP, timeout, truncation, logging
│   └── {{existing convenience wrappers}}
│
└── wecomNotifications/           ← New directory: one file per notification domain
    ├── index.ts                  ← Re-export all notify* functions
    ├── onboarding.ts             ← notifyOnboardingComplete()
    ├── payments.ts               ← notifyRegistrationPayment(), notifyFirstPayment()
    ├── matching.ts               ← notifyPoolMatched(), notifyVenueAssignmentResult()
    ├── moderation.ts             ← notifyAbuseReport(), notifyAdminAction()
    ├── poolLifecycle.ts          ← notifyPoolCancelled(), notifyLowRegistration()
    ├── userLifecycle.ts          ← notifyAccountDeleted(), notifyFailedPayment()
    └── systemHealth.ts           ← notifyErrorSpike()
```

**Why not a generic event bus?** JoyJoin is not yet at the scale where a pub/sub event bus (RabbitMQ, Redis Streams) is justified. Function-call pattern from existing service/repository layer suffices: call `notifyXxx()` at the point where the state transition is confirmed. Each `notify*()` is a fire-and-forget `void` call — the system never depends on WeCom delivery for correctness.

**Design constraint:** All notification functions are **side-effect-only**. They must not throw, must not block the caller, and must never be in the critical path of the originating request.

### B.2 Config Pattern — Multi-Channel Webhooks

**Current:** Single env var `WECOM_BOT_KEY`, single webhook URL.

**Proposed:**

```env
# Required — at least one bot must be configured
WECOM_OPS_BOT_KEY=xxx              ← General ops bot (P1 + P2)
WECOM_CRITICAL_BOT_KEY=xxx         ← P0 / on-call bot
WECOM_FINANCE_BOT_KEY=xxx          ← Financial events (payments, refunds, #2, #3, #8, #10)

# Optional full URL overrides (default: qyapi.weixin.qq.com)
WECOM_OPS_BOT_WEBHOOK=
WECOM_CRITICAL_BOT_WEBHOOK=
WECOM_FINANCE_BOT_WEBHOOK=
```

**Channel routing map:**

| Notification # | Bot Channel | Rationale |
|---------------|-------------|-----------|
| #6, #12, #14 | **Critical** | P0, off-hours attention needed |
| #1, #4, #5, #7, #9, #11, #13 | **Ops** | General awareness, same-business-day |
| #2, #3, #8, #10 | **Finance** | Financial ops + optional relay to Ops |

**Rationale for separation:**
- Ops team members can mute the Ops and Finance bots during off-hours without missing P0 critical alerts.
- Finance bot provides a clean audit trail for revenue events — finance staff subscribe to this bot only.
- Reduces noise in any single channel.

**Implementation:** Add a `botKey` parameter to `sendWeComMarkdown()` (optional, defaults to `WECOM_OPS_BOT_KEY`). Create three dispatch sub-functions:

| Function | Bot Env Var | Priority Level |
|----------|------------|----------------|
| `sendOpsMarkdown(title, lines, mentioned?)` | `WECOM_OPS_BOT_KEY` | P1, P2 |
| `sendCriticalMarkdown(title, lines, mentioned?)` | `WECOM_CRITICAL_BOT_KEY` | P0 |
| `sendFinanceMarkdown(title, lines, mentioned?)` | `WECOM_FINANCE_BOT_KEY` | Financial |

### B.3 Rate Limiting

**WeCom bot webhook limits (official):**
- **3 messages per second** per bot webhook URL. Exceeding returns `errcode: 45009`.
- **Markdown body** ≤ 4096 bytes (already handled).

**Mitigation strategy:**
- Most triggers are low-frequency (onboarding: ≤1/sec; payment: ≤1/sec; matching: ≤1/hour). Rate limits unlikely to be hit in normal operation.
- **Burst scenario:** If 50 users complete onboarding simultaneously (e.g., batch import), 50 sequential `sendWeComMarkdown` calls could exceed 3/sec. Mitigation: add a **simple in-memory debounce aggregator** in `wecomNotifier.ts` — a `Map<botKey, { count, timer }>` that, if the same type fires >3 times in 1s, groups into a single aggregated message ("5 位用户完成注册").
- **Implementation:** lightweight, no external dependency. Cleared on server restart (acceptable for burst protection).

### B.4 Fire Timing — Immediate vs. Batched

| Pattern | When to use | Examples |
|---------|-------------|---------|
| **Immediate (fire-and-forget)** | P0 + P1 events ops needs in real time | #2 Payment, #6 Venue Unassigned, #7 Abuse Report, #10 Failed Payment, #12 Pool Cancelled, #14 Error Spike |
| **Debounced (1–5 min aggregation)** | High-frequency events where individual notifications are not useful | #1 Onboarding Complete (batch if >3 in 5 min), #9 Account Deletion |
| **Daily digest (cron)** | Informational trends, not urgent | Weekly payment summary, aggregated #9 deletions |

**Recommendation:** Start with immediate for all P0/P1. Add batching only if noise complaints arise. The debounce mechanism (B.3) handles burst cases without a separate scheduled job.

### B.5 Failure Tolerance

**Current behavior:** `sendWeComMarkdown()` returns `boolean`, logs errors but never throws. Callers use `void` (fire-and-forget). This is correct and must be preserved.

**No retry for P1/P2:**
- All state transitions that trigger notifications are already persisted in the database. The notification is a **side effect**, not a state change.
- Ops can always check the admin portal or audit logs.
- Retry adds complexity (idempotency windows, duplicate messages) for marginal benefit — if WeCom is down for >5 min, ops notices via other channels.

**Exception — P0 with one retry:** For #6, #12, #14, if the first dispatch fails, attempt one retry after 5 seconds (transient network blip guard). Log the retry outcome and a Prometheus counter increment in all cases.

### B.6 Env Contracts

| Env Variable | Required? | Purpose |
|-------------|-----------|---------|
| `WECOM_OPS_BOT_KEY` | Yes (prod) | General ops notifications |
| `WECOM_CRITICAL_BOT_KEY` | No | P0 / on-call alerts |
| `WECOM_FINANCE_BOT_KEY` | No | Payment / revenue events |
| `WECOM_BOT_WEBHOOK` | No | Legacy single-webhook fallback |
| `WECOM_BOT_TIMEOUT_MS` | No (default 10000) | Request timeout |

### B.7 Integration Points — Where to Wire into Server Code

| Event | Trigger Point in Code |
|-------|----------------------|
| #1 Onboarding Complete | After `POST /api/profile-review/complete` succeeds AND `nextStep` → `discover` |
| #2 Event Registration + Payment | In `paymentService.ts`, after `payments.status` → `completed` for `paymentType='event'` |
| #3 First Payment | Same point as #2, with additional DB check `count completed payments = 1` |
| #4 Pool Matching Complete | In pool status transition handler, after `poolMatchingService.ts` finishes |
| #5 Venue Assignment Result | In `venueAssignmentService.ts`, after all groups assigned/attempted |
| #6 Venue Unassigned | Already wired in `venueAssignmentService.ts` |
| #7 Abuse Report | In new report submission handler (new route or existing feedback endpoint) |
| #8 Refund | After `refundAttempts.status` → `success`, in payment service |
| #9 Account Deletion | In user soft-delete handler |
| #10 Failed Payment | In payment service, after all retries exhausted |
| #11 Admin Action | In each admin mutation handler, after `adminAuditLogger` writes |
| #12 Pool Cancelled | After `eventPools.status` → `cancelled` in admin pool management |
| #13 Low Registration | Scheduled cron or triggered on pool status recheck (48h pre-deadline) |
| #14 Error Spike | In metrics middleware or health-monitor daemon |
| #15 City Unlock | Already wired in `cityUnlock.ts` |

---

## Part C: Risks & Open Questions

### C.1 PII Concerns — Sending User Data to WeCom

**Risk:** WeCom is a third-party service (Tencent). Sending user PII through a group-bot webhook creates data-exposure surface area.

**Mitigation rules (must be enforced in `sanitizeUserPayload()` helper):**

| Data type | In notification? | Rule |
|-----------|----------------|------|
| `displayName` | ✅ Yes | Ops needs to recognize users during support. Self-chosen alias, not government name. |
| `phoneNumber` | ❌ No | Never expose. Ops looks up by name/ID in admin portal. |
| `wechatOpenId` | ❌ No | Internal lookup key only. Expose `userId` (UUID) for cross-reference. |
| `birthdate` | ❌ No → use `age` or `ageRange` | Send `age: 28` or `ageRange: 25-30`. Ops does not need exact DOB. |
| `email` | ❌ No | Not collected during onboarding — but never send if present. |
| `wechatNickname` | ⚠️ Conditional | Only if `displayName` is empty. |
| `profileImageUrl` | ❌ No | Adds noise. Ops views in admin. |
| `userId` (UUID) | ✅ Yes | Opaque identifier, safe for cross-reference. |
| `archetype` | ✅ Yes | Product data, not PII. |
| `currentCity` (city level only) | ✅ Yes | Coarse-grained. Never send full address. |

**Implementation:** A `sanitizeUserPayload(user)` helper function that strips non-allowed fields before constructing the message. Shared across all `notify*` functions.

### C.2 Off-Hours Silence Toggle

**Question:** Suppress P1/P2 during off-hours (10 PM – 8 AM)?

**Recommendation:**
- **P0 always fires.** Critical alerts ignore silence.
- **P1/P2:** Let ops team members mute the **Ops bot** and **Finance bot** at the WeCom client level. WeCom already supports per-chat mute — no server-side schedule needed for v1.
- **No server-side silence toggle** for now. If ops reports noise fatigue, add a DB-backed `ops_silence_until` config in a future iteration.

### C.3 WeCom Webhook Payload Limits — Audit

| Constraint | Value | Status |
|-----------|-------|--------|
| Markdown body max length | 4096 bytes | ✅ Truncated. Consider `Buffer.byteLength()` for CJK safety. |
| Max messages per second | 3 per bot URL | ⚠️ Debounce aggregator (B.3) handles bursts. |
| Markdown heading support | H1–H6 | ✅ Use `##` for titles. |
| Inline images | Not supported in bot webhooks | ✅ Text-only is appropriate for ops. |
| @mention support | `mentioned_mobile_list` | ✅ Already supported. |
| Link support | `[text](url)` | ✅ Use for admin deep-links. |

**Action:** The existing 4096-byte truncation is sufficient. Consider upgrading to `Buffer.byteLength(content, 'utf-8')` for precise CJK measurement — current `.length > 4000` check is conservative but safe.

### C.4 Open Questions for Implementation

| Question | Tentative Answer | Needs Decision? |
|----------|-----------------|:---------------:|
| Should notifications link to admin portal? | **Yes** — every notification ends with one actionable deep-link. | ❌ Design settled |
| Chinese vs English for WeCom messages? | **Chinese only** — ops team is Chinese-speaking. Follow existing pattern. | ❌ Pattern settled |
| Who owns the notification registry? | **Backend engineer** (add notify* calls) + **Product/ops** (define copy in each message). | ⚠️ Assign ownership in sprint planning |
| Track delivery success rate? | **Yes** — add Prometheus counter `wecom_notifications_total{type, status="sent\|failed"}`. | ✅ Include in scope |
| Duplicate notifications from idempotent webhook processing? | Use `wecom_notified` flag or a `notified_events` tracking table for idempotent-critical paths (payments, refunds). | ⚠️ Add to implementation spec for #2, #8, #10 |
| Admin "test notification" button? | **Out of scope for v1** — add to future backlog. | ❌ Deferred |
| WeCom bot key rotation handling? | Env var restart. Graceful degradation: log error + return false, server continues. | ✅ Already handled |

---

## Appendix A: Notification Message Templates (WeCom Markdown)

### Template A1: Onboarding Complete (P1, Ops Bot)

```
## 🎉 新用户完成注册

**用户：** {{displayName}}
**年龄：** {{age}}岁
**性别：** {{gender}}
**城市：** {{currentCity}}
**人格原型：** {{archetypeEmoji}} {{archetypeName}}
**教育：** {{educationLevel}}
**职业：** {{occupationLabel}}
**人生阶段：** {{lifeStage}}
**社交意图：** {{intentList}}
**注册耗时：** {{durationMin}}分钟

[查看用户详情 →]({{adminUrl}}/users/{{userId}})
```

### Template A2: Event Registration + Payment (P1, Finance Bot)

```
## 💳 活动报名付费成功

**用户：** {{displayName}}（{{age}}岁 · {{gender}} · {{archetypeEmoji}}）
**活动：** {{poolTitle}}
**时间：** {{poolDateTime}}
**地点：** {{poolCity}} · {{poolDistrict}}
**金额：** ¥{{finalAmount}}（原价 ¥{{originalAmount}}，优惠 ¥{{discountAmount}}）
**优惠券：** {{couponInfo | "无"}}
**首次付费：** {{isFirstPayment | "是 🎉" | "否"}}

[查看活动池 →]({{adminUrl}}/pools/{{poolId}})
```

### Template A3: Venue Unassigned (P0, Critical Bot — existing, minor format update)

```
## ⚠️ 场地分配异常 🚨

**活动池：** {{poolTitle}}
**城市：** {{poolCity}} · {{poolDistrict}}
**日期：** {{poolDate}}
**未分配组数：** {{unassignedCount}} 组

原因 breakdown：
- 预算不匹配：X 组
- 容量不足：X 组

[立即处理 →]({{adminUrl}}/pools/{{poolId}})
```

### Template A4: Pool Cancelled (P0, Critical Bot)

```
## ⛔ 活动池已取消 🚨

**活动：** {{poolTitle}}
**城市：** {{poolCity}} · {{poolDistrict}}
**原定日期：** {{poolDate}}
**影响用户：** {{registeredUserCount}} 人
**涉及组数：** {{matchedGroupCount}} 组
**收入影响：** ¥{{revenueImpact}}
**原因：** {{cancellationReason}}
**操作人：** {{adminName}}

[查看活动详情 →]({{adminUrl}}/pools/{{poolId}})
```

### Template A5: System Health Anomaly (P0, Critical Bot)

```
## 💥 系统异常告警 🚨

**服务：** {{serviceName}}
**错误率：** {{errorRate}}%（阈值 5%）
**影响端点：** {{affectedEndpoint}}
**时间窗口：** {{timeWindow}}
**样本数：** {{sampleCount}}

[查看监控面板 →]({{grafanaUrl}})
```

---

## Appendix B: Graded Implementation Phases

| Phase | Scope | Effort Estimate | Dependencies |
|-------|-------|----------------|:------------:|
| **Phase 1 — Foundation** | Multi-bot config in `wecomNotifier.ts`, `sendWeComMarkdownSafe()`, debounce aggregator, Prometheus counter, `sanitizeUserPayload()` helper | 2–3 days | None |
| **Phase 2 — Core Ops Events** | #1 Onboarding Complete, #2 Registration+Payment, #6 Venue Unassigned (format update), #8 Refund, #12 Pool Cancelled | 3–5 days | Phase 1 |
| **Phase 3 — Matching & Health** | #4 Pool Matching Complete, #5 Venue Assignment Result, #10 Failed Payment, #13 Low Registration, #14 Error Spike | 3–4 days | Phase 1 |
| **Phase 4 — Safety & Admin** | #7 Abuse Report, #11 Admin Override/Ban, #9 Account Deletion | 2–3 days | Phase 1, Phase 2 (refund pattern) |
| **Phase 5 — Polish** | Daily digest for P2, admin "test notification" button, notification delivery dashboard | 2–3 days | Phase 2–4 |

**Total estimated effort:** 12–18 engineering days across 5 phases.
