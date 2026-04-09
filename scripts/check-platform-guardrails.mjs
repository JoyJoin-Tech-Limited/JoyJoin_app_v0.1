#!/usr/bin/env node
import { ESLint } from 'eslint';
import fs from 'node:fs';
import path from 'node:path';
import plugin from './eslint-plugin-platform-boundaries/index.js';
import {
  getChangedFiles,
  getCoordinatedFiles,
  getImpactForFile,
  repoRoot,
  toRepoRelative,
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

    const impacts = getImpactForFile(file);
    if (impacts.length === 0) {
      continue;
    }

    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    const matches = content.match(inlineApiTypePattern);
    if (matches) {
      violations.push(`${file}: inline API type declarations are forbidden (${matches.join(', ')})`);
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

const inlineViolations = findInlineApiTypeViolations(filesToInspect);

const eslint = new ESLint({
  cwd: repoRoot,
  ignore: false,
  useEslintrc: false,
  overrideConfig: {
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    },
    plugins: ['platform-boundaries'],
    rules: {
      'platform-boundaries/no-direct-platform-api': 'error',
      'platform-boundaries/require-sibling-update': ['error', { changedFiles }],
    },
  },
  plugins: {
    'platform-boundaries': plugin,
  },
});

const absoluteFiles = filesToInspect.map((file) => path.join(repoRoot, file));
const lintResults = absoluteFiles.length > 0 ? await eslint.lintFiles(absoluteFiles) : [];
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(lintResults);
const errorCount = lintResults.reduce((total, result) => total + result.errorCount, 0);

if (inlineViolations.length > 0) {
  console.error('Platform API type guardrail violations found:');
  for (const violation of inlineViolations) {
    console.error(`- ${violation}`);
  }
}

if (output) {
  console.error(output.trim());
}

if (inlineViolations.length > 0 || errorCount > 0) {
  process.exit(1);
}

const summaryTarget = changedFiles.length > 0
  ? changedFiles.map((file) => toRepoRelative(file)).join(', ')
  : 'all coordinated files';
console.log(`Platform coordination guardrails passed for ${summaryTarget}.`);
