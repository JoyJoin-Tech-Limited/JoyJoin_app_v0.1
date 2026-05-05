#!/usr/bin/env node
/**
 * check-doc-mapping.mjs — Doc-to-code mapping guardrail
 *
 * Fast, static, no-git verification that every documented code area has its
 * corresponding README or architecture doc on disk.  Runs as the last step
 * in the guardrails chain.
 *
 * Exit codes:
 *   0 — all required docs present (optional gaps are warnings only)
 *   1 — one or more required docs missing or placeholder-quality
 *
 * Usage:
 *   node scripts/check-doc-mapping.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════════
// Doc mappings (mirrored from scripts/auto-docs.mjs)
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Array<{ source: string; doc: string; title: string; optional?: boolean }>} */
const DOC_MAPPINGS = [
  // ── Server domains ──
  { source: 'apps/server/src/routes', doc: 'apps/server/src/routes/README.md', title: 'Server Routes' },
  { source: 'apps/server/src/repositories', doc: 'apps/server/src/repositories/README.md', title: 'Database Repositories' },
  { source: 'apps/server/src/middleware', doc: 'apps/server/src/middleware/README.md', title: 'Server Middleware' },
  { source: 'packages/shared/src/personality', doc: 'packages/shared/src/personality/README.md', title: 'Personality Engine' },
  { source: 'packages/shared/src/types', doc: 'packages/shared/src/types/README.md', title: 'Shared Types' },
  { source: 'apps/server/src', doc: 'apps/server/src/README.md', title: 'Server Root' },
  { source: 'packages/shared/src', doc: 'packages/shared/src/README.md', title: 'Shared Package' },
  // ── Domains (optional) ──
  { source: 'packages/shared/src/matching', doc: 'docs/architecture/matching.md', title: 'Matching Algorithm', optional: true },
  { source: 'apps/server/src/services/matching', doc: 'docs/architecture/matching.md', title: 'Matching Service', optional: true },
  { source: 'apps/server/src/services/socialIcebreaker', doc: 'docs/architecture/social-icebreaker.md', title: 'Social Icebreaker', optional: true },
  { source: 'packages/shared/src/socialIcebreaker', doc: 'docs/architecture/social-icebreaker.md', title: 'Social Icebreaker (Shared)', optional: true },
  { source: 'apps/server/src/services/payment', doc: 'docs/architecture/payment.md', title: 'Payment System', optional: true },
  { source: 'apps/server/src/websocket', doc: 'docs/architecture/websocket.md', title: 'WebSocket Infrastructure', optional: true },
  { source: 'docs/automations', doc: 'docs/automations/README.md', title: 'Automations System' },
];

/** @type {Array<{ path: string; title: string }>} */
const REQUIRED_CANONICAL_DOCS = [
  { path: 'AGENTS.md', title: 'Agent Onboarding Guide' },
  { path: 'README.md', title: 'Project README' },
  { path: 'DEVELOPER_QUICK_REFERENCE.md', title: 'Developer Quick Reference' },
  { path: 'PRODUCT_REQUIREMENTS.md', title: 'Product Requirements' },
  { path: 'CONTRIBUTING.md', title: 'Contributing Guide' },
  { path: 'docs/README.md', title: 'Documentation Index' },
];

// ═══════════════════════════════════════════════════════════════════════════════

const PLACEHOLDER_MARKERS = ['TODO', 'FIXME', 'coming soon', 'under construction'];

function isPlaceholder(abspath) {
  try {
    const stats = fs.statSync(abspath);
    if (stats.size < 100) return true;
    const content = fs.readFileSync(abspath, 'utf8').slice(0, 500);
    return PLACEHOLDER_MARKERS.some((m) => content.toLowerCase().includes(m));
  } catch {
    return false;
  }
}

function sourceExists(relPath) {
  const abspath = path.join(root, relPath);
  try {
    return fs.statSync(abspath) !== undefined;
  } catch {
    return false;
  }
}

function docExists(relPath) {
  const abspath = path.join(root, relPath);
  try {
    fs.accessSync(abspath);
    return true;
  } catch {
    return false;
  }
}

const violations = [];
const warnings = [];

// Check doc mappings
for (const mapping of DOC_MAPPINGS) {
  if (!sourceExists(mapping.source)) continue; // Source doesn't exist → skip

  const exists = docExists(mapping.doc);

  if (!exists) {
    if (mapping.optional) {
      warnings.push(`Optional doc missing for ${mapping.source}: ${mapping.doc} (${mapping.title})`);
    } else {
      violations.push(`Missing doc for ${mapping.source}: ${mapping.doc} (${mapping.title})`);
    }
  } else if (isPlaceholder(path.join(root, mapping.doc))) {
    if (mapping.optional) {
      warnings.push(`Optional doc is placeholder-quality: ${mapping.doc} (${mapping.title})`);
    } else {
      violations.push(`Doc is placeholder-quality: ${mapping.doc} (${mapping.title})`);
    }
  }
}

// Check canonical docs
for (const doc of REQUIRED_CANONICAL_DOCS) {
  const abspath = path.join(root, doc.path);
  try {
    fs.accessSync(abspath);
    const stats = fs.statSync(abspath);
    if (stats.size < 100) {
      violations.push(`Canonical doc too small (<100 bytes): ${doc.path} (${doc.title})`);
    }
  } catch {
    violations.push(`Canonical doc missing: ${doc.path} (${doc.title})`);
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  for (const w of warnings) {
    console.log(`  - ${w}`);
  }
  console.log();
}

if (violations.length > 0) {
  console.log('❌ Violations:');
  for (const v of violations) {
    console.log(`  - ${v}`);
  }
  console.log(`\nFound ${violations.length} doc-mapping violation(s).`);
  console.log('Run `node scripts/auto-docs.mjs --scan-all` to generate missing docs.');
  process.exit(1);
}

console.log('✅ Doc mapping guardrail passed (all required docs present).');
process.exit(0);
