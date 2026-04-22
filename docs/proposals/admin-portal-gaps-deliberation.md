# Admin Portal Gap PRD — Deliberation Transcript

**Session ID:** admin-portal-gaps-2026-04-22  
**Moderator:** Task Creator (Kimi Code CLI)  
**Delegates:** Alpha (Architect), Beta (UX Visionary), Gamma (Code Realist)  
**Status:** Converged — pending human ACK  

---

## Phase 1 — Team Assembly (Isolated Proposals)

### Alpha (Architect) Proposal
> The PRD is directionally correct but P0 timeline is optimistic. GAP-002 write-actions are architecturally unsafe without significant backend rework. Of 12 gaps, 9 are straightforward, 2 are risky, 1 is greenfield. Recommend merging GAP-009 into GAP-001, descoping GAP-002 writes from P0, moving GAP-003 to P1, and building GAP-004 first.

Key assumptions challenged:
- Icebreaker phase transitions are not safely mutable by external actors
- Onboarding `nextStep` is computed, not reversible by writing a single column
- Support ticket polling assumes low volume without indexes
- WeChat Pay refund webhooks are not the only source of truth (failed webhooks = stuck state)
- `eventPools` and `events` are not unified schemas

### Beta (UX Visionary) Proposal
> The PRD will close feature gaps but will NOT make the portal dummy-proof by launch. The 6 principles are right, but deferring GAP-010 and GAP-011 to Month 2+ means a new operator on day 1 still faces 20+ jargon-heavy nav items, a 1,449-line event pool form, and dense tables with no guidance.

Key assumptions challenged:
- Operators do not already understand JoyJoin jargon
- A single "今日待办" card is insufficient for daily workflow
- Operators cannot infer priority from raw tables
- New operators will not tolerate full-complexity UI for 4-8 weeks
- Current sidebar grouping is not salvageable with minor tweaks

### Gamma (Code Realist) Proposal
> The PRD significantly understates runtime brittleness. At 2am, an operator will force-advance an icebreaker session and corrupt state; issue a refund that fails silently; and chase attendees with a bulk-reminder button that is currently a hard-coded stub returning `{ success: true }`.

Key assumptions challenged:
- `nextStep` is not a persisted timestamped field
- Admin force-advance is not a simple UPDATE
- The "bulk reminder" endpoint is a stub with zero delivery logic
- No `refund_attempts` table exists
- New admin routes will not be automatically covered by RBAC tests

---

## Phase 2 — Anonymous Peer Review

### Alpha critiques Beta + Gamma
| Target | Strength | Weakness |
|--------|----------|----------|
| Beta (UX) | Correctly reframes success around day-1 cognitive load; liabilities are measurable adoption blockers | Does not specify architectural boundary for Operator Simplified Mode (client-side vs. server-side) or content lifecycle for help strings |
| Gamma (Code) | Accurately maps asymmetric blast radius of admin mutations; proposes mechanical safeguards not procedural checks | Presents all 10 guardrails as monolithic pre-shipping block without risk-weighted sequencing |

### Beta critiques Alpha + Gamma
| Target | Strength | Weakness |
|--------|----------|----------|
| Alpha (Arch) | Strong product judgment identifying GAP-003 as high blast radius; protects launch-primary UX | Recommends descoping GAP-002 writes to read-only, but this ignores the operator's lived experience at 2am — they need a safe remediation path, not just observability |
| Gamma (Code) | Anchors every risk to a vivid operational scenario (2am operator), preventing abstract over-engineering | Treats corrupted sessions and silent refunds as purely operator-side problems without tracing impact to end-users or proposing user-facing recovery flows |

### Gamma critiques Alpha + Beta
| Target | Strength | Weakness |
|--------|----------|----------|
| Alpha (Arch) | Risk-first descoping of GAP-002 writes and GAP-003 is pragmatic and protects critical path | Merging GAP-009 into GAP-001 lacks concrete query plan or index strategy, risks turning "single endpoint" into an N+1 performance trap |
| Beta (UX) | Moving GAP-010/GAP-011 to Phase 1 directly addresses launch-day operational risk | Adds 7 new UX workstreams to Phase 1 without specifying which existing P0 gaps get descoped, making the proposal technically unbounded |

---

## Phase 3 — Open Roundtable (Convergence)

### Core Disagreement
**What is the minimum viable P0 scope that protects launch timeline, is usable by a new operator on day 1, AND has foundational guardrails in place?**

- Alpha: Ruthless descoping. Ship only read-only monitors + refund tracking + merged alerts. Move all UX and support tickets to P1.
- Beta: P0 MUST include scoped UX simplification (operator mode + tooltips on 3 screens) or operators will fail regardless of feature coverage.
- Gamma: Guardrails are preconditions, not nice-to-haves. But they can run in parallel with frontend work.

### Alpha's Converged Stance (Round 1)
Alpha synthesized all three positions into a negotiated stance:

**P0 Scope (Ruthless core + minimal survival UX + parallel guardrails):**
1. **GAP-004:** Refund tracking (full CRUD + admin audit log)
2. **GAP-001/GAP-009 merged:** Today's events dashboard + real-time alerts
3. **GAP-005 read-only:** Onboarding stuck-users monitor
4. **GAP-002 read-only:** Icebreaker session monitor
5. **GAP-010 scoped:** Operator simplified mode — hide super-admin nav items, default operator to essential-actions-only view (NO first-run wizard, NO dashboard split)
6. **GAP-011 scoped:** Inline help tooltips on 3 highest-friction screens only — refund flow, event pool creation, match-run trigger
7. **Gamma guardrails (parallel track):** Schema-first migrations, audit vocabulary extension, RBAC test updates, refund log table, structured logging

**P1 Scope:**
- GAP-003: Support tickets (full CRUD)
- GAP-010 full: First-run onboarding + dashboard split
- GAP-011 full: Inline help across all screens
- UX polish: Bulk actions, advanced filtering

**Concessions made:**
- Alpha accepted GAP-010 and GAP-011 cannot be fully deferred to P2
- Alpha accepted Gamma's guardrails as P0 parallel work
- Alpha dropped insistence that ALL UX simplification moves to P2

**Non-negotiables:**
- GAP-004 must ship P0 with full audit log
- GAP-001/GAP-009 must ship P0
- GAP-010 simplified view must ship in some form P0
- Gamma's guardrails must be CI-passing before P0 launch
- GAP-003 stays P1
- Full dashboard split and first-run onboarding stay P1

---

## Phase 4 — Consensus Poll (ACK-ALL)

| Delegate | ACK / NACK | Reasoning |
|----------|-----------|-----------|
| **Alpha** | **ACK** | Converged stance is my own Round 1 output. All non-negotiables are preserved. |
| **Beta** | **ACK** | Converged stance includes scoped GAP-010 and GAP-011 in P0, which satisfies the day-1 operator survival requirement. First-run onboarding and full dashboard split are deferred to P1, which is acceptable if the simplified mode is sufficient. |
| **Gamma** | **ACK** | Converged stance includes all guardrails as parallel P0 work with CI gate before launch. No features ship without schema, audit, RBAC, and logging coverage. The read-only constraint on GAP-002 eliminates the highest-severity data-integrity risk. |

**Result: Unanimous ACK. All 3 delegates approve the converged plan.**

---

## Final Unified Plan

### P0 — Pre-Launch (Calendar target: 2.5–3 weeks)

| # | Gap | Scope | Effort | Owner |
|---|-----|-------|--------|-------|
| 1 | **GAP-004** Refund Tracking | Full refund history table + status badges + failed refund alerts | 2-3 days | Frontend + Backend |
| 2 | **GAP-001/GAP-009** Today's Events + Alerts | Ops dashboard endpoint showing today's events + alert counts (pending reports, under-filled pools, stuck users, refund_pending) | 1 week | Frontend + Backend |
| 3 | **GAP-005** Onboarding Rescue | Read-only stuck-users filter + funnel chart. NO reset action in P0. | 2-3 days | Frontend |
| 4 | **GAP-002** Icebreaker Monitor | Read-only session state view. NO force-advance or reset in P0. | 2 days | Frontend |
| 5 | **GAP-010** Operator Simplified Mode | Hide super-admin nav items from `operator` role. Default to essential-actions-only sidebar. | 1-2 days | Frontend |
| 6 | **GAP-011** Inline Help (scoped) | Tooltips on 3 screens: refund flow, event pool creation, match-run trigger | 1-2 days | Frontend |
| 7 | **Guardrails** | Schema migrations, audit vocabulary, RBAC test updates, refund log table, structured logging | Parallel | Backend |

### P1 — Week 1-2 Post-Launch

| # | Gap | Scope |
|---|-----|-------|
| 8 | **GAP-003** Support Tickets | Full ticket CRUD + mini-program form + admin queue |
| 9 | **GAP-010** First-Run Onboarding | 3-step spotlight tour on first login |
| 10 | **GAP-011** Full Inline Help | All Finance + Event Pools screens |
| 11 | **Dashboard Split** | Operations vs. Analytics tabs |
| 12 | **GAP-006** Connections | Read-only connection view |
| 13 | **GAP-007** Rewards | Per-user XP/badge adjustment |

### P2 — Month 2+

| # | Gap | Scope |
|---|-----|-------|
| 14 | **GAP-002** Icebreaker Write Actions | Safe force-advance with snapshotting + optimistic locking |
| 15 | **GAP-005** Onboarding Reset | Manual reset action with audit log |
| 16 | **GAP-012** Bulk Operations | Multi-select + bulk actions |
| 17 | **GAP-008** Invite Analytics | Referral funnel + top referrers |

---

## Handoff Notes

- **Supervisor/Planner:** Route to `Backend Engineer` for guardrails + schema work in parallel with `Expert React Frontend Engineer` for admin UI changes.
- **QA Agent:** Smoke-test every new admin route with `operator` role to confirm RBAC gating.
- **Database Schema & Migration Auditor:** Review `support_tickets` and `refund_attempts` migrations before they merge.
- **Risk accepted:** GAP-003 (support tickets) is P1. Day-1 support will rely on the existing static QR code + manual operator follow-up via phone/DM.
