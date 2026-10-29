import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialSessionState, XiaoyueAgentState } from '@shared/socialIcebreaker';
import { withServerForApp as withServer } from '../test-utils/withServer';

const h = vi.hoisted(() => ({
  state: null as unknown as SocialSessionState,
  agentEnabled: true,
  getFeatureFlag: vi.fn(),
  resolveSession: vi.fn(),
  isHostAuthorized: vi.fn(),
  listParticipants: vi.fn(),
  updateSessionAtomic: vi.fn(),
  action: vi.fn(),
  append: vi.fn(),
}));

vi.mock('../lib/requestAuth', () => ({
  requireAuthenticatedUserId: (req: any, res: any) => {
    const userId = req.headers['x-user'];
    if (!userId) {
      res.status(401).json({ code: 'AUTH_REQUIRED', error: 'AUTH_REQUIRED' });
      return null;
    }
    return userId;
  },
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: (...args: unknown[]) => h.getFeatureFlag(...args),
}));

vi.mock('../routes/socialIcebreakerHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routes/socialIcebreakerHelpers')>();
  return {
    ...actual,
    resolveSession: (...args: unknown[]) => h.resolveSession(...args),
    isHostAuthorized: (...args: unknown[]) => h.isHostAuthorized(...args),
  };
});

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: vi.fn(),
  listParticipants: (...args: unknown[]) => h.listParticipants(...args),
  updateSession: vi.fn(async () => undefined),
  updateSessionAtomic: (...args: unknown[]) => h.updateSessionAtomic(...args),
  loadSessionLieTruths: vi.fn(async () => new Map()),
  savePhaseMetric: vi.fn(async () => undefined),
}));

vi.mock('../lib/xiaoyueAgentActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/xiaoyueAgentActions')>();
  return {
    ...actual,
    executeWarmupTopicRotation: (...args: unknown[]) => h.action(...args),
  };
});

vi.mock('../repositories/socialAgentEventsRepo', () => ({
  appendSocialAgentEvent: (...args: unknown[]) => h.append(...args),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateAdaptiveGameSuggestion: vi.fn(),
  generateXiaoyueSessionPack: vi.fn(),
}));

vi.mock('../xiaoyueAdaptiveEngine', () => ({
  generateXiaoyueAdaptiveSuggestion: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from '../routes/socialIcebreakerXiaoyue';
import { buildClientState } from '../routes/socialIcebreakerHelpers';

const NOW = 1_800_000_000_000;
const AGENT_FLAG = 'icebreakerAgentCopilotEnabled';

function makeAgent(): XiaoyueAgentState {
  return {
    policy: {
      proactiveDisabled: false,
      ignoredStreak: 0,
      cooldownUntilByKind: {},
      askCount: 1,
      askCountByPhase: { warmup: 1 },
    },
    ask: {
      id: 'ask_kill_switch',
      kind: 'warmup_rotate_topics',
      phase: 'warmup',
      reason: 'topic_stall',
      createdAt: NOW,
      baseTopicSetRevision: 2,
      copy: {
        kicker: '悦仔想确认一下',
        question: '这组先聊到这里吗？换一组新话题就好。',
        hint: '你确认后，全桌一起换新',
        cta: '换一组话题卡',
      },
      meta: {
        generatedAt: new Date(NOW).toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: true,
      },
      status: 'pending',
    },
    agentLlmCallCount: 0,
    agentEstimatedCostYuan: 0,
  };
}

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_kill_switch',
    icebreakerSessionId: 'kill_switch',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    warmupTopicSetRevision: 2,
    xiaoyueAgent: makeAgent(),
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

function post(body: unknown, user = 'host'): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user': user },
    body: JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state = makeState();
  h.agentEnabled = true;
  h.getFeatureFlag.mockImplementation(async (key: string) =>
    key === AGENT_FLAG ? h.agentEnabled : false,
  );
  h.resolveSession.mockImplementation(async () => h.state);
  h.isHostAuthorized.mockResolvedValue(true);
  h.listParticipants.mockResolvedValue([]);
  h.action.mockImplementation(async () => ({
    status: 'succeeded',
    state: makeState({ warmupTopicSetRevision: 3 }),
    topicSetRevision: 3,
  }));
  h.append.mockResolvedValue({ event: {}, replayed: false });
  h.updateSessionAtomic.mockImplementation(
    async (_id: string, mutator: any, afterWrite?: any) => {
      const state = structuredClone(h.state);
      if (mutator(state) === false) return { outcome: 'aborted', state };
      if (afterWrite) await afterWrite(state, { tx: true });
      return { outcome: 'updated', state };
    },
  );
});

describe('icebreakerAgentCopilotEnabled — host projection kill switch', () => {
  it('omits xiaoyueAgent for the host when OFF without mutating persisted state', async () => {
    h.agentEnabled = false;
    const original = makeState();

    const projected = await buildClientState(original, 'host');

    expect(projected).not.toHaveProperty('xiaoyueAgent');
    expect(original.xiaoyueAgent?.ask?.id).toBe('ask_kill_switch');
    expect(h.getFeatureFlag).toHaveBeenCalledWith(AGENT_FLAG, true);
  });

  it('keeps the complete host agent projection when ON', async () => {
    const original = makeState();

    const projected = await buildClientState(original, 'host');

    expect(projected.xiaoyueAgent).toEqual(original.xiaoyueAgent);
    expect(projected.warmupTopicSetRevision).toBe(2);
  });

  it('fails open to the existing ON projection if the flag lookup throws', async () => {
    h.getFeatureFlag.mockImplementation(async (key: string) => {
      if (key === AGENT_FLAG) throw new Error('flag store unavailable');
      return false;
    });
    const original = makeState();

    const projected = await buildClientState(original, 'host');

    expect(projected.xiaoyueAgent).toEqual(original.xiaoyueAgent);
  });
});

describe('icebreakerAgentCopilotEnabled — agent route kill switch', () => {
  it.each(['accepted', 'ignored'] as const)(
    'refuses an OFF %s decision before any action or episode/Ask write',
    async (decision) => {
      h.agentEnabled = false;

      await withServer(buildApp(), async (_base, request) => {
        const response = await request(
          '/social_kill_switch/xiaoyue/agent/decision',
          post({
            askId: 'ask_kill_switch',
            decision,
            ...(decision === 'accepted' ? { idempotencyKey: 'idem_kill_switch' } : {}),
          }),
        );

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
          code: 'AGENT_DISABLED',
          error: 'AGENT_DISABLED',
        });
      });
      expect(h.resolveSession).not.toHaveBeenCalled();
      expect(h.action).not.toHaveBeenCalled();
      expect(h.updateSessionAtomic).not.toHaveBeenCalled();
      expect(h.append).not.toHaveBeenCalled();
      expect(h.state.xiaoyueAgent?.ask?.status).toBe('pending');
    },
  );

  it('preserves the accepted decision path when ON', async () => {
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_kill_switch/xiaoyue/agent/decision',
        post({
          askId: 'ask_kill_switch',
          decision: 'accepted',
          idempotencyKey: 'idem_kill_switch',
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: 'succeeded',
        topicSetRevision: 3,
      });
      expect(h.action).toHaveBeenCalledTimes(1);
    });
  });

  it('fails open to the existing decision path if the flag lookup throws', async () => {
    h.getFeatureFlag.mockImplementation(async (key: string) => {
      if (key === AGENT_FLAG) throw new Error('flag store unavailable');
      return false;
    });

    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_kill_switch/xiaoyue/agent/decision',
        post({
          askId: 'ask_kill_switch',
          decision: 'accepted',
          idempotencyKey: 'idem_kill_switch',
        }),
      );

      expect(response.status).toBe(200);
      expect(h.action).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses an OFF policy write before any episode or Ask-state mutation', async () => {
    h.agentEnabled = false;

    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_kill_switch/xiaoyue/agent/policy',
        post({ proactiveEnabled: false }),
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        code: 'AGENT_DISABLED',
        error: 'AGENT_DISABLED',
      });
    });
    expect(h.resolveSession).not.toHaveBeenCalled();
    expect(h.updateSessionAtomic).not.toHaveBeenCalled();
    expect(h.append).not.toHaveBeenCalled();
    expect(h.state.xiaoyueAgent?.policy.proactiveDisabled).toBe(false);
  });

  it('preserves the policy write path when ON', async () => {
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_kill_switch/xiaoyue/agent/policy',
        post({ proactiveEnabled: false }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.status).toBe('decision_recorded');
      expect(body.state.xiaoyueAgent.policy.proactiveDisabled).toBe(true);
      expect(h.updateSessionAtomic).toHaveBeenCalledTimes(1);
      expect(h.append).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'policy_changed' }),
        expect.anything(),
      );
    });
  });
});
