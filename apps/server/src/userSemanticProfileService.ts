import type { User, UserInterests, UserSemanticProfile } from '@shared/schema';
import { embeddingClient } from './embeddingClient';
import { logger } from './lib/logger';
import {
  getSemanticProfileGenerationInput,
  getUserSemanticProfileByUserId,
  upsertUserSemanticProfile,
} from './repositories/userSemanticProfilesRepo';

export const SEMANTIC_PROFILE_GENERATOR_VERSION = 'semantic-profile-v1';

export interface SemanticProfileVersionVector {
  profileUpdatedAt: string | null;
  interestsUpdatedAt: string | null;
  generatorVersion: string;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildSemanticProfileVersionVector(
  user: Pick<User, 'updatedAt'>,
  interests: Pick<UserInterests, 'updatedAt'> | null,
): SemanticProfileVersionVector {
  return {
    profileUpdatedAt: toIsoString(user.updatedAt),
    interestsUpdatedAt: toIsoString(interests?.updatedAt),
    generatorVersion: SEMANTIC_PROFILE_GENERATOR_VERSION,
  };
}

export function isVersionVectorCurrent(
  existing: Pick<UserSemanticProfile, 'versionVector' | 'status'> | null,
  next: SemanticProfileVersionVector,
): boolean {
  if (!existing || existing.status !== 'ready') {
    return false;
  }

  const current = (existing.versionVector ?? {}) as Partial<SemanticProfileVersionVector>;

  return current.profileUpdatedAt === next.profileUpdatedAt
    && current.interestsUpdatedAt === next.interestsUpdatedAt
    && current.generatorVersion === next.generatorVersion;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function buildSemanticProfileDocument(
  user: Partial<User>,
  interests: Partial<UserInterests> | null,
): string {
  const selections = Array.isArray(interests?.selections)
    ? (interests.selections as Array<{ label?: string; fullName?: string; topicId?: string; heat?: number }>)
    : [];

  const topInterestLabels = selections
    .slice()
    .sort((left, right) => (Number(right.heat) || 0) - (Number(left.heat) || 0))
    .slice(0, 8)
    .map((selection) => selection.fullName ?? selection.label ?? selection.topicId ?? '')
    .filter(Boolean);

  const intents = Array.isArray(user.intent) ? user.intent : [];
  const languages = Array.isArray(user.preferredLanguages) ? user.preferredLanguages : [];
  const deepInterests = Array.isArray(user.interestsDeep) ? user.interestsDeep : [];

  const profileLines = uniqueValues([
    user.bio ?? null,
    user.archetype ? `Archetype: ${user.archetype}` : null,
    user.secondaryArchetype ? `Secondary archetype: ${user.secondaryArchetype}` : null,
    user.currentCity ? `Current city: ${user.currentCity}` : null,
    user.hometownRegionCity ? `Hometown: ${user.hometownRegionCity}` : null,
    user.educationLevel ? `Education: ${user.educationLevel}` : null,
    user.workMode ? `Work mode: ${user.workMode}` : null,
    user.industryCategoryLabel ? `Industry: ${user.industryCategoryLabel}` : null,
    user.industrySegmentLabel ? `Industry segment: ${user.industrySegmentLabel}` : null,
    user.industryNicheLabel ? `Industry niche: ${user.industryNicheLabel}` : null,
    user.tableVibePreference ? `Preferred vibe: ${user.tableVibePreference}` : null,
    intents.length > 0 ? `Intent: ${intents.join(', ')}` : null,
    languages.length > 0 ? `Languages: ${languages.join(', ')}` : null,
    topInterestLabels.length > 0 ? `Top interests: ${topInterestLabels.join(', ')}` : null,
    deepInterests.length > 0 ? `Deep interests: ${deepInterests.join(', ')}` : null,
  ]);

  if (profileLines.length === 0) {
    return 'Semantic profile unavailable: add a bio, interests, or archetype to enable semantic matching enrichment.';
  }

  return profileLines.join('\n');
}

export class UserSemanticProfileService {
  // Best-effort coalescing is process-local only. If this pipeline needs
  // cross-instance dedupe in the future, move this to a shared queue/lock.
  private pendingRecomputes = new Map<string, Promise<void>>();
  private queuedReasons = new Map<string, string>();

  queueRecompute(userId: string, reason: string): void {
    if (this.pendingRecomputes.has(userId)) {
      this.queuedReasons.set(userId, reason);
      return;
    }

    const pending = Promise.resolve()
      .then(async () => {
        await this.recomputeNow(userId, reason);
      })
      .catch((error) => {
        logger.warn('Semantic profile recompute failed softly', {
          userId,
          reason,
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      })
      .finally(() => {
        this.pendingRecomputes.delete(userId);
        const queuedReason = this.queuedReasons.get(userId);
        if (queuedReason) {
          this.queuedReasons.delete(userId);
          this.queueRecompute(userId, queuedReason);
        }
      });

    this.pendingRecomputes.set(userId, pending);
  }

  async recomputeNow(userId: string, reason: string): Promise<void> {
    const input = await getSemanticProfileGenerationInput(userId);
    if (!input) {
      return;
    }

    const versionVector = buildSemanticProfileVersionVector(input.user, input.interests);
    const existing = await getUserSemanticProfileByUserId(userId);
    if (isVersionVectorCurrent(existing, versionVector)) {
      return;
    }

    const profileDocument = buildSemanticProfileDocument(input.user, input.interests);
    const embedding = await embeddingClient.embed(profileDocument);

    await upsertUserSemanticProfile({
      userId,
      status: embedding ? 'ready' : 'degraded',
      profileDocument,
      versionVector,
      generatorVersion: SEMANTIC_PROFILE_GENERATOR_VERSION,
      embedding: embedding?.vector ?? null,
      embeddingModel: embedding?.model ?? null,
      embeddingDimension: embedding?.dimensions ?? null,
      lastError: embedding ? null : `embedding_unavailable:${reason}`,
      lastComputedAt: new Date(),
    });
  }

  async waitForIdle(userId: string): Promise<void> {
    let pending = this.pendingRecomputes.get(userId);
    while (pending) {
      await pending;
      pending = this.pendingRecomputes.get(userId);
    }
  }
}

export const userSemanticProfileService = new UserSemanticProfileService();

export function queueSemanticProfileRecompute(userId: string, reason: string): void {
  userSemanticProfileService.queueRecompute(userId, reason);
}
