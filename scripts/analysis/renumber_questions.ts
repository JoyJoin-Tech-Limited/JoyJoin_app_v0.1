/**
 * Question Renumbering Script - CORRECTED VERSION
 * 
 * Current L1 anchors: Q1, Q2, Q3, Q4, Q5, Q6, Q13, Q15
 * Target L1 anchors: Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8
 * 
 * Mapping:
 * - Q1-Q6: unchanged
 * - Q7 → Q9 (becomes L2)
 * - Q8 → Q10
 * - Q9 → Q11
 * - Q10 → Q12
 * - Q11 → Q13
 * - Q12 → Q14
 * - Q13 → Q7 (promoted to L1)
 * - Q14 → Q15
 * - Q15 → Q8 (promoted to L1)
 * - Q16-Q129: UNCHANGED (no shift needed!)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define exact mapping - only questions that actually change
const mapping: Record<string, string> = {
  'Q7': 'Q9',
  'Q8': 'Q10',
  'Q9': 'Q11',
  'Q10': 'Q12',
  'Q11': 'Q13',
  'Q12': 'Q14',
  'Q13': 'Q7',   // Special: promoted to L1
  'Q14': 'Q15',
  'Q15': 'Q8',   // Special: promoted to L1
};

console.log('=== Question Renumbering - Corrected ===');
console.log('Mapping:');
Object.entries(mapping).forEach(([old, newId]) => {
  console.log(`  ${old} -> ${newId}`);
});

const questionsPath = path.join(__dirname, '../packages/shared/src/personality/questionsV4.ts');
const feedbackPath = path.join(__dirname, '../packages/shared/src/personality/feedback.ts');

let questionsContent = fs.readFileSync(questionsPath, 'utf-8');
let feedbackContent = fs.readFileSync(feedbackPath, 'utf-8');

// Two-phase replacement using unique placeholders
console.log('\n=== Phase 1: Replace with placeholders ===');

// Phase 1: Replace all old IDs with unique placeholders
for (const [oldId, newId] of Object.entries(mapping)) {
  const placeholder = `__PLACEHOLDER_${newId}__`;
  
  // Replace in questionsV4.ts - match id: "Qxx"
  const idPattern = new RegExp(`id: "${oldId}"`, 'g');
  const matches = questionsContent.match(idPattern);
  if (matches) {
    console.log(`  ${oldId} -> placeholder (${matches.length} occurrences)`);
  }
  questionsContent = questionsContent.replace(idPattern, `id: "${placeholder}"`);
  
  // Replace in feedback.ts - match "Qxx": { at property position
  // Need to handle both "Q7: {" and ",Q7:" patterns
  const feedbackPattern = new RegExp(`"${oldId}"\\s*:`, 'g');
  feedbackContent = feedbackContent.replace(feedbackPattern, `"${placeholder}":`);
  
  // Also handle unquoted format like Q7: {
  const unquotedPattern = new RegExp(`(^|[,\\s])${oldId}:`, 'gm');
  feedbackContent = feedbackContent.replace(unquotedPattern, `$1${placeholder}:`);
}

// Phase 2: Replace placeholders with final IDs
console.log('\n=== Phase 2: Replace placeholders with final IDs ===');

for (const [oldId, newId] of Object.entries(mapping)) {
  const placeholder = `__PLACEHOLDER_${newId}__`;
  
  // Replace placeholder with new ID in both files
  questionsContent = questionsContent.replace(new RegExp(placeholder, 'g'), newId);
  feedbackContent = feedbackContent.replace(new RegExp(placeholder, 'g'), newId);
  
  console.log(`  ${placeholder} -> ${newId}`);
}

// Write files
fs.writeFileSync(questionsPath, questionsContent);
fs.writeFileSync(feedbackPath, feedbackContent);

console.log('\n=== Files Updated ===');

// Verification
console.log('\n=== Verification ===');

const updatedQuestions = fs.readFileSync(questionsPath, 'utf-8');
const idMatches = [...updatedQuestions.matchAll(/id: "Q(\d+)"/g)];
const questionIds = idMatches.map(m => parseInt(m[1])).sort((a, b) => a - b);

console.log(`Total questions: ${questionIds.length}`);
console.log(`First 16 IDs: ${questionIds.slice(0, 16).map(n => `Q${n}`).join(', ')}`);

// Check for duplicates
const uniqueIds = [...new Set(questionIds)];
const duplicates = questionIds.length - uniqueIds.length;
if (duplicates > 0) {
  console.log(`ERROR: ${duplicates} duplicate IDs found!`);
  const counts: Record<number, number> = {};
  questionIds.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const dupeIds = Object.entries(counts).filter(([_, c]) => c > 1);
  dupeIds.forEach(([id, count]) => console.log(`  Q${id}: ${count} occurrences`));
} else {
  console.log('No duplicates found.');
}

// Check ID range
const minId = Math.min(...questionIds);
const maxId = Math.max(...questionIds);
console.log(`ID range: Q${minId} to Q${maxId}`);

// Check for missing IDs in sequence
const missing: number[] = [];
for (let i = 1; i <= maxId; i++) {
  if (!questionIds.includes(i)) {
    missing.push(i);
  }
}
if (missing.length > 0) {
  console.log(`Missing IDs: ${missing.map(n => `Q${n}`).join(', ')}`);
} else {
  console.log('No missing IDs - sequence is complete!');
}

// Verify L1 anchors
console.log('\n=== L1 Anchor Verification ===');
const l1Questions: string[] = [];
const lines = updatedQuestions.split('\n');
let currentId = '';
for (let i = 0; i < lines.length; i++) {
  const idMatch = lines[i].match(/id: "Q(\d+)"/);
  if (idMatch) {
    currentId = `Q${idMatch[1]}`;
  }
  if (lines[i].includes('level: 1,') && currentId) {
    l1Questions.push(currentId);
  }
}
console.log(`L1 questions: ${l1Questions.join(', ')}`);
console.log(`Expected: Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8`);
console.log(`Match: ${l1Questions.join(',') === 'Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8' ? 'YES' : 'NO'}`);
