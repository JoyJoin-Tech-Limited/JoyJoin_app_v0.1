# Boulder Protocol

Manages Oh-My-OpenCode work session state in `.sisyphus/`. This is the canonical state machine for plan execution.

## Directory Structure

```
.sisyphus/
├── boulder.json              # Active session state
├── plans/
│   └── {slug}.md             # Prometheus-generated plans
├── evidence/
│   └── task-{N}-{slug}.{ext} # Per-task verification evidence
└── notepads/
    └── {plan-name}/
        └── learnings.md      # Sisyphus learnings across tasks
```

## boulder.json Schema

```json
{
  "active_plan": "string|null",       // Path to active plan file
  "plan_name": "string",              // Slug (e.g., "wire-3-tier-run-plans")
  "started_at": "ISO-8601",           // Session start timestamp
  "completed_at": "ISO-8601|null",    // Final completion timestamp
  "session_ids": ["string"],          // All Kimi session IDs involved
  "session_origins": {                // How each session started
    "session_id": "direct|delegated"
  },
  "task_sessions": {                  // Map of task_key → execution metadata
    "todo:1": {
      "task_key": "todo:1",
      "task_label": "1",
      "task_title": "Update type definition",
      "session_id": "string",
      "agent": "Sisyphus|Hephaestus|etc",
      "category": "quick|unspecified-high|deep",
      "status": "pending|in_progress|completed|blocked",
      "updated_at": "ISO-8601"
    }
  },
  "completed_plans": [
    {
      "plan": "string",
      "completed_at": "ISO-8601",
      "commits": ["string"]
    }
  ],
  "agent": "atlas"
}
```

## State Management Rules

1. **Create** `boulder.json` when Prometheus plan is approved and execution begins.
2. **Never overwrite** `session_ids` — always append new session IDs.
3. **Update** `task_sessions` when delegating to Sisyphus or when status changes.
4. **Mark checkboxes** in plan files (`- [x]`) as tasks complete — do not modify task specs.
5. **Delete** `boulder.json` only when plan is fully complete, merged, and Oracle approves.
6. **On resume**: Read existing `boulder.json`, find first task with status `pending` or `in_progress`, delegate.

## Plan File Format

See `.sisyphus/plans/wire-3-tier-run-plans.md` for a complete example. Required sections:

```markdown
# [Title]
## TL;DR
## Context
## Work Objectives
## Verification Strategy
## Execution Strategy (waves + dependency matrix)
## TODOs (each with [ ] checkbox, full spec)
## Final Verification Wave (F1-F4)
## Commit Strategy
## Success Criteria
```

Each TODO must include:
- **What to do** — concrete file paths and changes
- **Must NOT do** — guardrails and forbidden actions
- **Recommended Agent Profile** — category + skills
- **Parallelization** — Can Run In Parallel, Blocks, Blocked By
- **References** — exact file paths and line numbers
- **Acceptance Criteria** — testable checkboxes
- **QA Scenarios** — tool, steps, expected result, evidence path
- **Commit** — whether to commit and suggested message prefix

## Evidence Collection

Every task MUST produce evidence saved to `.sisyphus/evidence/`:

| Task Type | Evidence Format | Example |
|-----------|----------------|---------|
| Type check | `.txt` — terminal output | `task-1-typecheck.txt` |
| API test | `.json` — curl response | `task-4-start-breeze.json` |
| Build | `.txt` — build log | `task-6-build.txt` |
| Test run | `.txt` — test output | `task-7-tests.txt` |
| Audit | `.txt` — verdict report | `final-verification.txt` |

## Checkpoint Protocol

After every subagent returns:
1. Verify evidence file exists
2. Run quick validation (typecheck or relevant test)
3. Mark plan checkbox `- [x]`
4. Update `boulder.json` task status to `completed`
5. Decide next task based on dependency matrix
