#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTEXT_EXAMPLE_RELATIVE_PATH,
  MANIFEST_RELATIVE_PATH,
  RUNTIME_CONTEXT_RELATIVE_PATH,
  RUNTIME_EVENT_LOG_RELATIVE_PATH,
  appendOrchestrationLog,
  buildToolingAuditSummary,
  collectChangedFiles,
  loadOrchestrationManifest,
  loadRuntimeContext,
  resolveRepoRoot,
  runCommand,
  shouldRunStep,
  validateOrchestrationManifest,
  writeRuntimeContext,
} from './orchestration-lib.mjs';

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseStdinJson() {
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

function outputText(text) {
  process.stdout.write(`${text}\n`);
}

function outputJson(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function relativeExists(repoRoot, relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function getGitValue(repoRoot, args) {
  const result = runCommand('git', args, {
    cwd: repoRoot,
    timeoutMs: 5_000,
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function summarizeOrchestratedAgents(manifest) {
  return (manifest.portfolio_scope?.orchestrated_agents ?? []).join(', ');
}

function buildHookContext(repoRoot, eventName, payload, manifest) {
  const existingContext = loadRuntimeContext(repoRoot);
  const changedFiles = collectChangedFiles(repoRoot);
  const now = new Date().toISOString();

  return {
    ...existingContext,
    event: eventName,
    triggerSource: 'copilot_hook',
    commitSha: getGitValue(repoRoot, ['rev-parse', 'HEAD']),
    branch: getGitValue(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
    prNumber: existingContext.prNumber ?? null,
    changedFiles,
    diffSummary:
      changedFiles.length > 0
        ? `Recent dirty-worktree scope: ${changedFiles.slice(0, 12).join(', ')}`
        : existingContext.diffSummary ?? 'No changed files detected.',
    testOutputs: existingContext.testOutputs ?? [],
    reviewComments: existingContext.reviewComments ?? [],
    artifactPaths: [
      RUNTIME_CONTEXT_RELATIVE_PATH,
      RUNTIME_EVENT_LOG_RELATIVE_PATH,
      ...(existingContext.artifactPaths ?? []),
    ].filter((value, index, array) => array.indexOf(value) === index),
    upstreamAgent: payload.agentName ?? existingContext.upstreamAgent ?? null,
    upstreamResult: {
      toolName: payload.toolName ?? payload.tool?.name ?? null,
      toolCommand:
        payload.command ?? payload.input?.command ?? payload.toolInput?.command ?? payload.arguments?.command ?? null,
      manifestVersion: manifest.updated,
    },
    retryCount: 0,
    recommendedNextAgents: manifest.copilot_hooks?.auto_eval?.manual_recovery_agents ?? ['Auto-Eval', 'Supervisor'],
    lastUpdatedAt: now,
  };
}

function writeWorkflowSummary(text) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  fs.appendFileSync(summaryPath, `${text}\n`, 'utf8');
}

function formatShellFailure(stepResult) {
  const stderr = stepResult.stderr?.trim();
  const stdout = stepResult.stdout?.trim();
  return stderr || stdout || `${stepResult.commandLine} failed.`;
}

function runShellStep(repoRoot, step, retryPolicy) {
  let lastResult = null;

  for (let attempt = 1; attempt <= retryPolicy.attempts; attempt += 1) {
    lastResult = runCommand(step.command, step.args ?? [], {
      cwd: repoRoot,
      timeoutMs: step.timeout_ms ?? 90_000,
    });

    if (lastResult.status === 0) {
      return {
        ...lastResult,
        id: step.id,
        type: step.type,
        attempts: attempt,
        statusLabel: 'passed',
      };
    }
  }

  return {
    ...lastResult,
    id: step.id,
    type: step.type,
    attempts: retryPolicy.attempts,
    statusLabel: 'failed',
  };
}

function executeSequence(repoRoot, steps, manifest, changedFiles) {
  const retryPolicy = manifest.retry_policy?.default ?? { attempts: 1, backoff_ms: 0 };
  const results = [];
  let failed = false;

  for (const step of steps) {
    if (!shouldRunStep(step, changedFiles)) {
      results.push({
        id: step.id,
        type: step.type,
        statusLabel: 'skipped',
        summary: 'Skipped because changed files did not match the step condition.',
      });
      continue;
    }

    if (step.type === 'shell') {
      const result = runShellStep(repoRoot, step, retryPolicy);
      results.push({
        id: step.id,
        type: step.type,
        statusLabel: result.statusLabel,
        summary:
          result.statusLabel === 'passed'
            ? `${result.commandLine} passed.`
            : `${result.commandLine} failed after ${result.attempts} attempt(s).`,
        commandLine: result.commandLine,
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      if (result.statusLabel !== 'passed') {
        failed = true;
        break;
      }
      continue;
    }

    if (step.type === 'advisory-agent') {
      const binding = manifest.agent_bindings?.[step.agent];
      const skills = Array.isArray(step.skills) && step.skills.length > 0 ? step.skills.join(', ') : 'none';
      results.push({
        id: step.id,
        type: step.type,
        statusLabel: 'advisory',
        summary: `${step.agent}: ${step.summary} Skills: ${skills}. Tooling status: ${binding?.tooling_assessment?.status ?? 'unknown'}.`,
      });
      continue;
    }

    if (step.type === 'log') {
      appendOrchestrationLog(repoRoot, {
        recordedAt: new Date().toISOString(),
        triggerSource: 'sequence-log',
        stepId: step.id,
        message: step.message,
      });
      results.push({
        id: step.id,
        type: step.type,
        statusLabel: 'logged',
        summary: step.message,
      });
    }
  }

  return {
    failed,
    results,
  };
}

function validateContextExample(repoRoot, manifest, validationErrors) {
  const examplePath = path.join(repoRoot, CONTEXT_EXAMPLE_RELATIVE_PATH);

  if (!fs.existsSync(examplePath)) {
    validationErrors.push(`Missing ${CONTEXT_EXAMPLE_RELATIVE_PATH}.`);
    return;
  }

  const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  const requiredFields = manifest.context_contract?.required_fields ?? [];
  for (const field of requiredFields) {
    if (!(field in example)) {
      validationErrors.push(`${CONTEXT_EXAMPLE_RELATIVE_PATH} is missing required field ${field}.`);
    }
  }
}

function validateReferencedFiles(repoRoot, manifest, validationErrors) {
  const references = [
    MANIFEST_RELATIVE_PATH,
    CONTEXT_EXAMPLE_RELATIVE_PATH,
    '.github/hooks/auto-eval.json',
    '.github/hooks/orchestration.json',
    '.github/workflows/orchestrate.yml',
  ];

  for (const binding of Object.values(manifest.agent_bindings ?? {})) {
    if (typeof binding.file === 'string') {
      references.push(binding.file);
    }
  }

  for (const reference of references) {
    if (!relativeExists(repoRoot, reference)) {
      validationErrors.push(`Referenced file is missing: ${reference}.`);
    }
  }
}

function runValidate(repoRoot) {
  const manifest = loadOrchestrationManifest(repoRoot);
  const validation = validateOrchestrationManifest(manifest);
  validateContextExample(repoRoot, manifest, validation.errors);
  validateReferencedFiles(repoRoot, manifest, validation.errors);

  if (!validation.valid || validation.errors.length > 0) {
    outputText('Orchestration validation failed:');
    for (const error of validation.errors) {
      outputText(`- ${error}`);
    }
    process.exit(1);
  }

  outputText('Orchestration validation passed.');
  for (const warning of validation.warnings) {
    outputText(`Warning: ${warning}`);
  }
}

function runCopilotHook(repoRoot, eventName) {
  const payload = parseStdinJson();
  const manifest = loadOrchestrationManifest(repoRoot);
  const validation = validateOrchestrationManifest(manifest);

  if (!validation.valid) {
    outputJson({
      continue: true,
      systemMessage: `Orchestration warning: ${MANIFEST_RELATIVE_PATH} is invalid. ${validation.errors[0]}`,
    });
  }

  const context = buildHookContext(repoRoot, eventName, payload, manifest);
  writeRuntimeContext(repoRoot, context);
  appendOrchestrationLog(repoRoot, {
    recordedAt: new Date().toISOString(),
    triggerSource: 'copilot_hook',
    event: eventName,
    payloadSummary: {
      toolName: payload.toolName ?? payload.tool?.name ?? null,
    },
  });

  if (eventName === 'session-start') {
    outputJson({
      continue: true,
      systemMessage: `${manifest.copilot_hooks?.orchestration?.session_start_message ?? 'Orchestration runtime ready.'} Core graph: ${summarizeOrchestratedAgents(manifest)}.`,
    });
  }

  outputJson({ continue: true });
}

function runGitHook(repoRoot, hookName) {
  const manifest = loadOrchestrationManifest(repoRoot);
  const hookDefinition = manifest.git_hooks?.[hookName];

  if (!hookDefinition) {
    throw new Error(`Unknown git hook ${hookName}.`);
  }

  const changedFiles = collectChangedFiles(repoRoot);
  const sequence = executeSequence(repoRoot, hookDefinition.steps ?? [], manifest, changedFiles);

  appendOrchestrationLog(repoRoot, {
    recordedAt: new Date().toISOString(),
    triggerSource: 'git_hook',
    hookName,
    changedFiles,
    results: sequence.results.map((item) => ({ id: item.id, statusLabel: item.statusLabel })),
  });

  outputText(`Orchestration git hook: ${hookName}`);
  for (const result of sequence.results) {
    outputText(`- ${result.id}: ${result.summary}`);
  }

  if (sequence.failed && hookDefinition.blocking) {
    const failedStep = sequence.results.find((result) => result.statusLabel === 'failed');
    outputText(`Blocking failure: ${failedStep ? failedStep.summary : 'Unknown step failure.'}`);
    if (failedStep?.stderr || failedStep?.stdout) {
      outputText(formatShellFailure(failedStep));
    }
    process.exit(1);
  }
}

function runWorkflow(repoRoot, workflowName) {
  const manifest = loadOrchestrationManifest(repoRoot);
  const workflowDefinition = manifest.github_workflows?.[workflowName];

  if (!workflowDefinition) {
    throw new Error(`Unknown workflow target ${workflowName}.`);
  }

  const changedFiles = collectChangedFiles(repoRoot);
  const sequence = executeSequence(repoRoot, workflowDefinition.steps ?? [], manifest, changedFiles);
  const lines = [
    `## ${workflowDefinition.summary_title}`,
    '',
    `Changed files in scope: ${changedFiles.length === 0 ? 'none detected' : changedFiles.join(', ')}`,
    '',
    'Sequence results:',
  ];

  for (const result of sequence.results) {
    lines.push(`- ${result.id}: ${result.summary}`);
  }

  writeWorkflowSummary(lines.join('\n'));
  outputText(lines.join('\n'));

  appendOrchestrationLog(repoRoot, {
    recordedAt: new Date().toISOString(),
    triggerSource: 'github_workflow',
    workflowName,
    changedFiles,
    results: sequence.results.map((item) => ({ id: item.id, statusLabel: item.statusLabel })),
  });

  if (sequence.failed) {
    process.exit(1);
  }
}

function runToolingReport(repoRoot, asJson) {
  const manifest = loadOrchestrationManifest(repoRoot);
  const toolingSummary = buildToolingAuditSummary(manifest);

  if (asJson) {
    outputJson({
      counts: toolingSummary.counts,
      findings: toolingSummary.lines,
    });
  }

  outputText('Agent tooling sufficiency');
  outputText(`- sufficient: ${toolingSummary.counts.sufficient}`);
  outputText(`- partial: ${toolingSummary.counts.partial}`);
  outputText(`- legacy: ${toolingSummary.counts.legacy}`);
  outputText(`- needs-extension: ${toolingSummary.counts['needs-extension']}`);
  if (toolingSummary.lines.length > 0) {
    outputText('');
    for (const line of toolingSummary.lines) {
      outputText(line);
    }
  }
}

const repoRoot = resolveRepoRoot(process.cwd());
const command = process.argv[2] ?? 'validate';

try {
  if (command === 'validate') {
    runValidate(repoRoot);
    process.exit(0);
  }

  if (command === 'copilot-hook') {
    runCopilotHook(repoRoot, process.argv[3] ?? 'session-start');
  }

  if (command === 'git-hook') {
    runGitHook(repoRoot, process.argv[3] ?? 'pre-commit');
    process.exit(0);
  }

  if (command === 'workflow') {
    runWorkflow(repoRoot, process.argv[3] ?? 'pull-request');
    process.exit(0);
  }

  if (command === 'tooling-report') {
    runToolingReport(repoRoot, process.argv.includes('--json'));
    process.exit(0);
  }

  throw new Error(`Unknown orchestration supervisor command ${command}.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Orchestration supervisor error: ${message}\n`);
  process.exit(1);
}