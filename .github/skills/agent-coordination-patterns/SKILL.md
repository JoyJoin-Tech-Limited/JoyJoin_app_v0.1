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

## Pattern catalog

See [`references/pattern-catalog.md`](./references/pattern-catalog.md) for detailed descriptions of all 7 patterns:

| Pattern | Structure | Best for |
|---------|-----------|----------|
| **Sequential Pipeline** | A → B → C | Steps with natural ordering and genuine dependencies |
| **Parallel Swarm** | A + B + C → Merge | Independent sub-tasks with combinable outputs |
| **Dependency Graph** | A → B+C → D | Mixed sequential/parallel with explicit blocking |
| **Fan-Out / Fan-In** | Explore → Converge | Broad exploration before synthesis |
| **Convergence** | Build → Review → Refine | Quality-critical tasks needing iterative polish |
| **Conflict Resolution** | Re-scope → Re-sequence → Authority → Deliberation → Human | Incompatible outputs from parallel agents |
| **Workload Partitioning** | By domain / file / layer / phase / concern | Dividing work without collision |

**Key rules across all patterns:**
- Each agent gets a **non-overlapping scope** or explicit dependency ordering.
- Merge strategy is **declared before spawning** parallel agents.
- Context capsules stay **under 400 words** per agent.
- Parent session stays lean — outputs summarized before merging.
- Never leave parallel outputs unmerged.

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

## Quick Examples

### Build a feature across server + mini-program

```
# Step 1: Sequential — Planner defines contract
Planner → "Design API contract and mini-program screen contract"

# Step 2: Parallel — independent implementation
[Backend Engineer: implement API] + [Taro Mini-Program Frontend Engineer: implement screen]

# Step 3: Sequential — integration
QA Agent → "Verify API + screen integration against contract"
```

### Audit codebase for auth gaps

```
# Fan-out
Supervisor → 3 Explore agents:
  - "Find all /api/admin/* routes missing requireAdmin"
  - "Find all /api/* routes missing any auth"
  - "Find all middleware that should enforce RBAC but doesn't"

# Fan-in — Synthesis merge
Synthesizer → "Merge findings into prioritized fix list, deduplicate, flag high-risk gaps"
```

### Conflicting architecture proposals

```
# Parallel exploration
Backend Engineer → "Propose caching strategy A (Redis)"
Backend Engineer → "Propose caching strategy B (in-memory with TTL)"

# Conflict detected: incompatible approaches
# Resolution: Re-sequence → Backend Engineer proposes, Verifier critiques
# Or: Escalate → Deliberation Moderator with Alpha=scalability, Gamma=edge-cases
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Agents produce conflicting file edits | Overlapping scopes | Re-partition by file or domain; make sequential |
| Merge step is overwhelmed | Too many parallel agents | Cap at 5; use hierarchical fan-in (merge in rounds) |
| Pipeline stalls | Agent failed silently | Add explicit failure handling: retry, skip, or abort |
| Convergence feels forced | Fundamental disagreement | Escalate to deliberation; don't force-merge |
| Parent context explodes | Raw outputs accumulated | Summarize each agent output to ≤3 lines before merge |
| Agents duplicate work | Ambiguous partition boundaries | Redraw partition map; add explicit "you own X, not Y" |

## Review checklist

- [ ] The coordination pattern is explicitly chosen (pipeline / swarm / graph / fan-out)
- [ ] Each agent has a non-overlapping scope or explicit dependency ordering
- [ ] Merge strategy is declared before spawning parallel agents
- [ ] Capsules are under 400 words per agent
- [ ] Parent session stays lean — outputs summarized before merging
- [ ] Conflict resolution ladder is known before conflicts arise
- [ ] Coordination vs deliberation distinction is clear for the task at hand
- [ ] If 5+ agents needed, hierarchical fan-in is used instead of single merge

## Related skills

| Skill | Handoff point |
|-------|--------------|
| [`subagent-context-delegation`](../../.github/skills/subagent-context-delegation/SKILL.md) | How to package context for each individual agent call |
| [`multi-agent-deliberation`](../../.github/skills/multi-agent-deliberation/SKILL.md) | When coordination fails and structured consensus is needed |
| [`first-principles-velocity`](../../.github/skills/first-principles-velocity/SKILL.md) | Critical-path analysis, model-tier fit, and execution themes |
| [`orchestration-turn-reporting`](../../.github/skills/orchestration-turn-reporting/SKILL.md) | Turn-end summaries and supervisor consolidation |
