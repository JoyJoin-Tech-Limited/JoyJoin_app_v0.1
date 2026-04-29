#!/usr/bin/env node
/**
 * Lightweight design audit scanner for JoyJoin frontend surfaces.
 * Inspired by impeccable's `npx impeccable detect` and taste-skill's anti-pattern checklist.
 *
 * Usage:
 *   node scripts/design-audit.mjs <path>              # Audit a directory
 *   node scripts/design-audit.mjs apps/mini-program/src/pages/discover
 *   node scripts/design-audit.mjs apps/mini-program/src/pages
 *   node scripts/design-audit.mjs apps/user-client/src/pages
 *
 * This is a heuristic scanner — it catches obvious violations but cannot judge
 * hierarchy, emotional resonance, or copy quality. For those, use agent-mode
 * with the `frontend-design-audit` skill.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const TARGET_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".scss", ".css", ".less"]);

// Anti-pattern rules: [regex, message, severity]
const RULES = [
  // Color anti-patterns
  [/#000000\b|#000\b(?!\d)/, "Pure black (#000) — use off-black or tinted dark", "warn"],
  [/#ffffff\b|#fff\b(?!\d)/, "Pure white (#fff) — use tinted neutral or warm cream", "warn"],
  [/background:\s*linear-gradient.*purple.*blue/i, "Purple-blue AI gradient aesthetic — use JoyJoin brand palette", "error"],
  [/backgroundImage.*purple.*blue/i, "Purple-blue AI gradient aesthetic — use JoyJoin brand palette", "error"],
  [/style=\{\{\s*color:\s*['"]?#[0-9a-f]{3,6}/i, "Hard-coded color in inline style — use CSS custom property", "warn"],
  [/color:\s*['"]?gray['"]?/i, "Generic 'gray' color — use token or specific neutral", "warn"],

  // Typography anti-patterns
  [/fontFamily:\s*['"]Inter['"]/i, "Inter font — use JoyJoin semantic font tokens", "warn"],
  [/font-family:\s*Inter/i, "Inter font — use JoyJoin semantic font tokens", "warn"],
  [/fontFamily:\s*['"]Arial['"]/i, "Arial font — use JoyJoin semantic font tokens", "warn"],
  [/font-family:\s*Arial/i, "Arial font — use JoyJoin semantic font tokens", "warn"],

  // Layout anti-patterns
  [/height:\s*100vh/i, "height: 100vh — use min-height: 100dvh or viewport-zero-scroll pattern", "error"],
  [/(?<![a-zA-Z-])h-screen(?![a-zA-Z-])/, "h-screen — use min-h-[100dvh] or viewport-zero-scroll pattern", "error"],
  [/className=.*grid.*grid-cols-3.*gap/i, "Generic 3-column card grid — consider asymmetric layout", "warn"],
  [/className=.*flex.*justify-center.*items-center.*w-full/i, "Everything centered — consider asymmetric or intentional alignment", "info"],

  // Mini-program specific
  [/dangerouslySetInnerHTML/, "dangerouslySetInnerHTML — use RichText or structured nodes", "error"],
  [/localStorage\./, "localStorage — use Taro storage API", "error"],
  [/window\./, "window API — use Taro equivalent", "warn"],
  [/addEventListener\('scroll'/, "window scroll listener — use ScrollView onScroll or IntersectionObserver", "warn"],
  [/(?<!r)px\s*['"]?\d+['"]?/i, "px unit — use rpx for responsive sizing", "warn"],

  // Motion anti-patterns
  [/transition:\s*all/i, "transition: all — be specific about which properties", "info"],
  [/cubic-bezier.*bounce/i, "Bounce easing — use exponential ease-out curves", "warn"],
  [/cubic-bezier.*elastic/i, "Elastic easing — use exponential ease-out curves", "warn"],
  [/animate-\[.*bounce/i, "Bounce animation — use exponential ease-out curves", "warn"],

  // Content anti-patterns
  [/['"]John Doe['"]/i, "Generic name 'John Doe' — use realistic, diverse names", "warn"],
  [/['"]Jane Doe['"]/i, "Generic name 'Jane Doe' — use realistic, diverse names", "warn"],
  [/['"]张三['"]/, "Generic name '张三' — use realistic, diverse names", "warn"],
  [/['"]李四['"]/, "Generic name '李四' — use realistic, diverse names", "warn"],
  [/99\.99%/, "Fake round number 99.99% — use organic data", "info"],
  [/'"\d]\s*50%\s*['"]/, "Round number 50% — verify this is real data, not placeholder", "info"],
  [/Lorem ipsum/i, "Lorem Ipsum placeholder — write real draft copy", "error"],
  [/(?<![a-zA-Z-])(Elevate|Seamless|Unleash|Next-Gen|Game-changer)(?![a-zA-Z-])/i, "AI copywriting cliché — write plain, specific language", "warn"],

  // Missing state hints
  [/if\s*\(\s*loading\s*\)/i, null, null], // Skip — loading state exists
];

function* walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build" || entry.name === "legacy") continue;
      yield* walkDir(fullPath);
    } else if (entry.isFile() && TARGET_EXTS.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}

function auditFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const findings = [];
  const isMiniProgram = filePath.includes('/mini-program/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('design-audit:intentional')) continue;
    if (i > 0 && lines[i - 1].includes('design-audit:intentional')) continue;
    for (const [regex, message, severity] of RULES) {
      if (!message) continue; // Skip placeholder rules
      // Skip mini-program-specific rules for web surfaces
      if (!isMiniProgram && (
        message.includes('Taro storage API') ||
        message.includes('Taro equivalent') ||
        message.includes('RichText') ||
        message.includes('rpx for responsive')
      )) continue;
      // Skip card-grid warnings for admin (product register: grids are legitimate for data dashboards)
      if (filePath.includes('/admin-client/') && message.includes('Generic 3-column card grid')) continue;
      // Skip card-grid warnings for user-client dev sandbox
      if (filePath.includes('/user-client/') && message.includes('Generic 3-column card grid')) continue;
      if (regex.test(line)) {
        findings.push({
          line: i + 1,
          severity,
          message,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  }

  return findings;
}

function auditPath(targetPath, label) {
  console.log(`🔍 Design Audit: ${label || targetPath}\n`);

  const stats = { error: 0, warn: 0, info: 0 };
  let fileCount = 0;
  let filesWithIssues = 0;

  for (const filePath of walkDir(targetPath)) {
    fileCount++;
    const findings = auditFile(filePath);
    if (findings.length === 0) continue;

    filesWithIssues++;
    console.log(`\n📄 ${filePath}`);
    for (const f of findings) {
      stats[f.severity]++;
      const icon = f.severity === "error" ? "❌" : f.severity === "warn" ? "⚠️" : "ℹ️";
      console.log(`  ${icon} Line ${f.line}: ${f.message}`);
      console.log(`     → ${f.snippet}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Summary: ${label || targetPath}`);
  console.log(`   Files scanned: ${fileCount}`);
  console.log(`   Files with issues: ${filesWithIssues}`);
  console.log(`   Errors: ${stats.error} | Warnings: ${stats.warn} | Info: ${stats.info}`);

  if (stats.error > 0) {
    console.log(`\n❌ Rating: Needs work (${stats.error} errors to fix)`);
  } else if (stats.warn > 0) {
    console.log(`\n⚠️ Rating: Good with warnings (${stats.warn} warnings to consider)`);
  } else {
    console.log(`\n✅ Rating: Clean (no issues detected by heuristic scan)`);
  }

  return stats;
}

function main() {
  const targetPath = process.argv[2];

  // Single path mode
  if (targetPath) {
    const stats = auditPath(targetPath);
    process.exit(stats.error > 0 ? 1 : 0);
  }

  // Default mode: audit all frontend surfaces
  console.log(`🔍 JoyJoin Design Audit — All Frontend Surfaces\n`);
  console.log(`Usage: node scripts/design-audit.mjs <path>  (audit single path)`);
  console.log(`       node scripts/design-audit.mjs          (audit all surfaces)\n`);

  const surfaces = [
    { path: 'apps/mini-program/src/pages', label: 'Mini-Program (launch-primary)' },
    { path: 'apps/user-client/src/pages', label: 'User Client (web sandbox)' },
    { path: 'apps/admin-client/src', label: 'Admin Client' },
  ];

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfo = 0;

  for (const surface of surfaces) {
    const stats = auditPath(surface.path, surface.label);
    totalErrors += stats.error;
    totalWarnings += stats.warn;
    totalInfo += stats.info;
    console.log('\n' + '-'.repeat(50) + '\n');
  }

  console.log(`${'='.repeat(50)}`);
  console.log(`📊 GRAND TOTAL`);
  console.log(`   Errors: ${totalErrors} | Warnings: ${totalWarnings} | Info: ${totalInfo}`);

  if (totalErrors > 0) {
    console.log(`\n❌ FAIL: ${totalErrors} design error(s) across all surfaces`);
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`\n⚠️ PASS with warnings: ${totalWarnings} warning(s) to consider`);
    process.exit(0);
  } else {
    console.log(`\n✅ PASS: All surfaces clean`);
    console.log(`   Note: This scanner catches obvious patterns only.`);
    console.log(`   For hierarchy, emotional resonance, and copy quality,`);
    console.log(`   use agent-mode with the frontend-design-audit skill.`);
    process.exit(0);
  }
}

main();
