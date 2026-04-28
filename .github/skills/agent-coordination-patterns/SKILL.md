---
name: agent-coordination-patterns
description: >-
  Design multi-agent workflows: sequential pipelines, parallel swarms, dependency
  graphs, convergence, conflict resolution, and load balancing. Use when planning
  how 2+ agents should collaborate to produce a unified result. Covers partition
  strategies, merge patterns, race-condition guardrails, and when to switch from
  coordination to deliberation. Trigger phrases: coordinate agents, parallel agents,
  agent workflow, sequential pipeline, fan out fan in, merge agent outputs, resolve
  conflicts, partition work, agent dependency, multi-agent plan, orchestration pattern,
  load balance agents, converge results.
---

# Agent Coordination Patterns

Multi-agent work is not just "spawn many agents and hope." This skill provides explicit patterns for designing agent workflows that converge on a balanced, coherent result.

---

## When to use this skill

- Planning how **2+ agents** should collaborate on a single task or feature
- Deciding whether to go **parallel** (simultaneous) or **sequential** (pipelined)
- Merging **conflicting or divergent outputs** from multiple agents
- Partitioning a large task so agents **don't collide** or duplicate work
- Designing **interdependent workflows** where Agent B needs Agent A's output

## When NOT to use this skill

- Single-agent tasks (use direct delivery)
- Tasks requiring consensus through disagreement (use [`multi-agent-deliberation`](../../.github/skills/multi-agent-deliberation/SKILL.md))
- Quality-gate deliberation (use [`harness-engineering-deliberation`](../../.github/skills/harness-engineering-deliberation/SKILL.md))
- Simple subagent delegation with no interdependencies (use [`subagent-context-delegation`](../../.github/skills/subagent-context-delegation/SKILL.md))

---

## Pattern catalog

### Pattern 1: Sequential Pipeline (A → B → C)

Agents run one after another. Each receives the previous agent's output as its input.

```
Researcher → Planner → Backend Engineer → QA Agent
```

**Use when:** Each step genuinely depends on the previous step's output. The pipeline has natural ordering.

**Rules:**
- Pass a **context capsule** summarizing all prior outputs, not the raw full output.
- If an agent fails, the pipeline stops. Decide: retry, reroute, or abort.
- Keep each capsule under 400 words. If the accumulated context exceeds this, extract a fresh summary before the next handoff.

**Anti-pattern:** Don't pipeline when steps are independent — that's sequential waste.

---

### Pattern 2: Parallel Swarm (A + B + C → Merge)

Agents run simultaneously. Their outputs are merged into a single coherent result.

```
Explore(auth) + Explore(payments) + Explore(DB schema) → Merge → Unified plan
```

**Use when:** The sub-tasks are independent and their outputs can be combined.

**Rules:**
- Each agent gets a **non-overlapping, self-contained scope**.
- Use `run_in_background=true` for truly independent tasks.
- The merge step is **mandatory** — never leave parallel outputs unmerged.
- Merge strategies: union (concatenate), intersection (find common ground), synthesis (create new unified view), or voting (majority wins for discrete choices).

**Anti-pattern:** Parallel agents with overlapping scopes produce conflicting duplicates.

---

### Pattern 3: Dependency Graph (A → B+C → D)

A mix of sequential and parallel: some agents block others, some run concurrently.

```
Researcher → [Backend Engineer + Frontend Engineer] → QA Agent
```

**Use when:** There are clear dependencies but also parallelizable branches.

**Rules:**
- Draw the graph explicitly before spawning. Label each edge as "blocks" or "independent."
- The merge node (before D) must receive **synthesized output**, not raw dumps from B and C.
- If B and C produce conflicting implementations, the merge node resolves before D proceeds.

**Anti-pattern:** Implicit dependencies where B assumes C finished but they ran in parallel.

---

### Pattern 4: Fan-Out / Fan-In

One agent fans work out to many, then a single agent fans results back in.

```
Supervisor → [Agent 1] [Agent 2] [Agent 3] ... [Agent N] → Synthesizer
```

**Use when:** The task decomposes into many similar sub-tasks (e.g., audit N files, review N routes).

**Rules:**
- The fan-out agent defines the **uniform template** each worker receives.
- Cap at **5 parallel agents** to avoid context overload in the fan-in step.
- The fan-in agent (Synthesizer) must have the **merge strategy** defined in its prompt.

---

### Pattern 5: Convergence (Merging N Outputs)

How to combine outputs from multiple agents into one coherent result.

| Strategy | When to use | Example |
|----------|-------------|---------|
| **Union** | Outputs are additive, no overlap | Combine file lists from 3 explore agents |
| **Intersection** | Find common ground | 3 agents propose solutions; keep only elements all agree on |
| **Synthesis** | Create a new unified view | Merge backend + frontend + UX proposals into one architecture doc |
| **Voting** | Discrete choice, need decision | 3 agents vote on approach A vs B; majority wins |
| **Weighted** | Some agents are domain authorities | Backend Engineer's API opinion weights 2× over generalist |
| **Escalation** | Deadlock or high stakes | Route to human or Deliberation Moderator |

**Rules:**
- Always declare the merge strategy **before** spawning agents.
- If agents disagree fundamentally, don't force-merge — escalate to [`multi-agent-deliberation`](../../.github/skills/multi-agent-deliberation/SKILL.md).

---

### Pattern 6: Conflict Resolution

When parallel agents produce incompatible outputs.

**Detection signals:**
- Same file recommended for incompatible changes
- Opposite architectural recommendations
- One agent's output violates another's constraints

**Resolution ladder:**
1. **Re-scope** — clarify boundaries and respawn with narrower scope
2. **Re-sequence** — make the conflict sequential (A proposes, B critiques)
3. **Authority rule** — domain-owner agent wins (e.g., backend decision → Backend Engineer)
4. **Deliberation** — escalate to Deliberation Moderator for structured consensus
5. **Human decision** — present both options with trade-offs, ask user

**Rule:** Never silently pick one agent's output without documenting why.

---

### Pattern 7: Workload Partitioning

How to divide work so agents don't collide.

| Partition Strategy | Use When | Example |
|-------------------|----------|---------|
| **By domain** | Clear workspace boundaries | Backend Engineer owns `apps/server/`, Frontend Engineer owns `apps/mini-program/` |
| **By file** | Non-overlapping file sets | Agent A edits `routes/auth.ts`, Agent B edits `routes/payments.ts` |
| **By layer** | Vertical slice ownership | Agent A owns API + DB, Agent B owns UI, Agent C owns tests |
| **By phase** | Temporal separation | Research → Design → Implement → Verify |
| **By concern** | Cross-cutting but separable | One agent handles correctness, another handles performance, another handles security |

**Rules:**
- Every partition must have a **single owner** — no shared ownership.
- Define **handoff contracts** — what format Agent A delivers to Agent B.
- If partitions aren't clean, prefer **sequential** over parallel.

---

## Coordination vs Deliberation: Decision Matrix

| Situation | Use Coordination | Use Deliberation |
|---|---|---|
| Agents agree on goal, disagree on method | ❌ | ✅ |
| Agents have independent, complementary scopes | ✅ | ❌ |
| Need to resolve a fundamental architectural conflict | ❌ | ✅ |
| Need to parallelize implementation across domains | ✅ | ❌ |
| Need consensus before irreversible decision | ❌ | ✅ |
| Need fast parallel exploration of options | ✅ | ❌ |
| One agent's output violates another's constraints | ⚠️ Try coordination first | ✅ If coordination fails |

---

## Quick Examples

### Example: Build a feature across server + mini-program

```
# Step 1: Sequential — Planner defines contract
Planner → "Design API contract and mini-program screen contract"

# Step 2: Parallel — independent implementation
[Backend Engineer: implement API] + [Taro Mini-Program Frontend Engineer: implement screen]

# Step 3: Sequential — integration
QA Agent → "Verify API + screen integration against contract"
```

### Example: Audit codebase for auth gaps

```
# Fan-out
Supervisor → 3 Explore agents:
  - "Find all /api/admin/* routes missing requireAdmin"
  - "Find all /api/* routes missing any auth"
  - "Find all middleware that should enforce RBAC but doesn't"

# Fan-in — Synthesis merge
Synthesizer → "Merge findings into prioritized fix list, deduplicate, flag high-risk gaps"
```

### Example: Conflicting architecture proposals

```
# Parallel exploration
Backend Engineer → "Propose caching strategy A (Redis)"
Backend Engineer → "Propose caching strategy B (in-memory with TTL)"

# Conflict detected: incompatible approaches
# Resolution: Re-sequence → Backend Engineer proposes, Verifier critiques
# Or: Escalate → Deliberation Moderator with Alpha=scalability, Gamma=edge-cases
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Agents produce conflicting file edits | Overlapping scopes | Re-partition by file or domain; make sequential |
| Merge step is overwhelmed | Too many parallel agents | Cap at 5; use hierarchical fan-in (merge in rounds) |
| Pipeline stalls | Agent failed silently | Add explicit failure handling: retry, skip, or abort |
| Convergence feels forced | Fundamental disagreement | Escalate to deliberation; don't force-merge |
| Parent context explodes | Raw outputs accumulated | Summarize each agent output to ≤3 lines before merge |
| Agents duplicate work | Ambiguous partition boundaries | Redraw partition map; add explicit "you own X, not Y" |

---

## Review checklist

- [ ] The coordination pattern is explicitly chosen (pipeline / swarm / graph / fan-out)
- [ ] Each agent has a non-overlapping scope or explicit dependency ordering
- [ ] Merge strategy is declared before spawning parallel agents
- [ ] Capsules are under 400 words per agent
- [ ] Parent session stays lean — outputs summarized before merging
- [ ] Conflict resolution ladder is known before conflicts arise
- [ ] Coordination vs deliberation distinction is clear for the task at hand
- [ ] If 5+ agents needed, hierarchical fan-in is used instead of single merge

---

## Related skills

| Skill | Handoff point |
|-------|--------------|
| [`subagent-context-delegation`](../../.github/skills/subagent-context-delegation/SKILL.md) | How to package context for each individual agent call |
| [`multi-agent-deliberation`](../../.github/skills/multi-agent-deliberation/SKILL.md) | When coordination fails and structured consensus is needed |
| [`first-principles-velocity`](../../.github/skills/first-principles-velocity/SKILL.md) | Critical-path analysis, model-tier fit, and execution themes |
| [`orchestration-turn-reporting`](../../.github/skills/orchestration-turn-reporting/SKILL.md) | Turn-end summaries and supervisor consolidation |
