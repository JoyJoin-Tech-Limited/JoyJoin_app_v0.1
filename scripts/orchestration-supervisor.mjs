#!/usr/bin/env node
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_MEMORY_LIFECYCLE_RULES,
  DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES,
  DEFAULT_WORKFLOW_RELEVANT_PATH_PREFIXES,
  GENERATED_INDEX_RELATIVE_PATH,
  createMemoryHitSummary,
  filterWorkflowRelevantPaths,
  isMeaningfulMemoryQuery,
  queryPromotedMemory,
  queryPromotedMemoryByPaths,
  readGeneratedPromotedIndexSafe,
  summarizeMemoryHitLifecycles,
  summarizeMemoryMatches,
} from './memory-lib.mjs';
import {
  CONTEXT_EXAMPLE_RELATIVE_PATH,
  MANIFEST_RELATIVE_PATH,
  RUNTIME_CONTEXT_RELATIVE_PATH,
  RUNTIME_EVENT_LOG_RELATIVE_PATH,
  appendOrchestrationLog,
  buildToolingAuditSummary,
  collectChangedFiles,
  loadKnownSkillNames,
  loadOrchestrationManifest,
  loadRuntimeContext,
  resolveRepoRoot,
  runCommand,
  shouldRunStep,
  validateOrchestrationManifest,
  writeRuntimeContext,
} from './orchestration-lib.mjs';

const AGENT_INVENTORY_RELATIVE_PATH = path.join('.github', 'agents', 'manifest.json');
const WORKSPACE_SETTINGS_RELATIVE_PATH = path.join('.vscode', 'settings.json');

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

function parseJsonText(raw, sourceLabel) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    throw new Error(`Turn summary payload from ${sourceLabel} is empty.`);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Turn summary payload from ${sourceLabel} must be valid JSON. ${message}`);
  }
}

function getCliOptionValue(args, optionName) {
  const optionPrefix = `${optionName}=`;
  let value = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === optionName) {
      if (value !== null) {
        throw new Error(`${optionName} may only be provided once.`);
      }

      const nextArgument = args[index + 1];
      if (typeof nextArgument !== 'string' || nextArgument.trim() === '') {
        throw new Error(`${optionName} requires a value.`);
      }

      value = nextArgument;
      index += 1;
      continue;
    }

    if (typeof argument === 'string' && argument.startsWith(optionPrefix)) {
      if (value !== null) {
        throw new Error(`${optionName} may only be provided once.`);
      }

      const inlineValue = argument.slice(optionPrefix.length);
      if (inlineValue.trim() === '') {
        throw new Error(`${optionName} requires a value.`);
      }

      value = inlineValue;
    }
  }

  return value;
}

function unwrapTurnSummaryPayload(payload) {
  return payload.turnSummary && typeof payload.turnSummary === 'object' ? payload.turnSummary : payload;
}

function parseRecordSummaryPayload(args) {
  const jsonArgument = getCliOptionValue(args, '--json');
  const fileArgument = getCliOptionValue(args, '--file');

  if (jsonArgument && fileArgument) {
    throw new Error('record-summary accepts only one payload source at a time. Use stdin, --json, or --file.');
  }

  if (jsonArgument) {
    return unwrapTurnSummaryPayload(parseJsonText(jsonArgument, '--json'));
  }

  if (fileArgument) {
    const filePath = path.resolve(fileArgument);
    let raw = '';

    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to read turn summary file ${fileArgument}. ${message}`);
    }

    return unwrapTurnSummaryPayload(parseJsonText(raw, `file ${fileArgument}`));
  }

  const raw = readStdin();
  if (raw.trim() === '') {
    throw new Error('Turn summary payload is required. Provide JSON via stdin, --json, or --file.');
  }

  return unwrapTurnSummaryPayload(parseJsonText(raw, 'stdin'));
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

function normalizeFrontmatterScalar(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseInlineFrontmatterArray(value) {
  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed === '[]') {
    return [];
  }

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }

  const inner = trimmed.slice(1, -1).trim();
  if (inner === '') {
    return [];
  }

  return inner
    .split(',')
    .map((item) => normalizeFrontmatterScalar(item))
    .filter((item) => typeof item === 'string' && item.trim() !== '');
}

function readAgentFrontmatterContract(repoRoot, inventoryFile) {
  const filePath = path.join(repoRoot, '.github', 'agents', inventoryFile);
  const source = fs.readFileSync(filePath, 'utf8');
  const sections = source.split(/^---\s*$/m);

  if (sections.length < 3) {
    return {
      name: null,
      agents: [],
    };
  }

  let frontmatterName = null;
  let frontmatterAgents = [];

  for (const rawLine of sections[1].split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith('name:')) {
      frontmatterName = normalizeFrontmatterScalar(line.slice('name:'.length));
      continue;
    }

    if (line.startsWith('agents:')) {
      frontmatterAgents = parseInlineFrontmatterArray(line.slice('agents:'.length));
    }
  }

  return {
    name: frontmatterName,
    agents: frontmatterAgents,
  };
}

function loadAgentInventory(repoRoot) {
  const inventoryPath = path.join(repoRoot, AGENT_INVENTORY_RELATIVE_PATH);
  return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
}

function loadWorkspaceSettings(repoRoot) {
  const settingsPath = path.join(repoRoot, WORKSPACE_SETTINGS_RELATIVE_PATH);
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

function validateAgentInventoryContract(repoRoot, manifest, validationErrors) {
  if (!relativeExists(repoRoot, AGENT_INVENTORY_RELATIVE_PATH)) {
    validationErrors.push(`Referenced file is missing: ${AGENT_INVENTORY_RELATIVE_PATH}.`);
    return;
  }

  let inventory;
  try {
    inventory = loadAgentInventory(repoRoot);
  } catch (error) {
    validationErrors.push(
      `${AGENT_INVENTORY_RELATIVE_PATH} must be valid JSON. ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  if (!Array.isArray(inventory.agents)) {
    validationErrors.push(`${AGENT_INVENTORY_RELATIVE_PATH}.agents must be an array.`);
    return;
  }

  const inventoryNames = new Set();
  const orchestrationAgentNames = new Set(Object.keys(manifest.agent_bindings ?? {}));

  for (const [index, agent] of inventory.agents.entries()) {
    const location = `${AGENT_INVENTORY_RELATIVE_PATH}.agents[${index}]`;

    if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
      validationErrors.push(`${location} must be an object.`);
      continue;
    }

    if (typeof agent.name !== 'string' || agent.name.trim() === '') {
      validationErrors.push(`${location}.name must be a non-empty string.`);
      continue;
    }

    if (inventoryNames.has(agent.name)) {
      validationErrors.push(`${location}.name must be unique. Duplicate agent name: ${agent.name}.`);
      continue;
    }

    inventoryNames.add(agent.name);

    if (!orchestrationAgentNames.has(agent.name)) {
      validationErrors.push(`${location}.name is missing from ${MANIFEST_RELATIVE_PATH} agent_bindings: ${agent.name}.`);
    }

    if (typeof agent.file !== 'string' || agent.file.trim() === '') {
      validationErrors.push(`${location}.file must be a non-empty string.`);
      continue;
    }

    const agentRelativeFile = path.join('.github', 'agents', agent.file);
    if (!relativeExists(repoRoot, agentRelativeFile)) {
      validationErrors.push(`${location}.file references missing file ${agentRelativeFile}.`);
      continue;
    }

    const frontmatter = readAgentFrontmatterContract(repoRoot, agent.file);
    if (frontmatter.name !== agent.name) {
      validationErrors.push(
        `${location}.name must match the agent frontmatter name in ${agentRelativeFile}. Expected ${frontmatter.name ?? 'missing'}, received ${agent.name}.`
      );
    }

    if (Array.isArray(agent.subagents)) {
      const inventorySubagents = agent.subagents.filter((name) => typeof name === 'string' && name.trim() !== '');

      for (const subagentName of inventorySubagents) {
        if (!inventory.agents.some((candidate) => candidate?.name === subagentName)) {
          validationErrors.push(`${location}.subagents references unknown agent ${subagentName}.`);
        }
      }

      if (!sameStringList(inventorySubagents, frontmatter.agents)) {
        validationErrors.push(
          `${location}.subagents must match the frontmatter agents allowlist in ${agentRelativeFile}.`
        );
      }
    }
  }

  for (const agentName of orchestrationAgentNames) {
    if (!inventoryNames.has(agentName)) {
      validationErrors.push(`${MANIFEST_RELATIVE_PATH}.agent_bindings.${agentName} is missing from ${AGENT_INVENTORY_RELATIVE_PATH}.`);
    }
  }

  const nestedDelegationAgents = inventory.agents
    .filter((agent) => Array.isArray(agent.subagents) && agent.subagents.length > 0)
    .filter((agent) =>
      inventory.agents.some(
        (candidate) => Array.isArray(candidate.subagents) && candidate.subagents.includes(agent.name)
      )
    )
    .map((agent) => agent.name);

  if (nestedDelegationAgents.length === 0) {
    return;
  }

  if (!relativeExists(repoRoot, WORKSPACE_SETTINGS_RELATIVE_PATH)) {
    validationErrors.push(
      `${WORKSPACE_SETTINGS_RELATIVE_PATH} must enable chat.subagents.allowInvocationsFromSubagents because nested delegation is authored for: ${nestedDelegationAgents.join(', ')}.`
    );
    return;
  }

  let settings;
  try {
    settings = loadWorkspaceSettings(repoRoot);
  } catch (error) {
    validationErrors.push(
      `${WORKSPACE_SETTINGS_RELATIVE_PATH} must be valid JSON. ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  if (settings['chat.subagents.allowInvocationsFromSubagents'] !== true) {
    validationErrors.push(
      `${WORKSPACE_SETTINGS_RELATIVE_PATH} must set chat.subagents.allowInvocationsFromSubagents to true because nested delegation is authored for: ${nestedDelegationAgents.join(', ')}.`
    );
  }
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

function getKickoffConfig(manifest) {
  return manifest.copilot_hooks?.orchestration?.kickoff_lane ?? {
    entry_agents: ['Researcher', 'Planner'],
    approval_mode: 'plan-first',
    recommend_on_first_broad_prompt: true,
    broad_prompt_signals: {
      min_words: 6,
      verbs: ['add', 'build', 'create', 'fix', 'implement', 'integrate', 'migrate', 'plan', 'refactor', 'review', 'update'],
      scope_terms: ['agent', 'api', 'docs', 'hook', 'migration', 'orchestration', 'route', 'test', 'workflow'],
    },
  };
}

function getMemoryConfig(manifest) {
  const configuredMemoryContext = manifest.copilot_hooks?.orchestration?.memory_context ?? {};
  const configuredPromptQuery = configuredMemoryContext.prompt_query ?? {};

  return {
    artifactPath:
      typeof configuredMemoryContext.artifact_path === 'string' && configuredMemoryContext.artifact_path.trim() !== ''
        ? configuredMemoryContext.artifact_path.trim()
        : GENERATED_INDEX_RELATIVE_PATH,
    workflowRelevantPathPrefixes:
      Array.isArray(configuredMemoryContext.workflow_relevant_path_prefixes) &&
      configuredMemoryContext.workflow_relevant_path_prefixes.length > 0
        ? configuredMemoryContext.workflow_relevant_path_prefixes
        : DEFAULT_WORKFLOW_RELEVANT_PATH_PREFIXES,
    promptQueryRules: {
      ...DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES,
      ...(Number.isInteger(configuredPromptQuery.min_characters) && configuredPromptQuery.min_characters > 0
        ? { minCharacters: configuredPromptQuery.min_characters }
        : {}),
      ...(Number.isInteger(configuredPromptQuery.min_tokens) && configuredPromptQuery.min_tokens > 0
        ? { minTokens: configuredPromptQuery.min_tokens }
        : {}),
      ...(Number.isInteger(configuredPromptQuery.min_long_tokens) && configuredPromptQuery.min_long_tokens > 0
        ? { minLongTokens: configuredPromptQuery.min_long_tokens }
        : {}),
      ...(Number.isInteger(configuredPromptQuery.long_token_length) && configuredPromptQuery.long_token_length > 0
        ? { longTokenLength: configuredPromptQuery.long_token_length }
        : {}),
    },
    maxHits:
      Number.isInteger(configuredMemoryContext.max_hits) && configuredMemoryContext.max_hits > 0
        ? configuredMemoryContext.max_hits
        : 3,
    minChangedFileScore:
      Number.isInteger(configuredMemoryContext.min_changed_file_score) && configuredMemoryContext.min_changed_file_score > 0
        ? configuredMemoryContext.min_changed_file_score
        : 6,
    minPromptScore:
      Number.isInteger(configuredMemoryContext.min_prompt_score) && configuredMemoryContext.min_prompt_score > 0
        ? configuredMemoryContext.min_prompt_score
        : 10,
    maxValidationAgeDays:
      Number.isInteger(configuredMemoryContext.max_validation_age_days) &&
      configuredMemoryContext.max_validation_age_days > 0
        ? configuredMemoryContext.max_validation_age_days
        : DEFAULT_MEMORY_LIFECYCLE_RULES.maxValidationAgeDays,
    surfaceSourcePathConflicts:
      typeof configuredMemoryContext.surface_source_path_conflicts === 'boolean'
        ? configuredMemoryContext.surface_source_path_conflicts
        : DEFAULT_MEMORY_LIFECYCLE_RULES.surfaceSourcePathConflicts,
  };
}

function createDefaultKickoffState(kickoffConfig) {
  return {
    status: 'idle',
    approvalMode: kickoffConfig.approval_mode ?? 'plan-first',
    recommendedAgents: kickoffConfig.entry_agents ?? ['Researcher', 'Planner'],
    recommendationIssued: false,
    evaluationCount: 0,
    lastPrompt: null,
    lastReason: null,
  };
}

function createDefaultPromptMemoryState() {
  return {
    query: null,
    meaningful: false,
    hits: [],
  };
}

function extractPromptText(payload) {
  const candidates = [
    payload.prompt,
    payload.userPrompt,
    payload.message,
    payload.text,
    payload.request?.prompt,
    payload.request?.text,
    payload.input?.prompt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }

  return '';
}

function normalizePrompt(promptText) {
  return promptText.trim().replace(/\s+/g, ' ');
}

function extractPromptTokens(promptText) {
  return normalizePrompt(promptText)
    .toLowerCase()
    .match(/[a-z0-9-]+/g) ?? [];
}

function hasConfiguredToken(tokens, configuredTerms) {
  if (!Array.isArray(configuredTerms) || configuredTerms.length === 0) {
    return false;
  }

  const tokenSet = new Set(tokens);
  return configuredTerms.some((term) => tokenSet.has(String(term).toLowerCase()));
}

function shouldRecommendKickoff(promptText, kickoffState, kickoffConfig) {
  if (!promptText || kickoffState?.recommendationIssued) {
    return false;
  }

  if (kickoffConfig.recommend_on_first_broad_prompt === false) {
    return false;
  }

  const tokens = extractPromptTokens(promptText);
  const minWords = kickoffConfig.broad_prompt_signals?.min_words ?? 6;
  const verbs = kickoffConfig.broad_prompt_signals?.verbs ?? [];
  const scopeTerms = kickoffConfig.broad_prompt_signals?.scope_terms ?? [];
  const hasVerb = hasConfiguredToken(tokens, verbs);
  const hasScopeTerm = hasConfiguredToken(tokens, scopeTerms);
  const hasMultiStepConnector = hasConfiguredToken(tokens, ['and', 'with', 'before', 'after', 'across', 'into', 'plus', 'then']);

  if (tokens.length < minWords) {
    return false;
  }

  return (hasVerb && hasScopeTerm) || (hasVerb && hasMultiStepConnector) || (hasScopeTerm && hasMultiStepConnector);
}

function sameStringList(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function shouldClearKickoffRecommendation(promptText, kickoffState, recommendedNextAgents, kickoffConfig) {
  if (!promptText) {
    return false;
  }

  const kickoffAgents = kickoffConfig.entry_agents ?? ['Researcher', 'Planner'];
  return Boolean(kickoffState?.recommendationIssued || sameStringList(recommendedNextAgents, kickoffAgents));
}

function buildKickoffSystemMessage(manifest, promptText) {
  const kickoffConfig = getKickoffConfig(manifest);
  const kickoffAgents = (kickoffConfig.entry_agents ?? ['Researcher', 'Planner']).join(' -> ');
  const approvalMode = kickoffConfig.approval_mode === 'plan-first' ? 'approval-first' : kickoffConfig.approval_mode;
  const promptSummary = normalizePrompt(promptText);

  return `This looks like a broad request. Start with ${kickoffAgents} so the work is grounded before implementation. ${kickoffConfig.entry_agents?.[0] ?? 'Researcher'} should gather verified repo context, then ${kickoffConfig.entry_agents?.[1] ?? 'Planner'} should return an ${approvalMode} execution plan. Prompt summary: ${promptSummary}`;
}

function collectUniqueMemoryHits(...hitGroups) {
  const hits = [];
  const seenIds = new Set();

  for (const hitGroup of hitGroups) {
    if (!Array.isArray(hitGroup)) {
      continue;
    }

    for (const hit of hitGroup) {
      if (!hit?.id || seenIds.has(hit.id)) {
        continue;
      }

      seenIds.add(hit.id);
      hits.push(hit);
    }
  }

  return hits;
}

function refreshMemoryHits(hits, lifecycleOptions) {
  if (!Array.isArray(hits)) {
    return [];
  }

  return hits.map((hit) => createMemoryHitSummary(hit, lifecycleOptions));
}

export function buildMemoryContext({
  changedFiles,
  memoryConfig,
  previousMemoryContext,
  promptText,
  resetPrompt = false,
  evaluatedAt = new Date().toISOString(),
}) {
  const indexState = readGeneratedPromotedIndexSafe(memoryConfig.artifactPath);
  const consideredPaths = filterWorkflowRelevantPaths(
    changedFiles,
    memoryConfig.workflowRelevantPathPrefixes,
  );
  const lifecycleOptions = {
    changedPaths: consideredPaths,
    evaluatedAt,
    maxValidationAgeDays: memoryConfig.maxValidationAgeDays,
    surfaceSourcePathConflicts: memoryConfig.surfaceSourcePathConflicts,
  };
  const changedFileHits = indexState.available
    ? queryPromotedMemoryByPaths(consideredPaths, {
        indexDocument: indexState.document,
        limit: memoryConfig.maxHits,
        minScore: memoryConfig.minChangedFileScore,
      }).matches.map((match) => createMemoryHitSummary(match, lifecycleOptions))
    : [];

  let promptState = resetPrompt
    ? createDefaultPromptMemoryState()
    : {
        ...(previousMemoryContext?.prompt ?? createDefaultPromptMemoryState()),
        hits: refreshMemoryHits(previousMemoryContext?.prompt?.hits, lifecycleOptions),
      };

  if (typeof promptText === 'string') {
    const meaningful = isMeaningfulMemoryQuery(promptText, memoryConfig.promptQueryRules);
    const promptHits = meaningful && indexState.available
      ? queryPromotedMemory(promptText, {
          indexDocument: indexState.document,
          limit: memoryConfig.maxHits,
          minScore: memoryConfig.minPromptScore,
        }).matches.map((match) => createMemoryHitSummary(match, lifecycleOptions))
      : [];

    promptState = {
      query: promptText || null,
      meaningful,
      hits: promptHits,
    };
  }

  const combinedHits = collectUniqueMemoryHits(promptState.hits, changedFileHits);

  return {
    status: 'advisory',
    generatedIndex: {
      path: memoryConfig.artifactPath,
      available: indexState.available,
      noteCount: indexState.available ? indexState.document.noteCount : null,
      error: indexState.available ? null : indexState.error,
    },
    changedFiles: {
      consideredPaths,
      hits: changedFileHits,
    },
    prompt: promptState,
    lifecycle: summarizeMemoryHitLifecycles(combinedHits, lifecycleOptions),
    summary: summarizeMemoryMatches(combinedHits, { maxMatches: 2 }),
  };
}

function buildChangedFileMemorySummary(memoryContext) {
  return summarizeMemoryMatches(memoryContext?.changedFiles?.hits ?? [], { maxMatches: 2 });
}

function buildPromptMemorySummary(memoryContext) {
  const promptHits = memoryContext?.prompt?.hits ?? [];
  if (!Array.isArray(promptHits) || promptHits.length === 0) {
    return null;
  }

  return summarizeMemoryMatches(
    collectUniqueMemoryHits(promptHits, memoryContext?.changedFiles?.hits ?? []),
    { maxMatches: 2 },
  );
}

function appendMemorySummary(systemMessage, memorySummary) {
  if (!memorySummary) {
    return systemMessage;
  }

  return systemMessage ? `${systemMessage} ${memorySummary}` : memorySummary;
}

function buildMemoryLogMetadata(memoryContext) {
  return {
    generatedIndexAvailable: Boolean(memoryContext?.generatedIndex?.available),
    changedFileHitCount: Array.isArray(memoryContext?.changedFiles?.hits) ? memoryContext.changedFiles.hits.length : 0,
    promptHitCount: Array.isArray(memoryContext?.prompt?.hits) ? memoryContext.prompt.hits.length : 0,
    promptQueryMeaningful: Boolean(memoryContext?.prompt?.meaningful),
    warningHitCount: Number.isInteger(memoryContext?.lifecycle?.cautionHitCount)
      ? memoryContext.lifecycle.cautionHitCount
      : 0,
    staleHitCount: Number.isInteger(memoryContext?.lifecycle?.staleHitCount)
      ? memoryContext.lifecycle.staleHitCount
      : 0,
    conflictHitCount: Number.isInteger(memoryContext?.lifecycle?.conflictHitCount)
      ? memoryContext.lifecycle.conflictHitCount
      : 0,
  };
}


const DEFAULT_TURN_SUMMARY_WINDOW = 5;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringList(values) {
  return Array.isArray(values)
    ? values.map((value) => cleanString(value)).filter(Boolean)
    : [];
}

function normalizeFeedbackByAgent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([agentName, feedback]) => [cleanString(agentName), toStringList(feedback)])
      .filter(([agentName]) => Boolean(agentName)),
  );
}

const MAX_UTILIZATION_ROWS = 30;

/**
 * Optional per-turn ledger: which JoyJoin agents and repo skills applied to which slice of work.
 * Used for utilization / gap analytics in turn reports (not authoritative RBAC).
 */
function normalizeUtilization(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_UTILIZATION_ROWS)
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
      }

      const task = cleanString(entry.task) || cleanString(entry.label) || '';
      const agents = toStringList(entry.agents);
      const skills = toStringList(entry.skills);

      if (!task && agents.length === 0 && skills.length === 0) {
        return null;
      }

      return {
        task: task || 'Unnamed task',
        agents,
        skills,
      };
    })
    .filter(Boolean);
}

function normalizeNextSteps(value) {
  const nextSteps = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    bugFix: toStringList(nextSteps.bugFix),
    enhancement: toStringList(nextSteps.enhancement),
    validation: toStringList(nextSteps.validation),
  };
}

function normalizeConfidence(value) {
  const confidence = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const score = Number.isFinite(Number(confidence.score))
    ? Math.max(0, Math.min(1, Number(confidence.score)))
    : 0;

  return {
    score: Number(score.toFixed(2)),
    reason: cleanString(confidence.reason),
  };
}

/** @returns {'ready' | 'blocked' | 'done' | null} */
function normalizeTurnStatus(value) {
  const raw = cleanString(value);
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  if (lower === 'ready' || lower === 'blocked' || lower === 'done') {
    return lower;
  }
  return null;
}

function nextStepsHasItems(nextSteps) {
  if (!nextSteps || typeof nextSteps !== 'object') {
    return false;
  }
  const lists = [nextSteps.bugFix, nextSteps.enhancement, nextSteps.validation];
  return lists.some((list) => Array.isArray(list) && list.length > 0);
}

export function createDefaultTurnSummaryState(focusWindowTurns = DEFAULT_TURN_SUMMARY_WINDOW) {
  return {
    focusWindowTurns,
    lastTurnSequence: 0,
    recentAgentSummaries: {},
    recentSupervisorReports: [],
  };
}

export function normalizeTurnSummaryState(value, focusWindowTurns = DEFAULT_TURN_SUMMARY_WINDOW) {
  const normalizedFocusWindowTurns = Number.isInteger(value?.focusWindowTurns) && value.focusWindowTurns > 0
    ? value.focusWindowTurns
    : focusWindowTurns;
  const recentAgentSummaries = value && typeof value === 'object' && !Array.isArray(value) && value.recentAgentSummaries && typeof value.recentAgentSummaries === 'object' && !Array.isArray(value.recentAgentSummaries)
    ? Object.fromEntries(
        Object.entries(value.recentAgentSummaries).map(([agentName, summaries]) => [
          agentName,
          Array.isArray(summaries) ? summaries.slice(-normalizedFocusWindowTurns) : [],
        ]),
      )
    : {};

  return {
    focusWindowTurns: normalizedFocusWindowTurns,
    lastTurnSequence: Number.isInteger(value?.lastTurnSequence) && value.lastTurnSequence >= 0 ? value.lastTurnSequence : 0,
    recentAgentSummaries,
    recentSupervisorReports: Array.isArray(value?.recentSupervisorReports)
      ? value.recentSupervisorReports.slice(-normalizedFocusWindowTurns)
      : [],
  };
}

function deriveSessionId(existingSessionId) {
  return cleanString(existingSessionId) || randomUUID();
}

function trimToWindow(entries, focusWindowTurns) {
  return entries.slice(-focusWindowTurns);
}

function createSummaryId(type, agentName) {
  const safeAgentName = cleanString(agentName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agent';
  const prefix = type === 'supervisor_turn_report' ? 'supervisor-report' : 'agent-summary';
  return prefix + '-' + safeAgentName + '-' + randomUUID().slice(0, 8);
}

function buildTurnSummaryArtifacts(existingArtifactPaths) {
  return [
    RUNTIME_CONTEXT_RELATIVE_PATH,
    RUNTIME_EVENT_LOG_RELATIVE_PATH,
    ...(Array.isArray(existingArtifactPaths) ? existingArtifactPaths : []),
  ].filter((value, index, array) => array.indexOf(value) === index);
}

export function normalizeTurnSummaryPayload(payload, context = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Turn summary payload must be a JSON object.');
  }

  const type = cleanString(payload.type || payload.summaryType);
  if (type !== 'agent_turn_summary' && type !== 'supervisor_turn_report') {
    throw new Error('Turn summary payload type must be agent_turn_summary or supervisor_turn_report.');
  }

  const focusWindowTurns = Number.isInteger(payload.focusWindowTurns) && payload.focusWindowTurns > 0
    ? payload.focusWindowTurns
    : normalizeTurnSummaryState(context.turnSummaryState).focusWindowTurns;
  const agentName = type === 'supervisor_turn_report'
    ? cleanString(payload.agentName) || 'Supervisor'
    : cleanString(payload.agentName);

  if (!agentName) {
    throw new Error('Agent turn summaries must include agentName.');
  }

  const normalizedPayload = {
    schemaVersion: 1,
    type,
    summaryId: cleanString(payload.summaryId) || createSummaryId(type, agentName),
    agentName,
    parentAgent: cleanString(payload.parentAgent) || null,
    focusWindowTurns,
    recordedAt: cleanString(payload.recordedAt) || new Date().toISOString(),
    turnId: cleanString(payload.turnId) || null,
    turnStatus: normalizeTurnStatus(payload.turnStatus),
    done: toStringList(payload.done),
    filesChanged: toStringList(payload.filesChanged ?? payload.changedFiles),
    decisions: toStringList(payload.decisions),
    blockers: toStringList(payload.blockers),
    nextSteps: normalizeNextSteps(payload.nextSteps),
    confidence: normalizeConfidence(payload.confidence),
    unresolvedAssumptions: toStringList(payload.unresolvedAssumptions),
  };

  if (type === 'agent_turn_summary') {
    return {
      ...normalizedPayload,
      learned: toStringList(payload.learned),
      nextTurnImprovements: toStringList(payload.nextTurnImprovements).slice(0, 2),
      appliedFeedbackFrom: toStringList(payload.appliedFeedbackFrom),
      utilization: normalizeUtilization(payload.utilization),
    };
  }

  return {
    ...normalizedPayload,
    keyBullets: toStringList(payload.keyBullets),
    crossAgentInsights: toStringList(payload.crossAgentInsights),
    sourceSummaryIds: toStringList(payload.sourceSummaryIds),
    feedbackByAgent: normalizeFeedbackByAgent(payload.feedbackByAgent),
    utilization: normalizeUtilization(payload.utilization),
  };
}

function buildCompactAgentSummary(summary) {
  return {
    summaryId: summary.summaryId,
    agentName: summary.agentName,
    parentAgent: summary.parentAgent,
    recordedAt: summary.recordedAt,
    focusWindowTurns: summary.focusWindowTurns,
    turnStatus: summary.turnStatus,
    done: summary.done,
    learned: summary.learned,
    nextTurnImprovements: summary.nextTurnImprovements,
    confidenceScore: summary.confidence.score,
    appliedFeedbackFrom: summary.appliedFeedbackFrom,
    utilization: Array.isArray(summary.utilization) ? summary.utilization : [],
  };
}

function buildCompactSupervisorReport(summary, turnId, turnSequence) {
  return {
    summaryId: summary.summaryId,
    turnId,
    turnSequence,
    recordedAt: summary.recordedAt,
    focusWindowTurns: summary.focusWindowTurns,
    turnStatus: summary.turnStatus,
    done: summary.done,
    keyBullets: summary.keyBullets,
    crossAgentInsights: summary.crossAgentInsights,
    nextSteps: summary.nextSteps,
    feedbackByAgent: summary.feedbackByAgent,
    sourceSummaryIds: summary.sourceSummaryIds,
    confidenceScore: summary.confidence.score,
    unresolvedAssumptions: summary.unresolvedAssumptions,
    utilization: Array.isArray(summary.utilization) ? summary.utilization : [],
  };
}

export function recordTurnSummary(repoRoot, payload) {
  const existingContext = loadRuntimeContext(repoRoot);
  const sessionId = deriveSessionId(existingContext.sessionId);
  const currentTurnSummaryState = normalizeTurnSummaryState(existingContext.turnSummaryState);
  const summary = normalizeTurnSummaryPayload(payload, {
    sessionId,
    turnSummaryState: currentTurnSummaryState,
  });
  if (
    summary.turnStatus === 'done'
    && nextStepsHasItems(summary.nextSteps)
    && process.env.ORCHESTRATION_DISABLE_RUNTIME_WRITES !== '1'
  ) {
    process.stderr.write(
      '[orchestration] Warning: turnStatus is "done" but nextSteps still lists items. Prefer empty nextSteps when the turn is final.\n',
    );
  }
  let nextTurnSummaryState = normalizeTurnSummaryState(currentTurnSummaryState, summary.focusWindowTurns);
  let turnId = summary.turnId;
  let turnSequence = null;

  if (summary.type === 'supervisor_turn_report') {
    turnSequence = nextTurnSummaryState.lastTurnSequence + 1;
    turnId = turnId || sessionId + ':turn:' + turnSequence;
    nextTurnSummaryState = {
      ...nextTurnSummaryState,
      focusWindowTurns: summary.focusWindowTurns,
      lastTurnSequence: turnSequence,
      recentSupervisorReports: trimToWindow(
        [...nextTurnSummaryState.recentSupervisorReports, buildCompactSupervisorReport(summary, turnId, turnSequence)],
        summary.focusWindowTurns,
      ),
    };
  } else {
    const recentAgentSummaries = Array.isArray(nextTurnSummaryState.recentAgentSummaries[summary.agentName])
      ? nextTurnSummaryState.recentAgentSummaries[summary.agentName]
      : [];
    nextTurnSummaryState = {
      ...nextTurnSummaryState,
      focusWindowTurns: summary.focusWindowTurns,
      recentAgentSummaries: {
        ...nextTurnSummaryState.recentAgentSummaries,
        [summary.agentName]: trimToWindow(
          [...recentAgentSummaries, buildCompactAgentSummary(summary)],
          summary.focusWindowTurns,
        ),
      },
    };
  }

  const nextContext = {
    ...existingContext,
    event: 'record-summary',
    triggerSource: 'explicit_summary',
    sessionId,
    artifactPaths: buildTurnSummaryArtifacts(existingContext.artifactPaths),
    upstreamAgent: summary.agentName,
    turnSummaryState: nextTurnSummaryState,
    lastUpdatedAt: summary.recordedAt,
  };

  writeRuntimeContext(repoRoot, nextContext);
  appendOrchestrationLog(repoRoot, {
    recordedAt: summary.recordedAt,
    triggerSource: 'explicit_summary',
    event: summary.type === 'supervisor_turn_report' ? 'supervisor-turn-report' : 'agent-turn-summary',
    sessionId,
    summaryId: summary.summaryId,
    agentName: summary.agentName,
    turnId: turnId || null,
    turnSequence,
    summary: summary.type === 'supervisor_turn_report'
      ? { ...summary, turnId, turnSequence }
      : { ...summary, turnId: turnId || null },
  });

  return {
    ok: true,
    persisted: process.env.ORCHESTRATION_DISABLE_RUNTIME_WRITES !== '1',
    sessionId,
    summaryId: summary.summaryId,
    type: summary.type,
    turnId: turnId || null,
    turnSequence,
    focusWindowTurns: summary.focusWindowTurns,
  };
}

function runRecordSummary(repoRoot, args = []) {
  outputJson(recordTurnSummary(repoRoot, parseRecordSummaryPayload(args)));
}

function buildHookContext(repoRoot, eventName, payload, manifest) {
  const existingContext = loadRuntimeContext(repoRoot);
  const changedFiles = collectChangedFiles(repoRoot);
  const now = new Date().toISOString();
  const memoryConfig = getMemoryConfig(manifest);
  const previousMemoryContext = existingContext.memoryContext && typeof existingContext.memoryContext === 'object'
    ? existingContext.memoryContext
    : null;
  const memoryContext = buildMemoryContext({
    changedFiles,
    memoryConfig,
    previousMemoryContext,
    evaluatedAt: now,
  });
  const sessionId = deriveSessionId(existingContext.sessionId);
  const turnSummaryState = normalizeTurnSummaryState(existingContext.turnSummaryState);

  return {
    ...existingContext,
    event: eventName,
    triggerSource: 'copilot_hook',
    sessionId,
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
      ...(memoryContext.generatedIndex.available ? [memoryContext.generatedIndex.path] : []),
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
    recommendedNextAgents:
      existingContext.recommendedNextAgents ??
      manifest.copilot_hooks?.auto_eval?.manual_recovery_agents ??
      ['Auto-Eval', 'Supervisor'],
    kickoff: existingContext.kickoff ?? null,
    turnSummaryState,
    memoryContext,
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
    AGENT_INVENTORY_RELATIVE_PATH,
    CONTEXT_EXAMPLE_RELATIVE_PATH,
    WORKSPACE_SETTINGS_RELATIVE_PATH,
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
  const validation = validateOrchestrationManifest(manifest, {
    knownSkillNames: loadKnownSkillNames(repoRoot),
  });
  validateContextExample(repoRoot, manifest, validation.errors);
  validateAgentInventoryContract(repoRoot, manifest, validation.errors);
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
  const validation = validateOrchestrationManifest(manifest, {
    knownSkillNames: loadKnownSkillNames(repoRoot),
  });
  const kickoffConfig = getKickoffConfig(manifest);
  const memoryConfig = getMemoryConfig(manifest);

  if (!validation.valid) {
    outputJson({
      continue: true,
      systemMessage: `Orchestration warning: ${MANIFEST_RELATIVE_PATH} is invalid. ${validation.errors[0]}`,
    });
  }

  let context = buildHookContext(repoRoot, eventName, payload, manifest);

  if (eventName === 'session-start') {
    context = {
      ...context,
      sessionId: randomUUID(),
      kickoff: createDefaultKickoffState(kickoffConfig),
      recommendedNextAgents: kickoffConfig.entry_agents ?? ['Researcher', 'Planner'],
      turnSummaryState: createDefaultTurnSummaryState(),
      memoryContext: buildMemoryContext({
        changedFiles: context.changedFiles ?? [],
        memoryConfig,
        previousMemoryContext: context.memoryContext,
        resetPrompt: true,
        evaluatedAt: context.lastUpdatedAt,
      }),
    };

    writeRuntimeContext(repoRoot, context);
    appendOrchestrationLog(repoRoot, {
      recordedAt: new Date().toISOString(),
      triggerSource: 'copilot_hook',
      event: eventName,
      kickoffStatus: context.kickoff?.status ?? null,
      memory: buildMemoryLogMetadata(context.memoryContext),
    });

    outputJson({
      continue: true,
      systemMessage: appendMemorySummary(
        `${manifest.copilot_hooks?.orchestration?.session_start_message ?? 'Orchestration runtime ready.'} Kickoff lane: ${(kickoffConfig.entry_agents ?? ['Researcher', 'Planner']).join(' -> ')}. Core graph: ${summarizeOrchestratedAgents(manifest)}.`,
        buildChangedFileMemorySummary(context.memoryContext),
      ),
    });
  }

  if (eventName === 'user-prompt-submit') {
    const promptText = extractPromptText(payload);
    const kickoffState = context.kickoff ?? createDefaultKickoffState(kickoffConfig);
    const recommendKickoff = shouldRecommendKickoff(promptText, kickoffState, kickoffConfig);
    const clearKickoffRecommendation = !recommendKickoff
      ? shouldClearKickoffRecommendation(promptText, kickoffState, context.recommendedNextAgents, kickoffConfig)
      : false;
    const kickoffAgents = kickoffConfig.entry_agents ?? ['Researcher', 'Planner'];
    const hasKickoffRecommendations = sameStringList(context.recommendedNextAgents, kickoffAgents);
    const memoryContext = buildMemoryContext({
      changedFiles: context.changedFiles ?? [],
      memoryConfig,
      previousMemoryContext: context.memoryContext,
      promptText,
      evaluatedAt: context.lastUpdatedAt,
    });

    context = {
      ...context,
      recommendedNextAgents: recommendKickoff
        ? kickoffAgents
        : clearKickoffRecommendation && hasKickoffRecommendations
          ? []
          : context.recommendedNextAgents,
      upstreamResult: {
        ...context.upstreamResult,
        prompt: promptText || null,
      },
      kickoff: {
        ...kickoffState,
        status: recommendKickoff ? 'recommended' : clearKickoffRecommendation ? 'idle' : kickoffState.status,
        recommendationIssued: recommendKickoff ? true : clearKickoffRecommendation ? false : kickoffState.recommendationIssued,
        evaluationCount: Number(kickoffState.evaluationCount ?? 0) + 1,
        lastPrompt: promptText || null,
        lastReason: promptText
          ? recommendKickoff
            ? 'broad-request'
            : clearKickoffRecommendation
              ? 'narrow-cleared-recommendation'
              : 'narrow-or-already-routed'
          : 'missing-prompt',
      },
      memoryContext,
    };

    writeRuntimeContext(repoRoot, context);
    appendOrchestrationLog(repoRoot, {
      recordedAt: new Date().toISOString(),
      triggerSource: 'copilot_hook',
      event: eventName,
      promptSummary: promptText ? normalizePrompt(promptText).slice(0, 200) : null,
      kickoffRecommended: recommendKickoff,
      kickoffCleared: clearKickoffRecommendation,
      memory: buildMemoryLogMetadata(context.memoryContext),
    });

    const promptMemorySummary = buildPromptMemorySummary(context.memoryContext);

    if (recommendKickoff) {
      outputJson({
        continue: true,
        systemMessage: appendMemorySummary(
          buildKickoffSystemMessage(manifest, promptText),
          promptMemorySummary,
        ),
      });
    }

    if (promptMemorySummary) {
      outputJson({
        continue: true,
        systemMessage: promptMemorySummary,
      });
    }

    outputJson({ continue: true });
  }

  writeRuntimeContext(repoRoot, context);
  appendOrchestrationLog(repoRoot, {
    recordedAt: new Date().toISOString(),
    triggerSource: 'copilot_hook',
    event: eventName,
    payloadSummary: {
      toolName: payload.toolName ?? payload.tool?.name ?? null,
    },
    memory: buildMemoryLogMetadata(context.memoryContext),
  });

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

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
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

    if (command === 'record-summary') {
      runRecordSummary(repoRoot, process.argv.slice(3));
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
}