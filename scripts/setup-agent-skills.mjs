#!/usr/bin/env node
// scripts/setup-agent-skills.mjs
//
// Cross-platform fix for OpenCode skill discovery.
//
// OpenCode auto-discovers skills under `.agents/skills/`. In this repo, the
// canonical skill definitions live in `.github/skills/`. This script mirrors
// the canonical skills into `.agents/skills/` as real files (not symlinks or
// directory junctions), because some Windows tooling — including OpenCode's
// skill scanner — does not follow directory junctions when reading skill
// manifests.
//
// Run automatically after `npm install` via the `postinstall` script, or
// manually with `npm run setup:agent-skills`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const githubSkillsDir = path.join(rootDir, '.github', 'skills');
const agentsSkillsDir = path.join(rootDir, '.agents', 'skills');

function isBrokenTextFile(filePath) {
  try {
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile()) return false;
    const content = fs.readFileSync(filePath, 'utf8').trim();
    // Broken Git symlinks on Windows are text files that contain a relative path.
    return content.startsWith('../../.github/skills/') || content.startsWith('.github/skills/');
  } catch {
    return false;
  }
}

function isSymlinkOrJunction(filePath) {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

function removeEntry(filePath) {
  const stats = fs.lstatSync(filePath);
  if (stats.isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(filePath);
  }
}

function copySkill(skillName) {
  const source = path.join(githubSkillsDir, skillName);
  const dest = path.join(agentsSkillsDir, skillName);

  let replaced = false;
  if (fs.existsSync(dest)) {
    if (isBrokenTextFile(dest) || isSymlinkOrJunction(dest)) {
      removeEntry(dest);
      replaced = true;
    }
  }

  fs.cpSync(source, dest, { recursive: true, force: true });
  return replaced ? 'replaced' : fs.existsSync(dest) ? 'updated' : 'created';
}

function main() {
  if (!fs.existsSync(githubSkillsDir)) {
    // Tolerant of container/CI builds: the Docker build (apps/server and
    // apps/admin-client) does not COPY .github/ or scripts/ so the npm ci
    // layer cache stays stable — in that environment the agent-skills mirror
    // is irrelevant. Local installs always have .github/skills present.
    console.warn(`[setup-agent-skills] Canonical skill directory not found: ${githubSkillsDir}`);
    console.warn('[setup-agent-skills] Skipping mirror (not a local dev workspace).');
    process.exit(0);
  }
  if (!fs.existsSync(agentsSkillsDir)) {
    fs.mkdirSync(agentsSkillsDir, { recursive: true });
  }

  const githubSkills = fs.readdirSync(githubSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  let created = 0;
  let replaced = 0;
  let updated = 0;
  let errors = 0;

  for (const skill of githubSkills) {
    try {
      const result = copySkill(skill);
      if (result === 'created') {
        console.log(`[created] ${skill}`);
        created += 1;
      } else if (result === 'replaced') {
        console.log(`[replaced] ${skill} (broken link → copy)`);
        replaced += 1;
      } else {
        console.log(`[updated] ${skill}`);
        updated += 1;
      }
    } catch (err) {
      console.error(`[error] ${skill}: ${err.message}`);
      errors += 1;
    }
  }

  console.log(`\n[setup-agent-skills] created=${created}, replaced=${replaced}, updated=${updated}, errors=${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
