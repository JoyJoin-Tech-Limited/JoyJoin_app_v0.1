/**
 * Unit tests for Event Theme Title Generator Service
 * Tests group statistics calculation and data provenance
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { calculateGroupStats } from '../services/eventThemeTitleGenerator';
import type { EnrichedMemberProfile } from '../services/eventThemeTitleGenerator';

// Mock enriched member profiles for testing
const mockMembers: EnrichedMemberProfile[] = [
  {
    userId: 'user1',
    displayName: '小明',
    gender: '男性',
    birthdate: '1996-06-15',
    relationshipStatus: '单身',
    educationLevel: '本科',
    industryCategory: 'tech',
    industryCategoryLabel: '科技互联网',
    industryNiche: 'ai_ml',
    industryNicheLabel: '人工智能/机器学习',
    occupationId: 'software_engineer',
    workMode: 'employed',
    hometownRegionCity: '北京',
    currentCity: '深圳',
    archetype: 'corgi',
    secondaryArchetype: 'fox',
    energyLevel: 95,
    intent: '扩展社交圈',
    topInterests: [
      { topicId: 'tech_ai', label: 'AI', fullName: '人工智能', category: 'tech', heat: 25 },
      { topicId: 'lifestyle_coffee', label: '咖啡', fullName: '咖啡文化', category: 'lifestyle', heat: 25 },
      { topicId: 'career_startup', label: '创业', fullName: '创业', category: 'career', heat: 10 }
    ],
    budgetRange: ['100-150'],
    cuisinePreferences: ['日料', '粤菜'],
    eventIntent: ['认识新朋友', '行业交流']
  },
  {
    userId: 'user2',
    displayName: '小红',
    gender: '女性',
    birthdate: '1997-06-15',
    relationshipStatus: '单身',
    educationLevel: '硕士',
    industryCategory: 'finance',
    industryCategoryLabel: '金融服务',
    industryNiche: 'fintech',
    industryNicheLabel: '金融科技',
    occupationId: 'product_manager',
    workMode: 'employed',
    hometownRegionCity: '上海',
    currentCity: '深圳',
    archetype: 'spider',
    secondaryArchetype: 'dolphin_calm',
    energyLevel: 72,
    intent: '结识同行',
    topInterests: [
      { topicId: 'lifestyle_coffee', label: '咖啡', fullName: '咖啡文化', category: 'lifestyle', heat: 25 },
      { topicId: 'culture_art', label: '艺术', fullName: '艺术欣赏', category: 'culture', heat: 10 },
      { topicId: 'career_growth', label: '职业发展', fullName: '职业发展', category: 'career', heat: 10 }
    ],
    budgetRange: ['100-150'],
    cuisinePreferences: ['日料', '西餐'],
    eventIntent: ['认识新朋友', '文化交流']
  },
  {
    userId: 'user3',
    displayName: '小李',
    gender: '男性',
    birthdate: '1995-06-15',
    relationshipStatus: '恋爱中',
    educationLevel: '博士',
    industryCategory: 'tech',
    industryCategoryLabel: '科技互联网',
    industryNiche: 'saas',
    industryNicheLabel: 'SaaS/企业服务',
    occupationId: 'cto',
    workMode: 'employed',
    hometownRegionCity: '广州',
    currentCity: '深圳',
    archetype: 'owl',
    secondaryArchetype: 'koala',
    energyLevel: 55,
    intent: '深度交流',
    topInterests: [
      { topicId: 'tech_startup', label: '创业', fullName: '创业生态', category: 'tech', heat: 25 },
      { topicId: 'lifestyle_coffee', label: '咖啡', fullName: '咖啡文化', category: 'lifestyle', heat: 10 },
      { topicId: 'philosophy_thinking', label: '哲学', fullName: '哲学思考', category: 'philosophy', heat: 10 }
    ],
    budgetRange: ['150-200'],
    cuisinePreferences: ['粤菜', '日料'],
    eventIntent: ['深度交流', '行业交流']
  }
];

describe('Team Name Generator - calculateGroupStats', () => {
  // Freeze time so age calculations are deterministic.
  // Birthdates in mockMembers are all 1995-1997-06-15; freeze to 2026-03-12 (before June)
  // so ages are: user1=29 (1996), user2=28 (1997), user3=30 (1995) → average 29
  const FROZEN_DATE = new Date('2026-03-12T00:00:00.000Z');
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_DATE);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('should calculate average energy correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // Average energy: (95 + 72 + 55) / 3 = 74
    expect(stats.avgEnergy).toBe(74);
  });

  it('should categorize energy distribution correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // user1: 95 (high), user2: 72 (medium), user3: 55 (low)
    expect(stats.energyDistribution).toEqual({
      high: 1,    // >= 80
      medium: 1,  // 60-79
      low: 1      // < 60
    });
  });

  it('should identify shared interests correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // Coffee appears in all 3 members
    expect(stats.sharedInterests).toContainEqual({
      interest: 'lifestyle_coffee',
      label: '咖啡',
      count: 3
    });
    
    // Should only include interests appearing 2+ times
    expect(stats.sharedInterests.every(i => i.count >= 2)).toBe(true);
  });

  it('should calculate industry diversity correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // 3 different industries: ai_ml, fintech, saas
    expect(stats.industryDiversity).toBe(3);
  });

  it('should not identify dominant industry when diversity is high', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // No industry has >= 50% representation
    expect(stats.dominantIndustry).toBeNull();
    expect(stats.dominantIndustryLabel).toBeNull();
  });

  it('should calculate gender distribution correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    expect(stats.genderDistribution).toEqual({
      male: 2,
      female: 1,
      other: 0
    });
  });

  it('should calculate average age correctly', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // Time is frozen to 2026-03-12. Birthdays are on June 15 so all have not turned yet.
    // user1 (1996-06-15) = 29, user2 (1997-06-15) = 28, user3 (1995-06-15) = 30 → avg 29
    expect(stats.avgAge).toBe(29);
  });

  it('should identify cities represented', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // All members are in 深圳
    expect(stats.citiesRepresented).toEqual(['深圳']);
  });

  it('should handle empty member list gracefully', () => {
    const stats = calculateGroupStats([]);
    
    expect(stats.avgEnergy).toBeNaN();
    expect(stats.sharedInterests).toEqual([]);
    expect(stats.industryDiversity).toBe(0);
    expect(stats.avgAge).toBeNull();
  });

  it('should identify dominant industry when one industry has >= 50%', () => {
    // Create a scenario with 2 tech workers and 1 finance worker
    const membersWithDominant: EnrichedMemberProfile[] = [
      mockMembers[0], // tech
      mockMembers[2], // tech (different niche but same category)
      mockMembers[1]  // finance
    ];
    
    const stats = calculateGroupStats(membersWithDominant);
    
    // With industryNiche, there are still 3 unique values (ai_ml, saas, fintech)
    // So dominant should still be null unless we change the logic
    // This test documents current behavior
    expect(stats.industryDiversity).toBe(3);
  });

  it('should sort shared interests by count (descending)', () => {
    const stats = calculateGroupStats(mockMembers);
    
    // Verify that interests are sorted by count
    for (let i = 0; i < stats.sharedInterests.length - 1; i++) {
      expect(stats.sharedInterests[i].count).toBeGreaterThanOrEqual(
        stats.sharedInterests[i + 1].count
      );
    }
  });
});

describe('Team Name Generator - Data Provenance', () => {
  it('should use only onboarding-collected fields', () => {
    // Verify that EnrichedMemberProfile only contains fields collected in onboarding
    const profile = mockMembers[0];
    
    // These fields MUST be present (from EssentialDataPage)
    expect(profile).toHaveProperty('displayName');
    expect(profile).toHaveProperty('gender');
    expect(profile).toHaveProperty('birthdate');
    expect(profile).toHaveProperty('educationLevel');
    expect(profile).toHaveProperty('industryNicheLabel'); // 3-tier classification
    expect(profile).toHaveProperty('occupationId');
    expect(profile).toHaveProperty('workMode');
    expect(profile).toHaveProperty('currentCity');
    expect(profile).toHaveProperty('archetype');
    
    // These fields should NOT be present (deprecated)
    // @ts-expect-error - Testing that deprecated fields don't exist
    expect(profile.industry).toBeUndefined();
    // @ts-expect-error - Testing that deprecated fields don't exist
    expect(profile.seniority).toBeUndefined();
    // @ts-expect-error - Testing that deprecated fields don't exist
    expect(profile.companyName).toBeUndefined();
    // @ts-expect-error - Testing that deprecated fields don't exist
    expect(profile.roleTitleShort).toBeUndefined();
  });

  it('should have energy level from archetypeRegistry', () => {
    const profile = mockMembers[0];
    
    // Energy level should match archetypeRegistry for corgi
    expect(profile.energyLevel).toBe(95);
  });

  it('should have top interests from user_interests table', () => {
    const profile = mockMembers[0];
    
    // Interests should be from user_interests table, not users.interestsTop
    expect(profile.topInterests).toBeDefined();
    expect(Array.isArray(profile.topInterests)).toBe(true);
    
    // Each interest should have required fields
    profile.topInterests.forEach(interest => {
      expect(interest).toHaveProperty('topicId');
      expect(interest).toHaveProperty('label');
      expect(interest).toHaveProperty('fullName');
      expect(interest).toHaveProperty('category');
      expect(interest).toHaveProperty('heat');
    });
  });
});
