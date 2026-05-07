# Native Agent Orchestration

This document explains the native custom-agent orchestration layer for JoyJoin.

The machine-readable orchestration contract is `.github/orchestration.yaml`. The machine-readable agent inventory and subagent allowlists live in `.github/agents/manifest.json`. This guide is the human-readable companion for contributors.

## Related docs

- [`AI_TOOLING_UNIFIED_BRAIN.md`](./AI_TOOLING_UNIFIED_BRAIN.md) describes the shared Cursor / Copilot policy surface (skills, agents), MCP (Context7), and what stays IDE-specific.
- [`AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md) defines when to use direct delivery, the `Researcher` -> `Planner` kickoff lane (or **`Supervisor` first** to sequence that kickoff), and the operational review lane.
- [`ORCHESTRATION_GOVERNANCE.md`](./ORCHESTRATION_GOVERNANCE.md) defines how to change agents, skills, hooks, runtime scripts, and validation surfaces safely.
- [`../docs/ai-workflow-documentation-refresh.md`](../docs/ai-workflow-documentation-refresh.md) defines scope tiers, routing lanes for large refreshes, and **Workflow Governance Reviewer** vs full doc sync.
- [`../docs/ai-agent-harness-separation-strategy.md`](../docs/ai-agent-harness-separation-strategy.md) remains the source of truth for runtime product AI architecture and invariants.

## Execution discipline

Planning, kickoff, and routing should stay aligned with [`.github/skills/first-principles-velocity/SKILL.md`](./skills/first-principles-velocity/SKILL.md): mission and critical path, model-tier fit against [`.github/agents/MODEL_CATALOG.md`](./agents/MODEL_CATALOG.md), and the **five execution themes** (constraint-first design, end-to-end slice ownership, smallest validating proof, ruthless deletion or quarantine, direct escalation when blocked with evidence). That skill pairs with [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md) for structured turns and with [`.github/AI_WORKFLOW_POLICY.md`](./AI_WORKFLOW_POLICY.md) for delivery lanes and the planning check.

## Scope

Broad sessions now have a kickoff lane before the core handoff graph:

- `Researcher`
- `Planner`

Those kickoff agents gather verified repo context and turn it into an approval-first plan. **`Supervisor`** may be invoked **first** and will route `Researcher` then `Planner` when kickoff applies (`AI_WORKFLOW_POLICY.md`). `Supervisor` also remains the routing surface once execution is approved or when work needs midstream rerouting.

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

Supervisor also has a deliberately small native button set. It can send work back to `Researcher` or `Planner` when discovery or approval-first planning must reopen, route into `Auto-Eval` for the local quality gate, request focused verification from `QA Agent`, and open `debug` for root-cause investigation.

Broader routing into product, backend, AI, launch, frontend, parity, migration, or memory and governance lanes stays available through the visible routing note and manual agent selection instead of static Copilot buttons. The small native set is declared in the agent frontmatter and the orchestration contract so the buttons, docs, and machine-readable graph stay aligned without flooding the VS Code action row. Nested subagents are also intentionally enabled at the workspace level because `Taro Migration Specialist` and `Taro Mini-Program Frontend Engineer` both author second-level delegation for parity and sibling-platform review work.

## Threshold-guided routing

- `Minimal bounded addition` stays with the current owning specialist and skill boundary. No new lane is needed.
- `Bounded refactor` can stay in the current lane only while it remains inside one owning skill boundary and one validation path.
- `Higher-level frontend revamp` should reopen kickoff when scope is broad, then route to `Expert React Frontend Engineer`, `Taro Mini-Program Frontend Engineer`, `Mini-Program Parity Auditor`, or `Taro Migration Specialist` based on renderer and parity needs.
- `Higher-level backend revamp` should reopen kickoff when scope is broad, then route to `Backend Engineer`, `AI Engineer`, `QA Agent`, `Launch Readiness Agent`, or `Auto-Eval` as the approved work moves from implementation into verification and sign-off.
- When approved work crosses threshold midstream, `Supervisor` is the rerouting surface. If the new scope is still unclear, reopen `Researcher` or `Planner` instead of guessing.

## Runtime surfaces

- Agent inventory and subagent allowlists: `.github/agents/manifest.json`
- Copilot hooks: `.github/hooks/auto-eval.json` and `.github/hooks/orchestration.json`
- Local git hooks: `.githooks/pre-commit` and `.githooks/post-commit`
- Workspace settings: `.vscode/settings.json`
- GitHub workflow: `.github/workflows/orchestrate.yml`
- Runtime context: `.git/.orchestration/context.json`
- Runtime event log: `.git/.orchestration/events.jsonl`
- Promoted repo-memory index: `repo-memory/generated/promoted-index.json`

The runtime context also carries `sessionId` plus a bounded `turnSummaryState` working set:

- `recentAgentSummaries` stores compact per-agent projections for the last 5 summaries per agent.
- `recentSupervisorReports` stores compact consolidated turn reports for the last 5 turns.
- `events.jsonl` remains the full append-only operational log and now records explicit `agent-turn-summary` and `supervisor-turn-report` events.

The runtime context also carries a top-level advisory `memoryContext`. It records changed-file and prompt-based repo-memory hits when the generated promoted index is readable, and each hit now carries deterministic lifecycle signals. If a note is stale against the validation-age threshold or currently conflicted by workflow-relevant changed paths, the hook still surfaces it but adds explicit caution text instead of presenting it as clean guidance. This still does not turn `.git/.orchestration/` into durable memory storage.

## Local setup

Enable the repo-managed git hooks once per clone:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/post-commit
```

Useful commands:

```bash
npm run memory:validate
npm run memory:build-index
npm run orchestration:validate
npm run orchestration:tooling-report
node scripts/orchestration/orchestration-supervisor.mjs workflow pull-request
```

## Session kickoff flow

- `SessionStart` initializes the orchestration runtime, writes default kickoff state under `.git/.orchestration/context.json`, and builds advisory repo-memory context only from changed files under `.github/`, `scripts/`, and `repo-memory/`.
- `UserPromptSubmit` inspects the first broad prompt and recommends `Researcher` -> `Planner` when the request is multi-step, ambiguous, or cross-cutting.
- `UserPromptSubmit` also queries the promoted repo-memory index for meaningful prompts only, then surfaces a concise relevant-memory summary when useful hits exist.
- Custom agents emit explicit end-of-turn JSON summaries. Those summaries are persisted through `node scripts/orchestration/orchestration-supervisor.mjs record-summary` via stdin, `--json`, or `--file`, not inferred from hook telemetry.
- `Supervisor` consolidates child summaries into one canonical `supervisor_turn_report` JSON object with cross-agent insights, per-agent feedback, and categorized task recommendations.
- `Supervisor` returns a separate visible note using the **executive briefing** shape in [`.github/skills/orchestration-turn-reporting/SKILL.md`](./skills/orchestration-turn-reporting/SKILL.md): **Observation**, **Implication / Context**, **Next Step**, optional **Bottom Line**, plus **Turn status** and **Routing (pick one)** (typically 3–5 **Role — action** lines when Ready), per [`.github/agents/supervisor.agent.md`](./agents/supervisor.agent.md)—plain language for non-technical readers.
- `Researcher` returns a structured research brief.
- `Planner` turns that brief into an approval-first execution plan and ends execution-ready plans with a model recommendation based on complexity, scope, and token load.
- After approval, `Supervisor` or the named specialist carries execution forward.

This is a guidance-and-handoff layer, not a hidden auto-execution path. Hooks bootstrap the recommendation and advisory retrieval state, while explicit agent reporting and recorder acknowledgements remain the authoritative source for turn-end summaries. The Supervisor's visible note is presentation only; the recorder payload remains the authoritative stored summary.

## Core handoff graph

- `Auto-Eval` -> `Supervisor` when the user needs routing from dirty-worktree findings to the right specialist.
- `Auto-Eval` -> `Launch Readiness Agent` when the local gate passes but broader release risk still matters.
- `Product Manager` -> `Backend Engineer` or `AI Engineer` depending on the implementation lane.
- `Backend Engineer` -> `QA Agent` and `Auto-Eval` for verification and local quality sign-off.
- `AI Engineer` -> `QA Agent` and `Launch Readiness Agent` for verification and rollout risk review.
- `QA Agent` -> `Launch Readiness Agent` and `Auto-Eval` for release escalation and final local gate recheck.
- `Launch Readiness Agent` -> `Auto-Eval` or `Supervisor` depending on whether the next step is local sign-off or blocker routing.

## Supervisor routing exits

These native exits now cover kickoff re-entry, core execution or validation, and selected audited support lanes when approved work crosses a threshold.

- `Supervisor` -> `Researcher` when the current blocker exposes missing repo context or unresolved ambiguity.
- `Supervisor` -> `Planner` when the findings exist but the plan, sequencing, or approval boundary must be refreshed.
- `Supervisor` -> `Auto-Eval` when the immediate next step is the dirty-worktree gate, a manual rerun, or deterministic local sign-off.
- `Supervisor` -> `Product Manager` when product scope, acceptance criteria, or issue-ready framing must be refreshed before implementation continues.
- `Supervisor` -> `Backend Engineer` for approved backend implementation or bounded backend refactors in `apps/server`.
- `Supervisor` -> `AI Engineer` for approved runtime AI implementation that must stay inside the AI safety lane.
- `Supervisor` -> `QA Agent` when the next best move is flow-level verification or a regression checklist rather than more implementation.
- `Supervisor` -> `Launch Readiness Agent` when release risk or operational readiness becomes the next gating question.
- `Supervisor` -> `debug` for isolated bug investigation, failure reproduction, root-cause analysis, or the narrowest safe fix before another specialist takes over.
- `Supervisor` -> `Mini-Program Parity Auditor` for compare-only parity review or migration backlog work.
- `Supervisor` -> `Expert React Frontend Engineer` for web UI implementation in `apps/user-client`, including branding-sensitive UI work that should stay attached to frontend skills rather than a standalone branding agent.
- `Supervisor` -> `Taro Mini-Program Frontend Engineer` for direct Taro UI implementation or refinement in `apps/mini-program`.
- `Supervisor` -> `Taro Migration Specialist` for parity-first migration from `apps/user-client` into `apps/mini-program`.

The frontend and parity agents remain audited support lanes. Adding core execution exits for product, backend, AI, QA, launch, and Auto-Eval makes the native contract match the current routing rules; it does not promote the frontend support lanes into the default v1 graph.

## Why the broader portfolio is still linked

The current planning should cover other existing agents and skills when that linkage is relevant and helpful. In practice that means:

- every active agent is listed in `.github/orchestration.yaml`
- every active agent has explicit skill bindings, even if it is not in the v1 graph
- every active agent gets a tooling sufficiency assessment so future orchestration work starts from a clear baseline

This does not mean every agent should get native handoff buttons today.

It does mean the current planning now records how those agents fit the portfolio, what skills they rely on, and what capabilities would need to improve before they can participate more deeply.

## Skill bindings

**Canonical source:** per-agent lists are `skill_bindings` in [`.github/orchestration.yaml`](./orchestration.yaml) and the `skills` arrays in [`.github/agents/manifest.json`](./agents/manifest.json). The bullets below mirror the YAML (kept for quick reading; if they drift, trust the YAML).

Core orchestrated bindings:

- `Researcher` -> `orchestration-turn-reporting`, `first-principles-velocity`
- `Planner` -> `orchestration-turn-reporting`, `first-principles-velocity`
- `Supervisor` -> `orchestration-turn-reporting`, `first-principles-velocity`, `monorepo-workspace-governance`, `docs-sync`
- `Auto-Eval` -> `orchestration-turn-reporting`, `first-principles-velocity`, `code-review`, `monorepo-workspace-governance`
- `Product Manager` -> `orchestration-turn-reporting`, `first-principles-velocity`, `draft-prd`
- `Backend Engineer` -> `orchestration-turn-reporting`, `first-principles-velocity`, `server-domain-architecture`, `auth-session-and-safety-boundaries`, `reliability-and-state-integrity`
- `AI Engineer` -> `orchestration-turn-reporting`, `first-principles-velocity`, `llm-runtime-safety-and-integration`, `platform-observability-and-ops`
- `QA Agent` -> `orchestration-turn-reporting`, `first-principles-velocity`, `e2e-test-runner`, `testing-and-regression-guardrails`
- `Verifier` -> `orchestration-turn-reporting`, `first-principles-velocity`, `code-review`, `testing-and-regression-guardrails`
- `Launch Readiness Agent` -> `orchestration-turn-reporting`, `first-principles-velocity`, `security-scan`, `platform-observability-and-ops`, `code-review`

Useful audited support bindings:

- `Admin Operations Advisor` -> `admin-audit-and-rbac-governance`, `auth-session-and-safety-boundaries`, `platform-observability-and-ops`
- `Database Schema & Migration Auditor` -> `first-principles-velocity`, `database-migration-safety`, `backend-models-standards`, `reliability-and-state-integrity`
- `Mini-Program Parity Auditor` -> `orchestration-turn-reporting`, `first-principles-velocity`, `platform-coordination-protocol`, `frontend-component-architecture`
- `Taro Mini-Program Frontend Engineer` -> `orchestration-turn-reporting`, `first-principles-velocity`, `mini-program-frontend-excellence`, `frontend-component-architecture`, `design-system-governance`, `joyjoin-brand-guidelines`, `wow-elements`, `frontend-performance-and-loading`, `platform-coordination-protocol`
- `Taro Migration Specialist` -> `orchestration-turn-reporting`, `first-principles-velocity`, `platform-coordination-protocol`, `frontend-component-architecture`, `design-system-governance`
- `Expert React Frontend Engineer` -> `orchestration-turn-reporting`, `first-principles-velocity`, `frontend-component-architecture`, `design-system-governance`, `frontend-performance-and-loading`, `joyjoin-brand-guidelines`, `wow-elements`, `platform-coordination-protocol`
- `debug` -> `first-principles-velocity`, `testing-and-regression-guardrails`
- `Principal Software Engineer` -> `first-principles-velocity`, `code-review`, `reliability-and-state-integrity`, `monorepo-workspace-governance`
- `SE: Product Manager` -> `draft-prd`
- `Prompt Engineer` -> _(none — empty binding in YAML)_
- `Repo Memory Steward` -> `orchestration-turn-reporting`, `first-principles-velocity`, `docs-sync`
- `Workflow Governance Reviewer` -> `docs-sync`, `testing-and-regression-guardrails`

Branding and crafted interaction polish remain skill boundaries on the frontend agents through `design-system-governance`, `joyjoin-brand-guidelines`, and `wow-elements`; there is no standalone branding agent in the current orchestration portfolio.

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
| `debug` | `sufficient` | Bug investigation and root-cause remediation are covered by the normalized tool surface. | Supervisor can now route bug investigation into `debug`; add explicit debug-to-domain handoffs only if resolved root causes should route directly into owning specialists. |
| `Principal Software Engineer` | `sufficient` | Principal-level architecture guidance is covered by normalized repo inspection and command execution. | Add GitHub review or issue integrations only if this advisor should own those workflows directly. |
| `SE: Product Manager` | `sufficient` | Issue-ready product scoping is covered by normalized repo inspection and editing without requiring direct tracker mutation. | Add issue-tracker write integration only if this agent should create or update backlog records directly. |
| `Prompt Engineer` | `sufficient` | Prompt design and repo-resident prompt maintenance are covered by read, search, and edit capability. | Add execute capability only if prompt workflows need scripted validation or linting. |
| `Repo Memory Steward` | `sufficient` | Candidate drafting via `memory:draft-candidate`, `memory:query`, and `memory:validate` is covered by read, search, edit, and execute. | Add issue-tracker integration only if this agent should open GitHub issues from gaps automatically. |
| `Workflow Governance Reviewer` | `sufficient` | Proposal-only portfolio review, reviewer-packet drafting, and deterministic validation are covered by read, search, edit, and execute without expanding authority. | Add stronger reviewer-packet provenance only if support-lane evidence export becomes a real operational need. |

## Validation expectations

- `npm run memory:validate` and `npm run memory:build-index` should pass when repo-memory retrieval or publication behavior changes.
- `npm run orchestration:validate` should pass after orchestration changes.
- `node scripts/validate-skill-routing.mjs` and `node scripts/test-skill-routing.mjs` should pass when skill bindings, skill routing metadata, or advisory workflow skill references change.
- `env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration/orchestration-supervisor.mjs copilot-hook user-prompt-submit <<< '{"prompt":"Add a new API endpoint with caching"}'` should recommend `Researcher` -> `Planner` for a broad request.
- `env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration/orchestration-supervisor.mjs copilot-hook user-prompt-submit <<< '{"prompt":"Please explain separate durable memory from operational state for the orchestration runtime context."}'` should surface relevant repo memory without forcing a kickoff recommendation.
- `env ORCHESTRATION_DISABLE_RUNTIME_WRITES=1 node scripts/orchestration/orchestration-supervisor.mjs record-summary --json '{"type":"agent_turn_summary","agentName":"Supervisor","done":["Example"],"filesChanged":[],"decisions":[],"blockers":[],"learned":["Example"],"nextTurnImprovements":["Example improvement"],"nextSteps":{"bugFix":[],"enhancement":[],"validation":[]},"confidence":{"score":0.5,"reason":"example"},"unresolvedAssumptions":[]}'` should validate the summary payload without mutating runtime files.
- `node scripts/orchestration/orchestration-supervisor.mjs workflow pull-request` should generate a workflow summary without failing.
- `node scripts/orchestration/orchestration-supervisor.mjs tooling-report` should expose the current tooling sufficiency audit.
- `node scripts/auto-eval.mjs --mode manual-report` should continue to work, and `.github/orchestration.yaml` is now part of its syntax preflight.
- `npm run orchestration:validate` should fail if `.github/agents/manifest.json` drifts from agent frontmatter subagent allowlists, if `.vscode/settings.json` stops enabling authored nested delegation, or if orchestration skill references drift from active `.github/skills/` directories.

## Next expansion points

The first likely follow-up remains an `End-to-End Test Coordinator` helper agent if richer QA orchestration becomes a frequent need.

After that, the most likely portfolio upgrades are not more handoffs first. They are better tooling:

- observability access for operations and launch agents
- explicit tracker or review integrations only when an advisory workflow truly needs direct external-system mutation
- visual-diff or browser automation for frontend and QA-focused agents