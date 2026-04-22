# Session Startup Routine

**Status:** Active runbook  
**Scope:** Exactly what to do when you sit down to work on a new task in the JoyJoin repo  
**Related:** [`contributor-execution-workflow`](./contributor-execution-workflow.md), [`lane-selection-governance`](../../.github/skills/lane-selection-governance/SKILL.md)

---

## The 10-second decision

```
Is this a one-line fix with an obvious file and no risk?
├─ YES → Skip Supervisor. Go straight to implementation.
│         (Typo, copy change, add a color token, tweak a Tailwind class.)
└─ NO  → Start with Supervisor. Always.
```

**Examples of "skip Supervisor":**
- Fix a typo in a fallback string
- Add a new icon to an existing glyph map
- Change a SCSS margin from `16rpx` to `12rpx`
- Add a missing import

**Examples of "start with Supervisor":**
- Any icebreaker change
- Any payment/auth/matching change
- Any new feature
- Any cross-workspace change
- Any task where you don't already know the exact 3 files to touch
- Any bug where you don't already know the root cause

---

## If skipping Supervisor (direct delivery)

1. Open the file.
2. Make the change.
3. Run `npm run guardrails`.
4. Run the narrowest type check (`check:server` or `check:clients`).
5. Done.

---

## If starting with Supervisor (everything else)

### Step 1: Invoke Supervisor

Use this exact prompt template. Copy, paste, fill in the blanks.

```
@Supervisor

**Task:** [one-sentence mission]

**Context:**
- Affected area: [e.g., icebreaker, event pools, onboarding, payments]
- I expect to touch: [workspaces or files, or "not sure yet"]
- Sibling platform review needed? [yes / no / not sure]
- Any upstream plan or research brief? [paste link or "none"]

**Blocker / question:**
[If you already know what's blocking you, state it. If not, say "need lane selection and routing."]
```

### Step 2: Let Supervisor run lane selection

The Supervisor will:
1. Load `lane-selection-governance` skill
2. Run the 4-gate heuristic
3. Tell you the lane: **HRC / DM / Kickoff / Direct**
4. Route the next agent or give you a direct implementation brief

**Do not argue with the lane choice.** The Supervisor is applying the heuristic you wrote into the repo. If you think it's wrong, state why and ask for re-evaluation, but default to trusting the gate.

### Step 3: Follow the routing

| Supervisor says | You do |
|---|---|
| "Lane = HRC" | Let Supervisor spawn `Harness Runtime Controller`. Wait for Sprint Contract + Harness Gate. Do not implement until gate passes. |
| "Lane = DM" | Let Supervisor spawn `Deliberation Moderator`. Wait for 3-perspective consensus. Do not implement until all ACK. |
| "Lane = Kickoff" | Supervisor sequences `Researcher` → `Planner`. Wait for approval-first plan. Do not implement until plan is locked. |
| "Lane = Direct" | Supervisor gives you a micro-plan. Implement it. Run quality gates. |
| "Route to debug" | Supervisor spawns `debug` agent. Let it reproduce and isolate before you fix. |
| "Route to [specialist]" | Supervisor hands off to the named agent. Follow that agent's plan. |

### Step 4: Implement

Follow the lane's output plan. Load relevant domain skills as needed.

### Step 5: Quality gates

Run in order. Stop on first failure.

```bash
npm run guardrails
npm run check:server        # or check:clients
npm run test -w @joyjoin/server   # or mini-program
node scripts/validate-harness-lane-requirement.mjs
```

### Step 6: Turn summary

End every session with this JSON (paste it into the chat before closing):

```json
{
  "delivered": "what shipped",
  "files_changed": ["..."],
  "lane_used": "direct|kickoff|dm|hrc",
  "decisions": ["..."],
  "blockers": ["..."],
  "next_steps": ["..."],
  "confidence": "high|medium|low"
}
```

---

## Full session example

**You:**
```
@Supervisor

**Task:** Add a new icebreaker phase called "speed_round" with a 2-minute timer.

**Context:**
- Affected area: icebreaker
- I expect to touch: server state machine, mini-program phase view
- Sibling platform review needed: yes
- Upstream plan: none

**Blocker / question:**
Need lane selection and routing.
```

**Supervisor:**
```
Lane = HRC (Gate 1 match: new icebreaker phase = state-machine change).
Spawning Harness Runtime Controller with pge-council mode.
```

**Harness Runtime Controller:**
```
Sprint Contract locked. Council deliberation complete. Harness Gate:
- reliability: PASS
- scalability: CONCERN — timer drift under load; mitigation: server-side deadline only
- security: PASS
- observability: PASS
- maintainability: PASS

Consensus reached. Routing to Backend Engineer for server implementation,
then Taro Mini-Program Frontend Engineer for UI.
```

**You:**
Implement per plan. Run quality gates. Ship.

---

## Process skills (Superpowers equivalent for Kimi / Copilot)

Before invoking Supervisor, check if a process skill applies:

| Situation | Load this skill first | Why |
|---|---|---|
| Task is ambiguous / creative / has multiple approaches | `process-brainstorming` | Forces constraint-first ideation and 3-option evaluation before lane selection |
| Bug is intermittent or root cause unknown | `process-systematic-debugging` | Structured reproduce → isolate → hypothesize → verify protocol |
| Ready to call a task "done" or merge | `process-verification-gate` | Harness 5-pillar pre-ship checklist |
| Adding deterministic logic or fixing a reproducible bug | `process-test-first` | Red-green-refactor discipline |

These skills are bound to Supervisor, debug, Auto-Eval, QA Agent, and Backend Engineer. They load automatically when those agents are invoked.

---

## What NOT to do

| Bad habit | Why it breaks |
|---|---|
| Start coding, then ask Supervisor mid-stream | Lane selection is pre-implementation. Retroactive routing wastes work. |
| Override Supervisor's HRC/DM choice without justification | The gates exist because you previously decided they were correct. Overriding them without evidence defeats the system. |
| Skip Supervisor for "quick" features | Almost every feature that touches >1 file is not quick. Let the gate decide. |
| Ask Supervisor to implement directly | Supervisor routes. Implementation agents build. Don't blur the boundary. |
| Forget the turn summary | Without it, the next session starts blind. The summary is 30 seconds that saves 10 minutes. |

---

## One-liner reminder

> **Trivial fix?** Direct. **Everything else?** `@Supervisor` first, every time.
