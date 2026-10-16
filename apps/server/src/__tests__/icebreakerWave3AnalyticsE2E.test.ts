/**
 * icebreaker-uiux-wave3 — Track B contract test (AC-05, OBS-01).
 *
 * E2E proof that the three Wave-1 pre-embedded funnel metrics —
 *   warmup_ready_rate / phase_completion_rate / moment_card_saved
 * flow from the client emission contract through the server whitelist and are
 * PERSISTED to `discover_analytics_events` (not merely registered in the
 * static parity list). Payloads mirror the exact client emission points:
 *   - useIcebreakerSessionAnalytics.ts (warmup exit snapshot; recap terminal)
 *   - MomentCardView.tsx (save tap)
 * A non-whitelisted sibling event must be dropped (success:false, no insert).
 */
import express from 'express';
import session from 'express-session';
import { createWithServer } from '../test-utils/withServer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverAnalyticsEvents } from '@shared/schema';

const capturedInserts: Array<{ table: unknown; values: any }> = [];

vi.mock('../db', () => ({
  db: {
    transaction: async (fn: (tx: any) => Promise<void>) =>
      fn({
        insert: (table: unknown) => ({
          values: async (values: any) => {
            capturedInserts.push({ table, values });
          },
        }),
      }),
  },
}));

const { registerAnalyticsRoutes } = await import('../routes/domains/analytics');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.post('/__test__/login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });
  registerAnalyticsRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

async function track(baseUrl: string, cookie: string, eventType: string, metadata: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/analytics/social-icebreaker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ eventType, metadata }),
  });
  return { status: response.status, body: (await response.json()) as { success?: boolean } };
}

beforeEach(() => {
  capturedInserts.length = 0;
});

describe.sequential('Wave 3 AC-05: funnel-metric events are accepted and persisted end-to-end', () => {
  it('persists warmup_ready_rate with its numerator/denominator metadata', async () => {
    await withServer(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/__test__/login/metrics-user`, { method: 'POST' });
      const cookie = cookieHeader(login);

      // Mirrors useIcebreakerSessionAnalytics.ts warmup-exit snapshot.
      const { status, body } = await track(baseUrl, cookie, 'warmup_ready_rate', {
        socialSessionId: 'social_e2e-1',
        icebreakerSessionId: 'e2e-1',
        phase: 'warmup',
        readyCount: 5,
        playerCount: 6,
        everyoneReady: false,
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);

      const insert = capturedInserts.find(
        (row) => row.table === discoverAnalyticsEvents && row.values.eventType === 'warmup_ready_rate',
      );
      expect(insert, 'warmup_ready_rate must be persisted to discover_analytics_events').toBeTruthy();
      expect(insert!.values.userId).toBe('metrics-user');
      expect(insert!.values.metadata).toMatchObject({
        socialSessionId: 'social_e2e-1',
        phase: 'warmup',
        readyCount: 5,
        playerCount: 6,
        everyoneReady: false,
      });
    });
  });

  it('persists phase_completion_rate with completed/enabled pair', async () => {
    await withServer(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/__test__/login/metrics-user`, { method: 'POST' });
      const cookie = cookieHeader(login);

      // Mirrors useIcebreakerSessionAnalytics.ts recap-terminal emission.
      const { body } = await track(baseUrl, cookie, 'phase_completion_rate', {
        socialSessionId: 'social_e2e-1',
        icebreakerSessionId: 'e2e-1',
        phase: 'recap',
        completedCount: 4,
        enabledCount: 5,
        earlyEnd: false,
        playerCount: 6,
      });
      expect(body.success).toBe(true);

      const insert = capturedInserts.find(
        (row) => row.table === discoverAnalyticsEvents && row.values.eventType === 'phase_completion_rate',
      );
      expect(insert).toBeTruthy();
      expect(insert!.values.metadata).toMatchObject({
        phase: 'recap',
        completedCount: 4,
        enabledCount: 5,
        earlyEnd: false,
      });
    });
  });

  it('persists moment_card_saved from the MomentCardView save tap', async () => {
    await withServer(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/__test__/login/metrics-user`, { method: 'POST' });
      const cookie = cookieHeader(login);

      // Mirrors MomentCardView.tsx:762 save-tap emission.
      const { body } = await track(baseUrl, cookie, 'moment_card_saved', {
        socialSessionId: 'social_e2e-1',
        icebreakerSessionId: 'e2e-1',
        phase: 'recap',
        saveTarget: 'album',
      });
      expect(body.success).toBe(true);

      const insert = capturedInserts.find(
        (row) => row.table === discoverAnalyticsEvents && row.values.eventType === 'moment_card_saved',
      );
      expect(insert).toBeTruthy();
      expect(insert!.values.metadata).toMatchObject({ phase: 'recap' });
    });
  });

  it('drops a non-whitelisted event type without persisting', async () => {
    await withServer(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/__test__/login/metrics-user`, { method: 'POST' });
      const cookie = cookieHeader(login);

      const { body } = await track(baseUrl, cookie, 'warmup_ready_rate_typo', {
        socialSessionId: 'social_e2e-1',
      });
      expect(body.success).toBe(false);
      expect(
        capturedInserts.some((row) => row.values.eventType === 'warmup_ready_rate_typo'),
      ).toBe(false);
    });
  });
});
