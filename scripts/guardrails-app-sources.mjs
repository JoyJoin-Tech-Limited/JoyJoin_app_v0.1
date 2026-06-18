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

export function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  // Purely numeric values in example env files are treated as placeholders
  // (e.g. ADMIN_CREATE_SECRET_KEY=123456). Real secrets are not numeric-only.
  if (/^\d+$/.test(normalized)) return true;
  return [
    'example',
    'placeholder',
    'replace',
    'change-me',
    'changeme',
    'your_',
    '<',
    '${{',
    '$',
    'localhost',
    '127.0.0.1',
  ].some((token) => normalized.includes(token));
}
