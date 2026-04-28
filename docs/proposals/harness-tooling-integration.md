# Technical Integration Design: Harness Tooling for JoyJoin Implementation Phase

> **Status:** Design proposal — integrates `harness-design-implementation-phase-mapping.md` and `sprint-contract-implementation-phase.md` into executable scripts, CI/CD hooks, and data flows.  
> **Date:** 2026-04-23  
> **Scope:** Scripts, CI/CD, git hooks, file schemas, state persistence, observability wiring  

---

## 1. Design Principles

1. **File-mediated communication** — Agents do not negotiate in chat; they read/write standardized artifacts. This survives context compaction and enables deterministic replay.
2. **Tiered cost control** — Not every task gets the full harness. A deterministic router selects the cheapest tier that provides sufficient quality assurance.
3. **Hard thresholds, not grades** — Any required criterion below threshold fails the sprint. No partial credit on safety-critical dimensions.
4. **Reuse before invent** — Auto-Eval, Harness Completion Gate, Playwright MCP, and existing CI jobs are composed; nothing is replaced.
5. **Observability by default** — Every gate run emits a structured scorecard. Metrics feed Prometheus; JSON logs feed Loki.

---

## 2. File / Artifact Specifications

JoyJoin harness artifacts use a **dual-format pattern**: Markdown for agent readability and negotiation, JSON for machine parsing, CI consumption, and observability ingestion. Both files are co-located and share a canonical `taskId`.

### 2.1 Sprint Contract

**Path:**
```
.git/.orchestration/sprint-contracts/sprint-contract.{taskId}.md
.git/.orchestration/sprint-contracts/sprint-contract.{taskId}.json
```

**Markdown format** (canonical source of truth for agents):

```markdown
# Sprint Contract: {taskId}

## Metadata
- **Task:** One-sentence mission
- **Implementing Agent:** Backend Engineer | AI Engineer | ...
- **Contract Evaluator:** QA Agent | Verifier
- **Tier:** 1 | 2 | 3
- **Status:** draft | proposed | accepted | rejected | amended | expired
- **Created:** ISO timestamp
- **Accepted:** ISO timestamp or pending
- **Expires:** ISO timestamp (default: 24h after acceptance)

---

## 1. Goal
One sentence describing the sprint boundary.

## 2. Acceptance Criteria
| ID | Criterion | Verification Method | Weight | Threshold |
|----|-----------|---------------------|--------|-----------|
| AC-01 | Concrete observable condition | Command / MCP / test | required | PASS |
| AC-02 | ... | ... | required | PASS |
| AC-03 | ... | ... | advisory | PASS/PARTIAL |

## 3. Harness Pillar Criteria

### Reliability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| REL-01 | ... | ... | PASS |

### Scalability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SCA-01 | ... | ... | PASS |

### Security
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SEC-01 | ... | ... | PASS |

### Observability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| OBS-01 | ... | ... | PASS |

### Maintainability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| MNT-01 | ... | ... | PASS |

## 4. Out-of-Scope
- Item A
- Item B

## 5. Verification Method Summary
Paragraph describing how the evaluator will verify.

## 6. Negotiation Log
- **[timestamp]** Implementer proposed: ...
- **[timestamp]** Evaluator reviewed: ...
- **[timestamp]** Implementer amended: ...
- **[timestamp]** Evaluator accepted: ...
```

**JSON format** (machine contract, schema-validated):

```json
{
  "$schema": "../../.orchestration/sprint-contracts/schema.json",
  "taskId": "admin-refund-2026-04-23",
  "tier": 2,
  "status": "accepted",
  "metadata": {
    "goal": "Add admin refund capability",
    "implementingAgent": "Backend Engineer",
    "contractEvaluator": "QA Agent",
    "createdAt": "2026-04-23T10:00:00Z",
    "acceptedAt": "2026-04-23T10:08:00Z",
    "expiresAt": "2026-04-24T10:08:00Z"
  },
  "acceptanceCriteria": [
    {
      "id": "AC-01",
      "criterion": "POST /api/admin/payments/:id/refund returns 200 with refundId",
      "verification": { "type": "api_test", "command": "npm run test -w @joyjoin/server -- refund" },
      "weight": "required",
      "threshold": "PASS"
    }
  ],
  "pillarCriteria": {
    "reliability": [
      { "id": "REL-01", "criterion": "Refund call has 30s timeout and 1 retry", "verification": { "type": "code_review" }, "threshold": "PASS" }
    ],
    "scalability": [],
    "security": [],
    "observability": [],
    "maintainability": []
  },
  "outOfScope": ["Automatic refund on event cancellation"],
  "verificationSummary": "Run scoped tests, guardrails, and audit log inspection.",
  "negotiationLog": [
    { "timestamp": "2026-04-23T10:00:00Z", "party": "implementer", "action": "proposed", "note": "Initial draft" },
    { "timestamp": "2026-04-23T10:08:00Z", "party": "evaluator", "action": "accepted", "note": "" }
  ],
  "maxIterations": 3,
  "currentIteration": 0
}
```

**JSON Schema** (`.git/.orchestration/sprint-contracts/schema.json`) enforces:
- `taskId` is kebab-case, unique per directory
- `tier` ∈ {1,2,3}
- `status` ∈ {draft,proposed,accepted,rejected,amended,expired}
- Every `required` criterion has `threshold: "PASS"`
- `maxIterations` ≤ 5 (hard cap)
- At least one acceptance criterion and at least 3 pillar criteria present for tiers 2–3

---

### 2.2 Evaluation Report

**Path:**
```
.git/.orchestration/sprint-contracts/eval-report.{taskId}.json
```

Produced by the evaluator after each evaluation pass.

```json
{
  "taskId": "admin-refund-2026-04-23",
  "evaluatedAt": "2026-04-23T11:00:00Z",
  "evaluatedBy": "QA Agent",
  "iteration": 1,
  "verdict": "REJECT",
  "grades": [
    { "criterionId": "AC-01", "grade": "PASS", "evidence": "curl returned 202" },
    { "criterionId": "AC-02", "grade": "FAIL", "evidence": "Duplicate key returned 500; race in idempotency check" },
    { "criterionId": "REL-01", "grade": "PARTIAL", "evidence": "Timeout present, retry logic missing" }
  ],
  "blockingIssues": ["AC-02: idempotency race condition"],
  "concerns": ["REL-01: missing retry"],
  "feedbackForGenerator": "Add SELECT FOR UPDATE or unique index. Add exponential backoff retry wrapper.",
  "reproductionSteps": [
    "1. Run server: npm run dev:server",
    "2. curl -X POST http://localhost:5000/api/admin/payments/1/refund",
    "3. Repeat same curl immediately"
  ],
  "playwrightScreenshots": [],
  "testOutput": "...",
  "elapsedMs": 45000
}
```

**Verdict semantics:**
- `ACCEPT` — all required criteria PASS, no blocking issues.
- `REJECT` — any required criterion FAIL, or any blocking issue present.
- `CONDITIONAL` — all required criteria PASS, but advisory criteria PARTIAL or concerns exist. Generator may fix or escalate to Supervisor.

---

### 2.3 Harness Scorecard

**Path:**
```
.git/.orchestration/sprint-contracts/scorecard.{taskId}.json
```

Produced once per sprint, after the final ACCEPT or after max iterations exhausted. This is the durable record for observability and repo memory.

```json
{
  "taskId": "admin-refund-2026-04-23",
  "tier": 2,
  "status": "ACCEPTED",
  "generatorAgent": "Backend Engineer",
  "evaluatorAgent": "QA Agent",
  "createdAt": "2026-04-23T10:00:00Z",
  "acceptedAt": "2026-04-23T10:08:00Z",
  "completedAt": "2026-04-23T11:30:00Z",
  "iterations": 2,
  "criteriaSummary": {
    "total": 10,
    "required": 7,
    "advisory": 3,
    "passed": 9,
    "failed": 0,
    "partial": 1
  },
  "pillarScores": {
    "reliability": { "score": 95, "status": "pass" },
    "scalability": { "score": 100, "status": "pass" },
    "security": { "score": 100, "status": "pass" },
    "observability": { "score": 100, "status": "pass" },
    "maintainability": { "score": 90, "status": "pass" }
  },
  "overallScore": 97,
  "autoEvalResult": { "status": "pass", "score": 98 },
  "harnessGateResult": { "status": "pass", "score": 94 },
  "playwrightResult": { "status": "pass", "journey": "/admin/payments", "screenshots": 3 },
  "finalVerdict": "ACCEPT"
}
```

---

### 2.4 Tier State Manifest

**Path:**
```
.git/.orchestration/sprint-contracts/active-manifest.json
```

A single JSON file tracking all active (non-archived) sprint contracts in the session.

```json
{
  "sessionId": "sess_20260423_abc123",
  "updatedAt": "2026-04-23T12:00:00Z",
  "activeContracts": [
    {
      "taskId": "admin-refund-2026-04-23",
      "tier": 2,
      "status": "accepted",
      "generator": "Backend Engineer",
      "evaluator": "QA Agent",
      "contractPath": "sprint-contracts/sprint-contract.admin-refund-2026-04-23.json",
      "evalReportPath": "sprint-contracts/eval-report.admin-refund-2026-04-23.json",
      "scorecardPath": null
    }
  ],
  "completedContracts": [
    {
      "taskId": "fix-typo-navbar-2026-04-23",
      "tier": 1,
      "status": "completed",
      "scorecardPath": "sprint-contracts/scorecard.fix-typo-navbar-2026-04-23.json"
    }
  ]
}
```

---

## 3. New / Modified Scripts

All scripts are ESM Node.js, placed in `scripts/`, and exposed via `package.json` scripts.

### 3.1 `scripts/select-harness-tier.mjs` (NEW)

**Purpose:** Deterministic router that reads git diff + task metadata and selects Tier 1, 2, or 3.

**Inputs:**
- `process.argv[2]` — optional task metadata JSON string or path
- Reads `git diff --stat HEAD` if no explicit input

**Decision matrix:**

| Condition | Tier |
|-----------|------|
| ≤50 lines, 1 workspace, no new routes, no auth/stateful changes, no schema changes | 1 |
| >50 lines OR new route OR UI change OR cross-file OR stateful operation (non-core) | 2 |
| Core engine (matching, personality, auth, payment) OR >100 lines OR cross-workspace OR schema migration | 3 |

**Output (stdout, JSON):**

```json
{
  "tier": 2,
  "reason": "New API route detected (apps/server/src/routes/domains/adminPayments.ts)",
  "lineCount": 87,
  "workspaces": ["server"],
  "filesChanged": 3,
  "contractRequired": true,
  "suggestedEvaluator": "QA Agent"
}
```

**Exit codes:** 0 (success), 1 (error)

**package.json addition:**
```json
"harness:select-tier": "node scripts/select-harness-tier.mjs"
```

---

### 3.2 `scripts/evaluate-sprint-contract.mjs` (NEW)

**Purpose:** Standalone script that evaluates an implementation against a locked Sprint Contract. Can be invoked by QA Agent, CI, or local dev.

**Inputs (CLI flags):**
- `--task-id=<id>` — required
- `--mode=contract-review|sprint-evaluation|full-harness`
- `--json` — emit JSON only
- `--skip-playwright` — for CI environments without a running app

**Behavior per mode:**

| Mode | Action |
|------|--------|
| `contract-review` | Validate JSON schema, check testability of criteria, warn on vague verification methods. Fast (~1s). |
| `sprint-evaluation` | Run verification methods specified in contract (tests, curl, grep), produce `eval-report.{taskId}.json`. |
| `full-harness` | Sprint-evaluation + run Harness Completion Gate + cross-check gate findings against contract pillar criteria. |

**Integration with existing tooling:**
- Calls `npm run test -w <workspace> -- <pattern>` for test-type verification
- Calls `node scripts/harness-completion-gate.mjs --json` for pillar cross-check
- Calls Playwright MCP journey only when `verification.type === "playwright"` and `--skip-playwright` is absent

**Output:**
- Writes `eval-report.{taskId}.json` to sprint-contracts directory
- Returns exit code 0 (ACCEPT), 1 (REJECT), 2 (CONDITIONAL), 3 (system error)

**package.json addition:**
```json
"harness:evaluate": "node scripts/evaluate-sprint-contract.mjs",
"harness:evaluate:json": "node scripts/evaluate-sprint-contract.mjs --json"
```

---

### 3.3 `scripts/harness-full.mjs` (NEW)

**Purpose:** Orchestrates the complete Tier-3 harness pipeline: contract review → implementation gate → Playwright smoke → structured review.

**Pipeline (internal):**

```
1. Read sprint-contract.{taskId}.json
2. select-harness-tier (confirm Tier 3)
3. evaluate-sprint-contract --mode=contract-review
4. Run affected-workspace tests
5. Run auto-eval-core (deterministic gate)
6. Run harness-completion-gate --json
7. If contract specifies Playwright journey:
     a. Start dev servers (or verify APP_URL)
     b. Run Playwright MCP against specified journey
     c. Capture screenshots
8. Cross-reference gate findings with contract pillar criteria
9. Write scorecard.{taskId}.json
10. Print verdict + scorecard path
```

**Inputs:**
- `--task-id=<id>` — required
- `--app-url=http://localhost:5001` — optional override
- `--json` — JSON output

**Exit codes:** 0 (ACCEPT), 1 (REJECT), 2 (CONDITIONAL), 3 (system error)

**package.json addition:**
```json
"harness:full": "node scripts/harness-full.mjs"
```

---

### 3.4 Modified: `scripts/harness-completion-gate.mjs`

**Changes:**

1. **Read active Sprint Contract** (if present in `.git/.orchestration/sprint-contracts/`):
   - Load `sprint-contract.{taskId}.json` when invoked with `--task-id=<id>`
   - Tag each finding with the criterion ID it violates (e.g., `[MNT-01]`)

2. **New CLI flags:**
   - `--task-id=<id>` — load contract and tag findings
   - `--tag-findings` — always attempt contract tagging even without `--task-id` (auto-detects most recent active contract)

3. **Output enrichment (JSON mode):**

```json
{
  "version": "2026-04-22.v2",
  "status": "fail",
  "overallScore": 78,
  "filesChecked": 4,
  "pillars": [ ... ],
  "contractTags": {
    "taskId": "admin-refund-2026-04-23",
    "criterionHits": [
      { "criterionId": "SEC-01", "finding": "New route without auth middleware", "pillar": "security" },
      { "criterionId": "MNT-01", "finding": "Route logic inline in routes.ts", "pillar": "maintainability" }
    ]
  }
}
```

4. **No breaking changes** — without `--task-id`, behavior is identical to current gate.

---

### 3.5 Modified: `scripts/auto-eval-core.mjs`

**Changes:**

1. **Contract-aware module addition** — if `sprint-contract.{taskId}.json` exists and is referenced via env var `HARNESS_TASK_ID`:
   - Run a new `contract-compliance` module that checks:
     - Does the diff touch files outside the contract's stated scope?
     - Are acceptance criteria testable given the changed files?
     - Does the diff size match the contract's estimated size?
   - Score deducted for scope drift.

2. **New module result shape:**

```json
{
  "key": "contract-compliance",
  "name": "Contract Compliance",
  "score": 85,
  "confidence": 95,
  "status": "fail",
  "findings": [
    { "severity": "blocker", "message": "Contract AC-03 requires Zod validation; no Zod import found in diff" }
  ],
  "evidence": ["contract:admin-refund-2026-04-23"]
}
```

3. **Turn-summary integration** — `auto-eval.mjs` gains `--emit-turn-summary` flag to append a compact harness summary to `.git/.orchestration/last-turn-summary.json`.

---

### 3.6 Modified: `scripts/orchestration-supervisor.mjs` (git-hook mode)

**Changes:**

- `pre-commit` path: after orchestration validation, if `HARNESS_PRE_COMMIT=1`:
  1. Run `select-harness-tier.mjs`
  2. If tier ≥ 2 and no active sprint contract exists for changed files, warn (non-blocking): `[pre-commit] Tier-2+ changes detected but no active Sprint Contract found. Consider writing one.`
  3. If tier ≥ 2 and active contract exists but status ≠ accepted, fail (blocking): `[pre-commit] Sprint Contract {taskId} is not accepted (status: draft). Complete negotiation before committing.`

- `post-commit` path: record harness state:
  1. Append to `.git/.orchestration/commit-harness-log.jsonl`:
     ```json
     { "commit": "abc123", "timestamp": "2026-04-23T12:00:00Z", "tier": 2, "taskId": "admin-refund-2026-04-23", "contractStatus": "accepted", "evalVerdict": "ACCEPT" }
     ```

---

## 4. CI/CD Integration

### 4.1 GitHub Actions Job Map

The existing `cicd.yml` gains two new jobs and one conditional modification.

```yaml
jobs:
  # ─── Existing jobs (unchanged) ───
  guardrails: ...
  lint-user: ...
  lint-shared: ...
  lint-admin: ...
  lint-server: ...
  test-server: ...

  # ─── NEW: Harness Tier Selection ───
  harness-tier:
    needs: [guardrails]
    name: Select Harness Tier
    runs-on: ubuntu-latest
    outputs:
      tier: ${{ steps.tier.outputs.tier }}
      contract_required: ${{ steps.tier.outputs.contract_required }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - id: tier
        run: |
          RESULT=$(node scripts/select-harness-tier.mjs)
          echo "tier=$(echo "$RESULT" | jq -r '.tier')" >> $GITHUB_OUTPUT
          echo "contract_required=$(echo "$RESULT" | jq -r '.contractRequired')" >> $GITHUB_OUTPUT
          echo "$RESULT" | jq .

  # ─── MODIFIED: Harness Completion Gate ───
  harness-gate:
    needs: [guardrails, harness-tier]
    name: Harness Completion Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Run Harness 5-Pillar Gate
        run: node scripts/harness-completion-gate.mjs
      - name: Run Contract-Aware Gate (if Tier ≥ 2)
        if: ${{ needs.harness-tier.outputs.tier >= 2 }}
        run: |
          TASK_ID=$(jq -r '.activeContracts[0].taskId' .git/.orchestration/sprint-contracts/active-manifest.json)
          node scripts/harness-completion-gate.mjs --task-id="$TASK_ID" --tag-findings

  # ─── NEW: Sprint Contract Evaluation (Tier 2+ only) ───
  sprint-eval:
    needs: [lint-user, lint-shared, lint-admin, lint-server, test-server, harness-tier]
    if: ${{ needs.harness-tier.outputs.contract_required == 'true' }}
    name: Sprint Contract Evaluation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Evaluate Sprint Contract
        run: |
          TASK_ID=$(jq -r '.activeContracts[0].taskId' .git/.orchestration/sprint-contracts/active-manifest.json)
          node scripts/evaluate-sprint-contract.mjs --task-id="$TASK_ID" --mode=full-harness --json
        # Playwright skipped in CI for now; journeys verified in AI simulation test
        env:
          HARNESS_SKIP_PLAYWRIGHT: "1"
      - name: Upload Scorecard
        uses: actions/upload-artifact@v4
        with:
          name: harness-scorecard
          path: .git/.orchestration/sprint-contracts/scorecard.*.json

  # ─── MODIFIED: AI Simulation Test ───
  ai-test:
    needs: [lint-user, lint-shared, lint-admin, lint-server, test-server, harness-gate, sprint-eval]
    if: ${{ always() && needs.harness-gate.result == 'success' && (needs.sprint-eval.result == 'success' || needs.sprint-eval.result == 'skipped') }}
    # ... rest unchanged
```

### 4.2 Blocking vs. Non-Blocking

| Job | Blocking? | Reason |
|-----|-----------|--------|
| `guardrails` | **Blocking** | Existing behavior |
| `harness-tier` | **Non-blocking** | Informational; downstream gates are the real blockers |
| `harness-gate` | **Blocking** | Existing behavior; pillar failures block deploy |
| `sprint-eval` | **Blocking when `contract_required=true`** | Hard threshold: any required criterion FAIL → exit 1 → job fails |
| `ai-test` | **Blocking** | Existing behavior |
| `deploy` | **Blocking** | Existing behavior |

**Graceful degradation:** If `sprint-eval` cannot run because no active manifest exists, it skips (does not fail). This protects legacy PRs that predate the harness contract system.

---

## 5. Git Hook Changes

### 5.1 Pre-Commit Hook (`.githooks/pre-commit`)

**Additions after the existing Harness Completion Gate block:**

```sh
# --- Sprint Contract Gate (opt-in, Tier 2+ awareness) ---
if [ "${HARNESS_SPRINT_CONTRACT:-}" = "1" ]; then
  echo "[pre-commit] Selecting harness tier..."
  TIER_JSON=$(node scripts/select-harness-tier.mjs)
  TIER=$(echo "$TIER_JSON" | node -e "const d=require('fs').readFileSync(0,'utf8'); console.log(JSON.parse(d).tier)")
  CONTRACT_REQUIRED=$(echo "$TIER_JSON" | node -e "const d=require('fs').readFileSync(0,'utf8'); console.log(JSON.parse(d).contractRequired)")

  if [ "$CONTRACT_REQUIRED" = "true" ]; then
    echo "[pre-commit] Tier $TIER changes detected. Checking Sprint Contract..."
    # Verify active manifest exists and first contract is accepted
    MANIFEST=".git/.orchestration/sprint-contracts/active-manifest.json"
    if [ -f "$MANIFEST" ]; then
      STATUS=$(node -e "const m=require('./$MANIFEST'); const c=m.activeContracts[0]; console.log(c ? c.status : 'none')")
      if [ "$STATUS" != "accepted" ]; then
        echo "[pre-commit] Sprint Contract status is '$STATUS'. Tier $TIER requires an accepted contract."
        echo "[pre-commit] Run: npm run harness:evaluate -- --task-id=<your-task-id> --mode=contract-review"
        exit 1
      fi
      echo "[pre-commit] Sprint Contract accepted. Proceeding."
    else
      echo "[pre-commit] WARNING: No active manifest found for Tier $TIER changes."
      echo "[pre-commit] Consider writing a Sprint Contract or set HARNESS_SPRINT_CONTRACT=0 to skip."
      # Non-blocking warning for gradual adoption:
      # exit 1  # Uncomment to enforce after pilot phase
    fi
  fi
fi
```

**Rationale:** The Sprint Contract gate is **opt-in** (`HARNESS_SPRINT_CONTRACT=1`) during the pilot phase. After 2 weeks of proven stability, it becomes the default (remove the env-var gate). This prevents disrupting existing developer workflows while the contract schema stabilizes.

### 5.2 Post-Commit Hook (`.githooks/post-commit`)

**Replace the existing one-liner with:**

```sh
#!/bin/sh
set -eu

# Orchestration bookkeeping
node scripts/orchestration-supervisor.mjs git-hook post-commit || true

# Harness state persistence
if [ -d ".git/.orchestration/sprint-contracts" ]; then
  COMMIT_HASH=$(git rev-parse HEAD)
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  MANIFEST=".git/.orchestration/sprint-contracts/active-manifest.json"

  if [ -f "$MANIFEST" ]; then
    # Append commit-harness log
    node -e "
      const fs = require('fs');
      const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
      const active = manifest.activeContracts[0];
      const logLine = JSON.stringify({
        commit: '$COMMIT_HASH',
        timestamp: '$TIMESTAMP',
        tier: active ? active.tier : 1,
        taskId: active ? active.taskId : null,
        contractStatus: active ? active.status : null
      });
      fs.appendFileSync('.git/.orchestration/commit-harness-log.jsonl', logLine + '\n');
    "
  fi
fi
```

**Rationale:** The post-commit hook records which harness tier and contract were active when a commit was made. This enables later analysis ("How many Tier-3 sprints this week?" "What's the average iteration count?") and provides an audit trail if a bad commit reaches `main`.

---

## 6. Turn-Level Data Flow

### 6.1 Sequence Diagram: Single Implementation Turn with Harness Gating

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Supervisor │     │   Generator  │     │   Contract  │     │   QA Agent   │     │  Harness     │
│  (Router)   │     │  (Engineer)  │     │   Store     │     │ (Evaluator)  │     │  Scripts     │
└──────┬──────┘     └──────┬───────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │                   │                   │
       │ 1. Route task +   │                    │                   │                   │
       │    approved plan  │                    │                   │                   │
       │──────────────────>│                    │                   │                   │
       │                   │                    │                   │                   │
       │                   │ 2. Run select-harness-tier.mjs          │                   │
       │                   │    (or read cached tier from plan)      │                   │
       │                   │<────────────────────────────────────────│                   │
       │                   │                    │                   │                   │
       │                   │ 3a. Tier 1: skip contract               │                   │
       │                   │     → implement directly                │                   │
       │                   │                    │                   │                   │
       │                   │ 3b. Tier 2/3: write Sprint Contract     │                   │
       │                   │     (md + json)                        │                   │
       │                   │──────────────────>│                   │                   │
       │                   │                    │                   │                   │
       │                   │ 4. Handoff to QA Agent for review       │                   │
       │                   │                    │──────────────────>│                   │
       │                   │                    │                   │                   │
       │                   │                    │ 5. Review contract │                   │
       │                   │                    │    (fast, 1 turn) │                   │
       │                   │                    │<──────────────────│                   │
       │                   │                    │                   │                   │
       │                   │ 6a. REJECTED:     │                    │                   │
       │                   │     read feedback, amend, re-save      │                   │
       │                   │     (loop to 4, max 3 iterations)      │                   │
       │                   │                    │                   │                   │
       │                   │ 6b. ACCEPTED:     │                    │                   │
       │                   │     lock contract, begin implementation │                   │
       │                   │                    │                   │                   │
       │                   │ 7. Write code (files, tests)            │                   │
       │                   │                    │                   │                   │
       │                   │ 8. Self-evaluation checkpoint           │                   │
       │                   │    npm run typecheck                    │                   │
       │                   │    npm run test (affected workspace)    │                   │
       │                   │    git diff --stat (scope check)        │                   │
       │                   │                    │                   │                   │
       │                   │ 9. Claim completion → handoff to QA     │                   │
       │                   │                    │──────────────────>│                   │
       │                   │                    │                   │                   │
       │                   │                    │ 10. Sprint Eval   │                   │
       │                   │                    │     evaluate-sprint-contract.mjs        │
       │                   │                    │     (runs tests, gate, Playwright if    │
       │                   │                    │      contract requires)                 │
       │                   │                    │───────────────────────────────────────>│
       │                   │                    │                   │                   │
       │                   │                    │                   │ 11. Returns report │
       │                   │                    │                   │     (PASS / FAIL) │
       │                   │                    │                   │<──────────────────│
       │                   │                    │                   │                   │
       │                   │ 12a. REJECTED:    │                    │                   │
       │                   │      read eval-report, fix, loop to 8   │                   │
       │                   │      (max 3 iterations total)           │                   │
       │                   │                    │                   │                   │
       │                   │ 12b. ACCEPTED:    │                    │                   │
       │                   │      write scorecard, run Auto-Eval     │                   │
       │                   │      (npm run auto-eval)                │                   │
       │                   │                    │                   │                   │
       │                   │ 13. Final handoff to Supervisor         │                   │
       │                   │      with scorecard + turn summary      │                   │
       │<──────────────────│                    │                   │                   │
       │                   │                    │                   │                   │
```

### 6.2 State Transitions per Turn

| Turn Phase | Agent Action | File State |
|------------|-------------|------------|
| Receive task | Supervisor routes | — |
| Tier selection | Generator runs `select-harness-tier.mjs` | `active-manifest.json` created or updated |
| Contract draft | Generator writes | `sprint-contract.{taskId}.md` + `.json` status=`draft` |
| Contract proposal | Generator updates | status=`proposed` |
| Contract review | QA Agent reads, returns feedback (chat) or writes | status=`amended` or `accepted` |
| Implementation | Generator edits files | Contract unchanged; git working tree changes |
| Self-evaluation | Generator runs local checks | — |
| Sprint evaluation | QA Agent runs `evaluate-sprint-contract.mjs` | `eval-report.{taskId}.json` written |
| Rejection | Generator reads eval-report, fixes | New iteration; eval-report kept for history |
| Acceptance | QA Agent updates manifest | `scorecard.{taskId}.json` written; contract moves to `completedContracts` |
| Auto-eval | Generator runs `npm run auto-eval` | `pass-state.json` updated in `.git/.auto-eval/` |
| Turn summary | Any agent writes | `last-turn-summary.json` updated with harness fields |

---

## 7. State Persistence

### 7.1 Layered Persistence Model

JoyJoin harness state survives across agent turns via a **three-layer persistence model**:

| Layer | Mechanism | Scope | Use Case |
|-------|-----------|-------|----------|
| **L1: File-based contract store** | `.git/.orchestration/sprint-contracts/*.json` | Per-sprint, per-task | Canonical contract, evaluation reports, scorecards |
| **L2: Turn-summary JSON** | Agent embeds `agent_turn_summary` JSON at end of every turn | Per-turn | Routing decisions, Supervisor consolidation, context compaction recovery |
| **L3: Commit-harness log** | `.git/.orchestration/commit-harness-log.jsonl` | Per-commit (append-only) | Audit trail, retroactive analysis, observability correlation |

### 7.2 Contract Store Lifecycle

```
.git/.orchestration/sprint-contracts/
├── schema.json                  # JSON Schema for validation
├── active-manifest.json         # Index of active + completed contracts
├── sprint-contract.{taskId}.md  # Human/agent readable contract
├── sprint-contract.{taskId}.json# Machine contract
├── eval-report.{taskId}.json    # Evaluation output (1 per iteration)
├── scorecard.{taskId}.json      # Final scorecard (1 per sprint)
└── archive/                     # Contracts older than 30 days
    └── 2026-04/
        └── scorecard.{taskId}.json
```

**Cleanup policy:**
- `eval-report.*.json` files older than 7 days are compressed to `.json.gz`
- Completed scorecards older than 30 days move to `archive/YYYY-MM/`
- Active-manifest automatically prunes `completedContracts` entries older than 30 days (keeps scorecard path)

### 7.3 Turn-Summary Schema Extension

The existing `agent_turn_summary` JSON gains a `harness` field:

```json
{
  "agent": "Backend Engineer",
  "turn": 3,
  "delivered": ["POST /api/admin/payments/:id/refund route"],
  "filesChanged": ["apps/server/src/routes/domains/adminPayments.ts"],
  "decisions": ["Used existing paymentService instead of new refundService"],
  "blockers": [],
  "learned": [],
  "nextSteps": ["Hand off to QA Agent for Sprint Evaluation"],
  "confidence": 0.92,
  "harness": {
    "taskId": "admin-refund-2026-04-23",
    "tier": 2,
    "contractStatus": "accepted",
    "iteration": 1,
    "selfEval": {
      "typecheck": "pass",
      "tests": "pass",
      "guardrails": "pass",
      "lineCount": 87
    },
    "scorecardPath": null,
    "evalReportPath": null
  }
}
```

When the turn ends with a completed sprint, `scorecardPath` and `evalReportPath` are populated.

---

## 8. Observability Integration

### 8.1 Prometheus Metrics

The `evaluate-sprint-contract.mjs` script pushes a **textfile metric** to the node-exporter textfile directory (or stdout for scraping) when run in CI or local dev with `PROMETHEUS_TEXTFILE_DIR` set:

```prometheus
# HELP joyjoin_harness_sprint_score Overall harness score for a sprint
# TYPE joyjoin_harness_sprint_score gauge
joyjoin_harness_sprint_score{task_id="admin-refund-2026-04-23",tier="2",generator="Backend Engineer",evaluator="QA Agent"} 97

# HELP joyjoin_harness_sprint_iterations Number of evaluator iterations before accept/reject
# TYPE joyjoin_harness_sprint_iterations gauge
joyjoin_harness_sprint_iterations{task_id="admin-refund-2026-04-23"} 2

# HELP joyjoin_harness_pillar_score Per-pillar score
# TYPE joyjoin_harness_pillar_score gauge
joyjoin_harness_pillar_score{task_id="admin-refund-2026-04-23",pillar="reliability"} 95
joyjoin_harness_pillar_score{task_id="admin-refund-2026-04-23",pillar="scalability"} 100
joyjoin_harness_pillar_score{task_id="admin-refund-2026-04-23",pillar="security"} 100
joyjoin_harness_pillar_score{task_id="admin-refund-2026-04-23",pillar="observability"} 100
joyjoin_harness_pillar_score{task_id="admin-refund-2026-04-23",pillar="maintainability"} 90

# HELP joyjoin_harness_contract_status Sprint contract status (1=accepted, 0=rejected, -1=expired)
# TYPE joyjoin_harness_contract_status gauge
joyjoin_harness_contract_status{task_id="admin-refund-2026-04-23"} 1

# HELP joyjoin_harness_eval_duration_seconds Time spent in sprint evaluation
# TYPE joyjoin_harness_eval_duration_seconds gauge
joyjoin_harness_eval_duration_seconds{task_id="admin-refund-2026-04-23",mode="full-harness"} 45.2
```

**Local dev:** The server already exposes `/api/metrics`. A new route `POST /api/admin/harness-metrics` (admin-only) accepts a JSON payload and converts it to Prometheus exposition format, appending to an in-memory registry. This avoids requiring node-exporter on dev machines.

### 8.2 Loki / Structured Logging

All harness scripts emit **JSON-structured log lines** to stdout, which the existing Loki/Grafana stack captures (if configured) or which can be grepped locally:

```json
{"level":"info","time":"2026-04-23T11:00:00Z","component":"evaluate-sprint-contract","taskId":"admin-refund-2026-04-23","event":"sprint_eval_started","tier":2,"mode":"full-harness"}
{"level":"info","time":"2026-04-23T11:00:15Z","component":"evaluate-sprint-contract","taskId":"admin-refund-2026-04-23","event":"tests_passed","workspace":"@joyjoin/server","durationMs":12000}
{"level":"warn","time":"2026-04-23T11:00:30Z","component":"evaluate-sprint-contract","taskId":"admin-refund-2026-04-23","event":"criterion_failed","criterionId":"AC-02","grade":"FAIL"}
{"level":"error","time":"2026-04-23T11:00:45Z","component":"evaluate-sprint-contract","taskId":"admin-refund-2026-04-23","event":"sprint_rejected","iterations":1,"blockingIssues":["AC-02"]}
```

**Grafana dashboard suggestion:** A new panel "Harness Quality" showing:
- Sprint acceptance rate over time (line chart)
- Average iterations before accept (stat panel)
- Pillar score heatmap (reliability / scalability / security / observability / maintainability)
- Tier distribution (pie chart: Tier 1 vs 2 vs 3)

### 8.3 Alerting Rules (Prometheus)

```yaml
# joyjoin-harness-alerts.yml
- alert: HighSprintRejectionRate
  expr: rate(joyjoin_harness_contract_status[1h]) < 0.5
  for: 30m
  annotations:
    summary: "Sprint rejection rate is above 50%"

- alert: HarnessGatePillarFailure
  expr: joyjoin_harness_pillar_score < 70
  for: 0m
  annotations:
    summary: "Harness pillar score below 70 for {{ $labels.pillar }}"

- alert: SprintEvaluationTimeout
  expr: joyjoin_harness_eval_duration_seconds > 300
  for: 0m
  annotations:
    summary: "Sprint evaluation took longer than 5 minutes"
```

---

## 9. Package.json Scripts Summary

```json
{
  "scripts": {
    "harness:select-tier": "node scripts/select-harness-tier.mjs",
    "harness:evaluate": "node scripts/evaluate-sprint-contract.mjs",
    "harness:evaluate:json": "node scripts/evaluate-sprint-contract.mjs --json",
    "harness:full": "node scripts/harness-full.mjs",
    "harness:gate": "node scripts/harness-completion-gate.mjs",
    "harness:gate:tagged": "node scripts/harness-completion-gate.mjs --tag-findings",
    "harness:archive": "node scripts/archive-sprint-contracts.mjs",
    "check:full": "npm run guardrails && npm run typecheck && npm run test && npm run harness:gate"
  }
}
```

---

## 10. Migration Path

| Phase | Timeline | Actions |
|-------|----------|---------|
| **Phase 0: Design review** | Now | This document is reviewed and approved. |
| **Phase 1: Schema + scripts** | Day 1–2 | Create `schema.json`, `select-harness-tier.mjs`, `evaluate-sprint-contract.mjs`. Update `harness-completion-gate.mjs` and `auto-eval-core.mjs` with contract-awareness (no-op if no contract). |
| **Phase 2: Pilot** | Day 3–10 | Enable for 5–10 tasks in Harness and Kickoff lanes. Use `HARNESS_SPRINT_CONTRACT=1` locally. Collect scorecards. |
| **Phase 3: CI integration** | Day 11–14 | Add `harness-tier` and `sprint-eval` jobs to CI. Make `sprint-eval` non-blocking initially, then blocking after 5 green runs. |
| **Phase 4: Default enable** | Day 15+ | Remove `HARNESS_SPRINT_CONTRACT` opt-in. Pre-commit contract gate becomes blocking for Tier 2+. Document in `AGENTS.md`. |
| **Phase 5: Observability** | Day 20+ | Wire Prometheus textfile metrics. Add Grafana dashboard JSON to `infra/grafana/dashboards/`. |

---

## 11. Open Questions for Resolution

1. **Playwright MCP in CI:** The article emphasizes clicking through the running app, but CI lacks a running app without `docker compose up`. Should we add a `docker-compose.test.yml` that spins up the stack for `sprint-eval`, or keep Playwright evaluation local-only?
2. **Contract Evaluator identity:** This design uses QA Agent as the default Evaluator. The Sprint Contract proposal suggested Verifier. Should the default Evaluator be Verifier for contract review (cheap, skeptical) and QA Agent for sprint evaluation (tooling-heavy)?
3. **Cross-workspace contracts:** If a task spans `server` + `mini-program`, does one contract cover both, or do we spawn parallel contracts with a parent/child relationship?
4. **Human override:** If Generator and Evaluator deadlock after 3 iterations, Supervisor escalates — but to whom? A human engineer, or a higher-tier agent (Harness Runtime Controller)?

---

## 12. Summary

This design unifies the two partial proposals into an executable system:

| Concern | Pragmatist Proposal | Sprint Contract Proposal | **This Integration** |
|---------|-------------------|------------------------|---------------------|
| Format | JSON only | Markdown only | **Dual-format**: Markdown for agents, JSON for machines |
| Tier selection | `select-harness-tier.mjs` | Implicit in task-creator | **Deterministic script** with cached manifest |
| Evaluation | LLM calls × 4 | Verifier post-claim | **`evaluate-sprint-contract.mjs`** with mode switches |
| CI/CD | Not specified | Not specified | **2 new jobs**, conditional blocking, artifact upload |
| Git hooks | Not specified | Not specified | **Pre-commit contract gate** (opt-in → default), **post-commit state log** |
| State | JSON files | Markdown files | **File store + turn-summary JSON + commit log** |
| Observability | Not specified | Not specified | **Prometheus metrics + Loki JSON logs + Grafana dashboard** |

**Bottom line:** The harness is not a new agent. It is a **composition of existing scripts, agents, and CI jobs**, mediated by standardized file artifacts, with deterministic tier selection to control cost.
