# Task Creator Examples

## Example 1: Tier 1 — Typo Fix

**User:** "Fix the typo in the onboarding button"

**Auto-trigger output:**
```json
{
  "tier": 1,
  "contractRequired": false,
  "action": "PROCEED",
  "triggerWords": ["fix the typo"]
}
```

**Task output:**
```json
{
  "taskId": "task_20260423_typo_fix",
  "mission": "Fix typo in onboarding button",
  "affectedWorkspaces": ["mini-program"],
  "harness": { "tier": 1, "contractRequired": false, "action": "PROCEED" },
  "routing": { "lane": "direct", "nextAgent": "Taro Mini-Program Frontend Engineer" }
}
```

**User sees:** Nothing about harness. The specialist just fixes it.

---

## Example 2: Tier 2 — New Feature

**User:** "Add a CSV export button to the admin finance page"

**Auto-trigger output:**
```json
{
  "tier": 2,
  "contractRequired": true,
  "action": "PAUSE_FOR_CONTRACT",
  "triggerWords": ["add a", "admin page"],
  "triggerDetails": [
    { "word": "add a", "tier": 2 },
    { "word": "admin page", "tier": 2 }
  ]
}
```

**Task output:**
```json
{
  "taskId": "task_20260423_csv_export",
  "mission": "Add CSV export for admin refund attempts",
  "affectedWorkspaces": ["server", "admin-client"],
  "harness": {
    "tier": 2,
    "contractRequired": true,
    "action": "PAUSE_FOR_CONTRACT",
    "triggerWords": ["add a", "admin page"]
  },
  "routing": {
    "lane": "direct",
    "nextAgent": "Backend Engineer",
    "reason": "Backend-first: API route needed before UI"
  },
  "acceptanceCriteria": [
    "GET /api/admin/refunds/export returns 200 with Content-Type: text/csv",
    "CSV includes headers: refund_id, payment_id, amount, status"
  ]
}
```

**User sees:**
```
🔍 Harness Classification
- Tier: 2 (Sprint Contract)
- Contract required: yes
- Triggered by: "add a", "admin page"
- Action: pause for contract

I'll generate a Sprint Contract for this task.
```

---

## Example 3: Tier 3 — Core Engine

**User:** "Update the matching algorithm to use semantic similarity"

**Auto-trigger output:**
```json
{
  "tier": 3,
  "contractRequired": true,
  "action": "SCHEDULE_DELIBERATION",
  "triggerWords": ["matching algorithm"],
  "triggerDetails": [
    { "word": "matching algorithm", "tier": 3 }
  ]
}
```

**Task output:**
```json
{
  "taskId": "task_20260423_matching_v3",
  "mission": "Update matching algorithm to use semantic similarity",
  "affectedWorkspaces": ["shared", "server"],
  "harness": {
    "tier": 3,
    "contractRequired": true,
    "action": "SCHEDULE_DELIBERATION",
    "triggerWords": ["matching algorithm"]
  },
  "routing": {
    "lane": "harness",
    "nextAgent": "Harness Runtime Controller",
    "reason": "Core engine change requires HRC deliberation"
  }
}
```

**User sees:**
```
🔍 Harness Classification
- Tier: 3 (Full Harness Lane)
- Contract required: yes + deliberation
- Triggered by: "matching algorithm" (core engine)
- Action: schedule HRC deliberation

This requires a deliberation cycle before implementation.
```
