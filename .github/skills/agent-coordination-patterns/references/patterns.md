# Coordination Patterns Reference

## Detailed Pipeline Examples

### Sequential Pipeline (A → B → C)

```
Researcher → "Find all auth middleware, route guards, and session handling"
  ↓
Planner → "Design fix plan with files, auth model, test strategy, acceptance criteria"
  ↓
Backend Engineer → "Implement the auth fixes"
  ↓
QA Agent → "Verify against acceptance criteria"
```

Rules:
- Pass a context capsule summarizing all prior outputs, not raw full output
- If an agent fails, decide: retry, reroute, or abort
- Keep each capsule under 400 words

### Parallel Swarm (A + B + C → Merge)

```
Explore(auth) + Explore(payments) + Explore(DB schema)
  ↓
Merge → "Unified plan"
```

Merge strategies:
- **Union** — concatenate all outputs
- **Intersection** — find common ground
- **Synthesis** — create new unified view
- **Voting** — majority wins for discrete choices

### Dependency Graph (A → B+C → D)

```
Planner → "Define API contract"
  ↓
[Backend Engineer + Frontend Engineer]
  ↓
QA Agent → "Verify integration"
```

Rules:
- Draw the dependency graph explicitly before spawning
- Name the merge gate
- No circular dependencies

## Swarm Configurations

**Fan-Out / Fan-In:**
```
Supervisor → 3 Explore agents → Convergence Agent → Final plan
```

- Fan-out agents should have identical interfaces (same input format, same output schema)
- Convergence agent must understand the merge strategy upfront
- If fan-out agents disagree on fundamentals, escalate to deliberation

**Hierarchical Fan-In (5+ agents):**
```
[Agent A, B, C] → Merger 1
[Agent D, E, F] → Merger 2
  ↓
[Merger 1, Merger 2] → Final Synthesizer
```

Never merge 6+ outputs in a single step — context explodes.

## Conflict Resolution Rules

When parallel agents produce incompatible outputs, follow the resolution ladder:

1. **Re-scope** — clarify boundaries and respawn with narrower scope
2. **Re-sequence** — make it sequential (A proposes, B critiques)
3. **Authority rule** — domain-owner agent wins (backend decision → Backend Engineer)
4. **Deliberation** — escalate to Deliberation Moderator for structured consensus
5. **Human decision** — present both options with trade-offs

**Rule:** Never silently pick one agent's output without documenting why.

## Load Balancing Specifics

- Cap parallel agents at 5 per merge step
- Use hierarchical fan-in for 6+ agents
- Summarize each agent output to ≤3 lines before merging
- Keep parent context lean — never accumulate raw outputs

## Coordination vs Deliberation Matrix

| Situation | Use Coordination | Use Deliberation |
|---|---|---|
| Agents agree on goal, disagree on method | ❌ | ✅ |
| Agents have independent, complementary scopes | ✅ | ❌ |
| Need to resolve fundamental architectural conflict | ❌ | ✅ |
| Need to parallelize implementation across domains | ✅ | ❌ |
| Need consensus before irreversible decision | ❌ | ✅ |
| Need fast parallel exploration of options | ✅ | ❌ |
| One agent's output violates another's constraints | ⚠️ Try coordination first | ✅ If coordination fails |

## Workload Partitioning Strategies

| Strategy | Use When | Example |
|----------|----------|---------|
| By domain | Clear workspace boundaries | Backend owns `apps/server/`, Frontend owns `apps/mini-program/` |
| By file | Non-overlapping file sets | Agent A edits `routes/auth.ts`, Agent B edits `routes/payments.ts` |
| By layer | Vertical slice ownership | Agent A owns API + DB, Agent B owns UI, Agent C owns tests |
| By phase | Temporal separation | Research → Design → Implement → Verify |
| By concern | Cross-cutting but separable | One agent handles correctness, another performance, another security |

Rules:
- Every partition must have a single owner — no shared ownership
- Define handoff contracts — what format Agent A delivers to Agent B
- If partitions aren't clean, prefer sequential over parallel
