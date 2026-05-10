# Discipline Workflows

Full OMO workflow patterns adapted for Kimi Code CLI. Each pattern uses the `Agent` tool with appropriate `subagent_type` and prompt templates.

## 1. Prometheus Planning Workflow

**When:** Starting any non-trivial task (Tier 2+), or when user asks for a plan.
**Agent:** `plan` subagent reading `.github/agents/prometheus.agent.md`

### Steps

1. Classify task scope using IntentGate:
   - `quick` (≤1 workspace, ≤3 files, clear spec) → skip Prometheus, Direct delivery
   - `standard` (multi-file, cross-workspace, needs sequencing) → run Prometheus
   - `deep` (architecture, core engine, high blast radius) → Prometheus + Momus + Metis

2. Spawn Prometheus subagent:
   ```
   Agent(subagent_type="plan",
         description="Prometheus plan generation",
         prompt="Read .github/agents/prometheus.agent.md. Analyze: {request}.
                 Generate plan following .sisyphus/plans/wire-3-tier-run-plans.md format.
                 Save to .sisyphus/plans/{slug}.md.
                 Include: TL;DR, Context, Work Objectives, Verification Strategy,
                 Execution Strategy with waves, TODOs with full specs,
                 Final Verification Wave, Commit Strategy, Success Criteria.")
   ```

3. For deep tasks, also spawn Momus + Metis in parallel:
   ```
   Agent(subagent_type="plan", description="Momus plan critic",
         prompt="Review .sisyphus/plans/{slug}.md...")
   Agent(subagent_type="plan", description="Metis plan consultant",
         prompt="Review wave sequencing and dependencies...")
   ```

4. Present plan to user. Wait for explicit approval before creating `boulder.json`.

## 2. Atlas Delegation Workflow

**When:** Plan is approved, or user says `resume boulder`.
**Agent:** Primary agent acts as Atlas.

### Steps

1. Read `.sisyphus/boulder.json`. If none exists, create it:
   ```json
   {
     "active_plan": ".sisyphus/plans/{slug}.md",
     "plan_name": "{slug}",
     "started_at": "{ISO-8601}",
     "session_ids": ["{current_session}"],
     "task_sessions": {},
     "completed_plans": [],
     "agent": "atlas"
   }
   ```

2. Read active plan. Find first unchecked task.

3. Check dependencies: all `Blocked By` tasks must be `completed`.

4. Determine parallel group: if task has `Can Run In Parallel: YES`, check if other tasks in same group are also ready.

5. Delegate to Sisyphus (single) or multiple Sisyphus agents (parallel):
   ```
   Agent(subagent_type="coder", description="Sisyphus task {N}",
         prompt="Execute task {N} from {plan_path}.
                 Read What to do, Must NOT do, Acceptance Criteria, QA Scenarios.
                 Record evidence. Return structured summary.")
   ```

6. On return: verify evidence, run quick validation, mark checkbox, update boulder state.

7. Repeat from step 2. If all tasks complete → run Oracle → delete boulder.json.

## 3. Sisyphus Execution Workflow

**When:** Atlas delegates a specific task.
**Agent:** `coder` subagent.

### Steps

1. Read task spec from plan: What to do, Must NOT do, Acceptance Criteria, QA Scenarios, References.

2. Load recommended skills from `.agents/skills/` (e.g., `server-domain-architecture`).

3. Implement changes within task boundaries. Do NOT touch files outside scope.

4. Self-verify BEFORE reporting:
   - Run typecheck if TypeScript files changed
   - Run relevant tests if test file exists
   - Run guardrails if cross-workspace

5. Save evidence to `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

6. Record learnings to `.sisyphus/notepads/{plan-name}/learnings.md`.

7. Return structured report:
   ```
   File Changes: [list]
   Acceptance Criteria: [PASS/FAIL per item]
   QA Evidence: [paths]
   Blockers: [none | description]
   ```

## 4. Oracle Verification Workflow

**When:** All tasks complete, or user requests audit.
**Agent:** `explore` subagent (read-only).

### Steps

1. Read plan end-to-end.

2. For each completed task:
   - Compare "What to do" against actual file changes (git diff or read files)
   - Verify acceptance criteria with evidence
   - Search for Must NOT Have violations (`grep` for forbidden patterns)

3. Check evidence files exist in `.sisyphus/evidence/`.

4. Return verdict:
   ```
   Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT

   Per-task detail:
   - Task 1: APPROVE — [evidence]
   - Task 2: REJECT — [violation at file:line]
   ```

## 5. Team Mode Emulation (Parallel Agents)

**When:** Multiple tasks in same wave have no inter-dependencies.

### Pattern

```
# Launch parallel agents
id1 = Agent(subagent_type="coder", run_in_background=true, ...task 1...)
id2 = Agent(subagent_type="coder", run_in_background=true, ...task 2...)
id3 = Agent(subagent_type="coder", run_in_background=true, ...task 3...)

# Poll for completion
while any incomplete:
  TaskOutput(id1, block=false)
  TaskOutput(id2, block=false)
  TaskOutput(id3, block=false)

# Verify all
Oracle audit on all completed tasks
```

**Limit:** Max 4 parallel background agents to avoid context overload.

## 6. Ralph Loop Pattern

**When:** Task appears complete but may have hidden gaps.

### Pattern

After Sisyphus reports completion, ask:
```
"Review your own work. Is this 100% done?
Check: (1) All acceptance criteria met, (2) No TODOs left, (3) Evidence saved,
(4) No edge cases missed, (5) No files left in dirty state.
If not 100%, continue. If 100%, confirm."
```

If gaps found → delegate follow-up to same Sisyphus agent (resume with task_id).

## 7. IntentGate Pre-Flight

**When:** Any user request arrives.

### Classification

| Intent | Pattern | Next Action |
|--------|---------|-------------|
| `research` | "how does X work", "investigate Y" | Kickoff lane: Researcher → Planner |
| `implement` | "add X", "build Y", "wire Z" | If Tier 1 → Direct; else Prometheus → Atlas → Sisyphus |
| `investigate` | "why is X broken", "debug Y" | Debug agent or Direct with systematic approach |
| `fix` | "fix X", "resolve Y" | Debug agent, then implement |
| `plan_only` | "plan X", "design Y" | Prometheus only, no execution |

### Quick Heuristic
- ≤50 lines, 1 file, no auth/state → Direct
- Multi-file, cross-workspace, or unclear scope → Prometheus
- Core engine, payment, auth → Prometheus + Harness deliberation
