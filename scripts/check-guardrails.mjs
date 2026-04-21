#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listGuardrailsAppSourcePaths } from './guardrails-app-sources.mjs';

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

const requiredRootScripts = {
  check: 'npm run typecheck',
  'check:clients': 'npm run typecheck -w @joyjoin/shared && npm run typecheck -w @joyjoin/user-client && npm run typecheck -w @joyjoin/admin-client && npm run typecheck -w mini-program',
  'check:server': 'npm run typecheck -w @joyjoin/server',
  'check:full': 'npm run guardrails && npm run lint && npm run test && npm run build',
  'set-admin': 'npm run admin:create',
};

const violations = [];

for (const file of trackedFiles) {
  const baseName = path.basename(file);
  if (baseName === '.env' || (/^\.env\./.test(baseName) && !allowedEnvFiles.has(file))) {
    violations.push(`Tracked env file is not allowed: ${file}`);
  }
}

// --- Monorepo boundary guards ---

// 1. Ban imports from the top-level legacy shared/ directory.
//    All shared code must come from packages/shared (via @joyjoin/shared or @shared/* alias).
const legacySharedImportPattern = /(?:from\s+['"]|import\(\s*['"])(?:@\/)?(?:\.\.\/){2,}shared\//;
const appSourceFiles = listGuardrailsAppSourcePaths(trackedFiles);
for (const file of appSourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (legacySharedImportPattern.test(content)) {
    violations.push(`Import from legacy top-level shared/ is banned (use @joyjoin/shared or @shared/*): ${file}`);
  }
}

// 2. Ban direct cross-app source imports (e.g. user-client importing from admin-client src).
const crossAppPatterns = [
  { from: 'apps/user-client/', bannedPrefix: /from\s+['"][^'"]*apps\/admin-client\/src\// },
  { from: 'apps/user-client/', bannedPrefix: /from\s+['"][^'"]*apps\/server\/src\// },
  { from: 'apps/admin-client/', bannedPrefix: /from\s+['"][^'"]*apps\/user-client\/src\// },
  { from: 'apps/admin-client/', bannedPrefix: /from\s+['"][^'"]*apps\/server\/src\// },
  { from: 'apps/server/', bannedPrefix: /from\s+['"][^'"]*apps\/user-client\/src\// },
  { from: 'apps/server/', bannedPrefix: /from\s+['"][^'"]*apps\/admin-client\/src\// },
];
for (const file of appSourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { from, bannedPrefix } of crossAppPatterns) {
    if (file.startsWith(from) && bannedPrefix.test(content)) {
      violations.push(`Cross-app source import is banned (use @joyjoin/shared for shared code): ${file}`);
    }
  }
}

for (const file of activeLegacyGuardFiles) {
  if (!fs.existsSync(file)) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const identifier of bannedLegacyIdentifiers) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(content)) {
      violations.push(`Legacy identifier "${identifier}" is banned in active code: ${file}`);
    }
  }
}

const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const [scriptName, expectedCommand] of Object.entries(requiredRootScripts)) {
  if (rootPackage.scripts?.[scriptName] !== expectedCommand) {
    violations.push(`Root package.json script "${scriptName}" must equal: ${expectedCommand}`);
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

console.log('Guardrails passed: no tracked env files, obvious secrets, banned legacy onboarding identifiers, legacy shared/ imports, or cross-app source imports were found.');
