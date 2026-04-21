#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIR_RELATIVE_PATH } from './orchestration-lib.mjs';

export const NEXT_ACTIONS_ARTIFACT_RELATIVE_PATH = path.join(RUNTIME_DIR_RELATIVE_PATH, 'next-actions.json');

const ROUTING_PRIMARY_LIMIT = 3;
const ROUTING_OVERFLOW_LIMIT = 2;
const MAX_TRACK_ACTIONS = 5;

const TRACK_DEFINITIONS = [
  {
    id: 'orchestration',
    label: 'Orchestration workflow',
    ownerAgent: 'Backend Engineer',
    ownerLabel: 'Route orchestration implementation',
    ownerActionText: 'implement the current orchestration runtime slice',
    pathMatchers: [
      '.github/orchestration',
      '.github/ORCHESTRATION',
      '.github/agents/',
      '.github/skills/orchestration',
      'scripts/orchestration',
      '.git/.orchestration',
      'repo-memory/promoted/orchestration',
      'docs/proposals/supervisor',
    ],
    keywords: ['orchestration', 'supervisor', 'agent', 'routing', 'turn-report'],
  },
  {
    id: 'mini-program-ui',
    label: 'Mini-program UI',
    ownerAgent: 'Taro Mini-Program Frontend Engineer',
    ownerLabel: 'Route mini-program implementation',
    ownerActionText: 'implement the current mini-program UI slice',
    pathMatchers: ['apps/mini-program/src/', 'apps/mini-program/README.md', 'apps/mini-program/package.json'],
    keywords: ['mini-program', 'taro', 'wxss', 'matching-status', 'squad-unboxing', 'pool-group-detail'],
  },
  {
    id: 'mini-program-docs',
    label: 'Mini-program docs',
    ownerAgent: 'Product Manager',
    ownerLabel: 'Route mini-program documentation',
    ownerActionText: 'tighten or author the current mini-program documentation slice',
    pathMatchers: [
      'docs/mini-program',
      'docs/runbooks/mini-program',
      'docs/PLATFORM_COORDINATION.md',
      'docs/mini-program-data-fetching.md',
    ],
    keywords: ['mini-program', 'wechat', 'runbook', 'platform coordination'],
  },
  {
    id: 'backend',
    label: 'Backend',
    ownerAgent: 'Backend Engineer',
    ownerLabel: 'Route backend implementation',
    ownerActionText: 'implement the current backend slice',
    pathMatchers: ['apps/server/', 'packages/shared/src/', 'packages/shared/', 'docs/api/'],
    keywords: ['backend', 'server', 'api', 'route', 'repository'],
  },
  {
    id: 'product',
    label: 'Product scope',
    ownerAgent: 'Product Manager',
    ownerLabel: 'Route product scoping',
    ownerActionText: 'tighten the product scope and acceptance criteria',
    pathMatchers: ['PRODUCT_REQUIREMENTS.md', 'docs/proposals/', 'docs/ai-workflow'],
    keywords: ['prd', 'acceptance criteria', 'product', 'scope', 'requirement'],
  },
  {
    id: 'general',
    label: 'Current slice',
    ownerAgent: 'Backend Engineer',
    ownerLabel: 'Route implementation',
    ownerActionText: 'implement the current slice',
    pathMatchers: [],
    keywords: [],
  },
];

const STATIC_ROUTE_FALLBACKS = {
  Researcher: {
    label: 'Re-open discovery',
    actionText: 'rebuild the missing repo context before execution continues',
    kind: 'route-agent',
    transport: 'native-button',
  },
  Planner: {
    label: 'Re-plan execution',
    actionText: 'refresh the approval-first execution plan from current findings',
    kind: 'route-agent',
    transport: 'native-button',
  },
  'Auto-Eval': {
    label: 'Route local quality gate',
    actionText: 'rerun the local dirty-worktree quality gate',
    kind: 'rerun-check',
    transport: 'native-button',
  },
  'QA Agent': {
    label: 'Request focused verification',
    actionText: 'turn the implemented scope into a focused verification pass',
    kind: 'route-agent',
    transport: 'native-button',
  },
  debug: {
    label: 'Route bug investigation',
    actionText: 'investigate the failing behavior and isolate the root cause',
    kind: 'route-agent',
    transport: 'native-button',
  },
  Verifier: {
    label: 'Request skeptical verification',
    actionText: 'pressure-test the current claim before accepting it as done',
    kind: 'route-agent',
    transport: 'routing-text',
  },
  'Backend Engineer': {
    label: 'Route backend implementation',
    actionText: 'implement the current backend slice',
    kind: 'route-agent',
    transport: 'routing-text',
  },
  'Product Manager': {
    label: 'Route product scoping',
    actionText: 'tighten the product scope and acceptance criteria',
    kind: 'route-agent',
    transport: 'routing-text',
  },
  'Taro Mini-Program Frontend Engineer': {
    label: 'Route mini-program implementation',
    actionText: 'implement the current mini-program UI slice',
    kind: 'route-agent',
    transport: 'routing-text',
  },
  'Expert React Frontend Engineer': {
    label: 'Route frontend implementation',
    actionText: 'implement the current frontend slice',
    kind: 'route-agent',
    transport: 'routing-text',
  },
};

const MODEL_HINTS = {
  Researcher: 'GPT-5.4 mini',
  Planner: 'GPT-5.4 mini',
  'Auto-Eval': 'GPT-5.4 mini',
  'QA Agent': 'GPT-5.4 mini',
  Verifier: 'GPT-5.4 mini',
  debug: 'GPT-5.4 xhigh',
  'Backend Engineer': 'GPT-5.4 xhigh',
  'Product Manager': 'GPT-5.4 xhigh',
  'Taro Mini-Program Frontend Engineer': 'GPT-5.4 xhigh',
  'Expert React Frontend Engineer': 'GPT-5.4 xhigh',
};

const TRACK_PRIORITY = new Map(
  TRACK_DEFINITIONS.map((track, index) => [track.id, TRACK_DEFINITIONS.length - index]),
);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringList(value) {
  return Array.isArray(value)
    ? value.map((entry) => cleanString(entry)).filter(Boolean)
    : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanString(value)).filter(Boolean))];
}

function slugify(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'action';
}

function normalizeNextSteps(value) {
  if (!isPlainObject(value)) {
    return {
      bugFix: [],
      enhancement: [],
      validation: [],
    };
  }

  return {
    bugFix: toStringList(value.bugFix),
    enhancement: toStringList(value.enhancement),
    validation: toStringList(value.validation),
  };
}

function normalizeSummaryCollection(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((summary) => ({
      summaryId: cleanString(summary.summaryId),
      turnId: cleanString(summary.turnId),
      agentName: cleanString(summary.agentName),
      turnStatus: cleanString(summary.turnStatus).toLowerCase() || null,
      done: toStringList(summary.done),
      keyBullets: toStringList(summary.keyBullets),
      filesChanged: toStringList(summary.filesChanged ?? summary.changedFiles),
      blockers: toStringList(summary.blockers),
      nextSteps: normalizeNextSteps(summary.nextSteps),
      utilization: Array.isArray(summary.utilization) ? summary.utilization.filter(isPlainObject) : [],
    }));
}

function normalizeRecentAgentSummaries(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([agentName, summaries]) => [cleanString(agentName), normalizeSummaryCollection(summaries)])
      .filter(([agentName]) => Boolean(agentName)),
  );
}

function flattenSummaries(turnSummaryState) {
  const recentAgentSummaries = normalizeRecentAgentSummaries(turnSummaryState?.recentAgentSummaries);
  const recentSupervisorReports = normalizeSummaryCollection(turnSummaryState?.recentSupervisorReports);

  return {
    recentAgentSummaries,
    recentSupervisorReports,
    all: [
      ...Object.values(recentAgentSummaries).flat(),
      ...recentSupervisorReports,
    ],
  };
}

function normalizeKickoff(kickoff) {
  const value = isPlainObject(kickoff) ? kickoff : {};
  return {
    status: cleanString(value.status) || 'idle',
    approvalMode: cleanString(value.approvalMode) || null,
    lastReason: cleanString(value.lastReason) || null,
    recommendationIssued: Boolean(value.recommendationIssued),
  };
}

function normalizeMemoryLifecycle(lifecycle) {
  if (!isPlainObject(lifecycle)) {
    return null;
  }

  return {
    status: cleanString(lifecycle.status) || 'clear',
    cautionHitCount: Number.isInteger(lifecycle.cautionHitCount) ? lifecycle.cautionHitCount : 0,
    staleHitCount: Number.isInteger(lifecycle.staleHitCount) ? lifecycle.staleHitCount : 0,
    conflictHitCount: Number.isInteger(lifecycle.conflictHitCount) ? lifecycle.conflictHitCount : 0,
    warningHitIds: toStringList(lifecycle.warningHitIds),
  };
}

function statusFromEntry(entry) {
  const statusLabel = cleanString(entry.statusLabel || entry.status || entry.result).toLowerCase();
  if (statusLabel === 'passed' || statusLabel === 'success' || statusLabel === 'ok') {
    return 'passed';
  }
  if (statusLabel === 'failed' || statusLabel === 'failure' || statusLabel === 'error') {
    return 'failed';
  }
  if (statusLabel === 'blocked') {
    return 'blocked';
  }
  if (entry.blocked === true) {
    return 'blocked';
  }
  if (entry.ok === true || entry.exitCode === 0) {
    return 'passed';
  }
  if (entry.ok === false || (typeof entry.exitCode === 'number' && entry.exitCode !== 0) || cleanString(entry.error)) {
    return 'failed';
  }
  return 'unknown';
}

function extractEvidence(entry) {
  return uniqueStrings([
    cleanString(entry.summary),
    cleanString(entry.reason),
    cleanString(entry.error),
    cleanString(entry.stderr),
    cleanString(entry.stdout),
    cleanString(entry.rawOutput),
  ]);
}

function deriveChecks(runtimeContext, summaryState) {
  const testOutputs = Array.isArray(runtimeContext?.testOutputs) ? runtimeContext.testOutputs : [];
  const summaryChecks = [];

  for (const summary of summaryState.all) {
    if (summary.turnStatus === 'blocked' || summary.blockers.length > 0) {
      summaryChecks.push({
        id: summary.summaryId || `summary-${summary.agentName || 'agent'}`,
        label: cleanString(summary.agentName) || 'Turn blocker',
        status: summary.turnStatus === 'blocked' ? 'blocked' : 'failed',
        source: 'artifact',
        evidence: summary.blockers.length > 0 ? summary.blockers : summary.done,
        relatedPaths: summary.filesChanged,
      });
    }
  }

  const explicitChecks = testOutputs.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      const evidence = cleanString(entry);
      return evidence
        ? [{
            id: `test-output-${index + 1}`,
            label: evidence.slice(0, 120),
            status: /fail|error|timeout|blocked/i.test(evidence) ? 'failed' : 'unknown',
            source: 'runtime',
            evidence: [evidence],
            relatedPaths: [],
          }]
        : [];
    }

    if (!isPlainObject(entry)) {
      return [];
    }

    return [{
      id: cleanString(entry.id || entry.name) || `test-output-${index + 1}`,
      label: cleanString(entry.label || entry.name || entry.summary || entry.commandLine) || `Check ${index + 1}`,
      status: statusFromEntry(entry),
      source: cleanString(entry.source) || 'runtime',
      evidence: extractEvidence(entry),
      relatedPaths: toStringList(entry.relatedPaths || entry.changedFiles || entry.filesChanged),
    }];
  });

  return [...summaryChecks, ...explicitChecks];
}

function normalizeRouteCatalog(manifest) {
  const handoffGraph = Array.isArray(manifest?.handoff_graph) ? manifest.handoff_graph : [];
  return handoffGraph
    .filter((entry) => cleanString(entry.from) === 'Supervisor' && cleanString(entry.to))
    .map((entry) => ({
      from: 'Supervisor',
      agent: cleanString(entry.to),
      label: cleanString(entry.label),
      prompt: cleanString(entry.prompt),
    }))
    .filter((entry) => Boolean(entry.agent) && Boolean(entry.label));
}

function inferTrackId(filePath) {
  const normalizedPath = cleanString(filePath);
  const lowerPath = normalizedPath.toLowerCase();

  for (const track of TRACK_DEFINITIONS) {
    if (
      track.pathMatchers.some((matcher) => lowerPath.includes(matcher.toLowerCase()))
      || track.keywords.some((keyword) => lowerPath.includes(keyword.toLowerCase()))
    ) {
      return track.id;
    }
  }

  if (normalizedPath.startsWith('docs/')) {
    return 'product';
  }

  return 'general';
}

function collectChangedFiles(runtimeContext, summaryState) {
  return uniqueStrings([
    ...toStringList(runtimeContext?.changedFiles),
    ...summaryState.all.flatMap((summary) => summary.filesChanged),
  ]);
}

function clusterTracks(changedFiles) {
  const trackMap = new Map();

  for (const filePath of changedFiles) {
    const trackId = inferTrackId(filePath);
    const definition = TRACK_DEFINITIONS.find((entry) => entry.id === trackId) || TRACK_DEFINITIONS[TRACK_DEFINITIONS.length - 1];
    if (!definition) {
      continue;
    }

    if (!trackMap.has(trackId)) {
      trackMap.set(trackId, {
        trackId: definition.id,
        trackLabel: definition.label,
        ownerAgent: definition.ownerAgent,
        ownerLabel: definition.ownerLabel,
        ownerActionText: definition.ownerActionText,
        changedFiles: [],
      });
    }

    trackMap.get(trackId).changedFiles.push(filePath);
  }

  if (trackMap.size === 0) {
    const fallback = TRACK_DEFINITIONS.find((entry) => entry.id === 'general');
    if (fallback) {
      trackMap.set(fallback.id, {
        trackId: fallback.id,
        trackLabel: fallback.label,
        ownerAgent: fallback.ownerAgent,
        ownerLabel: fallback.ownerLabel,
        ownerActionText: fallback.ownerActionText,
        changedFiles: [],
      });
    }
  }

  return [...trackMap.values()].map((track) => ({
    ...track,
    changedFiles: uniqueStrings(track.changedFiles),
  }));
}

function promptHasAny(promptText, terms) {
  const lowerPrompt = cleanString(promptText).toLowerCase();
  return terms.some((term) => lowerPrompt.includes(term));
}

function summaryTouchesTrack(summary, trackId) {
  const filesChanged = toStringList(summary?.filesChanged);
  if (filesChanged.length === 0) {
    return trackId === 'general';
  }
  return filesChanged.some((filePath) => inferTrackId(filePath) === trackId);
}

function getTrackSummaries(track, summaryState) {
  return summaryState.all.filter((summary) => summaryTouchesTrack(summary, track.trackId));
}

function getTrackChecks(track, checks) {
  return checks.filter((check) => {
    const relatedPaths = toStringList(check.relatedPaths);
    if (relatedPaths.length === 0) {
      return true;
    }
    return relatedPaths.some((filePath) => inferTrackId(filePath) === track.trackId);
  });
}

function buildTrackRouteCatalog(routeCatalog) {
  return new Map(routeCatalog.map((entry) => [entry.agent, entry]));
}

function contextualizeActionText(actionText, trackLabel) {
  const normalizedActionText = cleanString(actionText);
  const normalizedTrackLabel = cleanString(trackLabel).toLowerCase();
  if (!normalizedActionText || !normalizedTrackLabel || normalizedTrackLabel === 'current slice') {
    return normalizedActionText;
  }
  return `${normalizedActionText} for ${normalizedTrackLabel}`;
}

function createCandidate(track, agent, routeCatalogByAgent, overrides = {}) {
  const staticRoute = agent ? routeCatalogByAgent.get(agent) : null;
  const fallback = agent ? STATIC_ROUTE_FALLBACKS[agent] : null;
  const label = cleanString(overrides.label) || cleanString(staticRoute?.label) || cleanString(fallback?.label) || track.ownerLabel;
  const actionText = cleanString(overrides.actionText)
    || contextualizeActionText(staticRoute?.label ? fallback?.actionText : cleanString(fallback?.actionText), track.trackLabel)
    || track.ownerActionText;

  return {
    id: `${track.trackId}.${slugify(agent || label)}`,
    trackId: track.trackId,
    trackLabel: track.trackLabel,
    changedFiles: track.changedFiles,
    agent,
    label,
    actionText,
    prompt: cleanString(overrides.prompt) || cleanString(staticRoute?.prompt) || null,
    transport: cleanString(overrides.transport) || cleanString(fallback?.transport) || 'routing-text',
    kind: cleanString(overrides.kind) || cleanString(fallback?.kind) || 'route-agent',
    score: 0,
    confidence: 0.45,
    rationale: [],
    evidence: [],
    sourceSignals: [],
    modelHint: cleanString(overrides.modelHint) || MODEL_HINTS[agent] || null,
    hiddenBecause: [],
    blockedBy: [],
    usesNativeButton: Boolean(staticRoute),
    isTrackOwner: agent === track.ownerAgent,
  };
}

function seedCandidatesForTrack(track, routeCatalogByAgent) {
  const seeded = [];

  if (track.ownerAgent) {
    seeded.push(
      createCandidate(track, track.ownerAgent, routeCatalogByAgent, {
        label: track.ownerLabel,
        actionText: track.ownerActionText,
        transport: 'routing-text',
      }),
    );
  }

  for (const agent of ['Researcher', 'Planner', 'Auto-Eval', 'QA Agent', 'debug', 'Verifier']) {
    seeded.push(createCandidate(track, agent, routeCatalogByAgent));
  }

  return [...new Map(seeded.map((candidate) => [candidate.id, candidate])).values()];
}

function boost(candidate, points, reason, signal, evidence = []) {
  if (points <= 0) {
    return;
  }

  candidate.score += points;
  candidate.rationale.push(reason);
  candidate.sourceSignals.push(signal);
  candidate.evidence.push(...evidence);
}

function penalize(candidate, points, reason, signal) {
  if (points <= 0) {
    return;
  }

  candidate.score -= points;
  candidate.rationale.push(reason);
  candidate.sourceSignals.push(signal);
}

function applyDomainScore(candidate, track) {
  if (candidate.agent === track.ownerAgent) {
    boost(candidate, 30, 'Track ownership matches the active file cluster.', 'domain-match', track.changedFiles);
    return;
  }

  if (candidate.agent === 'Auto-Eval' && track.trackId === 'orchestration') {
    boost(candidate, 20, 'Orchestration surfaces benefit from an explicit local gate.', 'domain-match', track.changedFiles);
    return;
  }

  if (candidate.agent === 'QA Agent' && track.trackId === 'orchestration') {
    boost(candidate, 10, 'The orchestration contract benefits from focused verification after edits.', 'domain-match', track.changedFiles);
    return;
  }

  if (candidate.agent === 'debug' && track.trackId === 'mini-program-ui') {
    boost(candidate, 20, 'Mini-program UI regressions map cleanly to the debug lane.', 'domain-match', track.changedFiles);
    return;
  }

  if (candidate.agent === 'Verifier' && track.trackId === 'mini-program-docs') {
    boost(candidate, 15, 'Docs-heavy mini-program slices benefit from skeptical verification.', 'domain-match', track.changedFiles);
    return;
  }

  if (candidate.agent === 'Product Manager' && (track.trackId === 'product' || track.trackId === 'mini-program-docs')) {
    boost(candidate, 20, 'This track is product- or docs-shaped rather than implementation-first.', 'domain-match', track.changedFiles);
  }
}

function applyFailureScore(candidate, trackChecks) {
  const failedChecks = trackChecks.filter((check) => check.status === 'failed');
  const blockedChecks = trackChecks.filter((check) => check.status === 'blocked');
  const failureEvidence = uniqueStrings(trackChecks.flatMap((check) => check.evidence));

  if (candidate.agent === 'debug' && (failedChecks.length > 0 || blockedChecks.length > 0)) {
    boost(candidate, failedChecks.length > 0 ? 40 : 25, 'Explicit failure evidence points to debugging first.', 'failure-evidence', failureEvidence);
    return;
  }

  if (candidate.isTrackOwner && (failedChecks.length > 0 || blockedChecks.length > 0)) {
    boost(candidate, 15, 'The owning implementation lane has concrete failure evidence to resolve.', 'failure-evidence', failureEvidence);
  }

  if (candidate.agent === 'Auto-Eval' && (failedChecks.length > 0 || blockedChecks.length > 0) && candidate.trackId === 'orchestration') {
    boost(candidate, 20, 'Orchestration failures still need deterministic local gate confirmation.', 'failure-evidence', failureEvidence);
  }

  if (candidate.agent === 'QA Agent' && trackChecks.length > 0) {
    boost(candidate, 10, 'This track already has concrete checks that can become a focused verification pass.', 'failure-evidence', failureEvidence);
  }
}

function applyNextStepScore(candidate, trackSummaries) {
  const bugFixItems = uniqueStrings(trackSummaries.flatMap((summary) => summary.nextSteps.bugFix));
  const enhancementItems = uniqueStrings(trackSummaries.flatMap((summary) => summary.nextSteps.enhancement));
  const validationItems = uniqueStrings(trackSummaries.flatMap((summary) => summary.nextSteps.validation));
  const blockers = uniqueStrings(trackSummaries.flatMap((summary) => summary.blockers));

  if (candidate.agent === 'debug' && bugFixItems.length > 0) {
    boost(candidate, 25, 'Recent summaries explicitly call for a bug-fix next step.', 'summary-next-steps', [...bugFixItems, ...blockers]);
  }

  if (candidate.isTrackOwner && enhancementItems.length > 0) {
    boost(candidate, 20, 'Recent summaries explicitly point to more implementation on this track.', 'summary-next-steps', enhancementItems);
  }

  if (candidate.agent === 'QA Agent' && validationItems.length > 0) {
    boost(candidate, 25, 'Recent summaries explicitly call for focused verification.', 'summary-next-steps', validationItems);
  }

  if (candidate.agent === 'Auto-Eval' && validationItems.length > 0) {
    boost(candidate, 20, 'Recent summaries explicitly call for the local quality gate.', 'summary-next-steps', validationItems);
  }

  if (candidate.agent === 'Verifier' && validationItems.length > 0) {
    boost(candidate, 15, 'Recent summaries call for a skeptical verification pass.', 'summary-next-steps', validationItems);
  }

  if (candidate.agent === 'debug' && blockers.length > 0) {
    boost(candidate, 15, 'Track blockers are still unresolved.', 'summary-blockers', blockers);
  }

  if (candidate.agent === 'Product Manager' && enhancementItems.length > 0 && candidate.trackId === 'mini-program-docs') {
    boost(candidate, 10, 'The active docs track still has enhancement-shaped follow-up work.', 'summary-next-steps', enhancementItems);
  }
}

function applyMomentumScore(candidate, trackSummaries) {
  const recentTrackSummaries = trackSummaries.slice(-2);
  if (recentTrackSummaries.some((summary) => summary.agentName === candidate.agent)) {
    boost(candidate, 10, 'The same lane already has recent momentum on this track.', 'recent-momentum');
    return;
  }

  if (candidate.isTrackOwner && recentTrackSummaries.some((summary) => summary.done.length > 0)) {
    boost(candidate, 5, 'The track already has recent delivery momentum.', 'recent-momentum');
  }
}

function applyPromptIntentScore(candidate, promptText, track) {
  if (!cleanString(promptText)) {
    return;
  }

  if (promptHasAny(promptText, ['debug', 'fix', 'bug', 'error', 'failing', 'broken', 'regression', 'issue']) && candidate.agent === 'debug') {
    boost(candidate, 15, 'The prompt is asking for debugging or a narrow fix.', 'prompt-intent');
  }

  if (promptHasAny(promptText, ['verify', 'validation', 'validate', 'test', 'qa', 'review']) && ['QA Agent', 'Auto-Eval', 'Verifier'].includes(candidate.agent)) {
    boost(candidate, 15, 'The prompt explicitly calls for validation or review.', 'prompt-intent');
  }

  if (promptHasAny(promptText, ['plan', 'scope', 'research', 'discover', 'ambigu']) && ['Researcher', 'Planner', 'Product Manager'].includes(candidate.agent)) {
    boost(candidate, 15, 'The prompt explicitly asks for planning or discovery.', 'prompt-intent');
  }

  if (promptHasAny(promptText, ['implement', 'build', 'add', 'wire', 'emit', 'write']) && candidate.agent === track.ownerAgent) {
    boost(candidate, 12, 'The prompt is implementation-shaped for the active track.', 'prompt-intent');
  }

  if (promptHasAny(promptText, ['doc', 'docs', 'documentation']) && candidate.agent === 'Product Manager' && candidate.trackId === 'mini-program-docs') {
    boost(candidate, 12, 'The prompt is documentation-shaped for the mini-program docs track.', 'prompt-intent');
  }
}

function applyRiskScore(candidate, track) {
  if (candidate.agent === 'Auto-Eval' && track.trackId === 'orchestration') {
    boost(candidate, 10, 'The orchestration contract is a higher-risk surface for local validation.', 'risk-adjustment');
  }

  if (candidate.agent === 'Backend Engineer' && track.trackId === 'backend') {
    boost(candidate, 10, 'Backend slices have explicit domain ownership and regression risk.', 'risk-adjustment');
  }

  if (candidate.agent === 'Taro Mini-Program Frontend Engineer' && track.trackId === 'mini-program-ui') {
    boost(candidate, 10, 'Mini-program UI slices benefit from Taro-native implementation ownership.', 'risk-adjustment');
  }

  if (candidate.agent === 'Product Manager' && (track.trackId === 'product' || track.trackId === 'mini-program-docs')) {
    boost(candidate, 10, 'Product-facing slices carry acceptance-criteria risk if routed too mechanically.', 'risk-adjustment');
  }
}

function applyKickoffPenalty(candidate, kickoff, recommendedNextAgents, trackChecks) {
  if (!['Researcher', 'Planner'].includes(candidate.agent)) {
    return;
  }

  const recommendedSet = new Set(toStringList(recommendedNextAgents));
  if (kickoff.status === 'recommended' || recommendedSet.has(candidate.agent)) {
    boost(candidate, 20, 'Kickoff routing is still active in runtime state.', 'kickoff-state');
    return;
  }

  if (kickoff.lastReason === 'narrow-cleared-recommendation' || kickoff.lastReason === 'narrow-or-already-routed') {
    penalize(candidate, 30, 'Kickoff was already cleared for a bounded slice.', 'kickoff-state');
    candidate.hiddenBecause.push('Kickoff is already settled for a bounded slice.');
    return;
  }

  if (trackChecks.some((check) => check.status === 'failed' || check.status === 'blocked')) {
    penalize(candidate, 20, 'Concrete failure evidence makes reopening kickoff premature.', 'kickoff-state');
    candidate.blockedBy.push('Concrete failure evidence points to debugging or implementation first.');
  }
}

function applyMemoryPenalty(candidate, lifecycle) {
  if (!lifecycle) {
    return;
  }

  const hasLifecycleWarning = lifecycle.status === 'caution' || lifecycle.status === 'stale' || lifecycle.status === 'conflicted';
  if (!hasLifecycleWarning) {
    return;
  }

  if (candidate.agent === 'Researcher' && lifecycle.conflictHitCount > 0) {
    boost(candidate, 5, 'Conflicted memory hits make a short discovery refresh more defensible.', 'memory-lifecycle', lifecycle.warningHitIds);
  }

  if (candidate.agent === 'Auto-Eval' || candidate.agent === 'QA Agent' || candidate.agent === 'Verifier') {
    boost(candidate, 5, 'Memory lifecycle warnings make explicit verification more valuable.', 'memory-lifecycle', lifecycle.warningHitIds);
    return;
  }

  penalize(candidate, 10, 'Memory lifecycle warnings reduce confidence in overconfident routing.', 'memory-lifecycle');
}

function applyPrerequisitePenalty(candidate, track, trackChecks, trackSummaries) {
  const hasActiveFailure = trackChecks.some((check) => check.status === 'failed' || check.status === 'blocked');
  const hasEnhancementSignal = track.changedFiles.length > 0 || trackSummaries.some((summary) => summary.nextSteps.enhancement.length > 0);

  if ((candidate.agent === 'QA Agent' || candidate.agent === 'Verifier') && hasActiveFailure) {
    penalize(candidate, 25, 'Verification is secondary while the active failure is unresolved.', 'missing-prerequisite');
    candidate.blockedBy.push('Resolve the active failure before requesting verification.');
  }

  if (candidate.agent === 'Auto-Eval' && hasActiveFailure && track.trackId !== 'orchestration') {
    penalize(candidate, 10, 'The local gate is secondary while a concrete failure is still live.', 'missing-prerequisite');
    candidate.blockedBy.push('Stabilize the failing slice before a local gate rerun.');
  }

  if (candidate.isTrackOwner && !hasEnhancementSignal && !hasActiveFailure) {
    penalize(candidate, 10, 'The track owner has no visible implementation or failure signal yet.', 'missing-prerequisite');
  }
}

function finalizeVisibility(candidate, kickoff, lifecycle, track, trackChecks, trackSummaries) {
  const hasActiveFailure = trackChecks.some((check) => check.status === 'failed' || check.status === 'blocked');
  const hasValidationSignal = trackSummaries.some((summary) => summary.nextSteps.validation.length > 0);
  const hasImplementationSignal = track.changedFiles.length > 0 || trackSummaries.some(
    (summary) => summary.nextSteps.enhancement.length > 0 || summary.nextSteps.bugFix.length > 0,
  );

  if (candidate.agent === 'debug' && !hasActiveFailure) {
    candidate.hiddenBecause.push('No explicit failure evidence is attached to this track.');
  }

  if (candidate.agent === 'QA Agent' && !hasValidationSignal && !hasImplementationSignal) {
    candidate.hiddenBecause.push('No focused verification handoff is visible for this track.');
  }

  if (candidate.agent === 'QA Agent' && hasActiveFailure) {
    candidate.hiddenBecause.push('Active failure evidence still points to debugging first.');
  }

  if (candidate.agent === 'Auto-Eval' && !hasValidationSignal && !hasImplementationSignal && !hasActiveFailure) {
    candidate.hiddenBecause.push('No validate-now signal is visible for this track.');
  }

  if (
    ['Researcher', 'Planner'].includes(candidate.agent)
    && !kickoff.recommendationIssued
    && kickoff.status !== 'recommended'
    && lifecycle?.status !== 'conflicted'
    && lifecycle?.status !== 'stale'
  ) {
    candidate.hiddenBecause.push('Kickoff does not need to reopen from current evidence.');
  }

  if (candidate.isTrackOwner && !hasImplementationSignal && !hasActiveFailure) {
    candidate.hiddenBecause.push('The track does not show active implementation work yet.');
  }

  if (candidate.score <= 0) {
    candidate.hiddenBecause.push('The action scored below the routing threshold.');
  }
}

function finalizeConfidence(candidate) {
  const evidenceBoost = Math.min(0.3, candidate.evidence.length * 0.05 + candidate.sourceSignals.length * 0.03);
  const blockedPenalty = candidate.blockedBy.length > 0 ? 0.15 : 0;
  const hiddenPenalty = candidate.hiddenBecause.length > 0 ? 0.2 : 0;
  candidate.confidence = Math.max(0.2, Math.min(0.95, 0.45 + evidenceBoost - blockedPenalty - hiddenPenalty));
  candidate.rationale = uniqueStrings(candidate.rationale).slice(0, 6);
  candidate.evidence = uniqueStrings(candidate.evidence).slice(0, 4);
  candidate.sourceSignals = uniqueStrings(candidate.sourceSignals).slice(0, 6);
  candidate.hiddenBecause = uniqueStrings(candidate.hiddenBecause);
  candidate.blockedBy = uniqueStrings(candidate.blockedBy);
}

function sortActions(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.evidence.length !== left.evidence.length) {
    return right.evidence.length - left.evidence.length;
  }

  const rightTrackPriority = TRACK_PRIORITY.get(right.trackId) ?? 0;
  const leftTrackPriority = TRACK_PRIORITY.get(left.trackId) ?? 0;
  if (rightTrackPriority !== leftTrackPriority) {
    return rightTrackPriority - leftTrackPriority;
  }

  return left.label.localeCompare(right.label);
}

function isVisibleAction(action) {
  return action.hiddenBecause.length === 0 && action.score > 0;
}

function selectRoutingActions(trackArtifacts) {
  const primaryTrackActions = trackArtifacts
    .map((track) => track.actions.find(isVisibleAction) || null)
    .filter(Boolean)
    .sort(sortActions);

  const selectedPrimary = primaryTrackActions.slice(0, ROUTING_PRIMARY_LIMIT);
  const selectedIds = new Set(selectedPrimary.map((action) => action.id));
  const remainingActions = trackArtifacts
    .flatMap((track) => track.actions)
    .filter((action) => isVisibleAction(action) && !selectedIds.has(action.id))
    .sort(sortActions);

  return {
    primary: selectedPrimary,
    overflow: remainingActions.slice(0, ROUTING_OVERFLOW_LIMIT),
  };
}

function toRoutingEntry(action) {
  const line = action.modelHint
    ? `${action.agent} — ${action.actionText} (suggested model: ${action.modelHint})`
    : `${action.agent} — ${action.actionText}`;

  return {
    id: action.id,
    agent: action.agent,
    trackId: action.trackId,
    trackLabel: action.trackLabel,
    label: action.label,
    actionText: action.actionText,
    line,
    prompt: action.prompt,
    modelHint: action.modelHint,
    why: action.evidence.slice(0, 2),
    usesNativeButton: action.usesNativeButton,
  };
}

function toPublicAction(action) {
  return {
    id: action.id,
    agent: action.agent,
    label: action.label,
    actionText: action.actionText,
    prompt: action.prompt,
    transport: action.transport,
    kind: action.kind,
    score: action.score,
    confidence: Number(action.confidence.toFixed(2)),
    rationale: action.rationale,
    evidence: action.evidence,
    sourceSignals: action.sourceSignals,
    modelHint: action.modelHint,
    hiddenBecause: action.hiddenBecause,
    blockedBy: action.blockedBy,
    usesNativeButton: action.usesNativeButton,
  };
}

function buildNativeButtonHints(actions) {
  return actions
    .filter((action) => action.usesNativeButton)
    .sort(sortActions)
    .slice(0, 5)
    .map((action) => ({
      agent: action.agent,
      label: action.label,
      trackId: action.trackId,
      trackLabel: action.trackLabel,
      why: action.evidence.slice(0, 2),
    }));
}

function deriveSourceTurnId(runtimeContext, summaryState) {
  const latestSupervisorReport = summaryState.recentSupervisorReports[summaryState.recentSupervisorReports.length - 1];
  if (cleanString(latestSupervisorReport?.turnId)) {
    return cleanString(latestSupervisorReport.turnId);
  }

  const sessionId = cleanString(runtimeContext?.sessionId);
  const lastTurnSequence = Number.isInteger(runtimeContext?.turnSummaryState?.lastTurnSequence)
    ? runtimeContext.turnSummaryState.lastTurnSequence
    : null;

  if (sessionId && typeof lastTurnSequence === 'number' && lastTurnSequence > 0) {
    return `${sessionId}:turn:${lastTurnSequence}`;
  }

  return sessionId || null;
}

export function buildNextActionsArtifact({
  runtimeContext,
  manifest,
  generatedAt = new Date().toISOString(),
}) {
  const routeCatalog = normalizeRouteCatalog(manifest);
  const routeCatalogByAgent = buildTrackRouteCatalog(routeCatalog);
  const summaryState = flattenSummaries(runtimeContext?.turnSummaryState);
  const changedFiles = collectChangedFiles(runtimeContext, summaryState);
  const tracks = clusterTracks(changedFiles);
  const kickoff = normalizeKickoff(runtimeContext?.kickoff);
  const lifecycle = normalizeMemoryLifecycle(runtimeContext?.memoryContext?.lifecycle);
  const checks = deriveChecks(runtimeContext, summaryState);
  const promptText = cleanString(runtimeContext?.upstreamResult?.prompt) || null;
  const recommendedNextAgents = toStringList(runtimeContext?.recommendedNextAgents);

  const trackArtifacts = tracks.map((track) => {
    const trackSummaries = getTrackSummaries(track, summaryState);
    const trackChecks = getTrackChecks(track, checks);
    const actions = seedCandidatesForTrack(track, routeCatalogByAgent)
      .map((candidate) => {
        applyDomainScore(candidate, track);
        applyFailureScore(candidate, trackChecks);
        applyNextStepScore(candidate, trackSummaries);
        applyMomentumScore(candidate, trackSummaries);
        applyPromptIntentScore(candidate, promptText, track);
        applyRiskScore(candidate, track);
        applyKickoffPenalty(candidate, kickoff, recommendedNextAgents, trackChecks);
        applyMemoryPenalty(candidate, lifecycle);
        applyPrerequisitePenalty(candidate, track, trackChecks, trackSummaries);
        finalizeVisibility(candidate, kickoff, lifecycle, track, trackChecks, trackSummaries);
        finalizeConfidence(candidate);
        return candidate;
      })
      .sort(sortActions)
      .slice(0, MAX_TRACK_ACTIONS);

    return {
      ...track,
      actions,
    };
  });

  const routing = selectRoutingActions(trackArtifacts);
  const visibleActions = trackArtifacts.flatMap((track) => track.actions.filter(isVisibleAction));
  const routingActions = [...routing.primary, ...routing.overflow];

  return {
    generatedAt,
    sourceTurnId: deriveSourceTurnId(runtimeContext, summaryState),
    recommendedNextAgents: uniqueStrings(routingActions.map((action) => action.agent)).slice(0, 3).length > 0
      ? uniqueStrings(routingActions.map((action) => action.agent)).slice(0, 3)
      : recommendedNextAgents,
    routing: {
      primary: routing.primary.map(toRoutingEntry),
      overflow: routing.overflow.map(toRoutingEntry),
      totalAvailable: visibleActions.length,
    },
    nativeButtonHints: buildNativeButtonHints(visibleActions),
    checks,
    tracks: trackArtifacts.map((track) => ({
      trackId: track.trackId,
      trackLabel: track.trackLabel,
      changedFiles: track.changedFiles,
      primaryActionId: (track.actions.find(isVisibleAction) || {}).id || null,
      actions: track.actions.map(toPublicAction),
    })),
  };
}

export function writeNextActionsArtifact(repoRoot, artifact) {
  const artifactPath = path.join(repoRoot, NEXT_ACTIONS_ARTIFACT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifactPath;
}

export function syncNextActionsArtifact(repoRoot, runtimeContext, manifest, options = {}) {
  const artifact = buildNextActionsArtifact({
    runtimeContext,
    manifest,
    generatedAt: cleanString(options.generatedAt) || new Date().toISOString(),
  });

  if (process.env.ORCHESTRATION_DISABLE_RUNTIME_WRITES !== '1') {
    writeNextActionsArtifact(repoRoot, artifact);
  }

  return artifact;
}