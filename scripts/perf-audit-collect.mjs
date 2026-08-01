#!/usr/bin/env node
/**
 * Performance Audit — Automated Evidence Collection
 *
 * Gathers quantifiable performance metrics before the human grill-me interview.
 * Run this first to produce a JSON evidence bundle, then feed the gaps into
 * the grill-me checklist (references/grill-me-checklist.md).
 *
 * Usage:
 *   node scripts/perf-audit-collect.mjs --changed-files=src/pages/foo.tsx,src/components/Bar.tsx
 *   node scripts/perf-audit-collect.mjs --all  (scan all mini-program sources)
 *
 * Output: JSON evidence bundle to stdout
 *   { packageSizes: { mainPackageZip: ..., ... }, antiPatterns: [...], subpackageAudit: {...} }
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MP_SRC = path.join(ROOT, 'apps', 'mini-program', 'src');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { changedFiles: [], scanAll: false };
  for (const arg of args) {
    if (arg === '--all') opts.scanAll = true;
    if (arg.startsWith('--changed-files=')) {
      opts.changedFiles = arg.split('=')[1].split(',').filter(Boolean);
    }
  }
  if (!opts.scanAll && opts.changedFiles.length === 0) {
    // Default: try git diff to detect changed files
    try {
      const diff = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
      opts.changedFiles = diff.trim().split('\n').filter(f => f.startsWith('apps/mini-program/src/'));
    } catch {
      // Not a git repo or no diff — empty set
    }
  }
  return opts;
}

// ── Anti-pattern detectors ───────────────────────────────────────

function detectUncappedCanvasDPR(content, filePath) {
  const issues = [];
  // Canvas getContext without DPR cap
  if (/createCanvasContext|createOffscreenCanvas|Taro\.createCanvasContext/.test(content)) {
    if (!/pixelRatio\s*[<>]=?\s*3/.test(content) &&
        !/Math\.min\(.*pixelRatio/.test(content) &&
        !/dpr.*[<>]=?\s*3/.test(content)) {
      issues.push({ file: filePath, pattern: 'uncapped-canvas-dpr',
        detail: 'Canvas usage without pixelRatio cap at 3×. Risk: memory kill on high-DPR devices.' });
    }
  }
  return issues;
}

function detectMissingReducedMotion(content, filePath) {
  const issues = [];
  const hasAnimation = /animation|transition|requestAnimationFrame|Animated|motion/.test(content);
  const hasMotionCheck = /prefers-reduced-motion|reduceMotion|reducedMotion|REDUCED_MOTION/.test(content);
  if (hasAnimation && !hasMotionCheck) {
    issues.push({ file: filePath, pattern: 'missing-reduced-motion-check',
      detail: 'Animation/transition detected but no prefers-reduced-motion gating. Risk: forced animation on users who need reduced motion.' });
  }
  return issues;
}

function detectFilterBlurWithoutGate(content, filePath) {
  const issues = [];
  if (/filter:\s*blur\(/.test(content)) {
    if (!/prefers-reduced-motion|@media.*prefers-reduced-motion/.test(content)) {
      issues.push({ file: filePath, pattern: 'filter-blur-without-motion-gate',
        detail: 'filter: blur() used without @media (prefers-reduced-motion: reduce) fallback. Known to cause jank on MediaTek GPUs (vivo, OPPO).' });
    }
  }
  return issues;
}

function detectNonCompositedAnimation(content, filePath) {
  const issues = [];
  // Detect animated properties that aren't transform or opacity
  // Matches patterns like "animation: ... width", "transition: height", animated "left", "top", etc.
  const nonCompositedProps = /\b(width|height|left|right|top|bottom|margin|padding|border)\s*:/g;
  const inAnimationBlock = false;
  // Simple heuristic: if file has non-composited CSS props AND has animation/transition
  if (/animation|transition/.test(content)) {
    // Check for common offenders in style objects or inline styles
    if (/\banimation.*\b(width|height|left|right|top|bottom|margin|padding)\b/.test(content) ||
        /\btransition.*\b(width|height|left|right|top|bottom|margin|padding)\b/.test(content)) {
      issues.push({ file: filePath, pattern: 'non-composited-animation-prop',
        detail: 'Animation/transition targeting width/height/left/top instead of transform/opacity. Causes layout recalculation.' });
    }
  }
  return issues;
}

function detectListWithoutVirtualList(content, filePath) {
  const issues = [];
  // If a file maps/renders list items AND doesn't use VirtualList
  const hasListRendering = /\.map\s*\(.*=>|\.flatMap\s*\(/.test(content);
  const hasVirtualList = /VirtualList|virtualList/.test(content);
  if (hasListRendering && !hasVirtualList) {
    // Heuristic: check for fixed-length arrays (≤30 items = probably OK)
    // Don't flag files with obvious pagination
    if (!/\.slice\(0,\s*\d+\)/.test(content) && !/pageSize|PAGE_SIZE/.test(content)) {
      // Only flag if the file seems to be a page with a scrollable list
      if (/ScrollView|scroll-view|onScroll/.test(content) && !/getBoundingClientRect|intersectionObserver/.test(content)) {
        issues.push({ file: filePath, pattern: 'list-missing-virtual-list',
          detail: 'ScrollView with .map() rendering but no VirtualList detected. If list can exceed 50 items, use VirtualList.' });
      }
    }
  }
  return issues;
}

function detectMissingLazyImport(content, filePath) {
  const issues = [];
  // Only flag page-level files in main package, not components or subpackage pages.
  // Keep in sync with MINI_PROGRAM_SUBPACKAGES in apps/mini-program/src/lib/onboarding/onboardingRoutes.ts
  const isPageFile = /\/pages\//.test(filePath) && /index\.(tsx|ts)$/.test(filePath);
  const isSubpackagePage = /pages\/(onboarding|icebreaker-session|matching-status|pool-registration|profile-linked)\//.test(filePath);
  const isTabBarPage = /pages\/(index|discover|events|connections|center-hub|profile)\/index\.(tsx|ts)$/.test(filePath);

  if (isPageFile && !isSubpackagePage && !isTabBarPage) {
    // Page in main package that isn't tab bar — should be lazy-loaded or subpackaged
    if (!/React\.lazy|lazy\(/.test(content)) {
      issues.push({ file: filePath, pattern: 'page-check-lazy',
        detail: 'Page in main package but not a tab bar page and not in a subpackage. Consider React.lazy() or subpackaging.' });
    }
  }
  return issues;
}

function detectMissingCleanup(content, filePath) {
  const issues = [];
  const hasListener = /\.addEventListener\(|Taro\.on\w+\(|wx\.on\w+\(|setInterval\(|setTimeout\(/.test(content);
  const hasCleanup = /\.removeEventListener\(|Taro\.off\w+\(|clearInterval\(|clearTimeout\(|useUnload|onUnload/.test(content);
  if (hasListener && !hasCleanup) {
    issues.push({ file: filePath, pattern: 'missing-cleanup',
      detail: 'Event listener, timer, or observer registered without corresponding cleanup. Risk: memory leak.' });
  }
  return issues;
}

function detectHardcodedPxInStyles(content, filePath) {
  const issues = [];
  // Check for px values in style/SCSS files (rpx should be used instead)
  if (/\.(scss|css|wxss)$/.test(filePath)) {
    // Match px values that aren't 0px, 1px borders, or font-size adjustments
    const pxMatches = content.match(/(\d+)px/g);
    if (pxMatches) {
      const significantPx = pxMatches.filter(m => {
        const val = parseInt(m);
        return val > 4 && val !== 1; // Allow 1px borders, ignore tiny values
      });
      if (significantPx.length >= 3) {
        issues.push({ file: filePath, pattern: 'hardcoded-px-instead-of-rpx',
          detail: `${significantPx.length} hardcoded px values found. Use rpx for cross-density scaling. Examples: ${significantPx.slice(0, 3).join(', ')}` });
      }
    }
  }
  return issues;
}

// ── Poll lifecycle detector (2026-08-01, P0) ─────────────────────
// Every refetchInterval in mini-program source must be visibility-gated
// (isPageVisible / isAppVisible). WeChat has no document.hidden, so
// TanStack Query's refetchInterval auto-pause never fires — an un-gated
// interval keeps polling while the page/app is hidden (battery + heat).
// Pre-existing un-gated polls live in KNOWN_UN_GATED_POLLS as a ratchet:
// the gate fails only on NEW un-gated intervals, never on the baseline.
const KNOWN_UN_GATED_POLLS = new Set([
  // Functional-form poll on squad-unboxing controller (pre-existing,
  // separate surface, deferred to a later sprint).
  'src/pages/squad-unboxing/useSquadUnboxingController.ts:249',
  // Functional-form poll on profile-linked personal-story (pre-existing,
  // parallel-session-owned surface, deferred).
  'src/pages/profile-linked/personal-story/index.tsx:55',
]);

function detectUnGatedPolling(content, filePath) {
  const issues = [];
  if (!/\.(ts|tsx)$/.test(filePath)) return issues;
  const rel = filePath.replace(/^apps\/mini-program\//, '');
  const intervalRegex = /refetchInterval\s*:/g;
  let m;
  while ((m = intervalRegex.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length;
    const after = content.slice(m.index, m.index + 200);
    if (/\b(isPageVisible|isAppVisible)\b/.test(after)) continue;
    if (KNOWN_UN_GATED_POLLS.has(`${rel}:${line}`)) continue;
    issues.push({
      file: filePath,
      pattern: 'un-gated-refetch-interval',
      detail: `refetchInterval at line ${line} is not gated on page/app visibility. WeChat has no document.hidden — the poll keeps running while the surface is hidden (battery/heat). Gate with \`isPageVisible ? <ms> : false\` (or \`isAppVisible\` for app-level hooks).`,
    });
  }
  return issues;
}

const DETECTORS = [
  detectUncappedCanvasDPR,
  detectMissingReducedMotion,
  detectFilterBlurWithoutGate,
  detectNonCompositedAnimation,
  detectListWithoutVirtualList,
  detectMissingLazyImport,
  detectMissingCleanup,
  detectHardcodedPxInStyles,
  detectUnGatedPolling,
];

// ── Subpackage audit ─────────────────────────────────────────────

function auditSubpackagePlacement(changedFiles) {
  try {
    const onboardingRoutes = path.join(MP_SRC, 'lib', 'onboarding', 'onboardingRoutes.ts');
    const content = fs.readFileSync(onboardingRoutes, 'utf8');

    // Extract subpackage roots — handles both inline strings and constants
    const constantMap = {};
    const constRegex = /(MINI_PROGRAM_\w+_SUBPACKAGE_ROOT)\s*=\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = constRegex.exec(content)) !== null) {
      constantMap[m[1]] = m[2];
    }
    const rootRegex = /root:\s*(?:MINI_PROGRAM_\w+_SUBPACKAGE_ROOT|['"]([^'"]+)['"])/g;
    const subpackageRoots = [];
    while ((m = rootRegex.exec(content)) !== null) {
      subpackageRoots.push(m[1] || constantMap[m[0].match(/MINI_PROGRAM_\w+_SUBPACKAGE_ROOT/)[0]]);
    }

    // Also try direct string roots for robustness
    const directRootRegex = /root:\s*['"]([^'"]+)['"]/g;
    while ((m = directRootRegex.exec(content)) !== null) {
      if (!subpackageRoots.includes(m[1])) subpackageRoots.push(m[1]);
    }

    const tabBarPages = ['pages/index/index', 'pages/discover/index', 'pages/events/index',
                         'pages/connections/index', 'pages/center-hub/index', 'pages/profile/index'];

    const findings = [];
    for (const f of changedFiles) {
      // Only audit .tsx/.ts page files (not scss, tests, configs)
      if (!/\.(tsx|ts)$/.test(f) || /\.test\./.test(f) || /\.config\./.test(f)) continue;

      const rel = f.replace(/^apps\/mini-program\/src\//, '').replace(/\.(tsx?)$/, '');
      const isTabBar = tabBarPages.some(t => rel.startsWith(t));
      const isInSubpackage = subpackageRoots.some(r => rel.startsWith(r + '/'));

      if (isTabBar && rel.endsWith('/index')) continue; // Tab bar page — must be main

      if (!isInSubpackage && !isTabBar && rel.includes('pages/')) {
        findings.push({
          file: f,
          pattern: 'new-page-in-main-package',
          detail: `New page "${rel}" is in main package but not a tab bar page. Consider subpackaging.`,
        });
      }
    }

    // Check preload rules — search both routes file and app.config.ts
    const appConfig = fs.readFileSync(path.join(MP_SRC, 'app.config.ts'), 'utf8');
    const hasPreload = /preloadRule|PRELOAD_RULES/.test(content) || /preloadRule/.test(appConfig);
    if (!hasPreload) {
      findings.push({
        pattern: 'no-preload-rules',
        detail: 'No preloadRule configured. Critical onboarding subpackage lacks predictive preloading.',
      });
    }

    const hasLazyCode = /lazyCodeLoading/.test(appConfig);
    if (!hasLazyCode) {
      findings.push({
        pattern: 'lazy-code-loading-off',
        detail: 'lazyCodeLoading: "requiredComponents" not active in app.config.ts.',
      });
    }

    return findings;
  } catch (e) {
    return [{ pattern: 'subpackage-audit-failed', detail: e.message }];
  }
}

// ── Package size ─────────────────────────────────────────────────

function collectPackageSizes() {
  const result = { success: false, mainPackageZip: 0, mainPackageRaw: 0, onboardingSubpkg: 0, total: 0 };
  try {
    const output = execSync('npm run check:package-size -w mini-program 2>&1', {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 30000,
    });
    // Parse the output
    const mainZipMatch = output.match(/Main package \(zip\):\s+([\d.]+)\s*(KiB|MB|B)/);
    const mainRawMatch = output.match(/Main package \(raw\):\s+([\d.]+)\s*(KiB|MB|B)/);
    const subMatch = output.match(/Onboarding subpkg:\s+([\d.]+)\s*(KiB|MB|B)/);
    const totalMatch = output.match(/Total \(zip\):\s+([\d.]+)\s*(KiB|MB|B)/);
    const passed = output.includes('PASS:') || output.includes('Package size check OK');

    const parseSize = (m) => {
      if (!m) return 0;
      const val = parseFloat(m[1]);
      const unit = m[2];
      if (unit === 'MB') return val * 1024 * 1024;
      if (unit === 'KiB') return val * 1024;
      return val;
    };

    result.mainPackageZip = parseSize(mainZipMatch);
    result.mainPackageRaw = parseSize(mainRawMatch);
    result.onboardingSubpkg = parseSize(subMatch);
    result.total = parseSize(totalMatch);
    result.success = true;
    result.passed = passed;
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  let filesToScan = opts.changedFiles;
  if (opts.scanAll) {
    // Recursively find all TS/TSX/SCSS files in mini-program src
    function findFiles(dir) {
      let results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results = results.concat(findFiles(full));
        } else if (/\.(tsx?|scss|css)$/.test(entry.name)) {
          results.push(full);
        }
      }
      return results;
    }
    filesToScan = findFiles(MP_SRC);
  }

  // Normalize to absolute paths
  const resolvedFiles = filesToScan
    .map(f => (f.startsWith('/') ? f : path.join(ROOT, f)))
    .filter(f => fs.existsSync(f));

  // Run all detectors
  const antiPatterns = [];
  for (const file of resolvedFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(ROOT, file);
      for (const detector of DETECTORS) {
        antiPatterns.push(...detector(content, relPath));
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Subpackage audit (only for changed files mode)
  const subpackageAudit = opts.changedFiles.length > 0
    ? auditSubpackagePlacement(filesToScan)
    : [];

  // Package sizes
  const packageSizes = collectPackageSizes();

  const evidence = {
    scannedFiles: resolvedFiles.length,
    packageSizes,
    antiPatterns,
    subpackageAudit,
    dimensionsAutoScored: {
      packageSize: antiPatterns.filter(p =>
        ['new-page-in-main-package', 'no-preload-rules', 'lazy-code-loading-off'].includes(p.pattern)
      ).length === 0 && packageSizes.success && packageSizes.passed ? 7 : null,
      memorySafety: antiPatterns.filter(p =>
        ['uncapped-canvas-dpr', 'missing-cleanup'].includes(p.pattern)
      ).length === 0 ? 7 : null,
      deviceAdaptability: antiPatterns.filter(p =>
        ['missing-reduced-motion-check', 'filter-blur-without-motion-gate', 'hardcoded-px-instead-of-rpx'].includes(p.pattern)
      ).length === 0 ? 7 : null,
      smoothness: antiPatterns.filter(p =>
        ['non-composited-animation-prop', 'list-missing-virtual-list'].includes(p.pattern)
      ).length === 0 ? 7 : null,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(evidence, null, 2));
}

main();
