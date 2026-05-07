#!/usr/bin/env node
/**
 * JoyJoin Skill Routing Coverage Validator (v2.0)
 *
 * Validates every skill directory under `.github/skills/` for routing coverage
 * and validates the syntax of each present `routing.yml`.
 *
 * Coverage rule: every skill directory must have EITHER a valid `routing.yml`
 * OR an explicit `routing-exempt.yml` file. A missing routing file is an error.
 *
 * To exempt a skill from routing (rare), create a `routing-exempt.yml` in its
 * directory with a single required field:
 *   reason: <one-sentence explanation of why this skill is intentionally non-routable>
 *
 * Usage:
 *   node scripts/verify/validate-skill-routing.mjs
 *
 * Exit codes:
 *   0 — all skills have valid routing coverage
 *   1 — one or more skills are uncovered or have invalid routing metadata
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
} from '../skill-routing-metadata.mjs';

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
  console.log('🔍 JoyJoin Skill Routing Coverage Validator\n');

  const entries = readdirSync(SKILLS_DIR).filter(name => statSync(join(SKILLS_DIR, name)).isDirectory());

  let totalErrors = 0;
  let totalWarnings = 0;
  const uncovered = [];
  const exempted = [];
  const results = [];

  for (const skillDir of entries) {
    const routingPath = join(SKILLS_DIR, skillDir, 'routing.yml');
    const exemptPath = join(SKILLS_DIR, skillDir, 'routing-exempt.yml');

    if (!existsSync(routingPath)) {
      if (existsSync(exemptPath)) {
        try {
          const exemptRaw = readFileSync(exemptPath, 'utf8');
          const exemptData = parseRoutingYaml(exemptRaw);
          const exemptReason = typeof exemptData.reason === 'string' ? exemptData.reason.trim() : '';

          if (!exemptReason) {
            console.log(`  ❌  ${skillDir}`);
            console.log(`       error: routing-exempt.yml must contain a non-empty "reason" field.`);
            totalErrors += 1;
          } else {
            exempted.push({ skill: skillDir, reason: exemptReason });
            console.log(`  ⏭   ${skillDir} (exempt: ${exemptReason})`);
          }
        } catch (error) {
          console.log(`  ❌  ${skillDir}`);
          console.log(`       error: failed to parse routing-exempt.yml — ensure it is valid YAML with a non-empty "reason" field.`);
          totalErrors += 1;
        }
      } else {
        uncovered.push(skillDir);
        console.log(`  ❌  ${skillDir}`);
        console.log(`       error: missing routing.yml — every active skill must either have routing.yml or routing-exempt.yml`);
        totalErrors += 1;
      }
      continue;
    }

    const result = validateRoutingFile(skillDir, routingPath);
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  // Print results for validated files
  for (const { skill, errors, warnings } of results) {
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`  ✅  ${skill}`);
      continue;
    }

    if (errors.length > 0) {
      console.log(`  ❌  ${skill}`);
      errors.forEach(error => console.log(`       error: ${error}`));
    } else {
      console.log(`  ⚠️   ${skill}`);
    }
    warnings.forEach(warning => console.log(`       warn:  ${warning}`));
  }

  const validCount = results.filter(result => result.errors.length === 0).length;

  console.log('');
  console.log(`Skills checked: ${entries.length}  |  Valid: ${validCount}  |  Exempt: ${exempted.length}  |  Uncovered: ${uncovered.length}  |  Errors: ${totalErrors}  |  Warnings: ${totalWarnings}`);
  console.log('');

  if (uncovered.length > 0) {
    console.log('❌ Coverage gaps — the following skills have no routing.yml and no routing-exempt.yml:');
    uncovered.forEach(skill => console.log(`   • ${skill} → add .github/skills/${skill}/routing.yml (see .github/skills/routing-schema.yml)`));
    console.log('');
  }

  if (totalErrors > 0) {
    console.log('❌ Validation failed — fix errors above before merging.\n');
    process.exit(1);
  }

  if (totalWarnings > 0) {
    console.log('⚠️  Validation passed with warnings. Review stale path references above.\n');
    return;
  }

  console.log('✅ All skills have valid routing coverage.\n');
}

run();
