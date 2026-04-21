import test from 'node:test';
import assert from 'node:assert/strict';
import { listGuardrailsAppSourcePaths } from './guardrails-app-sources.mjs';

test('listGuardrailsAppSourcePaths skips paths missing from worktree', () => {
  const tracked = [
    'apps/user-client/src/DeletedButStillIndexed.tsx',
    'apps/server/src/Present.ts',
    'packages/shared/src/not-scanned.ts',
  ];
  const existsSync = (p) => p === 'apps/server/src/Present.ts';
  assert.deepEqual(listGuardrailsAppSourcePaths(tracked, existsSync), ['apps/server/src/Present.ts']);
});

test('listGuardrailsAppSourcePaths only includes app src ts/tsx', () => {
  const existsSync = () => true;
  assert.deepEqual(
    listGuardrailsAppSourcePaths(['apps/user-client/src/a.tsx', 'apps/user-client/readme.md'], existsSync),
    ['apps/user-client/src/a.tsx'],
  );
});
