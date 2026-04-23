#!/usr/bin/env node
/**
 * Regression tests for the Harness Completion Gate
 *
 * Run: node --test scripts/harness-completion-gate.test.mjs
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// Import the internal functions by reading and evaluating the module
// Since the gate script uses top-level execution, we extract the helper functions
const gateModule = await import('./harness-completion-gate.mjs');

// The gate script runs main() on import. We need to test the functions indirectly
// by constructing scenarios and checking behavior.

// Since the module auto-runs main(), we'll test via child process invocations
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const GATE_SCRIPT = new URL('./harness-completion-gate.mjs', import.meta.url).pathname;

function runGate(cwd, args = []) {
  const result = spawnSync('node', [GATE_SCRIPT, '--json', ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
  });
  let output = null;
  try {
    output = JSON.parse(result.stdout);
  } catch {
    // parse failed — return raw
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output,
  };
}

describe('Harness Completion Gate', () => {
  describe('Clean worktree', () => {
    it('passes when there are no changes', () => {
      // Use a temp git repo with no changes
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      // Create and commit a file so HEAD exists
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
      assert.ok(result.output, 'Expected JSON output');
      assert.strictEqual(result.output.status, 'pass');
      assert.strictEqual(result.output.filesChecked, 0);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Secret detection', () => {
    it('fails on hardcoded API key in new file', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      // Add a file with a secret
      fs.writeFileSync(path.join(tmpDir, 'config.ts'), `const API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';\n`);
      spawnSync('git', ['add', 'config.ts'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      assert.strictEqual(result.output.status, 'fail');
      const security = result.output.pillars.find((p) => p.key === 'security');
      assert.ok(security, 'Security pillar should exist');
      assert.ok(security.findings.length > 0, 'Should find at least one security issue');
      assert.ok(security.findings.some((f) => f.message.includes('API key')));

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('allows env template syntax in .mcp.json', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      fs.writeFileSync(path.join(tmpDir, '.mcp.json'), `{"token": "\${GITHUB_TOKEN}"}\n`);
      spawnSync('git', ['add', '.mcp.json'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      const security = result.output.pillars.find((p) => p.key === 'security');
      assert.ok(security, 'Security pillar should exist');
      const secretFindings = security.findings.filter((f) => f.file === '.mcp.json');
      assert.strictEqual(secretFindings.length, 0, '.mcp.json should not be flagged for secrets');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('debugger detection', () => {
    it('fails on debugger statement', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'function test() { debugger; }\n');
      spawnSync('git', ['add', 'app.ts'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      assert.strictEqual(result.output.status, 'fail');
      const security = result.output.pillars.find((p) => p.key === 'security');
      assert.ok(security.findings.some((f) => f.message.includes('debugger')));

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('N+1 detection', () => {
    it('fails on db call inside for loop', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      fs.writeFileSync(
        path.join(tmpDir, 'bad.ts'),
        'for (const id of ids) { await db.query("SELECT * FROM users WHERE id = " + id); }\n'
      );
      spawnSync('git', ['add', 'bad.ts'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      const scalability = result.output.pillars.find((p) => p.key === 'scalability');
      assert.ok(scalability.findings.some((f) => f.message.includes('N+1')), 'Should detect N+1');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Cross-app import detection', () => {
    it('fails on user-client importing from admin-client', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      fs.mkdirSync(path.join(tmpDir, 'apps', 'user-client', 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'apps', 'user-client', 'src', 'page.tsx'),
        "import { AdminOnly } from '../../../admin-client/src/components/AdminOnly';\n"
      );
      spawnSync('git', ['add', 'apps/user-client/src/page.tsx'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      assert.strictEqual(result.output.status, 'fail');
      const maintainability = result.output.pillars.find((p) => p.key === 'maintainability');
      assert.ok(maintainability.findings.some((f) => f.message.includes('Cross-app import')));

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Diff-aware filtering', () => {
    it('does not flag pre-existing issues on unchanged lines', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });

      // Commit a file with console.log (pre-existing issue)
      fs.writeFileSync(
        path.join(tmpDir, 'app.ts'),
        'function old() { console.log("existing log"); }\nfunction newFunc() { return 42; }\n'
      );
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      // Modify only the second function — console.log on line 1 is unchanged
      fs.writeFileSync(
        path.join(tmpDir, 'app.ts'),
        'function old() { console.log("existing log"); }\nfunction newFunc() { return 99; }\n'
      );
      spawnSync('git', ['add', 'app.ts'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      // Should NOT fail because console.log is on an unchanged line
      const security = result.output.pillars.find((p) => p.key === 'security');
      const consoleFindings = security?.findings?.filter((f) => f.message.includes('console.log')) ?? [];
      assert.strictEqual(consoleFindings.length, 0, 'Should not flag pre-existing console.log on unchanged lines');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('flags new console.log on added lines', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-test-'));
      spawnSync('git', ['init'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });

      fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'function old() { return 42; }\n');
      spawnSync('git', ['add', '.'], { cwd: tmpDir });
      spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });

      // Add a new function with console.log
      fs.writeFileSync(
        path.join(tmpDir, 'app.ts'),
        'function old() { return 42; }\nfunction newFunc() { console.log("new log"); }\n'
      );
      spawnSync('git', ['add', 'app.ts'], { cwd: tmpDir });

      const result = runGate(tmpDir);
      assert.ok(result.output, 'Expected JSON output');
      const security = result.output.pillars.find((p) => p.key === 'security');
      const consoleFindings = security?.findings?.filter((f) => f.message.includes('console.log')) ?? [];
      assert.ok(consoleFindings.length > 0, 'Should flag NEW console.log on added lines');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
