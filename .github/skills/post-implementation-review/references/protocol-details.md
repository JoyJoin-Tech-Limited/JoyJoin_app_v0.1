# Protocol & schema details

Implementation detail behind `post-implementation-review`. The authoritative item list is `review-checklist-manifest.json`; this file documents how agents run it, the turn-summary schema, per-agent roles, and the rationale.

## Deterministic Checklist Protocol

### Step 1: Load the Checklist Manifest

```json
{
  "agent": "QA Agent",
  "items": [
    { "id": "QA-01", "description": "At least one test added...", "severity": "blocking" },
    { "id": "QA-02", "description": "Claimed tests pass...", "severity": "blocking" },
    { "id": "QA-03", "description": "Error paths covered...", "severity": "concern" }
  ]
}
```

### Step 2: Run Each Item

For each checklist item:
- If `auto: true` → run the deterministic command/script
- If `auto: false` → agent inspects and marks PASS / FAIL per the item definition
- **Every finding must cite the checklist item ID** (e.g., "VF-03: claimed behavior not evidenced")

### Step 3: Enforce Consistency Guards

- **Max 3 free-form findings per agent** — forces checklist discipline
- **Disallow new BLOCKING items on re-review** — if an item wasn't blocking in the first review, it cannot become blocking in a re-review of the same code
- **Review fingerprint** — hash of changed files + checklist version. Same fingerprint → same expected result.

## Turn Summary Schema Extension

```json
{
  "postImplementationReview": {
    "status": "completed",
    "verdict": "PASS|PARTIAL|FAIL",
    "swarmSize": 4,
    "iterationCount": 1,
    "reviewFingerprint": "sha256:abc123...",
    "checklistVersion": 1,
    "dimensionResults": {
      "autoEval": {
        "status": "pass",
        "items": [
          { "id": "AE-01", "status": "pass", "severity": "blocking" }
        ],
        "blockingCount": 0,
        "concernCount": 0
      },
      "qaAgent": { "status": "pass", "items": [] },
      "verifier": { "status": "pass", "items": [] },
      "pmAdvisor": { "status": "pass", "items": [] },
      "visualDesigner": { "status": "pass", "items": [] },
      "userSatisfactionAuditor": { "status": "pass", "items": [] }
    },
    "blockingFindings": [],
    "concerns": [],
    "nits": [],
    "recommendedNextStep": "..."
  }
}
```

## Agent Roles & Checklists

Each agent loads their checklist from `review-checklist-manifest.json` and evaluates every item.

- **Auto-Eval** — fully deterministic, no LLM judgment; all items are shell commands (harness gate, guardrails, console.log check, type check).
- **QA Agent** — hybrid; QA-01/QA-03 agent-inspected, QA-02 deterministic. Max 3 free-form findings.
- **Verifier** — hybrid; VF-01/VF-02 deterministic, VF-03/VF-04 agent-judged. Focus: "do the claimed files exist and work?"
- **PM Advisor** — agent-judged; compares implementation against acceptance criteria / Sprint Contract. Only runs when criteria exist.
- **Visual Designer** — agent-judged; loads `frontend-design-audit`. Strict threshold: only VD-02 (hardcoded values) is blocking; all other design items are concern-level to prevent nit-chasing.
- **User Satisfaction Auditor** — agent-judged; loads `user-satisfaction-audit`. Runs only when the diff touches a user-facing frontend surface; skipped for backend/admin-only changes. Picks a named persona, walks the rendered surface in first person, scores the six satisfaction angles. Only US-04 is blocking: an emotional peak (reveal, completion, first payment) delivered without a ceremony arc. All other items are concern-level — satisfaction polish never triggers a fix loop on its own.

## Why This Prevents Over-Polishing

| Before (free-form) | After (checklist) |
|-------------------|-------------------|
| Agent invents new criteria each review | Same checklist every time |
| "This spacing feels off" → blocking | Spacing is concern-level → non-blocking |
| "Premium feel could be better" → blocking | "Premium feel" removed from checklist entirely |
| 10+ findings, mixed severity | Max 3 free-form + fixed severity per item |
| Re-review checks everything again | Delta review skips previously-passed items |
