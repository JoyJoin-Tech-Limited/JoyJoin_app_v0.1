#!/usr/bin/env node
/**
 * Render-blocking third-party resource ratchet.
 *
 * Why (2026-11-17): apps/admin-client/index.html carried
 * `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` in <head>.
 * In mainland China fonts.googleapis.com is unreachable — TCP connects, TLS is reset —
 * and the browser only aborts the request after 30-42s. A stylesheet in <head> blocks
 * first paint for that entire window, so `#root` stayed empty and the admin portal was
 * a silent white screen (staging.admin.joyjoinapp.com + admin.joyjoinapp.com).
 *
 * The bug was not "Google Fonts is bad", it was "an external resource was allowed to
 * gate first paint with nobody checking". This gate makes that class un-repeatable:
 *
 *   - external (http/https) <link rel="stylesheet"> MUST be non-blocking — one of
 *     `media="print"`, `disabled`, or an `onload` that flips it back on.
 *   - external <script src> MUST be `async`, `defer`, or `type="module"`, all of which
 *     release the parser and the first paint.
 *   - everything same-origin is exempt: it ships with the app and cannot hang on a
 *     foreign network.
 *
 * HTML comments are stripped before scanning (line numbers are preserved), so prose
 * that quotes the offending markup — including the explanatory comment we left in
 * index.html — never trips the gate.
 *
 * `findRenderBlockingExternals` is exported and reused by the synthetic probe
 * (scripts/synthetic/happy-path-probe.mjs) so the live check and the CI gate cannot
 * drift apart.
 *
 * Scope: `apps/<workspace>/index.html`. No baseline: the repo is clean today, so any
 * hit is a new regression.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const APPS_DIR = join(ROOT, 'apps');

const TAG = /<(link|script)\b[^>]*>/gi;

function attr(name, tag) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? '';
}

/** Replace HTML comment bodies with spaces, preserving newlines so line numbers survive. */
export function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function isExternal(url) {
  return /^https?:\/\//i.test(url.trim());
}

function classify(tag, kind) {
  const href = kind === 'link' ? attr('href', tag) : attr('src', tag);
  if (!href || !isExternal(href)) return null;

  if (kind === 'link') {
    const rel = (attr('rel', tag) ?? '').toLowerCase();
    if (!rel.split(/\s+/).includes('stylesheet')) return null;

    const media = (attr('media', tag) ?? '').toLowerCase();
    const nonBlocking = media === 'print' || attr('disabled', tag) !== null || /onload\s*=\s*/i.test(tag);
    if (nonBlocking) return null;
    return `external stylesheet blocks first paint: ${href} — add media="print" + onload="this.media='all'", or self-host the asset`;
  }

  const type = (attr('type', tag) ?? '').toLowerCase();
  const nonBlockingScript =
    attr('async', tag) !== null ||
    attr('defer', tag) !== null ||
    type === 'module' ||
    ['async', 'defer', 'module'].some((flag) => tag.toLowerCase().includes(` ${flag} `));
  if (nonBlockingScript) return null;
  return `external script blocks parsing: ${href} — add async/defer, or bundle it with the app`;
}

/**
 * @param {string} html raw HTML document
 * @returns {{ line: number; message: string }[]} 1-based line numbers of every offence
 */
export function findRenderBlockingExternals(html) {
  const source = stripHtmlComments(html);
  const found = [];

  for (const match of source.matchAll(TAG)) {
    const tag = match[0];
    const message = classify(tag, match[1].toLowerCase());
    if (!message) continue;
    found.push({ line: lineOf(source, match.index ?? 0), message });
  }

  return found;
}

function htmlEntries() {
  const out = [];
  let entries;
  try {
    entries = readdirSync(APPS_DIR);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules') continue;
    const candidate = join(APPS_DIR, name, 'index.html');
    try {
      if (statSync(candidate).isFile()) out.push(candidate);
    } catch {
      // no HTML entry in this workspace
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = [];

  for (const file of htmlEntries()) {
    for (const hit of findRenderBlockingExternals(readFileSync(file, 'utf8'))) {
      violations.push(`${relative(ROOT, file)}:${hit.line}  ${hit.message}`);
    }
  }

  if (violations.length > 0) {
    console.error('✗ Render-blocking external resources found:');
    for (const violation of violations) console.error(`  - ${violation}`);
    console.error(
      '\nAn unreachable third-party host must never be able to hold first paint.\n' +
        'See scripts/check/check-render-blocking-externals.mjs for the 2026-11-17 incident.',
    );
    process.exit(1);
  }

  console.log('✓ No render-blocking external resources in app HTML entries.');
}
