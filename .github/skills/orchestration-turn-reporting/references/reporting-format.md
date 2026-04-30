# Turn Reporting Format Reference

## Full JSON schema examples

### Agent turn summary

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
  ],
  "harness": {
    "tier": 2,
    "sprintContractId": "sprint_20260423_abc123",
    "contractStatus": "accepted",
    "qaIterations": 1,
    "verdict": "PASS",
    "pillarScores": {
      "reliability": 4,
      "scalability": 3,
      "security": 5,
      "observability": 4,
      "maintainability": 4
    }
  }
}
```

### Supervisor turn report

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
  ],
  "harness": {
    "tier": 2,
    "sprintContractId": "sprint_20260423_abc123",
    "contractStatus": "accepted",
    "qaIterations": 1,
    "verdict": "PASS",
    "pillarScores": {
      "reliability": 4,
      "scalability": 3,
      "security": 5,
      "observability": 4,
      "maintainability": 4
    }
  }
}
```

## Harness metadata fields

| Field | Type | Description |
|-------|------|-------------|
| `harness.tier` | `1 \| 2 \| 3` | Harness tier for this task |
| `harness.sprintContractId` | `string` | ID of the active Sprint Contract |
| `harness.contractStatus` | `"draft" \| "proposed" \| "accepted" \| "rejected"` | Current contract state |
| `harness.qaIterations` | `number` | Number of QA evaluation cycles |
| `harness.verdict` | `"PASS" \| "FAIL" \| "CONCERN" \| null` | Final or current Sprint Evaluation verdict |
| `harness.pillarScores` | `object` | Per-pillar scores (1–5) from scorecard |

## Utilization ledger

Include **`utilization`** on both `agent_turn_summary` and `supervisor_turn_report` when you can name how work broke down.

- **`utilization`:** array (max **30** rows per turn after normalization) of objects:
  - **`task`** — short label for the slice of work (e.g. "Pool API validation").
  - **`agents`** — JoyJoin agent names that **owned or executed** that slice this turn (e.g. `Backend Engineer`, `Researcher`). Use the names from [`.github/agents/manifest.json`](../../agents/manifest.json).
  - **`skills`** — repo skill ids from [`.github/skills/`](../) that were **actively applied** for that slice (e.g. `server-domain-architecture`, `first-principles-velocity`). Use **skill folder names**, not file paths.

**Supervisor:** When consolidating multiple children, either **merge** into one row per thematic task or **list** rows per child handoff—whichever makes gaps clearer. Prefer **skills** you know were co-loaded or decisive for the task, not every skill bound to the agent.

**Visible note:** Add a short **Utilization** subsection (bulleted table or compact list) when `utilization` is non-empty so humans see agent/skill coverage without opening JSON.

## Briefing-to-JSON mapping

| Briefing section | Typical JSON sources |
| --- | --- |
| Observation | `done`, key `decisions`, `learned`, `filesChanged` (plain descriptions) |
| Implication / Context | `blockers`, `unresolvedAssumptions`, `confidence.reason`, cross-agent context |
| Next Step | `nextSteps` buckets, `nextTurnImprovements`, or narrative next actions |
| Bottom Line | One-line synthesis of confidence + blockers + priority |
| **Utilization** (optional heading in visible note) | Summarize **`utilization`** rows: which **tasks** used which **agents** and **skills**—supports gap analysis |

## Last-5-turn feedback loop

- Prefer **one** turn with a **rich** summary over many tiny handoffs.
- **Supervisor** may consolidate multiple small child outcomes into **one** report.
- Agent summaries must include what was delivered, what was learned, and 1-2 self-suggested improvements.
- Supervisor reports must consolidate child summaries without rewriting their facts.
- Keep Supervisor's user-facing note aligned with persisted facts, but do not print canonical JSON in the note.

## Turn status

- `turnStatus`: `null` | `"ready"` | `"blocked"` | `"done"` (lowercase in JSON).
- When **`done`**, prefer empty `nextSteps` unless tracking follow-ups.
- The recorder may **warn** if `turnStatus` is `done` but `nextSteps` still contains items.

## Mode persistence (optional)

Turn summaries may include a `mode` object to update the session's communication mode:

```json
{
  "mode": {
    "communication": "caveman",
    "activeSinceTurn": 5,
    "triggeredBy": "user"
  }
}
```

- `communication`: `"normal"` | `"caveman"` | `"grill-me"`
- `activeSinceTurn`: integer turn count when mode was activated
- `triggeredBy`: `"user"` | `"agent"` | `"system"`

The recorder merges `mode` into the session context. If omitted, the existing mode is preserved.

## Operational log persistence rules

- Persist summaries only under `.git/.orchestration/`; never publish to `repo-memory/`.
- `events.jsonl` stores full entries and `context.json` stores compact bounded projections.
- If persistence is skipped or fails, say so explicitly.
- If a non-execute agent cannot append to the session log, return valid JSON and let the caller or Supervisor broker persistence.

## Workflows

### Agent turn
1. Read `.git/.orchestration/context.json` when available.
2. Review your own recent summaries and any supervisor feedback addressed to your agent.
3. Do the work.
4. End with one compact summary JSON object **and** a visible note in **executive briefing** format.
5. If you have execute and are responsible for persistence, call the recorder **before** handing back. Otherwise return the JSON for the caller to record.

### Supervisor turn
1. Gather child summary JSON objects.
2. Persist any child summaries that were not already recorded.
3. Build one canonical `supervisor_turn_report` JSON object with key bullets, cross-agent insights, and categorized next steps.
4. Persist the supervisor report.
5. Return the visible note: **executive briefing** + **Turn status** + **Recommended Orchestration Strategy** when applicable.
6. Use the last 5 reports and relevant child summaries to refine the next routing decision.
