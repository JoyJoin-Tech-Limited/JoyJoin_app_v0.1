# Agent Registry: OMO → Kimi Subagent Mapping

Canonical agent definitions live in `.github/agents/*.agent.md`. This file maps each OMO discipline agent to Kimi Code CLI `Agent` tool parameters.

## Primary Orchestrators

### Atlas (Work Manager)
```yaml
subagent_type: explore   # In bridge mode, primary agent plays Atlas (read/delegate)
description: "Atlas work manager — read plan and boulder state"
prompt_template: |
  You are Atlas. Read the plan at {plan_path} and boulder state at .sisyphus/boulder.json.
  Identify the next unchecked task. Return: task number, title, and whether it is blocked.
  Note: Canonical atlas.agent.md has edit tools; bridge mode keeps Atlas read-only
  for safety — edits are delegated to Sisyphus subagents.
```

### Prometheus (Plan Generator)
```yaml
subagent_type: plan
description: "Prometheus plan generator"
prompt_template: |
  You are Prometheus. Read your canonical definition at .github/agents/prometheus.agent.md.
  Analyze this request: {user_request}
  Generate a structured plan following the format in .sisyphus/plans/wire-3-tier-run-plans.md.
  Save to .sisyphus/plans/{slug}.md. Do NOT execute tasks.
```

## Task Workers

### Sisyphus (Task Worker)
```yaml
subagent_type: coder
description: "Sisyphus task worker"
prompt_template: |
  You are Sisyphus. Read your canonical definition at .github/agents/sisyphus.agent.md.
  Execute task {task_number} from plan {plan_path}.
  MUST read: What to do, Must NOT do, Acceptance Criteria, QA Scenarios.
  Record evidence to .sisyphus/evidence/task-{N}-{slug}.{ext}.
  Return: file changes summary, acceptance criteria PASS/FAIL, evidence paths.
```

## Review & Audit Agents

### Oracle (Compliance Auditor)
```yaml
subagent_type: explore   # read-only verification
description: "Oracle compliance audit"
prompt_template: |
  You are Oracle. Read your canonical definition at .github/agents/oracle.agent.md.
  Audit completed tasks in plan {plan_path}.
  For each task: verify What to do vs actual changes, check acceptance criteria,
  search for Must NOT Have violations. Report per-task APPROVE/REJECT.
```

### Momus (Plan Critic)
```yaml
subagent_type: plan
description: "Momus plan critic"
prompt_template: |
  You are Momus. Review plan at {plan_path}.
  Verify: referenced files exist, dependencies are valid, tasks are executable,
  QA scenarios are concrete. Report issues before execution begins.
```

### Metis (Plan Consultant)
```yaml
subagent_type: plan
description: "Metis plan structure review"
prompt_template: |
  You are Metis. Review plan structure, wave sequencing, and dependency graph.
  Suggest improvements for parallelization and ordering.
```

## Domain Specialists (from JoyJoin agent portfolio)

| Agent | subagent_type | Trigger Condition |
|-------|---------------|-------------------|
| backend-engineer | coder | Server routes, domain services, repositories |
| frontend-engineer | coder | Web UI work |
| taro-mini-program-frontend-engineer | coder | Mini-program Taro UI |
| ai-engineer | coder | LLM-backed features, prompts |
| researcher | explore | Repo context gathering, file discovery |
| verifier | explore | Skeptical completion audit |
| qa-agent | explore | Verification checklists, test gaps |
| debug | coder | Bug investigation and resolution |

## Model Recommendations

Per `.github/agents/MODEL_CATALOG.md`:
- **Orchestration** (Atlas, Prometheus): Use inherited model or Kimi K2.6
- **Deep work** (Sisyphus, Hephaestus): Use inherited model or GPT-5.5 equivalent
- **Exploration** (Oracle, Researcher): Use inherited model — exploration is cheap
- **Planning** (Momus, Metis): Use inherited model or fast model

## Handoff Patterns

### Standard flow
```
User request
  → IntentGate (classify)
  → Prometheus (plan)
  → Momus (review)
  → Atlas (delegate tasks)
    → Sisyphus (execute task N)
    → Sisyphus (execute task N+1)
  → Oracle (audit)
```

### Parallel Team Mode emulation
```
Atlas delegates 3-4 tasks simultaneously:
  Agent(task=1, run_in_background=true) → task_id_1
  Agent(task=2, run_in_background=true) → task_id_2
  Agent(task=3, run_in_background=true) → task_id_3
Poll TaskOutput for each. Verify with Oracle after all complete.
```
