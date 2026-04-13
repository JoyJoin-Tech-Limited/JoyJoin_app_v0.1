#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ORCHESTRATION_VERSION = 1;
export const MANIFEST_RELATIVE_PATH = path.join('.github', 'orchestration.yaml');
export const CONTEXT_EXAMPLE_RELATIVE_PATH = path.join('.github', 'orchestration-context.example.json');
export const RUNTIME_DIR_RELATIVE_PATH = path.join('.git', '.orchestration');
export const RUNTIME_CONTEXT_RELATIVE_PATH = path.join(RUNTIME_DIR_RELATIVE_PATH, 'context.json');
export const RUNTIME_EVENT_LOG_RELATIVE_PATH = path.join(RUNTIME_DIR_RELATIVE_PATH, 'events.jsonl');

const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const STEP_TYPES = new Set(['shell', 'advisory-agent', 'log']);
const TOOLING_STATUSES = new Set(['sufficient', 'partial', 'legacy', 'needs-extension']);

function runtimeWritesDisabled() {
  return process.env.ORCHESTRATION_DISABLE_RUNTIME_WRITES === '1';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: MAX_BUFFER_BYTES,
  });

  return {
    command,
    args,
    commandLine: [command, ...args].join(' '),
    cwd: options.cwd,
    status: typeof result.status === 'number' ? result.status : null,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

export function resolveRepoRoot(startDir = process.cwd()) {
  const result = runCommand('git', ['rev-parse', '--show-toplevel'], {
    cwd: startDir,
    timeoutMs: 5_000,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.error || 'Unable to resolve git repository root');
  }

  return result.stdout.trim();
}

export function readJsonCompatibleYaml(content, description = MANIFEST_RELATIVE_PATH) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `${description} must remain JSON-compatible YAML so it can be parsed deterministically without extra dependencies. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function loadOrchestrationManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, MANIFEST_RELATIVE_PATH);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing orchestration manifest at ${MANIFEST_RELATIVE_PATH}`);
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  return readJsonCompatibleYaml(raw, MANIFEST_RELATIVE_PATH);
}

function requireString(container, key, location, errors) {
  if (typeof container?.[key] !== 'string' || container[key].trim() === '') {
    errors.push(`${location}.${key} must be a non-empty string.`);
  }
}

function requireArray(container, key, location, errors) {
  if (!Array.isArray(container?.[key])) {
    errors.push(`${location}.${key} must be an array.`);
  }
}

function requireObject(container, key, location, errors) {
  if (!isPlainObject(container?.[key])) {
    errors.push(`${location}.${key} must be an object.`);
  }
}

function validateStringArray(value, location, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array of strings.`);
    return;
  }

  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${location} must only contain non-empty strings.`);
      return;
    }
  }
}

function validateRecommendedExtensions(extensions, location, errors) {
  if (!Array.isArray(extensions)) {
    errors.push(`${location} must be an array.`);
    return;
  }

  for (const [index, extension] of extensions.entries()) {
    const extensionLocation = `${location}[${index}]`;
    if (!isPlainObject(extension)) {
      errors.push(`${extensionLocation} must be an object.`);
      continue;
    }

    requireString(extension, 'type', extensionLocation, errors);
    requireString(extension, 'label', extensionLocation, errors);
    requireString(extension, 'reason', extensionLocation, errors);
  }
}

function validateStep(step, location, agentBindings, errors) {
  if (!isPlainObject(step)) {
    errors.push(`${location} must be an object.`);
    return;
  }

  requireString(step, 'id', location, errors);
  requireString(step, 'type', location, errors);

  if (typeof step.type === 'string' && !STEP_TYPES.has(step.type)) {
    errors.push(`${location}.type must be one of ${Array.from(STEP_TYPES).join(', ')}.`);
  }

  if (step.type === 'shell') {
    requireString(step, 'command', location, errors);
    if ('args' in step) {
      validateStringArray(step.args, `${location}.args`, errors);
    }
  }

  if (step.type === 'advisory-agent') {
    requireString(step, 'agent', location, errors);
    if (typeof step.agent === 'string' && !agentBindings[step.agent]) {
      errors.push(`${location}.agent references unknown agent ${step.agent}.`);
    }
    if ('skills' in step) {
      validateStringArray(step.skills, `${location}.skills`, errors);
    }
    requireString(step, 'summary', location, errors);
  }

  if (step.type === 'log') {
    requireString(step, 'message', location, errors);
  }

  if ('when' in step && !isPlainObject(step.when)) {
    errors.push(`${location}.when must be an object when present.`);
  }

  if (isPlainObject(step.when) && 'any_path_matches' in step.when) {
    validateStringArray(step.when.any_path_matches, `${location}.when.any_path_matches`, errors);
  }
}

function validateKickoffLane(kickoffLane, location, agentNames, errors) {
  if (!isPlainObject(kickoffLane)) {
    errors.push(`${location} must be an object.`);
    return;
  }

  validateStringArray(kickoffLane.entry_agents, `${location}.entry_agents`, errors);
  requireString(kickoffLane, 'approval_mode', location, errors);

  if (typeof kickoffLane.recommend_on_first_broad_prompt !== 'boolean') {
    errors.push(`${location}.recommend_on_first_broad_prompt must be a boolean.`);
  }

  if (!isPlainObject(kickoffLane.broad_prompt_signals)) {
    errors.push(`${location}.broad_prompt_signals must be an object.`);
  } else {
    if (!Number.isInteger(kickoffLane.broad_prompt_signals.min_words) || kickoffLane.broad_prompt_signals.min_words < 1) {
      errors.push(`${location}.broad_prompt_signals.min_words must be an integer >= 1.`);
    }
    validateStringArray(kickoffLane.broad_prompt_signals.verbs, `${location}.broad_prompt_signals.verbs`, errors);
    validateStringArray(kickoffLane.broad_prompt_signals.scope_terms, `${location}.broad_prompt_signals.scope_terms`, errors);
  }

  for (const agentName of kickoffLane.entry_agents ?? []) {
    if (!agentNames.has(agentName)) {
      errors.push(`${location}.entry_agents references unknown agent ${agentName}.`);
    }
  }
}

export function validateOrchestrationManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(manifest)) {
    return {
      valid: false,
      errors: ['Manifest root must be an object.'],
      warnings,
    };
  }

  if (manifest.version !== ORCHESTRATION_VERSION) {
    errors.push(`version must be ${ORCHESTRATION_VERSION}.`);
  }

  requireString(manifest, 'updated', 'manifest', errors);
  requireObject(manifest, 'portfolio_scope', 'manifest', errors);
  requireObject(manifest, 'copilot_hooks', 'manifest', errors);
  requireObject(manifest, 'git_hooks', 'manifest', errors);
  requireObject(manifest, 'github_workflows', 'manifest', errors);
  requireArray(manifest, 'handoff_graph', 'manifest', errors);
  requireObject(manifest, 'agent_bindings', 'manifest', errors);
  requireObject(manifest, 'skill_bindings', 'manifest', errors);
  requireObject(manifest, 'retry_policy', 'manifest', errors);
  requireObject(manifest, 'preconditions', 'manifest', errors);
  requireObject(manifest, 'context_contract', 'manifest', errors);
  requireObject(manifest, 'logging', 'manifest', errors);

  const agentBindings = isPlainObject(manifest.agent_bindings) ? manifest.agent_bindings : {};
  const agentNames = new Set(Object.keys(agentBindings));

  for (const [agentName, binding] of Object.entries(agentBindings)) {
    const location = `agent_bindings.${agentName}`;

    if (!isPlainObject(binding)) {
      errors.push(`${location} must be an object.`);
      continue;
    }

    requireString(binding, 'file', location, errors);
    requireString(binding, 'portfolio_role', location, errors);
    requireString(binding, 'orchestration_status', location, errors);
    validateStringArray(binding.current_tools, `${location}.current_tools`, errors);

    if (!isPlainObject(binding.tooling_assessment)) {
      errors.push(`${location}.tooling_assessment must be an object.`);
      continue;
    }

    requireString(binding.tooling_assessment, 'status', `${location}.tooling_assessment`, errors);
    requireString(binding.tooling_assessment, 'summary', `${location}.tooling_assessment`, errors);
    validateRecommendedExtensions(
      binding.tooling_assessment.recommended_extensions,
      `${location}.tooling_assessment.recommended_extensions`,
      errors,
    );

    if (
      typeof binding.tooling_assessment.status === 'string' &&
      !TOOLING_STATUSES.has(binding.tooling_assessment.status)
    ) {
      errors.push(`${location}.tooling_assessment.status must be one of ${Array.from(TOOLING_STATUSES).join(', ')}.`);
    }
  }

  const portfolioScope = manifest.portfolio_scope;
  if (isPlainObject(portfolioScope)) {
    validateStringArray(portfolioScope.kickoff_agents, 'portfolio_scope.kickoff_agents', errors);
    validateStringArray(portfolioScope.orchestrated_agents, 'portfolio_scope.orchestrated_agents', errors);
    validateStringArray(portfolioScope.audited_agents, 'portfolio_scope.audited_agents', errors);

    for (const groupName of ['kickoff_agents', 'orchestrated_agents', 'audited_agents']) {
      const group = Array.isArray(portfolioScope[groupName]) ? portfolioScope[groupName] : [];
      for (const agentName of group) {
        if (!agentNames.has(agentName)) {
          errors.push(`portfolio_scope.${groupName} references unknown agent ${agentName}.`);
        }
      }
    }
  }

  if (Array.isArray(manifest.handoff_graph)) {
    for (const [index, handoff] of manifest.handoff_graph.entries()) {
      const location = `handoff_graph[${index}]`;
      if (!isPlainObject(handoff)) {
        errors.push(`${location} must be an object.`);
        continue;
      }

      requireString(handoff, 'from', location, errors);
      requireString(handoff, 'to', location, errors);
      requireString(handoff, 'label', location, errors);
      requireString(handoff, 'prompt', location, errors);

      if (typeof handoff.from === 'string' && !agentNames.has(handoff.from)) {
        errors.push(`${location}.from references unknown agent ${handoff.from}.`);
      }

      if (typeof handoff.to === 'string' && !agentNames.has(handoff.to)) {
        errors.push(`${location}.to references unknown agent ${handoff.to}.`);
      }
    }
  }

  if (isPlainObject(manifest.skill_bindings)) {
    for (const [agentName, skills] of Object.entries(manifest.skill_bindings)) {
      if (!agentNames.has(agentName)) {
        errors.push(`skill_bindings references unknown agent ${agentName}.`);
      }
      validateStringArray(skills, `skill_bindings.${agentName}`, errors);
    }
  }

  const copilotHooks = manifest.copilot_hooks;
  if (isPlainObject(copilotHooks)) {
    if (!isPlainObject(copilotHooks.auto_eval)) {
      errors.push('copilot_hooks.auto_eval must be an object.');
    } else {
      validateStringArray(copilotHooks.auto_eval.guarded_tool_hints, 'copilot_hooks.auto_eval.guarded_tool_hints', errors);
      validateStringArray(copilotHooks.auto_eval.manual_recovery_agents, 'copilot_hooks.auto_eval.manual_recovery_agents', errors);

      for (const agentName of copilotHooks.auto_eval.manual_recovery_agents ?? []) {
        if (!agentNames.has(agentName)) {
          errors.push(`copilot_hooks.auto_eval.manual_recovery_agents references unknown agent ${agentName}.`);
        }
      }
    }

    if (!isPlainObject(copilotHooks.orchestration)) {
      errors.push('copilot_hooks.orchestration must be an object.');
    } else {
      validateStringArray(copilotHooks.orchestration.runtime_events, 'copilot_hooks.orchestration.runtime_events', errors);
      requireString(copilotHooks.orchestration, 'session_start_message', 'copilot_hooks.orchestration', errors);
      validateKickoffLane(copilotHooks.orchestration.kickoff_lane, 'copilot_hooks.orchestration.kickoff_lane', agentNames, errors);
    }
  }

  if (isPlainObject(manifest.git_hooks)) {
    for (const [hookName, hookDefinition] of Object.entries(manifest.git_hooks)) {
      const location = `git_hooks.${hookName}`;
      if (!isPlainObject(hookDefinition)) {
        errors.push(`${location} must be an object.`);
        continue;
      }
      if (typeof hookDefinition.blocking !== 'boolean') {
        errors.push(`${location}.blocking must be a boolean.`);
      }
      if (!Array.isArray(hookDefinition.steps)) {
        errors.push(`${location}.steps must be an array.`);
        continue;
      }
      for (const [index, step] of hookDefinition.steps.entries()) {
        validateStep(step, `${location}.steps[${index}]`, agentBindings, errors);
      }
    }
  }

  if (isPlainObject(manifest.github_workflows)) {
    for (const [workflowName, workflowDefinition] of Object.entries(manifest.github_workflows)) {
      const location = `github_workflows.${workflowName}`;
      if (!isPlainObject(workflowDefinition)) {
        errors.push(`${location} must be an object.`);
        continue;
      }
      requireString(workflowDefinition, 'summary_title', location, errors);
      if (!Array.isArray(workflowDefinition.steps)) {
        errors.push(`${location}.steps must be an array.`);
        continue;
      }
      for (const [index, step] of workflowDefinition.steps.entries()) {
        validateStep(step, `${location}.steps[${index}]`, agentBindings, errors);
      }
    }
  }

  if (isPlainObject(manifest.retry_policy)) {
    if (!isPlainObject(manifest.retry_policy.default)) {
      errors.push('retry_policy.default must be an object.');
    } else {
      if (!Number.isInteger(manifest.retry_policy.default.attempts) || manifest.retry_policy.default.attempts < 1) {
        errors.push('retry_policy.default.attempts must be an integer >= 1.');
      }
      if (!Number.isInteger(manifest.retry_policy.default.backoff_ms) || manifest.retry_policy.default.backoff_ms < 0) {
        errors.push('retry_policy.default.backoff_ms must be an integer >= 0.');
      }
    }
  }

  if (isPlainObject(manifest.context_contract)) {
    requireString(manifest.context_contract, 'example_file', 'context_contract', errors);
    requireString(manifest.context_contract, 'runtime_file', 'context_contract', errors);
    validateStringArray(manifest.context_contract.required_fields, 'context_contract.required_fields', errors);
  }

  if (isPlainObject(manifest.logging)) {
    requireString(manifest.logging, 'runtime_dir', 'logging', errors);
    requireString(manifest.logging, 'event_log_file', 'logging', errors);
  }

  for (const agentName of Object.keys(agentBindings)) {
    if (!manifest.skill_bindings?.[agentName]) {
      warnings.push(`skill_bindings.${agentName} is missing; add an explicit empty array if no binding is intended.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function ensureRuntimeDirectory(repoRoot) {
  const runtimeDir = path.join(repoRoot, RUNTIME_DIR_RELATIVE_PATH);
  fs.mkdirSync(runtimeDir, { recursive: true });
  return runtimeDir;
}

export function loadRuntimeContext(repoRoot) {
  if (runtimeWritesDisabled()) {
    return {};
  }

  const contextPath = path.join(repoRoot, RUNTIME_CONTEXT_RELATIVE_PATH);

  if (!fs.existsSync(contextPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  } catch {
    return {};
  }
}

export function writeRuntimeContext(repoRoot, context) {
  if (runtimeWritesDisabled()) {
    return;
  }

  ensureRuntimeDirectory(repoRoot);
  const contextPath = path.join(repoRoot, RUNTIME_CONTEXT_RELATIVE_PATH);
  fs.writeFileSync(contextPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
}

export function appendOrchestrationLog(repoRoot, entry) {
  if (runtimeWritesDisabled()) {
    return;
  }

  ensureRuntimeDirectory(repoRoot);
  const logPath = path.join(repoRoot, RUNTIME_EVENT_LOG_RELATIVE_PATH);
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== ''))];
}

function parseGitStatusPaths(text) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((filePath) => {
      if (filePath.includes(' -> ')) {
        return filePath.split(' -> ')[1];
      }
      return filePath;
    });
}

function parseLineOutput(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function collectChangedFiles(repoRoot) {
  const statusResult = runCommand('git', ['status', '--porcelain=v1'], {
    cwd: repoRoot,
    timeoutMs: 5_000,
  });

  if (statusResult.status === 0) {
    const changedFromStatus = uniqueStrings(parseGitStatusPaths(statusResult.stdout));
    if (changedFromStatus.length > 0) {
      return changedFromStatus;
    }
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const diffResult = runCommand('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
      cwd: repoRoot,
      timeoutMs: 5_000,
    });

    if (diffResult.status === 0) {
      const changedFromDiff = uniqueStrings(parseLineOutput(diffResult.stdout));
      if (changedFromDiff.length > 0) {
        return changedFromDiff;
      }
    }
  }

  const lastCommitResult = runCommand('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
    cwd: repoRoot,
    timeoutMs: 5_000,
  });

  if (lastCommitResult.status === 0) {
    return uniqueStrings(parseLineOutput(lastCommitResult.stdout));
  }

  return [];
}

function globToRegExp(pattern) {
  let expression = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '*') {
      if (pattern[index + 1] === '*') {
        expression += '.*';
        index += 1;
      } else {
        expression += '[^/]*';
      }
      continue;
    }

    if ('\\.^$+?()[]{}|'.includes(character)) {
      expression += `\\${character}`;
      continue;
    }

    expression += character;
  }

  return new RegExp(`^${expression}$`);
}

export function matchesAnyPath(changedFiles, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }

  const expressions = patterns.map(globToRegExp);
  return changedFiles.some((filePath) => expressions.some((expression) => expression.test(filePath)));
}

export function shouldRunStep(step, changedFiles) {
  if (!isPlainObject(step?.when)) {
    return true;
  }

  if (Array.isArray(step.when.any_path_matches)) {
    return matchesAnyPath(changedFiles, step.when.any_path_matches);
  }

  return true;
}

export function buildToolingAuditSummary(manifest) {
  const counts = {
    sufficient: 0,
    partial: 0,
    legacy: 0,
    'needs-extension': 0,
  };
  const lines = [];

  for (const [agentName, binding] of Object.entries(manifest.agent_bindings ?? {})) {
    const status = binding.tooling_assessment?.status;
    if (status in counts) {
      counts[status] += 1;
    }

    if (status !== 'sufficient') {
      const recommendations = (binding.tooling_assessment?.recommended_extensions ?? [])
        .map((item) => item.label)
        .join('; ');
      lines.push(
        `- ${agentName}: ${binding.tooling_assessment?.summary ?? 'No summary.'}${recommendations ? ` Recommendations: ${recommendations}.` : ''}`,
      );
    }
  }

  return {
    counts,
    lines,
  };
}