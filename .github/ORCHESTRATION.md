# Native Agent Orchestration

This document explains the native custom-agent orchestration layer for JoyJoin.

The machine-readable source of truth is `.github/orchestration.yaml`. This guide is the human-readable companion for contributors.

## Related docs

- [`AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md) defines when to use direct delivery, the `Researcher` -> `Planner` kickoff lane, and the operational review lane.
- [`ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md) defines how to change agents, skills, hooks, runtime scripts, and validation surfaces safely.
- [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md) remains the source of truth for runtime product AI architecture and invariants.

## Scope

Broad sessions now have a kickoff lane before the core handoff graph:

- `Researcher`
- `Planner`

Those kickoff agents gather verified repo context and turn it into an approval-first plan. They do not replace `Supervisor`, which remains the manual routing surface once execution is approved or when work needs midstream rerouting.

The v1 native handoff graph is intentionally narrow:

- `Supervisor`
- `Auto-Eval`
- `Product Manager`
- `Backend Engineer`
- `AI Engineer`
- `QA Agent`
- `Launch Readiness Agent`

Other existing agents still matter. They are covered in the orchestration contract as audited support lanes with explicit skill links and tooling sufficiency notes, but they are not forced into the default handoff graph yet.

That split is deliberate:

- keep the user-facing graph small enough to stay understandable
- keep the broader portfolio visible so future expansion stays explicit
- capture tooling gaps now instead of rediscovering them later

Supervisor also has explicit rerouting exits that do not promote more agents into the core graph. It can send work back to `Researcher` or `Planner` when discovery or approval-first planning must reopen, and it can route into selected audited frontend lanes for parity audit, web UI work, mini-program UI work, or parity-first migration.

Those rerouting exits are now also declared as native Supervisor handoffs in the agent frontmatter so the routing buttons and the orchestration contract stay aligned.

## Runtime surfaces

- Copilot hooks: `.github/hooks/auto-eval.json` and `.github/hooks/orchestration.json`
- Local git hooks: `.githooks/pre-commit` and `.githooks/post-commit`
- GitHub workflow: `.github/workflows/orchestrate.yml`
- Runtime context: `.git/.orchestration/context.json`
- Runtime event log: `.git/.orchestration/events.jsonl`

## Local setup

Enable the repo-managed git hooks once per clone:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/post-commit
```

Useful commands:

```bash
npm run orchestration:validate
npm run orchestration:tooling-report
node scripts/orchestration-supervisor.mjs workflow pull-request
```

## Session kickoff flow

- `SessionStart` initializes the orchestration runtime and writes default kickoff state under `.git/.orchestration/context.json`.
- `UserPromptSubmit` inspects the first broad prompt and recommends `Researcher` -> `Planner` when the request is multi-step, ambiguous, or cross-cutting.
- `Researcher` returns a structured research brief.
- `Planner` turns that brief into an approval-first execution plan.
- After approval, `Supervisor` or the named specialist carries execution forward.

This is a guidance-and-handoff layer, not a hidden auto-execution path. Hooks bootstrap the recommendation and state, while agent delegation remains explicit.

## Core handoff graph

- `Auto-Eval` -> `Supervisor` when the user needs routing from dirty-worktree findings to the right specialist.
- `Auto-Eval` -> `Launch Readiness Agent` when the local gate passes but broader release risk still matters.
- `Product Manager` -> `Backend Engineer` or `AI Engineer` depending on the implementation lane.
- `Backend Engineer` -> `QA Agent` and `Auto-Eval` for verification and local quality sign-off.
- `AI Engineer` -> `QA Agent` and `Launch Readiness Agent` for verification and rollout risk review.
- `QA Agent` -> `Launch Readiness Agent` and `Auto-Eval` for release escalation and final local gate recheck.
- `Launch Readiness Agent` -> `Auto-Eval` or `Supervisor` depending on whether the next step is local sign-off or blocker routing.

## Supervisor rerouting lanes

- `Supervisor` -> `Researcher` when the current blocker exposes missing repo context or unresolved ambiguity.
- `Supervisor` -> `Planner` when the findings exist but the plan, sequencing, or approval boundary must be refreshed.
- `Supervisor` -> `Mini-Program Parity Auditor` for compare-only parity review or migration backlog work.
- `Supervisor` -> `Expert React Frontend Engineer` for web UI implementation in `apps/user-client`, including branding-sensitive UI work that should stay attached to frontend skills rather than a standalone branding agent.
- `Supervisor` -> `Taro Mini-Program Frontend Engineer` for direct Taro UI implementation or refinement in `apps/mini-program`.
- `Supervisor` -> `Taro Migration Specialist` for parity-first migration from `apps/user-client` into `apps/mini-program`.

These are explicit support-lane exits, not a promotion of those agents into the default v1 graph.

## Why the broader portfolio is still linked

The current planning should cover other existing agents and skills when that linkage is relevant and helpful. In practice that means:

- every active agent is listed in `.github/orchestration.yaml`
- every active agent has explicit skill bindings, even if it is not in the v1 graph
- every active agent gets a tooling sufficiency assessment so future orchestration work starts from a clear baseline

This does not mean every agent should get native handoff buttons today.

It does mean the current planning now records how those agents fit the portfolio, what skills they rely on, and what capabilities would need to improve before they can participate more deeply.

## Skill bindings

Core orchestrated bindings:

- `Product Manager` -> `draft-prd`
- `Backend Engineer` -> `server-domain-architecture`, `auth-session-and-safety-boundaries`, `reliability-and-state-integrity`
- `AI Engineer` -> `llm-runtime-safety-and-integration`, `platform-observability-and-ops`
- `QA Agent` -> `e2e-test-runner`, `testing-and-regression-guardrails`
- `Launch Readiness Agent` -> `security-scan`, `platform-observability-and-ops`, `code-review`

Useful audited support bindings:

- `Admin Operations Advisor` -> `admin-audit-and-rbac-governance`, `auth-session-and-safety-boundaries`, `platform-observability-and-ops`
- `Database Schema & Migration Auditor` -> `database-migration-safety`, `backend-models-standards`, `reliability-and-state-integrity`
- `Mini-Program Parity Auditor` -> `platform-coordination-protocol`, `frontend-component-architecture`
- `Taro Mini-Program Frontend Engineer` -> `frontend-component-architecture`, `design-system-governance`, `joyjoin-brand-guidelines`, `platform-coordination-protocol`
- `Taro Migration Specialist` -> `platform-coordination-protocol`, `frontend-component-architecture`, `design-system-governance`
- `Expert React Frontend Engineer` -> `frontend-component-architecture`, `design-system-governance`, `frontend-performance-and-loading`, `joyjoin-brand-guidelines`, `platform-coordination-protocol`

Branding remains a skill boundary on the frontend agents through `design-system-governance` and `joyjoin-brand-guidelines`; there is no standalone branding agent in the current orchestration portfolio.

## Tooling sufficiency audit

`Sufficient` means the current tool surface supports the agent's stated responsibilities.

`Partial` means the current tool surface works for the core path, but an important part of the responsibility is weaker than it should be.

`Legacy` means the agent is powerful but still depends on older tool aliases or integration assumptions that should be normalized before deeper orchestration.

`Needs extension` means the current responsibilities depend on a capability that is not actually guaranteed by the current tool surface.

| Agent | Status | Notes | Recommended extension when needed |
|-------|--------|-------|-----------------------------------|
| `Researcher` | `sufficient` | Read, search, and web access are enough for repo-grounded kickoff research. | Add targeted MCP integrations only if external knowledge sources become deterministic dependencies. |
| `Planner` | `sufficient` | Read, search, and agent delegation are enough for approval-first planning. | Add deterministic plan persistence only if approved plans need stronger replay guarantees. |
| `Supervisor` | `sufficient` | Read, search, execute, and subagent delegation are enough for routing across the core graph, kickoff re-entry, and audited support lanes. | Add direct edit only if the supervisor is intentionally allowed to patch files itself. |
| `Auto-Eval` | `sufficient` | Deterministic evaluation only needs read, search, and execute. | None required. |
| `Product Manager` | `sufficient` | Repo artifact drafting is covered by read, search, and edit. | Add GitHub issue write integration only if issue authoring moves here. |
| `Backend Engineer` | `sufficient` | Normalized implementation surface matches the agent's job. | None required. |
| `AI Engineer` | `sufficient` | Server-side AI work is covered by normalized edit and execute tooling. | None required. |
| `QA Agent` | `partial` | Checklist and shell-driven validation are covered, but full journey execution is thin. | Add browser or Playwright-style E2E integration and stable test-environment helpers. |
| `Launch Readiness Agent` | `partial` | Local file and command review is covered, but release readiness also needs CI and observability context. | Add GitHub status-check access plus observability or deployment-surface reads. |
| `Admin Operations Advisor` | `partial` | Runbook triage is covered, but live incidents are weaker without logs and audit evidence. | Add observability access and a read-only audit-log or admin-ops API integration. |
| `Database Schema & Migration Auditor` | `sufficient` | Code-first migration work is covered. | Optional read-only schema introspection for live drift analysis. |
| `Mini-Program Parity Auditor` | `sufficient` | Read-only parity audits and build checks are supported. | Optional screenshot or image-diff tooling for visual parity. |
| `Taro Mini-Program Frontend Engineer` | `sufficient` | Taro implementation and delegated parity review are covered. | Optional visual-diff tooling for UI polish validation. |
| `Taro Migration Specialist` | `sufficient` | Migration work already has the right combination of edit, execute, and subagents. | Optional screenshot capture for source-versus-target visual comparison. |
| `Expert React Frontend Engineer` | `sufficient` | Browser-first frontend implementation is covered by the normalized tool surface. | Add explicit subagent support only if cross-platform coordination should originate directly from this agent. |
| `debug` | `sufficient` | Bug investigation and root-cause remediation are covered by the normalized tool surface. | Add explicit agent delegation or handoffs only if resolved root causes should route directly into owning specialists. |
| `principal SWE` | `sufficient` | Principal-level architecture guidance is covered by normalized repo inspection and command execution. | Add GitHub review or issue integrations only if this advisor should own those workflows directly. |
| `SE: Product Manager` | `sufficient` | Issue-ready product scoping is covered by normalized repo inspection and editing without requiring direct tracker mutation. | Add issue-tracker write integration only if this agent should create or update backlog records directly. |
| `prompt engineer` | `sufficient` | Prompt design and repo-resident prompt maintenance are covered by read, search, and edit capability. | Add execute capability only if prompt workflows need scripted validation or linting. |

## Validation expectations

- `npm run orchestration:validate` should pass after orchestration changes.
- `env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration-supervisor.mjs copilot-hook user-prompt-submit <<< '{"prompt":"Add a new API endpoint with caching"}'` should recommend `Researcher` -> `Planner` for a broad request.
- `node scripts/orchestration-supervisor.mjs workflow pull-request` should generate a workflow summary without failing.
- `node scripts/orchestration-supervisor.mjs tooling-report` should expose the current tooling sufficiency audit.
- `node scripts/auto-eval.mjs --mode manual-report` should continue to work, and `.github/orchestration.yaml` is now part of its syntax preflight.

## Next expansion points

The first likely follow-up remains an `End-to-End Test Coordinator` helper agent if richer QA orchestration becomes a frequent need.

After that, the most likely portfolio upgrades are not more handoffs first. They are better tooling:

- observability access for operations and launch agents
- explicit tracker or review integrations only when an advisory workflow truly needs direct external-system mutation
- visual-diff or browser automation for frontend and QA-focused agents