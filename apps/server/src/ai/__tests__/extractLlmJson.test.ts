import { describe, it, expect } from 'vitest';
import { extractJsonPayloadForParse } from '../extractLlmJson';

describe('extractJsonPayloadForParse', () => {
  it('parses raw JSON object', () => {
    const s = '{"a":1}';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual({ a: 1 });
  });

  it('strips markdown json fence', () => {
    const s = '```json\n{"b":2}\n```';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual({ b: 2 });
  });

  it('extracts first balanced object from surrounding text', () => {
    const s = 'Here:\n{"c":3}\ntrailing';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual({ c: 3 });
  });

  it('extracts JSON array', () => {
    const s = 'Sure:\n```\n[1,2]\n```';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual([1, 2]);
  });

  it('handles preamble text before fenced JSON', () => {
    const s = 'Here is the output:\n```json\n{"d":4}\n```\nThanks.';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual({ d: 4 });
  });

  it('parses compact array after prose line', () => {
    const s = 'Output:\n[9,8,7]';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual([9, 8, 7]);
  });

  it('does not treat braces inside JSON strings as delimiters', () => {
    const s = 'OK {"msg": "a}b{c", "n": 1}';
    expect(JSON.parse(extractJsonPayloadForParse(s))).toEqual({ msg: 'a}b{c', n: 1 });
  });
});
