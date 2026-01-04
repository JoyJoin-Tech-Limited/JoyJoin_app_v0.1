/**
 * Question Renumbering Script - Simple Version
 * 
 * Current L1 anchors: Q1, Q2, Q3, Q4, Q5, Q6, Q13, Q15
 * Target L1 anchors: Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8
 * 
 * Simple approach: 
 * - Keep Q1-Q6 unchanged
 * - Q13 → Q7 (becomes L1 anchor)
 * - Q15 → Q8 (becomes L1 anchor) 
 * - Q7 → Q9 (becomes L2)
 * - Q8 → Q10
 * - Q9 → Q11
 * - Q10 → Q12
 * - Q11 → Q13
 * - Q12 → Q14
 * - Q14 → Q15
 * - Q16+ → Q(n+1) to fill the gap left by Q15
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build the mapping
function buildMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Q1-Q6: unchanged
  // Q13 → Q7
  mapping['Q13'] = 'Q7';
  // Q15 → Q8  
  mapping['Q15'] = 'Q8';
  
  // Q7-Q12 shift to Q9-Q14
  for (let i = 7; i <= 12; i++) {
    mapping[`Q${i}`] = `Q${i + 2}`;
  }
  
  // Q14 → Q15
  mapping['Q14'] = 'Q15';
  
  // Q16 onwards shift by 1 (because Q15 left a gap)
  for (let i = 16; i <= 129; i++) {
    mapping[`Q${i}`] = `Q${i + 1}`;
  }
  
  return mapping;
}

const mapping = buildMapping();

console.log('=== Question Renumbering Mapping ===');
console.log('Key changes:');
console.log('  Q13 -> Q7 (promoted to L1)');
console.log('  Q15 -> Q8 (promoted to L1)');
console.log('  Q7-Q12 -> Q9-Q14 (shifted)');
console.log('  Q14 -> Q15');
console.log('  Q16+ -> Q(n+1)');

// Read and process files
const questionsPath = path.join(__dirname, '../packages/shared/src/personality/questionsV4.ts');
const feedbackPath = path.join(__dirname, '../packages/shared/src/personality/feedback.ts');

let questionsContent = fs.readFileSync(questionsPath, 'utf-8');
let feedbackContent = fs.readFileSync(feedbackPath, 'utf-8');

// Use placeholder replacement to avoid collisions
console.log('\n=== Processing questionsV4.ts ===');

// Pass 1: Replace with placeholders (highest numbers first to avoid Q1 matching Q10, etc.)
const sortedOldIds = Object.keys(mapping).sort((a, b) => {
  const numA = parseInt(a.substring(1));
  const numB = parseInt(b.substring(1));
  return numB - numA; // Descending order
});

for (const oldId of sortedOldIds) {
  const placeholder = `__TEMP_${mapping[oldId]}__`;
  const pattern = new RegExp(`id: "${oldId}"`, 'g');
  questionsContent = questionsContent.replace(pattern, `id: "${placeholder}"`);
}

// Pass 2: Replace placeholders with new IDs
for (const oldId of sortedOldIds) {
  const placeholder = `__TEMP_${mapping[oldId]}__`;
  const newId = mapping[oldId];
  questionsContent = questionsContent.replace(new RegExp(placeholder, 'g'), newId);
}

console.log('=== Processing feedback.ts ===');

// Same for feedback.ts - need to be careful with the pattern
for (const oldId of sortedOldIds) {
  const placeholder = `__TEMP_${mapping[oldId]}__`;
  // Match Q13: { or Q13: \n at start of object property
  const pattern = new RegExp(`(^\\s*|,\\s*)${oldId}:`, 'gm');
  feedbackContent = feedbackContent.replace(pattern, `$1${placeholder}:`);
}

for (const oldId of sortedOldIds) {
  const placeholder = `__TEMP_${mapping[oldId]}__`;
  const newId = mapping[oldId];
  feedbackContent = feedbackContent.replace(new RegExp(placeholder, 'g'), newId);
}

// Write files
fs.writeFileSync(questionsPath, questionsContent);
fs.writeFileSync(feedbackPath, feedbackContent);

console.log('\n=== Files Updated ===');

// Verify
const updatedQuestions = fs.readFileSync(questionsPath, 'utf-8');
const idMatches = [...updatedQuestions.matchAll(/id: "Q(\d+)"/g)];
const questionIds = idMatches.map(m => parseInt(m[1])).sort((a, b) => a - b);

console.log(`\n=== Verification ===`);
console.log(`Total questions: ${questionIds.length}`);
console.log(`First 10 IDs: Q${questionIds.slice(0, 10).join(', Q')}`);

// Check for gaps and duplicates
const uniqueIds = [...new Set(questionIds)];
const duplicates = questionIds.length - uniqueIds.length;

if (duplicates > 0) {
  console.log(`WARNING: ${duplicates} duplicate IDs found!`);
  const counts: Record<number, number> = {};
  questionIds.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const dupeIds = Object.entries(counts).filter(([_, count]) => count > 1).map(([id]) => `Q${id}`);
  console.log(`Duplicates: ${dupeIds.join(', ')}`);
}

// Check sequence
const minId = Math.min(...questionIds);
const maxId = Math.max(...questionIds);
console.log(`ID range: Q${minId} to Q${maxId}`);

// Find missing in sequence
const missing: number[] = [];
for (let i = minId; i <= maxId; i++) {
  if (!questionIds.includes(i)) {
    missing.push(i);
  }
}

if (missing.length > 0) {
  console.log(`Missing IDs: Q${missing.join(', Q')}`);
} else {
  console.log('No gaps in sequence.');
}

// Verify L1 anchors
const l1Pattern = /level: 1,[\s\S]*?isAnchor: true/g;
const anchorMatches = [...updatedQuestions.matchAll(/id: "(Q\d+)"[\s\S]*?level: 1,/g)];
console.log(`\nL1 questions found: ${anchorMatches.length}`);
