import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  embedMock,
  getInputMock,
  getExistingMock,
  upsertMock,
} = vi.hoisted(() => ({
  embedMock: vi.fn(),
  getInputMock: vi.fn(),
  getExistingMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../embeddingClient', () => ({
  embeddingClient: {
    embed: embedMock,
  },
}));

vi.mock('../repositories/userSemanticProfilesRepo', () => ({
  getSemanticProfileGenerationInput: getInputMock,
  getUserSemanticProfileByUserId: getExistingMock,
  upsertUserSemanticProfile: upsertMock,
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import {
  buildSemanticProfileDocument,
  buildSemanticProfileVersionVector,
  isVersionVectorCurrent,
  UserSemanticProfileService,
  SEMANTIC_PROFILE_GENERATOR_VERSION,
} from '../userSemanticProfileService';

describe('userSemanticProfileService', () => {
  beforeEach(() => {
    embedMock.mockReset();
    getInputMock.mockReset();
    getExistingMock.mockReset();
    upsertMock.mockReset();
  });

  it('builds a stable semantic profile document from profile and interests context', () => {
    const document = buildSemanticProfileDocument(
      {
        bio: '喜欢把轻松聊天聊出层次感',
        archetype: '机智狐',
        currentCity: '深圳',
        preferredLanguages: ['中文', 'English'],
        intent: ['make_friends'],
      } as any,
      {
        selections: [
          { label: '咖啡馆探店', heat: 25 },
          { label: '城市散步', heat: 10 },
        ],
      } as any,
    );

    expect(document).toContain('喜欢把轻松聊天聊出层次感');
    expect(document).toContain('Archetype: 机智狐');
    expect(document).toContain('Current city: 深圳');
    expect(document).toContain('Top interests: 咖啡馆探店, 城市散步');
  });

  it('marks the profile ready when embeddings succeed', async () => {
    const service = new UserSemanticProfileService();
    const updatedAt = new Date('2026-04-02T10:00:00.000Z');

    getInputMock.mockResolvedValue({
      user: {
        id: 'user-1',
        updatedAt,
        bio: '温柔但不无聊',
      },
      interests: {
        updatedAt,
        selections: [{ label: '桌游', heat: 25 }],
      },
    });
    getExistingMock.mockResolvedValue(null);
    embedMock.mockResolvedValue({
      vector: [0.1, 0.2, 0.3],
      model: 'text-embedding-3-small',
      dimensions: 3,
      provider: 'openai',
    });

    await service.recomputeNow('user-1', 'profile_setup');

    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      status: 'ready',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 3,
      lastError: null,
    }));
  });

  it('degrades safely when the embedding provider is unavailable', async () => {
    const service = new UserSemanticProfileService();

    getInputMock.mockResolvedValue({
      user: {
        id: 'user-2',
        updatedAt: new Date('2026-04-02T10:00:00.000Z'),
        bio: '喜欢认识有趣的人',
      },
      interests: null,
    });
    getExistingMock.mockResolvedValue(null);
    embedMock.mockResolvedValue(null);

    await service.recomputeNow('user-2', 'full_profile_update');

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-2',
      status: 'degraded',
      embedding: null,
      lastError: 'embedding_unavailable:full_profile_update',
    }));
  });

  it('skips recompute when the cached version vector is already current', async () => {
    const service = new UserSemanticProfileService();
    const updatedAt = new Date('2026-04-02T10:00:00.000Z');
    const versionVector = {
      profileUpdatedAt: updatedAt.toISOString(),
      interestsUpdatedAt: updatedAt.toISOString(),
      generatorVersion: SEMANTIC_PROFILE_GENERATOR_VERSION,
    };

    getInputMock.mockResolvedValue({
      user: { id: 'user-3', updatedAt, bio: '稳定输出好奇心' },
      interests: { updatedAt, selections: [] },
    });
    getExistingMock.mockResolvedValue({
      status: 'ready',
      versionVector,
    });

    await service.recomputeNow('user-3', 'interests_update');

    expect(embedMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('keeps only one recompute in flight per user and re-runs once if invalidated mid-flight', async () => {
    const service = new UserSemanticProfileService();
    const pendingResolvers: Array<() => void> = [];

    getInputMock.mockResolvedValue({
      user: { id: 'user-4', updatedAt: new Date('2026-04-02T10:00:00.000Z'), bio: '喜欢真实交流' },
      interests: null,
    });
    getExistingMock.mockResolvedValue(null);
    embedMock.mockImplementation(() => new Promise((resolve) => {
      pendingResolvers.push(() => resolve(null));
    }));

    service.queueRecompute('user-4', 'profile_setup');
    service.queueRecompute('user-4', 'interests_update');

    expect(embedMock).toHaveBeenCalledTimes(0);

    await vi.waitFor(() => {
      expect(embedMock).toHaveBeenCalledTimes(1);
    });

    pendingResolvers.shift()?.();
    await vi.waitFor(() => {
      expect(embedMock).toHaveBeenCalledTimes(2);
    });

    pendingResolvers.shift()?.();
    await service.waitForIdle('user-4');
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it('builds and compares version vectors deterministically', () => {
    const updatedAt = new Date('2026-04-02T10:00:00.000Z');
    const versionVector = buildSemanticProfileVersionVector(
      { updatedAt } as any,
      { updatedAt } as any,
    );

    expect(versionVector).toEqual({
      profileUpdatedAt: updatedAt.toISOString(),
      interestsUpdatedAt: updatedAt.toISOString(),
      generatorVersion: SEMANTIC_PROFILE_GENERATOR_VERSION,
    });

    expect(isVersionVectorCurrent({
      status: 'ready',
      versionVector,
    } as any, versionVector)).toBe(true);
  });

  it('treats invalid dates in the version vector as null instead of throwing', () => {
    const invalidDate = new Date('not-a-date');

    const versionVector = buildSemanticProfileVersionVector(
      { updatedAt: invalidDate } as any,
      { updatedAt: invalidDate } as any,
    );

    expect(versionVector).toEqual({
      profileUpdatedAt: null,
      interestsUpdatedAt: null,
      generatorVersion: SEMANTIC_PROFILE_GENERATOR_VERSION,
    });
  });
});
