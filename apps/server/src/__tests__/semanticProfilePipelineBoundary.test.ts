import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const routesSource = readFileSync(
  new URL('../routes.ts', import.meta.url),
  'utf8',
);

const profileRoutesSource = readFileSync(
  new URL('../routes/domains/profile.ts', import.meta.url),
  'utf8',
);

// The matching pipeline was split verbatim into ./matching/* modules
// (behavior-preserving modularization). Scan the barrel plus every module in the
// package so the boundary lock still covers all moved source files.
const MATCHING_DIR = fileURLToPath(new URL('../matching/', import.meta.url));
const poolMatchingSource = [
  readFileSync(new URL('../poolMatchingService.ts', import.meta.url), 'utf8'),
  ...readdirSync(MATCHING_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => readFileSync(path.join(MATCHING_DIR, file), 'utf8')),
].join('\n');

// Combined route sources for invariant checks — routes may live in domain files.
const combinedRoutesSource = routesSource + profileRoutesSource;

describe('semantic profile pipeline boundaries', () => {
  it('queues semantic profile recompute on profile and interest mutations', () => {
    expect(combinedRoutesSource).toMatch(/app\.post\('\/api\/profile\/setup'[\s\S]*queueSemanticProfileRecompute\(userId, 'profile_setup'\)/);
    expect(combinedRoutesSource).toMatch(/app\.post\('\/api\/user\/interests'[\s\S]*queueSemanticProfileRecompute\(userId, 'interests_update'\)/);
    expect(combinedRoutesSource).toMatch(/app\.patch\('\/api\/user\/interests\/nudge'[\s\S]*queueSemanticProfileRecompute\(userId, 'interests_nudge'\)/);
    expect(combinedRoutesSource).toMatch(/const user = await storage\.updateFullProfile[\s\S]*queueSemanticProfileRecompute\(userId, 'full_profile_update'\)/);
  });

  it('keeps embedding generation out of matchEventPool', () => {
    expect(poolMatchingSource).not.toContain('embeddingClient');
    expect(poolMatchingSource).not.toContain('queueSemanticProfileRecompute');
    expect(poolMatchingSource).not.toContain('userSemanticProfileService');
  });
});
