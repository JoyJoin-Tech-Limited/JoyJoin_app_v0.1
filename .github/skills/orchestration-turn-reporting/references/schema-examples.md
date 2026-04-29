# Shared Schema Examples

## Agent turn summary

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

## Supervisor turn report

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
