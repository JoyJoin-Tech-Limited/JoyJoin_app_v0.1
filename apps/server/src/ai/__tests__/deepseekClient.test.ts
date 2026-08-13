/**
 * Regression tests for the DeepSeek client thinking-control wrapper.
 *
 * Locks the 2026-08-11 fix: DeepSeek V4 models reason by default when a request
 * carries no thinking control. The wrapped `chat.completions.create` must
 * inject a TOP-LEVEL `thinking: { type: 'disabled' }` field unless the request
 * already carries explicit thinking control, and must leave explicitly
 * configured requests untouched.
 *
 * Note: `extra_body` is not serialized by the openai-node SDK build in use, so
 * thinking control lives at the top level of the request body.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('openai', () => ({
  default: function MockOpenAI() {
    return {
      chat: { completions: { create: mocks.create } },
    };
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    warn: mocks.warn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('getDeepseekClient thinking wrapper', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    // Re-import after resetModules so each test gets a fresh client instance.
    await import('../deepseekClient');
  });

  async function getClient() {
    const mod = await import('../deepseekClient');
    return mod.getDeepseekClient();
  }

  it('injects top-level thinking:disabled when the request carries no thinking control', async () => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
    const client = await getClient();

    const result = await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
    });

    expect(mocks.create).toHaveBeenCalledOnce();
    const received = mocks.create.mock.calls[0][0] as Record<string, unknown>;
    expect(received.thinking).toEqual({ type: 'disabled' });
    expect(result).toEqual({ choices: [{ message: { content: 'ok' } }] });
  });

  it('does not override an explicit top-level thinking control', async () => {
    mocks.create.mockResolvedValue({ choices: [] });
    const client = await getClient();

    await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [],
      // @ts-expect-error - top-level DeepSeek extension under test
      thinking: { type: 'enabled' },
    });

    const received = mocks.create.mock.calls[0][0] as Record<string, unknown>;
    expect(received.thinking).toEqual({ type: 'enabled' });
  });

  it('does not override thinking control carried in extra_body (forward-compat)', async () => {
    mocks.create.mockResolvedValue({ choices: [] });
    const client = await getClient();

    await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [],
      // @ts-expect-error - extra_body DeepSeek extension under test
      extra_body: { thinking: { type: 'enabled' } },
    });

    const received = mocks.create.mock.calls[0][0] as Record<string, unknown>;
    expect(received.extra_body).toEqual({ thinking: { type: 'enabled' } });
    expect('thinking' in received).toBe(false);
  });

  it('keeps the argument arity identical to the original create', async () => {
    mocks.create.mockResolvedValue({ choices: [] });
    const client = await getClient();

    await client.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [],
    });
    await client.chat.completions.create(
      { model: 'deepseek-v4-flash', messages: [] },
      { signal: undefined },
    );

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0]).toHaveLength(1);
    expect(mocks.create.mock.calls[1]).toHaveLength(2);
  });

  it('warns once when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await getClient();
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('DEEPSEEK_API_KEY is not set')
    );
  });
});
