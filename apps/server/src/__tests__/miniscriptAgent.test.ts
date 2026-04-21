import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  traceMock: vi.fn(),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION: 'social-miniscript-framework-v1',
  fetchMiniScriptFrameworkModelJson: hoisted.fetchMock,
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: (opts: unknown) => hoisted.traceMock(opts),
  createAiCorrelationId: () => '00000000-0000-4000-8000-000000000001',
}));

const validLlmPayload = {
  schemaVersion: 1,
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
};

describe('generateMiniScriptFramework orchestrator', () => {
  beforeEach(() => {
    hoisted.fetchMock.mockReset();
    hoisted.traceMock.mockReset();
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  });

  it('uses stub when LLM env disabled (no model call)', async () => {
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
    });
    expect(hoisted.fetchMock).not.toHaveBeenCalled();
    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(false);
    expect(framework.schemaVersion).toBe(1);
    expect(framework.characters).toHaveLength(4);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'miniscript',
        feature: 'generateMiniScriptFramework',
        provider: null,
        success: false,
        fallbackUsed: false,
        errorCode: 'llm_disabled',
        promptVersion: 'social-miniscript-framework-v1',
      }),
    );
  });

  it('accepts valid model JSON when LLM enabled (DeepSeek recovery after MiniMax)', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    hoisted.fetchMock.mockResolvedValue({
      ok: true,
      data: validLlmPayload,
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 10,
      deepSeekRecoveryUsed: true,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'ancient_chinese',
      genres: ['romance'],
    });
    expect(meta.llmAccepted).toBe(true);
    expect(meta.fallbackUsed).toBe(false);
    expect(meta.providerRecoveryUsed).toBe(true);
    expect(framework.style).toBe('ancient_chinese');
    expect(framework.genres).toEqual(['romance']);
    expect(framework.premise).toBe(validLlmPayload.premise);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fallbackUsed: true,
        provider: 'deepseek',
      }),
    );
  });

  it('accepts valid model JSON when LLM enabled (primary MiniMax, no recovery)', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    hoisted.fetchMock.mockResolvedValue({
      ok: true,
      data: validLlmPayload,
      provider: 'minimax',
      model: 'minimax-m2.7',
      latencyMs: 10,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'ancient_chinese',
      genres: ['romance'],
    });
    expect(meta.llmAccepted).toBe(true);
    expect(meta.providerRecoveryUsed).toBeFalsy();
    expect(framework.style).toBe('ancient_chinese');
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fallbackUsed: false,
        provider: 'minimax',
      }),
    );
  });

  it('falls back to stub when model layer reports timeout', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    hoisted.fetchMock.mockResolvedValue({
      ok: false,
      reason: 'timeout',
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 32_001,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'future_tech',
      genres: ['light_reasoning'],
    });
    expect(meta.fallbackUsed).toBe(true);
    expect(framework.style).toBe('future_tech');
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'timeout', fallbackUsed: true }),
    );
  });

  it('falls back to stub on model empty / parse failure', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    hoisted.fetchMock.mockResolvedValue({
      ok: false,
      reason: 'parse_error',
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 5,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'xianxia',
      genres: ['light_reasoning'],
    });
    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(framework.style).toBe('xianxia');
    expect(framework.characters).toHaveLength(4);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fallbackUsed: true,
        errorCode: 'parse_error',
      }),
    );
  });

  it('falls back when model JSON fails Zod', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    hoisted.fetchMock.mockResolvedValue({
      ok: true,
      data: { invalid: true },
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 3,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'medieval',
      genres: ['thriller_mystery'],
    });
    expect(meta.llmAccepted).toBe(false);
    expect(meta.fallbackUsed).toBe(true);
    expect(framework.style).toBe('medieval');
    expect(framework.characters).toHaveLength(4);
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'schema_error',
        fallbackUsed: true,
      }),
    );
  });

  it('falls back when character count mismatches playerCount (host authority)', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    const fiveChars = [0, 1, 2, 3, 4].map((slotIndex) => ({
      slotIndex,
      roleLabel: `角色${slotIndex + 1}`,
      sinHook: '一点无伤大雅的小别扭。',
      alibi: '只记得模糊细节。',
      secret: '一句没说出口的谢谢。',
    }));
    hoisted.fetchMock.mockResolvedValue({
      ok: true,
      data: { ...validLlmPayload, characters: fiveChars },
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 3,
    });
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['absurd_comedy'],
    });
    expect(meta.fallbackUsed).toBe(true);
    expect(framework.characters).toHaveLength(4);
  });
});
