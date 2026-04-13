import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('repo cleanup config follow-ups', () => {
  it('keeps branch cleanup workflow destructive runs explicitly gated', () => {
    const workflow = readRepoFile('.github/workflows/delete-merged-branches.yml');

    expect(workflow).toContain('pull-requests: read');
    expect(workflow).toContain('LIVE_CONFIRMATION_PHRASE: "DELETE_BRANCHES"');
    expect(workflow).toContain('delete_prefix:');
    expect(workflow).toContain('default: "copilot/"');
    expect(workflow).toContain("if: ${{ !inputs.dry_run && inputs.confirm == 'DELETE_BRANCHES' }}");
  });

  it('skips protected branches in merged-pr cleanup before deleting refs', () => {
    const workflow = readRepoFile('.github/workflows/delete-merged-branches.yml');

    expect(workflow).toContain('const branchInfo = await github.rest.repos.getBranch({');
    expect(workflow).toContain('if (branchInfo.data.protected) {');
    expect(workflow).toContain('Skipping protected branch: ${branch}');
  });

  it('keeps bulk branch cleanup scoped to explicit live-delete candidates', () => {
    const workflow = readRepoFile('.github/workflows/delete-merged-branches.yml');

    expect(workflow).toContain('const staleBranches = allBranches.filter(');
    expect(workflow).toContain('const liveDeleteCandidates = staleBranches.filter(');
    expect(workflow).toContain('const manualReviewBranches = staleBranches.filter(');
    expect(workflow).toContain('branch.name.startsWith(deletePrefix)');
    expect(workflow).toContain('!branch.name.startsWith(deletePrefix)');
    expect(workflow).toContain('async function deleteBranchWithRetry(branchName)');
    expect(workflow).toContain('await sleep(250);');
  });

  it('keeps root workspace verification scripts normalized', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));

    expect(pkg.scripts.check).toBe('npm run typecheck');
    expect(pkg.scripts['check:clients']).toBe('npm run typecheck -w @joyjoin/shared && npm run typecheck -w @joyjoin/user-client && npm run typecheck -w @joyjoin/admin-client && npm run typecheck:config -w mini-program');
    expect(pkg.scripts['check:server']).toBe('npm run typecheck -w @joyjoin/server');
    expect(pkg.scripts['check:full']).toBe('npm run guardrails && npm run lint && npm run test && npm run build');
    expect(pkg.scripts['set-admin']).toBe('npm run admin:create');
  });

  it('documents the active onboarding module instead of the pre-consolidation layout', () => {
    const onboardingReadme = readRepoFile('apps/user-client/src/features/onboarding/README.md');

    expect(onboardingReadme).toContain('apps/user-client/src/features/onboarding/active/');
    expect(onboardingReadme).toContain('pages/WeChatAuthGatePage.tsx');
    expect(onboardingReadme).not.toContain('has not yet been reorganized into a full `features/onboarding` implementation');
  });

  it('documents server routes and repositories as the active modular boundaries', () => {
    const serverReadme = readRepoFile('apps/server/src/README.md');
    const architectureMap = readRepoFile('docs/architecture/current-state.md');

    expect(serverReadme).toContain('apps/server/src/routes/domains/');
    expect(serverReadme).toContain('apps/server/src/repositories/');
    expect(architectureMap).toContain('apps/server/src/routes/domains/auth.ts');
    expect(architectureMap).toContain('apps/user-client/src/features/onboarding/active/');
  });
});
