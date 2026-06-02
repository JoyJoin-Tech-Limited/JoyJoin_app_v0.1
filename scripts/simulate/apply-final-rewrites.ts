import { readFileSync, writeFileSync } from 'fs';

// Final rewrites with validated mapping and balanced inflation

const REWRITES: Record<string, { file: string; replacements: { old: string; new: string }[] }> = {
  Q130: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      {
        old: 'traitScores: { A: 2, C: 0, E: 1, O: 0, X: 2, P: 6 }',
        new: 'traitScores: { A: -2, C: -2, E: 2, O: -2, X: 4, P: 3 }'
      },
      {
        old: 'traitScores: { A: 5, C: 0, E: 3, O: 0, X: 0, P: 0 }',
        new: 'traitScores: { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 }'
      },
      {
        old: 'traitScores: { A: 1, C: 2, E: 1, O: 2, X: 0, P: 1 }',
        new: 'traitScores: { A: -2, C: 3, E: 1, O: 2, X: -2, P: -2 }'
      },
      {
        old: 'traitScores: { A: 1, C: 0, E: 2, O: 0, X: 1, P: 3 }',
        new: 'traitScores: { A: -1, C: -1, E: -2, O: 1, X: 2, P: -2 }'
      }
    ]
  },
  Q124: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 6, C: 0, E: 0, O: 0, X: 0, P: 2 }', new: 'traitScores: { A: 4, C: -1, E: 1, O: -1, X: -2, P: 1 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 2, O: 0, X: 2, P: 1 }', new: 'traitScores: { A: 0, C: 0, E: 2, O: 0, X: 2, P: 0 }' },
      { old: 'traitScores: { A: 0, C: 4, E: 1, O: 0, X: 0, P: 0 }', new: 'traitScores: { A: -2, C: 3, E: 1, O: 0, X: 0, P: -2 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 0, O: 3, X: 1, P: 1 }', new: 'traitScores: { A: -1, C: -1, E: -1, O: 4, X: 1, P: 1 }' }
    ]
  },
  Q131: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 2, C: 0, E: 1, O: 0, X: 5, P: 6 }', new: 'traitScores: { A: -1, C: -1, E: 1, O: -1, X: 4, P: 4 }' },
      { old: 'traitScores: { A: 2, C: 2, E: 4, O: 1, X: 1, P: -1 }', new: 'traitScores: { A: 0, C: 2, E: 2, O: 0, X: -1, P: -2 }' },
      { old: 'traitScores: { A: 1, C: 4, E: 2, O: 0, X: -2, P: 0 }', new: 'traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }' },
      { old: 'traitScores: { A: 5, C: 1, E: 2, O: 0, X: 0, P: 1 }', new: 'traitScores: { A: 3, C: -1, E: 0, O: 0, X: -2, P: 1 }' }
    ]
  },
  Q135: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 3, C: 0, E: 1, O: 0, X: 4, P: 6 }', new: 'traitScores: { A: 2, C: -2, E: -1, O: -2, X: 4, P: 4 }' },
      { old: 'traitScores: { A: 5, C: 0, E: 3, O: 0, X: 1, P: 2 }', new: 'traitScores: { A: 4, C: 0, E: 1, O: -1, X: -2, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 1, E: 3, O: 0, X: -2, P: 0 }', new: 'traitScores: { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 }' },
      { old: 'traitScores: { A: 2, C: 1, E: 4, O: 1, X: 0, P: -1 }', new: 'traitScores: { A: 1, C: 1, E: 2, O: 1, X: 0, P: -2 }' }
    ]
  },
  Q114: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 0, E: 3, O: 0, X: 4, P: 0 }', new: 'traitScores: { A: -2, C: -2, E: 2, O: -1, X: 4, P: 2 }' },
      { old: 'traitScores: { A: 4, C: 0, E: 0, O: 0, X: -2, P: 4 }', new: 'traitScores: { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 2, E: 0, O: 1, X: 1, P: 1 }', new: 'traitScores: { A: -1, C: 2, E: 0, O: 1, X: 0, P: -1 }' },
      { old: 'traitScores: { A: 1, C: 0, E: 1, O: 0, X: 3, P: 1 }', new: 'traitScores: { A: 0, C: -1, E: -1, O: 0, X: 2, P: 1 }' }
    ]
  },
  Q108: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 0, E: 3, O: 0, X: 4, P: 1 }', new: 'traitScores: { A: 1, C: 1, E: 4, O: -1, X: -2, P: 2 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 0, O: 0, X: 3, P: 3 }', new: 'traitScores: { A: 2, C: 0, E: 0, O: -1, X: 2, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 1, E: 0, O: 1, X: 1, P: 1 }', new: 'traitScores: { A: 1, C: 1, E: -1, O: 2, X: 0, P: -1 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 0, O: 2, X: -1, P: 0 }', new: 'traitScores: { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 }' }
    ]
  },
  Q132: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: -2, E: 1, O: 5, X: 1, P: 2 }', new: 'traitScores: { A: -1, C: -1, E: 0, O: 4, X: 2, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 4, E: 2, O: -2, X: 0, P: 0 }', new: 'traitScores: { A: 0, C: 3, E: 1, O: -2, X: -1, P: -1 }' },
      { old: 'traitScores: { A: 2, C: -1, E: 2, O: 0, X: 3, P: 3 }', new: 'traitScores: { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 }' },
      { old: 'traitScores: { A: 4, C: 1, E: 1, O: 0, X: 1, P: 1 }', new: 'traitScores: { A: 3, C: 1, E: 0, O: 0, X: -1, P: -1 }' }
    ]
  },
  Q93: {
    file: 'packages/shared/src/personality/questionsV4Advanced.ts',
    replacements: [
      { old: 'traitScores: { A: 3, C: 0, E: 0, O: 0, X: 1, P: 1 }', new: 'traitScores: { A: 3, C: -1, E: 1, O: -1, X: 1, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 3, E: 2, O: 0, X: 0, P: 0 }', new: 'traitScores: { A: -1, C: 3, E: 2, O: 0, X: 0, P: -1 }' },
      { old: 'traitScores: { A: 2, C: 2, E: 1, O: 1, X: 1, P: 0 }', new: 'traitScores: { A: 1, C: 2, E: 1, O: 1, X: 1, P: -1 }' },
      { old: 'traitScores: { A: 1, C: 1, E: 1, O: 0, X: -1, P: 0 }', new: 'traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: -1 }' }
    ]
  },
  Q125: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 1, C: 0, E: 1, O: 0, X: 5, P: 6 }', new: 'traitScores: { A: -1, C: -1, E: 1, O: -1, X: 4, P: 4 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 4, O: 0, X: -1, P: 0 }', new: 'traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 }' },
      { old: 'traitScores: { A: 2, C: 2, E: 1, O: 0, X: -2, P: 1 }', new: 'traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }' },
      { old: 'traitScores: { A: 0, C: 3, E: 0, O: 2, X: 0, P: -1 }', new: 'traitScores: { A: -1, C: 2, E: 0, O: 2, X: 0, P: -2 }' }
    ]
  },
  Q134: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 5, E: 2, O: -1, X: -1, P: 0 }', new: 'traitScores: { A: 1, C: 4, E: 2, O: -1, X: -2, P: -2 }' },
      { old: 'traitScores: { A: 1, C: 2, E: 4, O: 1, X: 1, P: 1 }', new: 'traitScores: { A: 0, C: 2, E: 2, O: 1, X: 1, P: 1 }' },
      { old: 'traitScores: { A: 4, C: 0, E: 2, O: 0, X: 2, P: 1 }', new: 'traitScores: { A: 3, C: 0, E: 1, O: 0, X: 2, P: 1 }' },
      { old: 'traitScores: { A: 0, C: -3, E: 2, O: 1, X: 1, P: 2 }', new: 'traitScores: { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 }' }
    ]
  },
  Q55: {
    file: 'packages/shared/src/personality/questionsV4Extended.ts',
    replacements: [
      { old: 'traitScores: { A: 1, C: 2, E: -1, O: 0, X: 3, P: 1 }', new: 'traitScores: { A: 0, C: 1, E: -1, O: 0, X: 3, P: 1 }' },
      { old: 'traitScores: { A: 2, C: 1, E: 1, O: 0, X: 1, P: 2 }', new: 'traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 1 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 1, O: 1, X: 0, P: 0 }', new: 'traitScores: { A: 1, C: 0, E: 1, O: 1, X: -1, P: -1 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 3, O: 1, X: -1, P: 0 }', new: 'traitScores: { A: -1, C: 0, E: 2, O: 1, X: -2, P: -1 }' }
    ]
  },
  Q107: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 0, E: 2, O: 0, X: 4, P: 1 }', new: 'traitScores: { A: -1, C: -1, E: -1, O: -1, X: 4, P: 3 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 0, O: 0, X: 2, P: 3 }', new: 'traitScores: { A: 3, C: -1, E: 2, O: -1, X: -2, P: 1 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 1, O: 0, X: 1, P: 2 }', new: 'traitScores: { A: -1, C: -1, E: -1, O: 0, X: -2, P: 1 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: 0 }', new: 'traitScores: { A: -1, C: -1, E: -1, O: 0, X: -3, P: -1 }' }
    ]
  },
  Q128: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 1, C: -1, E: 0, O: 1, X: 5, P: 4 }', new: 'traitScores: { A: -1, C: -1, E: -1, O: 0, X: 4, P: 3 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 1, O: 3, X: 2, P: 1 }', new: 'traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }' },
      { old: 'traitScores: { A: -1, C: 0, E: 2, O: 4, X: 1, P: 0 }', new: 'traitScores: { A: -1, C: 0, E: 1, O: 3, X: -1, P: 0 }' },
      { old: 'traitScores: { A: 2, C: 1, E: 2, O: 0, X: -3, P: 0 }', new: 'traitScores: { A: 1, C: 0, E: 1, O: -1, X: -3, P: -1 }' }
    ]
  },
  Q110: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 3, C: 0, E: 1, O: 0, X: -2, P: 4 }', new: 'traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }', new: 'traitScores: { A: -1, C: 0, E: -1, O: 0, X: 4, P: -1 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 0, O: 2, X: 2, P: 0 }', new: 'traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 }' },
      { old: 'traitScores: { A: 1, C: 2, E: 0, O: 2, X: 0, P: 0 }', new: 'traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: -1 }' }
    ]
  },
  Q49: {
    file: 'packages/shared/src/personality/questionsV4L2.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }', new: 'traitScores: { A: 0, C: -1, E: -1, O: 2, X: 3, P: 1 }' },
      { old: 'traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }', new: 'traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: -1 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }', new: 'traitScores: { A: 2, C: -1, E: 1, O: -1, X: 1, P: 0 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }', new: 'traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 }' }
    ]
  },
  Q54: {
    file: 'packages/shared/src/personality/questionsV4Extended.ts',
    replacements: [
      { old: 'traitScores: { A: -1, C: 0, E: 1, O: 1, X: 2, P: 0 }', new: 'traitScores: { A: -2, C: 0, E: 1, O: 1, X: 2, P: -1 }' },
      { old: 'traitScores: { A: 3, C: 1, E: 0, O: -1, X: 0, P: 1 }', new: 'traitScores: { A: 3, C: 1, E: -1, O: -1, X: -1, P: 1 }' },
      { old: 'traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }', new: 'traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 2 }', new: 'traitScores: { A: 1, C: -1, E: 1, O: 0, X: 1, P: 1 }' }
    ]
  },
  Q73: {
    file: 'packages/shared/src/personality/questionsV4Extended.ts',
    replacements: [
      { old: 'traitScores: { A: 0, C: 0, E: 0, O: 0, X: 3, P: 3 }', new: 'traitScores: { A: -1, C: 0, E: -1, O: 0, X: 3, P: 3 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 2 }', new: 'traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 1 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 2, O: 1, X: 0, P: 1 }', new: 'traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 }' },
      { old: 'traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }', new: 'traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: -2 }' }
    ]
  },
  Q112: {
    file: 'packages/shared/src/personality/questionsV4Attractor.ts',
    replacements: [
      { old: 'traitScores: { A: 3, C: 1, E: 1, O: 0, X: -2, P: 4 }', new: 'traitScores: { A: 4, C: 0, E: 0, O: -1, X: -2, P: 3 }' },
      { old: 'traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }', new: 'traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 2 }' },
      { old: 'traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: 1 }', new: 'traitScores: { A: -1, C: 2, E: 0, O: 2, X: 0, P: 0 }' },
      { old: 'traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: 2 }', new: 'traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: 1 }' }
    ]
  }
};

// Apply
const files = new Map<string, string>();
for (const [id, data] of Object.entries(REWRITES)) {
  if (!files.has(data.file)) files.set(data.file, readFileSync(data.file, 'utf-8'));
  let content = files.get(data.file)!;
  for (const r of data.replacements) {
    if (!content.includes(r.old)) {
      console.log(`⚠️  ${id}: not found: ${r.old.slice(0, 50)}...`);
    } else {
      content = content.replace(r.old, r.new);
    }
  }
  files.set(data.file, content);
  console.log(`✅ ${id}`);
}

for (const [file, content] of files) {
  writeFileSync(file, content);
  console.log(`📝 ${file}`);
}
