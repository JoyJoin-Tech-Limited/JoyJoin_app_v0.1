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

## Core rules

- Record only what happened in the current turn. Do not infer files changed, decisions made, or blockers from vague recollection.
- Use the last 5 turns by default unless the caller explicitly widens the window.
- Agent summaries must include what was delivered, what was learned, and 1-2 self-suggested improvements for the next turn.
- Supervisor reports must consolidate child summaries without rewriting their facts.
- Persist summaries only under `.git/.orchestration/`; never publish them to `repo-memory/`.
- If persistence is skipped or fails, say so explicitly instead of implying the summary was recorded.

## Shared schema

Every summary JSON object should include:

```json
{
  "schemaVersion": 1,
  "type": "agent_turn_summary",
  "agentName": "Backend Engineer",
  "parentAgent": "Supervisor",
  "focusWindowTurns": 5,
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
  "appliedFeedbackFrom": ["supervisor-report-4"]
}
```

Supervisor-only additions:

```json
{
  "type": "supervisor_turn_report",
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
  }
}
```

## Workflow

### Agent turn

1. Read `.git/.orchestration/context.json` when available.
2. Review your own recent summaries and any supervisor feedback addressed to your agent.
3. Do the work.
4. End with one compact summary JSON object.
5. If you have execute and are responsible for persistence, call the recorder. Otherwise return the JSON for the caller to record.

### Supervisor turn

1. Gather child summary JSON objects.
2. Persist any child summaries that were not already recorded.
3. Produce one consolidated supervisor report with key bullets, cross-agent insights, and categorized next steps.
4. Persist the supervisor report.
5. Use the last 5 reports and relevant child summaries to refine the next routing decision.

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

- [ ] Agent summaries are truthful to the current turn only.
- [ ] `nextTurnImprovements` contains 1-2 items, not a backlog dump.
- [ ] Supervisor reports cite child summary IDs instead of paraphrasing from memory.
- [ ] The default focus window is 5 turns unless explicitly overridden.
- [ ] `events.jsonl` stores full entries and `context.json` stores compact bounded projections.
- [ ] No turn-reporting data is published into `repo-memory/`.
