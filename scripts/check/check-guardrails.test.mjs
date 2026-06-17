import test from 'node:test';
import assert from 'node:assert/strict';
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
