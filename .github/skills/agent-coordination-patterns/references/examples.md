# Extended Examples

Real-world coordination scenarios from the JoyJoin codebase.

---

## Example 1: Feature implementation across 3 workspaces (Dependency Graph)

**Task:** Add a new "event pack credits" feature (payment + mini-program + admin).

**Coordination design:**

```
Planner → "Define contract: API schema, mini-program UI flow, admin dashboard requirements"
  ↓
[Backend Engineer: implement API + DB] + [Taro Mini-Program Frontend Engineer: implement purchase flow]
  ↓ (both block on contract)
QA Agent → "Verify end-to-end: purchase → credit balance → event registration using credits"
  ↓
Admin Operations Advisor → "Verify admin dashboard shows credit transactions"
```

**Merge strategy:** Sequential pipeline with parallel implementation branch.

**Conflict encountered:** Backend Engineer added `credits_balance` column; Mini-Program Engineer expected `credit_balance` (singular). Resolution: Re-scope with explicit field name in contract, respawn both with corrected contract.

---

## Example 2: Auth security audit (Fan-Out / Fan-In)

**Task:** Audit all auth gaps before security review.

**Coordination design:**

```
Supervisor → Fan out to 4 explore agents:
  1. "Find all /api/admin/* routes missing requireAdmin"
  2. "Find all /api/* routes with relaxed auth (no session check)"
  3. "Find all WebSocket events missing auth gate"
  4. "Find all webhooks missing signature verification"

→ 4 compact summaries returned

Supervisor → Fan in to Synthesizer:
  "Merge findings. Deduplicate. Categorize by severity (critical/high/medium)."

→ Prioritized gap list

→ Sequential: Backend Engineer fixes critical + high gaps
→ Sequential: QA Agent verifies fixes
```

**Merge strategy:** Union + severity weighting.

**Partitioning:** By auth surface (HTTP routes, WebSocket, webhooks). Clean boundaries, no overlap.

---

## Example 3: Architecture decision with conflicting proposals (Conflict Resolution)

**Task:** Choose between Drizzle ORM migration vs raw SQL migration for a large schema change.

**Coordination design (attempted):**

```
Parallel proposals:
  Database Schema & Migration Auditor → "Propose Drizzle approach"
  Principal Software Engineer → "Propose raw SQL approach"

→ Conflict: mutually exclusive, both claim superiority

Resolution ladder:
  Step 1: Re-sequence
    Verifier → "Critique both proposals against migration safety criteria"
  Step 2: Still deadlocked (both have valid points)
  Step 3: Escalate to Deliberation Moderator
    Deliberation Moderator → 5-phase deliberation
      Alpha: scalability + tooling
      Beta: developer experience + maintainability
      Gamma: rollback safety + edge cases
  Step 4: Consensus reached — Drizzle for additive changes, raw SQL for destructive changes
```

**Lesson:** When coordination produces fundamental conflict, don't force-merge. Escalate.

---

## Example 4: Cross-platform parity review (Parallel Swarm with Merge)

**Task:** Ensure a new onboarding screen exists in both web and mini-program.

**Coordination design:**

```
Parallel:
  Expert React Frontend Engineer → "Implement web onboarding screen"
  Taro Mini-Program Frontend Engineer → "Implement mini-program onboarding screen"

→ Both return implementations

Parallel:
  Mini-Program Parity Auditor → "Compare web vs mini-program: spot gaps"
  QA Agent → "Verify both screens against product spec"

→ Merge: unified gap report + fix plan
```

**Merge strategy:** Intersection (find common ground where both must match) + union (platform-specific adaptations).

---

## Example 5: Sprint Contract negotiation (Sequential with Feedback Loop)

**Task:** Tier 2 backend feature requiring Sprint Contract.

**Coordination design:**

```
Backend Engineer → "Draft Sprint Contract"
  ↓
Verifier → "Review contract: REJECT with 3 gaps"
  ↓
Backend Engineer → "Revise contract addressing gaps"
  ↓
Verifier → "Review contract: ACK"
  ↓
Backend Engineer → "Implement against locked contract"
  ↓
QA Agent → "Sprint Evaluation: 1 PARTIAL → return to Backend Engineer"
  ↓
Backend Engineer → "Fix partial criterion"
  ↓
QA Agent → "Sprint Evaluation: all PASS"
```

**Pattern:** Sequential pipeline with a feedback loop (not pure pipeline).

**Guardrail:** Max 3 iterations on any loop before escalation to Supervisor.
