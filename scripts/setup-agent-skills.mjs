#!/usr/bin/env node
// scripts/setup-agent-skills.mjs
//
// Cross-platform fix for OpenCode skill discovery.
//
// OpenCode auto-discovers skills under `.agents/skills/`. In this repo, the
// canonical skill definitions live in `.github/skills/`. The `.agents/skills/`
// entries are meant to be symlinks/junctions pointing to `.github/skills/...`.
//
// On macOS/Linux, Git symlinks work out of the box. On Windows, Git often
// checks symlinks out as plain text files containing the target path (unless the
// repo was cloned with `core.symlinks=true` and Developer Mode / admin rights).
// This script recreates the links correctly on every platform:
//   - Windows: directory junctions (no admin required)
//   - macOS/Linux: relative symbolic links

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const githubSkillsDir = path.join(rootDir, '.github', 'skills');
const agentsSkillsDir = path.join(rootDir, '.agents', 'skills');

const isWindows = process.platform === 'win32';

function relativeSkillTarget(skillName) {
  return path.relative(agentsSkillsDir, path.join(githubSkillsDir, skillName));
}

function createLink(skillName, absoluteTarget) {
  const linkPath = path.join(agentsSkillsDir, skillName);

  if (isWindows) {
    // Directory junctions do not require elevated privileges on Windows.
    fs.symlinkSync(absoluteTarget, linkPath, 'junction');
  } else {
    // Use relative symlinks on Unix so the repo remains relocatable.
    const relativeTarget = relativeSkillTarget(skillName);
    fs.symlinkSync(relativeTarget, linkPath, 'dir');
  }
}

function linkExists(linkPath) {
  try {
    const stats = fs.lstatSync(linkPath);
    return stats.isSymbolicLink() || stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

function isBrokenTextFile(linkPath) {
  try {
    const stats = fs.lstatSync(linkPath);
    if (!stats.isFile()) return false;
    const content = fs.readFileSync(linkPath, 'utf8').trim();
    // Broken Git symlinks on Windows are text files that contain a relative path
    // like "../../.github/skills/..." or a directory-like path.
    return content.startsWith('../../.github/skills/') || content.startsWith('.github/skills/');
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(githubSkillsDir)) {
    console.error(`[setup-agent-skills] Canonical skill directory not found: ${githubSkillsDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(agentsSkillsDir)) {
    fs.mkdirSync(agentsSkillsDir, { recursive: true });
  }

  const githubSkills = fs.readdirSync(githubSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  let created = 0;
  let replaced = 0;
  let skipped = 0;
  let errors = 0;

  for (const skill of githubSkills) {
    const linkPath = path.join(agentsSkillsDir, skill);
    const absoluteTarget = path.join(githubSkillsDir, skill);

    if (!linkExists(linkPath)) {
      try {
        createLink(skill, absoluteTarget);
        console.log(`[created] ${skill} → ${isWindows ? absoluteTarget : relativeSkillTarget(skill)}`);
        created += 1;
      } catch (err) {
        console.error(`[error] Failed to create link for ${skill}: ${err.message}`);
        errors += 1;
      }
    } else if (isBrokenTextFile(linkPath)) {
      try {
        fs.unlinkSync(linkPath);
        createLink(skill, absoluteTarget);
        console.log(`[replaced] ${skill} (broken text file → ${isWindows ? 'junction' : 'symlink'})`);
        replaced += 1;
      } catch (err) {
        console.error(`[error] Failed to replace broken link for ${skill}: ${err.message}`);
        errors += 1;
      }
    } else if (fs.lstatSync(linkPath).isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(linkPath);
      const expectedTarget = isWindows ? absoluteTarget : relativeSkillTarget(skill);
      if (currentTarget !== expectedTarget) {
        try {
          fs.unlinkSync(linkPath);
          createLink(skill, absoluteTarget);
          console.log(`[fixed] ${skill} → ${expectedTarget}`);
          replaced += 1;
        } catch (err) {
          console.error(`[error] Failed to fix link for ${skill}: ${err.message}`);
          errors += 1;
        }
      } else {
        console.log(`[ok] ${skill}`);
        skipped += 1;
      }
    } else if (fs.lstatSync(linkPath).isDirectory()) {
      // A real directory already exists; leave it alone (could be a copy or a
      // symlink that was already resolved by the OS).
      console.log(`[skip] ${skill} (real directory, not a symlink)`);
      skipped += 1;
    } else {
      console.log(`[skip] ${skill} (unknown entry)`);
      skipped += 1;
    }
  }

  console.log(`\n[setup-agent-skills] created=${created}, replaced=${replaced}, skipped=${skipped}, errors=${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
