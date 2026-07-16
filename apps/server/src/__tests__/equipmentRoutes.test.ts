import express from 'express';
import session from 'express-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWithServer } from '../test-utils/withServer';

const mocks = vi.hoisted(() => ({
  flags: new Map<string, boolean>(),
  getFeatureFlag: vi.fn(),
  getMe: vi.fn(),
  saveOutfit: vi.fn(),
  draw: vi.fn(),
  getPool: vi.fn(),
  getShop: vi.fn(),
  redeemShopItem: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: mocks.getFeatureFlag,
}));

vi.mock('../services/equipmentRewardService', () => ({
  equipmentRewardService: {
    getMe: mocks.getMe,
    saveOutfit: mocks.saveOutfit,
    draw: mocks.draw,
    getPool: mocks.getPool,
    getShop: mocks.getShop,
    redeemShopItem: mocks.redeemShopItem,
  },
  isEquipmentRepositoryError: () => false,
}));

vi.mock('../lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

const { registerEquipmentRoutes } = await import('../routes/domains/equipment');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'equipment-route-test',
    resave: false,
    saveUninitialized: false,
  }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });
  registerEquipmentRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);
const entitlementId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';

async function login(baseUrl: string, userId = 'user-1'): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: 'POST' });
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

describe('equipment routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flags.clear();
    mocks.getFeatureFlag.mockImplementation(
      async (key: string, fallback = false) => mocks.flags.get(key) ?? fallback,
    );
  });

  it('fails the wardrobe surface closed when the avatar rollout is disabled', async () => {
    await withServer(async (_baseUrl, request) => {
      const response = await request('/api/equipment/me');
      expect(response.status).toBe(401);
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/equipment/me`, {
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: 'PROFILE_PIXEL_AVATAR_DISABLED',
      });
    });
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('returns the wardrobe but skips reward reconciliation when economy is disabled', async () => {
    mocks.flags.set('profilePixelAvatarEnabled', true);
    mocks.flags.set('equipmentRewardsEnabled', false);
    mocks.getMe.mockResolvedValue({ rewardsEnabled: false, inventory: [] });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/equipment/me`, {
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(200);
      expect(mocks.getMe).toHaveBeenCalledWith('user-1', { rewardsEnabled: false });
    });
  });

  it('blocks draw mutations unless the independent reward switch is enabled', async () => {
    mocks.flags.set('profilePixelAvatarEnabled', true);
    mocks.flags.set('equipmentRewardsEnabled', false);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(
        `${baseUrl}/api/equipment/entitlements/${entitlementId}/draw`,
        { method: 'POST', headers: { Cookie: cookie } },
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: 'EQUIPMENT_REWARDS_DISABLED',
      });
    });
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it('scopes draws to the authenticated user and ignores client user identity', async () => {
    mocks.flags.set('profilePixelAvatarEnabled', true);
    mocks.flags.set('equipmentRewardsEnabled', true);
    mocks.draw.mockResolvedValue({ entitlementId, resultKind: 'new' });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, 'acting-user');
      const response = await fetch(
        `${baseUrl}/api/equipment/entitlements/${entitlementId}/draw`,
        {
          method: 'POST',
          headers: { Cookie: cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'victim-user' }),
        },
      );
      expect(response.status).toBe(200);
    });
    expect(mocks.draw).toHaveBeenCalledWith('acting-user', entitlementId);
  });

  it('requires an idempotency key before spending shared fragments', async () => {
    mocks.flags.set('profilePixelAvatarEnabled', true);
    mocks.flags.set('equipmentRewardsEnabled', true);

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl);
      const response = await fetch(`${baseUrl}/api/equipment/shop/items/${itemId}/redeem`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
    });
    expect(mocks.redeemShopItem).not.toHaveBeenCalled();
  });
});
