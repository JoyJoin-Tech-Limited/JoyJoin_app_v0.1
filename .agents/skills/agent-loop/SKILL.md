---
name: agent-loop
description: >
  Autonomous agent execution loop inspired by the Claude Code Agent SDK loop.
  State-machine-based task lifecycle: classify → contract → implement → evaluate → done/retry/escalate.
  Manages turns, retries, and completion gates for JoyJoin agent workflows.
  Use for multi-turn tasks that need structured execution with auto-retry and escalation.
  Trigger phrases: "agent loop", "autonomous execution", "loop this task", "run the loop",
  "start agent loop", "tick the loop", "loop status", "multi-turn task", "auto-retry".
---

# Agent Loop

## Purpose

The Agent Loop runtime implements a state-machine-based execution loop for agent tasks. Inspired by the Claude Code Agent SDK's autonomous loop (prompt → evaluate → tools → repeat), it manages the full task lifecycle from classification through implementation to completion, with automatic retry and human escalation.

It runs as a CLI tool invoked at task boundaries — it does not daemonize or spawn agents directly. It tells the IDE/human which agent to run next and tracks progress across turns.

## When to Apply

**Use the agent loop for:**
- Multi-turn tasks expected to take 3+ agent invocations
- Tasks with explicit acceptance criteria that need verification
- Any Tier 2+ task where Sprint Contracts are required
- Tasks where you want auto-retry on gate failure
- Tasks that span multiple agent specializations (Researcher → Backend → QA)

**Skip the agent loop for:**
- Single-turn questions or lookups
- Trivial Tier 1 tasks (one edit, one file)
- Human-in-the-loop decision making (use Kickoff lane instead)

## State Machine

```
idle ──→ classified ──→ contracted ──→ implementing ──→ evaluating
  │           │              │               │                │
(start)    (tier)     (contract ok)    (agent work)    (gate check)
                                                           │
                                              ┌────────────┼────────────┐
                                              ↓            ↓            ↓
                                            done       retrying    escalated
                                                          │
                                                    (retries remain?)
                                                      │         │
                                                     yes       no
                                                      │         │
                                                      ↓         ↓
                                                implementing  escalated
```

### States

| State | Meaning | Exit condition |
|-------|---------|---------------|
| `idle` | Fresh task, not yet classified | → `classified` on init |
| `classified` | Tier determined, contract status known | → `implementing` (Tier 1) or `contracted` (Tier 2/3) |
| `contracted` | Sprint Contract required, waiting for acceptance | → `implementing` when contract accepted |
| `implementing` | Agent(s) working on the task | → `evaluating` on tick |
| `evaluating` | Checking completion gates | → `done`, `retrying`, or `implementing` |
| `done` | All gates passed, task complete | Terminal |
| `retrying` | Gate failed, retrying | → `implementing` (retries remain) or `escalated` (exhausted) |
| `escalated` | All retries exhausted, needs human | Terminal — route to Supervisor |
| `cancelled` | Human abort | Terminal |

### Result Subtypes (from evaluation)

| Subtype | Meaning |
|---------|---------|
| `success` | All gates passed, task complete |
| `continue` | More agents needed — loop continues |
| `gate_failed` | Completion gate failed but retries remain |
| `agent_failed` | Agent reported failure/blocked |
| `error_max_turns` | Hit max turn limit |
| `error_max_retries` | All retry attempts exhausted |
| `error_gate_failed_max_retries` | Gate failed after max retries |

## Commands

### `init` — Start a new agent loop

```bash
node scripts/orchestration/orchestration-loop.mjs init \
  --goal="Fix the auth bug in login flow" \
  --files="apps/server/src/routes/domains/auth.ts,apps/server/src/middleware/auth.ts" \
  --task-id="auth-bug-fix" \
  --max-turns=10 \
  --max-retries=3
```

**Options:**
| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--goal=<text>` | Yes | — | One-sentence mission |
| `--files=<a,b,c>` | No | — | Comma-separated file paths |
| `--task-id=<id>` | No | auto | Unique identifier |
| `--max-turns=<n>` | No | 10 | Max tool-use turns |
| `--max-retries=<n>` | No | 3 | Max evaluation retries |

**What happens:**
1. Runs `harness-auto-trigger.mjs` to classify the task tier
2. If Tier 2/3, checks for Sprint Contract acceptance
3. If contract accepted (or not needed), transitions to `implementing`
4. Outputs JSON with state, next actions, and summary
5. Exit code 0 = ready to implement, exit code 1 = blocked (needs contract)

### `tick` — Process a turn summary

```bash
# Via --summary
node scripts/orchestration/orchestration-loop.mjs tick \
  --summary='{"done":true,"agent":"Backend Engineer","learned":"fixed race condition"}'

# Via stdin pipe
echo '{"done":true,"agent":"QA Agent"}' | node scripts/orchestration/orchestration-loop.mjs tick
```

**Turn summary format:**
```json
{
  "done": true,        // Agent declares task complete
  "failed": false,     // Agent declares failure
  "status": "ready",   // ready | blocked | done
  "agent": "Backend Engineer",
  "learned": "Fixed the race condition in poolMatchingService",
  "nextTurnImprovements": ["Add integration test"]
}
```

**What happens:**
1. Increments turn counter, records history
2. Transitions to `evaluating`
3. Runs evaluation (done signal + harness gate)
4. Transitions to `done` / `retrying` / `implementing` / `escalated`
5. Outputs new state and next actions
6. Exit code 0 = continue/success, exit code 2 = escalated

### `status` — Show current loop state

```bash
node scripts/orchestration/orchestration-loop.mjs status
node scripts/orchestration/orchestration-loop.mjs status --format=markdown
```

### `reset` — Clear loop state

```bash
node scripts/orchestration/orchestration-loop.mjs reset
```

### `terminate` — Force-terminate

```bash
node scripts/orchestration/orchestration-loop.mjs terminate --reason="scope changed"
```

## Integration Points

### With Harness Tier Classification
The loop calls `harness-auto-trigger.mjs` on `init` to determine:
- Tier (1/2/3)
- Whether a Sprint Contract is required
- Which trigger words matched

### With Sprint Contract Gate
The loop calls `harness-contract-gate.mjs` on `init` for Tier 2/3 tasks to:
- Locate the Sprint Contract file
- Verify acceptance status
- Block implementation until contract is accepted

### With Next-Actions Engine
The loop reads `next-actions.json` (generated by `orchestration-next-actions.mjs`) for ranked agent recommendations. Falls back to local action building when the artifact is unavailable.

### With Harness Completion Gate
On tick with `done: true`, the loop runs `harness-completion-gate.mjs` and falls back to `npm run guardrails` as a minimum gate check.

### With Turn Reporting
Tick summaries follow the `agent_turn_summary` format from `orchestration-turn-reporting`:
- `done`, `learned`, `nextTurnImprovements`
- The loop's history preserves full turn details

## Retry Logic

The loop auto-retries when:
1. Agent reports `done: true` but completion gate fails → retry
2. Agent reports `failed: true` or `status: "blocked"` → retry
3. Turn limit hit without completion → escalate (no retry)

Retries auto-advance to `implementing` state with the retry reason. Max retries configurable via `--max-retries`.

## Comparison: Claude Code Agent SDK Loop vs JoyJoin Agent Loop

| Concept | Claude Code Agent SDK | JoyJoin Agent Loop |
|---------|----------------------|-------------------|
| **Turn** | Claude → tool calls → results | Agent invocation → turn summary → evaluate |
| **Loop closure** | SDK executes tools autonomously | Human/IDE invokes next agent per recommendation |
| **Messages** | System, Assistant, User, Stream, Result | init, tick, status output |
| **Hooks** | PreToolUse, PostToolUse, Stop, etc. | harness-auto-trigger, contract-gate, completion-gate |
| **Limits** | maxTurns, maxBudgetUsd | maxTurns, maxRetries |
| **Compaction** | Automatic context summarization | Not applicable (agents have fresh context) |
| **Subagents** | Isolated subtasks with fresh context | Sequential agent handoffs via next-actions |
| **Permissions** | allowedTools, disallowedTools, permissionMode | Harness tiers + Sprint Contract gating |
| **Result subtypes** | success, error_max_turns, error_max_budget_usd, etc. | success, continue, gate_failed, agent_failed, error_max_turns, error_max_retries |
| **Session continuity** | session_id for resume/fork | loop-state.json persists across invocations |
| **Autonomy level** | Fully autonomous within limits | Semi-autonomous: auto-retry within loop, human gates at Tier 2+ |

## Guardrails

- Never spawn agents autonomously — the loop recommends, the IDE/human invokes
- Never skip contract acceptance for Tier 2+ tasks
- Never infinite loop — maxTurns and maxRetries are hard caps
- State transitions are strictly validated against the transition map
- Terminal states (done, escalated, cancelled) block further ticks

## Example: Full Task Flow

```bash
# 1. Start the loop
$ node scripts/orchestration/orchestration-loop.mjs init \
    --goal="Add pagination to GET /api/pools" \
    --files="apps/server/src/routes/domains/pools.ts"
# → Tier 2, contract required, state=contracted, exit code 1

# 2. Create and accept Sprint Contract (manual, or via Verifier agent)
$ node scripts/generate-sprint-contract.mjs --task-id=1781160831243-0c9a7794 \
    --goal="Add pagination to GET /api/pools" --files="apps/server/src/routes/domains/pools.ts"
# → Contract created, hand to Verifier

# 3. After contract accepted, re-init
$ node scripts/orchestration/orchestration-loop.mjs init \
    --goal="Add pagination to GET /api/pools" \
    --files="apps/server/src/routes/domains/pools.ts" \
    --task-id=1781160831243-0c9a7794
# → state=implementing, nextActions: [Backend Engineer, Researcher]

# 4. Run Backend Engineer agent → returns turn summary
$ echo '{"done":true,"agent":"Backend Engineer","learned":"added pagination"}' | \
    node scripts/orchestration/orchestration-loop.mjs tick
# → evaluating → gate passes → done, exit code 0

# 5. Check final state
$ node scripts/orchestration/orchestration-loop.mjs status --format=markdown
# ● Agent Loop — Complete in 1 turn(s)
```
