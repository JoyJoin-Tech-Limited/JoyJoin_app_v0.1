#!/usr/bin/env node
import {
  formatImpactMarkdown,
  formatImpactSummary,
  formatImpactText,
  getChangedFiles,
  getImpactForFile,
} from './platform-coordination.mjs';

function parseArgs(argv) {
  const options = {
    staged: false,
    baseRef: null,
    headRef: null,
    format: 'text',
    summaryOnly: false,
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--staged') {
      options.staged = true;
      continue;
    }
    if (value === '--summary-only') {
      options.summaryOnly = true;
      continue;
    }
    if (value === '--format') {
      options.format = argv[index + 1] ?? 'text';
      index += 1;
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

const options = parseArgs(process.argv.slice(2));
const files = options.staged || (options.baseRef && options.headRef)
  ? getChangedFiles({ staged: options.staged, baseRef: options.baseRef, headRef: options.headRef })
  : options.files;

if (files.length === 0) {
  console.log('Usage: node scripts/impact-check.js <file ...> [--staged] [--changed <base> <head>] [--summary-only] [--format text|markdown|json]');
  process.exit(1);
}

const impacts = files.flatMap((file) => getImpactForFile(file));

if (options.format === 'json') {
  console.log(JSON.stringify(impacts, null, 2));
  process.exit(0);
}

if (options.summaryOnly) {
  console.log(formatImpactSummary(impacts));
  process.exit(0);
}

if (options.format === 'markdown') {
  console.log(formatImpactMarkdown(impacts));
  process.exit(0);
}

console.log(formatImpactText(impacts));
