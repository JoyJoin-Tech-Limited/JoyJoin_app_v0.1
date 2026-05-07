#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CANDIDATE_DIR_RELATIVE_PATH,
  loadMemoryNoteFromFile,
  loadMemoryNotes,
  normalizeRepoRelativePath,
  resolveFilePath,
  tryGetRepoRelativePath,
  validateMemoryNotes,
  writeMemoryNoteFile,
} from './memory-lib.mjs';

function usage() {
  console.error('Usage: node scripts/memory/memory-stage-candidate.mjs <source-note-path> [candidate-target-path]');
}

function resolveCandidateTargetPath(sourcePath, rawTargetPath) {
  if (!rawTargetPath) {
    return path.posix.join(CANDIDATE_DIR_RELATIVE_PATH, path.posix.basename(normalizeRepoRelativePath(sourcePath)));
  }

  const normalizedTargetPath = normalizeRepoRelativePath(rawTargetPath);
  if (normalizedTargetPath.endsWith('.md')) {
    return normalizedTargetPath.startsWith(`${CANDIDATE_DIR_RELATIVE_PATH}/`)
      ? normalizedTargetPath
      : path.posix.join(CANDIDATE_DIR_RELATIVE_PATH, normalizedTargetPath);
  }

  return path.posix.join(CANDIDATE_DIR_RELATIVE_PATH, `${normalizedTargetPath}.md`);
}

const rawSourcePath = process.argv[2];
const rawTargetPath = process.argv[3];

if (!rawSourcePath) {
  usage();
  process.exit(1);
}

const absoluteSourcePath = resolveFilePath(rawSourcePath);
if (!fs.existsSync(absoluteSourcePath)) {
  console.error(`Source note does not exist: ${rawSourcePath}`);
  process.exit(1);
}

if (path.extname(absoluteSourcePath) !== '.md') {
  console.error('Source note must be a Markdown file.');
  process.exit(1);
}

const repoRelativeSourcePath = tryGetRepoRelativePath(absoluteSourcePath) ?? path.posix.basename(absoluteSourcePath);
const candidateTargetPath = resolveCandidateTargetPath(repoRelativeSourcePath, rawTargetPath);
const absoluteCandidateTargetPath = resolveFilePath(candidateTargetPath);

if (!candidateTargetPath.startsWith(`${CANDIDATE_DIR_RELATIVE_PATH}/`)) {
  console.error(`Candidate target must stay under ${CANDIDATE_DIR_RELATIVE_PATH}.`);
  process.exit(1);
}

if (fs.existsSync(absoluteCandidateTargetPath)) {
  console.error(`Candidate target already exists: ${candidateTargetPath}`);
  process.exit(1);
}

const sourceNote = loadMemoryNoteFromFile(absoluteSourcePath, 'candidate');
const stagedNote = {
  ...sourceNote,
  section: 'candidate',
  relativePath: candidateTargetPath,
  absolutePath: absoluteCandidateTargetPath,
};

const validation = validateMemoryNotes([
  ...loadMemoryNotes(),
  stagedNote,
]);

if (validation.errors.length > 0) {
  console.error('Candidate staging failed because the reviewed note is invalid:');
  for (const error of validation.errors) {
    if (error.startsWith(`${candidateTargetPath}:`) || error.includes(sourceNote.metadata.id ?? '')) {
      console.error(`- ${error}`);
    }
  }
  process.exit(1);
}

if (stagedNote.metadata.status !== 'candidate') {
  console.error('Candidate staging requires a note with frontmatter status: candidate.');
  process.exit(1);
}

writeMemoryNoteFile(absoluteCandidateTargetPath, stagedNote);
console.log(`Staged candidate note at ${candidateTargetPath}.`);