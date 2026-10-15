/**
 * GET /api/onboarding/profile-tagline route contract tests —
 * sprint entry-card-insight-v2 (SEC-01 + REL-02).
 *
 *  - SEC-01: requireAuth (401 unauthenticated); userId comes ONLY from the
 *    session (per-user scoping); v2 response shape {insightLine, lines,
 *    evidence, meta}.
 *  - REL-02: legacy consumers reading only `insightLine` + `meta.aigc` do not
 *    regress when the additive v2 fields are present.
 */

import express from 'express';
import session from 'express-session';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWithServer } from '../test-utils/withServer';

// ── Mocks (hoisted by vitest) ────────────────────────────────────────────────

const { dbMock, generateProfileTaglineMock } = vi.hoisted(() => {
  let sessionRows: any[] = [];
  let answerRows: any[] = [];

  const db = {
    query: {
      users: { findFirst: vi.fn(() => Promise.resolve(null)) },
      userInterests: { findFirst: vi.fn(() => Promise.resolve(null)) },
    },
    // drizzle chain: db.insert(...).values(...) — onboarding analytics writer.
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve([])),
    })),
    // drizzle chain: db.select(...).from(...).[innerJoin(...)].where(...).orderBy(...).limit(...)
    // The answers query uses innerJoin; the session query does not — the mock
    // dispatches on that marker so both queries resolve the right rows.
    select: vi.fn(() => {
      let joined = false;
      const chain: any = {};
      chain.from = vi.fn(() => chain);
      chain.innerJoin = vi.fn(() => {
        joined = true;
        return chain;
      });
      chain.where = vi.fn(() => chain);
      chain.orderBy = vi.fn(() => chain);
      chain.limit = vi.fn(() => Promise.resolve(joined ? answerRows : sessionRows));
      return chain;
    }),
    __setSessionRows(rows: any[]) {
      sessionRows = rows;
    },
    __setAnswerRows(rows: any[]) {
      answerRows = rows;
    },
  };

  return { dbMock: db, generateProfileTaglineMock: vi.fn() };
});

vi.mock('../db', () => ({ db: dbMock }));

vi.mock('../profileTaglineService', () => ({
  generateProfileTagline: generateProfileTaglineMock,
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('../lib/wecomNotifications/onboarding', () => ({
  notifyOnboardingComplete: vi.fn(),
}));

vi.mock('../lib/computeOnboardingNextStep', () => ({
  computeOnboardingNextStep: vi.fn(() => 'discover'),
}));

vi.mock('../lib/contentSafety', () => ({
  validateContentSafeAsync: vi.fn(async () => ({ safe: true })),
  contentViolationResponse: vi.fn(),
}));

vi.mock('../abuseDetection', () => ({
  recordViolation: vi.fn(),
}));

const { registerOnboardingRoutes } = await import('../routes/domains/onboarding');

const findFirstUser = dbMock.query.users.findFirst as ReturnType<typeof vi.fn>;
const findFirstInterests = dbMock.query.userInterests.findFirst as ReturnType<typeof vi.fn>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const V2_PAYLOAD = {
  insightLine: '聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里',
  lines: [
    { role: 'observation', text: '你标下的飞盘和脱口秀，都是愿意花时间的方向', aigc: false },
    { role: 'inference', text: '聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里', aigc: true },
    { role: 'reveal', text: '你看似随性，其实每次落座前都在悄悄找同频的人', aigc: true },
  ],
  evidence: [{ text: '飞盘', sourceRef: 'priority:t_frisbee' }],
  meta: {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: 'deepseek',
    fallbackUsed: false,
    promptVersion: 'profile-tagline-v2',
    aigc: { aiGenerated: true, labelType: 'ai-generated' },
  },
};

const USER_A_ROW = {
  id: 'user-a',
  archetype: 'fox',
  primaryArchetype: 'fox',
  secondaryArchetype: 'owl',
  intent: ['explore'],
};

const SESSION_A_ROW = {
  traitScores: { A: 72, C: 45, E: 60, O: 88, X: 66, P: 70 },
  topArchetypes: [
    { archetype: 'fox', score: 88 },
    { archetype: 'owl', score: 84 },
  ],
  finalResult: { secondaryArchetype: 'owl' },
  primaryArchetype: 'fox',
};

const ANSWER_A_ROWS = [
  { questionId: 'Q1', questionLevel: 3, selectedOption: 'A', answeredAt: new Date('2026-10-01T10:00:00Z') },
];

const INTERESTS_A_ROW = {
  selections: [{ topicId: 't_frisbee', label: '飞盘', heat: 86 }],
  topPriorities: [{ topicId: 't_frisbee', label: '飞盘', heat: 86 }],
};

// ── App factory ──────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  app.post('/__test__/login', (req, res) => {
    const { userId } = req.body ?? {};
    req.session.regenerate((err: any) => {
      if (err) return res.status(500).json({ message: 'Session error' });
      req.session.userId = userId;
      req.session.save(() => res.json({ ok: true }));
    });
  });

  registerOnboardingRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

/**
 * Extract scalar Param values from a drizzle SQL where-clause without
 * JSON.stringify (the column → table back-reference is circular).
 */
function extractWhereValues(where: unknown): string[] {
  const values: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, depth: number) => {
    if (depth > 8 || node === null || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'value' && typeof value === 'string') {
        values.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
      } else if (value && typeof value === 'object') {
        walk(value, depth + 1);
      }
    }
  };
  walk(where, 0);
  return values;
}

async function loginAndGetCookie(baseUrl: string, userId: string): Promise<string> {
  const res = await fetch(`${baseUrl}/__test__/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return cookieHeader(res);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/onboarding/profile-tagline (SEC-01 / REL-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.__setSessionRows([]);
    dbMock.__setAnswerRows([]);
    findFirstUser.mockResolvedValue(USER_A_ROW);
    findFirstInterests.mockResolvedValue(INTERESTS_A_ROW);
    dbMock.__setSessionRows([SESSION_A_ROW]);
    dbMock.__setAnswerRows(ANSWER_A_ROWS);
    generateProfileTaglineMock.mockResolvedValue(V2_PAYLOAD);
  });

  it('SEC-01: returns 401 for unauthenticated requests', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`);
      expect(res.status).toBe(401);
      expect(generateProfileTaglineMock).not.toHaveBeenCalled();
    });
  });

  it('SEC-01: v2 response shape — insightLine + lines[{role,text,aigc}] + evidence[{text,sourceRef}] + meta', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'user-a');
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`, { headers: { cookie } });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(typeof body.insightLine).toBe('string');
      expect(Array.isArray(body.lines)).toBe(true);
      expect(body.lines[0]).toMatchObject({ role: 'observation', aigc: false });
      expect(typeof body.lines[0].text).toBe('string');
      expect(body.lines.find((l: any) => l.role === 'inference').aigc).toBe(true);
      expect(Array.isArray(body.evidence)).toBe(true);
      expect(body.evidence[0]).toMatchObject({ text: expect.any(String), sourceRef: expect.any(String) });
      expect(body.meta).toMatchObject({ promptVersion: 'profile-tagline-v2', fallbackUsed: false });
      expect(body.meta.aigc).toBeDefined();
    });
  });

  it('SEC-01: per-user scoping — queries and service input derive from the session userId', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'user-a');
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`, { headers: { cookie } });
      expect(res.status).toBe(200);

      // The user fetch must embed the session userId in its where clause.
      const whereArg = findFirstUser.mock.calls[0][0].where;
      expect(extractWhereValues(whereArg)).toContain('user-a');

      // The service receives the session user's rows — nothing else.
      expect(generateProfileTaglineMock).toHaveBeenCalledTimes(1);
      const input = generateProfileTaglineMock.mock.calls[0][0];
      expect(input.archetype).toBe('fox');
      expect(input.secondaryArchetype).toBe('owl');
      expect(input.isBlend).toBe(true); // top-two gap 88-84=4 ≤ 8
      expect(input.traitScores).toMatchObject({ O: 88 });
      expect(input.rawAnswers).toHaveLength(1);
      expect(input.rawAnswers[0].questionId).toBe('Q1');
      expect(input.selections[0]).toMatchObject({ label: '飞盘' });
      expect(input.topPriorities[0]).toMatchObject({ label: '飞盘' });
    });
  });

  it('SEC-01: a different session user produces a differently-scoped query', async () => {
    findFirstUser.mockResolvedValue({ ...USER_A_ROW, id: 'user-b', archetype: 'koala' });
    findFirstInterests.mockResolvedValue(null);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'user-b');
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`, { headers: { cookie } });
      expect(res.status).toBe(200);

      const whereArg = findFirstUser.mock.calls[0][0].where;
      const whereValues = extractWhereValues(whereArg);
      expect(whereValues).toContain('user-b');
      expect(whereValues).not.toContain('user-a');

      const input = generateProfileTaglineMock.mock.calls[0][0];
      expect(input.archetype).toBe('koala');
      expect(input.selections).toEqual([]); // AC-13: null interests row → empty arrays
      expect(input.topPriorities).toEqual([]);
    });
  });

  it('REL-02: legacy consumer reading only insightLine + meta.aigc is unaffected by v2 fields', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'user-a');
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`, { headers: { cookie } });
      const body = (await res.json()) as any;

      // Simulate the old client's exact read pattern:
      //   profileTagline?.insightLine?.trim()
      const legacyRead: string | undefined = body?.insightLine?.trim?.();
      expect(legacyRead).toBe('聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里');
      expect(body.meta.aigc.aiGenerated).toBe(true);
      // Additive v2 fields exist but are simply ignored by the old shape.
      expect(body.lines).toBeDefined();
      expect(body.evidence).toBeDefined();
    });
  });

  it('returns 404 when the session user no longer exists', async () => {
    findFirstUser.mockResolvedValue(null);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'ghost-user');
      const res = await fetch(`${baseUrl}/api/onboarding/profile-tagline`, { headers: { cookie } });
      expect(res.status).toBe(404);
      expect(generateProfileTaglineMock).not.toHaveBeenCalled();
    });
  });
});

// ── AC-19/AC-23: entry-card insight analytics whitelist ─────────────────────

describe('POST /api/analytics/onboarding insight whitelist (AC-19 + AC-23)', () => {
  beforeEach(() => {
    // The file-level mock hygiene lives in the SEC-01 describe; this block
    // asserts exact insert counts, so clear history per test here too.
    vi.clearAllMocks();
  });

  it('accepts insight_reveal_complete with the contracted metadata shape', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_reveal_complete',
          timestamp: new Date().toISOString(),
          metadata: { shape: 'v2', lineCount: 3, hasReveal: true, fallbackUsed: false, latencyMs: 812 },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(dbMock.insert).toHaveBeenCalled();
    });
  });

  it('keeps welcome_gift_impression whitelisted (base-sprint advisory, no regression)', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'welcome_gift_impression',
          timestamp: new Date().toISOString(),
        }),
      });

      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  it('still rejects non-whitelisted event types (negative control)', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_reveal_complete_evil_suffix',
          timestamp: new Date().toISOString(),
        }),
      });

      const body = (await res.json()) as { success: boolean; error?: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('invalid eventType');
    });
  });

  // ── AC-23 (Amendment A2): insight_line_feedback ───────────────────────────

  it('accepts insight_line_feedback with the contracted anonymous metadata shape', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_line_feedback',
          timestamp: new Date().toISOString(),
          metadata: { role: 'inference', vote: 'accurate', lineIndex: 1, shape: 'v2' },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(dbMock.insert).toHaveBeenCalledTimes(1);

      // The metadata payload rides through the tolerant merge untouched —
      // no identity fields are introduced server-side.
      const valuesPayload = dbMock.insert.mock.results[0].value.values.mock.calls[0][0] as {
        eventType: string;
        metadata: Record<string, unknown>;
      };
      expect(valuesPayload.eventType).toBe('insight_line_feedback');
      expect(valuesPayload.metadata).toMatchObject({
        role: 'inference',
        vote: 'accurate',
        lineIndex: 1,
        shape: 'v2',
      });
      for (const identityKey of ['userId', 'displayName', 'openId', 'wechatOpenId']) {
        expect(valuesPayload.metadata).not.toHaveProperty(identityKey);
      }
    });
  });

  it('rejects a suffixed insight_line_feedback variant (negative control)', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_line_feedback_evil_suffix',
          timestamp: new Date().toISOString(),
        }),
      });

      const body = (await res.json()) as { success: boolean; error?: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('invalid eventType');
      expect(dbMock.insert).not.toHaveBeenCalled();
    });
  });

  // ── AC-04 (insight-share-poster): direct-sender poster telemetry ──────────
  // The client normally rides the whitelisted `interaction` channel with
  // metadata.action; these two names are whitelisted for direct senders.

  it('accepts insight_poster_created with the contracted anonymous metadata shape', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_poster_created',
          timestamp: new Date().toISOString(),
          metadata: { shape: 'v2', lineCount: 3, hasReveal: true, hasQr: true, aigcLabel: true },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(dbMock.insert).toHaveBeenCalledTimes(1);

      const valuesPayload = dbMock.insert.mock.results[0].value.values.mock.calls[0][0] as {
        eventType: string;
        metadata: Record<string, unknown>;
      };
      expect(valuesPayload.eventType).toBe('insight_poster_created');
      expect(valuesPayload.metadata).toMatchObject({
        shape: 'v2',
        lineCount: 3,
        hasReveal: true,
        hasQr: true,
        aigcLabel: true,
      });
      for (const identityKey of ['userId', 'displayName', 'openId', 'wechatOpenId']) {
        expect(valuesPayload.metadata).not.toHaveProperty(identityKey);
      }
    });
  });

  it('accepts insight_poster_shared with the option discriminator (menu vs album)', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'profile-review',
          eventType: 'insight_poster_shared',
          timestamp: new Date().toISOString(),
          metadata: { shape: 'v2', lineCount: 3, hasReveal: true, hasQr: true, aigcLabel: true, option: 'menu' },
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(dbMock.insert).toHaveBeenCalledTimes(1);

      const valuesPayload = dbMock.insert.mock.results[0].value.values.mock.calls[0][0] as {
        eventType: string;
        metadata: Record<string, unknown>;
      };
      expect(valuesPayload.eventType).toBe('insight_poster_shared');
      expect(valuesPayload.metadata).toMatchObject({ shape: 'v2', option: 'menu' });
      for (const identityKey of ['userId', 'displayName', 'openId', 'wechatOpenId']) {
        expect(valuesPayload.metadata).not.toHaveProperty(identityKey);
      }
    });
  });

  it.each(['insight_poster_created', 'insight_poster_shared'])(
    'rejects a suffixed %s variant (negative control)',
    async (eventType) => {
      await withServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/analytics/onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'profile-review',
            eventType: `${eventType}_evil_suffix`,
            timestamp: new Date().toISOString(),
          }),
        });

        const body = (await res.json()) as { success: boolean; error?: string };
        expect(body.success).toBe(false);
        expect(body.error).toBe('invalid eventType');
        expect(dbMock.insert).not.toHaveBeenCalled();
      });
    },
  );
});
