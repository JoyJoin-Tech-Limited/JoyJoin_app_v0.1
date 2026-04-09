/**
 * Unit Tests for Match Explanation Service
 * 
 * Tests the utility functions directly without mocking the full API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database to avoid needing DATABASE_URL in tests
vi.mock('../db', () => ({
  db: {
    query: {
      eventPoolGroups: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock socialModelRouter to avoid needing AI API keys in tests
vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn().mockReturnValue({
    client: {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '这两位性格互补，会有很多话题聊！' } }],
          }),
        },
      },
    },
    model: 'deepseek-chat',
    provider: 'deepseek',
  }),
  getDeepseekSelection: vi.fn().mockReturnValue({
    client: {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '这两位性格互补，会有很多话题聊！' } }],
          }),
        },
      },
    },
    model: 'deepseek-chat',
    provider: 'deepseek',
  }),
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: vi.fn(),
}));

import { 
  matchExplanationService,
  getPairExplanationForUser,
  type MatchMember,
  type GroupAnalysis,
} from '../matchExplanationService';
import { db } from '../db';
import { getClientForFunction, getDeepseekSelection } from '../ai/socialModelRouter';
import { logAITrace } from '../lib/aiTraceLogger';

describe('matchExplanationService', () => {
  const freshCacheTimestamp = () => new Date(Date.now() - 60_000).toISOString();

  const defaultSingleLineResponse = {
    choices: [{ message: { content: '这两位性格互补，会有很多话题聊！' } }],
  };

  beforeEach(() => {
    vi.mocked(db.query.eventPoolGroups.findFirst).mockResolvedValue(null);
    vi.mocked(getClientForFunction).mockReturnValue({
      client: {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(defaultSingleLineResponse),
          },
        },
      } as any,
      model: 'deepseek-chat',
      provider: 'deepseek',
    });
    vi.mocked(getDeepseekSelection).mockReturnValue({
      client: {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(defaultSingleLineResponse),
          },
        },
      } as any,
      model: 'deepseek-chat',
      provider: 'deepseek',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockMember1: MatchMember = {
    userId: 'user-1',
    displayName: '小明',
    archetype: '开心柯基',
    secondaryArchetype: '太阳鸡',
    interestsTop: ['美食', '旅游', '摄影'],
    industry: '互联网',
    hometown: '深圳',
    socialStyle: '外向活泼',
    educationLevel: '硕士',
    relationshipStatus: '单身',
    workMode: 'employed',
    industryCategory: 'tech',
    industryCategoryLabel: '科技互联网',
  };

  const mockMember2: MatchMember = {
    userId: 'user-2',
    displayName: '小红',
    archetype: '暖心熊',
    secondaryArchetype: '淡定海豚',
    interestsTop: ['美食', '健身', '读书'],
    industry: '互联网',
    hometown: '深圳',
    socialStyle: '温和内敛',
    educationLevel: '硕士',
    relationshipStatus: '单身',
    workMode: 'employed',
    industryCategory: 'tech',
    industryCategoryLabel: '科技互联网',
  };

  const mockMember3: MatchMember = {
    userId: 'user-3',
    displayName: '小华',
    archetype: '机智狐',
    interestsTop: ['电影', '音乐'],
    industry: '金融',
    hometown: '北京',
  };

  describe('getChemistryScore', () => {
    it('should return chemistry score for valid archetypes', () => {
      const score = matchExplanationService.getChemistryScore('开心柯基', '暖心熊');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return default score for null archetypes', () => {
      const score = matchExplanationService.getChemistryScore(null, null);
      expect(score).toBeGreaterThan(0);
    });

    it('should return default score for unknown archetypes', () => {
      const score = matchExplanationService.getChemistryScore('未知原型', '暖心熊');
      expect(typeof score).toBe('number');
    });
  });

  describe('findSharedInterests', () => {
    it('should find common interests between two users', () => {
      const shared = matchExplanationService.findSharedInterests(
        ['美食', '旅游', '摄影'],
        ['美食', '健身', '读书']
      );
      expect(shared).toContain('美食');
      expect(shared).toHaveLength(1);
    });

    it('should return empty array when no common interests', () => {
      const shared = matchExplanationService.findSharedInterests(
        ['旅游', '摄影'],
        ['健身', '读书']
      );
      expect(shared).toHaveLength(0);
    });

    it('should handle null interests', () => {
      const shared = matchExplanationService.findSharedInterests(null, ['美食']);
      expect(shared).toHaveLength(0);
    });

    it('should handle undefined interests', () => {
      const shared = matchExplanationService.findSharedInterests(undefined, undefined);
      expect(shared).toHaveLength(0);
    });
  });

  describe('findConnectionPoints', () => {
    it('should find hometown connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points).toContain('同乡（深圳）');
    });

    it('should find industry connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points).toContain('同行业（互联网）');
    });

    it('should find same education level connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points).toContain('同学历（硕士）');
    });

    it('should find same relationship status connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points.some(p => p.includes('单身'))).toBe(true);
    });

    it('should find same work mode + industry category compound connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points).toContain('同在科技互联网·在职');
    });

    it('should find compound hometown + industry epic connection', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember2);
      expect(points).toContain('老乡+同行（深圳·科技互联网）');
    });

    it('should find exact archetype match (epic)', () => {
      const sameArchetypeMember: MatchMember = {
        userId: 'user-same',
        displayName: '小克',
        archetype: '开心柯基',
      };
      const points = matchExplanationService.findConnectionPoints(mockMember1, sameArchetypeMember);
      expect(points.some(p => p.includes('同款人格') && p.includes('开心柯基'))).toBe(true);
    });

    it('should find deep interest overlap when ≥3 high-heat interests match', () => {
      const memberA: MatchMember = {
        userId: 'user-a',
        displayName: '甲',
        archetype: '开心柯基',
        interestsWithHeat: [
          { topicId: 'topic1', heatLevel: 2 },
          { topicId: 'topic2', heatLevel: 3 },
          { topicId: 'topic3', heatLevel: 2 },
          { topicId: 'topic4', heatLevel: 1 },
        ],
      };
      const memberB: MatchMember = {
        userId: 'user-b',
        displayName: '乙',
        archetype: '暖心熊',
        interestsWithHeat: [
          { topicId: 'topic1', heatLevel: 3 },
          { topicId: 'topic2', heatLevel: 2 },
          { topicId: 'topic3', heatLevel: 2 },
          { topicId: 'topic5', heatLevel: 3 },
        ],
      };
      const points = matchExplanationService.findConnectionPoints(memberA, memberB);
      expect(points.some(p => p.includes('深度同好'))).toBe(true);
    });

    it('should NOT show deep interest overlap when fewer than 3 high-heat interests match', () => {
      const memberA: MatchMember = {
        userId: 'user-a',
        displayName: '甲',
        archetype: '开心柯基',
        interestsWithHeat: [
          { topicId: 'topic1', heatLevel: 2 },
          { topicId: 'topic2', heatLevel: 2 },
        ],
      };
      const memberB: MatchMember = {
        userId: 'user-b',
        displayName: '乙',
        archetype: '暖心熊',
        interestsWithHeat: [
          { topicId: 'topic1', heatLevel: 2 },
          { topicId: 'topic2', heatLevel: 2 },
        ],
      };
      const points = matchExplanationService.findConnectionPoints(memberA, memberB);
      expect(points.some(p => p.includes('深度同好'))).toBe(false);
    });

    it('should show matching discussion style for the same signaled interest', () => {
      const memberA: MatchMember = {
        userId: 'user-a',
        displayName: '甲',
        archetype: '开心柯基',
        interestSignals: [
          {
            interestKey: 'hotpot',
            interestLabel: '火锅',
            enthusiasmLevel: 4,
            discussionStyle: 'casual_vibes',
            conversationDepth: 2,
          },
        ],
      };
      const memberB: MatchMember = {
        userId: 'user-b',
        displayName: '乙',
        archetype: '暖心熊',
        interestSignals: [
          {
            interestKey: 'hotpot',
            interestLabel: '火锅',
            enthusiasmLevel: 5,
            discussionStyle: 'casual_vibes',
            conversationDepth: 3,
          },
        ],
      };

      const points = matchExplanationService.findConnectionPoints(memberA, memberB);
      expect(points).toContain('火锅同款聊法（随便聊聊）');
    });

    it('should show similar conversation depth for the same signaled interest', () => {
      const memberA: MatchMember = {
        userId: 'user-a',
        displayName: '甲',
        archetype: '开心柯基',
        interestSignals: [
          {
            interestKey: 'anime',
            interestLabel: '动漫',
            enthusiasmLevel: 4,
            discussionStyle: 'plot_worldbuilding',
            conversationDepth: 2,
          },
        ],
      };
      const memberB: MatchMember = {
        userId: 'user-b',
        displayName: '乙',
        archetype: '暖心熊',
        interestSignals: [
          {
            interestKey: 'anime',
            interestLabel: '动漫',
            enthusiasmLevel: 3,
            discussionStyle: 'character_people',
            conversationDepth: 3,
          },
        ],
      };

      const points = matchExplanationService.findConnectionPoints(memberA, memberB);
      expect(points).toContain('动漫话题深度相近');
    });

    it('should NOT show relationship connection when status is 不透露', () => {
      const memberPrivate: MatchMember = {
        userId: 'user-private',
        displayName: '私密',
        archetype: null,
        relationshipStatus: '不透露',
      };
      const memberPrivate2: MatchMember = {
        userId: 'user-private2',
        displayName: '私密2',
        archetype: null,
        relationshipStatus: '不透露',
      };
      const points = matchExplanationService.findConnectionPoints(memberPrivate, memberPrivate2);
      expect(points.some(p => p.includes('不透露'))).toBe(false);
    });

    it('should return empty array when no connections', () => {
      const points = matchExplanationService.findConnectionPoints(mockMember1, mockMember3);
      expect(points).toHaveLength(0);
    });

    it('should handle missing fields', () => {
      const memberWithMissing: MatchMember = {
        userId: 'user-x',
        displayName: '测试',
        archetype: null,
      };
      const points = matchExplanationService.findConnectionPoints(mockMember1, memberWithMissing);
      expect(Array.isArray(points)).toBe(true);
    });
  });

  describe('generatePairExplanation', () => {
    it('should generate explanation with required fields', async () => {
      const explanation = await matchExplanationService.generatePairExplanation(
        mockMember1,
        mockMember2
      );

      expect(explanation).toHaveProperty('pairKey');
      expect(explanation).toHaveProperty('explanation');
      expect(explanation).toHaveProperty('chemistryScore');
      expect(explanation).toHaveProperty('sharedInterests');
      expect(explanation).toHaveProperty('connectionPoints');
    });

    it('should generate sorted pair key', async () => {
      const explanation1 = await matchExplanationService.generatePairExplanation(
        mockMember1,
        mockMember2
      );
      const explanation2 = await matchExplanationService.generatePairExplanation(
        mockMember2,
        mockMember1
      );

      expect(explanation1.pairKey).toBe(explanation2.pairKey);
    });

    it('should include chemistry score as number', async () => {
      const explanation = await matchExplanationService.generatePairExplanation(
        mockMember1,
        mockMember2
      );

      expect(typeof explanation.chemistryScore).toBe('number');
      expect(explanation.chemistryScore).toBeGreaterThan(0);
    });
  });

  describe('generateGroupAnalysis', () => {
    it('should generate analysis for a group', async () => {
      const members = [mockMember1, mockMember2, mockMember3];
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-1',
        members,
        '饭局'
      );

      expect(analysis).toHaveProperty('groupId', 'group-1');
      expect(analysis).toHaveProperty('overallChemistry');
      expect(analysis).toHaveProperty('groupDynamics');
      expect(analysis).toHaveProperty('pairExplanations');
      expect(analysis).toHaveProperty('iceBreakers');
      expect(analysis).toHaveProperty('groupThemeTags');
      expect(analysis).toHaveProperty('groupThemeCompanion');
    });

    it('should generate correct number of pair explanations', async () => {
      const members = [mockMember1, mockMember2, mockMember3];
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-1',
        members,
        '饭局'
      );

      const expectedPairs = (members.length * (members.length - 1)) / 2;
      expect(analysis.pairExplanations).toHaveLength(expectedPairs);
    });

    it('should return valid chemistry level', async () => {
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-1',
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(['fire', 'warm', 'mild', 'cold']).toContain(analysis.overallChemistry);
    });

    it('should handle empty members array', async () => {
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-1',
        [],
        '饭局'
      );

      expect(analysis.pairExplanations).toHaveLength(0);
    });

    it('should handle single member', async () => {
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-1',
        [mockMember1],
        '饭局'
      );

      expect(analysis.pairExplanations).toHaveLength(0);
    });

    // ── Normalized metadata (AIResponseMeta alignment) ──────────────────────
    it('should include normalized metadata fields on fresh generation', async () => {
      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-meta-live',
        [mockMember1, mockMember2],
        '饭局',
        false // bypass cache to force fresh generation
      );

      // provider must be a known provider string or null
      expect(['minimax', 'deepseek', null]).toContain(analysis.provider);
      // fallbackUsed must be boolean
      expect(typeof analysis.fallbackUsed).toBe('boolean');
      // fromCache must be false for a fresh generation
      expect(analysis.fromCache).toBe(false);
      // generatedAt must be a valid ISO-8601 timestamp
      expect(typeof analysis.generatedAt).toBe('string');
      expect(analysis.generatedAt).toBeTruthy();
      expect(new Date(analysis.generatedAt).toString()).not.toBe('Invalid Date');
      expect(analysis.promptVersion).toBe('group-analysis-v1');
    });

    it('should restore provider and fallbackUsed from cache metadata on cache hit', async () => {
      vi.mocked(db.query.eventPoolGroups.findFirst).mockResolvedValue({
        pairExplanationsCache: {
          memberHash: 'user-1,user-2',
          pairCount: 1,
          generatedAt: freshCacheTimestamp(),
          explanations: [{
            pairKey: 'user-1-user-2',
            explanation: '缓存的配对解释',
            chemistryScore: 80,
            sharedInterests: ['美食'],
            connectionPoints: ['同乡（深圳）'],
          }],
          provider: 'deepseek',
          fallbackUsed: false,
        },
        iceBreakersCache: {
          memberHash: 'user-1,user-2',
          eventType: '饭局',
          generatedAt: freshCacheTimestamp(),
          topics: ['缓存破冰 1', '缓存破冰 2'],
          provider: null,
          fallbackUsed: true,
        },
      } as any);

      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-meta-cache',
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(analysis.fromCache).toBe(true);
      expect(analysis.generatedAt).toBeTruthy();
      expect(analysis.provider).toBe('deepseek');
      expect(analysis.fallbackUsed).toBe(true);
      expect(analysis.promptVersion).toBe('group-analysis-v1');
      expect(analysis.iceBreakers).toEqual(['缓存破冰 1', '缓存破冰 2']);
    });

    it('should default legacy cache metadata to provider=null and fallbackUsed=false', async () => {
      vi.mocked(db.query.eventPoolGroups.findFirst).mockResolvedValue({
        pairExplanationsCache: {
          memberHash: 'user-1,user-2',
          pairCount: 1,
          generatedAt: freshCacheTimestamp(),
          explanations: [{
            pairKey: 'user-1-user-2',
            explanation: '旧缓存配对解释',
            chemistryScore: 78,
            sharedInterests: [],
            connectionPoints: [],
          }],
        },
        iceBreakersCache: {
          memberHash: 'user-1,user-2',
          eventType: '饭局',
          generatedAt: freshCacheTimestamp(),
          topics: ['旧缓存破冰 1', '旧缓存破冰 2'],
        },
      } as any);

      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-legacy-cache',
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(analysis.fromCache).toBe(true);
      expect(analysis.provider).toBe(null);
      expect(analysis.fallbackUsed).toBe(false);
      expect(analysis.promptVersion).toBe('group-analysis-v1');
    });

    it('should set fallbackUsed=false when LLM returns valid ice-breakers', async () => {
      // Override the mock to return multi-line ice-breaker content when called for ice-breakers
      const { getClientForFunction } = await import('../ai/socialModelRouter');
      const multiLineCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '你最近发现的宝藏地方是哪里？\n如果有超能力你会选什么？\n最近在看什么有意思的东西？' } }],
      });
      const singleLineCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '这两位性格互补，会有很多话题聊！' } }],
      });
      vi.mocked(getClientForFunction).mockImplementation((fnName: string) => ({
        client: { chat: { completions: { create: fnName === 'generateIceBreakers' ? multiLineCreate : singleLineCreate } } } as any,
        model: 'deepseek-chat',
        provider: 'deepseek',
      } as any));

      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-no-fallback',
        [mockMember1, mockMember2],
        '饭局',
        false
      );

      expect(analysis.fallbackUsed).toBe(false);
      expect(analysis.provider).toBe('deepseek');
      expect(analysis.promptVersion).toBe('group-analysis-v1');
    });

    it('should set fallbackUsed=true and return deterministic topics when both LLM paths fail', async () => {
      vi.mocked(getClientForFunction).mockReturnValue({
        client: {
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('primary failed')),
            },
          },
        } as any,
        model: 'minimax-chat',
        provider: 'minimax',
      } as any);
      vi.mocked(getDeepseekSelection).mockReturnValue({
        client: {
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('deepseek failed')),
            },
          },
        } as any,
        model: 'deepseek-chat',
        provider: 'deepseek',
      } as any);

      const analysis = await matchExplanationService.generateGroupAnalysis(
        'group-fallback',
        [mockMember1, mockMember2],
        '饭局',
        false
      );

      expect(analysis.fallbackUsed).toBe(true);
      expect(analysis.provider).toBe(null);
      expect(analysis.iceBreakers).toEqual([
        '最拿手的一道菜是什么？',
        '最近发现的一家宝藏餐厅是哪家？',
        '如果可以拥有一项超能力，你会选什么？',
        '周末最喜欢的放松方式是什么？',
        '最近在追什么剧或者看什么书？',
      ]);
    });

    it('logs generateGroupAnalysis success=false when only deterministic fallback content is used', async () => {
      vi.mocked(getClientForFunction).mockReturnValue({
        client: {
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('primary failed')),
            },
          },
        } as any,
        model: 'minimax-chat',
        provider: 'minimax',
      } as any);
      vi.mocked(getDeepseekSelection).mockReturnValue({
        client: {
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(new Error('deepseek failed')),
            },
          },
        } as any,
        model: 'deepseek-chat',
        provider: 'deepseek',
      } as any);

      await matchExplanationService.generateGroupAnalysis(
        'group-deterministic-fallback',
        [mockMember1, mockMember2],
        '饭局',
        false
      );

      expect(vi.mocked(logAITrace)).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'generateGroupAnalysis',
          success: false,
          provider: null,
          fallbackUsed: true,
          fromCache: false,
        })
      );
    });

    it('logs generateGroupAnalysis success=true for cached responses with unknown provider but no fallback', async () => {
      vi.mocked(db.query.eventPoolGroups.findFirst).mockResolvedValue({
        pairExplanationsCache: {
          memberHash: 'user-1,user-2',
          pairCount: 1,
          generatedAt: freshCacheTimestamp(),
          explanations: [{
            pairKey: 'user-1-user-2',
            explanation: '缓存的配对解释',
            chemistryScore: 80,
            sharedInterests: ['美食'],
            connectionPoints: ['同乡（深圳）'],
          }],
          provider: null,
          fallbackUsed: false,
        },
        iceBreakersCache: {
          memberHash: 'user-1,user-2',
          eventType: '饭局',
          generatedAt: freshCacheTimestamp(),
          topics: ['缓存破冰 1', '缓存破冰 2'],
          provider: null,
          fallbackUsed: false,
        },
      } as any);

      await matchExplanationService.generateGroupAnalysis(
        'group-cached-unknown-provider',
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(vi.mocked(logAITrace)).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'generateGroupAnalysis',
          success: true,
          provider: null,
          fallbackUsed: false,
          fromCache: true,
        })
      );
    });
  });

  describe('generateIceBreakers', () => {
    it('should return iceBreakers array and fallbackUsed flag', async () => {
      const result = await matchExplanationService.generateIceBreakers(
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(Array.isArray(result.iceBreakers)).toBe(true);
      expect(result.iceBreakers.length).toBeGreaterThan(0);
      expect(['minimax', 'deepseek', null]).toContain(result.providerUsed);
      expect(typeof result.fallbackUsed).toBe('boolean');
    });

    it('should return appropriate topics for 酒局', async () => {
      const result = await matchExplanationService.generateIceBreakers(
        [mockMember1, mockMember2],
        '酒局'
      );

      expect(Array.isArray(result.iceBreakers)).toBe(true);
    });

    it('should handle empty members array', async () => {
      const result = await matchExplanationService.generateIceBreakers([], '饭局');
      expect(Array.isArray(result.iceBreakers)).toBe(true);
    });
  });

  describe('getPairExplanationForUser', () => {
    // A minimal GroupAnalysis fixture with pre-built pairExplanations
    const makeAnalysis = (pairKeys: string[]): GroupAnalysis => ({
      groupId: 'group-1',
      overallChemistry: 'warm',
      groupDynamics: '测试组合',
      iceBreakers: [],
      groupThemeTags: [],
      groupThemeCompanion: '',
      pairExplanations: pairKeys.map((pairKey) => ({
        pairKey,
        explanation: '测试解释',
        chemistryScore: 80,
        sharedInterests: [],
        connectionPoints: [],
      })),
    });

    it('should return pairs where viewer is sorted first (prefix)', () => {
      // 'user-1' sorts before 'user-2' lexicographically
      const analysis = makeAnalysis(['user-1-user-2', 'user-2-user-3']);
      const result = getPairExplanationForUser(analysis, 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0].pairKey).toBe('user-1-user-2');
    });

    it('should return pairs where viewer is sorted second (suffix)', () => {
      // 'user-3' sorts after 'user-2' lexicographically
      const analysis = makeAnalysis(['user-1-user-2', 'user-2-user-3']);
      const result = getPairExplanationForUser(analysis, 'user-3');
      expect(result).toHaveLength(1);
      expect(result[0].pairKey).toBe('user-2-user-3');
    });

    it('should return all pairs involving the viewer', () => {
      const analysis = makeAnalysis(['user-1-user-2', 'user-1-user-3', 'user-2-user-3']);
      const result = getPairExplanationForUser(analysis, 'user-1');
      expect(result).toHaveLength(2);
      expect(result.map(r => r.pairKey)).toEqual(
        expect.arrayContaining(['user-1-user-2', 'user-1-user-3'])
      );
    });

    it('should return empty array for unknown viewer', () => {
      const analysis = makeAnalysis(['user-1-user-2', 'user-2-user-3']);
      const result = getPairExplanationForUser(analysis, 'user-99');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty viewerUserId', () => {
      const analysis = makeAnalysis(['user-1-user-2']);
      const result = getPairExplanationForUser(analysis, '');
      expect(result).toHaveLength(0);
    });

    it('should not produce false positives for UUID-like IDs', () => {
      // UUID format: 8-4-4-4-12
      const id1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const id2 = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj';
      // id1 < id2 lexicographically so pairKey = id1 + '-' + id2
      const pairKey = [id1, id2].sort().join('-');
      const analysis = makeAnalysis([pairKey]);

      const resultForId1 = getPairExplanationForUser(analysis, id1);
      expect(resultForId1).toHaveLength(1);

      const resultForId2 = getPairExplanationForUser(analysis, id2);
      expect(resultForId2).toHaveLength(1);

      // A different ID that shares a prefix with id1 should NOT match
      const otherId = 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff';
      const resultForOther = getPairExplanationForUser(analysis, otherId);
      expect(resultForOther).toHaveLength(0);
    });
  });
});
