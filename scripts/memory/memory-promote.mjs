#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CANDIDATE_DIR_RELATIVE_PATH,
  GENERATED_INDEX_RELATIVE_PATH,
  PROMOTED_DIR_RELATIVE_PATH,
  buildPromotedIndexDocument,
  loadMemoryNoteFromFile,
  loadMemoryNotes,
  normalizeRepoRelativePath,
  readGeneratedPromotedIndexSafe,
  resolveFilePath,
  serializeMemoryNote,
  tryGetRepoRelativePath,
  validateMemoryNotes,
  writeGeneratedPromotedIndex,
} from './memory-lib.mjs';

function usage() {
  console.error('Usage: node scripts/memory/memory-promote.mjs <candidate-note-path> [--status=active|stale|archived]');
}

function parseTargetStatus(argv) {
  const statusArg = argv.find((value) => value.startsWith('--status='));
  if (!statusArg) {
    return 'active';
  }

  return statusArg.slice('--status='.length);
}

function removeEmptyDirectories(startDir, stopDir) {
  let currentDir = startDir;

  while (currentDir.startsWith(stopDir) && currentDir !== stopDir) {
    if (!fs.existsSync(currentDir) || fs.readdirSync(currentDir).length > 0) {
      return;
    }

    fs.rmdirSync(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

const rawCandidatePath = process.argv[2];
if (!rawCandidatePath) {
  usage();
  process.exit(1);
}

const targetStatus = parseTargetStatus(process.argv.slice(3));
if (!['active', 'stale', 'archived'].includes(targetStatus)) {
  console.error('Promotion target status must be one of: active, stale, archived.');
  process.exit(1);
}

const absoluteCandidatePath = resolveFilePath(rawCandidatePath);
const candidateRelativePath = tryGetRepoRelativePath(absoluteCandidatePath);

if (!candidateRelativePath || !candidateRelativePath.startsWith(`${CANDIDATE_DIR_RELATIVE_PATH}/`)) {
  console.error(`Promotion input must be an existing candidate note under ${CANDIDATE_DIR_RELATIVE_PATH}.`);
  process.exit(1);
}

if (!fs.existsSync(absoluteCandidatePath)) {
  console.error(`Candidate note does not exist: ${rawCandidatePath}`);
  process.exit(1);
}

const promotedRelativePath = normalizeRepoRelativePath(
  candidateRelativePath.replace(`${CANDIDATE_DIR_RELATIVE_PATH}/`, `${PROMOTED_DIR_RELATIVE_PATH}/`),
);
const absolutePromotedPath = resolveFilePath(promotedRelativePath);

if (fs.existsSync(absolutePromotedPath)) {
  console.error(`Promoted note already exists: ${promotedRelativePath}`);
  process.exit(1);
}

const candidateNote = loadMemoryNoteFromFile(absoluteCandidatePath, 'candidate');
if (candidateNote.metadata.status !== 'candidate') {
  console.error('Promotion requires a note whose current frontmatter status is candidate.');
  process.exit(1);
}

const promotedNote = {
  ...candidateNote,
  section: 'promoted',
  relativePath: promotedRelativePath,
  absolutePath: absolutePromotedPath,
  metadata: {
    ...candidateNote.metadata,
    status: targetStatus,
  },
};

const existingNotes = loadMemoryNotes();
const prospectiveNotes = [
  ...existingNotes.filter((note) => note.relativePath !== candidateRelativePath),
  promotedNote,
];
const validation = validateMemoryNotes(prospectiveNotes);

if (validation.errors.length > 0) {
  console.error('Promotion failed because the promoted note set would be invalid:');
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const indexDocument = buildPromotedIndexDocument(validation.notes);
const previousIndex = readGeneratedPromotedIndexSafe(GENERATED_INDEX_RELATIVE_PATH);
const previousIndexContents = previousIndex.available
  ? `${JSON.stringify(previousIndex.document, null, 2)}\n`
  : null;

try {
  fs.mkdirSync(path.dirname(absolutePromotedPath), { recursive: true });
  fs.writeFileSync(absolutePromotedPath, serializeMemoryNote(promotedNote), 'utf8');
  writeGeneratedPromotedIndex(indexDocument, GENERATED_INDEX_RELATIVE_PATH);
  fs.rmSync(absoluteCandidatePath, { force: true });
  removeEmptyDirectories(path.dirname(absoluteCandidatePath), resolveFilePath(CANDIDATE_DIR_RELATIVE_PATH));
} catch (error) {
  fs.rmSync(absolutePromotedPath, { force: true });

  if (previousIndexContents !== null) {
    fs.mkdirSync(path.dirname(resolveFilePath(GENERATED_INDEX_RELATIVE_PATH)), { recursive: true });
    fs.writeFileSync(resolveFilePath(GENERATED_INDEX_RELATIVE_PATH), previousIndexContents, 'utf8');
  }

  throw error;
}

console.log(`Promoted ${candidateRelativePath} to ${promotedRelativePath} with status ${targetStatus}.`);