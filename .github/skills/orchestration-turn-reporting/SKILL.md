---
name: orchestration-turn-reporting
description: >
  Structured turn-end reporting and iterative improvement for JoyJoin's native
  agent orchestration. Use when adding or changing per-agent summary JSON,
  supervisor consolidation, last-5-turn feedback loops, or operational session
  log persistence under .git/.orchestration. Trigger phrases: turn-end summary,
  agent summary JSON, supervisor consolidation, last 5 turns, iterative
  improvement loop, record-summary.
---

# Purpose

This skill defines the shared turn-reporting contract for JoyJoin's custom-agent workflow.

Use it when a change affects:
- per-agent end-of-turn summaries
- supervisor turn-end consolidation
- iterative improvement based on recent summaries and supervisor feedback
- JSON schema or recorder behavior for `.git/.orchestration/context.json` and `.git/.orchestration/events.jsonl`

Keep this operational. These summaries are workflow state, not durable repo memory.

### Skills are not auto-updated from sessions

**Turn reports do not rewrite `.github/skills/`.** Iteration is **you** applying lessons: read the last summaries, improve the next turn, and—when something should become **durable repo guidance**—open a normal change to skills or `repo-memory/candidates/` per governance. Skill files are **contracts** that drive routing and CI validation. **Agents may propose** updates; **humans merge** after review per [`skill-authoring-governance`](../skill-authoring-governance/SKILL.md). **`Supervisor`** is forbidden from autonomously editing skills.

## Core rules

- Record only what happened in the current turn. Do not infer from vague recollection.
- Use the last 5 turns by default unless the caller widens the window.
- Agent summaries must include what was delivered, what was learned, and 1-2 self-suggested improvements.
- Supervisor reports must consolidate child summaries without rewriting their facts.
- Keep Supervisor's user-facing note aligned with persisted facts, but do not print canonical JSON in the note.
- Persist summaries only under `.git/.orchestration/`; never publish to `repo-memory/`.
- If persistence is skipped or fails, say so explicitly.

## Executive briefing (visible note — all agents)

Use this for the **human-facing** turn summary for **every** repo agent. **Plain language, no jargon**—confident and direct, like a product lead briefing a CEO.

**Structure** (bullets only under each heading):

1. **One-line header** — *What you need to know and what we're doing next.*
2. **Observation** — Facts and insights (one bullet = one idea; **scannable in under ~10 seconds**).
3. **Implication / Context** — Why each observation matters **now** (keep **one-to-one** with Observation rows).
4. **Next Step** — Clear action or decision that follows.

**Optional:** **Bottom Line:** one sentence — overall recommendation or outcome.

**Urgent items:** prefix **Observation** bullet with `! `.

**Sub-bullets:** only for short **options, risks, or trade-offs**—never for long explanation.

See [`references/utilization-and-mapping.md`](./references/utilization-and-mapping.md) for a worked example and briefing-to-JSON mapping.

### Machine layer

Continue to emit **`record-summary`** JSON (`done`, `learned`, `nextSteps`, `turnStatus`, optional **`utilization`**). Derive the briefing **from the same facts** as the JSON.

## Supervisor visible note (extends executive briefing)

The Supervisor uses **two surfaces**: canonical `supervisor_turn_report` JSON + presentation.

1. Use the **executive briefing** sections above as the main narrative.
2. **Immediately after the one-line header**, add **Turn status:** **Ready** \| **Blocked** \| **Done** — [one line why] (must match JSON `turnStatus`).
3. When **Ready**, add **after Bottom Line** a **Recommended Orchestration Strategy:** numbered list of **1–5 concrete next moves**. Each move is either **Single-agent:** `Agent — Skill(s) — Deliverable` or **Multi-agent:** `Coordination pattern → Deliverable` with sub-bullets naming each **Agent — Skill(s)** contribution.

   Supported patterns (from [`agent-coordination-patterns`](../agent-coordination-patterns/SKILL.md)): **Parallel**, **Sequential pipeline**, **Deliberation**, **Fan-out / Fan-in**, **Review loop**.

4. When **Done**, omit strategy or replace with "No further steps required." When **Blocked**, prioritize the unblock path and keep the strategy minimal.

- Avoid generic “Proceed” or “Continue” wording.
- Cross-reference the `utilization` ledger to avoid gaps.
- State **who depends on whom** when multiple agents are involved.

**Persist JSON before returning control**; include **`turnStatus`** and child **`sourceSummaryIds`**.

### Turn status

- `turnStatus`: `null` | `"ready"` | `"blocked"` | `"done"` (lowercase in JSON).
- When **`done`**, prefer empty `nextSteps` unless tracking follow-ups.
- The recorder may **warn** if `turnStatus` is `done` but `nextSteps` still contains items.

### Batching

- Prefer **one** turn with a **rich** summary over many tiny handoffs.
- **Supervisor** may consolidate multiple small child outcomes into **one** report.

## Shared schema

See [`references/schema-examples.md`](./references/schema-examples.md) for:
- Agent turn summary example with all standard fields
- Supervisor turn report example with Supervisor-only additions
- Harness metadata field reference table

See [`references/utilization-and-mapping.md`](./references/utilization-and-mapping.md) for utilization ledger format and briefing-to-JSON mapping.

## Workflow

See [`references/workflow.md`](./references/workflow.md) for step-by-step agent-turn and supervisor-turn workflows.

## Quick examples

- "Add a turn-end summary protocol for Supervisor and sub-agents" -> use this skill.
- "Persist agent summary JSON into `.git/.orchestration/events.jsonl`" -> use this skill.
- "Keep the improvement loop focused on the last 5 turns" -> use this skill.

## Troubleshooting

- Summary claims a file changed but no such file was touched: use recorded turn evidence or explicit file references from the current turn only.
- The supervisor report contradicts a child summary: treat the child JSON as authoritative unless it was invalid or unrecorded.
- The context window grows without bound: keep only compact last-5 projections in `context.json` and retain full history in `events.jsonl`.
- A non-execute agent cannot append to the session log: return valid JSON and let the caller or Supervisor broker persistence.

## Review checklist

- [ ] Visible note uses **executive briefing** (header, Observation, Implication / Context, Next Step, optional Bottom Line); Supervisor adds **Turn status** + **Recommended Orchestration Strategy** when needed.
- [ ] When work spans identifiable slices, **`utilization`** lists **task → agents → skills** (or explicitly note why it is empty).
- [ ] `turnStatus` set when recording JSON; visible note matches **Ready / Blocked / Done** (Supervisor).
- [ ] Agent summaries are truthful to the current turn only.
- [ ] `nextTurnImprovements` contains 1-2 items, not a backlog dump.
- [ ] Supervisor reports cite child summary IDs instead of paraphrasing from memory.
- [ ] The default focus window is 5 turns unless explicitly overridden.
- [ ] `events.jsonl` stores full entries and `context.json` stores compact bounded projections.
- [ ] No turn-reporting data is published into `repo-memory/`.
