import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MEMORY_ROOT_RELATIVE_PATH = 'repo-memory';
export const PROMOTED_DIR_RELATIVE_PATH = path.posix.join(MEMORY_ROOT_RELATIVE_PATH, 'promoted');
export const CANDIDATE_DIR_RELATIVE_PATH = path.posix.join(MEMORY_ROOT_RELATIVE_PATH, 'candidates');
export const GENERATED_DIR_RELATIVE_PATH = path.posix.join(MEMORY_ROOT_RELATIVE_PATH, 'generated');
export const GENERATED_INDEX_RELATIVE_PATH = path.posix.join(GENERATED_DIR_RELATIVE_PATH, 'promoted-index.json');
export const DEFAULT_WORKFLOW_RELEVANT_PATH_PREFIXES = ['.github/', 'scripts/', 'repo-memory/'];
export const DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES = {
  minCharacters: 12,
  minTokens: 2,
  minLongTokens: 2,
  longTokenLength: 4,
};
export const DEFAULT_MEMORY_QUERY_LIMIT = 5;
export const DEFAULT_MEMORY_QUERY_MIN_SCORE = 1;

const REQUIRED_METADATA_FIELDS = [
  'id',
  'title',
  'status',
  'owner',
  'lastValidatedAt',
  'tags',
  'triggerTerms',
  'relatedPaths',
  'sources',
  'confidence',
];
const SERIALIZED_METADATA_FIELD_ORDER = [...REQUIRED_METADATA_FIELDS];

const ARRAY_METADATA_FIELDS = new Set(['tags', 'triggerTerms', 'relatedPaths', 'sources']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high']);
const ALLOWED_STATUSES_BY_SECTION = {
  promoted: new Set(['active', 'stale', 'archived']),
  candidate: new Set(['candidate']),
};

export function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

export function normalizeRepoRelativePath(value) {
  return toPosixPath(value).replace(/^\.\//, '').replace(/^\//, '');
}

export function resolveRepoPath(relativePath) {
  return path.join(REPO_ROOT, normalizeRepoRelativePath(relativePath));
}

export function resolveFilePath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new Error('Expected a non-empty file path.');
  }

  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(REPO_ROOT, inputPath);
}

export function tryGetRepoRelativePath(filePath) {
  const absolutePath = resolveFilePath(filePath);
  const relativePath = path.relative(REPO_ROOT, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return normalizeRepoRelativePath(relativePath);
}

export function isRepoPathWithin(relativePath, parentRelativePath) {
  const normalizedPath = normalizeRepoRelativePath(relativePath);
  const normalizedParent = `${normalizeRepoRelativePath(parentRelativePath).replace(/\/$/, '')}/`;

  return normalizedPath === normalizedParent.slice(0, -1) || normalizedPath.startsWith(normalizedParent);
}

function uniqueStrings(values) {
  return Array.from(
    new Set(values.filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim())),
  );
}

export function filterWorkflowRelevantPaths(
  paths,
  prefixes = DEFAULT_WORKFLOW_RELEVANT_PATH_PREFIXES,
) {
  const normalizedPrefixes = uniqueStrings(prefixes).map((prefix) => `${normalizeRepoRelativePath(prefix).replace(/\/$/, '')}/`);

  return uniqueStrings(paths.map((value) => normalizeRepoRelativePath(value))).filter((value) => {
    return normalizedPrefixes.some((prefix) => value.startsWith(prefix));
  });
}

function listMarkdownFilesRecursive(absoluteDirPath, relativeDirPath) {
  if (!fs.existsSync(absoluteDirPath)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absoluteEntryPath = path.join(absoluteDirPath, entry.name);
    const relativeEntryPath = path.posix.join(relativeDirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(absoluteEntryPath, relativeEntryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(relativeEntryPath);
    }
  }

  return files;
}

export function listMemoryNotePaths() {
  const promotedPaths = listMarkdownFilesRecursive(
    resolveRepoPath(PROMOTED_DIR_RELATIVE_PATH),
    PROMOTED_DIR_RELATIVE_PATH,
  ).map((relativePath) => ({ relativePath, section: 'promoted' }));

  const candidatePaths = listMarkdownFilesRecursive(
    resolveRepoPath(CANDIDATE_DIR_RELATIVE_PATH),
    CANDIDATE_DIR_RELATIVE_PATH,
  ).map((relativePath) => ({ relativePath, section: 'candidate' }));

  return [...promotedPaths, ...candidatePaths].sort((left, right) => {
    if (left.relativePath === right.relativePath) {
      return left.section.localeCompare(right.section);
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
}

function parseScalarValue(rawValue) {
  return rawValue.trim();
}

export function parseFrontmatter(content, relativePath) {
  const lines = content.split(/\r?\n/);
  const errors = [];

  if (lines[0] !== '---') {
    return {
      metadata: {},
      body: '',
      errors: [`${relativePath}: missing opening frontmatter delimiter`],
    };
  }

  const metadata = {};
  let lineIndex = 1;
  let foundClosingDelimiter = false;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line === '---') {
      foundClosingDelimiter = true;
      lineIndex += 1;
      break;
    }

    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!keyMatch) {
      errors.push(`${relativePath}: unsupported frontmatter line "${line}"`);
      lineIndex += 1;
      continue;
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();

    if (rawValue !== '') {
      metadata[key] = parseScalarValue(rawValue);
      lineIndex += 1;
      continue;
    }

    const items = [];
    lineIndex += 1;
    while (lineIndex < lines.length) {
      const itemLine = lines[lineIndex];

      if (itemLine === '---') {
        break;
      }

      if (!itemLine.trim()) {
        lineIndex += 1;
        continue;
      }

      const itemMatch = itemLine.match(/^\s*-\s+(.*)$/);
      if (!itemMatch) {
        break;
      }

      items.push(itemMatch[1].trim());
      lineIndex += 1;
    }

    metadata[key] = items;
  }

  if (!foundClosingDelimiter) {
    errors.push(`${relativePath}: missing closing frontmatter delimiter`);
  }

  const body = lines.slice(lineIndex).join('\n').trim();

  return {
    metadata,
    body,
    errors,
  };
}

function createMemoryNoteRecord({ section, relativePath, absolutePath, content }) {
  const parsed = parseFrontmatter(content, relativePath);

  return {
    section,
    relativePath,
    absolutePath,
    metadata: parsed.metadata,
    body: parsed.body,
    statements: extractStatements(parsed.body),
    parseErrors: parsed.errors,
  };
}

function extractStatements(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

export function loadMemoryNotes() {
  return listMemoryNotePaths().map(({ relativePath, section }) => {
    const absolutePath = resolveRepoPath(relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    return createMemoryNoteRecord({
      section,
      relativePath,
      absolutePath,
      content,
    });
  });
}

export function loadMemoryNoteFromFile(filePath, section = null) {
  const absolutePath = resolveFilePath(filePath);
  const repoRelativePath = tryGetRepoRelativePath(absolutePath);
  const relativePath = repoRelativePath ?? toPosixPath(absolutePath);
  const inferredSection = repoRelativePath
    ? isRepoPathWithin(repoRelativePath, PROMOTED_DIR_RELATIVE_PATH)
      ? 'promoted'
      : isRepoPathWithin(repoRelativePath, CANDIDATE_DIR_RELATIVE_PATH)
        ? 'candidate'
        : null
    : null;
  const content = fs.readFileSync(absolutePath, 'utf8');

  return createMemoryNoteRecord({
    section: section ?? inferredSection ?? 'candidate',
    relativePath,
    absolutePath,
    content,
  });
}

function serializeFrontmatterEntry(key, value) {
  if (Array.isArray(value)) {
    const normalizedValues = uniqueStrings(value.map((item) => String(item)));
    if (normalizedValues.length === 0) {
      return [];
    }

    return [
      `${key}:`,
      ...normalizedValues.map((item) => `  - ${item}`),
    ];
  }

  if (value === undefined || value === null || String(value).trim() === '') {
    return [];
  }

  return [`${key}: ${String(value).trim()}`];
}

export function serializeMemoryNote(note) {
  const metadata = note?.metadata ?? {};
  const knownKeys = SERIALIZED_METADATA_FIELD_ORDER.filter((key) => key in metadata);
  const extraKeys = Object.keys(metadata)
    .filter((key) => !SERIALIZED_METADATA_FIELD_ORDER.includes(key))
    .sort((left, right) => left.localeCompare(right));
  const frontmatterLines = ['---'];

  for (const key of [...knownKeys, ...extraKeys]) {
    frontmatterLines.push(...serializeFrontmatterEntry(key, metadata[key]));
  }

  frontmatterLines.push('---');

  const body = typeof note?.body === 'string' ? note.body.trim() : '';
  return `${frontmatterLines.join('\n')}\n${body ? `\n${body}\n` : '\n'}`;
}

export function writeMemoryNoteFile(targetPath, note) {
  const absoluteTargetPath = resolveFilePath(targetPath);
  fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  fs.writeFileSync(absoluteTargetPath, serializeMemoryNote(note), 'utf8');
  return absoluteTargetPath;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isIsoDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateRepoPathArray(relativePath, fieldName, values, errors) {
  for (const value of values) {
    const normalizedPath = normalizeRepoRelativePath(value);
    if (!fs.existsSync(resolveRepoPath(normalizedPath))) {
      errors.push(`${relativePath}: ${fieldName} path does not exist: ${value}`);
    }
  }
}

export function validateMemoryNotes(notes = loadMemoryNotes()) {
  const errors = [];
  const seenIds = new Map();

  for (const note of notes) {
    errors.push(...note.parseErrors);

    for (const fieldName of REQUIRED_METADATA_FIELDS) {
      if (!(fieldName in note.metadata)) {
        errors.push(`${note.relativePath}: missing required metadata field "${fieldName}"`);
      }
    }

    if (note.parseErrors.length > 0) {
      continue;
    }

    if (!isNonEmptyString(note.metadata.id)) {
      errors.push(`${note.relativePath}: id must be a non-empty string`);
    }

    if (!isNonEmptyString(note.metadata.title)) {
      errors.push(`${note.relativePath}: title must be a non-empty string`);
    }

    if (!isNonEmptyString(note.metadata.owner)) {
      errors.push(`${note.relativePath}: owner must be a non-empty string`);
    }

    if (!isNonEmptyString(note.metadata.status)) {
      errors.push(`${note.relativePath}: status must be a non-empty string`);
    } else if (!ALLOWED_STATUSES_BY_SECTION[note.section].has(note.metadata.status)) {
      errors.push(
        `${note.relativePath}: status "${note.metadata.status}" is not allowed for ${note.section} notes`,
      );
    }

    if (!isNonEmptyString(note.metadata.lastValidatedAt) || !isIsoDateOnly(note.metadata.lastValidatedAt)) {
      errors.push(`${note.relativePath}: lastValidatedAt must be a valid YYYY-MM-DD date`);
    }

    if (!isNonEmptyString(note.metadata.confidence) || !CONFIDENCE_VALUES.has(note.metadata.confidence)) {
      errors.push(`${note.relativePath}: confidence must be one of low, medium, or high`);
    }

    for (const fieldName of ARRAY_METADATA_FIELDS) {
      const normalizedValues = normalizeStringArray(note.metadata[fieldName]);
      if (!normalizedValues || normalizedValues.length === 0) {
        errors.push(`${note.relativePath}: ${fieldName} must be a non-empty array of strings`);
        continue;
      }

      note.metadata[fieldName] = Array.from(new Set(normalizedValues));
    }

    if (Array.isArray(note.metadata.relatedPaths)) {
      validateRepoPathArray(note.relativePath, 'relatedPaths', note.metadata.relatedPaths, errors);
    }

    if (Array.isArray(note.metadata.sources)) {
      validateRepoPathArray(note.relativePath, 'sources', note.metadata.sources, errors);
    }

    if (note.statements.length === 0) {
      errors.push(`${note.relativePath}: memory note body must contain at least one statement`);
    }

    if (isNonEmptyString(note.metadata.id)) {
      const previousPath = seenIds.get(note.metadata.id);
      if (previousPath) {
        errors.push(
          `${note.relativePath}: duplicate memory id "${note.metadata.id}" already used by ${previousPath}`,
        );
      } else {
        seenIds.set(note.metadata.id, note.relativePath);
      }
    }
  }

  return {
    notes,
    errors,
    promotedCount: notes.filter((note) => note.section === 'promoted').length,
    candidateCount: notes.filter((note) => note.section === 'candidate').length,
  };
}

export function ensureGeneratedDirectory() {
  fs.mkdirSync(resolveRepoPath(GENERATED_DIR_RELATIVE_PATH), { recursive: true });
}

export function writeGeneratedPromotedIndex(indexDocument, relativePath = GENERATED_INDEX_RELATIVE_PATH) {
  fs.mkdirSync(path.dirname(resolveRepoPath(relativePath)), { recursive: true });
  fs.writeFileSync(
    resolveRepoPath(relativePath),
    `${JSON.stringify(indexDocument, null, 2)}\n`,
    'utf8',
  );
}

export function readGeneratedPromotedIndex(relativePath = GENERATED_INDEX_RELATIVE_PATH) {
  const absolutePath = resolveRepoPath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing generated promoted index at ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

export function readGeneratedPromotedIndexSafe(relativePath = GENERATED_INDEX_RELATIVE_PATH) {
  try {
    const document = readGeneratedPromotedIndex(relativePath);
    return {
      available: true,
      path: relativePath,
      document,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: relativePath,
      document: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function tokenizeForSearch(value) {
  return Array.from(
    new Set(
      String(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 || /^\d+$/.test(token)),
    ),
  );
}

export function tokenizePathForSearch(value) {
  return tokenizeForSearch(String(value).replace(/[/._-]+/g, ' '));
}

function intersectTokens(leftTokens, rightTokens) {
  const rightTokenSet = new Set(rightTokens);
  return leftTokens.filter((token) => rightTokenSet.has(token));
}

function sortRankedMatches(matches, limit) {
  return matches
    .filter((match) => match.score > 0)
    .sort((left, right) => {
      if (left.score === right.score) {
        return left.id.localeCompare(right.id);
      }

      return right.score - left.score;
    })
    .slice(0, limit);
}

function scorePromotedNoteAgainstQuery(note, promptText, promptTokens) {
  const reasons = [];
  let score = 0;

  const normalizedTitle = note.title.toLowerCase();
  if (promptText.includes(normalizedTitle)) {
    score += 20;
    reasons.push(`title phrase matched: ${note.title}`);
  }

  const matchedTriggerPhrases = note.triggerTerms.filter((term) => promptText.includes(term.toLowerCase()));
  if (matchedTriggerPhrases.length > 0) {
    score += matchedTriggerPhrases.length * 12;
    reasons.push(`triggerTerms matched: ${matchedTriggerPhrases.join(', ')}`);
  }

  const titleTokenMatches = intersectTokens(promptTokens, tokenizeForSearch(note.title));
  if (titleTokenMatches.length > 0) {
    score += titleTokenMatches.length * 6;
    reasons.push(`title tokens matched: ${titleTokenMatches.join(', ')}`);
  }

  const tagTokenMatches = intersectTokens(promptTokens, tokenizePathForSearch(note.tags.join(' ')));
  if (tagTokenMatches.length > 0) {
    score += tagTokenMatches.length * 4;
    reasons.push(`tags matched: ${tagTokenMatches.join(', ')}`);
  }

  const relatedPathMatches = intersectTokens(
    promptTokens,
    tokenizePathForSearch([...note.relatedPaths, ...note.sources, note.path].join(' ')),
  );
  if (relatedPathMatches.length > 0) {
    score += relatedPathMatches.length * 3;
    reasons.push(`paths matched: ${relatedPathMatches.join(', ')}`);
  }

  const statementMatches = intersectTokens(promptTokens, tokenizeForSearch(note.statements.join(' ')));
  if (statementMatches.length > 0) {
    score += Math.min(statementMatches.length, 6);
    reasons.push(`statements matched: ${statementMatches.join(', ')}`);
  }

  return {
    ...note,
    score,
    reasons,
  };
}

function scorePromotedNoteAgainstPaths(note, paths) {
  const reasons = [];
  let score = 0;

  const normalizedPaths = uniqueStrings(paths.map((value) => normalizeRepoRelativePath(value)));
  const notePaths = uniqueStrings([...note.relatedPaths, ...note.sources, note.path].map((value) => normalizeRepoRelativePath(value)));
  const exactPathMatches = normalizedPaths.filter((value) => notePaths.includes(value));

  if (exactPathMatches.length > 0) {
    score += exactPathMatches.length * 18;
    reasons.push(`related paths matched: ${exactPathMatches.join(', ')}`);
  }

  const pathTokens = uniqueStrings(normalizedPaths.flatMap((value) => tokenizePathForSearch(value)));
  const matchedPathTokens = intersectTokens(
    pathTokens,
    tokenizePathForSearch([...notePaths, note.title, note.tags.join(' ')].join(' ')),
  );
  if (matchedPathTokens.length > 0) {
    score += matchedPathTokens.length * 3;
    reasons.push(`path tokens matched: ${matchedPathTokens.join(', ')}`);
  }

  return {
    ...note,
    score,
    reasons,
  };
}

export function isMeaningfulMemoryQuery(
  value,
  rules = DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES,
) {
  const normalizedValue = String(value ?? '').trim();
  const promptTokens = tokenizeForSearch(normalizedValue);
  const longTokens = promptTokens.filter((token) => token.length >= (rules.longTokenLength ?? 4));

  if (normalizedValue.length < (rules.minCharacters ?? DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES.minCharacters)) {
    return false;
  }

  if (promptTokens.length < (rules.minTokens ?? DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES.minTokens)) {
    return false;
  }

  return longTokens.length >= (rules.minLongTokens ?? DEFAULT_MEANINGFUL_MEMORY_QUERY_RULES.minLongTokens);
}

export function createMemoryHitSummary(match) {
  return {
    id: match.id,
    title: match.title,
    path: match.path,
    score: typeof match.score === 'number' ? match.score : null,
    reasons: Array.isArray(match.reasons) ? match.reasons.slice(0, 2) : [],
  };
}

export function summarizeMemoryMatches(matches, options = {}) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return null;
  }

  const maxMatches = options.maxMatches ?? 2;
  const titles = matches.slice(0, maxMatches).map((match) => match.title);
  const remainingCount = Math.max(matches.length - maxMatches, 0);
  const suffix = remainingCount > 0 ? `; +${remainingCount} more` : '';
  return `${options.prefix ?? 'Relevant repo memory'}: ${titles.join('; ')}${suffix}.`;
}

export function queryPromotedMemory(rawQuery, options = {}) {
  const indexDocument = options.indexDocument ?? readGeneratedPromotedIndex(options.relativePath);
  const promptText = String(rawQuery ?? '').trim().toLowerCase();
  const promptTokens = tokenizeForSearch(rawQuery);
  const limit = options.limit ?? DEFAULT_MEMORY_QUERY_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MEMORY_QUERY_MIN_SCORE;
  const rankedMatches = sortRankedMatches(
    indexDocument.notes.map((note) => scorePromotedNoteAgainstQuery(note, promptText, promptTokens)),
    limit,
  ).filter((match) => match.score >= minScore);

  return {
    query: String(rawQuery ?? '').trim(),
    promptTokens,
    scannedNoteCount: indexDocument.noteCount,
    matches: rankedMatches,
  };
}

export function queryPromotedMemoryByPaths(paths, options = {}) {
  const indexDocument = options.indexDocument ?? readGeneratedPromotedIndex(options.relativePath);
  const normalizedPaths = uniqueStrings(paths.map((value) => normalizeRepoRelativePath(value)));
  const limit = options.limit ?? DEFAULT_MEMORY_QUERY_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MEMORY_QUERY_MIN_SCORE;
  const rankedMatches = sortRankedMatches(
    indexDocument.notes.map((note) => scorePromotedNoteAgainstPaths(note, normalizedPaths)),
    limit,
  ).filter((match) => match.score >= minScore);

  return {
    paths: normalizedPaths,
    scannedNoteCount: indexDocument.noteCount,
    matches: rankedMatches,
  };
}

export function buildPromotedIndexDocument(notes) {
  const activePromotedNotes = notes
    .filter((note) => note.section === 'promoted' && note.metadata.status === 'active')
    .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id));

  return {
    schemaVersion: 1,
    generatedFrom: {
      promotedRoot: PROMOTED_DIR_RELATIVE_PATH,
      includedStatuses: ['active'],
    },
    noteCount: activePromotedNotes.length,
    notes: activePromotedNotes.map((note) => ({
      id: note.metadata.id,
      title: note.metadata.title,
      status: note.metadata.status,
      owner: note.metadata.owner,
      lastValidatedAt: note.metadata.lastValidatedAt,
      tags: note.metadata.tags,
      triggerTerms: note.metadata.triggerTerms,
      relatedPaths: note.metadata.relatedPaths,
      sources: note.metadata.sources,
      confidence: note.metadata.confidence,
      path: note.relativePath,
      statements: note.statements,
    })),
  };
}