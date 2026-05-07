import fs from 'node:fs';

/**
 * Paths `git ls-files` may still list after a delete before `git add` / commit.
 * Guardrails must not `readFileSync` those — ENOENT breaks CI and auto-eval.
 */
export function listGuardrailsAppSourcePaths(trackedFiles, existsSync = fs.existsSync) {
  return trackedFiles.filter(
    (f) =>
      (f.startsWith('apps/admin-client/src/') ||
        f.startsWith('apps/server/src/')) &&
      (f.endsWith('.ts') || f.endsWith('.tsx')) &&
      existsSync(f),
  );
}
