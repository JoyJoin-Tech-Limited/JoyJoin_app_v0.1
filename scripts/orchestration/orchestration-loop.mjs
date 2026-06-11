#!/usr/bin/env node
/**
 * orchestration-loop.mjs — Autonomous Agent Loop Runtime
 *
 * Implements a state-machine-based agent execution loop, inspired by the
 * Claude Code Agent SDK loop. Manages task lifecycle from classification
 * through implementation to completion, with auto-retry and escalation.
 *
 * State machine:
 *   idle → classified → contracted → implementing → evaluating
 *     ↓         ↓            ↓              ↓            ↓
 *   (start)  (tier)    (contract ok)  (agent work)  (gate check)
 *                                                      ↓
 *                                              done / retrying / escalated
 *
 * Commands:
 *   init     — Start a new task loop
 *   tick     — Process a turn summary, advance state
 *   status   — Show current loop state
 *   reset    — Reset loop state
 *   terminate — Force-terminate the loop
 *
 * Usage:
 *   node scripts/orchestration/orchestration-loop.mjs init --goal="Fix auth bug" --files="auth.ts,auth.test.ts"
 *   node scripts/orchestration/orchestration-loop.mjs tick --summary='{"done":true}'
 *   node scripts/orchestration/orchestration-loop.mjs status --format=markdown
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

// ── Constants ──────────────────────────────────────────────────────────

const RUNTIME_DIR = path.join(process.cwd(), '.git', '.orchestration');
const LOOP_STATE_FILE = path.join(RUNTIME_DIR, 'loop-state.json');
const NEXT_ACTIONS_FILE = path.join(RUNTIME_DIR, 'next-actions.json');
const CONTEXT_FILE = path.join(RUNTIME_DIR, 'context.json');

const VALID_STATES = new Set([
  'idle', 'classified', 'contracted', 'implementing',
  'evaluating', 'done', 'retrying', 'escalated', 'cancelled',
]);

const STATE_TRANSITIONS = {
  idle:           ['classified', 'cancelled'],
  classified:     ['contracted', 'implementing', 'cancelled'],
  contracted:     ['implementing', 'cancelled'],
  implementing:   ['evaluating', 'cancelled'],
  evaluating:     ['done', 'retrying', 'implementing', 'cancelled'],
  retrying:       ['implementing', 'escalated', 'cancelled'],
  done:           [],
  escalated:      [],
  cancelled:      [],
};

const DEFAULT_CONFIG = {
  maxTurns: 10,
  maxRetries: 3,
  autoRetryDelayMs: 1000,
  terminationReasons: {
    max_turns: 'Hit max turn limit before completion',
    max_retries: 'All retry attempts exhausted',
    gate_failed: 'Completion gate did not pass',
    human_abort: 'Explicitly terminated by human',
    agent_failed: 'Agent reported failure',
  },
};

const ICONS = {
  idle: '○', classified: '◇', contracted: '◆', implementing: '◉',
  evaluating: '◎', done: '●', retrying: '↻', escalated: '▲', cancelled: '✕',
};

// ── State Helpers ──────────────────────────────────────────────────────

function ensureRuntimeDir() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

function loadLoopState() {
  try {
    if (fs.existsSync(LOOP_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(LOOP_STATE_FILE, 'utf-8'));
    }
  } catch { /* corrupt — start fresh */ }
  return null;
}

function saveLoopState(state) {
  ensureRuntimeDir();
  fs.writeFileSync(LOOP_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function createLoopState(taskId, goal, proposedFiles, overrides = {}) {
  return {
    taskId,
    goal,
    state: 'idle',
    tier: null,
    contractRequired: null,
    contractAccepted: false,
    contractPath: null,
    currentAgent: null,
    currentAction: null,
    currentTurn: 0,
    maxTurns: overrides.maxTurns ?? DEFAULT_CONFIG.maxTurns,
    maxRetries: overrides.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    retryCount: 0,
    retryReason: null,
    proposedFiles: proposedFiles || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };
}

function transitionTo(state, newState, reason) {
  if (!STATE_TRANSITIONS[state.state]?.includes(newState)) {
    return {
      ok: false,
      error: `Invalid transition: ${state.state} → ${newState}. Allowed: ${STATE_TRANSITIONS[state.state]?.join(', ') || 'none'}`,
    };
  }
  state.state = newState;
  state.updatedAt = new Date().toISOString();
  return { ok: true, reason };
}

// ── Shell helpers ──────────────────────────────────────────────────────

function escapeShell(str) {
  return str.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function tryExec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: options.timeout ?? 10_000,
      ...options,
    });
    return { ok: true, stdout: result.trim(), exitCode: 0 };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || '',
      exitCode: err.status ?? 1,
      error: err.message,
    };
  }
}

function tryExecJson(command, options = {}) {
  const result = tryExec(command, options);
  if (result.stdout) {
    try { return { ...result, json: JSON.parse(result.stdout) }; } catch { /* not JSON */ }
  }
  return result;
}

// ── Classification ─────────────────────────────────────────────────────

function runHarnessAutoTrigger(goal, proposedFiles) {
  const filesArg = proposedFiles.join(',');
  const result = tryExecJson(
    `node scripts/harness/harness-auto-trigger.mjs --prompt="${escapeShell(goal)}" --proposed-files="${escapeShell(filesArg)}"`,
  );
  // harness-auto-trigger exits non-zero for Tier 2/3 — that's normal
  return result.json || { tier: 1, contractRequired: false, reason: 'Classification failed, defaulting to Tier 1', action: 'PROCEED' };
}

function runContractGate(taskId, tier) {
  const tierArg = tier ? `--tier=${tier}` : '';
  return tryExecJson(
    `node scripts/harness/harness-contract-gate.mjs --task-id="${escapeShell(taskId)}" ${tierArg}`,
  );
}

// ── Next Actions ───────────────────────────────────────────────────────

function readNextActions() {
  try {
    if (fs.existsSync(NEXT_ACTIONS_FILE)) {
      const artifact = JSON.parse(fs.readFileSync(NEXT_ACTIONS_FILE, 'utf-8'));
      return artifact.routing?.primary || [];
    }
  } catch { /* ignore */ }
  return [];
}

function syncNextActions(loopState) {
  // Try running the next-actions engine via the supervisor
  const result = tryExec(
    `node scripts/orchestration/orchestration-next-actions.mjs --context="${escapeShell(CONTEXT_FILE)}"`,
    { timeout: 15_000 },
  );
  if (result.ok) return readNextActions();

  // If it doesn't support CLI mode, read existing artifact
  return readNextActions();
}

function buildNextActions(state) {
  // Try reading from next-actions artifact
  const existing = syncNextActions(state);
  if (existing.length > 0) return existing;

  // Fallback: build actions from loop state alone
  return buildFallbackActions(state);
}

function buildFallbackActions(state) {
  const actions = [];

  if (state.state === 'idle' || state.state === 'classified') {
    actions.push({
      agent: 'Researcher',
      label: 'Research context',
      actionText: 'gather repo context, identify affected files and constraints',
      kind: 'route-agent',
      transport: 'native-button',
    });
    actions.push({
      agent: 'Planner',
      label: 'Create execution plan',
      actionText: 'build an approval-first execution plan from research findings',
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  if (state.state === 'contracted') {
    actions.push({
      agent: 'Verifier',
      label: 'Review Sprint Contract',
      actionText: 'review and accept the Sprint Contract before implementation',
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  if (state.state === 'implementing') {
    const agent = state.proposedFiles.some(f => f.includes('mini-program'))
      ? 'Taro Mini-Program Frontend Engineer'
      : state.proposedFiles.some(f => f.includes('server') || f.includes('packages/shared'))
        ? 'Backend Engineer'
        : 'Backend Engineer';

    actions.push({
      agent,
      label: `Implement: ${state.goal}`,
      actionText: state.goal,
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  if (state.state === 'evaluating') {
    actions.push({
      agent: 'QA Agent',
      label: 'Evaluate implementation',
      actionText: 'run tests, verify acceptance criteria, produce verification checklist',
      kind: 'route-agent',
      transport: 'native-button',
    });
    actions.push({
      agent: 'Verifier',
      label: 'Skeptical completion audit',
      actionText: 'challenge done-claims with skeptical checks',
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  if (state.state === 'retrying') {
    actions.push({
      agent: state.currentAgent || 'Backend Engineer',
      label: `Retry implementation (${state.retryCount}/${state.maxRetries})`,
      actionText: `retry: ${state.goal} — previous attempt: ${state.retryReason || 'gate failed'}`,
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  if (state.state === 'escalated') {
    actions.push({
      agent: 'Supervisor',
      label: 'Escalate for human intervention',
      actionText: `loop escalated: ${state.retryReason || 'unknown'} — manual triage needed`,
      kind: 'route-agent',
      transport: 'native-button',
    });
  }

  // Always include researcher and auto-eval as overflow
  if (state.state !== 'idle' && state.state !== 'done' && state.state !== 'cancelled') {
    actions.push({
      agent: 'Auto-Eval',
      label: 'Run quality gate',
      actionText: 'rerun the local dirty-worktree quality gate',
      kind: 'rerun-check',
      transport: 'native-button',
    });
  }

  return actions.slice(0, 5);
}

// ── Evaluation ─────────────────────────────────────────────────────────

function evaluateCompletion(state, turnSummary) {
  // Check done signal from turn summary
  if (turnSummary?.done === true) {
    const gateOk = runHarnessGate(state);
    if (gateOk) {
      return { result: 'done', reason: 'Task completed — all gates passed', subtype: 'success' };
    }
    if (state.retryCount < state.maxRetries) {
      return { result: 'retrying', reason: DEFAULT_CONFIG.terminationReasons.gate_failed, subtype: 'gate_failed' };
    }
    return {
      result: 'escalated',
      reason: DEFAULT_CONFIG.terminationReasons.gate_failed + ' after max retries',
      subtype: 'error_gate_failed_max_retries',
    };
  }

  // Check explicit failure from agent
  if (turnSummary?.failed === true || turnSummary?.status === 'blocked') {
    if (state.retryCount < state.maxRetries) {
      return { result: 'retrying', reason: DEFAULT_CONFIG.terminationReasons.agent_failed, subtype: 'agent_failed' };
    }
    return {
      result: 'escalated',
      reason: DEFAULT_CONFIG.terminationReasons.agent_failed + ' after max retries',
      subtype: 'error_agent_failed',
    };
  }

  // Check turn limit
  if (state.currentTurn >= state.maxTurns && !turnSummary?.done) {
    return {
      result: 'escalated',
      reason: DEFAULT_CONFIG.terminationReasons.max_turns,
      subtype: 'error_max_turns',
    };
  }

  // More work needed
  return { result: 'implementing', reason: 'More agents needed — continue execution', subtype: 'continue' };
}

function runHarnessGate(state) {
  // Try harness completion gate first
  const gate = tryExec(
    `node scripts/harness/harness-completion-gate.mjs --task-id="${escapeShell(state.taskId)}"`,
    { timeout: 15_000 },
  );
  if (gate.ok && gate.stdout) {
    try {
      const parsed = JSON.parse(gate.stdout);
      if (parsed.passed === true || parsed.status === 'pass') return true;
    } catch { /* fall through */ }
  }

  // Fallback: run guardrails as minimum gate
  const guardrails = tryExec('npm run guardrails', { timeout: 30_000 });
  return guardrails.ok;
}

// ── Commands ───────────────────────────────────────────────────────────

function cmdInit(args) {
  let goal = '';
  let proposedFiles = [];
  let taskId = null;
  const overrides = {};

  for (const arg of args) {
    if (arg.startsWith('--goal=')) goal = arg.slice('--goal='.length);
    if (arg.startsWith('--files=')) proposedFiles = arg.slice('--files='.length).split(',').map(f => f.trim()).filter(Boolean);
    if (arg.startsWith('--task-id=')) taskId = arg.slice('--task-id='.length);
    if (arg.startsWith('--max-turns=')) overrides.maxTurns = parseInt(arg.slice('--max-turns='.length), 10) || undefined;
    if (arg.startsWith('--max-retries=')) overrides.maxRetries = parseInt(arg.slice('--max-retries='.length), 10) || undefined;
  }

  if (!goal) {
    console.error('Error: --goal is required. Provide a one-sentence mission.');
    process.exit(1);
  }

  taskId = taskId || `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const state = createLoopState(taskId, goal, proposedFiles, overrides);

  // Phase 1: Classify
  const classification = runHarnessAutoTrigger(goal, proposedFiles);
  state.tier = classification.tier;
  state.contractRequired = classification.contractRequired;
  const t1 = transitionTo(state, 'classified', `Tier ${classification.tier}: ${classification.reason}`);
  if (!t1.ok) {
    console.error(`State error: ${t1.error}`);
    process.exit(1);
  }

  // Phase 2: Contract check (if needed)
  if (state.contractRequired) {
    const gate = runContractGate(taskId, state.tier);
    if (gate.json?.ok && gate.json?.status === 'accepted') {
      state.contractAccepted = true;
      state.contractPath = gate.json.contractPath || null;
      transitionTo(state, 'contracted', 'Sprint Contract accepted');
    } else {
      // Contract exists but not accepted, or needs creation
      state.contractAccepted = false;
      transitionTo(state, 'contracted', gate.json?.reason || 'Sprint Contract required — not yet accepted');
    }
  } else {
    transitionTo(state, 'implementing', 'No contract required — ready to implement');
  }

  saveLoopState(state);

  const actions = buildNextActions(state);

  const output = {
    taskId: state.taskId,
    goal: state.goal,
    state: state.state,
    tier: state.tier,
    contractRequired: state.contractRequired,
    contractAccepted: state.contractAccepted,
    contractPath: state.contractPath,
    currentTurn: state.currentTurn,
    maxTurns: state.maxTurns,
    maxRetries: state.maxRetries,
    nextActions: actions,
    summary: buildStatusSummary(state),
  };

  console.log(JSON.stringify(output, null, 2));

  if (state.contractRequired && !state.contractAccepted) {
    process.exit(1); // Blocked — needs contract acceptance
  }
  process.exit(0);
}

function cmdTick(args) {
  let summaryRaw = '';

  for (const arg of args) {
    if (arg.startsWith('--summary=')) summaryRaw = arg.slice('--summary='.length);
  }

  // Try reading from stdin if no --summary
  if (!summaryRaw) {
    try {
      const stdinBuffer = fs.readFileSync(0, 'utf-8');
      if (stdinBuffer.trim()) summaryRaw = stdinBuffer.trim();
    } catch { /* no stdin */ }
  }

  let turnSummary = {};
  if (summaryRaw) {
    try {
      turnSummary = JSON.parse(summaryRaw);
    } catch {
      console.error('Error: --summary must be valid JSON (or pipe JSON to stdin)');
      process.exit(1);
    }
  }

  const state = loadLoopState();
  if (!state) {
    console.error('Error: No active loop. Run `init` first.');
    process.exit(1);
  }

  if (state.state === 'done' || state.state === 'escalated' || state.state === 'cancelled') {
    console.log(JSON.stringify({
      taskId: state.taskId,
      state: state.state,
      message: `Loop already in terminal state: ${state.state}`,
      hint: 'Run `reset` to start a new loop.',
    }, null, 2));
    process.exit(state.state === 'done' ? 0 : 2);
  }

  // Record the turn
  state.currentTurn += 1;
  state.currentAgent = turnSummary.agent || state.currentAgent;
  state.history.push({
    turn: state.currentTurn,
    agent: state.currentAgent || 'unknown',
    fromState: state.state,
    summary: turnSummary,
    timestamp: new Date().toISOString(),
  });

  // Transition to evaluating
  const t1 = transitionTo(state, 'evaluating', `Turn ${state.currentTurn} completed by ${state.currentAgent || 'agent'}`);
  if (!t1.ok) {
    console.error(`State error: ${t1.error}`);
    process.exit(1);
  }

  // Evaluate
  const evalResult = evaluateCompletion(state, turnSummary);

  switch (evalResult.result) {
    case 'done':
      transitionTo(state, 'done', evalResult.reason);
      break;
    case 'retrying':
      state.retryCount += 1;
      state.retryReason = evalResult.reason;
      transitionTo(state, 'retrying', evalResult.reason);
      // Auto-advance to implementing for next retry
      transitionTo(state, 'implementing', `Retry ${state.retryCount}/${state.maxRetries}`);
      break;
    case 'escalated':
      transitionTo(state, 'escalated', evalResult.reason);
      break;
    case 'implementing':
      transitionTo(state, 'implementing', evalResult.reason);
      break;
    default:
      transitionTo(state, 'implementing', 'Continuing execution');
  }

  saveLoopState(state);

  const actions = buildNextActions(state);

  const output = {
    taskId: state.taskId,
    goal: state.goal,
    state: state.state,
    tier: state.tier,
    currentTurn: state.currentTurn,
    maxTurns: state.maxTurns,
    retryCount: state.retryCount,
    maxRetries: state.maxRetries,
    evalResult: {
      result: evalResult.result,
      subtype: evalResult.subtype,
      reason: evalResult.reason,
    },
    nextActions: actions,
    summary: buildStatusSummary(state),
  };

  console.log(JSON.stringify(output, null, 2));

  if (state.state === 'done') process.exit(0);
  if (state.state === 'escalated') process.exit(2);
  process.exit(0);
}

function cmdStatus(args) {
  let format = 'json';
  for (const arg of args) {
    if (arg.startsWith('--format=')) format = arg.slice('--format='.length);
  }

  const state = loadLoopState();
  if (!state) {
    if (format === 'markdown') {
      console.log('# No Active Loop\n\nRun `node scripts/orchestration/orchestration-loop.mjs init --goal="..."` to start.');
    } else {
      console.log(JSON.stringify({ active: false, hint: 'Run init --goal="..." to start' }, null, 2));
    }
    process.exit(0);
  }

  if (format === 'markdown') {
    console.log(buildStatusMarkdown(state));
  } else {
    const actions = buildNextActions(state);
    console.log(JSON.stringify({ ...state, nextActions: actions, summary: buildStatusSummary(state) }, null, 2));
  }
}

function cmdReset() {
  if (fs.existsSync(LOOP_STATE_FILE)) {
    fs.unlinkSync(LOOP_STATE_FILE);
    console.log(JSON.stringify({ reset: true, message: 'Loop state cleared' }));
  } else {
    console.log(JSON.stringify({ reset: true, message: 'No active loop to reset' }));
  }
}

function cmdTerminate(args) {
  let reason = 'human_abort';
  for (const arg of args) {
    if (arg.startsWith('--reason=')) reason = arg.slice('--reason='.length);
  }

  const state = loadLoopState();
  if (!state) {
    console.log(JSON.stringify({ terminated: false, reason: 'No active loop' }));
    process.exit(0);
  }

  transitionTo(state, 'cancelled', reason || DEFAULT_CONFIG.terminationReasons.human_abort);
  saveLoopState(state);

  console.log(JSON.stringify({
    terminated: true,
    taskId: state.taskId,
    state: state.state,
    reason,
    totalTurns: state.currentTurn,
    totalRetries: state.retryCount,
  }, null, 2));
}

// ── Display Helpers ────────────────────────────────────────────────────

function buildStatusSummary(state) {
  const labels = {
    idle:         'Waiting to start',
    classified:   state.contractRequired ? 'Needs Sprint Contract' : 'Ready to implement',
    contracted:   state.contractAccepted ? 'Contract accepted — ready' : 'Contract pending acceptance',
    implementing: `Implementing — turn ${state.currentTurn}/${state.maxTurns}`,
    evaluating:   'Evaluating completion...',
    done:         'Complete',
    retrying:     `Retrying (${state.retryCount}/${state.maxRetries})`,
    escalated:    'Escalated — needs human intervention',
    cancelled:    'Cancelled',
  };

  return {
    icon: ICONS[state.state] || '?',
    phase: state.state,
    phaseLabel: labels[state.state] || state.state,
    turn: `${state.currentTurn}/${state.maxTurns}`,
    retries: `${state.retryCount}/${state.maxRetries}`,
    goal: state.goal,
    tier: state.tier ? `Tier ${state.tier}` : 'unclassified',
    agent: state.currentAgent || 'none',
  };
}

function buildStatusMarkdown(state) {
  const s = buildStatusSummary(state);

  let md = `# ${s.icon} Agent Loop\n\n`;
  md += `**Task:** \`${state.taskId}\`\n`;
  md += `**Goal:** ${state.goal}\n`;
  md += `**State:** ${s.phaseLabel}\n`;
  md += `**Tier:** ${s.tier} | **Turn:** ${s.turn} | **Retries:** ${s.retries} | **Agent:** ${s.agent}\n`;
  md += `**Created:** ${state.createdAt} | **Updated:** ${state.updatedAt}\n\n`;

  if (state.contractRequired) {
    md += `**Contract:** ${state.contractAccepted ? 'accepted' : 'pending'}${state.contractPath ? ` (${path.basename(state.contractPath)})` : ''}\n\n`;
  }

  if (state.proposedFiles.length > 0) {
    md += `**Files:** ${state.proposedFiles.join(', ')}\n\n`;
  }

  if (state.history.length > 0) {
    md += '## Turn History\n\n';
    md += '| Turn | Agent | From | Status |\n';
    md += '|------|-------|------|--------|\n';
    for (const h of state.history.slice(-15)) {
      const status = h.summary?.done ? '✅ done'
        : h.summary?.failed ? '❌ failed'
        : h.summary?.learned?.slice(0, 40) || '—';
      md += `| ${h.turn} | ${h.agent} | ${h.fromState} | ${status} |\n`;
    }
  }

  if (state.state === 'escalated') {
    md += `\n## 🚨 Escalation Required\n\n`;
    md += `**Reason:** ${state.retryReason || 'Unknown'}\n`;
    md += `**Retries exhausted:** ${state.retryCount}/${state.maxRetries}\n\n`;
    md += 'Escalate to **Supervisor** for manual intervention.\n';
  } else if (state.state === 'done') {
    md += '\n## ✅ Complete\n\n';
    md += `Finished in ${state.currentTurn} turn(s). Run \`reset\` to clear loop state.\n`;
  }

  return md;
}

// ── Main ───────────────────────────────────────────────────────────────

function printUsage() {
  console.error(`orchestration-loop.mjs — Autonomous Agent Loop Runtime

Commands:
  init       Start a new agent loop
    --goal=<text>       Required. One-sentence mission
    --files=<a,b,c>     Comma-separated file paths
    --task-id=<id>      Optional. Auto-generated if not given
    --max-turns=<n>     Max tool-use turns (default: 10)
    --max-retries=<n>   Max evaluation retries (default: 3)

  tick       Process a turn summary and advance state
    --summary='{...}'   JSON turn summary (or pipe via stdin)

  status     Show current loop state
    --format=json|markdown  Output format (default: json)

  reset      Clear current loop state

  terminate  Force-terminate the loop
    --reason=<text>     Termination reason

Examples:
  # Start a new task
  node scripts/orchestration/orchestration-loop.mjs init \\
    --goal="Fix the auth bug in login flow" \\
    --files="apps/server/src/routes/domains/auth.ts"

  # After agent completes work, tick the loop
  echo '{"done":true,"agent":"Backend Engineer"}' | \\
    node scripts/orchestration/orchestration-loop.mjs tick

  # Check current state
  node scripts/orchestration/orchestration-loop.mjs status --format=markdown`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case 'init':
      cmdInit(rest);
      break;
    case 'tick':
      cmdTick(rest);
      break;
    case 'status':
      cmdStatus(rest);
      break;
    case 'reset':
      cmdReset();
      break;
    case 'terminate':
      cmdTerminate(rest);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main();
