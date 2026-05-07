#!/usr/bin/env node
import {
  queryPromotedMemory,
} from './memory-lib.mjs';

const rawQuery = process.argv.slice(2).join(' ').trim();

if (!rawQuery) {
  console.error('Usage: node scripts/memory/memory-query.mjs "query text"');
  process.exit(1);
}

let queryResult;

try {
  queryResult = queryPromotedMemory(rawQuery);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log(`Query: ${rawQuery}`);
console.log(`Prompt tokens: ${queryResult.promptTokens.join(', ') || '(none)'}`);
console.log(`Active promoted notes scanned: ${queryResult.scannedNoteCount}`);

if (queryResult.matches.length === 0) {
  console.log('No promoted memory notes matched this query.');
  process.exit(0);
}

for (const [index, match] of queryResult.matches.entries()) {
  console.log('');
  console.log(`${index + 1}. ${match.id}`);
  console.log(`   title: ${match.title}`);
  console.log(`   score: ${match.score}`);
  console.log(`   reason: ${match.reasons.join('; ')}`);
  console.log(`   path: ${match.path}`);
}