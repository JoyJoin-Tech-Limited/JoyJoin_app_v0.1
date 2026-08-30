/**
 * MiniScript runtime critic tests (AC-05 / AC-06 / AC-08 / REL-01):
 *  - violation detected → blocked verdict + miniscript_runtime_critic_blocked event
 *  - LLM timeout → treated as pass + miniscript_runtime_critic_timeout event
 *  - remaining pipeline budget exhausted → skipped pass + timeout event, no LLM call
 *  - flag off → provable no-op (zero LLM calls)
 *  - critic exception → never crashes the pipeline (REL-01)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 20_000 });

const hoisted = vi.hoisted(() => ({
  createMock: vi.fn(),
  traceMock: vi.fn(),
  metricMock: vi.fn(),
  infoSpy: vi.fn(),
  errorSpy: vi.fn(),
}));

vi.mock('../ai/socialModelRouter', () => ({
  getDeepseekSelection: vi.fn(() => ({
    client: { chat: { completions: { create: hoisted.createMock } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: (opts: unknown) => hoisted.traceMock(opts),
  createAiCorrelationId: () => '00000000-0000-4000-8000-0000000000c1',
}));

vi.mock('../middleware/metrics', () => ({
  recordMiniscriptRuntimeCriticMetric: (verdict: unknown) => hoisted.metricMock(verdict),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => hoisted.infoSpy(...args),
    warn: vi.fn(),
    error: (...args: unknown[]) => hoisted.errorSpy(...args),
  },
}));

import { miniScriptStoryFrameworkSchema } from '@shared/miniscriptStoryFramework';
import { getDeepseekSelection } from '../ai/socialModelRouter';

const framework = miniScriptStoryFrameworkSchema.parse({
  schemaVersion: 2,
  style: 'modern_urban',
  genres: ['light_reasoning'],
  premise: '茶水间的燕麦奶不见了。',
  characters: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    roleLabel: `角色${slotIndex + 1}`,
    sinHook: '一点无伤大雅的小别扭。',
    alibi: '只记得模糊细节。',
    secret: '一句没说出口的谢谢。',
  })),
  act_flow: [
    {
      actNumber: 1,
      title: '开场',
      beats: ['落座', '表态'],
      cliffhanger: '可是谁都不愿先开口。',
      evidence: [
        {
          id: 'e1',
          name: '登记表',
          description: '前台的进出登记表。',
          iconKey: '登记表',
          evidenceReactions: {
            '1': '她扶了扶眼镜，说登记表她每天都会誊进手账里保存起来。',
            '2': '他摘下耳机看了一眼，嘟囔说自己签完名就回座位刷题了。',
          },
        },
      ],
    },
    { actNumber: 2, title: '收束', beats: ['交换线索', '投票'] },
  ],
  ending: { resolutionSummary: '温柔的误会。', confessionMechanic: '每人一句话。' },
  clues: [
    { clueId: 'c1', text: '线索一', revealedInAct: 1 },
    { clueId: 'c2', text: '线索二', revealedInAct: 2 },
  ],
  solution: { who: '角色1', what: '借走忘了还', why: '怕丢面子', whoSlot: 1 },
  playerKnowledge: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    knownFacts: ['fact1'],
    secretAgenda: 'secret',
    truthfulAlibi: 'alibi',
  })),
  motiveOptions: ['怕丢面子', '想独吞', '一时糊涂'],
});

describe('runMiniScriptRuntimeCritic', () => {
  beforeEach(() => {
    hoisted.createMock.mockReset();
    hoisted.traceMock.mockReset();
    hoisted.metricMock.mockReset();
    hoisted.infoSpy.mockReset();
    hoisted.errorSpy.mockReset();
    (getDeepseekSelection as any).mockClear();
    delete process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED;
  });

  afterEach(() => {
    delete process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED;
  });

  it('is a provable no-op when the flag is off (zero LLM calls)', async () => {
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 5_000 });
    expect(result.verdict).toBe('pass');
    expect(result.skipped).toBe(true);
    expect(getDeepseekSelection).not.toHaveBeenCalled();
    expect(hoisted.createMock).not.toHaveBeenCalled();
    expect(hoisted.metricMock).not.toHaveBeenCalled();
  });

  it('passes a clean framework and emits AITrace with promptVersion', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    hoisted.createMock.mockResolvedValue({
      choices: [{ message: { content: '{"violations":[]}' } }],
    });
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 10_000 });
    expect(result.verdict).toBe('pass');
    expect(hoisted.metricMock).toHaveBeenCalledWith('pass');
    expect(hoisted.traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'miniscriptRuntimeCritic',
        promptVersion: 'miniscript-runtime-critic-v1',
        success: true,
      }),
    );
  });

  it('blocks on a detected violation and emits miniscript_runtime_critic_blocked', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    hoisted.createMock.mockResolvedValue({
      choices: [{ message: { content: '{"violations":[{"type":"leak","detail":"反应确认当事人"}]}' } }],
    });
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 10_000 });
    expect(result.verdict).toBe('blocked');
    expect(result.violations).toHaveLength(1);
    expect(hoisted.metricMock).toHaveBeenCalledWith('blocked');
    expect(hoisted.infoSpy).toHaveBeenCalledWith(
      'miniscript_runtime_critic_blocked',
      expect.objectContaining({ event: 'miniscript_runtime_critic_blocked' }),
    );
  });

  it('treats an LLM timeout as pass and emits miniscript_runtime_critic_timeout', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    hoisted.createMock.mockImplementation(() => new Promise(() => {}));
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const startedAt = Date.now();
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 100 });
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(result.verdict).toBe('timeout');
    expect(hoisted.metricMock).toHaveBeenCalledWith('timeout');
    expect(hoisted.infoSpy).toHaveBeenCalledWith(
      'miniscript_runtime_critic_timeout',
      expect.objectContaining({ event: 'miniscript_runtime_critic_timeout' }),
    );
  });

  it('skips the critic when the remaining pipeline budget is exhausted (no LLM call)', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 0 });
    expect(result.verdict).toBe('timeout');
    expect(result.skipped).toBe(true);
    expect(getDeepseekSelection).not.toHaveBeenCalled();
    expect(hoisted.metricMock).toHaveBeenCalledWith('timeout');
    expect(hoisted.infoSpy).toHaveBeenCalledWith(
      'miniscript_runtime_critic_timeout',
      expect.objectContaining({ event: 'miniscript_runtime_critic_timeout' }),
    );
  });

  it('never crashes the pipeline when the critic throws (REL-01)', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    hoisted.createMock.mockRejectedValue(new Error('provider exploded'));
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 10_000 });
    expect(result.verdict).toBe('pass');
    expect(hoisted.metricMock).toHaveBeenCalledWith('error');
  });

  it('fails open on unparseable critic output', async () => {
    process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED = 'true';
    hoisted.createMock.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
    });
    const { runMiniScriptRuntimeCritic } = await import('../lib/miniscriptCritic');
    const result = await runMiniScriptRuntimeCritic({ framework, remainingBudgetMs: 10_000 });
    expect(result.verdict).toBe('pass');
    expect(hoisted.metricMock).toHaveBeenCalledWith('pass');
  });
});
