# Harness Engineering Framework — Vibe Coder Workflow

> **For:** Human developers using AI assistance (Kimi Code, Copilot, etc.)  
> **When:** Every task that touches the JoyJoin codebase  
> **Time overhead:** Tier 1 = 0 min, Tier 2 = ~6 min, Tier 3 = ~40 min  
> **Last updated:** 2026-04-23

---

## The 30-Second Version

**You don't run scripts manually. You don't even classify tasks.** The Supervisor auto-detects and routes everything.

```
You: "Add a CSV export button to the admin finance page"

[Behind the scenes: Supervisor runs harness-auto-trigger → detects Tier 2]

Agent: 🔍 Harness Classification
       - Tier: 2 (Sprint Contract)
       - Contract required: yes
       - Action: pause for contract

Agent: Generates Sprint Contract → shows you → you review → accepted → implements

Agent: ✅ Sprint Evaluation: PASS  |  ✅ Harness Gate: PASS
```

**For Tier 1 tasks, you see nothing.** The Supervisor silently routes to the specialist, who codes and runs the gate. You just see the result.


---

## Full Workflow

### Step 0: Supervisor Auto-Classification (Invisible for Tier 1)

**You don't do anything.** The Supervisor agent runs the Harness Session Guard on **every** task before routing.

When you say:
> "Add a CSV export button to the admin finance page"

The Supervisor **silently** auto-triggers, classifies as Tier 2, and routes to the Backend Engineer **with harness metadata pre-filled**:

```json
{
  "harness": {
    "tier": 2,
    "contractRequired": true,
    "action": "PAUSE_FOR_CONTRACT",
    "maxEvaluatorIterations": 3
  }
}
```

**You only see the classification announcement when tier ≥ 2.** For Tier 1, it's completely invisible — you just see the specialist start working.

**If you want to check yourself** (optional):
```bash
node scripts/select-harness-tier.mjs \
  --files=apps/server/src/routes/domains/payments.ts \
  --task-meta='{"task":"add refund endpoint"}'
```

---

### Path A: Tier 1 (~70% of tasks) — Direct Delivery

**Characteristics:** Small, bounded, single workspace, no new routes, ≤50 lines.

```bash
# 1. Just code.
# 2. Run the deterministic gate.
npm run harness:gate        # Runs typecheck + tests + guardrails + build

# 3. If gate passes → done.
# 4. If gate fails → fix → rerun.
```

**No Sprint Contract. No negotiation. No overhead.**

**Examples:**
- Fix a typo in a component
- Adjust a CSS spacing value
- Add a missing prop to a type definition
- Update a copy string

---

### Path B: Tier 2 (~25% of tasks) — Sprint Contract Loop

**Characteristics:** New routes, multi-file, UI flows, auth changes, stateful ops, cross-workspace.

**How it starts:** The Supervisor auto-detected Tier 2 and routed to the specialist with `contractRequired: true`. The specialist **already knows** to pause before editing files.

#### Phase 1: Agent Generates Contract (1–2 min)

The specialist **automatically** generates the contract and shows you:

```
Generated Sprint Contract at:
.git/.orchestration/sprints/sprint-contract.my-task-20260423.md

Acceptance Criteria (pre-filled from template):
- AC-01: GET /api/admin/refunds/export returns 200 with Content-Type: text/csv
- AC-02: Route rejects non-admin sessions with 403
- AC-03: CSV includes headers: refund_id, payment_id, amount...

Please review — any criteria to add, remove, or change?
```

#### Phase 2: You Review & Negotiate (3–5 min)

**You just read and respond.** The agent handles the file updates.

1. **Read the criteria critically.** Ask yourself:
   - Are they observable? (Can a test prove them true/false?)
   - Are edge cases covered? (empty state, error path)
   - Is anything over-engineered? (streaming for <1000 rows?)

2. **Tell the agent what to change:**
   > "Add a rate limit criterion"  
   > "Change AC-01 to require Content-Disposition header too"  
   > "Remove the pagination criterion — not needed for MVP"

3. **Say "looks good" when ready.** The agent updates status → `accepted`.

**Max 2 negotiation cycles.** If going in circles → task is probably Tier 3.

#### Phase 3: Agent Checks Gate (automatic)

You see: `✅ Contract accepted — implementation may proceed`

#### Phase 4: Agent Implements (variable)

The agent codes against the contract. **You can watch or do other things.**

If the agent discovers a blocker, it will:
1. Show you the amendment proposal
2. Ask for approval
3. Update the contract
4. Continue

#### Phase 5: Agent Evaluates (2–3 min)

The agent **automatically** runs the evaluation and shows you:

```
✅ Sprint Evaluation: PASS (12/12 criteria)
- AC-01: PASS — Route returns 200 with correct Content-Type
- AC-02: PASS — 403 for non-admin sessions
- AC-03: PASS — CSV headers correct
...
```

#### Phase 6: Final Gate

```bash
npm run harness:gate
```

**Done.**

---

### Path C: Tier 3 (~5% of tasks) — Full Harness Lane

**Characteristics:** Core engine, payment, auth rewrite, major refactor, architectural boundaries.

#### Rule: The agent will NOT start coding immediately.

1. **Agent checks scheduling criteria:**
   - No release deadline within 48 hours?
   - Can you dedicate 60+ minutes?
   - Have stakeholders been notified (for payment/auth)?

2. **Agent runs pre-deliberation research** (optional, 10 min):
   - Gathers context from docs/architecture/
   - May hand off to Researcher agent

3. **Agent triggers HRC Deliberation** (see `tier-3-pilot-scheduling-framework.md`):
   - 3 perspectives (Architect, UX Visionary, Code Realist)
   - ACK-ALL consensus required
   - Outputs: contract structure + risk assessment

4. **Contract lock** (same as Tier 2, but Verifier uses max model)

5. **Implementation** with mid-flight escalation protocol

6. **Council evaluation** (QA Agent + Verifier skeptical check, 2/3 vote)

---

## Quick Reference: Which Path Am I On?

| Question | Tier 1 | Tier 2 | Tier 3 |
|----------|--------|--------|--------|
| How many files? | ≤2 | 2–10 | >5 core files |
| How many workspaces? | 1 | 1–2 | 2+ or shared engine |
| New route? | No | Maybe | Yes (if core) |
| Auth/payment touched? | No | Maybe | Yes |
| Could a bug corrupt data? | No | No | Yes |
| Contract needed? | No | Yes | Yes + deliberation |
| Model tier for evaluator? | mini | mini | max |
| Time to complete cycle? | Baseline | +6 min | +40 min |

---

## Commands (For Reference / Debugging)

**You don't normally run these.** The agent handles them automatically. But if you want to check something yourself:

```bash
# Check how we're doing:
node scripts/harness-kpi-report.mjs --weeks=2

# Manually classify a task:
node scripts/select-harness-tier.mjs --files=<your-files>

# Generate a contract manually:
node scripts/generate-sprint-contract.mjs --task-id=<id> --goal="<one sentence>"

# Check if contract is accepted:
node scripts/harness-contract-gate.mjs --task-id=<id>

# Run evaluation manually:
node scripts/run-sprint-evaluation.mjs --contract=<path>

# Save scorecards to repo memory:
node scripts/promote-scorecards-to-memory.mjs

# Check costs:
node scripts/harness-cost-tracker.mjs --report
```

---

## Anti-Patterns (Don't Do This)

| ❌ Anti-Pattern | ✅ Correct |
|-----------------|----------|
| Skip tier classification and just start coding | Always run `select-harness-tier` first |
| Write vague criteria like "works correctly" | Use numbers: "returns 200 in <100ms" |
| Accept your own contract without critical review | Pretend you're the Verifier — be skeptical |
| Add scope mid-implementation without updating contract | Amend contract, re-accept, then continue |
| Run Tier 3 during release week | Schedule Tier 3 when you have time to deliberate |
| Ignore the gate because "it's just a small change" | The gate is fast — run it every time |
| Never look at KPI dashboard | Check weekly to spot regressions |

---

## When to Escalate

**Escalate to Tier 3 mid-flight if:**
- You discover the task touches core engine files you didn't expect
- The contract negotiation goes to 3+ cycles
- A stakeholder says "this affects payments/auth"
- You feel the need to refactor >5 files

**Escalate to human review if:**
- Payment flow changes (always)
- Auth/session changes (always)
- Database schema destructive changes (always)
- The contract gate keeps rejecting and you don't know why

---

## Bottom Line

> **Tier 1:** Code → Gate → Done.  
> **Tier 2:** Classify → Contract → Negotiate → Gate → Code → Evaluate → Done.  
> **Tier 3:** Schedule → Deliberate → Contract → Gate → Code → Escalate if needed → Council → Done.

The extra 6 minutes for Tier 2 caught **19 real gaps** in 3 pilots, including 1 critical blocker that would have caused a mid-implementation scope explosion. The contract negotiation is the single biggest quality lever — use it.
