import express from 'express';
import { createWithServer } from '../test-utils/withServer';
import session from 'express-session';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@shared/schema';

const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();
const mockGetAssessmentSessionByUser = vi.fn();

vi.mock('../storage', () => ({
  storage: {
    updateUser: mockUpdateUser,
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
  },
}));

const mockBuildAuthUserResponse = vi.fn().mockResolvedValue({});

vi.mock('../lib/buildAuthUserResponse', () => ({
  buildAuthUserResponse: mockBuildAuthUserResponse,
}));

const { registerAuthRoutes } = await import('../routes/domains/auth');

const baseUser: Pick<User, 'id' | 'hasCompletedPersonalityTest' | 'hasCompletedRegistration' | 'hasCompletedInterestsCarousel' | 'hasSeenProfileReview' | 'displayName' | 'gender' | 'currentCity' | 'intent' | 'hasCompletedInterestsTopics' | 'birthdate' | 'relationshipStatus'> = {
  id: 'test-user-1',
  displayName: 'TestUser',
  gender: 'male',
  currentCity: 'Shenzhen',
  intent: ['explore'],
  hasCompletedRegistration: false,
  hasCompletedPersonalityTest: false,
  hasCompletedInterestsCarousel: false,
  hasSeenProfileReview: false,
  hasCompletedInterestsTopics: false,
  birthdate: null,
  relationshipStatus: null,
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.post('/__test__/login', (req, res) => {
    const { userId } = req.body;
    req.session.regenerate((err: any) => {
      if (err) return res.status(500).json({ message: 'Session error' });
      req.session.userId = userId;
      req.session.save(() => res.json({ ok: true }));
    });
  });

  registerAuthRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function loginAndGetCookie(baseUrl: string, userId: string): Promise<string> {
  const loginResponse = await fetch(`${baseUrl}/__test__/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return cookieHeader(loginResponse);
}

describe('POST /api/auth/complete-onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAssessmentSessionByUser.mockResolvedValue(undefined);
  });

  // ── Auth required ──

  it('returns 401 for unauthenticated requests', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          currentCity: 'Shenzhen',
          intent: ['explore'],
        }),
      });
      expect(response.status).toBe(401);
    });
  });

  // ── Validation ──

  it('returns 400 when displayName is missing', async () => {
    const updatedUser = { ...baseUser, displayName: null };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ gender: 'male', currentCity: 'Shenzhen', intent: ['explore'] }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('returns 400 when gender is missing', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          currentCity: 'Shenzhen',
          intent: ['explore'],
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('returns 400 when currentCity is missing', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          intent: ['explore'],
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('returns 400 when intent is empty array', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          currentCity: 'Shenzhen',
          intent: [],
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  it('returns 400 when intent is missing', async () => {
    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          currentCity: 'Shenzhen',
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  // ── Success path ──

  it('returns 200 and calls storage.updateUser with correct fields', async () => {
    const updatedUser = {
      ...baseUser,
      displayName: 'TestUser',
      gender: 'male',
      currentCity: 'Shenzhen',
      intent: ['explore'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          currentCity: 'Shenzhen',
          intent: ['explore'],
        }),
      });
      expect(response.status).toBe(200);

      const body = await response.json() as any;
      expect(body.message).toBe('Onboarding completed');
      expect(body.user).toBeDefined();

      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateUser.mock.calls[0][1];
      expect(callArg.displayName).toBe('TestUser');
      expect(callArg.gender).toBe('male');
      expect(callArg.currentCity).toBe('Shenzhen');
      expect(callArg.intent).toEqual(['explore']);
      expect(callArg.hasCompletedRegistration).toBe(true);
      expect(callArg.hasCompletedInterestsTopics).toBe(true);
    });
  });

  it('converts birthYear to birthdate when provided', async () => {
    const updatedUser = {
      ...baseUser,
      displayName: 'TestUser',
      gender: 'female',
      currentCity: 'Beijing',
      intent: ['friendship'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
      birthdate: '1995-01-01',
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'female',
          currentCity: 'Beijing',
          intent: ['friendship'],
          birthYear: 1995,
        }),
      });

      expect(response.status).toBe(200);
      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateUser.mock.calls[0][1];
      expect(callArg.birthdate).toBe('1995-01-01');
    });
  });

  it('includes relationshipStatus when provided', async () => {
    const updatedUser = {
      ...baseUser,
      displayName: 'TestUser',
      gender: 'female',
      currentCity: 'Beijing',
      intent: ['friendship'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
      relationshipStatus: 'single',
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'female',
          currentCity: 'Beijing',
          intent: ['friendship'],
          relationshipStatus: 'single',
        }),
      });

      expect(response.status).toBe(200);
      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateUser.mock.calls[0][1];
      expect(callArg.relationshipStatus).toBe('single');
    });
  });

  it('does not include password or secrets in response', async () => {
    const updatedUser = {
      ...baseUser,
      displayName: 'TestUser',
      gender: 'male',
      currentCity: 'Shenzhen',
      intent: ['explore'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
      password: 'secret-hash',
      wechatOpenId: 'wx_openid',
      wechatSessionKey: 'wx_session_key',
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'male',
          currentCity: 'Shenzhen',
          intent: ['explore'],
        }),
      });

      const body = await response.json() as any;
      expect(body.user).not.toHaveProperty('password');
      expect(body.user).not.toHaveProperty('wechatOpenId');
      expect(body.user).not.toHaveProperty('wechatSessionKey');
    });
  });

  it('handles missing optional fields gracefully', async () => {
    const updatedUser = {
      ...baseUser,
      displayName: 'TestUser',
      gender: 'other',
      currentCity: 'Shanghai',
      intent: ['networking'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'TestUser',
          gender: 'other',
          currentCity: 'Shanghai',
          intent: ['networking'],
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  it('uses provided userId from session', async () => {
    const updatedUser = {
      ...baseUser,
      id: 'specific-user-id',
      displayName: 'Specific',
      gender: 'female',
      currentCity: 'Chengdu',
      intent: ['explore'],
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'specific-user-id');
      const response = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: 'Specific',
          gender: 'female',
          currentCity: 'Chengdu',
          intent: ['explore'],
        }),
      });

      expect(response.status).toBe(200);
      expect(mockUpdateUser).toHaveBeenCalledWith('specific-user-id', expect.anything());
    });
  });
});

describe('POST /api/auth/complete-personality-test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAssessmentSessionByUser.mockResolvedValue(undefined);
  });

  it('returns 401 for unauthenticated requests', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/complete-personality-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(401);
    });
  });

  it('returns 200 and sets hasCompletedPersonalityTest to true', async () => {
    const updatedUser = {
      ...baseUser,
      hasCompletedPersonalityTest: true,
      hasCompletedProfileSetup: true,
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-personality-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.message).toBe('Personality test completed');
      expect(body.user).toBeDefined();

      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      expect(mockUpdateUser).toHaveBeenCalledWith('test-user-1', {
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true,
      });
    });
  });

  it('does not expose secrets in response', async () => {
    const updatedUser = {
      ...baseUser,
      hasCompletedPersonalityTest: true,
      hasCompletedProfileSetup: true,
      hasCompletedRegistration: true,
      hasCompletedInterestsTopics: true,
      password: 'secret-hash',
      wechatOpenId: 'wx_openid',
      wechatSessionKey: 'wx_session_key',
    };
    mockUpdateUser.mockResolvedValue(updatedUser);

    await withServer(async (baseUrl) => {
      const cookie = await loginAndGetCookie(baseUrl, 'test-user-1');
      const response = await fetch(`${baseUrl}/api/auth/complete-personality-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({}),
      });

      const body = await response.json() as any;
      expect(body.user).not.toHaveProperty('password');
      expect(body.user).not.toHaveProperty('wechatOpenId');
      expect(body.user).not.toHaveProperty('wechatSessionKey');
    });
  });
});
