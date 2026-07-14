#!/usr/bin/env node
/**
 * Deprecated shim — the design audit scanner now lives at
 * `scripts/devtools/design-audit.mjs` (wired to `npm run design:audit`).
 *
 * The canonical scanner was moved on 2026-06-17 and gained the `min-height: 100vh`
 * false-positive fix plus removal of the archived `user-client` surface. This root
 * copy is kept only so existing documentation references
 * (`node scripts/design-audit.mjs ...`) keep working; it forwards every invocation
 * to the canonical scanner and propagates its exit code.
 *
 * Prefer: `npm run design:audit <path>`
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, 'devtools', 'design-audit.mjs');

const child = spawn(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
