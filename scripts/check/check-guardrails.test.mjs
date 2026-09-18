import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listGuardrailsAppSourcePaths, isPlaceholder } from '../guardrails-app-sources.mjs';

const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const allowedEmojiContextPattern = /emoji\s*=\s*['"]|icon\s*=\s*['"]|fallbackEmoji/;

test('listGuardrailsAppSourcePaths skips paths missing from worktree', () => {
  const tracked = [
    'apps/admin-client/src/DeletedButStillIndexed.tsx',
    'apps/server/src/Present.ts',
    'packages/shared/src/not-scanned.ts',
  ];
  const existsSync = (p) => p === 'apps/server/src/Present.ts';
  assert.deepEqual(listGuardrailsAppSourcePaths(tracked, existsSync), ['apps/server/src/Present.ts']);
});

test('listGuardrailsAppSourcePaths only includes app src ts/tsx', () => {
  const existsSync = () => true;
  assert.deepEqual(
    listGuardrailsAppSourcePaths(['apps/admin-client/src/a.tsx', 'apps/admin-client/readme.md'], existsSync),
    ['apps/admin-client/src/a.tsx'],
  );
});

test('emojiPattern detects common emojis', () => {
  assert.ok(emojiPattern.test('🎉'), 'should detect party popper');
  assert.ok(emojiPattern.test('😔'), 'should detect sad face');
  assert.ok(emojiPattern.test('✅'), 'should detect checkmark');
  assert.ok(emojiPattern.test('★'), 'should detect star');
  assert.ok(emojiPattern.test('⏰'), 'should detect alarm clock (U+23F0)');
});

test('allowedEmojiContextPattern permits icon system usages', () => {
  assert.ok(allowedEmojiContextPattern.test("emoji='📅'"), 'should allow emoji prop');
  assert.ok(allowedEmojiContextPattern.test('icon="😕"'), 'should allow icon prop');
  assert.ok(allowedEmojiContextPattern.test('fallbackEmoji'), 'should allow fallbackEmoji identifier');
  assert.ok(!allowedEmojiContextPattern.test('Hello 🎉 world'), 'should not match plain text');
});

// --- Emoji check scope regression guard ---
// The emoji commit blocker is documented as "for mini-program TS/TSX" — it must
// stay scoped to apps/mini-program/ so server/admin logger strings stay exempt.
test('emoji check stays scoped to mini-program sources', () => {
  const source = readFileSync(new URL('./check-guardrails.mjs', import.meta.url), 'utf8');
  assert.ok(
    source.includes("if (!file.startsWith('apps/mini-program/')) continue;"),
    'check-guardrails.mjs emoji check must keep the apps/mini-program/ path filter',
  );
});

// --- Centering safety heuristic tests ---
const stateBlockPattern = /&__(loading|empty|error)(?:-[\w-]+)?\s*\{[^{}]*\}/g;
const flexIndicatorPattern = /display:\s*flex|@include\s+flex-center/;
const centeringSafetyPattern = /min-height:\s*(?:[1-9]|\d{2,})|flex:\s*1|flex-grow:\s*1|@include\s+scroll-view-centered-state|@include\s+viewport-min-height|position:\s*fixed/;

function findUnsafeStateBlocks(scss) {
  const violations = [];
  let match;
  // Reset lastIndex to avoid stale state from prior exec() calls on the global regex
  stateBlockPattern.lastIndex = 0;
  while ((match = stateBlockPattern.exec(scss)) !== null) {
    const block = match[0];
    if (flexIndicatorPattern.test(block) && !centeringSafetyPattern.test(block)) {
      const selector = block.split('{')[0].trim();
      violations.push(selector);
    }
  }
  return violations;
}

test('centering safety heuristic flags risky state blocks', () => {
  const risky = `
    &__loading {
      @include flex-center;
      padding: $spacing-2xl;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(risky), ['&__loading']);

  const riskyEmpty = `
    &__empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: $spacing-2xl;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(riskyEmpty), ['&__empty-state']);
});

test('centering safety heuristic permits safe state blocks', () => {
  const safe1 = `
    &__loading {
      @include scroll-view-centered-state;
      gap: $spacing-sm;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(safe1), []);

  const safe2 = `
    &__error {
      @include flex-center;
      min-height: 80vh;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(safe2), []);

  const safe3 = `
    &__empty {
      display: flex;
      align-items: center;
      flex: 1;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(safe3), []);

  const safe4 = `
    &__loading {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(safe4), []);

  const safe5 = `
    &__empty {
      display: flex;
      align-items: center;
      flex-grow: 1;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(safe5), []);

  const safe6 = `
    &__loading {
      @include flex-center;
      min-height: 0;
    }
  `;
  // min-height: 0 is NOT centering safety — it should still be flagged
  assert.deepEqual(findUnsafeStateBlocks(safe6), ['&__loading']);
});

test('centering safety heuristic ignores non-state blocks', () => {
  const nonState = `
    &__card {
      display: flex;
      align-items: center;
    }
  `;
  assert.deepEqual(findUnsafeStateBlocks(nonState), []);
});

// --- Secret placeholder heuristic tests ---

test('isPlaceholder recognizes explicit placeholder tokens', () => {
  assert.ok(isPlaceholder('<replace-with-admin-create-secret-key>'));
  assert.ok(isPlaceholder('replace-with-wechat-secret'));
  assert.ok(isPlaceholder('your_api_key_here'));
  assert.ok(isPlaceholder('change-me'));
  assert.ok(isPlaceholder('example'));
  assert.ok(isPlaceholder('${{ secrets.VALUE }}'));
});

test('isPlaceholder treats numeric-only example values as placeholders', () => {
  assert.ok(isPlaceholder('123456'), 'short numeric placeholder should be allowed');
  assert.ok(isPlaceholder('1234567890123456789'), 'long numeric placeholder should be allowed');
});

test('isPlaceholder rejects real-looking secret values', () => {
  assert.ok(!isPlaceholder('sk-abc123xyz789'));
  assert.ok(!isPlaceholder('super_secret_value_42'));
  assert.ok(!isPlaceholder('postgres://user:pass@host/db'));
});

// --- Budget-tier vocabulary ratchet heuristic tests ---
// Guards the detection logic of scripts/check/check-budget-tiers.mjs (spec
// §8.2, decision Q9): canonical ids are always flagged; legacy labels require
// nearby budget context; bare numeric ranges must NOT false-positive. The
// guard module is side-effect-free on import (main runs only when executed
// directly), so a static import here is safe.
import {
  findBudgetTierLiteralOccurrences,
  BUDGET_CONTEXT_RE,
  CONTEXT_WINDOW_LINES,
} from './check-budget-tiers.mjs';

test('budget-tier guard: canonical ids are flagged without any budget context', () => {
  const source = `const copy = { dining_150_200: '平衡预算和体验' };`;
  const occ = findBudgetTierLiteralOccurrences(source);
  assert.equal(occ.length, 1);
  assert.deepEqual({ literal: occ[0].literal, kind: occ[0].kind, line: occ[0].line }, {
    literal: 'dining_150_200',
    kind: 'canonical-id',
    line: 1,
  });
});

test('budget-tier guard: reserved/unregistered ids in the family are also flagged', () => {
  const occ = findBudgetTierLiteralOccurrences(`const x = 'drinks_150_200';`);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].literal, 'drinks_150_200');
});

test('budget-tier guard: legacy labels near a budget identifier are flagged (multi-line window)', () => {
  const source = [
    'const budgetOptions = [',
    "  '150以下',",
    "  '150-200',",
    '];',
  ].join('\n');
  const occ = findBudgetTierLiteralOccurrences(source);
  assert.deepEqual(
    occ.map((o) => `${o.literal}@${o.line}`).sort(),
    ['150-200@3', '150以下@2'],
  );
  assert.ok(occ.every((o) => o.kind === 'legacy-label'));
});

test('budget-tier guard: bare numeric ranges without budget context are NOT flagged', () => {
  const source = [
    "const description = '玩乐 · ¥200-300';",
    'const price = null;',
    'const maxAttendees = 6;',
  ].join('\n');
  assert.deepEqual(findBudgetTierLiteralOccurrences(source), []);
});

test('budget-tier guard: label beyond the context window is NOT flagged', () => {
  const gap = CONTEXT_WINDOW_LINES + 2;
  const filler = Array.from({ length: gap }, () => 'const noop = 1;');
  const source = ['const budget = 1;', ...filler, `'150-200'`].join('\n');
  assert.deepEqual(findBudgetTierLiteralOccurrences(source), []);
});

test('budget-tier guard: label exactly at the window edge IS flagged', () => {
  const filler = Array.from({ length: CONTEXT_WINDOW_LINES - 1 }, () => 'const noop = 1;');
  // label line is exactly CONTEXT_WINDOW_LINES below the context line
  const source = ['const budgetRange = [];', ...filler, `'80-150'`].join('\n');
  const occ = findBudgetTierLiteralOccurrences(source);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].literal, '80-150');
});

test('budget-tier guard: dash variants normalize to the canonical ASCII label', () => {
  const source = ["const budgetCategories = ['150 – 200'];"].join('\n');
  const occ = findBudgetTierLiteralOccurrences(source);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].literal, '150-200');
});

test('budget-tier guard: blind-box 100-200 near budget context is flagged (B3 must not regrow)', () => {
  const occ = findBudgetTierLiteralOccurrences(`const budgetTier = '100-200';`);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].literal, '100-200');
  assert.equal(occ[0].kind, 'legacy-label');
});

test('budget-tier guard: price_range / priceRange count as budget context', () => {
  assert.ok(BUDGET_CONTEXT_RE.test('price_range'));
  assert.ok(BUDGET_CONTEXT_RE.test('priceRange'));
  assert.ok(BUDGET_CONTEXT_RE.test('bar_price_range'));
  const occ = findBudgetTierLiteralOccurrences(`const venue = { priceRange: '150以下' };`);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].literal, '150以下');
});

test('budget-tier guard: substring of a larger number is not a label', () => {
  const occ = findBudgetTierLiteralOccurrences(`const budget = '1300-5000';`);
  assert.deepEqual(occ, []);
});

test('budget-tier guard: SQL mode uses file-level context for multi-row inserts', () => {
  const source = [
    'INSERT INTO venues (',
    '  id, name, price_range, budget_categories,',
    ') VALUES (',
    "  'a', '甲', '150-200', ARRAY['150-200'],",
    // 10 filler lines push the next row far outside any line window
    ...Array.from({ length: 10 }, () => "  'x',"),
    "  'b', '乙', '80-150', ARRAY['80-150'],",
    ');',
  ].join('\n');
  const lineMode = findBudgetTierLiteralOccurrences(source);
  // Only the first row (2 lines below the column list) is inside the line
  // window; the second row (13 lines below) is missed. Labels are counted
  // once per line, so the doubled '150-200' on the row is one occurrence.
  assert.deepEqual(lineMode.map((o) => o.literal), ['150-200']);
  const sqlMode = findBudgetTierLiteralOccurrences(source, { fileLevelContext: true });
  assert.deepEqual(
    sqlMode.map((o) => o.literal).sort(),
    ['150-200', '80-150'],
  );
});
