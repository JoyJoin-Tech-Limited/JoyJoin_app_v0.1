#!/usr/bin/env node
import {
  buildPromotedIndexDocument,
  GENERATED_INDEX_RELATIVE_PATH,
  loadMemoryNotes,
  validateMemoryNotes,
  writeGeneratedPromotedIndex,
} from './memory-lib.mjs';

const validation = validateMemoryNotes(loadMemoryNotes());

if (validation.errors.length > 0) {
  console.error('Cannot build promoted memory index because validation failed:');
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const indexDocument = buildPromotedIndexDocument(validation.notes);
writeGeneratedPromotedIndex(indexDocument);

console.log(`Built promoted memory index at ${GENERATED_INDEX_RELATIVE_PATH}.`);
console.log(`- active promoted notes indexed: ${indexDocument.noteCount}`);