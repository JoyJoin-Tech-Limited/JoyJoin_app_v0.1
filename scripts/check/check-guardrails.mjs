#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listGuardrailsAppSourcePaths, isPlaceholder } from '../guardrails-app-sources.mjs';

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
  'apps/server/src/cli/createUserAccount.ts',
];

const requiredRootScripts = {
  check: 'npm run typecheck',
  'check:clients': 'npm run typecheck -w @joyjoin/shared && npm run typecheck -w @joyjoin/admin-client && npm run typecheck -w mini-program',
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
  { from: 'apps/admin-client/', bannedPrefix: /from\s+['"][^'"]*apps\/server\/src\// },
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

// 3. Flag ad-hoc font-size literals in mini-program SCSS (must use $font-size-* tokens or type-* mixins).
// Only checks staged changes to avoid
// blocking CI on legacy code. Existing hardcoded literals should be migrated over time.
// Note: this checks git staged changes only (--cached).
let modifiedFiles = [];
try {
  modifiedFiles = execFileSync('git', ['diff', '--name-only', '--cached', '--diff-filter=ACMRTUB', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
} catch {
  // Ignore git errors (e.g., not in a git repo)
}
const hardcodedFontSizePattern = /font-size:\s*\d+rpx/;
const decorativeCommentPattern = /\/\/\s*(Decorative|Intentional|Emoji|Icon)/i;
for (const file of modifiedFiles) {
  if (!file.startsWith('apps/mini-program/src/') || !file.endsWith('.scss')) continue;
  if (file.endsWith('_variables.scss') || file.endsWith('_mixins.scss')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (hardcodedFontSizePattern.test(line) && !decorativeCommentPattern.test(line)) {
      violations.push(`Ad-hoc font-size literal found (use \$font-size-* token or type-* mixin): ${file}:${index + 1}`);
    }
  });
}

// 4. Emoji commit blocker for mini-program TS/TSX.
// Inline emoji in UI text must be replaced with JoyJoinIcon proprietary icons or CSS/text.
// Lines that intentionally pass emoji to the icon system (emoji=, icon=, fallbackEmoji) are allowed.
const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const allowedEmojiContextPattern = /emoji\s*=\s*['"]|icon\s*=\s*['"]|fallbackEmoji/;
const allowedEmojiFiles = new Set([
  'packages/shared/src/iconSystem/emojiToIconMap.ts',
  'packages/shared/src/constants.ts',
]);
for (const file of modifiedFiles) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  if (allowedEmojiFiles.has(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (emojiPattern.test(line) && !allowedEmojiContextPattern.test(line)) {
      violations.push(`Inline emoji found (use JoyJoinIcon or CSS/text instead): ${file}:${index + 1}`);
    }
  });
}

// 5. Flag page-level loading/empty/error state blocks that use flex
//    but lack height-based centering safety (min-height, flex:1, fixed, etc.).
//    Prevents mascot/empty-state images from hugging the top of ScrollViews.
const stateBlockPattern = /&__(loading|empty|error)(?:-[\w-]+)?\s*\{[^{}]*\}/g;
const flexIndicatorPattern = /display:\s*flex|@include\s+flex-center/;
const centeringSafetyPattern = /min-height:\s*(?:[1-9]|\d{2,})|flex:\s*1|flex-grow:\s*1|@include\s+scroll-view-centered-state|@include\s+viewport-min-height|position:\s*fixed/;

for (const file of modifiedFiles) {
  if (!file.startsWith('apps/mini-program/src/pages/') || !file.endsWith('.scss')) continue;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  // Reset lastIndex to avoid stale state from prior exec() calls on the global regex
  stateBlockPattern.lastIndex = 0;
  while ((match = stateBlockPattern.exec(content)) !== null) {
    const block = match[0];
    if (flexIndicatorPattern.test(block) && !centeringSafetyPattern.test(block)) {
      const linesBefore = content.slice(0, match.index).split(/\r?\n/);
      const lineNum = linesBefore.length;
      const selector = block.split('{')[0].trim();
      violations.push(`State block "${selector}" uses flex but lacks centering safety (add min-height, flex:1, or @include scroll-view-centered-state): ${file}:${lineNum}`);
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

for (const file of trackedFiles) {
  if (!shouldScanForSecrets(file)) continue;
  if (!fs.existsSync(file)) {
    // File may have been deleted during development but still be listed by git ls-files.
    continue;
  }
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

console.log('Guardrails passed: no tracked env files, obvious secrets, banned legacy onboarding identifiers, legacy shared/ imports, cross-app source imports, inline emojis, or unsafe flex-centered state blocks were found.');
