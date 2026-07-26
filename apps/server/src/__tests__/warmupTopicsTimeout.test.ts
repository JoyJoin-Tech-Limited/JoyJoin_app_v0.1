import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isLLMTimeoutError, raceWithTimeout } from '../socialIcebreakerAIService';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

function readServerFile(relativePath: string): string {
  return readFileSync(path.join(TEST_FILE_DIR, '..', relativePath), 'utf8');
}

describe('LLM hard-bound invariant (2026-07-26 出题卡死)', () => {
  it('every social-icebreaker LLM call is race-wrapped — no bare awaits remain', () => {
    const modules = [
      'socialIcebreakerAIService.ts',
      'socialIcebreakerAuctionAI.ts',
      'socialIcebreakerPersonalityDiceAI.ts',
    ];
    for (const mod of modules) {
      const source = readServerFile(mod);
      expect(source.includes('await client.chat.completions.create'), `${mod} has a bare unbounded LLM await`).toBe(false);
    }
    // MiniScript owns a deliberate 32s pipeline AbortController + catalog
    // fallback in lib/miniscriptAgent.ts — exempt by design.
  });

  it('the race helpers live in socialIcebreakerAICore so sibling AI modules can share them without cycles', () => {
    const core = readServerFile('socialIcebreakerAICore.ts');
    expect(core).toContain('export function raceWithTimeout');
    expect(core).toContain('export const RACE_LLM_TIMEOUT_MS');
    expect(core).toContain('export function isLLMTimeoutError');
  });
});


describe('raceWithTimeout (2026-07-26 出题卡死 hard bound)', () => {
  it('resolves fast promises with their value', async () => {
    await expect(raceWithTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejects hung promises within the budget even without AbortSignal support', async () => {
    const hung = new Promise(() => {});
    const startedAt = Date.now();
    await expect(raceWithTimeout(hung, 50)).rejects.toMatchObject({
      name: 'LLMCallTimeoutError',
    });
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it('propagates the underlying rejection', async () => {
    await expect(
      raceWithTimeout(Promise.reject(new Error('provider down')), 100),
    ).rejects.toThrow('provider down');
  });
});

describe('isLLMTimeoutError', () => {
  it('classifies race timeouts, abort errors, and abort messages', () => {
    const raceTimeout = new Error('x');
    raceTimeout.name = 'LLMCallTimeoutError';
    expect(isLLMTimeoutError(raceTimeout)).toBe(true);

    const abortNamed = new Error('x');
    abortNamed.name = 'AbortError';
    expect(isLLMTimeoutError(abortNamed)).toBe(true);

    expect(isLLMTimeoutError(new Error('The operation was aborted'))).toBe(true);
    expect(isLLMTimeoutError(new Error('provider down'))).toBe(false);
    expect(isLLMTimeoutError('not an error')).toBe(false);
  });
});
