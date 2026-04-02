import {
  userInterests,
  userSemanticProfiles,
  users,
  type User,
  type UserInterests,
  type UserSemanticProfile,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { SemanticProfileVersionVector } from '../userSemanticProfileService';

export interface SemanticProfileGenerationInput {
  user: User;
  interests: UserInterests | null;
}

export type SemanticProfileStatus = 'pending' | 'ready' | 'degraded';

export interface UpsertSemanticProfileRecord {
  userId: string;
  status: SemanticProfileStatus;
  profileDocument: string;
  versionVector: SemanticProfileVersionVector;
  generatorVersion: string;
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  lastError: string | null;
  lastComputedAt: Date;
}

export async function getUserSemanticProfileByUserId(userId: string): Promise<UserSemanticProfile | null> {
  const existing = await db.query.userSemanticProfiles.findFirst({
    where: eq(userSemanticProfiles.userId, userId),
  });

  return existing ?? null;
}

export async function getSemanticProfileGenerationInput(
  userId: string,
): Promise<SemanticProfileGenerationInput | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const interests = await db.query.userInterests.findFirst({
    where: eq(userInterests.userId, userId),
  });

  return {
    user,
    interests: interests ?? null,
  };
}

export async function upsertUserSemanticProfile(
  record: UpsertSemanticProfileRecord,
): Promise<void> {
  await db
    .insert(userSemanticProfiles)
    .values({
      userId: record.userId,
      status: record.status,
      profileDocument: record.profileDocument,
      versionVector: record.versionVector,
      generatorVersion: record.generatorVersion,
      embedding: record.embedding,
      embeddingModel: record.embeddingModel,
      embeddingDimension: record.embeddingDimension,
      lastError: record.lastError,
      lastComputedAt: record.lastComputedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSemanticProfiles.userId,
      set: {
        status: record.status,
        profileDocument: record.profileDocument,
        versionVector: record.versionVector,
        generatorVersion: record.generatorVersion,
        embedding: record.embedding,
        embeddingModel: record.embeddingModel,
        embeddingDimension: record.embeddingDimension,
        lastError: record.lastError,
        lastComputedAt: record.lastComputedAt,
        updatedAt: new Date(),
      },
    });
}
