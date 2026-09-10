#!/usr/bin/env node
/**
 * Ipsative Item SDI Pairing Audit (Plan Item 1, contract AC-1.1/AC-1.3)
 *
 * Asserts the authoring invariants for every ipsative (forced-choice,
 * equal-SDI) item in questionsV4Ipsative:
 *   1. exactly 2 options;
 *   2. every option declares socialDesirabilityIndex (SDI) in [0, 100];
 *   3. pairing invariant: |SDI_a − SDI_b| ≤ 10 per item;
 *   4. primaryTraits lists exactly the two rivalry traits, and both options
 *      carry a nonzero score on each of them;
 *   5. zero-sum geometry: across the two options, every trait's scores sum
 *      to exactly 0 (a random answerer drifts by 0 on every trait);
 *   6. all trait scores within the tightened new-item range −3..+3;
 *   7. questionType === 'ipsative' and isForcedChoice === true;
 *   8. WeChat review posture: no 匹配/社交/灵魂/撮合/AI in any visible copy;
 *      no emoji in copy;
 *   9. bank-level: ≥12 ipsative items and ≥2 items per declared rivalry
 *      (rivalry = the primaryTraits pair).
 *
 * Exits 0 with a summary when all invariants hold; exits 1 listing every
 * violation otherwise. Run: `npm run simulate:audit-ipsative`.
 */

import { questionsV4 } from '../../packages/shared/src/personality/questionsV4.js';
import type { AdaptiveQuestion, TraitKey } from '../../packages/shared/src/personality/types.js';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const SDI_PAIRING_TOLERANCE = 10;
const MIN_IPSATIVE_ITEMS = 12;
const MIN_ITEMS_PER_RIVALRY = 2;
const BANNED_COPY_TOKENS = ['匹配', '社交', '灵魂', '撮合', 'AI'];
// Emoji detection mirroring the guardrail scanner's ranges (pictographs).
const EMOJI_RE = /[😀-🙏🌀-🫿☀-⛿✀-➿⬀-⯿️‍⬅-⬇]/u;

const violations: string[] = [];

function checkItem(q: AdaptiveQuestion): void {
  const where = `${q.id} (${q.primaryTraits.join('↔')})`;

  if (q.questionType !== 'ipsative') {
    violations.push(`${where}: questionType must be 'ipsative', got '${q.questionType ?? 'undefined'}'`);
  }
  if (q.isForcedChoice !== true) {
    violations.push(`${where}: isForcedChoice must be true`);
  }
  if (q.options.length !== 2) {
    violations.push(`${where}: ipsative items must have exactly 2 options, got ${q.options.length}`);
  }
  if (q.primaryTraits.length !== 2) {
    violations.push(`${where}: primaryTraits must list exactly the 2 rivalry traits, got [${q.primaryTraits.join(', ')}]`);
  }

  // Copy posture
  const copyBlobs = [q.scenarioText, q.questionText, ...q.options.map((o) => o.text)];
  for (const blob of copyBlobs) {
    for (const token of BANNED_COPY_TOKENS) {
      if (blob.includes(token)) {
        violations.push(`${where}: banned WeChat-posture token '${token}' in copy: "${blob.slice(0, 40)}…"`);
      }
    }
    if (EMOJI_RE.test(blob)) {
      violations.push(`${where}: emoji in copy: "${blob.slice(0, 40)}…"`);
    }
  }

  // SDI declarations + pairing invariant
  const sdis = q.options.map((o) => o.socialDesirabilityIndex);
  q.options.forEach((o, i) => {
    const sdi = sdis[i];
    if (sdi === undefined || !Number.isFinite(sdi)) {
      violations.push(`${where} option ${o.value}: socialDesirabilityIndex missing or non-numeric`);
    } else if (sdi < 0 || sdi > 100) {
      violations.push(`${where} option ${o.value}: SDI ${sdi} outside 0–100`);
    }
  });
  if (sdis.length === 2 && sdis.every((s) => s !== undefined && Number.isFinite(s))) {
    const gap = Math.abs((sdis[0] as number) - (sdis[1] as number));
    if (gap > SDI_PAIRING_TOLERANCE) {
      violations.push(`${where}: |ΔSDI| = ${gap} exceeds ±${SDI_PAIRING_TOLERANCE} (SDIs ${sdis.join(' vs ')})`);
    }
  }

  // Score invariants
  for (const o of q.options) {
    for (const trait of ALL_TRAITS) {
      const s = o.traitScores[trait] ?? 0;
      if (s < -3 || s > 3) {
        violations.push(`${where} option ${o.value}: ${trait} score ${s} outside −3..+3`);
      }
    }
    for (const trait of q.primaryTraits) {
      if ((o.traitScores[trait] ?? 0) === 0) {
        violations.push(`${where} option ${o.value}: rivalry trait ${trait} must carry a nonzero score`);
      }
    }
  }
  if (q.options.length === 2) {
    for (const trait of ALL_TRAITS) {
      const sum = q.options.reduce((acc, o) => acc + (o.traitScores[trait] ?? 0), 0);
      if (sum !== 0) {
        violations.push(`${where}: zero-sum violated on ${trait} (option scores sum to ${sum}, expected 0)`);
      }
    }
  }
}

function main() {
  const ipsativeItems = questionsV4.filter((q) => q.questionType === 'ipsative');

  console.log('='.repeat(70));
  console.log('IPSATIVE ITEM SDI PAIRING AUDIT (Plan Item 1)');
  console.log('='.repeat(70));
  console.log(`Ipsative items found in bank: ${ipsativeItems.length}`);

  if (ipsativeItems.length < MIN_IPSATIVE_ITEMS) {
    violations.push(`bank: only ${ipsativeItems.length} ipsative items (contract requires ≥${MIN_IPSATIVE_ITEMS})`);
  }

  for (const q of ipsativeItems) {
    checkItem(q);
  }

  // Rivalry coverage
  const rivalryCounts = new Map<string, number>();
  for (const q of ipsativeItems) {
    const key = [...q.primaryTraits].sort().join('↔');
    rivalryCounts.set(key, (rivalryCounts.get(key) ?? 0) + 1);
  }
  for (const [rivalry, count] of rivalryCounts) {
    if (count < MIN_ITEMS_PER_RIVALRY) {
      violations.push(`bank: rivalry ${rivalry} has ${count} item(s), needs ≥${MIN_ITEMS_PER_RIVALRY}`);
    }
  }

  console.log('\nRivalry coverage:');
  for (const [rivalry, count] of [...rivalryCounts.entries()].sort()) {
    console.log(`   ${rivalry}: ${count} items`);
  }

  console.log('\nPer-item SDI pairs:');
  for (const q of ipsativeItems) {
    const sdis = q.options.map((o) => o.socialDesirabilityIndex);
    const gap = sdis.length === 2 && sdis.every((s) => s !== undefined) ? Math.abs((sdis[0] as number) - (sdis[1] as number)) : NaN;
    console.log(`   ${q.id} [${q.primaryTraits.join('↔')}] SDI ${sdis.join(' vs ')} (Δ=${gap})`);
  }

  console.log();
  if (violations.length > 0) {
    console.error(`❌ ${violations.length} violation(s):`);
    for (const v of violations) console.error(`   - ${v}`);
    process.exit(1);
  }
  console.log('✅ 0 violations — all ipsative SDI pairing, zero-sum, range, copy, and coverage invariants hold.');
  console.log('='.repeat(70));
}

main();
