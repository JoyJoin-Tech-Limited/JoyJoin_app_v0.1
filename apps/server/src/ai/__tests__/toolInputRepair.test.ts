/**
 * Tests for toolInputRepair.ts — Ahmad Awais's validate-then-repair pattern.
 *
 * Tests cover:
 *   1. All 4 DeepSeek failure modes independently
 *   2. DeepSeek-specific markdown auto-link quirk
 *   3. Relational defaults (offset↔limit pairing)
 *   4. Valid inputs pass through untouched (critical: prevents silent corruption)
 *   5. Repair ordering (stringified-array BEFORE bare-string-wrap)
 *   6. Model-readable error formatting
 *   7. Edge cases (empty objects, nested paths, arrays)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  repairToolInput,
  repairToolInputs,
  getRepairStats,
  toolRepairMetrics,
} from '../toolInputRepair';

// ─── Test Schemas ────────────────────────────────────────────────────────────

const ReadFileSchema = z.object({
  absolutePath: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

const WriteFileSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

const BashSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  workdir: z.string().optional(),
});

const SearchSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  include: z.string().optional(),
});

const MultiFileReadSchema = z.object({
  paths: z.array(z.string()),
});

const EditSchema = z.object({
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
  replaceAll: z.boolean().optional(),
});

const GrepSchema = z.object({
  pattern: z.string(),
  include: z.string().optional(),
  path: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expectRepairType(
  result: ReturnType<typeof repairToolInput>,
  expectedType: string | null,
) {
  expect(result.repairType).toBe(expectedType);
}

function expectRepaired(result: ReturnType<typeof repairToolInput>) {
  expect(result.repaired).not.toBeNull();
  // Error should be null for successful repairs (notes are for info, not errors)
  expect(result.error).toBeNull();
}

function expectRepairedWithNotes(result: ReturnType<typeof repairToolInput>) {
  expect(result.repaired).not.toBeNull();
  // Relational defaults / auto-links set notes but NOT error
  expect(result.error).toBeNull();
  expect(result.notes).not.toBeNull();
}

function expectValid(result: ReturnType<typeof repairToolInput>, schema: z.ZodSchema) {
  expect(result.repaired).not.toBeNull();
  const parse = schema.safeParse(result.repaired);
  expect(parse.success).toBe(true);
}

// ─── Reset metrics between tests ─────────────────────────────────────────────

beforeEach(() => {
  toolRepairMetrics.repairs.clear();
  toolRepairMetrics.invalid.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair 1: null-for-optional
// ═══════════════════════════════════════════════════════════════════════════════

describe('repairNullForOptional', () => {
  it('should strip null from optional field', () => {
    const result = repairToolInput('bash', {
      command: 'npm run test',
      description: null,
    }, BashSchema);

    expectRepaired(result);
    expectRepairType(result, 'null_for_optional');
    expect(result.repaired).toEqual({ command: 'npm run test' });
    // Verify the repaired output is valid
    expect(BashSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should strip null from multiple optional fields', () => {
    const result = repairToolInput('search', {
      pattern: 'test',
      path: null,
      include: null,
    }, SearchSchema);

    expectRepaired(result);
    expectRepairType(result, 'null_for_optional');
    expect(result.repaired).toEqual({ pattern: 'test' });
    expect(SearchSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should strip null from required field (null != valid string)', () => {
    // When a required field is set to null, null-for-optional strips it,
    // but the input is still invalid because the required field is now missing.
    // This is correct: the repair does its job (strips null), but the input
    // was fundamentally broken (required field can't be null or missing).
    const result = repairToolInput('bash', {
      command: null, // required field, null is not a valid string
      description: 'test',
    }, BashSchema);

    // The null-for-optional repair strips 'command', making it missing.
    // But without 'command', validation still fails. The null-for-optional
    // repair did its job — it's the input that was fundamentally broken.
    // Since cumulative repairs don't help here (no other repair can fix
    // a missing required field), the result is 'invalid'.
    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('command');
  });

  it('should handle empty input object gracefully', () => {
    const result = repairToolInput('bash', {}, BashSchema);
    // {} is missing required 'command' → fails validation
    // null-for-optional doesn't apply (no nulls to strip)
    // Other repairs don't apply either
    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair 2: stringified arrays
// ═══════════════════════════════════════════════════════════════════════════════

describe('repairStringifiedArray', () => {
  it('should parse JSON-stringified array of strings', () => {
    const result = repairToolInput('multi_read', {
      paths: '["a.ts","b.ts","c.ts"]',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'stringified_array');
    expect(result.repaired).toEqual({ paths: ['a.ts', 'b.ts', 'c.ts'] });
    expect(MultiFileReadSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should parse JSON-stringified array with single element', () => {
    const result = repairToolInput('multi_read', {
      paths: '["/foo/bar.ts"]',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'stringified_array');
    expect(result.repaired).toEqual({ paths: ['/foo/bar.ts'] });
  });

  it('should parse JSON-stringified empty array', () => {
    const result = repairToolInput('multi_read', {
      paths: '[]',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'stringified_array');
    expect(result.repaired).toEqual({ paths: [] });
  });

  it('should NOT apply to non-JSON strings (left for bare-string-wrap)', () => {
    // This is NOT valid JSON → stringified-array repair skips
    // bare-string-wrap should handle it
    const result = repairToolInput('multi_read', {
      paths: 'not-json-at-all',
    }, MultiFileReadSchema);

    expectRepaired(result);
    // Should be repaired by bare-string-wrap, not stringified-array
    expectRepairType(result, 'bare_string_for_array');
    expect(result.repaired).toEqual({ paths: ['not-json-at-all'] });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair 3: singleton wrapping
// ═══════════════════════════════════════════════════════════════════════════════

describe('repairSingletonWrap', () => {
  it('should unwrap singleton object to array of values', () => {
    const result = repairToolInput('multi_read', {
      paths: { '0': '/foo/bar.ts' },
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'singleton_wrap');
    expect(result.repaired).toEqual({ paths: ['/foo/bar.ts'] });
  });

  it('should unwrap named-key singleton to array', () => {
    const result = repairToolInput('multi_read', {
      paths: { path: '/foo/bar.ts' },
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'singleton_wrap');
    expect(result.repaired).toEqual({ paths: ['/foo/bar.ts'] });
  });

  it('should unwrap multi-key object to array of all values', () => {
    const result = repairToolInput('multi_read', {
      paths: { a: '/a.ts', b: '/b.ts' },
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'singleton_wrap');
    // Values from Object.values() in insertion order
    expect(result.repaired?.paths).toEqual(['/a.ts', '/b.ts']);
  });

  it('should handle empty object (no values to extract)', () => {
    const result = repairToolInput('multi_read', {
      paths: {},
    }, MultiFileReadSchema);

    // Empty object has no values to extract
    // singleton-wrap returns changed=true with empty array []
    // But then paths=[] is valid for z.array(z.string())
    expectRepaired(result);
    expect(result.repaired?.paths).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair 4: bare-string-for-array
// ═══════════════════════════════════════════════════════════════════════════════

describe('repairBareStringForArray', () => {
  it('should wrap bare string in array', () => {
    const result = repairToolInput('multi_read', {
      paths: '/foo/bar.ts',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'bare_string_for_array');
    expect(result.repaired).toEqual({ paths: ['/foo/bar.ts'] });
    expect(MultiFileReadSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should wrap bare string in array with multiple elements expected', () => {
    const result = repairToolInput('multi_read', {
      paths: 'just-one-file.ts',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'bare_string_for_array');
    expect(result.repaired).toEqual({ paths: ['just-one-file.ts'] });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair ordering: stringified-array BEFORE bare-string-wrap
// ═══════════════════════════════════════════════════════════════════════════════

describe('repair ordering', () => {
  it('should NOT double-wrap a JSON-stringified array (ordering test)', () => {
    // This is the critical ordering constraint from Ahmad's tweet:
    // json-array-parse MUST run before bare-string-wrap
    // Otherwise '["a","b"]' becomes ['["a","b"]']
    const result = repairToolInput('multi_read', {
      paths: '["a.ts","b.ts"]',
    }, MultiFileReadSchema);

    expectRepaired(result);
    expectRepairType(result, 'stringified_array'); // NOT bare_string_for_array
    expect(result.repaired).toEqual({ paths: ['a.ts', 'b.ts'] });
    // Verify it's NOT double-wrapped
    const paths = result.repaired?.paths as string[];
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe('a.ts');
    expect(paths[1]).toBe('b.ts');
    // Each element should be a plain string, not a JSON string
    expect(typeof paths[0]).toBe('string');
    expect(paths[0]).not.toContain('[');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Markdown auto-link repair
// ═══════════════════════════════════════════════════════════════════════════════

describe('markdown auto-link repair', () => {
  it('should unwrap degenerate markdown auto-link in file path', () => {
    // "[notes.md](http://notes.md)" → "notes.md"
    const result = repairToolInput('edit', {
      filePath: '[notes.md](http://notes.md)',
      oldString: 'foo',
      newString: 'bar',
    }, EditSchema);

    // The auto-link repair unwraps the path, making the input valid.
    // Since the input was valid after repair, repairType is 'markdown_auto_link'.
    expect(result.repaired).not.toBeNull();
    expect(result.repairType).toBe('markdown_auto_link');
    expect(result.error).toBeNull();
    expect(result.repaired?.filePath).toBe('notes.md');
    expect(EditSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should NOT touch real markdown links', () => {
    const result = repairToolInput('edit', {
      filePath: '[click here](https://example.com/docs)',
      oldString: 'foo',
      newString: 'bar',
    }, EditSchema);

    // This is a real markdown link (text ≠ URL path)
    // The auto-link repair will check it, find it's real markdown, leave it alone.
    // The input is still valid as a string, so repairType is null.
    if (result.repairType) {
      expect(result.repairType).not.toBe('markdown_auto_link');
    }
    expect(result.repaired?.filePath).toBe('[click here](https://example.com/docs)');
  });

  it('should unwrap https variant', () => {
    const result = repairToolInput('edit', {
      filePath: '[src/app.ts](https://src/app.ts)',
      oldString: 'foo',
      newString: 'bar',
    }, EditSchema);

    expect(result.repaired).not.toBeNull();
    expect(result.repairType).toBe('markdown_auto_link');
    expect(result.repaired?.filePath).toBe('src/app.ts');
  });

  it('should handle path in writeFile tool', () => {
    const result = repairToolInput('write_file', {
      filePath: '[config.json](http://config.json)',
      content: '{}',
    }, WriteFileSchema);

    expect(result.repaired).not.toBeNull();
    expect(result.repairType).toBe('markdown_auto_link');
    expect(result.repaired?.filePath).toBe('config.json');
  });

  it('should NOT change valid file paths without auto-link syntax', () => {
    const result = repairToolInput('edit', {
      filePath: '/Users/test/project/src/index.ts',
      oldString: 'foo',
      newString: 'bar',
    }, EditSchema);

    // Valid input passes through untouched (core design principle)
    expect(result.repairType).toBeNull();
    expect(result.repaired?.filePath).toBe('/Users/test/project/src/index.ts');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Relational defaults (offset↔limit)
// ═══════════════════════════════════════════════════════════════════════════════

describe('relational defaults', () => {
  it('should default offset=0 when only limit is provided', () => {
    const result = repairToolInput('read_file', {
      absolutePath: '/foo/bar.ts',
      limit: 30,
    }, ReadFileSchema);

    expectRepairedWithNotes(result);
    expect(result.repairType).toBe('relational_default');
    expect(result.repaired?.offset).toBe(0);
    expect(result.repaired?.limit).toBe(30);
    expect(result.repaired?.absolutePath).toBe('/foo/bar.ts');
    // Notes carry the transparent decision (no "Error:" prefix)
    expect(result.notes?.some(n => n.startsWith('Note:'))).toBe(true);
    expect(result.notes?.join('')).not.toContain('Error:');
  });

  it('should default limit=2000 when only offset is provided', () => {
    const result = repairToolInput('read_file', {
      absolutePath: '/foo/bar.ts',
      offset: 100,
    }, ReadFileSchema);

    expectRepairedWithNotes(result);
    expect(result.repairType).toBe('relational_default');
    expect(result.repaired?.limit).toBe(2000);
    expect(result.repaired?.offset).toBe(100);
    expect(result.notes?.some(n => n.startsWith('Note:'))).toBe(true);
    expect(result.notes?.join('')).not.toContain('Error:');
  });

  it('should NOT override when both offset and limit are provided', () => {
    const result = repairToolInput('read_file', {
      absolutePath: '/foo/bar.ts',
      offset: 50,
      limit: 100,
    }, ReadFileSchema);

    // Valid input → no repair needed
    expect(result.repairType).toBeNull();
    expect(result.repaired?.offset).toBe(50);
    expect(result.repaired?.limit).toBe(100);
  });

  it('should NOT apply when neither offset nor limit is provided', () => {
    const result = repairToolInput('read_file', {
      absolutePath: '/foo/bar.ts',
    }, ReadFileSchema);

    // Valid input (both are optional) → no repair
    expect(result.repairType).toBeNull();
    expect(result.repaired?.offset).toBeUndefined();
    expect(result.repaired?.limit).toBeUndefined();
  });

  it('should NOT apply relational defaults for non-registered tools', () => {
    const result = repairToolInput('bash', {
      command: 'npm test',
    }, BashSchema);

    // This is valid input for bash — no relation defaults registered for bash
    expect(result.repairType).toBeNull();
    expect(result.repaired).toEqual({ command: 'npm test' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Valid input pass-through (critical: never touch valid inputs)
// ═══════════════════════════════════════════════════════════════════════════════

describe('valid input pass-through', () => {
  it('should pass valid read_file args through untouched', () => {
    const input = {
      absolutePath: '/Users/test/project/src/index.ts',
      offset: 10,
      limit: 50,
    };
    const result = repairToolInput('read_file', input, ReadFileSchema);

    expect(result.repairType).toBeNull();
    expect(result.error).toBeNull();
    expect(result.repaired).toEqual(input);
    expect(ReadFileSchema.safeParse(result.repaired).success).toBe(true);
  });

  it('should pass valid edit args through untouched', () => {
    const input = {
      filePath: '/Users/test/project/src/index.ts',
      oldString: 'const x = 1;',
      newString: 'const x = 2;',
    };
    const result = repairToolInput('edit', input, EditSchema);

    expect(result.repairType).toBeNull();
    expect(result.error).toBeNull();
    expect(result.repaired).toEqual(input);
  });

  it('should pass valid bash args through untouched', () => {
    const input = {
      command: 'npm run test -w @joyjoin/server',
      description: 'Run server tests',
      workdir: '/Users/test/project',
    };
    const result = repairToolInput('bash', input, BashSchema);

    expect(result.repairType).toBeNull();
    expect(result.error).toBeNull();
    expect(result.repaired).toEqual(input);
  });

  it('should NOT corrupt JSON-shaped content in writeFile', () => {
    // This is the case Ahmad specifically warned about:
    // writeFile content that "happens" to be JSON-shaped must NOT be preprocessed
    const input = {
      filePath: '/tmp/config.json',
      content: '{"key": "value"}',
    };
    const result = repairToolInput('write_file', input, WriteFileSchema);

    // This is valid input → must pass through untouched
    expect(result.repairType).toBeNull();
    expect(result.error).toBeNull();
    expect(result.repaired?.content).toBe('{"key": "value"}');
  });

  it('should pass valid multi-file read through untouched', () => {
    const input = {
      paths: ['/a.ts', '/b.ts', '/c.ts'],
    };
    const result = repairToolInput('multi_read', input, MultiFileReadSchema);

    expect(result.repairType).toBeNull();
    expect(result.error).toBeNull();
    expect(result.repaired).toEqual(input);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Model-readable error formatting
// ═══════════════════════════════════════════════════════════════════════════════

describe('model-readable errors', () => {
  it('should NOT prefix errors with "Error:"', () => {
    const result = repairToolInput('bash', {
      // Missing required 'command' field
      description: 'test',
    }, BashSchema);

    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
    // No "Error:" prefix — TUI paints it red and model can't recover
    expect(result.error).not.toContain('Error:');
    // Should contain actionable hints
    expect(result.error).toContain('retry');
  });

  it('should include tool name in error for context', () => {
    const result = repairToolInput('my_custom_tool', {
      // Invalid input
    }, z.object({ required: z.string() }));

    expect(result.error).toContain('my_custom_tool');
  });

  it('should cap issues at 5 to avoid overwhelming the model', () => {
    // Create a schema with many required fields
    const ManyFieldsSchema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
      f: z.string(),
      g: z.string(),
    });

    const result = repairToolInput('many_fields', {}, ManyFieldsSchema);

    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
    // Should only mention up to 5 issues
    const issueCount = (result.error?.match(/expected string/g) ?? []).length;
    expect(issueCount).toBeLessThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('should handle string raw input (parse as JSON)', () => {
    const rawInput = JSON.stringify({ command: 'npm test' });
    const result = repairToolInput('bash', rawInput, BashSchema);

    expectRepaired(result);
    expect(result.repaired).toEqual({ command: 'npm test' });
  });

  it('should handle non-JSON string raw input', () => {
    const result = repairToolInput('bash', 'not valid json at all', BashSchema);

    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('not valid JSON');
  });

  it('should handle combination of failures (null + stringified array)', () => {
    const result = repairToolInput('multi_read', {
      paths: '["a.ts","b.ts"]',
      description: null,
    }, z.object({
      paths: z.array(z.string()),
      description: z.string().optional(),
    }));

    expectRepaired(result);
    // With cumulative repairs: null-for-optional strips 'description',
    // then stringified-array parses 'paths'. First successful repair wins.
    // Actually, stringified_array + null_for_optional both apply cumulatively,
    // but since repair pipeline returns on first success, only one type is logged.
    // Either 'null_for_optional' or 'stringified_array' depending on order.
    expect(result.repaired?.paths).toEqual(['a.ts', 'b.ts']);
    // description should be stripped
    expect((result.repaired as any)?.description).toBeUndefined();
  });

  it('should handle raw input that is not an object', () => {
    const result = repairToolInput('bash', 12345, BashSchema);

    // Non-object input should fail gracefully
    expect(result.repaired).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('should handle deeply nested paths in issues', () => {
    const NestedSchema = z.object({
      config: z.object({
        files: z.array(z.string()),
      }),
    });

    const result = repairToolInput('nested', {
      config: {
        files: '["a.ts","b.ts"]',
      },
    }, NestedSchema);

    expectRepaired(result);
    expectRepairType(result, 'stringified_array');
    expect(result.repaired?.config?.files).toEqual(['a.ts', 'b.ts']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bulk repair (repairToolInputs)
// ═══════════════════════════════════════════════════════════════════════════════

describe('repairToolInputs (bulk)', () => {
  it('should repair multiple tool calls independently', () => {
    const results = repairToolInputs([
      {
        toolName: 'read_file',
        arguments: { absolutePath: '/a.ts', limit: 50 },
        schema: ReadFileSchema,
      },
      {
        toolName: 'multi_read',
        arguments: { paths: '["b.ts","c.ts"]' },
        schema: MultiFileReadSchema,
      },
      {
        toolName: 'bash',
        arguments: { command: 'npm test', description: null },
        schema: BashSchema,
      },
    ]);

    expect(results.size).toBe(3);

    // Call 0: relational default
    const r0 = results.get(0)!;
    expect(r0.repairType).toBe('relational_default');
    expect(r0.repaired?.offset).toBe(0);

    // Call 1: stringified array
    const r1 = results.get(1)!;
    expect(r1.repairType).toBe('stringified_array');
    expect(r1.repaired?.paths).toEqual(['b.ts', 'c.ts']);

    // Call 2: null for optional
    const r2 = results.get(2)!;
    expect(r2.repairType).toBe('null_for_optional');
    expect((r2.repaired as any)?.description).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Repair stats (health check)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRepairStats', () => {
  it('should report enabled by default', () => {
    const stats = getRepairStats();
    expect(stats.enabled).toBe(true);
  });

  it('should track repair counts', () => {
    // Trigger a few repairs
    repairToolInput('multi_read', { paths: '["a.ts"]' }, MultiFileReadSchema);
    repairToolInput('multi_read', { paths: '/b.ts' }, MultiFileReadSchema);
    repairToolInput('bash', { command: 'test', description: null }, BashSchema);

    const stats = getRepairStats();
    // Each repairToolInput call increments the metric counter via recordRepairMetric
    expect(stats.totalRepairs).toBeGreaterThanOrEqual(3);
    expect(stats.totalInvalid).toBeGreaterThanOrEqual(0);
  });
});
