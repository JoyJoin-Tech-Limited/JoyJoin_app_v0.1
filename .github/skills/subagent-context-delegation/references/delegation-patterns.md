# Delegation Patterns Reference

## Context capsule templates

### Template A: Bug investigation

```
Context capsule:
- Bug report: [one-sentence symptom]
- Affected surface: [mini-program / admin / server / shared]
- Files already checked: [list any files you already looked at]
- Error message (if any): [paste exact error or "none visible"]
- Reproduction steps known: [yes/no — if yes, summarize]

Your task:
[specific instruction: find root cause, find all call sites, propose fix, etc.]

Return format:
- Root cause (if found)
- Key file paths
- Recommended next step
```

### Template B: Feature implementation (coder subagent)

```
Context capsule:
- Feature: [one-sentence description]
- Product decision already made: [any decisions from PRD or discussion]
- Files to touch: [exact file paths, or "find the right files"]
- API contract (if any): [Zod schema, route path, or "to be defined"]
- Tests required: [yes/no, and where they belong]
- Out of scope: [what this subagent should NOT touch]

Your task:
[Implement X / Add Y / Refactor Z with specific acceptance criteria]

Constraints:
- Follow existing code style in the touched files
- Do not change unrelated files
- If blocked, report the blocker rather than guessing
```

### Template C: Architecture exploration (plan subagent)

```
Context capsule:
- Problem: [what we are trying to solve]
- Constraints: [hard constraints: existing DB schema, auth model, deployment topology]
- Options already considered: [briefly list and why they were rejected, if any]
- Success criteria: [what "done" looks like]

Your task:
Propose an architecture/plan for [specific scope]. Consider trade-offs.

Return format:
- Recommended approach
- Alternative considered
- Files/modules that would change
- Risk assessment
```

### Template D: Parallel explore swarm

Use this structure for each parallel agent. Vary only the scope line.

```
Context capsule:
- Parent mission: [the overall goal]
- Your scope: [specific slice — e.g., "auth middleware only", "DB schema only"]
- What others are checking: [briefly mention parallel scopes so the agent knows what's covered]

Your task:
Research [scope] thoroughly. Return a compact summary:
- Key files found
- Important findings
- Any red flags or blockers
```

### Template E: Resume continuation

```
Context capsule:
- Previous session summary: [2–3 sentences of what the resumed agent already did]
- New question/task: [the next step]
- Anything that changed since last session: [new decisions, new files found, etc.]

Your task:
Continue from where you left off. [specific instruction]
```

### Template F: Code review delegation

```
Context capsule:
- PR purpose: [one sentence]
- Files changed: [list from git diff]
- Author's stated approach: [if known]
- Known risk areas: [auth, payments, DB migrations, etc.]

Your task:
Review the changes for [correctness / security / performance / architecture fit].
Focus on [specific area]. Do not review [out-of-scope area].

Return format:
- Issues found (severity: blocking / warning / suggestion)
- Key files to examine more closely
- Verdict: approve / request changes / needs discussion
```

## Subagent resume rules

When a subagent has done useful work, **resume it** rather than creating a new instance. This preserves its accumulated context and avoids repeating discovery.

```
// First call — returns agent_id "explore-auth-01"
Agent({ subagent_type: "explore", prompt: "Find auth patterns..." })

// Later — continue with the same agent
Agent({ resume: "explore-auth-01", prompt: "Now find where session expiry is handled..." })
```

**Rules:**
- Only resume when the new task is a **natural continuation** of the previous one.
- If the topic has changed significantly, spawn a fresh agent with a fresh capsule.
- There is no hard limit on resume count, but if the subagent context grows too large, consider extracting its findings and spawning fresh.

## Parent-hygiene discipline

The parent session is your cache. Keep it lean:

| Do | Don't |
|---|---|
| Delegate large file reads to explore agents | Read 20 files in the parent, then delegate |
| Summarize findings from subagents into 2–3 lines | Paste full subagent output into parent context |
| Use `subagent_type="explore"` for research | Use `subagent_type="coder"` for read-only work |
| Run independent tasks in parallel with `run_in_background=true` | Chain sequential tool calls that could be parallel |

**Heuristic:** If your parent session has more than 10 tool-use blocks, it's time to delegate the next phase.

## Batch explore examples

### Example: Investigate a bug across three domains

**Parent context:** user reports "matching feels off"

**Launch parallel research:**

1. **Agent A** — `explore` — "Find all auth middleware..."
   ```
   Context: users report matching quality degraded since last deploy.
   Task: Find the matching score calculation in apps/server/src/...
   Return: file paths, key functions, and any recent changes.
   ```

2. **Agent B** — `explore` — "Find venue assignment logic"
   ```
   Context: users report matching quality degraded.
   Task: Find venue-to-group assignment logic and check if recent changes affect chemistry scores.
   Return: relevant files and logic summary.
   ```

3. **Agent C** — `explore` — "Find feedback data"
   ```
   Context: users report matching quality degraded.
   Task: Find where post-event feedback is stored and whether there's a recent spike in negative matching ratings.
   Return: table names, query patterns, and any obvious anomalies.
   ```

**Parent receives three compact summaries, then decides next step.**

### Example: Resume after partial work

**Step 1: discovery**
```
Agent({ subagent_type: "explore", description: "Schema discovery",
  prompt: "Find all tables related to event pools, registrations, and matching in the Drizzle schema." })
// Returns agent_id "schema-disc-01"
```

**Step 2: deep dive on a specific finding**
```
Agent({ resume: "schema-disc-01", description: "Registration table deep dive",
  prompt: "From your previous search, focus on the pool_registrations table.\n" +
          "Find: all columns, indexes, foreign keys, and any triggers.\n" +
          "Also check if there's a status enum and what values it permits." })
```

**Step 3: Fresh agent for implementation (not a resume — topic changed)**
```
Agent({ subagent_type: "coder", description: "Add registration status",
  prompt: "Context capsule:\n" +
          "- We need to add a 'waitlisted' status to pool registrations.\n" +
          "- Table: pool_registrations (found in previous exploration).\n" +
          "- Current statuses: pending, confirmed, cancelled.\n" +
          "- Must not break existing queries that filter by status.\n" +
          "- Add migration-safe change only.\n\n" +
          "Task: Update the enum/schema and any affected queries." })
```

## Subagent type selection

| Type | Use when | Context strategy |
|------|----------|------------------|
| `explore` | Read-only research, finding files, understanding modules | Short, focused scope; parallel-friendly |
| `coder` | Implementation, editing files, running commands | Full capsule + exact file paths + acceptance criteria |
| `plan` | Architecture planning before implementation | Broader capsule, but still <400 words; expect read-only output |

**Default:** `coder` when `subagent_type` is omitted. Prefer explicit typing for clarity.
