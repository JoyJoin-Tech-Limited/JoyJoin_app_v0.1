import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectChangedFiles } from "../../../../scripts/orchestration-lib.mjs";

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
}

interface RuntimeContext {
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
}

function backupRuntimeFile(filePath: string): RuntimeFileBackup {
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

function restoreRuntimeFile(filePath: string, backup: RuntimeFileBackup) {
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
    context: backupRuntimeFile(ORCHESTRATION_CONTEXT_PATH),
    eventLog: backupRuntimeFile(ORCHESTRATION_EVENT_LOG_PATH),
    runtimeDirExisted: existsSync(ORCHESTRATION_RUNTIME_DIR),
  };

  beforeAll(() => {
    clearTestRuntimeFiles();
  });

  afterEach(() => {
    clearTestRuntimeFiles();
  });

  afterAll(() => {
    restoreRuntimeFile(ORCHESTRATION_CONTEXT_PATH, runtimeBackups.context);
    restoreRuntimeFile(ORCHESTRATION_EVENT_LOG_PATH, runtimeBackups.eventLog);

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

    const runtimeEvents = readRuntimeEventLog();
    expect(runtimeEvents).toHaveLength(1);
    expect(runtimeEvents[0]).toMatchObject({
      event: 'session-start',
      kickoffStatus: 'idle',
    });
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
    });
    expect(runtimeEvents[2]).toMatchObject({
      event: 'user-prompt-submit',
      kickoffRecommended: false,
      kickoffCleared: true,
      promptSummary: 'fix typo',
    });
  });
});