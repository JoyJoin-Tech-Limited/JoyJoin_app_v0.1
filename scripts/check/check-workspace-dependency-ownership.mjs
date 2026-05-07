#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function hasDependency(manifest, section, name) {
  return Boolean(manifest[section]?.[name]);
}

const checks = [
  {
    label: 'Root manifest is orchestration-only',
    passed: Object.keys(readJson('package.json').dependencies ?? {}).length === 0 && Object.keys(readJson('package.json').devDependencies ?? {}).length === 0,
    detail: 'Root package.json should not own dependencies or devDependencies.',
  },
];

const ownership = [
  ['apps/server/package.json', 'dependencies', ['date-fns', 'memoizee', 'node-cache', 'openid-client', 'passport', 'pg']],
  ['apps/server/package.json', 'devDependencies', ['@types/memoizee', '@types/passport', '@types/pg', 'vitest']],
  ['apps/admin-client/package.json', 'dependencies', ['@amap/amap-jsapi-loader', '@radix-ui/react-aspect-ratio', '@radix-ui/react-collapsible', '@radix-ui/react-context-menu', '@radix-ui/react-hover-card', '@radix-ui/react-menubar', '@radix-ui/react-navigation-menu', '@radix-ui/react-progress', '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-slider', '@radix-ui/react-toggle', '@radix-ui/react-toggle-group', '@radix-ui/react-visually-hidden', '@tailwindcss/typography', 'canvas-confetti', 'cmdk', 'embla-carousel-autoplay', 'embla-carousel-react', 'framer-motion', 'input-otp', 'lottie-react', 'react-day-picker', 'react-icons', 'react-resizable-panels', 'tailwindcss-animate', 'vaul']],
  ['apps/admin-client/package.json', 'devDependencies', ['@types/canvas-confetti', '@types/node', 'vitest']],
];

for (const [manifestPath, section, packages] of ownership) {
  const manifest = readJson(manifestPath);
  const missing = packages.filter((name) => !hasDependency(manifest, section, name));
  checks.push({
    label: `${manifest.name} owns ${section}`,
    passed: missing.length === 0,
    detail: missing.length === 0 ? `${packages.length} packages accounted for.` : `Missing: ${missing.join(', ')}`,
  });
}

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? '- [x]' : '- [ ]'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Dependency ownership audit passed.');
}
