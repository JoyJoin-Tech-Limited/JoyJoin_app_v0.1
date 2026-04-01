/**
 * Unit tests for the structured JSON logger
 *
 * Verifies that logger.{debug,info,warn,error} emit properly structured
 * JSON records and that child loggers propagate context correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to reset module state between tests so LOG_LEVEL changes take effect.
// Use dynamic imports with vi.resetModules() to achieve isolation.

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.resetModules();
  });

  async function importLogger(env: NodeJS.ProcessEnv = {}) {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    const mod = await import('../lib/logger');
    // Restore env (we only need the module-level state to be captured at import)
    Object.assign(process.env, saved);
    return mod;
  }

  it('emits a valid JSON line for info level', async () => {
    process.env.LOG_LEVEL = 'info';
    const { logger } = await importLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

    logger.info('hello world');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const [line] = stdoutSpy.mock.calls[0] as [string];
    const record = JSON.parse(line.trim());
    expect(record.level).toBe('info');
    expect(record.message).toBe('hello world');
    expect(typeof record.timestamp).toBe('string');
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
    expect(typeof record.service).toBe('string');
  });

  it('includes extra context fields', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

    logger.info('event registered', { eventId: 'evt-123', userId: 'u-456' });

    const [line] = stdoutSpy.mock.calls[0] as [string];
    const record = JSON.parse(line.trim());
    expect(record.eventId).toBe('evt-123');
    expect(record.userId).toBe('u-456');
  });

  it('routes warn and error to stderr', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'debug', NODE_ENV: 'production' });

    logger.warn('something looks off');
    logger.error('fatal error', { code: 500 });

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('routes debug and info to stdout', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'debug', NODE_ENV: 'production' });

    logger.debug('low level detail');
    logger.info('normal flow');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('suppresses messages below configured log level', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'warn', NODE_ENV: 'production' });

    logger.debug('should be suppressed');
    logger.info('also suppressed');
    logger.warn('should appear');

    // Only the warn line should be emitted
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('child logger inherits and merges context', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

    const child = logger.child({ request_id: 'req-abc', endpoint: '/api/events' });
    child.info('Processing request');

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const [line] = stdoutSpy.mock.calls[0] as [string];
    const record = JSON.parse(line.trim());
    expect(record.request_id).toBe('req-abc');
    expect(record.endpoint).toBe('/api/events');
    expect(record.message).toBe('Processing request');
  });

  it('child logger context does not pollute parent logger', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

    logger.child({ request_id: 'req-xyz' });
    logger.info('parent log');

    const [line] = stdoutSpy.mock.calls[0] as [string];
    const record = JSON.parse(line.trim());
    expect('request_id' in record).toBe(false);
  });

  it('nested child loggers stack context correctly', async () => {
    const { logger } = await importLogger({ LOG_LEVEL: 'info', NODE_ENV: 'production' });

    const child1 = logger.child({ request_id: 'req-1' });
    const child2 = child1.child({ userId: 'u-999' });
    child2.info('nested child log');

    const [line] = stdoutSpy.mock.calls[0] as [string];
    const record = JSON.parse(line.trim());
    expect(record.request_id).toBe('req-1');
    expect(record.userId).toBe('u-999');
  });
});
