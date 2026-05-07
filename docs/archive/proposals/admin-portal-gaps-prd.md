# Admin Portal Operational Readiness & Dummy-Proof UX

**Type:** Product Requirements Document  
**Status:** Draft — pending deliberation  
**Last Updated:** 2026-04-22  
**Author:** Task Creator / Auto-Eval pipeline  
**Related:** `PRODUCT_REQUIREMENTS.md`, `PLATFORM_COORDINATION.md`, `AGENTS.md`  

---

## 1. Mission Statement

> Close the operational gap between the mini-program (launch-primary) and the admin portal so that a new operator can handle 80% of day-one tickets without engineering escalation, and 100% of P0 launch-blocker scenarios have admin tooling.

---

## 2. Problem Statement

The JoyJoin mini-program ships with 20+ user-facing screens (discover, pool registration, blind-box payment, matching, event coordination, icebreaker sessions, connections, rewards, etc.). The admin portal has management surfaces for many of these, but **critical operational gaps remain** that will force operators to ask engineers for help on launch day.

Additionally, the admin UI is **not dummy-proof**. A new operator joining the team faces:
- 20+ sidebar items with jargon-heavy names ("小悦进化", "Outcome 分析", "连接日志")
- Dense tables with no visual hierarchy for critical vs. routine items
- Complex multi-field forms (event pool creation is 1,449 lines) with no guided workflow
- A dashboard that shows stats but never says "do this next"

**The cost of inaction:** Every operator question that requires engineering = delayed user resolution = churn risk + engineering context-switching cost.

---

## 3. Target Users & Scenarios

| User | Role | Primary Scenario |
|------|------|-----------------|
| **新入职运营 (New Operator)** | `operator` | First week on the job. Needs to handle user complaints, process refunds, check event status, and flag bad actors without reading a manual. |
| **资深运营 (Senior Operator)** | `operator` | Running weekly events, monitoring pool fill rates, coordinating with venues, reviewing feedback. |
| **超级管理员 (Super Admin)** | `super_admin` | Onboarding new operators, auditing financials, configuring pricing/matching, handling escalations. |
| **客服 (Support Staff)** | `operator` | Responding to users who scanned the support QR in the mini-program event coordination page. |

---

## 4. Goals & Non-Goals

### Goals
1. **P0: Zero launch blockers** — Every critical post-launch operational scenario has admin tooling.
2. **P1: Self-service operations** — New operators can resolve 80% of tickets without Slack-pinging engineering.
3. **P2: Proactive operations** — The admin portal alerts operators to problems before users complain.
4. **UX: Dummy-proof by default** — Every screen passes the "new hire test": can a person who joined yesterday figure this out in 60 seconds?

### Non-Goals
- ❌ Rebuilding the admin portal from scratch — incremental improvements only.
- ❌ Adding real-time chat/DM between operators and users — notifications + ticket queue only.
- ❌ Replacing WeChat Pay's native refund flow — we surface status, WeChat handles the money.
- ❌ Admin mobile app — web admin portal only.
- ❌ Full data warehouse / BI — operational dashboards only, not executive analytics.

---

## 5. Gap Inventory

### 5.1 P0 — Launch Blockers (Pre-launch MUST)

#### GAP-001: Live Event Operations Center
**User Story:** As an operator, during an event I need to see who has checked in, who is missing, and whether the icebreaker session is running smoothly.

**Current State:** `AdminEventPoolsPage` shows pre-event pool data (registrations, groups, match scores). No real-time view of ongoing events.

**Proposed:** A new **"今日活动" (Today's Events)** page or dashboard card showing:
- Events happening today with status: 待开始 / 进行中 / 已结束
- Per-event: registered count, checked-in count, no-shows
- Quick actions: send reminder notification, mark no-show, view group details
- Link to icebreaker session monitor (GAP-002)

**Acceptance Criteria:**
- [ ] Operator can see all events for today in one view
- [ ] Operator can see check-in status per attendee
- [ ] Operator can send a bulk reminder to non-checked-in users
- [ ] Super admin can see the same view for any date

---

#### GAP-002: Icebreaker Session Monitor
**User Story:** As an operator, if an icebreaker session breaks or a host drops, I need to see session state and force-advance phases.

**Current State:** `AdminIcebreakerAiFeedbackPage` shows post-hoc AI quality review. No live session tooling.

**Proposed:** An **"破冰监控" (Icebreaker Monitor)** page showing:
- Active sessions: event name, current phase, host name, participant count
- Per-session: phase history, current phase duration, errors/warnings
- Operator actions: force-advance phase, reset session, message host
- Read-only view of session state (same data as mini-program `icebreaker-session`)

**Acceptance Criteria:**
- [ ] Operator can see all active icebreaker sessions
- [ ] Operator can view current phase and elapsed time
- [ ] Operator can force-advance a stuck session (with audit log)
- [ ] Operator cannot see participant messages (privacy)

---

#### GAP-003: Support Ticket Queue
**User Story:** As a support operator, when a user scans the support QR in the mini-program, I need to see their request in a queue and respond.

**Current State:** Mini-program `event-coordination` page shows `supportQrSrc` (a static QR image). No admin inbox.

**Proposed:** A **"客服工单" (Support Tickets)** page showing:
- Incoming tickets from users: user info, issue type, message, timestamp
- Ticket statuses: 待处理 / 处理中 / 已解决
- Operator actions: reply (in-app notification), mark resolved, escalate to super admin
- Ticket types: 活动问题, 支付问题, 账号问题, 匹配投诉, 其他

**Acceptance Criteria:**
- [ ] User can submit a ticket from the mini-program (replace static QR with a form)
- [ ] Operator sees new tickets in real-time (polling or WebSocket)
- [ ] Operator can reply via in-app notification
- [ ] Ticket history is searchable by user or date

---

#### GAP-004: Refund History & Status Tracking
**User Story:** As an operator, after I click "退款", I need to know whether the refund succeeded, failed, or is pending.

**Current State:** Refund button exists on `AdminFinancePage`. `POST /api/admin/payments/:paymentId/refund` initiates refund. No tracking UI.

**Proposed:** Enhance `AdminFinancePage` with:
- Refund status column in payments table: 未退款 / 退款中 / 已退款 / 退款失败
- Refund history tab or section showing all refund attempts with reason, operator, timestamp, status
- Failed refund alert (red badge) so operators can retry or escalate

**Acceptance Criteria:**
- [ ] Payments table shows refund status
- [ ] Refunded payments show "已退款" badge (already implemented)
- [ ] New refund history view shows all refund attempts
- [ ] Failed refunds are visually flagged

---

#### GAP-005: Onboarding Rescue View
**User Story:** As an operator, when a user is stuck in onboarding, I need to see where they dropped off and manually reset their state.

**Current State:** `AdminUsersPage` shows `nextStep` and profile flags. No bulk "stuck users" view or reset action.

**Proposed:** Add to `AdminUsersPage`:
- Filter: "卡住在 onboarding" — shows users whose `nextStep` hasn't advanced in >7 days
- Quick action: reset onboarding step, mark as complete, send nudge notification
- Onboarding funnel mini-chart: step-by-step drop-off rate

**Acceptance Criteria:**
- [ ] Operator can filter users stuck in onboarding
- [ ] Operator can reset a user's onboarding step (with audit log)
- [ ] Operator can send a targeted nudge notification
- [ ] Funnel chart shows drop-off per step

---

### 5.2 P1 — Week 1-2 Friction

#### GAP-006: Connections / Relationship Admin View
**User Story:** As an operator, I need to see who matched with whom and investigate connection disputes.

**Current State:** Mini-program has `connections` page. Admin has no visibility.

**Proposed:** A read-only **"连接管理" (Connections)** page showing:
- Recent connections: user A ↔ user B, event, timestamp, status
- Filter by event, user, or status
- Flag/report connection for moderation review

---

#### GAP-007: Rewards & Gamification Management
**User Story:** As an operator, I need to manually adjust user XP or badges when there's a dispute or bug.

**Current State:** Dashboard shows aggregate gamification stats. No per-user management.

**Proposed:** Add gamification section to `AdminUsersPage` user detail sheet:
- View user's current level, XP, JoyCoins, streak
- Manual actions: add XP, grant badge, reset streak (with reason + audit log)

---

#### GAP-008: Invite / Referral Analytics
**User Story:** As an operator, I want to see which users are top referrers and how the invite funnel performs.

**Current State:** Mini-program has `invite` page. No admin analytics.

**Proposed:** New **"邀请分析" (Invite Analytics)** page or section in `AdminInsightsPage`:
- Total invites sent, conversion rate, top referrers
- Invite code performance (if codes are used)

---

#### GAP-009: Real-Time Operational Alerts
**User Story:** As an operator, I want the dashboard to tell me what's wrong right now, not just show stats.

**Current State:** Dashboard is passive metrics.

**Proposed:** Add a **"今日待办" (Today's Tasks)** card at the top of the dashboard:
- 🔴 3 条举报待审核 (3 pending moderation reports)
- 🟡 2 个活动池即将截止，报名人数不足 (2 pools closing soon, under-filled)
- 🟢 1 笔退款申请待确认 (1 refund pending)
- ⚠️ 5 个用户卡住在 onboarding (5 users stuck in onboarding)

---

### 5.3 P2 — Month 2+ Polish

#### GAP-010: Operator Simplified Mode
**User Story:** As a new operator, I want a simplified view that hides advanced analytics and configuration.

**Current State:** `operator` role sees the same UI as `super_admin` (minus Admin Accounts sidebar item).

**Proposed:** Role-based view simplification:
- **Operator view:** Users, Event Pools, Today's Events, Support Tickets, Feedback, Moderation, Finance
- **Super admin view:** Everything including Matching Lab, AI Config, Evolution, Pricing, Coupons, Admin Accounts

---

#### GAP-011: Inline Help Tooltips
**User Story:** As a new operator, I want to understand what each field means without asking someone.

**Current State:** Zero contextual help on complex pages.

**Proposed:** Add `?` icon tooltips next to every non-obvious field/label:
- "匹配阈值" → "分数低于此值的配对将不会被分到同一组"
- "目标组数" → "预计分成几组，影响场地预订数量"

---

#### GAP-012: Bulk Operations
**User Story:** As an operator, I want to message multiple users or update multiple pools at once.

**Current State:** All actions are single-item.

**Proposed:** Multi-select + bulk actions on Users, Event Pools, and Support Tickets tables.

---

## 6. Dummy-Proof UI Principles

Every admin page must pass these 6 rules. These become acceptance criteria for any new or modified admin surface.

| # | Principle | Test | Example Fix |
|---|-----------|------|-------------|
| 1 | **Guided Workflows** | Can a new hire complete the task without asking for help? | Event pool creation → step wizard (Step 1/2/3) |
| 2 | **Plain-Language Labels** | Does every nav item and button make sense to someone who's never used the product? | "小悦进化" → "小悦进化 (AI 助手调优)" |
| 3 | **Actionable Dashboard** | Does the dashboard tell me what to do right now? | Add "今日待办" card with counts + links |
| 4 | **Role-Based Simplification** | Does an operator see only what they need? | Hide Matching Lab, AI Config from `operator` role |
| 5 | **Contextual Help** | Can I understand any field by clicking a `?` icon? | Every non-obvious label has a tooltip |
| 6 | **Visual Status Hierarchy** | Can I spot critical items in <3 seconds? | Critical = red + bold. Warning = amber. OK = muted green. |

---

## 7. Phased Roadmap

### Phase 1 — Pre-Launch (P0: Zero Blockers)
**Goal:** An operator can handle every critical day-1 scenario without engineering help.

| Item | Gap ID | Effort | Owner |
|------|--------|--------|-------|
| 今日待办 dashboard card | GAP-009 | 1-2 days | Frontend |
| Live Event Operations Center | GAP-001 | 1 week | Frontend + Backend |
| Support Ticket Queue | GAP-003 | 3-4 days | Frontend + Backend |
| Refund History & Status | GAP-004 | 2-3 days | Frontend |
| Onboarding Rescue View | GAP-005 | 2-3 days | Frontend + Backend |
| Icebreaker Session Monitor | GAP-002 | 1 week | Frontend + Backend |

**Go/No-Go Criteria:**
- All P0 gaps have working admin UI
- New operator can complete a refund, view today's events, and handle a support ticket in a single session
- Typecheck passes, no console errors

### Phase 2 — Week 1-2 Post-Launch (P1: Self-Service)
**Goal:** Reduce operator→engineering escalations to <20% of tickets.

| Item | Gap ID | Effort |
|------|--------|--------|
| Connections Admin View | GAP-006 | 2-3 days |
| Rewards Management | GAP-007 | 2-3 days |
| Invite Analytics | GAP-008 | 2-3 days |
| Real-Time Alerts (expanded) | GAP-009 | 2-3 days |

**Go/No-Go Criteria:**
- Operator satisfaction survey ≥4/5 on "I can find what I need"
- Engineering support ticket volume down 50% vs. launch week

### Phase 3 — Month 2+ (P2: Polish)
**Goal:** The admin portal feels like a premium operational tool, not a raw database UI.

| Item | Gap ID | Effort |
|------|--------|--------|
| Operator Simplified Mode | GAP-010 | 3-4 days |
| Inline Help Tooltips | GAP-011 | 2-3 days |
| Bulk Operations | GAP-012 | 3-4 days |

---

## 8. Mini-Program → Admin Feature Matrix

| Mini-Program Feature | Admin Coverage | Gap |
|---------------------|----------------|-----|
| 发现 (Discover) | Event Pools, Events | 🟡 |
| 活动报名 (Pool Registration) | Event Pools (registrations tab) | 🟢 |
| 盲盒支付 (Blind Box Payment) | Finance + Refunds | 🟡 (refund tracking missing) |
| 匹配状态 (Matching Status) | Matching Lab, Logs | 🟢 |
| 活动协调 (Event Coordination) | ❌ None | 🔴 GAP-001 |
| 破冰会话 (Icebreaker Session) | AI Feedback only | 🔴 GAP-002 |
| 连接 (Connections) | ❌ None | 🟡 GAP-006 |
| 奖励 (Rewards) | Dashboard stats only | 🟡 GAP-007 |
| 邀请 (Invite) | ❌ None | 🟡 GAP-008 |
| 个人资料 (Profile) | Users page | 🟢 |
| Onboarding | Users page (partial) | 🟡 GAP-005 |
| 反馈 (Feedback) | Feedback page | 🟢 |
| 客服 (Support) | ❌ Static QR only | 🔴 GAP-003 |

---

## 9. Out of Scope

- Mobile admin app or mini-program admin surface
- Real-time chat between operators and users
- Full BI/data warehouse (we have operational dashboards only)
- Replacing WeChat Pay refund mechanics (we track status, they handle money)
- Multi-language admin portal (Chinese only for launch)
- Automated AI operator (human operators only)

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Operator Self-Service Rate** | ≥80% of tickets resolved without engineering | Weekly survey + escalation ticket count |
| **New Operator Time-to-Productivity** | <4 hours to handle first solo refund + event check | Onboarding checklist timer |
| **Dashboard Action Time** | <30 seconds from login to first actionable task | Clickstream / heuristic test |
| **P0 Gap Closure** | 100% before launch | Checklist |
| **Admin UI Error Rate** | <1% of actions result in console errors or API 500s | Sentry / logs |

---

## 11. Constraints, Risks & Dependencies

### Constraints
- **Mini-program is launch-primary.** All admin features must support mini-program data and flows first. Web is reference-only.
- **Operator role cannot touch money config.** Only `super_admin` can modify pricing, coupons, or subscription plans.
- **Privacy:** Operators can never read user messages or connection content. Metadata only.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| P0 scope grows during implementation | High | Launch delay | Strict go/no-go per phase; no P2 work in Phase 1 |
| Icebreaker session state is complex to monitor | Medium | GAP-002 ships incomplete | Start with read-only view; write actions in Phase 2 |
| Support ticket queue needs real-time infra | Medium | Engineering cost | Start with 30s polling; upgrade to WebSocket in Phase 2 |
| "Dummy-proof" is subjective | Medium | Operators still confused | Usability test with 2-3 real people before launch |

### Dependencies
- `GAP-004` (refund tracking) depends on `paymentService.createRefund` returning/trackable status — already exists but needs DB schema for refund log.
- `GAP-003` (support tickets) needs a new `support_tickets` table + mini-program form submission.
- `GAP-002` (icebreaker monitor) needs read access to social icebreaker session store — schema exists, UI needed.

---

## 12. Open Questions

1. Do we have a target launch date to back-calculate Phase 1 deadline?
2. Should the support ticket form in the mini-program replace the static QR, or coexist?
3. Is there budget/approval to hire 1-2 operators for soft-launch, or will founders handle ops initially?
4. Should "今日待办" be a persistent sidebar widget or a dashboard card?
5. Do we need an "operator onboarding checklist" built into the admin portal itself?

---

## Review Checklist

- [x] Uses active JoyJoin terminology (mini-program-first, 权益, 连接, etc.)
- [x] Current state and proposed state are clearly separated
- [x] Goals and non-goals are explicit
- [x] User stories are specific enough to guide engineering
- [x] Acceptance criteria are testable
- [x] Success metrics are measurable
- [x] Open questions, dependencies, and risks are visible
