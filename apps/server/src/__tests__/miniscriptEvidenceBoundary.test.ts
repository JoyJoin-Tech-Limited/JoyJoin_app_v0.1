/**
 * Sanitized boundary regression tests (AC-02 / AC-03 / SEC-01).
 *
 * The client boundary is `stripFrameworkSecrets` (not `extractSecrets`) — it
 * historically passed `act_flow` through wholesale, so evidence items must be
 * explicitly stripped of the server-only `evidenceReactions` map. Asserts:
 *  1. stripFrameworkSecrets output: no reaction text, no solution, no motive
 *     correctness markers; motiveOptions pass through (public by design)
 *  2. extractSecrets: reactions + solution land in the secrets store payload
 *  3. POST /generate candidate path (LLM returns secret-laden framework)
 *  4. POST /select response path
 *  5. buildClientState miniscript fields (defense-in-depth strip)
 */
import express from 'express';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { miniScriptStoryFrameworkSchema } from '@shared/miniscriptStoryFramework';
import { createWithServer } from '../test-utils/withServer';

const { testSessions, testMiniScriptSecrets, createMock } = vi.hoisted(() => ({
  testSessions: new Map<string, SocialSessionState>(),
  testMiniScriptSecrets: new Map<string, unknown>(),
  createMock: vi.fn(),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: false,
  }),
  updateSession: async (socialSessionId: string, state: SocialSessionState) => {
    testSessions.set(socialSessionId, state);
  },
  setMiniScriptSecrets: async (socialSessionId: string, secrets: unknown) => {
    testMiniScriptSecrets.set(socialSessionId, secrets);
  },
  getMiniScriptSecrets: async (socialSessionId: string) => {
    return (testMiniScriptSecrets.get(socialSessionId) as any) ?? null;
  },
  listParticipants: async (socialSessionId: string) => {
    const state = testSessions.get(socialSessionId);
    if (!state) return [];
    return [
      { userId: state.hostUserId, displayName: state.hostDisplayName, joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), isActive: true },
    ];
  },
}));

vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn(() => ({
    client: { chat: { completions: { create: createMock } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
  getDeepseekSelection: vi.fn(() => ({
    client: { chat: { completions: { create: createMock } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
}));

const REACTION_TEXTS = [
  '她扶了扶眼镜，说登记表她每天都会誊进手账，今晚那一页恰好空着。',
  '他摘下耳机看了一眼，嘟囔说自己签完名就回座位了没注意背面。',
  '她凑近看了看那行划掉的字，忽然想起什么似的抿住了嘴不再说话。',
  '他的手指在桌沿敲了两下，承认登记表是他整理的但说划掉只是笔误。',
];

const secretLadenPayload = {
  schemaVersion: 2,
  style: 'modern_urban',
  genres: ['absurd_comedy'],
  premise: '茶水间的燕麦奶不见了，众人各怀心事。',
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
          description: '前台的进出登记表，背面有一行被划掉的字。',
          iconKey: '登记表',
          evidenceReactions: {
            '1': REACTION_TEXTS[0],
            '2': REACTION_TEXTS[1],
            '3': REACTION_TEXTS[2],
            '4': REACTION_TEXTS[3],
          },
        },
      ],
    },
    { actNumber: 2, title: '收束', beats: ['交换线索', '投票'] },
  ],
  ending: {
    resolutionSummary: '真相只是一场温柔的误会。',
    confessionMechanic: '每人一句话认领小秘密。',
  },
  clues: [
    { clueId: 'c1', text: '线索一', revealedInAct: 1 },
    { clueId: 'c2', text: '线索二', revealedInAct: 2 },
  ],
  solution: { who: '角色1', what: '借走忘了还', why: '怕被说多管闲事丢了面子', whoSlot: 1 },
  playerKnowledge: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    knownFacts: ['fact1'],
    secretAgenda: 'secret',
    truthfulAlibi: 'alibi',
  })),
  motiveOptions: ['怕被说多管闲事丢了面子', '想独吞大家的燕麦奶', '报复昨天被占座', '偷偷拿回家自己用'],
};

function assertNoSecretsLeaked(serialized: string) {
  expect(serialized).not.toContain('evidenceReactions');
  for (const text of REACTION_TEXTS) {
    expect(serialized).not.toContain(text);
  }
  expect(serialized).not.toContain('"solution"');
  expect(serialized).not.toContain('"playerKnowledge"');
  expect(serialized).not.toContain('"redHerrings"');
  expect(serialized).not.toContain('"deductionChain"');
  expect(serialized).not.toContain('isCorrect');
  expect(serialized).not.toContain('correctOption');
  expect(serialized).not.toContain('真相只是一场温柔的误会');
}

const { default: miniscriptRouter, stripFrameworkSecrets, extractSecrets } = await import(
  '../routes/domains/miniscript'
);
const { buildClientState } = await import('../routes/socialIcebreakerHelpers');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  app.use('/api/miniscript', miniscriptRouter);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

function seedHostSession(socialSessionId: string): SocialSessionState {
  const seed: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: `ice-${socialSessionId}`,
    currentPhase: 'mini_script',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'mini_script', 'recap'],
  };
  testSessions.set(socialSessionId, seed);
  return seed;
}

describe('stripFrameworkSecrets boundary (unit)', () => {
  it('strips evidenceReactions and solution while keeping public evidence + motiveOptions', () => {
    const framework = miniScriptStoryFrameworkSchema.parse(secretLadenPayload);
    const pub = stripFrameworkSecrets(framework);
    const serialized = JSON.stringify(pub);

    assertNoSecretsLeaked(serialized);
    expect(pub.act_flow[0]?.evidence?.[0]?.name).toBe('登记表');
    expect(pub.act_flow[0]?.evidence?.[0]).not.toHaveProperty('evidenceReactions');
    expect(pub.motiveOptions).toHaveLength(4);
    expect(pub.ending.resolutionSummary).toBe('真相将在最终揭晓时公开。');
  });

  it('extractSecrets routes reactions + correct motive to the secrets store', () => {
    const framework = miniScriptStoryFrameworkSchema.parse(secretLadenPayload);
    const secrets = extractSecrets(framework);
    expect(secrets.evidenceReactions['e1']?.['4']).toBe(REACTION_TEXTS[3]);
    expect(secrets.solution.why).toBe('怕被说多管闲事丢了面子');
  });
});

describe('POST /api/miniscript boundary paths', () => {
  beforeEach(() => {
    testSessions.clear();
    testMiniScriptSecrets.clear();
    createMock.mockReset();
    delete process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED;
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED;
  });

  it('/generate candidate response carries no reaction text or solution', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'true';
    process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED = 'false';
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(secretLadenPayload) } }],
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'boundary-generate';
      seedHostSession(socialSessionId);

      const res = await fetch(`${baseUrl}/api/miniscript/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          socialSessionId,
          playerCount: 4,
          style: 'modern_urban',
          genres: ['absurd_comedy'],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const serialized = JSON.stringify(body);
      assertNoSecretsLeaked(serialized);
      expect(body.motiveOptions).toHaveLength(4);
      expect(body.act_flow[0].evidence[0].name).toBe('登记表');

      const candidate = testSessions.get(socialSessionId)?.miniScriptCandidateFramework;
      assertNoSecretsLeaked(JSON.stringify(candidate));

      const secrets = testMiniScriptSecrets.get(socialSessionId) as any;
      expect(secrets?.evidenceReactions?.e1?.['4']).toBe(REACTION_TEXTS[3]);
      expect(secrets?.solution?.why).toBe('怕被说多管闲事丢了面子');
    });
  });

  it('/select response carries no secrets fields', async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login/host-user`, { method: 'POST' });
      const cookie = cookieHeader(loginRes);
      const socialSessionId = 'boundary-select';
      seedHostSession(socialSessionId);

      const res = await fetch(`${baseUrl}/api/miniscript/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ socialSessionId, scriptId: 'modern-urban-light-reasoning-001' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('evidenceReactions');
      expect(serialized).not.toContain('"solution"');
      expect(serialized).not.toContain('"playerKnowledge"');
      expect(body.ending.resolutionSummary).toBe('真相将在最终揭晓时公开。');
    });
  });
});

describe('buildClientState miniscript fields (defense in depth)', () => {
  it('strips evidenceReactions even when state holds an unstripped framework', async () => {
    testSessions.clear();
    const socialSessionId = 'boundary-client-state';
    const state = seedHostSession(socialSessionId);
    const framework = miniScriptStoryFrameworkSchema.parse(secretLadenPayload);
    // Simulate a framework that reached state without going through
    // stripFrameworkSecrets: public shape, but reactions still attached.
    const leaky = {
      ...stripFrameworkSecrets(framework),
      act_flow: framework.act_flow,
    };
    state.miniScriptFramework = leaky as never;

    const clientState = await buildClientState(state, 'host-user');
    const serialized = JSON.stringify(clientState.miniScriptFramework);
    expect(serialized).not.toContain('evidenceReactions');
    for (const text of REACTION_TEXTS) {
      expect(serialized).not.toContain(text);
    }
    expect(clientState.miniScriptFramework?.act_flow?.[0]?.evidence?.[0]?.name).toBe('登记表');
  });
});
