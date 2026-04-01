#!/usr/bin/env node
/**
 * JoyJoin Skill Routing Freshness Validator (v1.0)
 *
 * Validates every existing `routing.yml` under `.github/skills/` and reports
 * skill directories that do not yet opt into routing metadata.
 *
 * Usage:
 *   node scripts/validate-skill-routing.mjs
 *
 * Exit codes:
 *   0 — all validated routing files passed
 *   1 — one or more validated routing files failed
 *
 * What it checks for each present `routing.yml`:
 *   1. Required fields exist: skill, primary_ownership, use_when, strong_triggers
 *   2. The skill name matches the parent directory name
 *   3. Every path listed in owned_files exists on disk (prefix check — no glob expansion)
 *   4. owned_paths entries start with /
 *   5. No routing metadata references legacy paths or symbols
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEGACY_SENTINELS,
  parseRoutingYaml,
  REPO_ROOT,
  ROUTING_REQUIRED_FIELDS,
  SKILLS_DIR,
} from './skill-routing-metadata.mjs';

/**
 * @typedef {{ skill: string, errors: string[], warnings: string[] }} ValidationResult
 */

/**
 * Validate a single routing.yml file.
 *
 * @param {string} skillDir
 * @param {string} filePath
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

  for (const field of ROUTING_REQUIRED_FIELDS) {
    if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (data.skill && data.skill !== skillDir) {
    errors.push(`skill field "${data.skill}" does not match directory name "${skillDir}"`);
  }

  if (Array.isArray(data.owned_files)) {
    for (const pattern of data.owned_files) {
      const base = pattern.replace(/\/\*\*$/, '').replace(/\/\*$/, '').replace(/\*\*$/, '');
      const absPath = join(REPO_ROOT, base);
      if (!existsSync(absPath)) {
        warnings.push(`owned_files path does not exist: ${base} (may be stale or not yet created)`);
      }
    }
  }

  if (Array.isArray(data.owned_paths)) {
    for (const ownedPath of data.owned_paths) {
      if (ownedPath && !ownedPath.startsWith('/')) {
        warnings.push(`owned_paths entry "${ownedPath}" should start with /`);
      }
    }
  }

  for (const { pattern, label } of LEGACY_SENTINELS) {
    if (pattern.test(raw)) {
      errors.push(`Legacy reference in routing.yml: ${label}`);
    }
  }

  return { skill: skillDir, errors, warnings };
}

function run() {
  console.log('🔍 JoyJoin Skill Routing Freshness Validator\n');

  const entries = readdirSync(SKILLS_DIR).filter(name => statSync(join(SKILLS_DIR, name)).isDirectory());

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

  if (missing.length > 0) {
    console.log('📋 Skills without routing.yml (currently optional until they opt into routing metadata):');
    missing.forEach(skill => console.log(`   • ${skill}`));
    console.log('');
  }

  let allClean = true;
  for (const { skill, errors, warnings } of results) {
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ✅  ${skill}`);
      continue;
    }

    allClean = false;
    if (errors.length > 0) {
      console.log(`  ❌  ${skill}`);
      errors.forEach(error => console.log(`       error: ${error}`));
    } else {
      console.log(`  ⚠️   ${skill}`);
    }
    warnings.forEach(warning => console.log(`       warn:  ${warning}`));
  }

  console.log('');
  console.log(`Skills checked: ${results.length}  |  Errors: ${totalErrors}  |  Warnings: ${totalWarnings}`);
  console.log('');

  if (totalErrors > 0) {
    console.log('❌ Validation failed — fix errors above before merging.\n');
    process.exit(1);
  }

  if (totalWarnings > 0) {
    console.log('⚠️  Validation passed with warnings. Review stale path references above.\n');
    return;
  }

  console.log('✅ All routing metadata is valid.\n');
}

run();
