---
name: lane-selection-governance
description: >
  Governed decision framework for choosing the correct AI-assisted delivery lane
  (Direct, Kickoff, Deliberation Moderator, Harness Runtime Controller) before
  any implementation begins. Use when routing a task, writing a plan, or auditing
  whether the right deliberation depth was applied. Trigger phrases: which lane,
  HRC or DM, direct or deliberation, harness this, route this task, lane selection,
  delivery lane, kickoff or direct, planning check.
---

# Lane Selection Governance

## Purpose

Prevent **lane drift**: using a lightweight direct-delivery micro-plan for a state-machine change, or forcing a full Harness chamber on a bounded UI tweak. This skill gives a deterministic 4-gate heuristic that any agent or contributor can apply in under 30 seconds.

---

## The 4-gate heuristic

Apply these gates **in order**. Stop at the first match.

### Gate 1 — Harness Runtime Controller (HRC)

**Use when ANY of the following is true:**

- The task touches **auth, sessions, or trust boundaries** (new admin route, session store change, auth middleware, bypass login CLI).
- The task touches **payments or entitlements** (WeChat Pay creation, verification, refund, event-pack credit logic).
- The task modifies a **deterministic product authority** (matching engine, personality/archetype assignment, assessment scoring).
- The task adds or modifies a **state machine with partial-failure risk** (icebreaker phase advances, registration session lifecycle, onboarding state transitions).
- The task requires **database schema change + backfill** (new non-nullable column, unique constraint on existing data, column rename).
- The task changes **real-time infrastructure** (WebSocket broadcast patterns, heartbeat/reconnect logic, room-based messaging).
- The user explicitly says "harness this," "run through the full chamber," or "production harness review."

**HRC output:** Sprint Contract + PGE loop + Council + Harness Verification Gate (5 pillars) + risk acceptance signatures.

### Gate 2 — Deliberation Moderator (DM)

**Use when ALL of the following are true:**

- The task spans **>1 workspace** (e.g., server + mini-program, shared + web + admin).
- The task has **UX or architecture trade-offs with no single obvious solution**.
- The task does **NOT** touch auth, payments, matching, state machines, or DB migrations.

**DM output:** 3-perspective consensus (Architect + UX Visionary + Code Realist) + unified plan.

### Gate 3 — Kickoff lane (Researcher → Planner)

**Use when ALL of the following are true:**

- The scope is **broad or ambiguous** (no clear file list, multiple plausible solution shapes).
- The task does **NOT** yet meet the HRC or DM criteria because discovery is missing.

**Kickoff output:** Verified research brief + approval-first execution plan before implementation.

### Gate 4 — Direct delivery

**Use when ALL of the following are true:**

- The task is **bounded** (affected files are known and <10).
- The task stays **inside one skill-owned boundary**.
- The task does **NOT** touch auth, payments, matching, state machines, DB migrations, or real-time infrastructure.
- The path is straightforward (one specialist can own it end-to-end).

**Direct output:** Compact micro-plan + implementation + local validation (guardrails, tests, typecheck).

---

## Quick-reference matrix

| Concern | Lane |
|---|---|
| Auth / session / trust boundary | **HRC** |
| Payment / refund / entitlement | **HRC** |
| Matching engine / personality assignment | **HRC** |
| State machine (icebreaker phases, onboarding, registration) | **HRC** |
| DB schema + backfill | **HRC** |
| WebSocket / realtime infra | **HRC** |
| Cross-workspace UI with architecture/UX trade-offs | **DM** |
| New public API surface (no auth/migration change) | **DM** |
| Component boundary debate (shared vs app-specific) | **DM** |
| Ambiguous scope, no clear file list | **Kickoff** |
| Single-file bug fix inside one skill boundary | **Direct** |
| Copy change, color token, Tailwind class tweak | **Direct** |
| Add a new passthrough API field | **Direct** |

---

## Anti-patterns

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| **HRC for a CSS tweak** | Wastes 3+ agent turns on a 5-minute change. Dilutes Harness gate authority. | Gate 4 — Direct delivery |
| **Direct delivery for a payment flow** | Misses reliability, security, and idempotency review. High incident risk. | Gate 1 — HRC |
| **DM for a state-machine change** | DM delegates are Architect/UX/Code-Realist, not Reliability/Scalability/Security engineers. Partial-failure risk is under-weighted. | Gate 1 — HRC |
| **Skipping the planning check entirely** | Even direct delivery needs a 1-sentence mission + file scope + validation path. | Always run the 4-gate heuristic |
| **Retroactively declaring lane after coding** | Lane selection is a **pre-implementation** decision, not a post-hoc label. | Run gates before first file edit |

---

## Icebreaker-specific layer map

Icebreaker is a **stack**, not a monolith. Which layer you touch determines the lane.

| Layer | Examples | Lane |
|---|---|---|
| Session lifecycle & phase state machine | Change `PHASE_ORDER`, modify `advance` guards, alter `cleanupPhaseStateForNextPhase`, change host authority, TTL/sweep logic | **HRC** |
| New phase with new ephemeral state | Add a phase requiring new state fields (e.g., `speedDatingReadyUserIds`) + cleanup + advance guard | **HRC** |
| Phase-specific game logic (existing state) | New dice challenge template, new auction lot category, tweak lie-detective reveal rules within current schema | **DM** |
| AI copy / prompt changes | New XiaoYue comment style, new warmup topic flavor | **Direct** |
| REST route additions (passthrough) | Add `GET /api/social-icebreaker/:id/stats` reading existing state | **Direct** |
| UI / rendering changes | New phase view, motion design, responsive layout | **DM** or **Direct** |
| WebSocket broadcast changes | Modify real-time event shape, heartbeat logic | **HRC** |

Full reference: [`docs/architecture/icebreaker-lane-selection.md`](../../../docs/architecture/icebreaker-lane-selection.md)

---

## Agent wiring

Load this skill in the planning phase for:

- **Supervisor** — before routing to any specialist
- **Planner** — before writing an approval-first execution plan
- **Auto-Eval** — when auditing whether the right lane was used for a changeset
- **code-review** — when checking if a PR of a given risk level was under-deliberated

---

## Review checklist

- [ ] Was the 4-gate heuristic applied **before** implementation started?
- [ ] If HRC was chosen, is there a Sprint Contract + Harness transcript in `.git/.orchestration/harness/`?
- [ ] If DM was chosen, is there a deliberation log in `.git/.orchestration/deliberation/`?
- [ ] If Direct was chosen, does the micro-plan name the mission, file scope, and validation path?
- [ ] Does the lane choice match the **highest-risk concern** in the diff (not the majority of lines changed)?
