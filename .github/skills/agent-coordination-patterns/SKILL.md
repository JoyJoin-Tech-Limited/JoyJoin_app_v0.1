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

Multi-agent work is not just "spawn many agents and hope." This skill provides
explicit patterns for designing workflows that converge on a balanced result.

## When to use this skill

- Planning how **2+ agents** should collaborate on a single task
- Deciding whether to go **parallel** or **sequential**
- Merging **conflicting outputs** from multiple agents
- Partitioning work so agents **don't collide** or duplicate
- Designing **interdependent workflows**

## When NOT to use this skill

- Single-agent tasks (direct delivery)
- Consensus through disagreement → `multi-agent-deliberation`
- Quality-gate deliberation → `harness-engineering-deliberation`
- Simple subagent delegation → `subagent-context-delegation`

## Pattern overview

See [`references/pattern-catalog.md`](./references/pattern-catalog.md) for detailed
descriptions of all 7 patterns.

| Pattern | Structure | Best for |
|---------|-----------|----------|
| Sequential Pipeline | A → B → C | Natural ordering and dependencies |
| Parallel Swarm | A + B + C → Merge | Independent sub-tasks |
| Dependency Graph | A → B+C → D | Mixed sequential/parallel |
| Fan-Out / Fan-In | Explore → Converge | Broad exploration before synthesis |
| Convergence | Build → Review → Refine | Iterative polish |
| Conflict Resolution | Re-scope → … → Human | Incompatible outputs |
| Workload Partitioning | By domain/file/layer/phase | Dividing work without collision |

**Key rules:** non-overlapping scope, merge strategy declared before spawning,
capsules under 400 words, parent stays lean, never leave outputs unmerged.

## Coordination vs Deliberation

| Situation | Coordination | Deliberation |
|---|---|---|
| Independent, complementary scopes | ✅ | ❌ |
| Fundamental architectural conflict | ❌ | ✅ |
| Parallelize across domains | ✅ | ❌ |
| Consensus before irreversible decision | ❌ | ✅ |
| Fast parallel exploration | ✅ | ❌ |

For detailed examples, templates, and conflict-resolution rules, see
[`references/patterns.md`](./references/patterns.md).

## Quick examples

- **Feature across server + mini-program** → sequential contract, parallel
  implementation, sequential integration.
- **Auth gap audit** → fan-out to explore agents, fan-in to synthesizer.
- **Conflicting proposals** → re-sequence into critique, escalate to deliberation.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Conflicting file edits | Overlapping scopes | Re-partition by file or domain; make sequential |
| Merge step overwhelmed | Too many parallel agents | Cap at 5; use hierarchical fan-in |
| Pipeline stalls | Agent failed silently | Add explicit failure handling: retry, skip, or abort |
| Convergence feels forced | Fundamental disagreement | Escalate to deliberation; don't force-merge |
| Parent context explodes | Raw outputs accumulated | Summarize each output to ≤3 lines before merge |
| Agents duplicate work | Ambiguous partition boundaries | Redraw partition map; add explicit ownership |

## Review checklist

- [ ] Coordination pattern is explicitly chosen
- [ ] Each agent has a non-overlapping scope or explicit dependency ordering
- [ ] Merge strategy is declared before spawning parallel agents
- [ ] Capsules are under 400 words per agent
- [ ] Parent session stays lean — outputs summarized before merging
- [ ] Conflict resolution ladder is known before conflicts arise
- [ ] Coordination vs deliberation distinction is clear
- [ ] If 5+ agents needed, hierarchical fan-in is used

## Related skills

- `subagent-context-delegation` — packaging context for each agent call
- `multi-agent-deliberation` — structured consensus when coordination fails
- `first-principles-velocity` — critical-path analysis and model-tier fit
- `orchestration-turn-reporting` — turn-end summaries and supervisor consolidation
