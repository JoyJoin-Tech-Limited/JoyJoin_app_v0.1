import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  traceMock: vi.fn(),
  metricsMock: vi.fn(),
  validateMock: vi.fn(),
}));

// Mock AI router
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

// Mock validator
vi.mock('../lib/miniscriptValidator', () => ({
  validateMiniScriptFramework: hoisted.validateMock,
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: (opts: unknown) => hoisted.traceMock(opts),
  createAiCorrelationId: () => '00000000-0000-4000-8000-000000000001',
}));

vi.mock('../middleware/metrics', () => ({
  recordAIProviderRecoveryMetric: (opts: unknown) => hoisted.metricsMock(opts),
}));

const validV2Payload = {
  schemaVersion: 2,
  style: 'modern_urban',
  genres: ['absurd_comedy'],
  gameModeConfig: {
    clueCountRange: [2, 4],
    hasRedHerrings: true,
    hasHiddenAgendas: false,
    votingStyle: 'none',
    winCondition: 'laugh_track',
    targetPlayMinutes: 10,
    difficulty: 'easy',
  },
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

describe('generateMiniScriptFramework orchestrator (v2)', () => {
  beforeEach(() => {
    hoisted.traceMock.mockReset();
    hoisted.metricsMock.mockReset();
    hoisted.validateMock.mockReset();
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_PIPELINE_TIMEOUT_MS;
  });

  afterEach(async () => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_PIPELINE_TIMEOUT_MS;
    // Restore the module-mock default so tests that don't set their own client
    // stay deterministic regardless of which test ran before them.
    const { getClientForFunction } = await import('../ai/socialModelRouter');
    (getClientForFunction as any).mockImplementation(() => ({
      client: { chat: { completions: { create: vi.fn() } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    }));
  });

  it('uses catalog fallback when LLM env disabled (no model call)', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });
    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.schemaVersion).toBe(2);
    expect(framework.characters).toHaveLength(4);
    expect(framework.clues).toBeDefined();
    expect(framework.solution).toBeDefined();
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'miniscript',
        feature: 'generateMiniScriptFramework',
        provider: null,
        success: true,
        fallbackUsed: true,
        errorCode: 'llm_disabled',
      }),
    );
  });

  it('keeps the requested style and creates one role per player in catalog fallback', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 5,
      style: 'ancient_chinese',
      genres: ['light_reasoning'],
    });

    expect(framework.style).toBe('ancient_chinese');
    expect(framework.genres).toEqual(['light_reasoning']);
    expect(framework.characters).toHaveLength(5);
    expect(framework.playerKnowledge).toHaveLength(5);
    expect(framework.characters.map((character) => character.slotIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('reports real generation stages to the caller', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    const onProgress = vi.fn();
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');

    await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith('generating', 15);
    expect(onProgress).toHaveBeenCalledWith('fallback', 86);
  });

  it('accepts valid model JSON + validation when both enabled', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'true';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validV2Payload) } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    hoisted.validateMock.mockResolvedValue({
      valid: true,
      result: { valid: true, score: 85, issues: [], fixable: false, summary: 'Good' },
      meta: { score: 85, valid: true, fixable: false, issueCount: 0 } as any,
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'ancient_chinese',
      genres: ['romance'],
    });

    expect(meta.llmAccepted).toBe(true);
    expect(meta.fallbackUsed).toBe(false);
    expect(meta.validationUsed).toBe(true);
    expect(meta.validationScore).toBe(85);
    expect(meta.catalogUsed).toBe(false);
    expect(framework.style).toBe('ancient_chinese');
    expect(framework.genres).toEqual(['romance']);
    expect(framework.schemaVersion).toBe(2);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fallbackUsed: false,
        provider: 'deepseek',
      }),
    );
  });

  it('falls back to catalog when validation fails', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'true';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validV2Payload) } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    hoisted.validateMock.mockResolvedValue({
      valid: false,
      result: { valid: false, score: 45, issues: [{ severity: 'critical', field: 'clues', message: 'bad', suggestion: 'fix' }], fixable: false, summary: 'Bad' },
      meta: { score: 45, valid: false, fixable: false, issueCount: 1 } as any,
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    // Use exact catalog match: modern_urban + light_reasoning
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });

    expect(meta.llmAccepted).toBe(true);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.validationUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.style).toBe('modern_urban');
    expect(framework.schemaVersion).toBe(2);
  });

  it('skips validation when disabled, accepts generation directly', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    // SOCIAL_MINISCRIPT_VALIDATION_ENABLED not set → defaults to false when LLM enabled but env missing? Actually it defaults to isMiniscriptLlmEnabled()
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'false';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validV2Payload) } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'medieval',
      genres: ['thriller_mystery'],
    });

    expect(meta.llmAccepted).toBe(true);
    expect(meta.validationUsed).toBe(false);
    expect(meta.catalogUsed).toBe(false);
    expect(framework.schemaVersion).toBe(2);
    expect(hoisted.validateMock).not.toHaveBeenCalled();
  });

  it('falls back to catalog when model returns empty response', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    // Use exact catalog match: modern_urban + light_reasoning
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });

    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.style).toBe('modern_urban');
    expect(framework.schemaVersion).toBe(2);
  });

  it('falls back when character count mismatches playerCount (host authority)', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';

    const badPayload = {
      ...validV2Payload,
      characters: [0, 1, 2, 3, 4].map((slotIndex) => ({
        slotIndex,
        roleLabel: `角色${slotIndex + 1}`,
        sinHook: '一点无伤大雅的小别扭。',
        alibi: '只记得模糊细节。',
        secret: '一句没说出口的谢谢。',
      })),
    };

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(badPayload) } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['absurd_comedy'],
    });

    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.characters).toHaveLength(4);
    expect(framework.schemaVersion).toBe(2);
  });

  it('settles to catalog fallback within the hard bound when pass 1 never resolves', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'false';
    process.env.SOCIAL_MINISCRIPT_PIPELINE_TIMEOUT_MS = '200';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    // Confirmed production failure mode: a stalled provider socket — the SDK
    // promise never settles and the AbortSignal is never honored.
    const mockCreate = vi.fn().mockImplementation(() => new Promise(() => {}));
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const startedAt = Date.now();
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.schemaVersion).toBe(2);
    expect(framework.characters).toHaveLength(4);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'generateMiniScriptFramework',
        success: false,
        fallbackUsed: true,
        errorCode: 'pipeline_timeout',
      }),
    );
  }, 10_000);

  it('settles to catalog fallback within the hard bound when pass 2 never resolves', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_PIPELINE_TIMEOUT_MS = '300';

    const { getClientForFunction } = await import('../ai/socialModelRouter');
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validV2Payload) } }],
    });
    (getClientForFunction as any).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    });

    // Validator hangs mid-flight (stalled socket) — the pipeline race must
    // still settle instead of awaiting it forever.
    hoisted.validateMock.mockImplementation(() => new Promise(() => {}));

    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const startedAt = Date.now();
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(meta.validationUsed).toBe(true);
    expect(framework.schemaVersion).toBe(2);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'generateMiniScriptFramework',
        success: false,
        fallbackUsed: true,
        errorCode: 'pipeline_timeout',
      }),
    );
  }, 10_000);

  it('produces v2 stub with clues and solution when everything fails', async () => {
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    // Use exact catalog match: republican_era + thriller_mystery (has 4 chars)
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'republican_era',
      genres: ['thriller_mystery'],
    });

    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(framework.schemaVersion).toBe(2);
    expect(framework.characters).toHaveLength(4);
    expect(framework.clues.length).toBeGreaterThanOrEqual(2);
    expect(framework.solution).toBeDefined();
    expect(framework.playerKnowledge).toHaveLength(4);
    expect(framework.gameModeConfig).toBeDefined();
  });
});
