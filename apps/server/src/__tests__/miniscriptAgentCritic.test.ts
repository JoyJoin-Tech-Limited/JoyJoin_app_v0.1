/**
 * Agent-level runtime critic integration (AC-04 / AC-05):
 *  - critic blocked → fail-closed to catalog fallback (fallbackUsed + catalogUsed)
 *  - critic pass/timeout → generation accepted normally
 *  - schema-validation failure still falls back to catalog (unchanged baseline)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

const hoisted = vi.hoisted(() => ({
  criticMock: vi.fn(),
}));

vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn(() => ({
    client: { chat: { completions: { create: vi.fn() } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
  getDeepseekSelection: vi.fn(() => ({
    client: { chat: { completions: { create: vi.fn() } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
}));

vi.mock('../lib/miniscriptValidator', () => ({
  validateMiniScriptFramework: vi.fn(),
}));

vi.mock('../lib/miniscriptCritic', () => ({
  runMiniScriptRuntimeCritic: (opts: unknown) => hoisted.criticMock(opts),
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: vi.fn(),
  createAiCorrelationId: () => '00000000-0000-4000-8000-0000000000a1',
}));

vi.mock('../middleware/metrics', () => ({
  recordAIProviderRecoveryMetric: vi.fn(),
  recordMiniscriptRuntimeCriticMetric: vi.fn(),
}));

const validV2Payload = {
  schemaVersion: 2,
  style: 'modern_urban',
  genres: ['absurd_comedy'],
  premise: '测试前提：温和、低冲突的聚会小误会。',
  characters: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    roleLabel: `角色${slotIndex + 1}`,
    sinHook: '一点无伤大雅的小别扭。',
    alibi: '只记得模糊细节。',
    secret: '一句没说出口的谢谢。',
  })),
  act_flow: [
    { actNumber: 1, title: '开场', beats: ['落座', '表态'] },
    { actNumber: 2, title: '交汇', beats: ['交换线索'] },
  ],
  ending: {
    resolutionSummary: '误会解开，温柔收尾。',
    confessionMechanic: '每人一句话认领小秘密。',
  },
  clues: [
    { clueId: 'c1', text: '线索1', revealedInAct: 1 },
    { clueId: 'c2', text: '线索2', revealedInAct: 2 },
  ],
  solution: { who: '角色1', what: '误会', why: '太害羞' },
  playerKnowledge: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    knownFacts: ['fact1'],
    secretAgenda: 'secret',
    truthfulAlibi: 'alibi',
  })),
};

describe('generateMiniScriptFrameworkWithMeta + runtime critic', () => {
  beforeEach(() => {
    hoisted.criticMock.mockReset();
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'false';
  });

  afterEach(async () => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED;
    const { getClientForFunction } = await import('../ai/socialModelRouter');
    (getClientForFunction as any).mockImplementation(() => ({
      client: { chat: { completions: { create: vi.fn() } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    }));
  });

  function mockPass1Success() {
    return import('../ai/socialModelRouter').then(({ getClientForFunction }) => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validV2Payload) } }],
      });
      (getClientForFunction as any).mockReturnValue({
        client: { chat: { completions: { create: mockCreate } } },
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
      });
    });
  }

  it('falls back to catalog when the critic blocks the framework', async () => {
    await mockPass1Success();
    hoisted.criticMock.mockResolvedValue({
      verdict: 'blocked',
      skipped: false,
      violations: ['leak: 反应确认当事人'],
      latencyMs: 120,
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });

    expect(hoisted.criticMock).toHaveBeenCalledTimes(1);
    expect(meta.llmAccepted).toBe(true);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.schemaVersion).toBe(2);
    expect(framework.characters).toHaveLength(4);
  });

  it('accepts the generated framework when the critic passes', async () => {
    await mockPass1Success();
    hoisted.criticMock.mockResolvedValue({
      verdict: 'pass',
      skipped: false,
      violations: [],
      latencyMs: 90,
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['absurd_comedy'],
    });

    expect(meta.llmAccepted).toBe(true);
    expect(meta.fallbackUsed).toBe(false);
    expect(meta.catalogUsed).toBe(false);
    expect(framework.schemaVersion).toBe(2);
  });

  it('treats a critic timeout as pass (fail-open)', async () => {
    await mockPass1Success();
    hoisted.criticMock.mockResolvedValue({
      verdict: 'timeout',
      skipped: false,
      violations: [],
      latencyMs: 5_000,
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['absurd_comedy'],
    });

    expect(meta.llmAccepted).toBe(true);
    expect(meta.catalogUsed).toBe(false);
  });
});
