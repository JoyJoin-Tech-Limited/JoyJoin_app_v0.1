import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CollectChangedFiles = (repoRoot: string) => string[];

const orchestrationLibPath = new URL("../../../../scripts/orchestration-lib.mjs", import.meta.url).href;
const { collectChangedFiles } = await import(orchestrationLibPath) as {
  collectChangedFiles: CollectChangedFiles;
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

interface RuntimeEventEntry {
  event?: string;
  kickoffStatus?: string | null;
  kickoffRecommended?: boolean;
  kickoffCleared?: boolean;
  promptSummary?: string | null;
  memory?: {
    generatedIndexAvailable?: boolean;
    changedFileHitCount?: number;
    promptHitCount?: number;
    promptQueryMeaningful?: boolean;
  };
}

interface RuntimeMemoryHit {
  id: string;
  title: string;
  path: string;
  score: number | null;
  reasons: string[];
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
  summary?: string | null;
}

interface RuntimeContext {
  artifactPaths?: string[];
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
  memoryContext?: RuntimeMemoryContext;
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

function clearTestMemoryFlowFiles() {
  rmSync(TEST_MEMORY_DRAFT_PATH, { force: true });
  rmSync(TEST_MEMORY_CANDIDATE_PATH, { force: true });
  rmSync(TEST_MEMORY_PROMOTED_PATH, { force: true });
  rmSync(path.join(REPO_ROOT, '.joyjoin/__tests__'), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, 'repo-memory/candidates/__tests__'), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, 'repo-memory/promoted/__tests__'), { recursive: true, force: true });
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
    expect(runtimeContext.recommendedNextAgents).toEqual(['Researcher', 'Planner']);
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