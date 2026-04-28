---
name: subagent-context-delegation
description: >-
  Package and delegate context to Kimi Code subagents effectively. Use when spawning
  Agent tool calls to maximize subagent understanding, avoid cold-start penalties, and
  keep parent context lean. Covers context-summarization templates, parallel explore
  patterns, subagent resume/reuse, and parent-hygiene discipline. Trigger phrases:
  "launch a subagent", "delegate to explore", "resume this agent", "context too long",
  "parallel research", "subagent needs more context", "fork subagent workaround",
  "keep parent context lean", "batch explore agents".
---

# Subagent Context Delegation

Kimi Code subagents do **not** inherit parent context automatically. Each Agent call starts with only the `prompt` you provide. This skill prevents the two most common failures: (1) subagents missing critical background, and (2) parent sessions bloating into inefficiency.

---

## When to use this skill

- Spawning **any** `Agent` call where the subagent needs prior discussion or repo context
- Launching **multiple parallel explore agents** for cross-cutting research
- **Resuming** an existing subagent to continue accumulated work
- Parent context is growing large (>50 messages or >10 tool results) and you need to delegate
- Converting a single-threaded investigation into parallel sub-tasks

---

## Core patterns

### Pattern 1: Context capsule (default)

Before calling `Agent`, extract a **context capsule** — a compressed summary of everything the subagent needs. Pass it as the first block in `prompt`.

```
Context capsule:
- We are adding refund logic to the admin payment page.
- Files already identified: apps/admin-client/src/pages/Payments.tsx,
  apps/server/src/routes/admin/payments.ts.
- Decision: refunds are super_admin only; require audit log.
- Open question: should we add a refund reason dropdown?

Your task: [specific instruction]
```

**Rule of thumb:** If the capsule exceeds 400 words, you are delegating too much scope. Split into multiple subagents or reduce the mission.

### Pattern 2: Parallel explore swarm

For cross-cutting research, launch **2–4 explore agents concurrently** with non-overlapping scopes. Each gets its own focused capsule.

```
# Parent launches in parallel (no await between them):
Agent({ subagent_type: "explore", prompt: "Find all auth middleware..." })   # A
Agent({ subagent_type: "explore", prompt: "Find all payment routes..." })    # B
Agent({ subagent_type: "explore", prompt: "Find refund-related DB tables..." }) # C
```

**Rules:**
- Each prompt must be **self-contained** — do not assume shared context across agents.
- Use `description` (3–5 words) so you can tell them apart in logs.
- Default to `run_in_background=false` unless tasks are truly independent and you want to continue parent work while they run.

### Pattern 3: Resume instead of respawn

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

### Pattern 4: Parent context hygiene

The parent session is your cache. Keep it lean:

| Do | Don't |
|---|---|
| Delegate large file reads to explore agents | Read 20 files in the parent, then delegate |
| Summarize findings from subagents into 2–3 lines | Paste full subagent output into parent context |
| Use `subagent_type="explore"` for research | Use `subagent_type="coder"` for read-only work |
| Run independent tasks in parallel with `run_in_background=true` | Chain sequential tool calls that could be parallel |

**Heuristic:** If your parent session has more than 10 tool-use blocks, it's time to delegate the next phase.

---

## Subagent type selection

| Type | Use when | Context strategy |
|------|----------|------------------|
| `explore` | Read-only research, finding files, understanding modules | Short, focused scope; parallel-friendly |
| `coder` | Implementation, editing files, running commands | Full capsule + exact file paths + acceptance criteria |
| `plan` | Architecture planning before implementation | Broader capsule, but still <400 words; expect read-only output |

**Default:** `coder` when `subagent_type` is omitted. Prefer explicit typing for clarity.

---

## Quick examples

### Example: Investigate a bug across three domains

```
// Parent context: user reports "matching feels off"

// Launch parallel research
Agent({ subagent_type: "explore", description: "Explore matching logic",
  prompt: "Context: users report matching quality degraded since last deploy.\n" +
          "Task: Find the matching score calculation in apps/server/src/...\n" +
          "Return: file paths, key functions, and any recent changes." })

Agent({ subagent_type: "explore", description: "Explore venue assignment",
  prompt: "Context: users report matching quality degraded.\n" +
          "Task: Find venue-to-group assignment logic and check if recent changes affect chemistry scores.\n" +
          "Return: relevant files and logic summary." })

Agent({ subagent_type: "explore", description: "Explore feedback data",
  prompt: "Context: users report matching quality degraded.\n" +
          "Task: Find where post-event feedback is stored and whether there's a recent spike in negative matching ratings.\n" +
          "Return: table names, query patterns, and any obvious anomalies." })

// Parent receives three compact summaries, then decides next step.
```

### Example: Resume after partial work

```
// Step 1: discovery
const authAgent = Agent({ subagent_type: "explore", description: "Auth discovery",
  prompt: "Find all Express middleware that gates /api/admin/* routes." })
// Returns: agent_id = "auth-discovery-01"

// Step 2: deep dive on a specific finding
Agent({ resume: "auth-discovery-01", description: "Auth deep dive",
  prompt: "The previous search found requireAdmin middleware.\n" +
          "Now find every route file that imports it and verify none are missing the check." })
```

---

## Troubleshooting

**Subagent returns "I don't have enough context"**
→ Your capsule was incomplete. Include: (1) what the parent already knows, (2) what decision was already made, (3) the exact file paths or module names involved. Never assume the subagent saw your previous tool calls.

**Subagent repeats work the parent already did**
→ You forgot to summarize prior findings in the capsule. Extract key discoveries into the prompt before delegating.

**Parent context is huge and responses are slow**
→ You are doing too much in the parent. Offload file exploration to `explore` agents. Summarize their findings into 1–2 sentences before continuing.

**Parallel agents return conflicting information**
→ Their scopes overlapped or were ambiguous. Give each agent a distinct, non-overlapping boundary (e.g., one owns "auth middleware", another owns "route handlers").

**Resumed agent seems to have lost track**
→ The gap between resume calls was too large, or the new task is unrelated. If the topic shifted, spawn a fresh agent with a fresh capsule instead.

---

## Review checklist

Before spawning a subagent, verify:

- [ ] Context capsule includes all prior decisions and file paths the subagent needs
- [ ] Capsule is under 400 words; if longer, scope is too broad
- [ ] `subagent_type` is explicit (`explore`, `coder`, or `plan`)
- [ ] `description` is set (3–5 words) for log readability
- [ ] If resuming: the new task is a natural continuation of the previous one
- [ ] If parallel: each agent has a non-overlapping scope and self-contained prompt
- [ ] Parent is not hoarding work — large reads/research delegated to subagents
- [ ] Subagent output will be summarized before re-entering parent context

---

## Related files

- [`references/templates.md`](./references/templates.md) — copy-paste capsule templates for common delegation scenarios
- [`references/examples.md`](./references/examples.md) — extended real-world examples from the JoyJoin codebase
- [`.github/skills/first-principles-velocity`](../../skills/first-principles-velocity/SKILL.md) — model-tier routing: use cheap models for shallow work, strong models for irreducible complexity
