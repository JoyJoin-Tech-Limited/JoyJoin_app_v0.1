/**
 * Question Renumbering Script
 * 
 * New Anchor Questions (Q1-Q8):
 * - New Q1 = Old Q1 (社交启动, X主测)
 * - New Q2 = Old Q5 (团体形象, X+A)
 * - New Q3 = Old Q2 (决策参与, O主测)
 * - New Q4 = Old Q6 (优化倾向, O+C)
 * - New Q5 = Old Q13 (赠礼思维, A主测)
 * - New Q6 = Old Q15 (胜负反应, P主测)
 * - New Q7 = Old Q3 (能量优先级, E主测)
 * - New Q8 = Old Q4 (学习偏好, C主测)
 * 
 * L2 questions start from Q9
 * L3 questions follow after L2
 */

// Mapping: oldId -> newId for anchors
const anchorMapping: Record<string, string> = {
  'Q1': 'Q1',   // X - 社交启动
  'Q5': 'Q2',   // X+A - 团体形象
  'Q2': 'Q3',   // O - 决策参与
  'Q6': 'Q4',   // O+C - 优化倾向
  'Q13': 'Q5',  // A - 赠礼思维
  'Q15': 'Q6',  // P - 胜负反应
  'Q3': 'Q7',   // E - 能量优先级
  'Q4': 'Q8',   // C - 学习偏好
};

// Questions that will become anchors (new Q1-Q8)
const newAnchorOldIds = ['Q1', 'Q5', 'Q2', 'Q6', 'Q13', 'Q15', 'Q3', 'Q4'];

// Questions that should NOT be anchors anymore
const removeAnchorOldIds = ['Q9', 'Q12'];

console.log('=== Question Renumbering Plan ===\n');

console.log('New Anchor Questions (Q1-Q8):');
for (const [oldId, newId] of Object.entries(anchorMapping)) {
  console.log(`  ${oldId} -> ${newId}`);
}

console.log('\nQuestions losing isAnchor status:');
for (const id of removeAnchorOldIds) {
  console.log(`  ${id} (will become L2)`);
}

console.log('\n=== Full Renumbering Map ===\n');

// Build complete mapping
// First, list all old IDs in order
const oldL1 = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q9', 'Q15'];
const oldL2WithAnchor = ['Q12', 'Q13']; // These were L2 but had isAnchor

// L2 questions (excluding those becoming anchors)
const oldL2 = [
  'Q7', 'Q8', 'Q10', 'Q11', 'Q12', 'Q14', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20',
  'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26', 'Q27', 'Q28', 'Q29', 'Q30',
  'Q31', 'Q32', 'Q33', 'Q34', 'Q35', 'Q36', 'Q37', 'Q38', 'Q39', 'Q40',
  'Q41', 'Q42', 'Q43', 'Q44', 'Q45', 'Q46', 'Q47', 'Q48', 'Q49', 'Q50',
  'Q56', 'Q58', 'Q61', 'Q62', 'Q63', 'Q64', 'Q65', 'Q66', 'Q67', 'Q68',
  'Q69', 'Q70', 'Q71', 'Q72', 'Q73', 'Q74', 'Q75', 'Q76', 'Q77', 'Q78',
  'Q79', 'Q80', 'Q81', 'Q82', 'Q83', 'Q84', 'Q85', 'Q86', 'Q87', 'Q88',
  'Q89', 'Q90', 'Q91', 'Q92', 'Q93', 'Q94', 'Q95', 'Q96', 'Q97'
];

// Remove Q13 from L2 (it becomes anchor Q5)
const l2ForRenumber = oldL2.filter(id => id !== 'Q13');

// Add Q9 to L2 (it was L1 with isAnchor, now becomes L2)
// Q9 stays in its position but loses anchor status

// L3 questions
const oldL3 = [
  'Q51', 'Q52', 'Q53', 'Q54', 'Q55', 'Q57', 'Q59', 'Q60',
  'Q98', 'Q99', 'Q100', 'Q101', 'Q102', 'Q103', 'Q104', 'Q105',
  'Q106', 'Q107', 'Q108', 'Q109', 'Q110', 'Q111', 'Q112', 'Q113',
  'Q114', 'Q115', 'Q116', 'Q117', 'Q118', 'Q119', 'Q120', 'Q121',
  'Q122', 'Q123', 'Q124', 'Q125', 'Q126'
];

// Build complete mapping
const fullMapping: Record<string, { newId: string; level: 1 | 2 | 3; isAnchor: boolean }> = {};

// Anchors (Q1-Q8)
for (const [oldId, newId] of Object.entries(anchorMapping)) {
  fullMapping[oldId] = { newId, level: 1, isAnchor: true };
}

// L2 questions (Q9+)
let l2Counter = 9;
// Q9 (was anchor, now L2) and Q12 (was L2 anchor, stays L2)
fullMapping['Q9'] = { newId: `Q${l2Counter++}`, level: 2, isAnchor: false };
fullMapping['Q12'] = { newId: `Q${l2Counter++}`, level: 2, isAnchor: false };

// Rest of L2
for (const oldId of l2ForRenumber) {
  if (!fullMapping[oldId]) {
    fullMapping[oldId] = { newId: `Q${l2Counter++}`, level: 2, isAnchor: false };
  }
}

// L3 questions (after L2)
for (const oldId of oldL3) {
  if (!fullMapping[oldId]) {
    fullMapping[oldId] = { newId: `Q${l2Counter++}`, level: 3, isAnchor: false };
  }
}

// Print the mapping
console.log('Anchor Questions (new Q1-Q8):');
for (const [oldId, info] of Object.entries(fullMapping).filter(([_, v]) => v.isAnchor)) {
  console.log(`  ${oldId} -> ${info.newId} (L${info.level}, anchor)`);
}

console.log('\nL2 Questions (new Q9+):');
const l2Entries = Object.entries(fullMapping)
  .filter(([_, v]) => v.level === 2)
  .sort((a, b) => parseInt(a[1].newId.slice(1)) - parseInt(b[1].newId.slice(1)));
console.log(`  Total: ${l2Entries.length} questions`);
console.log(`  Range: ${l2Entries[0]?.[1].newId} - ${l2Entries[l2Entries.length-1]?.[1].newId}`);

console.log('\nL3 Questions:');
const l3Entries = Object.entries(fullMapping)
  .filter(([_, v]) => v.level === 3)
  .sort((a, b) => parseInt(a[1].newId.slice(1)) - parseInt(b[1].newId.slice(1)));
console.log(`  Total: ${l3Entries.length} questions`);
console.log(`  Range: ${l3Entries[0]?.[1].newId} - ${l3Entries[l3Entries.length-1]?.[1].newId}`);

// Export for use
console.log('\n=== JSON Mapping ===');
console.log(JSON.stringify(fullMapping, null, 2));
