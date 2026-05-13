---
name: post-implementation-review
description: >-
  Blanket post-implementation review workflow. After every implementation agent
  completes, spawn a parallel review swarm (Auto-Eval + QA Agent + Verifier +
  PM Advisor + conditional Visual Designer) using a DETERMINISTIC CHECKLIST.
  Converge findings into a unified PASS / PARTIAL / FAIL verdict. Only BLOCKING
  items trigger fix loops; CONCERN and NIT are logged but non-blocking.
  Delta review ensures re-reviews only check previously failed items.
trigger phrases:
  - post-implementation review
  - review swarm
  - blanket review
  - done check
  - implementation review
  - post-impl review
---

# Post-Implementation Review

## Core Principle: Structured Inspection, Not Creative Critique

The #1 cause of review inconsistency is **free-form prose critique**. LLM agents invent new criteria each time. This skill replaces free-form review with a **deterministic checklist** — every agent evaluates the same items, with the same severity, every time.

**Canonical checklist:** `review-checklist-manifest.json` (co-located with this skill)

---

## When to use this skill

- An implementation agent has recorded `turnStatus: done`
- You need a uniform, deterministic review covering correctness, quality, harness compliance, product fit, documentation, and visual design
- You want to catch blocking issues **once** without nit-chasing

## When NOT to use this skill

- The turn modified 0 files
- `skipReview: true` in turn summary
- The agent is not an implementation agent

---

## Coordination Pattern

**Parallel Swarm → Convergence (with Severity Gating)**

```
Implementation Agent completes
│
├─ Supervisor detects turnStatus: done
│  └─ Loads checklist manifest
│
├─ Parallel Swarm (each agent runs their fixed checklist)
│  ├─ Auto-Eval ───── deterministic gate (scripted, no LLM judgment)
│  ├─ QA Agent ────── structured test checklist
│  ├─ Verifier ────── claim-evidence checklist
│  ├─ PM Advisor ──── criteria-match checklist (if criteria exist)
│  └─ Visual Designer ─ design audit checklist (UI changes only)
│
└─ Convergence (Supervisor)
   └─ Counts BLOCKING items only
      ├─ 0 blocking + any concerns → PASS
      ├─ 0 blocking + 1–3 concerns → PARTIAL (log, no fix loop)
      └─ ≥1 blocking → FAIL (fix loop)
```

---

## Trigger Conditions

Trigger after every implementation turn with `turnStatus: done`, **unless**:
- Modified file count === 0
- `skipReview: true`
- Agent not in `IMPLEMENTATION_AGENTS`

**Cost control:**

| Change size | Swarm composition |
|-------------|-------------------|
| ≤3 files AND ≤30 lines | Auto-Eval + Verifier (2 agents) |
| >3 files OR >30 lines, non-UI | Full swarm: 4 agents |
| >3 files OR >30 lines, UI-affecting | Full swarm + Visual Designer (5 agents) |
| Sprint Contract present | Always full swarm |

---

## Severity System (Prevents Over-Polishing)

Every checklist item has a fixed severity. **The verdict depends ONLY on blocking items.**

| Severity | Requires Fix? | Affects Verdict? | Examples |
|----------|---------------|------------------|----------|
| **BLOCKING** | Yes | FAIL if ≥1 | harness:gate fails, missing auth, claimed files don't exist |
| **CONCERN** | No (logged) | No | test gap, dead code, inconsistent copy |
| **NIT** | No (logged) | No | style preference, naming suggestion, spacing tweak |

**Critical rule:** Concerns and nits are recorded in the review report but **do NOT trigger the fix loop**. This prevents 画龙点睛 (over-polishing).

---

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

---

## Delta Review (Prevents Re-Reviewing the Same Code)

When a fix iteration completes and review is re-triggered:

1. Load previous review state from `.git/.orchestration/reviews/<summary-id>.json`
2. **Skip items that previously passed** — they are assumed still valid
3. **Re-check only:**
   - Items that previously failed
   - New files added since last review
   - Items whose verification method is a shell command (re-run for safety)
4. Compare new findings against previous findings
5. **Flag regression:** if a previously-passed item now fails, that's a regression (agent broke something while fixing)

**TTL:** Previous review state expires after 48 hours. After that, full review runs.

---

## Adaptive Escalation Ladder

| Change class | Max fix iterations | At limit |
|--------------|-------------------|----------|
| **Trivial** (≤3 files, ≤30 lines) | 1 | Human escalation |
| **Standard** (>3 files or >30 lines) | 2 | Sprint Evaluation or human |

**Auto-promotion triggers** (after max iterations):
- Same blocking issue resurrected
- >2 distinct blocking issues in first review
- Reviewer disagreement on blocking vs concern
- Verdict still FAIL after max iterations

---

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
          { "id": "AE-01", "status": "pass", "severity": "blocking" },
          { "id": "AE-02", "status": "pass", "severity": "blocking" }
        ],
        "blockingCount": 0,
        "concernCount": 0
      },
      "qaAgent": { "status": "pass", "items": [...] },
      "verifier": { "status": "pass", "items": [...] },
      "pmAdvisor": { "status": "pass", "items": [...] },
      "visualDesigner": { "status": "pass", "items": [...] }
    },
    "blockingFindings": [],
    "concerns": [],
    "nits": [],
    "recommendedNextStep": "..."
  }
}
```

---

## Agent Roles & Checklists

Each agent loads their checklist from `review-checklist-manifest.json` and evaluates every item.

### Auto-Eval
- **Fully deterministic** — no LLM judgment. All items are shell commands.
- Items: harness gate, guardrails, console.log check, type check

### QA Agent
- **Hybrid** — QA-01 and QA-03 require agent inspection; QA-02 is deterministic
- Max 3 free-form findings allowed

### Verifier
- **Hybrid** — VF-01 and VF-02 are deterministic; VF-03 and VF-04 require agent judgment
- Focus: "do the claimed files exist and work?"

### PM Advisor
- **Agent-judged** — requires comparing implementation against criteria
- Only runs when acceptance criteria or Sprint Contract exists

### Visual Designer
- **Agent-judged** — loads `frontend-design-audit` skill
- **Strict threshold:** Only VD-02 (hardcoded values) is blocking. All other design items are concern-level.
- This prevents design nit-chasing from blocking implementation.

---

## Why This Prevents Over-Polishing

| Before (free-form) | After (checklist) |
|-------------------|-------------------|
| Agent invents new criteria each review | Same checklist every time |
| "This spacing feels off" → blocking | Spacing is concern-level → non-blocking |
| "Premium feel could be better" → blocking | "Premium feel" removed from checklist entirely |
| 10+ findings, mixed severity | Max 3 free-form + fixed severity per item |
| Re-review checks everything again | Delta review skips previously-passed items |

---

## Related Skills

- `harness-completion-gate` — 5-pillar gate (Auto-Eval item AE-01)
- `orchestration-turn-reporting` — executive briefing format
- `agent-coordination-patterns` — parallel swarm and convergence
- `code-review` — structured PR review lens
- `testing-and-regression-guardrails` — QA verification patterns
- `frontend-design-audit` — design audit for UI changes (Visual Designer)
