# Output Schema

Every task must be structured as:

```json
{
  "taskId": "task_20260423_abc123",
  "mission": "One-sentence mission brief (dumb-CEO readable)",
  "description": "Expanded description of what needs to happen",
  "affectedWorkspaces": ["server", "admin-client"],
  "affectedFiles": ["apps/server/src/routes/domains/refunds.ts"],
  "harness": {
    "tier": 2,
    "contractRequired": true,
    "sprintContractId": null,
    "action": "PAUSE_FOR_CONTRACT",
    "triggerWords": ["add a", "new route"],
    "triggerDetails": [
      { "word": "add a new API", "tier": 2 }
    ]
  },
  "modelRecommendation": {
    "planner": "mini",
    "generator": "standard",
    "evaluator": "mini"
  },
  "estimatedCost": {
    "blendedMultiplier": "1.3–1.8x",
    "perTurnEstimate": "$0.03"
  },
  "routing": {
    "lane": "direct",
    "nextAgent": "Backend Engineer",
    "reason": "Single-domain backend task with Sprint Contract"
  },
  "acceptanceCriteria": [
    "GET /api/admin/refunds/export returns 200 with Content-Type: text/csv",
    "Route rejects non-admin sessions with 403"
  ],
  "outOfScope": [
    "Payment processing changes",
    "Email notifications"
  ]
}
```
