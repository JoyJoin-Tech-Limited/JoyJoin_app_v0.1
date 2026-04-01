#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const trackedFiles = Array.from(new Set(
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
));

const allowedEnvFiles = new Set([
  '.env.example',
  'deployment/.env.production.example',
  'deployment/.env.staging.example',
]);

const bannedLegacyIdentifiers = [
  'hasCompletedRegistration',
  'needsRegistration',
  'registration_sessions',
  'interestsTop',
];

const activeLegacyGuardFiles = [
  'apps/user-client/src/hooks/useAuth.ts',
  'apps/user-client/src/hooks/useOnboardingProgress.ts',
  'apps/user-client/src/hooks/useOnboardingRoute.ts',
  'apps/user-client/src/pages/LoginPage.tsx',
  'apps/server/src/cli/createUserAccount.ts',
];

const violations = [];

for (const file of trackedFiles) {
  const baseName = path.basename(file);
  if (baseName === '.env' || (/^\.env\./.test(baseName) && !allowedEnvFiles.has(file))) {
    violations.push(`Tracked env file is not allowed: ${file}`);
  }
}

for (const file of activeLegacyGuardFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const identifier of bannedLegacyIdentifiers) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(content)) {
      violations.push(`Legacy identifier "${identifier}" is banned in active code: ${file}`);
    }
  }
}

const secretKeyPattern = /^\s*(?:export\s+)?(DATABASE_URL|JWT_SECRET|SESSION_SECRET|WECHAT_SECRET|DEEPSEEK_API_KEY|ADMIN_CREATE_SECRET_KEY)\s*[:=]\s*["']?([^"'\s#]+)/i;
const credentialUrlPattern = /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i;

function shouldScanForSecrets(file) {
  const ext = path.extname(file);
  return (
    file === '.env.example' ||
    file.startsWith('deployment/.env') ||
    file.startsWith('.github/workflows/') ||
    ext === '.yml' ||
    ext === '.yaml'
  );
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return [
    'example',
    'placeholder',
    'replace',
    'change-me',
    'changeme',
    'your_',
    '<',
    '${{',
    '$',
    'localhost',
    '127.0.0.1',
  ].some((token) => normalized.includes(token));
}

for (const file of trackedFiles) {
  if (!shouldScanForSecrets(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const assignment = line.match(secretKeyPattern);
    if (assignment && !isPlaceholder(assignment[2])) {
      violations.push(`Possible committed secret in ${file}:${index + 1}`);
    }

    const urlMatch = line.match(credentialUrlPattern);
    if (urlMatch && !isPlaceholder(urlMatch[0])) {
      violations.push(`Possible credential-bearing database URL in ${file}:${index + 1}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Guardrail violations found:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Guardrails passed: no tracked env files, obvious secrets, or banned legacy onboarding identifiers were found.');
