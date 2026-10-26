import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { withServerForApp as withServer } from '../test-utils/withServer';

const h = vi.hoisted(() => ({
  state: null as unknown as SocialSessionState,
  authorized: true,
  actionOutcome: null as any,
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

vi.mock('../routes/socialIcebreakerHelpers', () => ({
  resolveSession: vi.fn(async () => h.state),
  isHostAuthorized: vi.fn(async () => h.authorized),
  buildClientState: vi.fn(async (state: SocialSessionState) => state),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSession: vi.fn(async () => undefined),
  listParticipants: vi.fn(async () => []),
  updateSessionAtomic: vi.fn(async (_id: string, mutator: any, afterWrite?: any) => {
    const state = structuredClone(h.state);
    const mutated = mutator(state);
    if (mutated === false) return { outcome: 'aborted', state };
    if (afterWrite) await afterWrite(state, { tx: true });
    return { outcome: 'updated', state };
  }),
}));

vi.mock('../lib/xiaoyueAgentActions', () => ({
  executeWarmupTopicRotation: (...args: unknown[]) => h.action(...args),
}));

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

const NOW = 1_800_000_000_000;

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_routes',
    icebreakerSessionId: 'routes',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    warmupTopicSetRevision: 2,
    xiaoyueAgent: {
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 1,
        askCountByPhase: { warmup: 1 },
      },
      ask: {
        id: 'ask_route',
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
        meta: { generatedAt: new Date(NOW).toISOString(), fromCache: false, provider: null, fallbackUsed: true },
        status: 'pending',
      },
      agentLlmCallCount: 0,
      agentEstimatedCostYuan: 0,
    },
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

function post(path: string, body: unknown, user = 'host') {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user': user },
    body: JSON.stringify(body),
  } as RequestInit;
}

describe('POST /xiaoyue/agent/decision — authority and contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state = makeState();
    h.authorized = true;
    h.actionOutcome = { status: 'succeeded', state: makeState(), topicSetRevision: 3 };
    h.action.mockImplementation(async () => h.actionOutcome);
    h.append.mockResolvedValue({ event: {}, replayed: false });
  });

  it('rejects an accepted decision without an idempotency key', async () => {
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_routes/xiaoyue/agent/decision',
        post('/social_routes/xiaoyue/agent/decision', { askId: 'ask_route', decision: 'accepted' }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    });
  });

  it('rejects a non-host before touching state', async () => {
    h.authorized = false;
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_routes/xiaoyue/agent/decision',
        post(
          '/social_routes/xiaoyue/agent/decision',
          { askId: 'ask_route', decision: 'accepted', idempotencyKey: 'idem_route_1' },
          'participant',
        ),
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: 'AGENT_NOT_HOST' });
      expect(h.action).not.toHaveBeenCalled();
    });
  });

  it('delegates accepted to the single real action and returns terminal status', async () => {
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_routes/xiaoyue/agent/decision',
        post('/social_routes/xiaoyue/agent/decision', {
          askId: 'ask_route',
          decision: 'accepted',
          idempotencyKey: 'idem_route_1',
        }),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: 'succeeded',
        topicSetRevision: 3,
      });
      expect(h.action).toHaveBeenCalledWith(
        expect.objectContaining({ askId: 'ask_route', idempotencyKey: 'idem_route_1' }),
      );
    });
  });

  it('records ignored with a 10 minute kind cooldown and no auto-advance', async () => {
    await withServer(buildApp(), async (_base, request) => {
      const response = await request(
        '/social_routes/xiaoyue/agent/decision',
        post('/social_routes/xiaoyue/agent/decision', {
          askId: 'ask_route',
          decision: 'ignored',
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.status).toBe('decision_recorded');
      expect(body.state.currentPhase).toBe('warmup');
      expect(body.state.xiaoyueAgent.ask.status).toBe('ignored');
      expect(body.state.xiaoyueAgent.policy.ignoredStreak).toBe(1);
      expect(body.state.xiaoyueAgent.policy.cooldownUntilByKind.warmup_rotate_topics)
        .toBeGreaterThanOrEqual(Date.now() + 9 * 60_000);
    });
  });
});
