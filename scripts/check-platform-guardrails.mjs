#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  getChangedFiles,
  getCoordinatedFiles,
  getImpactForFile,
  repoRoot,
} from './platform-coordination.mjs';

function parseArgs(argv) {
  const options = {
    staged: false,
    baseRef: null,
    headRef: null,
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--staged') {
      options.staged = true;
      continue;
    }
    if (value === '--changed') {
      options.baseRef = argv[index + 1] ?? null;
      options.headRef = argv[index + 2] ?? null;
      index += 2;
      continue;
    }
    options.files.push(value);
  }

  return options;
}

function readFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function findInlineApiTypeViolations(files) {
  const violations = [];
  const inlineApiTypePattern = /(?:interface|type)\s+\w+(?:Request|Response)\b/g;

  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
      continue;
    }
    if (file.startsWith('packages/shared/src/api-types/')) {
      continue;
    }
    if (getImpactForFile(file).length === 0) {
      continue;
    }

    const matches = readFile(file).match(inlineApiTypePattern);
    if (matches) {
      violations.push(`${file}: inline API type declarations are forbidden (${matches.join(', ')})`);
    }
  }

  return violations;
}

function findPlatformAgnosticViolations(files) {
  const violations = [];
  const directPlatformApiPatterns = [
    /\bwx\s*\./,
    /\bTaro\s*\./,
    /\bwindow\s*\.\s*location\b/,
  ];

  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
      continue;
    }

    const content = readFile(file);
    if (!content.includes('@platform-agnostic')) {
      continue;
    }

    if (directPlatformApiPatterns.some((pattern) => pattern.test(content))) {
      violations.push(`${file}: @platform-agnostic files must not call wx.*, Taro.*, or window.location directly.`);
    }
  }

  return violations;
}

function findSiblingUpdateViolations(changedFiles) {
  const violations = [];
  const changedSet = new Set(changedFiles);

  for (const file of changedFiles) {
    const [impact] = getImpactForFile(file);
    if (!impact || impact.root.role !== 'PRIMARY') {
      continue;
    }

    const hasCompanionChange = [
      ...impact.siblings.map((sibling) => sibling.file),
      ...impact.sharedDependencies,
    ].some((candidate) => changedSet.has(candidate));

    if (!hasCompanionChange) {
      const targets = [
        ...impact.siblings.map((sibling) => `${sibling.file} (${sibling.role})`),
        ...impact.sharedDependencies,
      ].join(', ');
      violations.push(`${file}: PRIMARY change requires a paired review/update in ${targets}.`);
    }
  }

  return violations;
}

const options = parseArgs(process.argv.slice(2));
const changedFiles = (options.staged || (options.baseRef && options.headRef) || options.files.length > 0)
  ? getChangedFiles({ staged: options.staged, baseRef: options.baseRef, headRef: options.headRef, files: options.files })
  : [];
const filesToInspect = changedFiles.length > 0
  ? changedFiles.filter((file) => getImpactForFile(file).length > 0)
  : getCoordinatedFiles();

const violations = [
  ...findInlineApiTypeViolations(filesToInspect),
  ...findPlatformAgnosticViolations(filesToInspect),
  ...findSiblingUpdateViolations(filesToInspect),
];

if (violations.length > 0) {
  console.error('Platform coordination guardrails found violations:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Platform coordination guardrails passed for ${filesToInspect.length > 0 ? filesToInspect.join(', ') : 'all coordinated files'}.`);
