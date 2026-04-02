import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const routesSource = readFileSync(
  new URL('../routes.ts', import.meta.url),
  'utf8',
);

const poolMatchingSource = readFileSync(
  new URL('../poolMatchingService.ts', import.meta.url),
  'utf8',
);

describe('semantic profile pipeline boundaries', () => {
  it('queues semantic profile recompute on profile and interest mutations', () => {
    expect(routesSource).toMatch(/app\.post\('\/api\/profile\/setup'[\s\S]*queueSemanticProfileRecompute\(userId, 'profile_setup'\)/);
    expect(routesSource).toMatch(/app\.post\('\/api\/user\/interests'[\s\S]*queueSemanticProfileRecompute\(userId, 'interests_update'\)/);
    expect(routesSource).toMatch(/app\.patch\('\/api\/user\/interests\/nudge'[\s\S]*queueSemanticProfileRecompute\(userId, 'interests_nudge'\)/);
    expect(routesSource).toMatch(/const user = await storage\.updateFullProfile[\s\S]*queueSemanticProfileRecompute\(userId, 'full_profile_update'\)/);
  });

  it('keeps embedding generation out of matchEventPool', () => {
    expect(poolMatchingSource).not.toContain('embeddingClient');
    expect(poolMatchingSource).not.toContain('queueSemanticProfileRecompute');
    expect(poolMatchingSource).not.toContain('userSemanticProfileService');
  });
});
