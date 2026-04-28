# Pattern Templates

Copy-paste coordination blueprints for common multi-agent scenarios.

---

## Template 1: Research → Plan → Implement → Verify (Sequential)

```
Step 1 — Researcher
Prompt: "Find all auth middleware, route guards, and session handling in apps/server."
→ Returns: compact file list + findings summary

Step 2 — Planner (receives Researcher summary)
Prompt: "Context: auth gaps found in [summary]. Design a fix plan with:
- Files to change
- Auth model decision
- Test strategy
- Acceptance criteria"
→ Returns: approved execution plan

Step 3 — Backend Engineer (receives plan)
Prompt: "Context: approved plan [summary]. Implement the auth fixes."
→ Returns: implementation + self-evaluation

Step 4 — QA Agent (receives implementation summary)
Prompt: "Context: auth fixes implemented in [summary]. Verify against acceptance criteria."
→ Returns: PASS / PARTIAL / FAIL verdict
```

---

## Template 2: Explore Swarm → Synthesize (Parallel)

```
# Fan-out: launch 3 agents in parallel
Agent({ subagent_type: "explore", description: "Auth routes audit",
  prompt: "Find all /api/admin/* routes. Check if each has requireAdmin middleware." })

Agent({ subagent_type: "explore", description: "Payment routes audit",
  prompt: "Find all /api/payments/* routes. Check if each has auth + RBAC." })

Agent({ subagent_type: "explore", description: "Event routes audit",
  prompt: "Find all /api/events/* routes. Check if each has auth middleware." })

# Fan-in: synthesize findings
Agent({ subagent_type: "coder", description: "Synthesize audit results",
  prompt: "Context capsule:
- Auth routes audit found: [3-line summary]
- Payment routes audit found: [3-line summary]
- Event routes audit found: [3-line summary]

Task: Merge into a single prioritized gap list. Deduplicate. Flag highest-risk gaps." })
```

---

## Template 3: Dependency Graph (Backend + Frontend → Integration)

```
# Step 1: Contract definition (sequential)
Planner → "Define API contract for new feature X"
→ Output: Zod schema + route spec + mini-program screen contract

# Step 2: Parallel implementation (independent branches)
Agent({ subagent_type: "coder", description: "Backend implementation",
  prompt: "Context: API contract [summary]. Implement server routes and DB changes." })

Agent({ subagent_type: "coder", description: "Mini-program implementation",
  prompt: "Context: screen contract [summary]. Implement Taro page and API client." })

# Step 3: Integration verification (sequential, depends on both)
QA Agent → "Context: backend [summary] + frontend [summary]. Verify integration."
```

---

## Template 4: Fan-Out / Fan-In (Code Review)

```
# Fan-out: review N files in parallel (cap at 5)
For each file in changed_files[:5]:
  Agent({ subagent_type: "explore", description: f"Review {file}",
    prompt: f"Review {file} for: correctness, security, style." })

# Fan-in: synthesize
Agent({ subagent_type: "coder", description: "Synthesize reviews",
  prompt: "Merge all file reviews into one PR review. Organize by severity." })
```

---

## Template 5: Conflict Resolution Ladder

```
# Parallel proposals
Agent({ subagent_type: "coder", description: "Propose approach A",
  prompt: "Propose caching approach A: Redis with pub/sub." })

Agent({ subagent_type: "coder", description: "Propose approach B",
  prompt: "Propose caching approach B: in-memory with TTL." })

# Conflict detected: outputs are mutually exclusive
# Step 1: Re-sequence (sequential critique)
Verifier → "Context: approach A [summary] vs approach B [summary]. Critique both."

# Step 2: If still deadlocked
Deliberation Moderator → "Context: two incompatible caching approaches. Run 5-phase deliberation."
```

---

## Template 6: Hierarchical Fan-In (5+ Agents)

```
# Layer 1: 6 parallel agents → 2 intermediate mergers
[Agent A, B, C] → Merger 1
[Agent D, E, F] → Merger 2

# Layer 2: 2 mergers → Final synthesizer
[Merger 1, Merger 2] → Final Synthesizer

# Never merge 6 outputs in a single step — context explodes.
```
