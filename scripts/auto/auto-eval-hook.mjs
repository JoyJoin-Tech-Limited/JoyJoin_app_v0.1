#!/usr/bin/env node
/**
 * Pre-tool use: by default Auto-Eval **warns** on failure but still **allows** guarded tools
 * (soft gate), so the agent can apply fixes without a deadlock. Set
 * `JOYJOIN_AUTO_EVAL_STRICT=1` to restore deny-on-fail behavior.
 */
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWorkspace, readPassCache, RUBRIC_VERSION } from './auto-eval-core.mjs';

const STRICT_AUTO_EVAL = process.env.JOYJOIN_AUTO_EVAL_STRICT === '1';

const DEFAULT_GUARDED_TOOL_HINTS = [
  'apply_patch',
  'create_file',
  'edit',
  'execute',
  'run_in_terminal',
  'send_to_terminal',
  'create_and_run_task',
  'create_new_workspace',
  'run_vscode_command',
  'install_extension',
];
const AUTO_EVAL_COMMAND_HINTS = ['auto-eval.mjs', 'auto-eval-hook.mjs'];
const DEFAULT_MANUAL_RECOVERY_AGENTS = ['Auto-Eval', 'Supervisor'];

function loadOrchestrationAutoEvalPolicy() {
  try {
    const manifestPath = path.join(process.cwd(), '.github', 'orchestration.yaml');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return {
      guardedToolHints: manifest.copilot_hooks?.auto_eval?.guarded_tool_hints ?? [],
      manualRecoveryAgents: manifest.copilot_hooks?.auto_eval?.manual_recovery_agents ?? [],
    };
  } catch {
    return null;
  }
}

function getGuardedToolHints() {
  const policy = loadOrchestrationAutoEvalPolicy();
  return [...new Set([...DEFAULT_GUARDED_TOOL_HINTS, ...(policy?.guardedToolHints ?? [])])];
}

function getManualRecoveryAgents() {
  const policy = loadOrchestrationAutoEvalPolicy();
  const agents = policy?.manualRecoveryAgents ?? [];
  return agents.length > 0 ? agents : DEFAULT_MANUAL_RECOVERY_AGENTS;
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload() {
  const raw = readStdin().trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function output(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function getToolName(payload) {
  const candidates = [
    payload.toolName,
    payload.tool_name,
    payload.tool?.name,
    payload.name,
    payload.request?.toolName,
    payload.tool_input?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }

  return null;
}

function getCommandText(payload) {
  const candidates = [
    payload.command,
    payload.input?.command,
    payload.toolInput?.command,
    payload.tool_input?.command,
    payload.arguments?.command,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }

  return null;
}

function isGuardedTool(toolName) {
  if (!toolName) {
    return false;
  }

  const normalized = toolName.toLowerCase();
  return getGuardedToolHints().some((hint) => normalized.includes(hint));
}

function isAutoEvalSelfCheck(payload) {
  const commandText = getCommandText(payload);
  if (!commandText) {
    return false;
  }

  return AUTO_EVAL_COMMAND_HINTS.some((hint) => commandText.includes(hint));
}

function summarizeTopFinding(result) {
  const failingModule = result.modules.find((module) => module.status === 'fail' || module.status === 'system-error');
  const findings = failingModule ? failingModule.findings : result.modules.flatMap((module) => module.findings);
  const blockerFinding = findings.find((finding) => finding.severity === 'blocker');
  const finding = blockerFinding ?? findings[0];

  if (!finding && result.reason) {
    return result.reason;
  }

  if (!finding) {
    return 'No additional finding details were captured.';
  }

  const location = finding.filePath
    ? finding.line
      ? `${finding.filePath}:${finding.line}`
      : finding.filePath
    : 'workspace';

  return `${location} — ${finding.message}`;
}

function allowResponse(reason, systemMessage = null) {
  const payload = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
    },
  };

  if (systemMessage) {
    payload.systemMessage = systemMessage;
  }

  return payload;
}

function denyResponse(reason, systemMessage) {
  return {
    continue: true,
    systemMessage,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

const mode = process.argv[2] ?? 'session-start';
const payload = parsePayload();

if (mode === 'session-start') {
  try {
    const result = evaluateWorkspace({ mode: 'session-start' });
    const recoveryAgents = getManualRecoveryAgents().join(', ');

    if (result.cleanWorktree) {
      output({ continue: true });
    }

    if (result.status === 'pass') {
      output({
        continue: true,
        systemMessage: `Auto-Eval passed for dirty worktree ${result.fingerprintShort} (quality ${result.overallQuality}, confidence ${result.overallConfidence}).`,
      });
    }

    if (result.status === 'fail') {
      output({
        continue: true,
        systemMessage: `Auto-Eval found blocking issues for dirty worktree ${result.fingerprintShort}. Edit and execute tools will stay blocked until this fingerprint passes. Top finding: ${summarizeTopFinding(result)}. Recommended manual path: ${recoveryAgents}.`,
      });
    }

    output({
      continue: true,
      systemMessage: `Auto-Eval warning: hook failed open because evaluation infrastructure did not complete cleanly. ${result.reason ?? 'Run Auto-Eval manually for a detailed report.'}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output({
      continue: true,
      systemMessage: `Auto-Eval warning: hook failed open because of an infrastructure error: ${message}`,
    });
  }
}

if (mode === 'pre-tool-use') {
  const toolName = getToolName(payload);

  if (!isGuardedTool(toolName)) {
    output(allowResponse('Tool is outside the guarded edit/execute set.'));
  }

  if (isAutoEvalSelfCheck(payload)) {
    output(allowResponse('Auto-Eval self-check command is always allowed.'));
  }

  try {
    const result = evaluateWorkspace({ mode: 'pre-tool-use' });
    const recoveryAgents = getManualRecoveryAgents().join(', ');

    if (result.cleanWorktree) {
      output(allowResponse('Clean worktree; no auto-eval gate applies.'));
    }

    const cache = readPassCache(result.repoRoot);
    if (
      cache &&
      cache.pass === true &&
      cache.rubricVersion === RUBRIC_VERSION &&
      cache.fingerprint === result.fingerprint
    ) {
      output(allowResponse('Auto-Eval pass cache matches the current dirty-worktree fingerprint.'));
    }

    if (result.status === 'pass') {
      output(allowResponse('Auto-Eval passed the current dirty-worktree fingerprint.'));
    }

    if (result.status === 'fail') {
      const detail = `Auto-Eval: dirty worktree ${result.fingerprintShort} has not passed. Top finding: ${summarizeTopFinding(result)}. Run \`node scripts/auto/auto-eval.mjs\` after fixes. Recommended: ${recoveryAgents}.`;
      if (STRICT_AUTO_EVAL) {
        output(
          denyResponse(
            'Auto-Eval requires a passing result for the current dirty-worktree fingerprint before edit or execute tools may run.',
            `Auto-Eval blocked this tool because the current dirty worktree has not passed evaluation. Fingerprint ${result.fingerprintShort}. Top finding: ${summarizeTopFinding(result)}. Re-run Auto-Eval to refresh the report after fixing the issue. Recommended manual path: ${recoveryAgents}.`,
          ),
          2,
        );
      }
      output(
        allowResponse(
          'Auto-Eval reported issues; allowing tool (soft gate). Set JOYJOIN_AUTO_EVAL_STRICT=1 to block on failure.',
          detail,
        ),
      );
    }

    output(
      allowResponse(
        'Auto-Eval failed open because the evaluation infrastructure did not complete cleanly.',
        `Auto-Eval warning: allowing this tool because evaluation infrastructure did not complete cleanly. ${result.reason ?? 'Run Auto-Eval manually for a detailed report.'}`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output(
      allowResponse(
        'Auto-Eval failed open because the hook wrapper encountered an infrastructure error.',
        `Auto-Eval warning: allowing this tool because the hook wrapper hit an infrastructure error: ${message}`,
      ),
    );
  }
}

output({
  continue: true,
  systemMessage: `Auto-Eval hook mode ${mode} is not supported.`,
});
