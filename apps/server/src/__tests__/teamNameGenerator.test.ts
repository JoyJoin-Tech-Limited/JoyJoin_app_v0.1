/**
 * Unit Tests for Team Name Generator Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database
vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

// Mock OpenAI
vi.mock('openai', () => {
  const MockOpenAI = function() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ 
              message: { 
                content: JSON.stringify({
                  teamName: "测试天团",
                  tagline: "测试用的团队标语",
                  emoji: "🎯",
                  superpowers: ["测试", "验证", "质量"],
                  vibe: "playful"
                })
              } 
            }],
          }),
        },
      },
    };
  };
  return { default: MockOpenAI };
});

import { generateAndAssignTeamName } from '../teamNameGenerator';
import type { MatchGroup } from '../poolMatchingService';

describe('Team Name Generator', () => {
  let mockGroup: MatchGroup;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.ENABLE_TEAM_NAME_GENERATION = 'true';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_TIMEOUT_MS = '5000';
    
    mockGroup = {
      members: [
        {
          userId: 'user1',
          registrationId: 'reg1',
          gender: '女性',
          age: 25,
          industry: '科技',
          educationLevel: '本科',
          archetype: '暖心熊',
          secondaryArchetype: null,
          languagesComfort: ['中文'],
          hometown: null,
          hometownAffinityOptin: false,
          budgetRange: ['100-200'],
          barBudgetRange: null,
          preferredLanguages: ['中文'],
          eventIntent: ['认识新朋友'],
          cuisinePreferences: null,
          dietaryRestrictions: null,
          tasteIntensity: null,
          barThemes: null,
          alcoholComfort: null,
          eventType: '饭局'
        }
      ],
      avgPairScore: 85,
      avgChemistryScore: 85,
      diversityScore: 70,
      energyBalance: 75,
      overallScore: 80,
      temperatureLevel: 'warm',
      explanation: 'Test group'
    };
  });

  describe('Fallback Generation', () => {
    it('should generate valid team name structure using fallback', async () => {
      // Disable API to force fallback
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'user1', archetype: '暖心熊' }
          ])
        })
      } as any);
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      } as any);

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result).toBeDefined();
      expect(result?.teamName).toBeTruthy();
      expect(result?.teamName.length).toBeGreaterThan(2);
      expect(result?.teamName.length).toBeLessThan(20);
      expect(result?.teamTagline).toBeTruthy();
      expect(result?.teamEmoji).toBeTruthy();
      expect(Array.isArray(result?.teamSuperpowers)).toBe(true);
      expect(result?.teamSuperpowers.length).toBeGreaterThan(0);
      expect(['playful', 'professional', 'creative', 'adventurous']).toContain(result?.teamVibe);
    });

    it('should handle empty member profiles gracefully', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      } as any);
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      } as any);

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result).toBeDefined();
      expect(result?.teamName).toBeTruthy();
    });
  });

  describe('Feature Flag', () => {
    it('should skip generation when feature is disabled', async () => {
      // Reset modules to pick up new env var
      vi.resetModules();
      process.env.ENABLE_TEAM_NAME_GENERATION = 'false';
      
      // Re-import after setting env var
      const { generateAndAssignTeamName } = await import('../teamNameGenerator');

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result).toBeNull();
      
      // Reset for other tests
      process.env.ENABLE_TEAM_NAME_GENERATION = 'true';
    });
  });

  describe('Validation', () => {
    it('should validate team name length', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'user1', archetype: '暖心熊' }
          ])
        })
      } as any);
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      } as any);

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result?.teamName.length).toBeGreaterThan(2);
      expect(result?.teamName.length).toBeLessThan(20);
    });

    it('should validate emoji format', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'user1', archetype: '暖心熊' }
          ])
        })
      } as any);
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      } as any);

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result?.teamEmoji).toBeTruthy();
      expect(result?.teamEmoji.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Database Integration', () => {
    it('should save team name to database', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'user1', archetype: '暖心熊' }
          ])
        })
      } as any);
      
      vi.mocked(db.update).mockImplementation(mockUpdate as any);

      await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const { db } = await import('../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error'))
        })
      } as any);

      const result = await generateAndAssignTeamName(
        'group1',
        mockGroup,
        'pool1',
        '饭局'
      );

      expect(result).toBeNull();
    });
  });
});
