/**
 * Fix the incorrect renumbering - Q16+ was wrongly shifted by +1
 * Need to shift them back: Q17 -> Q16, Q18 -> Q17, etc.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questionsPath = path.join(__dirname, '../packages/shared/src/personality/questionsV4.ts');
const feedbackPath = path.join(__dirname, '../packages/shared/src/personality/feedback.ts');

let questionsContent = fs.readFileSync(questionsPath, 'utf-8');
let feedbackContent = fs.readFileSync(feedbackPath, 'utf-8');

console.log('=== Fixing Q16+ renumbering ===');

// We need to shift Q17-Q130 back to Q16-Q129
// Do it in reverse order to avoid collisions (highest first)
for (let i = 130; i >= 17; i--) {
  const wrongId = `Q${i}`;
  const correctId = `Q${i - 1}`;
  
  // Replace in questionsV4.ts
  const pattern = new RegExp(`id: "${wrongId}"`, 'g');
  questionsContent = questionsContent.replace(pattern, `id: "${correctId}"`);
  
  // Replace in feedback.ts
  const feedbackPattern = new RegExp(`(^\\s*|,\\s*)${wrongId}:`, 'gm');
  feedbackContent = feedbackContent.replace(feedbackPattern, `$1${correctId}:`);
}

fs.writeFileSync(questionsPath, questionsContent);
fs.writeFileSync(feedbackPath, feedbackContent);

console.log('Files fixed.');

// Verify
const updatedQuestions = fs.readFileSync(questionsPath, 'utf-8');
const idMatches = [...updatedQuestions.matchAll(/id: "Q(\d+)"/g)];
const questionIds = idMatches.map(m => parseInt(m[1])).sort((a, b) => a - b);

console.log(`\n=== Verification ===`);
console.log(`Total questions: ${questionIds.length}`);
console.log(`First 20 IDs: ${questionIds.slice(0, 20).map(n => `Q${n}`).join(', ')}`);
console.log(`Last 10 IDs: ${questionIds.slice(-10).map(n => `Q${n}`).join(', ')}`);

// Check for gaps
const missing: number[] = [];
for (let i = 1; i <= Math.max(...questionIds); i++) {
  if (!questionIds.includes(i)) {
    missing.push(i);
  }
}
console.log(`Missing IDs: ${missing.length > 0 ? missing.map(n => `Q${n}`).join(', ') : 'None'}`);

// Check for duplicates
const duplicates = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);
console.log(`Duplicates: ${duplicates.length > 0 ? [...new Set(duplicates)].map(n => `Q${n}`).join(', ') : 'None'}`);
