import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function runKickoffHook(prompt: string) {
  const result = spawnSync('node', ['scripts/orchestration-supervisor.mjs', 'copilot-hook', 'user-prompt-submit'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ prompt }),
    env: {
      ...process.env,
      ORCHESTRATION_DISABLE_RUNTIME_WRITES: '1',
    },
  });

  expect(result.status).toBe(0);

  return JSON.parse(result.stdout) as {
    continue: boolean;
    systemMessage?: string;
  };
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
});