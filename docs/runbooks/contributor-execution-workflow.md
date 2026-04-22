# Contributor Execution Workflow

**Status:** Active runbook  
**Scope:** Systematic task-to-ship workflow for AI-assisted development in the JoyJoin monorepo  
**Related:** [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`.github/skills/lane-selection-governance`](../../.github/skills/lane-selection-governance/SKILL.md), [`.github/AI_WORKFLOW_POLICY.md`](../../.github/AI_WORKFLOW_POLICY.md)

---

## Before you start: the 5-minute planning check

Every task begins here. Do not skip this even for "quick fixes."

### 1. Mission statement

Write **one sentence** describing what you are doing:

> _Example: "Add cache hit/miss metrics for pool card AI copy consumption."_

### 2. Invert the failure mode

Ask: *"What is the worst outcome if I choose the wrong approach?"*

> _Example: "Missing metrics → blind to cache efficacy under viral load."_

### 3. Identify affected surfaces

List the files or workspaces you expect to touch (best guess is fine):

> _Example: `apps/server/src/middleware/metrics.ts`, `apps/server/src/routes.ts`, `apps/server/src/ai/workers/poolCardCopyWorker.ts`_

### 4. Run the 4-gate lane selector

Apply the gates **in order**. Stop at the first match.

```
Gate 1 — HRC required?
  Does this touch auth, payments, matching engine, personality assignment,
  a state machine (icebreaker phases, onboarding, registration), DB migration
  with backfill, or real-time infrastructure (WebSocket)?
  ├─ YES → Lane = Harness Runtime Controller
  └─ NO →

Gate 2 — DM required?
  Does this span >1 workspace AND have UX/architecture trade-offs
  with no single obvious solution?
  ├─ YES → Lane = Deliberation Moderator
  └─ NO →

Gate 3 — Kickoff required?
  Is the scope broad or ambiguous (no clear file list yet)?
  ├─ YES → Lane = Researcher → Planner
  └─ NO →

Gate 4 — Direct delivery
  Bounded, inside one skill boundary, straightforward path.
  → Lane = Direct delivery
```

**Icebreaker shortcut:** If the task touches the icebreaker stack, consult [`docs/architecture/icebreaker-lane-selection.md`](../architecture/icebreaker-lane-selection.md) instead of guessing.

### 5. Document the lane choice

Write one line explaining why:

> _Example: "Lane = Direct. Single-skill boundary (platform-observability-and-ops), bounded file set, no auth/state-machine/migration touch."_

---

## Phase 1: Lane execution

### Direct delivery (most common)

1. **Read the relevant skill** (1 min). Start with `.github/skills/README.md` index.
2. **Write a micro-plan** (2-3 sentences):
   - Goal
   - Files to change
   - Validation path
3. **Implement.**
4. **Validate continuously** (see Phase 3).

### Kickoff lane (broad / ambiguous)

1. **Run `Researcher`** — gather repo context, constraints, ambiguities.
2. **Run `Planner`** — produce approval-first execution plan with `## Model Recommendation for Execution`.
3. **Get approval** — do not start implementation until the plan is locked.
4. **Implement per plan.**

### Deliberation Moderator (cross-workspace architecture / UX)

1. **Run `Deliberation Moderator`** — Alpha (Architect), Beta (UX Visionary), Gamma (Code Realist).
2. **Wait for consensus** — all 3 delegates must ACK.
3. **Implement per consensus plan.**

### Harness Runtime Controller (high-risk / core engine)

1. **Run `Harness Runtime Controller`** — default mode `pge-council`.
2. **Sprint Contract** must be locked before any architecture is proposed.
3. **Harness Verification Gate** — all 5 pillars must pass (or CONCERNs must be mitigated/accepted).
4. **Persist transcript** to `.git/.orchestration/harness/`.
5. **Implement per Harness-approved plan.**

---

## Phase 2: Implementation discipline

### Constraint-first

Name hard constraints before writing code:
- Auth / safety boundaries
- Platform limits (Taro, WeChat)
- Latency / cost ceilings
- Deterministic authority rules (matching, personality)

### End-to-end slice ownership

One lane owns the vertical slice:
- API contract
- Client surfaces that consume it
- Tests
- Operational signals (metrics, logs) where applicable

### No cross-app imports

Reusable logic goes in `packages/shared`. Apps never import source from other apps.

### Smallest validating proof

Prefer targeted tests + guardrails over bigger plans. Never skip:
- `npm run guardrails`
- Type check for affected workspaces
- Tests for changed invariants

---

## Phase 3: Quality gates (mandatory before any handoff)

Run these in order. Stop and fix on first failure.

```bash
# 1. Guardrails (env, secrets, legacy identifiers, import boundaries)
npm run guardrails

# 2. Type check (pick the narrowest check that covers your change)
npm run check:server      # if you touched server
npm run check:clients     # if you touched web, admin, or mini-program

# 3. Tests
npm run test -w @joyjoin/server     # server changes
npm run test -w mini-program        # mini-program changes

# 4. Auto-Eval (dirty worktree review)
# Run when the change is substantial or touches critical paths
npm run auto-eval           # if configured, or run local verification checklist

# 5. Harness lane validator (if HRC-eligible files may have been touched)
node scripts/validate-harness-lane-requirement.mjs

# 6. Orchestration validate (only if you changed skills, agents, or orchestration.yaml)
npm run orchestration:validate
```

**Rule:** If a gate fails, fix it before adding more code. Do not accumulate debt across gates.

---

## Phase 4: Documentation sync

Ask: *"Did I change anything that another contributor or agent would need to know?"*

- [ ] **AGENTS.md** — updated if build steps, conventions, or agent usage changed
- [ ] **Skills** — updated if domain rules or placement conventions changed
- [ ] **Architecture docs** — updated if public interface or system boundaries changed
- [ ] **Env templates** — updated if new environment variables were added

**Anti-pattern:** *"I'll update the docs in a follow-up PR."* Follow-up PRs for docs rarely ship.

---

## Phase 5: PR / ship

### PR description template

```markdown
## What
One-sentence mission.

## Lane used
Direct / Kickoff / DM / HRC — and why.

## Affected surfaces
List workspaces and key files.

## Risks
Call out any concerns in reliability, scalability, security, observability, maintainability.

## Validation
- [ ] `npm run guardrails` — pass
- [ ] `npm run check:server|clients` — pass
- [ ] Tests — pass (N passed, 0 new failures)
- [ ] Auto-Eval / QA check — pass (if applicable)
```

### Code review

Load [`.github/skills/code-review/SKILL.md`](../../.github/skills/code-review/SKILL.md) and evaluate against the Harness Engineering Framework:
- Reliability
- Scalability
- Security
- Observability
- Maintainability

---

## Quick-reference cheat sheet

| Situation | Lane | First action |
|---|---|---|
| CSS tweak, copy change, add a color token | Direct | Read skill → micro-plan → implement |
| New API field (passthrough, no auth change) | Direct | Read `server-domain-architecture` skill |
| Cross-workspace UI revamp (e.g., pool card redesign) | DM | Run `Deliberation Moderator` |
| Payment flow, auth change, matching engine | HRC | Run `Harness Runtime Controller` |
| Icebreaker phase state machine change | HRC | See `docs/architecture/icebreaker-lane-selection.md` |
| Icebreaker UI / new phase view | DM | See `docs/architecture/icebreaker-lane-selection.md` |
| Not sure which files to touch | Kickoff | Run `Researcher` → `Planner` |
| Incident fix in production | Direct | Micro-plan + smallest safe fix + guardrails + tests |

---

## Turn summary

At the end of every session, emit a compact summary:

```json
{
  "delivered": "what shipped",
  "files_changed": ["..."],
  "lane_used": "direct|kickoff|dm|hrc",
  "decisions": ["..."],
  "blockers": ["..."],
  "next_steps": ["..."],
  "confidence": "high|medium|low"
}
```

This creates a searchable trail and helps the next agent or human pick up where you left off.
