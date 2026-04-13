# Native Agent Orchestration

This document explains the native custom-agent orchestration layer for JoyJoin.

The machine-readable source of truth is `.github/orchestration.yaml`. This guide is the human-readable companion for contributors.

## Scope

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

## Core handoff graph

- `Auto-Eval` -> `Supervisor` when the user needs routing from dirty-worktree findings to the right specialist.
- `Auto-Eval` -> `Launch Readiness Agent` when the local gate passes but broader release risk still matters.
- `Product Manager` -> `Backend Engineer` or `AI Engineer` depending on the implementation lane.
- `Backend Engineer` -> `QA Agent` and `Auto-Eval` for verification and local quality sign-off.
- `AI Engineer` -> `QA Agent` and `Launch Readiness Agent` for verification and rollout risk review.
- `QA Agent` -> `Launch Readiness Agent` and `Auto-Eval` for release escalation and final local gate recheck.
- `Launch Readiness Agent` -> `Auto-Eval` or `Supervisor` depending on whether the next step is local sign-off or blocker routing.

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

## Tooling sufficiency audit

`Sufficient` means the current tool surface supports the agent's stated responsibilities.

`Partial` means the current tool surface works for the core path, but an important part of the responsibility is weaker than it should be.

`Legacy` means the agent is powerful but still depends on older tool aliases or integration assumptions that should be normalized before deeper orchestration.

`Needs extension` means the current responsibilities depend on a capability that is not actually guaranteed by the current tool surface.

| Agent | Status | Notes | Recommended extension when needed |
|-------|--------|-------|-----------------------------------|
| `Supervisor` | `sufficient` | Read, search, execute, and subagent delegation are enough for routing. | Add direct edit only if the supervisor is intentionally allowed to patch files itself. |
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
| `Expert React Frontend Engineer` | `legacy` | Broad capability exists, but the tool namespace is legacy-shaped. | Normalize the tool surface and consider explicit subagent support if desired. |
| `debug` | `legacy` | Broad debugging power exists, but the tool namespace is legacy-shaped and not tightly linked to domain handoffs. | Normalize the tool surface and optionally add agent delegation or handoffs. |
| `principal SWE` | `legacy` | Strong advisory capability exists, but it depends on legacy aliases and implicit GitHub tooling. | Normalize tools and back GitHub workflows with explicit integrations. |
| `SE: Product Manager` | `needs-extension` | Its issue-authoring responsibility depends on GitHub issue write tools that are not part of the normalized core surface. | Add supported GitHub issue create and update integration. |
| `prompt engineer` | `partial` | Zero-tool prompt work is fine for pasted prompts, but weak for repo-resident prompt systems. | Add read, search, and edit if this agent should maintain repo prompts or skills directly. |

## Validation expectations

- `npm run orchestration:validate` should pass after orchestration changes.
- `node scripts/orchestration-supervisor.mjs workflow pull-request` should generate a workflow summary without failing.
- `node scripts/orchestration-supervisor.mjs tooling-report` should expose the current tooling sufficiency audit.
- `node scripts/auto-eval.mjs --mode manual-report` should continue to work, and `.github/orchestration.yaml` is now part of its syntax preflight.

## Next expansion points

The first likely follow-up remains an `End-to-End Test Coordinator` helper agent if richer QA orchestration becomes a frequent need.

After that, the most likely portfolio upgrades are not more handoffs first. They are better tooling:

- observability access for operations and launch agents
- GitHub issue and status integrations for legacy advisory agents
- visual-diff or browser automation for frontend and QA-focused agents