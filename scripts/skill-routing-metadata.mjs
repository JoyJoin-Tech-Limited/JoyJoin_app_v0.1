import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');
export const SKILLS_DIR = join(REPO_ROOT, '.github', 'skills');
export const ROUTING_REQUIRED_FIELDS = ['skill', 'primary_ownership', 'use_when', 'strong_triggers'];
const LEGACY_ARCHETYPE_TERMS = ['火花塞', '探索者', '故事家'];
const LEGACY_ARCHETYPE_PATTERN = new RegExp(
  [
    String.raw`\b14[- ]archetype\s*(?:v1|v2)\b`,
    String.raw`\b(?:v1|v2)\s*14[- ]archetype\b`,
    ...LEGACY_ARCHETYPE_TERMS,
  ].join('|'),
  'i',
);
export const LEGACY_SENTINELS = [
  { pattern: /\/guide\b/i, label: '/guide (deprecated onboarding step)' },
  { pattern: /\bshared\/(?!src)/i, label: 'shared/ root import' },
  { pattern: /\b(hasCompletedRegistration|needsRegistration|registration_sessions|interestsTop)\b/i, label: 'legacy onboarding identifier' },
  { pattern: /\/chats\b/i, label: '/chats surface (replaced by /connections)' },
  { pattern: LEGACY_ARCHETYPE_PATTERN, label: '14-archetype V1/V2 system (replaced by 12-archetype V4)' },
];

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function parseScalar(value) {
  return stripQuotes(value.trim());
}

function parseNestedObject(firstItemValue, lines, startIndex) {
  const object = {};
  const inline = firstItemValue.trim();
  if (inline) {
    const inlineMatch = /^([a-z_]+):\s*(.*)$/.exec(inline);
    if (inlineMatch) {
      object[inlineMatch[1]] = parseScalar(inlineMatch[2]);
    }
  }

  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i += 1;
      continue;
    }
    if (!/^\s{4}[a-z_]+:/.test(line)) {
      break;
    }
    const match = /^\s{4}([a-z_]+):\s*(.*)$/.exec(line);
    if (match) {
      object[match[1]] = parseScalar(match[2]);
    }
    i += 1;
  }

  return { value: object, nextIndex: i };
}

/**
 * Parse the limited YAML subset used by `.github/skills/<skill>/routing.yml`.
 * Supports flat scalars, folded/literal block scalars (`>` / `|`), scalar lists,
 * and lists of flat objects (used by `related_skills`).
 *
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
export function parseRoutingYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      i += 1;
      continue;
    }

    const keyMatch = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!keyMatch) {
      i += 1;
      continue;
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();

    if (rawValue === '>' || rawValue === '|') {
      const parts = [];
      i += 1;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine.trim()) {
          i += 1;
          continue;
        }
        if (/^\S/.test(nextLine)) break;
        parts.push(nextLine.trim());
        i += 1;
      }
      result[key] = rawValue === '>' ? parts.join(' ').trim() : parts.join('\n').trim();
      continue;
    }

    if (rawValue === '') {
      const values = [];
      i += 1;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (!nextTrimmed || nextTrimmed.startsWith('#')) {
          i += 1;
          continue;
        }
        if (/^\S/.test(nextLine)) break;

        const itemMatch = /^\s{2}-\s*(.*)$/.exec(nextLine);
        if (!itemMatch) {
          i += 1;
          continue;
        }

        const itemValue = itemMatch[1];
        if (/^[a-z_]+:/.test(itemValue)) {
          const parsed = parseNestedObject(itemValue, lines, i + 1);
          values.push(parsed.value);
          i = parsed.nextIndex;
          continue;
        }

        values.push(parseScalar(itemValue));
        i += 1;
      }
      result[key] = values;
      continue;
    }

    result[key] = parseScalar(rawValue);
    i += 1;
  }

  return result;
}

/**
 * Load all routing metadata files currently present under `.github/skills/`.
 *
 * @returns {Array<Record<string, unknown>>}
 */
export function loadSkillDefinitions() {
  return readdirSync(SKILLS_DIR)
    .filter(name => statSync(join(SKILLS_DIR, name)).isDirectory())
    .map(name => ({ name, path: join(SKILLS_DIR, name, 'routing.yml') }))
    .filter(entry => existsSync(entry.path))
    .map(entry => {
      const parsed = parseRoutingYaml(readFileSync(entry.path, 'utf8'));
      return {
        skill: parsed.skill,
        primary_ownership: parsed.primary_ownership ?? '',
        use_when: Array.isArray(parsed.use_when) ? parsed.use_when : [],
        do_not_use_when: Array.isArray(parsed.do_not_use_when) ? parsed.do_not_use_when : [],
        strong_triggers: Array.isArray(parsed.strong_triggers) ? parsed.strong_triggers : [],
        owned_files: Array.isArray(parsed.owned_files) ? parsed.owned_files : [],
        owned_paths: Array.isArray(parsed.owned_paths) ? parsed.owned_paths : [],
        owned_symbols: Array.isArray(parsed.owned_symbols) ? parsed.owned_symbols : [],
        related_skills: Array.isArray(parsed.related_skills) ? parsed.related_skills : [],
      };
    })
    .sort((a, b) => String(a.skill).localeCompare(String(b.skill)));
}
