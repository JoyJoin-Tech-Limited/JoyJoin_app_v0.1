# Context Capsule Templates

Copy-paste starting points for common subagent delegation scenarios.

---

## Template A: Bug investigation

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

---

## Template B: Feature implementation (coder subagent)

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

---

## Template C: Architecture exploration (plan subagent)

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

---

## Template D: Parallel explore swarm

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

---

## Template E: Resume continuation

```
Context capsule:
- Previous session summary: [2–3 sentences of what the resumed agent already did]
- New question/task: [the next step]
- Anything that changed since last session: [new decisions, new files found, etc.]

Your task:
Continue from where you left off. [specific instruction]
```

---

## Template F: Code review delegation

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
