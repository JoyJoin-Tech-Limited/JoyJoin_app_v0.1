# Agent Definition Quality Rubric

Scoring guide for JoyJoin agent `.agent.md` files. Every agent should reach **Level 2 (Complete)** minimum. Core orchestration agents (Supervisor, Planner, Researcher, Verifier, Auto-Eval) should reach **Level 3 (Exemplary)**.

## Scoring Dimensions

| Dimension | Weight | What it checks |
|-----------|--------|----------------|
| Frontmatter completeness | 25% | name, description, tools, argument-hint, agents, handoffs, user-invocable |
| Constraints / error handling | 20% | DO NOT rules, failure modes, guardrails |
| Handoff logic | 20% | Handoff edges with label + agent + prompt, correct graph alignment |
| Trigger phrase quality | 15% | Specific, distinct, covers real user invocation patterns |
| Skill references | 10% | Correct paths, relevant skills, no broken references |
| Output format / turn-reporting | 10% | Structured deliverable spec, turn visible note, orchestration-turn-reporting integration |

## Quality Levels

### Level 3 — Exemplary (9.0+)
All frontmatter fields present. Explicit Constraints section with DO NOT rules. Multiple handoffs with agent + prompt. Harness Session Guard integration (implementation agents). Turn-reporting section references `orchestration-turn-reporting`. Structured output format. At least 50+ lines of body content.

**Example agents:** Harness Runtime Controller (9.5), QA Agent (9.4), Backend Engineer (9.3)

### Level 2 — Complete (7.5–8.9)
All frontmatter fields present. At least 1 handoff with agent + prompt. Turn-reporting section present (even if minimal). Has a Constraints section or error-handling guidance. 20+ lines of body content.

**Example agents:** Researcher (8.8), Product Manager (8.8), AI Engineer (8.5)

### Level 1 — Minimal (6.0–7.4)
Most frontmatter fields present but missing handoffs, user-invocable, or turn-reporting. No explicit Constraints section. Thin body content (<50 lines). Relies on implicit behavior rather than explicit rules.

**Example agents:** Frontend Engineer (6.5), debug (6.8), MiniScript Story Agent (5.0)

### Level 0 — Incomplete (<6.0)
Missing multiple required frontmatter fields. No Constraints section. No turn-reporting. Body content <30 lines. No structured output format.

**Example agents:** MiniScript Story Agent (5.0)

## Frontmatter Checklist

Every agent frontmatter must include:

```yaml
---
name: "Agent Display Name"           # REQUIRED: matches manifest.json
description: "..."                   # REQUIRED: includes trigger phrases
tools: [read, search, ...]          # REQUIRED: ordered by frequency
argument-hint: "..."                 # REQUIRED: describes expected input
agents: ["Subagent", ...]           # REQUIRED: allowed subagents (empty [] is OK)
handoffs:                           # REQUIRED: at least 1 handoff
  - label: "..."                    #     Handoff label (short)
    agent: "Target Agent"           #     Target agent name
    prompt: "..."                   #     Handoff prompt
user-invocable: true|false          # REQUIRED: can users invoke directly?
---
```

## Body Content Checklist

### For every agent
- [ ] Turning visible note section (references `orchestration-turn-reporting`)
- [ ] Constraints section (DO NOT rules)
- [ ] Workflow description (what steps does this agent follow?)
- [ ] Output format (structured deliverable + turn visible note)

### For implementation agents (Backend Engineer, Taro FE, Frontend Engineer, AI Engineer)
- [ ] Harness Session Guard integration (`harness-auto-trigger.mjs` classification)
- [ ] Sprint Contract lifecycle (draft → Verifier review → implement → QA evaluate)
- [ ] Domain skill mapping (which skill for which task type)

### For orchestration agents (Supervisor, Planner, Researcher, Verifier, Auto-Eval)
- [ ] Handoff edges to at least 3 other agents
- [ ] Error recovery path (what to do if routing fails)
- [ ] Model-tier recommendation guidance

### For specialist agents (icebreaker, game design, venues, etc.)
- [ ] Domain-specific skill references with correct paths
- [ ] Review checklist for output quality
- [ ] Cross-platform awareness (mini-program vs web)

## Audit Results (2026-04-28)

Benchmark: 32 agents scored against the 6-dimension rubric.

```
Level 3 (Exemplary):    5 agents (15.6%)
Level 2 (Complete):    16 agents (50.0%)
Level 1 (Minimal):      9 agents (28.1%)
Level 0 (Incomplete):   2 agents (6.3%)
```

### Top gaps by frequency
1. **user-invocable missing** — 22 agents
2. **handoffs missing** — 11 agents
3. **turn-reporting missing** — 5 agents

### Quickest wins for maximum score improvement
1. Add `user-invocable: true` to agents with clear trigger phrases (22 agents, 5 min)
2. Add `handoffs:` to agents with implicit downstream routing (11 agents, 15 min)
3. Add turn-reporting section to icebreaker agents + Visual Designer (5 agents, 10 min)

Estimated total: ~30 min to move 22 agents from Level 1 → Level 2.

## Change Log

| Date | Change |
|------|--------|
| 2026-04-28 | Initial rubric + audit results baseline |
