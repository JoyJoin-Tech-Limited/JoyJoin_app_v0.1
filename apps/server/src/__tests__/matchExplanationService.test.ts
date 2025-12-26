/**
 * Unit Tests for Match Explanation Service
 * 
 * Tests the utility functions directly without mocking the full API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('openai', () => {
  const MockOpenAI = function() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '这两位性格互补，会有很多话题聊！' } }],
          }),
        },
      },
    };
  };
  return { default: MockOpenAI };
});

import { 
  matchExplanationService, 
  type MatchMember,
} from '../matchExplanationService';

describe('matchExplanationService', () => {
  const mockMember1: MatchMember = {
    userId: 'user-1',
    displayName: '小明',
    archetype: '开心柯基',
    secondaryArchetype: '太阳鸡',
    interestsTop: ['美食', '旅游', '摄影'],
    industry: '互联网',
    hometown: '深圳',
    socialStyle: '外向活泼',
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
  });

  describe('generateIceBreakers', () => {
    it('should return array of ice-breakers', async () => {
      const iceBreakers = await matchExplanationService.generateIceBreakers(
        [mockMember1, mockMember2],
        '饭局'
      );

      expect(Array.isArray(iceBreakers)).toBe(true);
      expect(iceBreakers.length).toBeGreaterThan(0);
    });

    it('should return appropriate topics for 酒局', async () => {
      const iceBreakers = await matchExplanationService.generateIceBreakers(
        [mockMember1, mockMember2],
        '酒局'
      );

      expect(Array.isArray(iceBreakers)).toBe(true);
    });

    it('should handle empty members array', async () => {
      const iceBreakers = await matchExplanationService.generateIceBreakers([], '饭局');
      expect(Array.isArray(iceBreakers)).toBe(true);
    });
  });
});
