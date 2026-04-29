# Pattern Catalog

## Pattern 1: Sequential Pipeline (A → B → C)

Agents run one after another. Each receives the previous agent's output as its input.

```
Researcher → Planner → Backend Engineer → QA Agent
```

**Use when:** Each step genuinely depends on the previous step's output. The pipeline has natural ordering.

**Rules:**
- Pass a **context capsule** summarizing all prior outputs, not the raw full output.
- If an agent fails, the pipeline stops. Decide: retry, reroute, or abort.
- Keep each capsule under 400 words. If accumulated context exceeds this, extract a fresh summary before the next handoff.

**Anti-pattern:** Don't pipeline when steps are independent — that's sequential waste.

## Pattern 2: Parallel Swarm (A + B + C → Merge)

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

## Pattern 3: Dependency Graph (A → B+C → D)

A mix of sequential and parallel: some agents block others, some run concurrently.

```
Planner → [Backend Engineer + Frontend Engineer] → QA Agent
```

**Use when:** Some sub-tasks are independent but all must complete before the next phase.

**Rules:**
- Draw the dependency graph explicitly before spawning agents.
- Name the merge gate — which agent consolidates partial outputs.
- Do not allow circular dependencies.

## Pattern 4: Fan-Out / Fan-In (Explore → Converge)

A structured parallel swarm with a dedicated convergence agent.

```
Supervisor → 3 Explore agents → Convergence Agent → Final plan
```

**Use when:** You need broad exploration before synthesis.

**Rules:**
- Fan-out agents should have **identical interfaces** (same input format, same output schema).
- Convergence agent must understand the **merge strategy** upfront.
- If fan-out agents disagree on fundamentals, don't force convergence — escalate to deliberation.

## Pattern 5: Convergence (Iterative Refinement)

Repeated build → review → refine cycles until a quality gate is met.

```
Builder → Reviewer → [accept / revise] → Builder → Reviewer → ...
```

**Use when:** Quality is more important than speed and the task benefits from iterative polish.

**Rules:**
- Set a **max iteration cap** (typically 3) to prevent infinite loops.
- Reviewer must provide **actionable, specific feedback** — not vague direction.
- If the builder and reviewer deadlock, escalate to a third agent or human.

## Pattern 6: Conflict Resolution

When parallel agents produce incompatible outputs.

**Resolution ladder:**
1. **Re-scope** — clarify boundaries and respawn with narrower scope
2. **Re-sequence** — make the conflict sequential (A proposes, B critiques)
3. **Authority rule** — domain-owner agent wins (e.g., backend decision → Backend Engineer)
4. **Deliberation** — escalate to Deliberation Moderator for structured consensus
5. **Human decision** — present both options with trade-offs, ask user

**Rule:** Never silently pick one agent's output without documenting why.

## Pattern 7: Workload Partitioning

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
