---
description: JoyJoin multi-agent orchestration protocol — delivery lanes, handoff graph, turn reporting, Sprint Contracts, Harness tiers. Canonical source: .github/orchestration.yaml
globs: "**/*"
alwaysApply: true
---
# JoyJoin Multi-Agent Orchestration Protocol (OpenCode)

Canonical contract: `.github/orchestration.yaml`
Agent manifest: `.github/agents/manifest.json`
Agent source files: `.github/agents/*.agent.md`

## Delivery Lanes

| Lane | Trigger | Entry Agent(s) | Flow |
|------|---------|----------------|------|
| **Direct** | Bounded task, ≤1 workspace, clear scope | None (primary agent executes directly) | State goal → implement → verify |
| **Kickoff** | Broad, ambiguous, cross-workspace, or approval-first | `@researcher` → `@planner` (or `@supervisor` first to auto-sequence) | Research context → approval-first plan → specialist execution |
| **Harness** | Core engine, payment, auth, high blast radius, explicit harness request | `@supervisor` (routes to Harness Runtime Controller) | PGE → Council → Consensus → locked Sprint Contract → implement → evaluate |
| **Deliberation** | Cross-domain architecture, UX-heavy, multi-perspective needed | `@supervisor` (routes to Deliberation Moderator) | 5-phase: Alpha (Architect) → Beta (UX) → Gamma (Code Realist) → Roundtable → Consensus |
| **Operational** | Validation, release risk, dirty-worktree review | `@auto-eval`, `@qa-agent`, `@verifier` | Quality gate → verification → sign-off |

## Kickoff Lane (Researcher → Planner)

For broad or ambiguous work, always use the kickoff lane:
1. `@researcher` — Gather repo context, files, constraints. Produce a research brief.
2. `@planner` — Convert research into an approval-first execution plan with sequenced agents, dependencies, and model recommendation.
3. After plan approval → route to the first specialist.

## Planning Rules

- Every task starts with a planning check. Do not skip.
- For bounded work, a compact micro-plan is enough.
- For broad/ambiguous/cross-cutting work, use the kickoff lane.
- If staying in Direct delivery: state the goal, file/surface scope, and validation path before editing.

## Complete Handoff Graph

### Supervisor → Specialists (routing)
When acting as Supervisor, route to the correct specialist based on task domain:

| Trigger | Route To | Prompt |
|---------|----------|--------|
| Need more repo context | @researcher | "Rebuild the missing repo context, constraints, and ambiguities before execution continues." |
| Plan is stale or needs refresh | @planner | "Use the updated findings to refresh the approval-first execution plan with model recommendation." |
| Dirty-worktree quality gate needed | @auto-eval | "Run the deterministic dirty-worktree gate and report the exact fingerprint verdict." |
| Product scope is ambiguous | @product-manager | "Clarify scope, priorities, and acceptance boundaries." |
| Server/domain implementation | @backend-engineer | "Implement approved backend scope with domain layer, auth, and reliability boundaries." |
| LLM-backed features needed | @ai-engineer | "Implement AI-backed workflow with runtime safety, fallback, and observability." |
| Verification checklist needed | @qa-agent | "Turn implemented scope into a concrete verification checklist." |
| Skeptical completion audit | @verifier | "Challenge done-claims with skeptical checks, surface hidden gaps." |
| Launch readiness review | Launch Readiness Agent (manual) | "Assess release risk, operational readiness, and go/no-go confidence." |
| Bug investigation | @debug | "Investigate, reproduce, isolate root cause, implement narrowest safe fix." |
| Web UI work | @frontend-engineer | "Implement approved web UI changes with component quality and brand guardrails." |
| Mini-program UI work | @taro-engineer | "Implement approved Taro mini-program UX with native-quality discipline." |
| Taro migration/web→mini | Taro Migration Specialist (manual) | "Handle migration-specific mini-program architecture." |
| Cross-platform parity audit | Mini-Program Parity Auditor (manual) | "Check parity between web and mini-program, identify gaps." |
| Architecture advice | Principal Software Engineer (manual) | "Provide principal-level guidance on architecture tradeoffs." |
| Prompt design | Prompt Engineer (manual) | "Analyze, rewrite, or structure prompts for reliability." |
| Visual asset creation | Visual Designer (manual) | "Create Lovart AI design briefs for brand-aligned visual assets." |
| Multi-agent deliberation | Deliberation Moderator (manual) | "Run 5-phase deliberation for cross-domain decisions." |
| Harness deliberation | Harness Runtime Controller (manual) | "Run PGE → Council → Consensus pipeline for engineering quality." |
| Schema/migration review | Database Schema & Migration Auditor (manual) | "Review schema changes, migration safety, backfill plans." |
| Admin incident triage | Admin Operations Advisor (manual) | "Triage admin incidents, diagnose RBAC, guide refunds/bans." |
| Repo memory capture | Repo Memory Steward (manual) | "Draft memory candidates via npm run memory:draft-candidate." |
| Icebreaker auction work | Icebreaker Auction Phase Agent (manual) | "Review/extend auction phase: virtual coins, bidding, REST routes." |
| Icebreaker lie detective work | Lie Detective Icebreaker Agent (manual) | "Review/extend lie_detective: isLie secrecy, vote/reveal." |
| Icebreaker personality dice work | Personality Dice Icebreaker Agent (manual) | "Review/extend personality_dice: challenges, REST generate/complete." |
| Game design | Game Design Agent (manual) | "Compile IcebreakerRunPlan, psychological safety, energy arc." |
| Game development | Game Development Agent (manual) | "Bind plan segments to phase templates, implement phase views." |
| MiniScript stories | MiniScript Story Agent (manual) | "Shape 迷你剧本杀 JSON, style/genre enums, safety constraints." |

### Sprint Contract Protocol (Tier 2+)

1. Backend/AI/Frontend Engineer drafts Sprint Contract at `.git/.orchestration/sprints/sprint-contract.{taskId}.md`
2. Route to **@verifier** for contract review → ACK or REJECT (max 2 cycles)
3. If ACK → implement against locked contract
4. Route to **@qa-agent** for Sprint Evaluation → PASS/PARTIAL/FAIL
5. Any FAIL on required criterion → return to engineer (max 3 iterations)
6. PASS → route to **@auto-eval** for final dirty-worktree gate

### Harness Tier Classification

Before any file edits on non-trivial work, classify the task:
1. Run `node scripts/harness-auto-trigger.mjs --prompt="<request>" --proposed-files=<files>`
2. **Tier 1** (~$0, ≤50 lines, 1 workspace) → Direct delivery, no contract needed
3. **Tier 2** (~$0.50-$2, multi-file, auth, stateful) → Sprint Contract required before file edits
4. **Tier 3** (~$10-$25, core engine, payment, major refactor) → Harness Runtime Controller deliberation

### Turn Reporting

When acting as a repo agent, end turns with the **executive briefing** format:
1. Header (one line)
2. Turn status: Ready | Blocked | Done
3. Observation (facts, prefix with ! if urgent)
4. Implication / Context (why it matters)
5. Next Step or Routing (3-5 Role—action lines, pick one)

Full schema: `.github/skills/orchestration-turn-reporting/SKILL.md`

## Model Recommendation

When ready for execution, include a model recommendation:
- Recommended Model (from `.github/agents/MODEL_CATALOG.md`)
- Justification (complexity, scope, token load)
- Estimated Premium Request Cost

## Validation Checklist

Before considering work complete:
- [ ] Guardrails pass: `npm run guardrails`
- [ ] Type check: `npm run typecheck` (or workspace-specific)
- [ ] Tests pass: `npm run test -w <workspace>`
- [ ] Harness gate (Tier 2+): Sprint Contract evaluated and passed
- [ ] Auto-Eval gate: `node scripts/auto-eval.mjs --mode manual-report` — pass
- [ ] CI readiness: `node scripts/orchestration-supervisor.mjs validate` — pass
