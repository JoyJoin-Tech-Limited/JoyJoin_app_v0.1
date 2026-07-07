/**
 * Shared test helper that boots an Express app on a random port and runs a test
 * function against it. Handles server lifecycle, graceful cleanup, and provides
 * a convenience `request` wrapper so tests do not repeatedly build URLs.
 */
import express from 'express';
import http from 'http';
import type { Socket } from 'net';

const READY_TIMEOUT_MS = 5000;
const READY_PROBE_INITIAL_INTERVAL_MS = 25;
const READY_PROBE_MAX_INTERVAL_MS = 100;
const READY_FETCH_TIMEOUT_MS = 100;
const SERVER_CLOSE_TIMEOUT_MS = 5000;

/**
 * Convenience wrapper around `fetch` that resolves `path` against the test
 * server's base URL. Absolute URLs are passed through unchanged.
 */
export type RequestHelper = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

export interface ReadyProbeOptions {
  /** Path to probe (default: `/`). */
  path?: string;
  /** Additional headers for the readiness probe request. */
  headers?: Record<string, string>;
  /** Maximum number of probe attempts (default: 500). */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 25). */
  intervalMs?: number;
  /** Maximum delay between retries in ms (default: 100). */
  maxIntervalMs?: number;
  /** Per-probe fetch timeout in ms (default: 100). */
  fetchTimeoutMs?: number;
}

export interface WithServerOptions {
  /** Options for the readiness probe that waits for the server to accept traffic. */
  readyProbe?: ReadyProbeOptions;
}

interface BootResult {
  server: http.Server;
  baseUrl: string;
  request: RequestHelper;
  closeServer: () => Promise<void>;
}

/**
 * Build a fetch helper that resolves `path` against the test server's base URL.
 */
function buildRequest(baseUrl: string): RequestHelper {
  return (path, init) => {
    const url = new URL(path, baseUrl).toString();
    return fetch(url, init);
  };
}

/**
 * Boot `app` on a random port, track open sockets, and poll until the server
 * accepts HTTP traffic. Returns the server, base URL, a request helper, and a
 * close function that destroys sockets and enforces a shutdown timeout.
 */
async function bootServer(
  app: express.Application,
  options: WithServerOptions = {},
): Promise<BootResult> {
  const connections = new Set<Socket>();

  const server = await new Promise<http.Server>((resolve, reject) => {
    const instance = app.listen(0);

    const onConnection = (socket: Socket) => {
      connections.add(socket);
      socket.once('close', () => {
        connections.delete(socket);
      });
    };

    const onError = (err: Error) => {
      instance.off('connection', onConnection);
      reject(err);
    };

    instance.on('connection', onConnection);
    instance.once('error', onError);
    instance.once('listening', () => {
      instance.off('error', onError);
      resolve(instance);
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error(
      `Expected server address to be AddressInfo, got ${address ?? 'null'}`,
    );
  }
  const { port } = address;
  const baseUrl = `http://127.0.0.1:${port}`;
  const request = buildRequest(baseUrl);

  const probeOptions = options.readyProbe ?? {};
  const probePath = probeOptions.path ?? '/';
  const probeUrl = new URL(probePath, baseUrl).toString();
  const maxRetries = probeOptions.maxRetries ?? 500;
  const initialIntervalMs =
    probeOptions.intervalMs ?? READY_PROBE_INITIAL_INTERVAL_MS;
  const maxIntervalMs =
    probeOptions.maxIntervalMs ?? READY_PROBE_MAX_INTERVAL_MS;
  const fetchTimeoutMs =
    probeOptions.fetchTimeoutMs ?? READY_FETCH_TIMEOUT_MS;

  // Readiness probe: retry with exponential backoff until the server responds.
  const startTime = Date.now();
  const deadline = startTime + READY_TIMEOUT_MS;
  let lastError: Error | undefined;
  let ready = false;
  let attempts = 0;
  let intervalMs = initialIntervalMs;

  while (Date.now() < deadline && attempts < maxRetries) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      const res = await fetch(probeUrl, {
        signal: controller.signal,
        headers: probeOptions.headers,
      });
      // Accept any HTTP response (1xx–5xx, including 404).
      if (res.status >= 100 && res.status < 600) {
        await res.body?.cancel().catch(() => {
          // Ignore cancellation errors; the response body is not needed.
        });
        ready = true;
        break;
      }
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
    intervalMs = Math.min(maxIntervalMs, intervalMs * 2);
  }

  const closeServer = async (): Promise<void> => {
    let settled = false;
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          // eslint-disable-next-line no-console
          console.warn('withServer: server.close timed out; forcing teardown');
          resolve();
        }
      }, SERVER_CLOSE_TIMEOUT_MS);

      server.close((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (err) {
            // eslint-disable-next-line no-console
            console.warn('withServer: server.close error during teardown', {
              error: err.message,
            });
          }
          resolve();
        }
      });

      for (const socket of connections) {
        socket.destroy();
      }
    });
  };

  if (!ready) {
    const elapsedMs = Date.now() - startTime;
    await closeServer();
    throw new Error(
      `Server readiness probe failed for ${baseUrl} (path: ${probePath}) after ${attempts} attempt(s) over ${elapsedMs}ms. ` +
        `Last error: ${lastError?.message ?? 'none'}`,
    );
  }

  return { server, baseUrl, request, closeServer };
}

/**
 * Boot the app produced by `createApp`, wait for it to accept HTTP traffic,
 * then run `fn`. The server is always closed in a `finally` block, with open
 * connections destroyed to avoid test hangs.
 *
 * The second callback argument is an optional `request` helper that resolves
 * paths against the server's base URL.
 */
export async function withServer<T>(
  createApp: () => express.Application,
  fn: (baseUrl: string, request: RequestHelper) => Promise<T>,
  options?: WithServerOptions,
): Promise<T> {
  const app = createApp();
  const { baseUrl, request, closeServer } = await bootServer(app, options);
  try {
    return await fn(baseUrl, request);
  } finally {
    await closeServer();
  }
}

/**
 * Same as `withServer`, but accepts an already-built Express app.
 * Useful when the test file needs to configure middleware/routes itself.
 */
export async function withServerForApp<T>(
  app: express.Application,
  fn: (baseUrl: string, request: RequestHelper) => Promise<T>,
  options?: WithServerOptions,
): Promise<T> {
  const { baseUrl, request, closeServer } = await bootServer(app, options);
  try {
    return await fn(baseUrl, request);
  } finally {
    await closeServer();
  }
}

/**
 * Bind a `createApp` factory to a `withServer` function with the signature
 * `withServer<T>(fn: (baseUrl: string, request: RequestHelper) => Promise<T>): Promise<T>`.
 *
 * Usage in a test file:
 *   const withServer = createWithServer(createApp);
 *   await withServer(async (baseUrl, request) => { ... });
 */
export function createWithServer(createApp: () => express.Application) {
  return async <T>(
    fn: (baseUrl: string, request: RequestHelper) => Promise<T>,
    options?: WithServerOptions,
  ): Promise<T> => {
    return withServer(createApp, fn, options);
  };
}

/**
 * Bind a `createApp` factory to a `withServer` function that also logs in via a
 * test endpoint and passes the resulting cookie to the test function.
 *
 * Usage in a test file:
 *   const withServer = createWithServerAndCookie(createApp, '/__test__/super-session');
 *   await withServer(async (baseUrl, cookie, request) => { ... });
 */
export function createWithServerAndCookie(
  createApp: () => express.Application,
  loginPath: string,
) {
  return async <T>(
    fn: (baseUrl: string, cookie: string, request: RequestHelper) => Promise<T>,
    options?: WithServerOptions,
  ): Promise<T> => {
    return withServer(
      createApp,
      async (baseUrl, request) => {
        const sessionResponse = await request(loginPath, { method: 'POST' });
        const cookie =
          sessionResponse.headers.get('set-cookie')?.split(';')[0] ?? '';
        return fn(baseUrl, cookie, request);
      },
      options,
    );
  };
}
