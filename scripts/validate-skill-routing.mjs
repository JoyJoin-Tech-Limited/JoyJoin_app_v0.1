#!/usr/bin/env node
/**
 * JoyJoin Skill Routing Freshness Validator (v1.0)
 *
 * Checks that routing.yml metadata files are internally consistent and that
 * referenced file paths exist in the repository.
 *
 * Usage:
 *   node scripts/validate-skill-routing.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * What it checks:
 *   1. Every skill directory under .github/skills/ has a routing.yml
 *   2. Every routing.yml has required fields: skill, primary_ownership, use_when, strong_triggers
 *   3. Every path listed in owned_files exists on disk (prefix match — no glob expansion)
 *   4. The skill name in routing.yml matches the parent directory name
 *   5. No routing.yml references legacy paths or symbols
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SKILLS_DIR = join(REPO_ROOT, '.github', 'skills');

// ---------------------------------------------------------------------------
// YAML parser (minimal — only handles flat / list structures we produce)
// ---------------------------------------------------------------------------

/**
 * A very small YAML parser sufficient for our routing.yml format.
 * Supports:
 *   - key: value
 *   - key: |> multi-line
 *   - lists:
 *     - item
 *   - nested lists under a key
 *
 * NOT a general-purpose parser. Only handles the subset we author.
 *
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function parseRoutingYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let i = 0;
  let currentKey = null;
  let isList = false;
  let isMultiline = false;
  let multilineValue = '';

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Skip comments and blank lines (outside multiline)
    if (!isMultiline && (line.trimStart().startsWith('#') || line.trim() === '')) {
      i++;
      continue;
    }

    if (isMultiline) {
      // End multiline on next non-indented key
      if (/^\S/.test(line) && line.includes(':')) {
        result[currentKey] = multilineValue.trim();
        isMultiline = false;
        multilineValue = '';
        // Don't advance i — re-process this line
        continue;
      }
      multilineValue += line.trim() + ' ';
      i++;
      continue;
    }

    // List item under current key
    const listMatch = /^  - (.*)$/.exec(line);
    if (listMatch && currentKey && isList) {
      const val = listMatch[1].trim();
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      // Handle nested object (skill: / when:) — not needed for validation
      if (val.startsWith('skill:') || val.startsWith('when:')) {
        // Skip nested objects for our purposes
      } else {
        result[currentKey].push(val);
      }
      i++;
      continue;
    }

    // Nested list item (4-space indent, e.g. under related_skills)
    const nestedListMatch = /^    - (.*)$/.exec(line);
    if (nestedListMatch) {
      i++;
      continue;
    }

    // Key: value
    const kvMatch = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const rawVal = kvMatch[2].trim();

      if (rawVal.startsWith('>')) {
        isMultiline = true;
        isList = false;
        multilineValue = rawVal.slice(1).trim() + ' ';
        i++;
        continue;
      }

      if (rawVal === '' || rawVal === '|') {
        // Might be a list or multiline
        isList = true;
        isMultiline = false;
        result[currentKey] = [];
        i++;
        continue;
      }

      isList = false;
      result[currentKey] = rawVal.replace(/^['"]|['"]$/g, '');
      i++;
      continue;
    }

    i++;
  }

  if (isMultiline && currentKey) {
    result[currentKey] = multilineValue.trim();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Legacy sentinel check (for routing.yml authored content)
// ---------------------------------------------------------------------------

const LEGACY_SENTINELS = [
  { pattern: /\/guide\b/i, label: '/guide (deprecated onboarding step)' },
  { pattern: /\bshared\/(?!src)/i, label: 'shared/ root import' },
  { pattern: /hasCompletedRegistration|needsRegistration|registration_sessions|interestsTop/i, label: 'legacy onboarding identifier' },
  { pattern: /\/chats\b/i, label: '/chats surface (replaced by /connections)' },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * @typedef {{ skill: string, errors: string[], warnings: string[] }} ValidationResult
 */

/**
 * Validate a single routing.yml file.
 *
 * @param {string} skillDir  — name of the skill directory (e.g. 'matching-domain')
 * @param {string} filePath  — absolute path to routing.yml
 * @returns {ValidationResult}
 */
function validateRoutingFile(skillDir, filePath) {
  const errors = [];
  const warnings = [];

  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { skill: skillDir, errors: [`Cannot read file: ${err.message}`], warnings };
  }

  let data;
  try {
    data = parseRoutingYaml(raw);
  } catch (err) {
    return { skill: skillDir, errors: [`YAML parse error: ${err.message}`], warnings };
  }

  // 1. Required fields
  const REQUIRED = ['skill', 'primary_ownership', 'use_when', 'strong_triggers'];
  for (const field of REQUIRED) {
    if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 2. skill name must match directory name
  if (data.skill && data.skill !== skillDir) {
    errors.push(`skill field "${data.skill}" does not match directory name "${skillDir}"`);
  }

  // 3. owned_files paths should exist (prefix check, no glob)
  if (Array.isArray(data.owned_files)) {
    for (const pattern of data.owned_files) {
      // Strip glob suffixes for path existence check
      const base = pattern.replace(/\/\*\*$/, '').replace(/\/\*$/, '').replace(/\*\*$/, '');
      const absPath = join(REPO_ROOT, base);
      if (!existsSync(absPath)) {
        warnings.push(`owned_files path does not exist: ${base} (may be stale or not yet created)`);
      }
    }
  }

  // 4. owned_paths referenced — just warn if they look unusual (non /api/ prefix for server skills)
  if (Array.isArray(data.owned_paths)) {
    for (const p of data.owned_paths) {
      if (p && !p.startsWith('/')) {
        warnings.push(`owned_paths entry "${p}" should start with /`);
      }
    }
  }

  // 5. Legacy sentinel check on entire file content
  for (const { pattern, label } of LEGACY_SENTINELS) {
    if (pattern.test(raw)) {
      warnings.push(`Possible legacy reference in routing.yml: ${label}`);
    }
  }

  return { skill: skillDir, errors, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  console.log('🔍 JoyJoin Skill Routing Freshness Validator\n');

  // Discover all skill directories
  const entries = readdirSync(SKILLS_DIR).filter(name => {
    const full = join(SKILLS_DIR, name);
    return statSync(full).isDirectory();
  });

  let totalErrors = 0;
  let totalWarnings = 0;
  const missing = [];
  const results = [];

  for (const skillDir of entries) {
    const routingPath = join(SKILLS_DIR, skillDir, 'routing.yml');
    if (!existsSync(routingPath)) {
      missing.push(skillDir);
      continue;
    }
    const result = validateRoutingFile(skillDir, routingPath);
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  // Print missing
  if (missing.length > 0) {
    console.log('📋 Skills without routing.yml (optional for non-core skills):');
    missing.forEach(s => console.log(`   • ${s}`));
    console.log('');
  }

  // Print results
  for (const { skill, errors, warnings } of results) {
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ✅  ${skill}`);
      continue;
    }
    if (errors.length > 0) {
      console.log(`  ❌  ${skill}`);
      errors.forEach(e => console.log(`       error: ${e}`));
    } else {
      console.log(`  ⚠️   ${skill}`);
    }
    warnings.forEach(w => console.log(`       warn:  ${w}`));
  }

  console.log('');
  console.log(`Skills checked: ${results.length}  |  Errors: ${totalErrors}  |  Warnings: ${totalWarnings}`);
  console.log('');

  if (totalErrors > 0) {
    console.log('❌ Validation failed — fix errors above before merging.\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('⚠️  Validation passed with warnings. Review stale path references above.\n');
  } else {
    console.log('✅ All routing metadata is valid.\n');
  }
}

run();
