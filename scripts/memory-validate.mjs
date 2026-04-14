#!/usr/bin/env node
import { loadMemoryNotes, validateMemoryNotes } from './memory-lib.mjs';

const result = validateMemoryNotes(loadMemoryNotes());

if (result.errors.length > 0) {
  console.error('Memory validation failed:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Memory validation passed.');
console.log(`- promoted notes: ${result.promotedCount}`);
console.log(`- candidate notes: ${result.candidateCount}`);
console.log(`- total notes: ${result.notes.length}`);