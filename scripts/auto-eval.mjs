#!/usr/bin/env node
import { evaluateWorkspace, formatManualReport } from './auto-eval-core.mjs';

function getArgValue(flagName) {
  const exact = process.argv.find((arg) => arg.startsWith(`${flagName}=`));
  if (exact) {
    return exact.slice(flagName.length + 1);
  }

  const index = process.argv.indexOf(flagName);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return null;
}

const mode = getArgValue('--mode') ?? 'manual-report';
const jsonOutput = process.argv.includes('--json') || mode === 'json';

try {
  const result = evaluateWorkspace({ mode });

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatManualReport(result)}\n`);
  }

  if (result.status === 'pass') {
    process.exit(0);
  }

  if (result.status === 'fail') {
    process.exit(1);
  }

  process.exit(3);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Auto-Eval infrastructure error: ${message}\n`);
  process.exit(3);
}
