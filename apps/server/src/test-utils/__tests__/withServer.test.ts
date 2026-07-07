/**
 * Regression tests for the shared `withServer` test helper.
 *
 * Guards the helper's lifecycle contract: boot an Express app on a random
 * port, run a callback against it, and tear the server down while destroying
 * open sockets so the process does not hang.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import net from 'net';
import {
  withServer,
  withServerForApp,
  createWithServer,
  createWithServerAndCookie,
} from '../withServer';

function connectToPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, '127.0.0.1');
    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', (err) => reject(err));
  });
}

describe('withServer', () => {
  it('boots an Express app, makes the base URL reachable, and shuts down after the callback resolves', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('hello'));
      return app;
    };

    let capturedUrl: string | undefined;

    const result = await withServer(createApp, async (baseUrl) => {
      capturedUrl = baseUrl;
      const res = await fetch(`${baseUrl}/`);
      const text = await res.text();
      expect(text).toBe('hello');
      expect(res.status).toBe(200);
      return 'callback-result';
    });

    expect(result).toBe('callback-result');
    expect(capturedUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const { port } = new URL(capturedUrl!);
    await expect(connectToPort(Number(port))).rejects.toThrow();
  });

  it('destroys open sockets so the process does not hang when a connection is kept open', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('ok'));
      return app;
    };

    let socket: net.Socket | undefined = undefined;

    await withServer(createApp, async (baseUrl) => {
      const { port } = new URL(baseUrl);
      socket = net.createConnection(Number(port), '127.0.0.1');
      await new Promise<void>((resolve, reject) => {
        socket!.once('connect', resolve);
        socket!.once('error', reject);
      });
    });

    // The server-side socket is destroyed by closeServer; wait for the
    // client-side close event to propagate so the local socket is cleaned up.
    await new Promise<void>((resolve) => {
      if (socket!.destroyed) {
        resolve();
        return;
      }
      socket!.once('close', resolve);
      // Safety guard so the test never hangs even if the event is delayed.
      setTimeout(resolve, 1000);
    });

    expect(socket).toBeDefined();
    expect(socket!.destroyed).toBe(true);
  });

  it('rejects if the app factory throws', async () => {
    const error = new Error('factory failure');
    const createApp = () => {
      throw error;
    };

    await expect(
      withServer(createApp, async () => 'should-not-run'),
    ).rejects.toThrow('factory failure');
  });

  it('rejects if the returned app is broken and cannot be booted', async () => {
    const createApp = () => ({ not: 'an express app' }) as unknown as express.Application;

    await expect(
      withServer(createApp, async () => 'should-not-run'),
    ).rejects.toThrow();
  });

  it('can start and stop a server repeatedly', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('ok'));
      return app;
    };

    const ports: number[] = [];

    await withServer(createApp, async (baseUrl) => {
      ports.push(Number(new URL(baseUrl).port));
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
    });
    await withServer(createApp, async (baseUrl) => {
      ports.push(Number(new URL(baseUrl).port));
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
    });
    await withServer(createApp, async (baseUrl) => {
      ports.push(Number(new URL(baseUrl).port));
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
    });

    expect(ports).toHaveLength(3);
    expect(ports.every((p) => p > 0 && p < 65536)).toBe(true);
  });

  it('uses distinct ports for concurrent calls', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('ok'));
      return app;
    };

    const ports = await Promise.all([
      withServer(createApp, async (baseUrl) => Number(new URL(baseUrl).port)),
      withServer(createApp, async (baseUrl) => Number(new URL(baseUrl).port)),
      withServer(createApp, async (baseUrl) => Number(new URL(baseUrl).port)),
    ]);

    expect(new Set(ports).size).toBe(ports.length);
  });

  it('request helper resolves paths against the base URL', async () => {
    const createApp = () => {
      const app = express();
      app.get('/foo', (_req, res) => res.send('bar'));
      return app;
    };

    await withServer(createApp, async (_baseUrl, request) => {
      const res = await request('/foo');
      expect(await res.text()).toBe('bar');
    });
  });

  it('respects a custom readiness probe path and headers', async () => {
    const createApp = () => {
      const app = express();
      app.get('/health', (_req, res) => res.send('ok'));
      return app;
    };

    await withServer(
      createApp,
      async (baseUrl) => {
        const res = await fetch(`${baseUrl}/health`);
        expect(await res.text()).toBe('ok');
      },
      { readyProbe: { path: '/health', headers: { 'X-Probe': '1' } } },
    );
  });

  it('closes the server even when the callback throws', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('ok'));
      return app;
    };

    let capturedUrl: string | undefined;
    await expect(
      withServer(createApp, async (baseUrl) => {
        capturedUrl = baseUrl;
        throw new Error('callback failure');
      }),
    ).rejects.toThrow('callback failure');

    const { port } = new URL(capturedUrl!);
    await expect(connectToPort(Number(port))).rejects.toThrow();
  });
});

describe('withServerForApp', () => {
  it('works with an already-built app', async () => {
    const app = express();
    app.get('/ping', (_req, res) => res.json({ pong: true }));

    const result = await withServerForApp(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/ping`);
      return res.json();
    });

    expect(result).toEqual({ pong: true });
  });
});

describe('createWithServer', () => {
  it('returns a bound function that boots the same app factory on each call', async () => {
    const createApp = () => {
      const app = express();
      app.get('/', (_req, res) => res.send('ok'));
      return app;
    };

    const withBoundServer = createWithServer(createApp);

    const text = await withBoundServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/`);
      return res.text();
    });
    expect(text).toBe('ok');

    const status = await withBoundServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/`);
      return res.status;
    });
    expect(status).toBe(200);
  });
});

describe('createWithServerAndCookie', () => {
  it('logs in via a mocked endpoint and passes the cookie to the callback', async () => {
    const createApp = () => {
      const app = express();
      app.post('/__test__/session', (_req, res) => {
        res.setHeader('Set-Cookie', 'session=abc123; Path=/; HttpOnly');
        res.send({ ok: true });
      });
      return app;
    };

    const withServerAndCookie = createWithServerAndCookie(createApp, '/__test__/session');

    const result = await withServerAndCookie(async (baseUrl, cookie) => {
      expect(cookie).toBe('session=abc123');
      return `${baseUrl}|${cookie}`;
    });

    expect(result).toMatch(/^http:\/\/127\.0\.0\.1:\d+\|session=abc123$/);
  });
});
