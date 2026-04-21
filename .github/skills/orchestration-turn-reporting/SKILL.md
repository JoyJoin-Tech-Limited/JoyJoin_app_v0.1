---
name: orchestration-turn-reporting
description: >-
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

**Turn reports do not rewrite `.github/skills/`.** Iteration is **you** (or an agent acting under review) applying lessons: read the last summaries, improve the next turn, and—when something should become **durable repo guidance**—open a normal change to skills or `repo-memory/candidates/` per governance. Hooks and `record-summary` **do not** silently edit skill files to “reflect behaviour.”

**Why not fully automate “agent writes skills” (e.g. like some external memory agents)?** Skill files are **contracts**: they drive routing, CI validation (`validate-skill-routing`, `orchestration:validate`), and contributor trust. Unsupervised edits risk **drift, bad triggers, and security-sensitive instructions** in-repo. **Agents may propose** skill or memory updates (draft text, candidate notes, proposals under `docs/proposals/`); **humans merge** after review per [`.github/skills/skill-authoring-governance/SKILL.md`](../skill-authoring-governance/SKILL.md). **`Supervisor`** is explicitly forbidden from autonomously editing skills (see [`.github/agents/supervisor.agent.md`](../../agents/supervisor.agent.md) constraints).

## Core rules

- Record only what happened in the current turn. Do not infer files changed, decisions made, or blockers from vague recollection.
- Use the last 5 turns by default unless the caller explicitly widens the window.
- Agent summaries must include what was delivered, what was learned, and 1-2 self-suggested improvements for the next turn.
- Supervisor reports must consolidate child summaries without rewriting their facts.
- Keep Supervisor's user-facing note aligned with the persisted facts, but do not print the canonical JSON in the note.
- Persist summaries only under `.git/.orchestration/`; never publish them to `repo-memory/`.
- If persistence is skipped or fails, say so explicitly instead of implying the summary was recorded.

## Executive briefing (visible note — all agents)

Use this for the **human-facing** turn summary for **every** repo agent (Backend Engineer, Researcher, Supervisor, etc.). **Plain language, no jargon**—confident and direct, like a product lead briefing a CEO.

**Structure** (bullets only under each heading):

1. **One-line header** — Answers: *What you need to know and what we're doing next.*

2. **Observation** — Facts and insights from this turn (one bullet = one idea; **scannable in under ~10 seconds**).
3. **Implication / Context** — Why each observation matters **now** (keep **one-to-one** order with Observation rows where possible).
4. **Next Step** — Clear action or decision that follows (aligned one-to-one where possible).

**Optional:** **Bottom Line:** one sentence — overall recommendation or outcome.

**Urgent items needing a decision:** prefix the **Observation** bullet with `! `.

**Sub-bullets:** only for short **options, risks, or trade-offs**—never for long explanation.

**Example:**

```text
What you need to know and what we're doing next.

Observation
- User asked for a timeline but scope is still incomplete.
- ! API rate limit warnings appeared twice this turn.
- Parsed and stored 12 new requirements successfully.

Implication / Context
- Timeline estimates would be unreliable without a fixed scope.
- May signal throttling risk if traffic grows.
- Gives a solid base for the next planning pass.

Next Step
- Ask for three missing scope pieces before estimating dates.
- Ask infra to watch the rate limit threshold.
- Run a dependency check on the new requirements next turn.

Bottom Line: Pause estimates until scope is firm; treat rate limits as a real risk.
```

### Machine layer (unchanged)

Continue to emit **`record-summary`** JSON (`done`, `learned`, `nextSteps`, `turnStatus`, optional **`utilization`**, …). Derive the briefing **from the same facts** as the JSON; do not contradict persisted fields.

### Mapping (authoring aid)

| Briefing section | Typical JSON sources |
| --- | --- |
| Observation | `done`, key `decisions`, `learned`, `filesChanged` (plain descriptions) |
| Implication / Context | `blockers`, `unresolvedAssumptions`, `confidence.reason`, cross-agent context |
| Next Step | `nextSteps` buckets, `nextTurnImprovements`, or narrative next actions |
| Bottom Line | One-line synthesis of confidence + blockers + priority |
| **Utilization** (optional heading in visible note) | Summarize **`utilization`** rows: which **tasks** used which **agents** and **skills**—supports gap analysis (missing skills, over-used agents) |

### Utilization ledger (optional JSON; recommended when reporting)

Include **`utilization`** on both `agent_turn_summary` and `supervisor_turn_report` when you can name how work broke down. This is **not** access control—only an honest ledger for analytics and **gap spotting** (e.g. “payment path touched but `payment-entitlement-authority` not listed”).

- **`utilization`:** array (max **30** rows per turn after normalization) of objects:
  - **`task`** — short label for the slice of work (e.g. “Pool API validation”, “Kickoff research brief”).
  - **`agents`** — JoyJoin agent names that **owned or executed** that slice this turn (e.g. `Backend Engineer`, `Researcher`). Use the names from [`.github/agents/manifest.json`](../../agents/manifest.json).
  - **`skills`** — repo skill ids from [`.github/skills/`](../) that were **actively applied** for that slice (e.g. `server-domain-architecture`, `first-principles-velocity`). Use **skill folder names**, not file paths.

**Supervisor:** When consolidating multiple children, either **merge** into one row per thematic task or **list** rows per child handoff—whichever makes gaps clearer. Prefer **skills** you know were co-loaded or decisive for the task, not every skill bound to the agent.

**Visible note:** Add a short **Utilization** subsection (bulleted table or compact list) when `utilization` is non-empty so humans see agent/skill coverage without opening JSON.

## Supervisor visible note (extends executive briefing)

The Supervisor still uses **two surfaces**: canonical `supervisor_turn_report` JSON + presentation.

1. Use the **executive briefing** sections above as the main narrative.
2. **Immediately after the one-line header**, add **Turn status:** **Ready** \| **Blocked** \| **Done** — [one line why] (must match JSON `turnStatus`).
3. When **multiple specialist routes** exist, add **after Bottom Line** a **Routing (pick one):** numbered list (**3–5** options when Ready), each line **Role — action** with optional **(suggested model: …)** for implementation work—same rules as [`.github/agents/supervisor.agent.md`](../../agents/supervisor.agent.md). Sub-bullets **only** for options or trade-offs.
4. When **Turn status: Done**, omit or shorten **Routing**. When **Blocked**, prioritize the unblock path in **Next Step** and keep Routing minimal.

- Avoid generic “Proceed” or “Continue” wording in the visible note or Routing list; use explicit specialist actions instead.

**Persist JSON before returning control**; include **`turnStatus`** and child **`sourceSummaryIds`** on supervisor reports.

### Turn status line templates (plain language)

Use these as patterns; keep each status line under **20 words**.

| Status | Template |
| --- | --- |
| **Ready** | `Turn status: Ready — [what is lined up next and why it is unblocked].` |
| **Blocked** | `Turn status: Blocked — [single clearest blocker; what input would unblock].` |
| **Done** | `Turn status: Done — [what completed; optional “no further steps”].` |

### JSON `turnStatus` (must match the visible line)

Optional on each payload; recommended for every recorded turn.

- `turnStatus`: `null` | `"ready"` | `"blocked"` | `"done"` (lowercase in JSON; matches the visible **Ready / Blocked / Done**).
- When `turnStatus` is **`done`**, prefer **empty** `nextSteps` buckets unless you intentionally track follow-ups outside this session.
- The recorder may **warn** (stderr) if `turnStatus` is `done` but `nextSteps` still contains items—clean up before recording when possible.

### Batching and routing churn

- Prefer **one** turn with a **rich** summary over many tiny handoffs when the same agent could complete the slice.
- **Supervisor** may consolidate multiple small child outcomes into **one** supervisor report for that routing episode.

## Shared schema

Every summary JSON object should include:

```json
{
  "schemaVersion": 1,
  "type": "agent_turn_summary",
  "agentName": "Backend Engineer",
  "parentAgent": "Supervisor",
  "focusWindowTurns": 5,
  "turnStatus": "ready",
  "done": ["Implemented record-summary command"],
  "filesChanged": ["scripts/orchestration-supervisor.mjs"],
  "decisions": ["Stored full events in events.jsonl and compact projections in context.json"],
  "blockers": [],
  "learned": ["PostToolUse does not expose truthful turn-end state"],
  "nextTurnImprovements": ["Trim validation output to only the changed surfaces"],
  "nextSteps": {
    "bugFix": [],
    "enhancement": ["Expand reporting to additional support agents"],
    "validation": ["Add sixth-turn truncation regression coverage"]
  },
  "confidence": {
    "score": 0.86,
    "reason": "Runtime recorder and bounded context state were both exercised"
  },
  "unresolvedAssumptions": ["Direct standalone non-execute agents still rely on caller-brokered persistence"],
  "appliedFeedbackFrom": ["supervisor-report-4"],
  "utilization": [
    {
      "task": "Implement record-summary path",
      "agents": ["Backend Engineer"],
      "skills": ["server-domain-architecture", "orchestration-turn-reporting"]
    }
  ]
}
```

Supervisor-only additions (also include `turnStatus` when recording):

```json
{
  "type": "supervisor_turn_report",
  "turnStatus": "ready",
  "keyBullets": [
    "Recorder path implemented and tested",
    "Every agent now follows the same turn-summary schema"
  ],
  "crossAgentInsights": [
    "Truthful summaries require explicit agent output plus recorder acknowledgement"
  ],
  "sourceSummaryIds": ["agent-summary-1", "agent-summary-2"],
  "feedbackByAgent": {
    "Researcher": ["Tighten file scope before handing off"],
    "Supervisor": ["Prefer recorded child JSON over prose paraphrase"]
  },
  "utilization": [
    {
      "task": "Kickoff research and plan",
      "agents": ["Researcher", "Planner"],
      "skills": ["orchestration-turn-reporting", "first-principles-velocity", "draft-prd"]
    },
    {
      "task": "Route to backend implementation",
      "agents": ["Backend Engineer"],
      "skills": ["server-domain-architecture"]
    }
  ]
}
```

## Workflow

### Agent turn

1. Read `.git/.orchestration/context.json` when available.
2. Review your own recent summaries and any supervisor feedback addressed to your agent.
3. Do the work.
4. End with one compact summary JSON object **and** a visible note in **executive briefing** format (above).
5. If you have execute and are responsible for persistence, call the recorder **before** handing back. Otherwise return the JSON for the caller to record.

### Supervisor turn

1. Gather child summary JSON objects.
2. Persist any child summaries that were not already recorded.
3. Build one canonical `supervisor_turn_report` JSON object with key bullets, cross-agent insights, and categorized next steps.
4. Persist the supervisor report.
5. Return the visible note: **executive briefing** + **Turn status** + **Routing (pick one)** when applicable.
6. Use the last 5 reports and relevant child summaries to refine the next routing decision.

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

- [ ] Visible note uses **executive briefing** (header, Observation, Implication / Context, Next Step, optional Bottom Line); Supervisor adds **Turn status** + **Routing** when needed.
- [ ] When work spans identifiable slices, **`utilization`** lists **task → agents → skills** (or explicitly note why it is empty).
- [ ] `turnStatus` set when recording JSON; visible note matches **Ready / Blocked / Done** (Supervisor).
- [ ] Agent summaries are truthful to the current turn only.
- [ ] `nextTurnImprovements` contains 1-2 items, not a backlog dump.
- [ ] Supervisor reports cite child summary IDs instead of paraphrasing from memory.
- [ ] The default focus window is 5 turns unless explicitly overridden.
- [ ] `events.jsonl` stores full entries and `context.json` stores compact bounded projections.
- [ ] No turn-reporting data is published into `repo-memory/`.
