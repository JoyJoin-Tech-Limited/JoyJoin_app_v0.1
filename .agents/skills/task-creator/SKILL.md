---
name: task-creator
description: Automatically structure and route every new task or feature request in the JoyJoin project. Use whenever the user asks to build, fix, add, change, refactor, investigate, implement, optimize, audit, or explore anything — no matter how vague or specific. Parses the goal into a one-sentence mission brief (dumb-CEO readable), maps affected areas, flags cross-platform concerns, surfaces blockers, and recommends the correct orchestration lane (Direct, Kickoff, Deliberation, Harness, or Operational).
---

# Task Polish & Route

Take the user's raw request and turn it into a crystal-clear mission brief with a lane recommendation. Write like you're explaining to a busy CEO who codes by vibe — no jargon, no fluff.

## Output Format

Always produce exactly this structure:

```
**Task:** [one-sentence mission]

**What you really want (fundamental intent):**
[Look past the surface request. What underlying need, pain, or outcome is driving this? State the deeper need in plain English.]

**Context:**
- Affected area: [icebreaker / pools / onboarding / payments / auth / matching / personality / admin / notifications / venues / semantic-matching / other / not sure yet]
- I expect to touch: [workspaces/files, or "not sure yet"]
- Sibling platform review needed? [yes / no / not sure]
- Upstream plan: [link or "none"]
- **Harness tier:** [1 / 2 / 3 / not sure yet]
  - Tier 1 = small, bounded, ≤50 lines, 1 workspace
  - Tier 2 = new route, multi-file, auth, stateful op, migration, UI flow
  - Tier 3 = core engine, payment, >5 core files, architectural boundary
- **Sprint Contract required?** [yes / no]

**Ripple effect (举一反三):**
[Look one step beyond the immediate fix. What adjacent areas should we also polish? If nothing obvious, say "No obvious ripples — fix is localized."]

**Blocker / question:**
[State the biggest unknown, risk, or dependency]

**Recommended lane:** [lane name]
**Why:** [one-line reason in plain English]
```

## Lane Selection Rules

| Lane | When to pick it | Plain-English test |
|------|----------------|-------------------|
| **Direct** | You know exactly what file to edit, the change is small, and nothing else breaks. | "Can I do this in one sitting without asking anyone?" |
| **Kickoff** | The request is vague, touches multiple apps/packages, or needs a plan before code. | "Do I need to figure out WHAT to build before I build it?" |
| **Deliberation** | The change crosses multiple domains, has high blast radius, or needs multiple perspectives. | "Could this blow up three different systems?" |
| **Harness** | Core engine changes (personality, matching, scoring), needs pre-validated quality. | "Is this the brain of the product?" |
| **Operational** | Validating, smoke-testing, release-checking, or reviewing a dirty worktree. | "Are we checking if it's safe to ship?" |

Every implementation task must run the **Harness Completion Gate** (`npm run harness:gate`) before claiming "done". Load the [`harness-completion-gate`](../harness-completion-gate/SKILL.md) skill for the full checklist.

## When to use this skill

- The user asks to build, fix, add, change, refactor, investigate, implement, optimize, audit, or explore anything
- A request is vague and needs scoping before writing code
- You need to recommend the correct orchestration lane
- A task touches multiple workspaces and you need to map affected areas and ripple effects

## Quick examples

- **Vague request:** "the matching feels off" → Produce mission brief, map to `matching` area, flag Kickoff lane, list ripple effects (scoring weights, venue assignment, feedback data), and identify the blocker ("define what 'feels off' means").
- **Specific request:** "add a refund button to admin" → Output one-sentence task, mark Direct lane, note affected areas (`payments / admin`), surface permission blocker, and list ripple effects (refund reasons, audit pattern, user notification).

## Troubleshooting

- **Lane recommendation feels wrong** → Re-read the lane selection rules; when uncertain between two lanes, state the tie-breaker explicitly.
- **Affected area is unclear** → Use the mapping cheat sheet in [`references/task-routing.md`](references/task-routing.md); if still unsure, say "not sure yet".
- **User request is already crystal clear** → Still run it through the format; it takes 5 seconds and prevents misalignment.
- **Sibling platform review flag is ambiguous** → Default to `yes` when the change touches shared packages, auth, payments, or onboarding.

## Review checklist

- [ ] Task is distilled into one sentence: `[Verb] [the noun] so that [the outcome]`
- [ ] Fundamental intent is stated in plain English
- [ ] Affected area, expected workspaces, and harness tier are identified
- [ ] Sibling platform review flag is set with justification
- [ ] At least one ripple effect or "no obvious ripples" is documented
- [ ] Biggest blocker or question is stated explicitly
- [ ] One lane is recommended with a one-line reason
- [ ] Harness Completion Gate is referenced for all implementation lanes

## References

- [`references/task-routing.md`](references/task-routing.md) — goal parsing guide, area mapping cheat sheet, cross-platform rules, and full examples
