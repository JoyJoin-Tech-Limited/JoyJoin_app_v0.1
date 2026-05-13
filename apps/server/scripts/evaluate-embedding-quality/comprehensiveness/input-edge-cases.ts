import type { EmbeddingClient } from '../../../src/embeddingClient';
import type { TestResult } from '../lib/report';

interface EdgeCase {
  name: string;
  input: string;
  expectsNull: boolean;
  expectsNonZero: boolean;
}

const CASES: EdgeCase[] = [
  { name: 'empty string', input: '', expectsNull: true, expectsNonZero: false },
  { name: 'whitespace only', input: '   ', expectsNull: true, expectsNonZero: false },
  { name: 'single CJK char', input: '嗨', expectsNull: false, expectsNonZero: true },
  { name: 'single ASCII char', input: 'a', expectsNull: false, expectsNonZero: true },
  { name: 'punctuation only', input: '.,!?;:', expectsNull: false, expectsNonZero: true },
  { name: 'numbers only', input: '2024', expectsNull: false, expectsNonZero: true },
  { name: 'emoji only', input: '🎉🎊🎈', expectsNull: false, expectsNonZero: true },
  { name: 'gibberish', input: 'asdfghjkl', expectsNull: false, expectsNonZero: true },
  { name: 'mixed zh/en/emoji', input: 'Love 旅行 ☕️🎨 寻找有趣的灵魂', expectsNull: false, expectsNonZero: true },
  { name: 'very long (5k chars)', input: 'A '.repeat(2500), expectsNull: false, expectsNonZero: true },
  { name: 'markdown-like', input: '# Hello\n**bold** _italic_ `code`', expectsNull: false, expectsNonZero: true },
  { name: 'URL-like', input: 'https://joyjoin.com/profile/user-123?ref=test', expectsNull: false, expectsNonZero: true },
  { name: 'JSON-like', input: '{"name": "test", "bio": "hello"}', expectsNull: false, expectsNonZero: true },
];

export async function testInputEdgeCases(client: EmbeddingClient): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const c of CASES) {
    const result = await client.embed(c.input);

    if (c.expectsNull) {
      if (result === null) {
        results.push({ name: c.name, verdict: 'PASS', detail: 'correctly returned null' });
      } else {
        results.push({ name: c.name, verdict: 'FAIL', detail: 'expected null but got a vector' });
      }
      continue;
    }

    if (c.expectsNonZero) {
      if (result === null) {
        results.push({ name: c.name, verdict: 'FAIL', detail: 'expected vector but got null' });
        continue;
      }
      const norm = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0));
      if (norm > 1e-6) {
        results.push({
          name: c.name,
          verdict: 'PASS',
          detail: `dim=${result.dimensions} norm=${norm.toFixed(4)}`,
        });
      } else {
        results.push({
          name: c.name,
          verdict: 'WARN',
          detail: `returned zero vector (norm=0)`,
        });
      }
    }
  }

  return results;
}
