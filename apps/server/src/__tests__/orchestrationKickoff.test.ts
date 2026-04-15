import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CollectChangedFiles = (repoRoot: string) => string[];
interface MeaningfulMemoryQueryRules {
  minCharacters: number;
  minTokens: number;
  minLongTokens: number;
  longTokenLength: number;
}

type BuildMemoryContext = (args: {
  changedFiles: string[];
  memoryConfig: {
    artifactPath: string;
    workflowRelevantPathPrefixes: string[];
    promptQueryRules: MeaningfulMemoryQueryRules;
    maxHits: number;
    minChangedFileScore: number;
    minPromptScore: number;
    maxValidationAgeDays: number;
    surfaceSourcePathConflicts: boolean;
  };
  previousMemoryContext?: RuntimeMemoryContext | null;
  promptText?: string;
  resetPrompt?: boolean;
  evaluatedAt?: string;
}) => RuntimeMemoryContext;

const orchestrationLibPath = new URL("../../../../scripts/orchestration-lib.mjs", import.meta.url).href;
const { collectChangedFiles } = await import(orchestrationLibPath) as {
  collectChangedFiles: CollectChangedFiles;
};
const orchestrationSupervisorPath = new URL("../../../../scripts/orchestration-supervisor.mjs", import.meta.url).href;
const { buildMemoryContext } = await import(orchestrationSupervisorPath) as {
  buildMemoryContext: BuildMemoryContext;
};
const memoryLibPath = new URL("../../../../scripts/memory-lib.mjs", import.meta.url).href;
const { DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES } = await import(memoryLibPath) as {
  DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES: MeaningfulMemoryQueryRules;
};

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');
const ORCHESTRATION_RUNTIME_DIR = path.join(REPO_ROOT, '.git', '.orchestration');
const ORCHESTRATION_CONTEXT_PATH = path.join(ORCHESTRATION_RUNTIME_DIR, 'context.json');
const ORCHESTRATION_EVENT_LOG_PATH = path.join(ORCHESTRATION_RUNTIME_DIR, 'events.jsonl');

interface HookResult {
  continue: boolean;
  systemMessage?: string;
}

interface RuntimeFileBackup {
  existed: boolean;
  contents: string | null;
}

interface RuntimeNextSteps {
  bugFix?: string[];
  enhancement?: string[];
  validation?: string[];
}

interface RuntimeRecentAgentSummary {
  summaryId?: string;
  agentName?: string;
  parentAgent?: string | null;
  recordedAt?: string;
  focusWindowTurns?: number;
  done?: string[];
  learned?: string[];
  nextTurnImprovements?: string[];
  confidenceScore?: number;
  appliedFeedbackFrom?: string[];
}

interface RuntimeRecentSupervisorReport {
  summaryId?: string;
  turnId?: string;
  turnSequence?: number;
  recordedAt?: string;
  focusWindowTurns?: number;
  done?: string[];
  keyBullets?: string[];
  crossAgentInsights?: string[];
  nextSteps?: RuntimeNextSteps;
  feedbackByAgent?: Record<string, string[]>;
  sourceSummaryIds?: string[];
  confidenceScore?: number;
  unresolvedAssumptions?: string[];
}

interface RuntimeTurnSummaryState {
  focusWindowTurns?: number;
  lastTurnSequence?: number;
  recentAgentSummaries?: Record<string, RuntimeRecentAgentSummary[]>;
  recentSupervisorReports?: RuntimeRecentSupervisorReport[];
}

interface RuntimeEventEntry {
  event?: string;
  kickoffStatus?: string | null;
  kickoffRecommended?: boolean;
  kickoffCleared?: boolean;
  promptSummary?: string | null;
  sessionId?: string;
  summaryId?: string;
  agentName?: string;
  turnId?: string | null;
  turnSequence?: number | null;
  summary?: Record<string, unknown>;
  memory?: {
    generatedIndexAvailable?: boolean;
    changedFileHitCount?: number;
    promptHitCount?: number;
    promptQueryMeaningful?: boolean;
    warningHitCount?: number;
    staleHitCount?: number;
    conflictHitCount?: number;
  };
}

interface RuntimeMemoryLifecycle {
  evaluatedAt?: string | null;
  lastValidatedAt?: string | null;
  status?: string;
  caution?: boolean;
  stale?: boolean;
  validationAgeDays?: number | null;
  maxValidationAgeDays?: number | null;
  conflict?: boolean;
  conflictingPaths?: string[];
  matchedAuthorityPaths?: string[];
  authoritativePaths?: string[];
  sourcePathConflictsEnabled?: boolean;
  warnings?: string[];
}

interface RuntimeMemoryLifecycleSummary {
  evaluatedAt?: string | null;
  maxValidationAgeDays?: number;
  sourcePathConflictsEnabled?: boolean;
  status?: string;
  totalHits?: number;
  cautionHitCount?: number;
  staleHitCount?: number;
  conflictHitCount?: number;
  warningHitIds?: string[];
}

interface RuntimeMemoryHit {
  id: string;
  title: string;
  path: string;
  score: number | null;
  reasons: string[];
  lastValidatedAt?: string | null;
  relatedPaths?: string[];
  sources?: string[];
  lifecycle?: RuntimeMemoryLifecycle;
}

interface RuntimeMemoryContext {
  status?: string;
  generatedIndex?: {
    path?: string;
    available?: boolean;
    noteCount?: number | null;
    error?: string | null;
  };
  changedFiles?: {
    consideredPaths?: string[];
    hits?: RuntimeMemoryHit[];
  };
  prompt?: {
    query?: string | null;
    meaningful?: boolean;
    hits?: RuntimeMemoryHit[];
  };
  lifecycle?: RuntimeMemoryLifecycleSummary;
  summary?: string | null;
}

interface RuntimeContext {
  artifactPaths?: string[];
  sessionId?: string;
  recommendedNextAgents?: string[];
  kickoff?: {
    status?: string;
    approvalMode?: string;
    recommendedAgents?: string[];
    recommendationIssued?: boolean;
    evaluationCount?: number;
    lastPrompt?: string | null;
    lastReason?: string | null;
  };
  turnSummaryState?: RuntimeTurnSummaryState;
  memoryContext?: RuntimeMemoryContext;
}

interface RecordSummaryResult {
  ok: boolean;
  persisted: boolean;
  sessionId: string;
  summaryId: string;
  type: string;
  turnId?: string | null;
  turnSequence?: number | null;
  focusWindowTurns: number;
}

function backupFile(filePath: string): RuntimeFileBackup {
  if (!existsSync(filePath)) {
    return {
      existed: false,
      contents: null,
    };
  }

  return {
    existed: true,
    contents: readFileSync(filePath, 'utf8'),
  };
}

function restoreFile(filePath: string, backup: RuntimeFileBackup) {
  if (backup.existed) {
    writeFileSync(filePath, backup.contents ?? '', 'utf8');
    return;
  }

  rmSync(filePath, { force: true });
}

function clearTestRuntimeFiles() {
  rmSync(ORCHESTRATION_CONTEXT_PATH, { force: true });
  rmSync(ORCHESTRATION_EVENT_LOG_PATH, { force: true });
}

function removeRuntimeDirIfEmpty() {
  if (!existsSync(ORCHESTRATION_RUNTIME_DIR)) {
    return;
  }

  if (readdirSync(ORCHESTRATION_RUNTIME_DIR).length === 0) {
    rmSync(ORCHESTRATION_RUNTIME_DIR, { recursive: true, force: true });
  }
}

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function runGitCommand(repoRoot: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  expect(result.status).toBe(0);
  return result.stdout.trim();
}

function writeRepoFile(repoRoot: string, relativePath: string, contents: string) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, 'utf8');
}

function runCopilotHook(eventName: string, payload: Record<string, unknown> = {}, runtimeWritesEnabled = false): HookResult {
  const result = spawnSync('node', ['scripts/orchestration-supervisor.mjs', 'copilot-hook', eventName], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      ORCHESTRATION_DISABLE_RUNTIME_WRITES: runtimeWritesEnabled ? '0' : '1',
    },
  });

  expect(result.status).toBe(0);

  return JSON.parse(result.stdout) as HookResult;
}

function runRecordSummaryCommand(
  commandArgs: string[],
  options: {
    input?: string;
    runtimeWritesEnabled?: boolean;
  } = {},
): RecordSummaryResult {
  const result = spawnSync('node', ['scripts/orchestration-supervisor.mjs', 'record-summary', ...commandArgs], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: options.input,
    env: {
      ...process.env,
      ORCHESTRATION_DISABLE_RUNTIME_WRITES: options.runtimeWritesEnabled ? '0' : '1',
    },
  });

  expect(result.status).toBe(0);

  return JSON.parse(result.stdout) as RecordSummaryResult;
}

function runRecordSummary(payload: Record<string, unknown>, runtimeWritesEnabled = false): RecordSummaryResult {
  return runRecordSummaryCommand([], {
    input: JSON.stringify(payload),
    runtimeWritesEnabled,
  });
}

function runRecordSummaryWithJsonArg(payload: Record<string, unknown>, runtimeWritesEnabled = false): RecordSummaryResult {
  return runRecordSummaryCommand(['--json', JSON.stringify(payload)], {
    runtimeWritesEnabled,
  });
}

function runRecordSummaryWithFileArg(filePath: string, runtimeWritesEnabled = false): RecordSummaryResult {
  return runRecordSummaryCommand(['--file', filePath], {
    runtimeWritesEnabled,
  });
}

function runNodeScript(args: string[], options: {
  input?: string;
  env?: NodeJS.ProcessEnv;
  expectStatus?: number;
} = {}) {
  const result = spawnSync('node', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: options.input,
    env: {
      ...process.env,
      ...options.env,
    },
  });

  expect(result.status).toBe(options.expectStatus ?? 0);
  return result;
}

function runKickoffHook(prompt: string) {
  return runCopilotHook('user-prompt-submit', { prompt });
}

function readRuntimeContext(): RuntimeContext {
  return JSON.parse(readFileSync(ORCHESTRATION_CONTEXT_PATH, 'utf8')) as RuntimeContext;
}

function readRuntimeEventLog(): RuntimeEventEntry[] {
  return readFileSync(ORCHESTRATION_EVENT_LOG_PATH, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEventEntry);
}

const REPO_MEMORY_INDEX_PATH = path.join(REPO_ROOT, 'repo-memory/generated/promoted-index.json');
const TEST_MEMORY_DRAFT_RELATIVE_PATH = '.joyjoin/__tests__/memory-stage-promote-flow.md';
const TEST_MEMORY_CANDIDATE_RELATIVE_PATH = 'repo-memory/candidates/__tests__/memory-stage-promote-flow.md';
const TEST_MEMORY_PROMOTED_RELATIVE_PATH = 'repo-memory/promoted/__tests__/memory-stage-promote-flow.md';
const TEST_MEMORY_DRAFT_PATH = path.join(REPO_ROOT, TEST_MEMORY_DRAFT_RELATIVE_PATH);
const TEST_MEMORY_CANDIDATE_PATH = path.join(REPO_ROOT, TEST_MEMORY_CANDIDATE_RELATIVE_PATH);
const TEST_MEMORY_PROMOTED_PATH = path.join(REPO_ROOT, TEST_MEMORY_PROMOTED_RELATIVE_PATH);
const TEST_MEMORY_NOTE_ID = 'test.orchestration.memory-stage-promote-flow';
const TEST_MEMORY_LIFECYCLE_INDEX_RELATIVE_PATH = 'repo-memory/generated/__tests__/orchestration-lifecycle-index.json';
const TEST_MEMORY_LIFECYCLE_INDEX_PATH = path.join(REPO_ROOT, TEST_MEMORY_LIFECYCLE_INDEX_RELATIVE_PATH);
const TEST_MEMORY_LIFECYCLE_NOTE_ID = 'test.orchestration.lifecycle.stale-conflict';

function clearTestMemoryFlowFiles() {
  rmSync(TEST_MEMORY_DRAFT_PATH, { force: true });
  rmSync(TEST_MEMORY_CANDIDATE_PATH, { force: true });
  rmSync(TEST_MEMORY_PROMOTED_PATH, { force: true });
  rmSync(path.join(REPO_ROOT, '.joyjoin/__tests__'), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, 'repo-memory/candidates/__tests__'), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, 'repo-memory/promoted/__tests__'), { recursive: true, force: true });
}

function clearTestMemoryLifecycleFiles() {
  rmSync(TEST_MEMORY_LIFECYCLE_INDEX_PATH, { force: true });
  rmSync(path.join(REPO_ROOT, 'repo-memory/generated/__tests__'), { recursive: true, force: true });
}

describe('orchestration kickoff lane', () => {
  it('registers Researcher and Planner in both machine-readable registries', () => {
    const manifest = JSON.parse(readRepoFile('.github/agents/manifest.json')) as {
      agents: Array<{ name: string }>;
    };
    const orchestration = JSON.parse(readRepoFile('.github/orchestration.yaml')) as {
      portfolio_scope: { kickoff_agents: string[] };
      agent_bindings: Record<string, { orchestration_status: string }>;
    };

    expect(manifest.agents.some((agent) => agent.name === 'Researcher')).toBe(true);
    expect(manifest.agents.some((agent) => agent.name === 'Planner')).toBe(true);
    expect(orchestration.portfolio_scope.kickoff_agents).toEqual(['Researcher', 'Planner']);
    expect(orchestration.agent_bindings.Researcher.orchestration_status).toBe('kickoff-lane');
    expect(orchestration.agent_bindings.Planner.orchestration_status).toBe('kickoff-lane');
  });

  it('recommends Researcher then Planner for a broad prompt', () => {
    const result = runKickoffHook('Add a new API endpoint for user profile retrieval with caching.');

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Researcher');
    expect(result.systemMessage).toContain('Planner');
    expect(result.systemMessage).toContain('approval-first');
  });

  it('stays quiet for a trivial prompt', () => {
    const result = runKickoffHook('thanks');

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeUndefined();
  });

  it('stays quiet for a long prompt without configured broad-request signals', () => {
    const result = runKickoffHook('Could you please take a careful look at this wording since it feels slightly awkward today');

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeUndefined();
  });
});

describe('orchestration supervisor routing boundaries', () => {
  it('keeps frontend delivery in audited support while making Supervisor rerouting explicit', () => {
    const manifest = JSON.parse(readRepoFile('.github/agents/manifest.json')) as {
      agents: Array<{
        name: string;
        subagents?: string[];
        handoffs?: string[];
        tools?: string[];
        orchestrationPhase?: string;
        toolingStatus?: string;
      }>;
    };
    const orchestration = JSON.parse(readRepoFile('.github/orchestration.yaml')) as {
      portfolio_scope: {
        orchestrated_agents: string[];
        audited_agents: string[];
      };
      handoff_graph: Array<{ from: string; to: string }>;
      agent_bindings: Record<
        string,
        {
          orchestration_status: string;
          current_tools: string[];
          tooling_assessment: {
            status: string;
          };
        }
      >;
    };

    const supervisor = manifest.agents.find((agent) => agent.name === 'Supervisor');
    const expertFrontendEngineer = manifest.agents.find((agent) => agent.name === 'Expert React Frontend Engineer');
    const supervisorSource = readRepoFile('.github/agents/supervisor.agent.md');
    const expertFrontendEngineerSource = readRepoFile('.github/agents/frontend engineer.md');

    expect(orchestration.portfolio_scope.orchestrated_agents).toEqual([
      'Supervisor',
      'Auto-Eval',
      'Product Manager',
      'Backend Engineer',
      'AI Engineer',
      'QA Agent',
      'Launch Readiness Agent',
    ]);
    expect(orchestration.portfolio_scope.audited_agents).toEqual(
      expect.arrayContaining([
        'Mini-Program Parity Auditor',
        'Expert React Frontend Engineer',
        'Taro Mini-Program Frontend Engineer',
        'Taro Migration Specialist',
      ]),
    );
    expect(supervisor?.subagents).toEqual(
      expect.arrayContaining([
        'Researcher',
        'Planner',
        'Mini-Program Parity Auditor',
        'Expert React Frontend Engineer',
        'Taro Mini-Program Frontend Engineer',
        'Taro Migration Specialist',
      ]),
    );
    expect(supervisor?.handoffs).toEqual([
      'Researcher',
      'Planner',
      'Mini-Program Parity Auditor',
      'Expert React Frontend Engineer',
      'Taro Mini-Program Frontend Engineer',
      'Taro Migration Specialist',
    ]);
    expect(supervisorSource).toContain('handoffs:');
    expect(supervisorSource).toContain('agent: "Researcher"');
    expect(supervisorSource).toContain('agent: "Planner"');
    expect(supervisorSource).toContain('agent: "Expert React Frontend Engineer"');
    expect(expertFrontendEngineer?.tools).toEqual(['read', 'search', 'edit', 'execute']);
    expect(expertFrontendEngineer?.orchestrationPhase).toBe('support-audited');
    expect(expertFrontendEngineer?.toolingStatus).toBe('sufficient');
    expect(expertFrontendEngineerSource).toContain('tools: [read, search, edit, execute]');
    expect(orchestration.agent_bindings['Expert React Frontend Engineer']).toMatchObject({
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'edit', 'execute'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
    expect(orchestration.handoff_graph).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'Supervisor', to: 'Researcher' }),
        expect.objectContaining({ from: 'Supervisor', to: 'Planner' }),
        expect.objectContaining({ from: 'Supervisor', to: 'Mini-Program Parity Auditor' }),
        expect.objectContaining({ from: 'Supervisor', to: 'Expert React Frontend Engineer' }),
        expect.objectContaining({ from: 'Supervisor', to: 'Taro Mini-Program Frontend Engineer' }),
        expect.objectContaining({ from: 'Supervisor', to: 'Taro Migration Specialist' }),
      ]),
    );
  });

  it('normalizes debug and principal support agents to the current tool taxonomy', () => {
    const manifest = JSON.parse(readRepoFile('.github/agents/manifest.json')) as {
      agents: Array<{
        name: string;
        tools?: string[];
        orchestrationPhase?: string;
        toolingStatus?: string;
      }>;
    };
    const orchestration = JSON.parse(readRepoFile('.github/orchestration.yaml')) as {
      agent_bindings: Record<
        string,
        {
          orchestration_status: string;
          current_tools: string[];
          tooling_assessment: {
            status: string;
          };
        }
      >;
    };

    const debugAgent = manifest.agents.find((agent) => agent.name === 'debug');
    const principalAgent = manifest.agents.find((agent) => agent.name === 'principal SWE');
    const debugSource = readRepoFile('.github/agents/debug.agent.md');
    const principalSource = readRepoFile('.github/agents/principal SWE.md');

    expect(debugAgent).toMatchObject({
      tools: ['read', 'search', 'edit', 'execute'],
      orchestrationPhase: 'support-audited',
      toolingStatus: 'sufficient',
    });
    expect(principalAgent).toMatchObject({
      tools: ['read', 'search', 'execute'],
      orchestrationPhase: 'support-audited',
      toolingStatus: 'sufficient',
    });
    expect(debugSource).toContain('tools: [read, search, edit, execute]');
    expect(principalSource).toContain('tools: [read, search, execute]');
    expect(principalSource).not.toContain('create_issue');
    expect(orchestration.agent_bindings.debug).toMatchObject({
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'edit', 'execute'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
    expect(orchestration.agent_bindings['principal SWE']).toMatchObject({
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'execute'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
  });

  it('re-scopes backlog and prompt support agents to truthful normalized tool surfaces', () => {
    const manifest = JSON.parse(readRepoFile('.github/agents/manifest.json')) as {
      agents: Array<{
        name: string;
        tools?: string[];
        orchestrationPhase?: string;
        toolingStatus?: string;
        portfolioRole?: string;
      }>;
    };
    const orchestration = JSON.parse(readRepoFile('.github/orchestration.yaml')) as {
      agent_bindings: Record<
        string,
        {
          portfolio_role: string;
          orchestration_status: string;
          current_tools: string[];
          tooling_assessment: {
            status: string;
          };
        }
      >;
    };

    const productAdvisor = manifest.agents.find((agent) => agent.name === 'SE: Product Manager');
    const promptEngineer = manifest.agents.find((agent) => agent.name === 'prompt engineer');
    const productAdvisorSource = readRepoFile('.github/agents/PM advisor.md');
    const promptEngineerSource = readRepoFile('.github/agents/prompt engineer.md');

    expect(productAdvisor).toMatchObject({
      tools: ['read', 'search', 'edit'],
      orchestrationPhase: 'support-audited',
      toolingStatus: 'sufficient',
      portfolioRole: 'issue-scoping',
    });
    expect(promptEngineer).toMatchObject({
      tools: ['read', 'search', 'edit'],
      orchestrationPhase: 'support-audited',
      toolingStatus: 'sufficient',
    });
    expect(productAdvisorSource).toContain("tools: [read, search, edit]");
    expect(productAdvisorSource).not.toContain('create_issue');
    expect(promptEngineerSource).toContain('tools: [read, search, edit]');
    expect(orchestration.agent_bindings['SE: Product Manager']).toMatchObject({
      portfolio_role: 'issue-scoping',
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'edit'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
    expect(orchestration.agent_bindings['prompt engineer']).toMatchObject({
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'edit'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
  });

  it('registers SelfIteration as a proposal-only audited support agent', () => {
    const manifest = JSON.parse(readRepoFile('.github/agents/manifest.json')) as {
      agents: Array<{
        name: string;
        file?: string;
        tools?: string[];
        orchestrationPhase?: string;
        toolingStatus?: string;
        portfolioRole?: string;
        skills?: string[];
      }>;
    };
    const orchestration = JSON.parse(readRepoFile('.github/orchestration.yaml')) as {
      portfolio_scope: {
        orchestrated_agents: string[];
        audited_agents: string[];
      };
      agent_bindings: Record<
        string,
        {
          file: string;
          portfolio_role: string;
          orchestration_status: string;
          current_tools: string[];
          tooling_assessment: {
            status: string;
          };
        }
      >;
      skill_bindings: Record<string, string[]>;
    };

    const selfIteration = manifest.agents.find((agent) => agent.name === 'SelfIteration');
    const selfIterationSource = readRepoFile('.github/agents/self-iteration.agent.md');
    const selfIterationDoc = readRepoFile('docs/agents/SelfIteration.md');

    expect(selfIteration).toMatchObject({
      file: 'self-iteration.agent.md',
      tools: ['read', 'search', 'edit', 'execute'],
      orchestrationPhase: 'support-audited',
      toolingStatus: 'sufficient',
      portfolioRole: 'meta-governance',
      skills: ['docs-sync', 'testing-and-regression-guardrails'],
    });
    expect(orchestration.portfolio_scope.orchestrated_agents).not.toContain('SelfIteration');
    expect(orchestration.portfolio_scope.audited_agents).toContain('SelfIteration');
    expect(orchestration.agent_bindings.SelfIteration).toMatchObject({
      file: '.github/agents/self-iteration.agent.md',
      portfolio_role: 'meta-governance',
      orchestration_status: 'audited-support',
      current_tools: ['read', 'search', 'edit', 'execute'],
      tooling_assessment: {
        status: 'sufficient',
      },
    });
    expect(orchestration.skill_bindings.SelfIteration).toEqual(['docs-sync', 'testing-and-regression-guardrails']);
    expect(selfIterationSource).toContain('proposal-only');
    expect(selfIterationSource).toContain('DO NOT publish durable memory');
    expect(selfIterationSource).toContain('DO NOT change your own approval boundaries');
    expect(selfIterationDoc).toContain('audited support lane');
    expect(selfIterationDoc).toContain('proposal-only');
  });
});

describe('orchestration changed-file detection', () => {
  it('returns no changed files for a clean local repo without a base ref', () => {
    const tempRepoRoot = mkdtempSync(path.join(tmpdir(), 'joyjoin-orchestration-'));
    const originalBaseRef = process.env.GITHUB_BASE_REF;

    try {
      runGitCommand(tempRepoRoot, ['init']);
      runGitCommand(tempRepoRoot, ['config', 'user.name', 'JoyJoin Test']);
      runGitCommand(tempRepoRoot, ['config', 'user.email', 'joyjoin-test@example.com']);

      writeRepoFile(tempRepoRoot, 'README.md', 'initial\n');
      runGitCommand(tempRepoRoot, ['add', 'README.md']);
      runGitCommand(tempRepoRoot, ['commit', '-m', 'initial']);

      writeRepoFile(tempRepoRoot, 'README.md', 'second\n');
      runGitCommand(tempRepoRoot, ['add', 'README.md']);
      runGitCommand(tempRepoRoot, ['commit', '-m', 'second']);

      delete process.env.GITHUB_BASE_REF;

      expect(collectChangedFiles(tempRepoRoot)).toEqual([]);
    } finally {
      if (originalBaseRef === undefined) {
        delete process.env.GITHUB_BASE_REF;
      } else {
        process.env.GITHUB_BASE_REF = originalBaseRef;
      }

      rmSync(tempRepoRoot, { recursive: true, force: true });
    }
  });
});

describe.sequential('repo memory lifecycle advisories', () => {
  beforeAll(() => {
    clearTestMemoryLifecycleFiles();
  });

  afterEach(() => {
    clearTestMemoryLifecycleFiles();
  });

  afterAll(() => {
    clearTestMemoryLifecycleFiles();
  });

  it('adds stale and conflict lifecycle signals to runtime memoryContext hits and summaries', () => {
    writeRepoFile(
      REPO_ROOT,
      TEST_MEMORY_LIFECYCLE_INDEX_RELATIVE_PATH,
      `${JSON.stringify({
        schemaVersion: 1,
        generatedFrom: {
          promotedRoot: 'repo-memory/promoted',
          includedStatuses: ['active'],
        },
        noteCount: 1,
        notes: [
          {
            id: TEST_MEMORY_LIFECYCLE_NOTE_ID,
            title: 'Stale Conflict Memory Note',
            status: 'active',
            owner: 'workflow-platform',
            lastValidatedAt: '2025-12-01',
            tags: ['orchestration', 'memory'],
            triggerTerms: ['stale conflict memory note'],
            relatedPaths: ['scripts/orchestration-supervisor.mjs'],
            sources: ['scripts/orchestration-supervisor.mjs'],
            confidence: 'high',
            path: 'repo-memory/promoted/__tests__/stale-conflict-memory-note.md',
            statements: ['Lifecycle warnings should stay advisory and explicit.'],
          },
        ],
      }, null, 2)}\n`,
    );

    const memoryContext = buildMemoryContext({
      changedFiles: ['scripts/orchestration-supervisor.mjs', 'README.md'],
      memoryConfig: {
        artifactPath: TEST_MEMORY_LIFECYCLE_INDEX_RELATIVE_PATH,
        workflowRelevantPathPrefixes: ['.github/', 'scripts/', 'repo-memory/'],
        promptQueryRules: DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES,
        maxHits: 3,
        minChangedFileScore: 1,
        minPromptScore: 1,
        maxValidationAgeDays: 90,
        surfaceSourcePathConflicts: true,
      },
      previousMemoryContext: null,
      promptText: 'Please review the stale conflict memory note for the orchestration supervisor runtime context.',
      evaluatedAt: '2026-04-14',
    });

    expect(memoryContext.changedFiles?.consideredPaths).toEqual(['scripts/orchestration-supervisor.mjs']);
    expect(memoryContext.lifecycle).toMatchObject({
      evaluatedAt: '2026-04-14',
      maxValidationAgeDays: 90,
      sourcePathConflictsEnabled: true,
      status: 'caution',
      totalHits: 1,
      cautionHitCount: 1,
      staleHitCount: 1,
      conflictHitCount: 1,
      warningHitIds: [TEST_MEMORY_LIFECYCLE_NOTE_ID],
    });
    expect(memoryContext.changedFiles?.hits?.[0]).toMatchObject({
      id: TEST_MEMORY_LIFECYCLE_NOTE_ID,
      lastValidatedAt: '2025-12-01',
      relatedPaths: ['scripts/orchestration-supervisor.mjs'],
      sources: ['scripts/orchestration-supervisor.mjs'],
      lifecycle: {
        status: 'stale-conflicted',
        caution: true,
        stale: true,
        validationAgeDays: 134,
        maxValidationAgeDays: 90,
        conflict: true,
        conflictingPaths: ['scripts/orchestration-supervisor.mjs'],
        matchedAuthorityPaths: ['scripts/orchestration-supervisor.mjs'],
      },
    });
    expect(memoryContext.prompt?.hits?.[0]?.lifecycle?.status).toBe('stale-conflicted');
    expect(memoryContext.changedFiles?.hits?.[0]?.lifecycle?.warnings?.some((warning) => warning.includes('validation age'))).toBe(true);
    expect(memoryContext.summary).toContain('with caution');
    expect(memoryContext.summary).toContain('stale');
    expect(memoryContext.summary).toContain('changed-path conflict');
  });
});

describe.sequential('orchestration runtime context persistence', () => {
  const runtimeBackups = {
    context: backupFile(ORCHESTRATION_CONTEXT_PATH),
    eventLog: backupFile(ORCHESTRATION_EVENT_LOG_PATH),
    runtimeDirExisted: existsSync(ORCHESTRATION_RUNTIME_DIR),
  };

  beforeAll(() => {
    clearTestRuntimeFiles();
  });

  afterEach(() => {
    clearTestRuntimeFiles();
  });

  afterAll(() => {
    restoreFile(ORCHESTRATION_CONTEXT_PATH, runtimeBackups.context);
    restoreFile(ORCHESTRATION_EVENT_LOG_PATH, runtimeBackups.eventLog);

    if (!runtimeBackups.runtimeDirExisted) {
      removeRuntimeDirIfEmpty();
    }
  });

  it('writes default kickoff state on session-start', () => {
    const result = runCopilotHook('session-start', {}, true);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Researcher -> Planner');
    expect(existsSync(ORCHESTRATION_CONTEXT_PATH)).toBe(true);
    expect(existsSync(ORCHESTRATION_EVENT_LOG_PATH)).toBe(true);

    const runtimeContext = readRuntimeContext();
    expect(runtimeContext.artifactPaths).toEqual(
      expect.arrayContaining([
        '.git/.orchestration/context.json',
        '.git/.orchestration/events.jsonl',
        'repo-memory/generated/promoted-index.json',
      ]),
    );
    expect(runtimeContext.sessionId).toEqual(expect.any(String));
    expect(runtimeContext.recommendedNextAgents).toEqual(['Researcher', 'Planner']);
    expect(runtimeContext.turnSummaryState).toMatchObject({
      focusWindowTurns: 5,
      lastTurnSequence: 0,
      recentAgentSummaries: {},
      recentSupervisorReports: [],
    });
    expect(runtimeContext.kickoff).toMatchObject({
      status: 'idle',
      approvalMode: 'plan-first',
      recommendedAgents: ['Researcher', 'Planner'],
      recommendationIssued: false,
      evaluationCount: 0,
      lastPrompt: null,
      lastReason: null,
    });
    expect(runtimeContext.memoryContext).toMatchObject({
      status: 'advisory',
      generatedIndex: {
        path: 'repo-memory/generated/promoted-index.json',
        available: true,
        noteCount: expect.any(Number),
        error: null,
      },
      prompt: {
        query: null,
        meaningful: false,
      },
    });
    expect(Array.isArray(runtimeContext.memoryContext?.changedFiles?.consideredPaths)).toBe(true);
    expect(Array.isArray(runtimeContext.memoryContext?.changedFiles?.hits)).toBe(true);

    const runtimeEvents = readRuntimeEventLog();
    expect(runtimeEvents).toHaveLength(1);
    expect(runtimeEvents[0]).toMatchObject({
      event: 'session-start',
      kickoffStatus: 'idle',
      memory: {
        generatedIndexAvailable: true,
        promptHitCount: 0,
        promptQueryMeaningful: false,
      },
    });
  });

  it('accepts --json and --file payload sources for record-summary', () => {
    runCopilotHook('session-start', {}, true);

    const agentSummary = runRecordSummaryWithJsonArg(
      {
        type: 'agent_turn_summary',
        agentName: 'Researcher',
        parentAgent: 'Supervisor',
        done: ['Recorded an agent summary through --json'],
        filesChanged: ['scripts/orchestration-supervisor.mjs'],
        decisions: ['Prefer direct recorder flags over shell heredoc input for summary payloads'],
        blockers: [],
        learned: ['The record-summary command now supports a direct JSON argument'],
        nextTurnImprovements: ['Keep a focused regression test on the non-stdin recorder path'],
        appliedFeedbackFrom: [],
        nextSteps: {
          bugFix: [],
          enhancement: [],
          validation: ['Exercise the file-based recorder path in the same test'],
        },
        confidence: {
          score: 0.88,
          reason: 'The recorder accepted a JSON argument without reading stdin',
        },
        unresolvedAssumptions: [],
      },
      true,
    );

    expect(agentSummary.ok).toBe(true);
    expect(agentSummary.type).toBe('agent_turn_summary');

    const tempSummaryDir = mkdtempSync(path.join(tmpdir(), 'joyjoin-turn-summary-'));

    try {
      const summaryFilePath = path.join(tempSummaryDir, 'supervisor-summary.json');
      writeFileSync(
        summaryFilePath,
        JSON.stringify({
          turnSummary: {
            type: 'supervisor_turn_report',
            agentName: 'Supervisor',
            done: ['Recorded a supervisor report from a JSON file'],
            filesChanged: ['scripts/orchestration-supervisor.mjs'],
            decisions: ['Prefer direct recorder flags over shell heredocs'],
            blockers: [],
            keyBullets: ['Recorder accepted a --file payload'],
            crossAgentInsights: ['Direct CLI payload sources are less brittle than shell redirection'],
            sourceSummaryIds: [agentSummary.summaryId],
            feedbackByAgent: {
              Researcher: ['No additional research was required for the CLI fix'],
            },
            nextSteps: {
              bugFix: [],
              enhancement: [],
              validation: ['Keep non-stdin record-summary coverage in place'],
            },
            confidence: {
              score: 0.9,
              reason: 'The recorder accepted a file-based payload without stdin',
            },
            unresolvedAssumptions: [],
          },
        }),
        'utf8',
      );

      const supervisorReport = runRecordSummaryWithFileArg(summaryFilePath, true);

      expect(supervisorReport.ok).toBe(true);
      expect(supervisorReport.type).toBe('supervisor_turn_report');
      expect(supervisorReport.turnSequence).toBe(1);
    } finally {
      rmSync(tempSummaryDir, { recursive: true, force: true });
    }

    const runtimeContext = readRuntimeContext();
    expect(runtimeContext.turnSummaryState?.recentAgentSummaries?.Researcher).toHaveLength(1);
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports).toHaveLength(1);
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports?.[0]).toMatchObject({
      sourceSummaryIds: [agentSummary.summaryId],
      feedbackByAgent: {
        Researcher: ['No additional research was required for the CLI fix'],
      },
    });
  });

  it('records agent summaries and supervisor reports with bounded recent state', () => {
    runCopilotHook('session-start', {}, true);

    const agentSummary = runRecordSummary(
      {
        type: 'agent_turn_summary',
        agentName: 'Researcher',
        parentAgent: 'Supervisor',
        done: ['Gathered repo orchestration context'],
        filesChanged: ['scripts/orchestration-supervisor.mjs'],
        decisions: ['Use an explicit summary recorder instead of hook inference'],
        blockers: [],
        learned: ['PostToolUse is not a truthful turn boundary source'],
        nextTurnImprovements: ['Re-verify machine-readable orchestration files'],
        appliedFeedbackFrom: [],
        nextSteps: {
          bugFix: [],
          enhancement: ['Persist supervisor consolidation summaries'],
          validation: ['Add regression coverage for recorder state'],
        },
        confidence: {
          score: 0.82,
          reason: 'Runtime helper behavior was verified before implementation',
        },
        unresolvedAssumptions: [],
      },
      true,
    );

    expect(agentSummary.ok).toBe(true);
    expect(agentSummary.persisted).toBe(true);

    let runtimeContext = readRuntimeContext();
    expect(runtimeContext.sessionId).toBe(agentSummary.sessionId);
    expect(runtimeContext.turnSummaryState).toMatchObject({
      focusWindowTurns: 5,
      lastTurnSequence: 0,
    });
    expect(runtimeContext.turnSummaryState?.recentAgentSummaries?.Researcher).toHaveLength(1);
    expect(runtimeContext.turnSummaryState?.recentAgentSummaries?.Researcher?.[0]).toMatchObject({
      summaryId: agentSummary.summaryId,
      agentName: 'Researcher',
      parentAgent: 'Supervisor',
      done: ['Gathered repo orchestration context'],
      learned: ['PostToolUse is not a truthful turn boundary source'],
      nextTurnImprovements: ['Re-verify machine-readable orchestration files'],
      confidenceScore: 0.82,
    });

    for (let turnNumber = 1; turnNumber <= 6; turnNumber += 1) {
      const supervisorReport = runRecordSummary(
        {
          type: 'supervisor_turn_report',
          agentName: 'Supervisor',
          done: [
            'Consolidated turn ' + String(turnNumber),
          ],
          filesChanged: [
            'scripts/orchestration-supervisor.mjs',
            'apps/server/src/__tests__/orchestrationKickoff.test.ts',
          ],
          decisions: ['Keep recent turn history bounded to five turns'],
          blockers: [],
          keyBullets: ['Turn ' + String(turnNumber) + ' consolidation complete'],
          crossAgentInsights: ['Research context carried into turn ' + String(turnNumber)],
          sourceSummaryIds: [agentSummary.summaryId],
          feedbackByAgent: {
            Researcher: ['Feedback ' + String(turnNumber)],
          },
          nextSteps: {
            bugFix: [],
            enhancement: ['Enhancement ' + String(turnNumber)],
            validation: ['Validation ' + String(turnNumber)],
          },
          confidence: {
            score: 0.75,
            reason: 'Recorded through the runtime summary command',
          },
          unresolvedAssumptions: [],
        },
        true,
      );

      expect(supervisorReport.type).toBe('supervisor_turn_report');
      expect(supervisorReport.turnSequence).toBe(turnNumber);
      expect(supervisorReport.turnId).toContain(':turn:');
    }

    runtimeContext = readRuntimeContext();
    expect(runtimeContext.turnSummaryState).toMatchObject({
      focusWindowTurns: 5,
      lastTurnSequence: 6,
    });
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports).toHaveLength(5);
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports?.map((report) => report.turnSequence)).toEqual([2, 3, 4, 5, 6]);
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports?.[0]).toMatchObject({
      turnSequence: 2,
      sourceSummaryIds: [agentSummary.summaryId],
      feedbackByAgent: {
        Researcher: ['Feedback 2'],
      },
    });
    expect(runtimeContext.turnSummaryState?.recentSupervisorReports?.[4]).toMatchObject({
      turnSequence: 6,
      sourceSummaryIds: [agentSummary.summaryId],
    });

    const runtimeEvents = readRuntimeEventLog();
    expect(runtimeEvents.filter((entry) => entry.event === 'agent-turn-summary')).toHaveLength(1);
    expect(runtimeEvents.filter((entry) => entry.event === 'supervisor-turn-report')).toHaveLength(6);
    expect(runtimeEvents[runtimeEvents.length - 1]).toMatchObject({
      event: 'supervisor-turn-report',
      agentName: 'Supervisor',
      turnSequence: 6,
    });
    expect(runtimeEvents[runtimeEvents.length - 1]?.summary).toMatchObject({
      type: 'supervisor_turn_report',
      sourceSummaryIds: [agentSummary.summaryId],
      feedbackByAgent: {
        Researcher: ['Feedback 6'],
      },
    });
  });

  it('surfaces prompt-based repo memory hits in the hook message and runtime context', () => {
    runCopilotHook('session-start', {}, true);

    const prompt = 'Please explain separate durable memory from operational state for the orchestration runtime context.';
    const result = runCopilotHook('user-prompt-submit', { prompt }, true);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Relevant repo memory');
    expect(result.systemMessage).toContain('Separate Durable Memory From Operational State');
    expect(result.systemMessage).not.toContain('Start with Researcher');

    const runtimeContext = readRuntimeContext();
    expect(runtimeContext.memoryContext).toMatchObject({
      status: 'advisory',
      prompt: {
        query: prompt,
        meaningful: true,
      },
    });
    expect(
      runtimeContext.memoryContext?.prompt?.hits?.some(
        (hit) => hit.id === 'repo.orchestration.separate-durable-memory-from-operational-state',
      ),
    ).toBe(true);

    const runtimeEvents = readRuntimeEventLog();
    expect(runtimeEvents).toHaveLength(2);
    expect(runtimeEvents[1].event).toBe('user-prompt-submit');
    expect(runtimeEvents[1].memory?.generatedIndexAvailable).toBe(true);
    expect(runtimeEvents[1].memory?.promptQueryMeaningful).toBe(true);
    expect((runtimeEvents[1].memory?.promptHitCount ?? 0)).toBeGreaterThan(0);
  });

  it('persists broad kickoff advice and clears it after a narrow follow-up', () => {
    runCopilotHook('session-start', {}, true);

    const broadPromptResult = runCopilotHook(
      'user-prompt-submit',
      { prompt: 'Add a new API endpoint for user profile retrieval with caching.' },
      true,
    );

    expect(broadPromptResult.continue).toBe(true);
    expect(broadPromptResult.systemMessage).toContain('Researcher');
    expect(broadPromptResult.systemMessage).toContain('Planner');

    let runtimeContext = readRuntimeContext();
    expect(runtimeContext.recommendedNextAgents).toEqual(['Researcher', 'Planner']);
    expect(runtimeContext.kickoff).toMatchObject({
      status: 'recommended',
      recommendationIssued: true,
      evaluationCount: 1,
      lastPrompt: 'Add a new API endpoint for user profile retrieval with caching.',
      lastReason: 'broad-request',
    });

    const narrowPromptResult = runCopilotHook('user-prompt-submit', { prompt: 'fix typo' }, true);

    expect(narrowPromptResult.continue).toBe(true);
    expect(narrowPromptResult.systemMessage).toBeUndefined();

    runtimeContext = readRuntimeContext();
    expect(runtimeContext.recommendedNextAgents).toEqual([]);
    expect(runtimeContext.kickoff).toMatchObject({
      status: 'idle',
      recommendationIssued: false,
      evaluationCount: 2,
      lastPrompt: 'fix typo',
      lastReason: 'narrow-cleared-recommendation',
    });

    const runtimeEvents = readRuntimeEventLog();
    expect(runtimeEvents).toHaveLength(3);
    expect(runtimeEvents[1]).toMatchObject({
      event: 'user-prompt-submit',
      kickoffRecommended: true,
      kickoffCleared: false,
      promptSummary: 'Add a new API endpoint for user profile retrieval with caching.',
      memory: {
        generatedIndexAvailable: true,
      },
    });
    expect(runtimeEvents[2]).toMatchObject({
      event: 'user-prompt-submit',
      kickoffRecommended: false,
      kickoffCleared: true,
      promptSummary: 'fix typo',
      memory: {
        generatedIndexAvailable: true,
      },
    });
  });
});

describe.sequential('repo memory candidate publication flow', () => {
  const indexBackup = backupFile(REPO_MEMORY_INDEX_PATH);

  beforeAll(() => {
    clearTestMemoryFlowFiles();
  });

  afterEach(() => {
    clearTestMemoryFlowFiles();
    restoreFile(REPO_MEMORY_INDEX_PATH, indexBackup);
  });

  afterAll(() => {
    clearTestMemoryFlowFiles();
    restoreFile(REPO_MEMORY_INDEX_PATH, indexBackup);
  });

  it('stages a reviewed draft and promotes the candidate through the real repo-memory layout', () => {
    writeRepoFile(
      REPO_ROOT,
      TEST_MEMORY_DRAFT_RELATIVE_PATH,
      [
        '---',
        `id: ${TEST_MEMORY_NOTE_ID}`,
        'title: Memory Stage Promote Flow Test',
        'status: candidate',
        'owner: workflow-platform',
        'lastValidatedAt: 2026-04-14',
        'tags:',
        '  - orchestration',
        '  - tests',
        'triggerTerms:',
        '  - candidate promote flow test',
        '  - stage candidate promote memory',
        'relatedPaths:',
        '  - .github/ORCHESTRATION.md',
        '  - scripts/orchestration-supervisor.mjs',
        'sources:',
        '  - .github/ORCHESTRATION.md',
        '  - scripts/orchestration-supervisor.mjs',
        'confidence: medium',
        '---',
        '',
        '- Test-only candidate note used to verify deterministic candidate staging and promotion.',
        '',
      ].join('\n'),
    );

    const directPromoteResult = runNodeScript(
      ['scripts/memory-promote.mjs', TEST_MEMORY_DRAFT_RELATIVE_PATH],
      { expectStatus: 1 },
    );
    expect(directPromoteResult.stderr).toContain('candidate note under repo-memory/candidates');

    runNodeScript([
      'scripts/memory-stage-candidate.mjs',
      TEST_MEMORY_DRAFT_RELATIVE_PATH,
      TEST_MEMORY_CANDIDATE_RELATIVE_PATH,
    ]);

    expect(existsSync(TEST_MEMORY_CANDIDATE_PATH)).toBe(true);
    expect(readFileSync(TEST_MEMORY_CANDIDATE_PATH, 'utf8')).toContain('status: candidate');

    runNodeScript(['scripts/memory-promote.mjs', TEST_MEMORY_CANDIDATE_RELATIVE_PATH]);

    expect(existsSync(TEST_MEMORY_CANDIDATE_PATH)).toBe(false);
    expect(existsSync(TEST_MEMORY_PROMOTED_PATH)).toBe(true);
    expect(readFileSync(TEST_MEMORY_PROMOTED_PATH, 'utf8')).toContain('status: active');

    const rebuiltIndex = JSON.parse(readFileSync(REPO_MEMORY_INDEX_PATH, 'utf8')) as {
      notes: Array<{ id: string }>;
    };
    expect(rebuiltIndex.notes.some((note) => note.id === TEST_MEMORY_NOTE_ID)).toBe(true);
  });
});