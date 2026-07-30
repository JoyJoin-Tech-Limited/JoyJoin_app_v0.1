import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks for degrade chain tests (hoisted before imports) ──
const traceCalls: unknown[] = [];

vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn(() => ({
    client: {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
  getDeepseekSelection: vi.fn(() => ({
    client: {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: vi.fn((opts: unknown) => {
    traceCalls.push(opts);
  }),
  createAiCorrelationId: () => 'test-trace-id',
}));

vi.mock('@shared/lieDetectiveFallback', () => ({
  getRandomFallbackSet: vi.fn(() => ({
    archetype: 'corgi',
    statements: [
      { index: 1, text: '聚会冷场时我会主动讲段子', is_ai: false, source_tag: '讲段子' },
      { index: 2, text: 'KTV里我总是第一个抢麦', is_ai: false, source_tag: 'KTV麦霸' },
      { index: 3, text: '我养了一只柯基叫火锅', is_ai: true, source_tag: null },
    ],
  })),
}));

import {
  getLieDetectiveMode,
  getDynamicDifficulty,
  validateLieDetectiveV2Tags,
  validateLieDetectiveTag,
  buildLieDetectiveV2RecapData,
  generateLieDetectiveStatementFromTag,
  generateLieDetectiveStatements,
} from '../socialIcebreakerAIService';
import { getClientForFunction } from '../ai/socialModelRouter';
import { getRandomFallbackSet } from '@shared/lieDetectiveFallback';
import type { LieDetectiveStatement } from '@shared/socialIcebreaker';

describe('getLieDetectiveMode', () => {
  it('returns session mode when provided', () => {
    expect(getLieDetectiveMode('v1')).toBe('v1');
    expect(getLieDetectiveMode('v2')).toBe('v2');
  });

  it('falls back to env var when session mode is undefined', () => {
    const original = process.env.LIE_DETECTIVE_MODE;
    process.env.LIE_DETECTIVE_MODE = 'v2';
    expect(getLieDetectiveMode()).toBe('v2');
    process.env.LIE_DETECTIVE_MODE = original;
  });

  it('defaults to v1 when nothing is set', () => {
    const original = process.env.LIE_DETECTIVE_MODE;
    delete process.env.LIE_DETECTIVE_MODE;
    expect(getLieDetectiveMode()).toBe('v1');
    process.env.LIE_DETECTIVE_MODE = original;
  });
});

describe('validateLieDetectiveV2Tags', () => {
  it('accepts exactly 2 valid tags', () => {
    const result = validateLieDetectiveV2Tags(['爬山', '怕蟑螂']);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tags).toEqual(['爬山', '怕蟑螂']);
    }
  });

  it('rejects non-array input', () => {
    const result = validateLieDetectiveV2Tags('not an array');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Exactly 2 tags are required');
    }
  });

  it('rejects 1 tag', () => {
    const result = validateLieDetectiveV2Tags(['only-one']);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Exactly 2 tags are required');
    }
  });

  it('rejects 3 tags', () => {
    const result = validateLieDetectiveV2Tags(['a', 'b', 'c']);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Exactly 2 tags are required');
    }
  });

  it('rejects tags that are too short', () => {
    const result = validateLieDetectiveV2Tags(['x', 'valid']);
    expect(result.valid).toBe(false);
  });

  it('rejects tags that are too long', () => {
    const result = validateLieDetectiveV2Tags(['a'.repeat(21), 'valid']);
    expect(result.valid).toBe(false);
  });

  it('rejects tags with profanity', () => {
    const result = validateLieDetectiveV2Tags(['傻逼', '正常']);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('不友好');
    }
  });

  it('trims whitespace from tags', () => {
    const result = validateLieDetectiveV2Tags([' 爬山 ', ' 怕蟑螂 ']);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tags).toEqual(['爬山', '怕蟑螂']);
    }
  });
});

describe('validateLieDetectiveTag', () => {
  it('accepts and trims one label for assisted sentence generation', () => {
    expect(validateLieDetectiveTag(' 旅游 ')).toEqual({ valid: true, tag: '旅游' });
  });

  it('rejects empty, overlong, and unsafe labels', () => {
    expect(validateLieDetectiveTag(' ')).toMatchObject({ valid: false });
    expect(validateLieDetectiveTag('a'.repeat(21))).toMatchObject({ valid: false });
    expect(validateLieDetectiveTag('傻逼')).toMatchObject({ valid: false });
  });
});

describe('generateLieDetectiveStatementFromTag', () => {
  it('returns one editable fact sentence without assigning truth or lie', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '“我曾经一个人去冰岛旅行。”' } }],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const result = await generateLieDetectiveStatementFromTag({
      tag: '旅游',
      displayName: '小悦',
    });

    expect(result.data).toEqual({ text: '我曾经一个人去冰岛旅行。' });
    expect(result.data).not.toHaveProperty('isLie');
    expect(result.meta.promptVersion).toBe('social-lie-detective-tag-assist-v1');
  });
});

describe('getDynamicDifficulty', () => {
  it('returns medium for empty history', () => {
    expect(getDynamicDifficulty([])).toBe('medium');
  });

  it('returns medium for 1 entry history', () => {
    expect(getDynamicDifficulty([{ round: 1, correctRate: 0.2 }])).toBe('medium');
  });

  it('decreases difficulty when avg correct rate < 40%', () => {
    const history = [
      { round: 1, correctRate: 0.3 },
      { round: 2, correctRate: 0.2 },
    ];
    expect(getDynamicDifficulty(history)).toBe('easy');
  });

  it('increases difficulty when avg correct rate > 60%', () => {
    const history = [
      { round: 1, correctRate: 0.8 },
      { round: 2, correctRate: 0.9 },
    ];
    expect(getDynamicDifficulty(history)).toBe('hard');
  });

  it('keeps medium when avg is exactly 50%', () => {
    const history = [
      { round: 1, correctRate: 0.5 },
      { round: 2, correctRate: 0.5 },
    ];
    expect(getDynamicDifficulty(history)).toBe('medium');
  });

  it('keeps medium when avg is 40-60%', () => {
    const history = [
      { round: 1, correctRate: 0.5 },
      { round: 2, correctRate: 0.55 },
    ];
    expect(getDynamicDifficulty(history)).toBe('medium');
  });

  it('uses last 2 rounds only', () => {
    const history = [
      { round: 1, correctRate: 0.9 },
      { round: 2, correctRate: 0.9 },
      { round: 3, correctRate: 0.2 },
      { round: 4, correctRate: 0.2 },
    ];
    expect(getDynamicDifficulty(history)).toBe('easy');
  });
});

describe('buildLieDetectiveV2RecapData', () => {
  it('returns zeros for empty history', () => {
    const result = buildLieDetectiveV2RecapData([]);
    expect(result).toEqual({ aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 });
  });

  it('calculates ai win rate correctly', () => {
    const history = [
      { round: 1, correctRate: 0.3 }, // AI won (< 50%)
      { round: 2, correctRate: 0.7 }, // AI lost
    ];
    const result = buildLieDetectiveV2RecapData(history);
    expect(result.aiWinRate).toBe(50);
  });

  it('identifies hardest round', () => {
    const history = [
      { round: 1, correctRate: 0.5 },
      { round: 2, correctRate: 0.1 },
      { round: 3, correctRate: 0.8 },
    ];
    const result = buildLieDetectiveV2RecapData(history);
    expect(result.hardestRound).toBe(2);
  });

  it('counts fooled-everyone rounds', () => {
    const history = [
      { round: 1, correctRate: 0 },
      { round: 2, correctRate: 0.5 },
      { round: 3, correctRate: 0 },
    ];
    const result = buildLieDetectiveV2RecapData(history);
    expect(result.fooledEveryone).toBe(2);
  });

  it('calculates mixed correct rates accurately', () => {
    const history = [
      { round: 1, correctRate: 0 },
      { round: 2, correctRate: 0.25 },
      { round: 3, correctRate: 1 },
      { round: 4, correctRate: 0.75 },
    ];
    const result = buildLieDetectiveV2RecapData(history);
    // AI wins when correctRate < 0.5: rounds 1, 2 → 2/4 = 50%
    expect(result.aiWinRate).toBe(50);
    // Hardest round: min correctRate = 0 → round 1
    expect(result.hardestRound).toBe(1);
    // Fooled everyone: correctRate === 0 → round 1
    expect(result.fooledEveryone).toBe(1);
  });
});

describe('generateLieDetectiveStatements degrade chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    traceCalls.length = 0;
  });

  it('Tier 1: V2 prompt success returns statements with is_ai and source_tag', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { index: 1, text: '我养了一只猫', is_ai: false, source_tag: '猫' },
                    { index: 2, text: '我恐高', is_ai: false, source_tag: '恐高' },
                    { index: 3, text: '我曾经环球旅行', is_ai: true, source_tag: null },
                  ]),
                },
              },
            ],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const result = await generateLieDetectiveStatements({
      userId: 'u1',
      displayName: 'Test',
      mode: 'v2',
      tags: ['猫', '恐高'],
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.filter((s) => s.is_ai).length).toBe(1);
    expect(result.data.filter((s) => !s.is_ai).length).toBe(2);
    expect(result.meta.fallbackUsed).toBe(false);

    // Verify all statements have V2 fields
    for (const stmt of result.data) {
      expect(stmt).toHaveProperty('is_ai');
      expect(stmt).toHaveProperty('source_tag');
    }

    const aiStmt = result.data.find((s) => s.is_ai);
    expect(aiStmt?.source_tag).toBeNull();
    const truthStmt = result.data.find((s) => !s.is_ai);
    expect(truthStmt?.source_tag).toBeTruthy();
  });

  it('Tier 1 failure → Tier 2 V2 fallback sets activate when AI returns invalid JSON', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'not valid json' } }],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const result = await generateLieDetectiveStatements({
      userId: 'u1',
      displayName: 'Test',
      mode: 'v2',
      tags: ['猫', '恐高'],
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.filter((s) => s.is_ai).length).toBe(1);
    expect(result.meta.fallbackUsed).toBe(true);

    // Verify AITrace was logged with fallbackUsed: true for Tier 1 failure
    const tier1Trace = traceCalls.find(
      (t: any) => t.feature === 'generateLieDetectiveV2Statements' && t.fallbackUsed === true,
    );
    expect(tier1Trace).toBeDefined();
  });

  it('Tier 2 failure → Tier 3 V1 prompt fallback activates when getRandomFallbackSet throws', async () => {
    // First, make V2 prompt fail
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'not valid json' } }],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    // Then make Tier 2 throw
    vi.mocked(getRandomFallbackSet).mockImplementationOnce(() => {
      throw new Error('Fallback pool exhausted');
    });

    // Then make V1 prompt succeed
    mockClient.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { index: 1, text: 'V1 truth 1', isLie: false },
              { index: 2, text: 'V1 lie', isLie: true },
              { index: 3, text: 'V1 truth 2', isLie: false },
            ]),
          },
        },
      ],
    });

    const result = await generateLieDetectiveStatements({
      userId: 'u1',
      displayName: 'Test',
      mode: 'v2',
      tags: ['猫', '恐高'],
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.filter((s) => s.isLie).length).toBe(1);
    expect(result.meta.fallbackUsed).toBe(true);

    // Verify AITrace includes fallbackUsed: true for the V2 degrade path
    const v2Traces = traceCalls.filter(
      (t: any) => t.feature === 'generateLieDetectiveV2Statements' && t.fallbackUsed === true,
    );
    expect(v2Traces.length).toBeGreaterThanOrEqual(1);
  });

  it('all tiers in degrade chain are AITraced with fallbackUsed: true', async () => {
    // Tier 1: V2 prompt fails (empty response)
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '' } }],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    // Tier 2: fallback succeeds
    const result = await generateLieDetectiveStatements({
      userId: 'u1',
      displayName: 'Test',
      mode: 'v2',
      tags: ['猫', '恐高'],
    });

    expect(result.meta.fallbackUsed).toBe(true);

    // At least one AITrace with fallbackUsed: true should exist
    const fallbackTraces = traceCalls.filter((t: any) => t.fallbackUsed === true);
    expect(fallbackTraces.length).toBeGreaterThanOrEqual(1);
  });

  it('V1 path produces valid 3-statement result with exactly 1 isLie', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    { index: 1, text: 'V1 truth 1', isLie: false },
                    { index: 2, text: 'V1 lie', isLie: true },
                    { index: 3, text: 'V1 truth 2', isLie: false },
                  ]),
                },
              },
            ],
          }),
        },
      },
    };
    vi.mocked(getClientForFunction).mockReturnValue({
      client: mockClient as any,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const result = await generateLieDetectiveStatements({
      userId: 'u1',
      displayName: 'Test',
      mode: 'v1',
    });

    expect(result.data).toHaveLength(3);
    expect(result.data.filter((s) => s.isLie).length).toBe(1);
    expect(result.data.filter((s) => !s.isLie).length).toBe(2);
  });
});

describe('Cross-workspace type safety', () => {
  it('LieDetectiveStatement type includes is_ai and source_tag fields', () => {
    const stmt: LieDetectiveStatement = {
      index: 1,
      text: 'test statement',
      isLie: false,
      is_ai: false,
      source_tag: 'my-tag',
    };
    expect(stmt.is_ai).toBe(false);
    expect(stmt.source_tag).toBe('my-tag');
  });

  it('getRandomFallbackSet imports correctly and returns expected shape', () => {
    const set = getRandomFallbackSet('corgi');
    expect(set.statements).toHaveLength(3);
    for (const s of set.statements) {
      expect(s).toHaveProperty('is_ai');
      expect(s).toHaveProperty('source_tag');
      expect(typeof s.text).toBe('string');
    }
  });
});
