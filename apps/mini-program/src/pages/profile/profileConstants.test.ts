import { describe, it, expect } from 'vitest'
import {
  getProfileCompletion,
  getProfileGrowthSummary,
  getProfilePersonalityActionLabel,
  getProfileV17DataPolicy,
  getXiaoyueGreeting,
  isProfileV17Enabled,
  MILESTONES,
  ARCHETYPE_FAMILY_NAME,
} from './profileConstants'
import type { AuthUser } from '../../hooks/useAuth'

function makeUser(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 'u1',
    nickname: 'Test',
    displayName: 'Test',
    nextStep: 'discover',
    ...partial,
  } as AuthUser
}

describe('profileConstants', () => {
  describe('isProfileV17Enabled', () => {
    it('keeps the production default enabled when the server omits the flag', () => {
      expect(isProfileV17Enabled(null)).toBe(true)
      expect(isProfileV17Enabled(makeUser({ features: {} }))).toBe(true)
    })

    it('honours both explicit server-owned rollout paths', () => {
      expect(isProfileV17Enabled(makeUser({
        features: { profileRedesignEnabled: true },
      }))).toBe(true)
      expect(isProfileV17Enabled(makeUser({
        features: { profileRedesignEnabled: false },
      }))).toBe(false)
    })
  })

  describe('getProfileV17DataPolicy', () => {
    it('stops both V1.7-only requests when the redesign flag is off', () => {
      expect(getProfileV17DataPolicy(makeUser({
        features: { profileRedesignEnabled: false },
      }), true)).toEqual({
        gamificationEnabled: false,
        storyArchivesEnabled: false,
      })
    })

    it('loads archives only when both the redesign and Alang entry are enabled', () => {
      const user = makeUser({ features: { profileRedesignEnabled: true } })

      expect(getProfileV17DataPolicy(user, false)).toEqual({
        gamificationEnabled: true,
        storyArchivesEnabled: false,
      })
      expect(getProfileV17DataPolicy(user, true)).toEqual({
        gamificationEnabled: true,
        storyArchivesEnabled: true,
      })
    })
  })

  describe('getProfilePersonalityActionLabel', () => {
    it('keeps the personality result entry in compact rollback mode', () => {
      expect(getProfilePersonalityActionLabel('corgi')).toBe('查看人格结果')
    })

    it('keeps the personality test entry before an archetype is available', () => {
      expect(getProfilePersonalityActionLabel(null)).toBe('完成人格测试')
    })
  })

  describe('getProfileGrowthSummary', () => {
    it('uses the real XP total and next-level delta', () => {
      expect(getProfileGrowthSummary({
        experiencePoints: 680,
        nextLevelInfo: { progress: 40, xpNeeded: 320 },
      })).toEqual({
        current: 680,
        nextTarget: 1000,
        progress: 40,
        isMaxLevel: false,
      })
    })

    it('clamps malformed values without inventing a next target', () => {
      expect(getProfileGrowthSummary({
        experiencePoints: -5,
        nextLevelInfo: { progress: 140, xpNeeded: 0 },
      })).toEqual({
        current: 0,
        nextTarget: null,
        progress: 100,
        isMaxLevel: true,
      })
    })
  })

  describe('getProfileCompletion', () => {
    it('returns 0 when user is missing', () => {
      expect(getProfileCompletion(null)).toBe(0)
      expect(getProfileCompletion(undefined)).toBe(0)
    })

    it('returns 40 for essential profile only', () => {
      expect(getProfileCompletion(makeUser({ profileEssentialComplete: true }))).toBe(40)
    })

    it('returns 70 for essential + extended profile', () => {
      expect(
        getProfileCompletion(
          makeUser({ profileEssentialComplete: true, profileExtendedComplete: true }),
        ),
      ).toBe(70)
    })

    it('returns 100 for complete profile with archetype', () => {
      expect(
        getProfileCompletion(
          makeUser({
            profileEssentialComplete: true,
            profileExtendedComplete: true,
            archetype: 'corgi',
          }),
        ),
      ).toBe(100)
    })

    it('adds +10 bio bonus without redistributing existing weights', () => {
      expect(
        getProfileCompletion(
          makeUser({
            profileEssentialComplete: true,
            profileExtendedComplete: true,
            archetype: 'corgi',
            bio: '你好，世界',
          }),
        ),
      ).toBe(100)
    })

    it('caps completion at 100% when bio bonus would exceed total', () => {
      expect(
        getProfileCompletion(
          makeUser({
            profileEssentialComplete: true,
            profileExtendedComplete: true,
            archetype: 'corgi',
            bio: '  多余空格也加分  ',
          }),
        ),
      ).toBe(100)
    })

    it('does not add bio bonus for empty or whitespace bio', () => {
      expect(
        getProfileCompletion(
          makeUser({
            profileEssentialComplete: true,
            profileExtendedComplete: true,
            archetype: 'corgi',
            bio: '   ',
          }),
        ),
      ).toBe(100)
      expect(
        getProfileCompletion(
          makeUser({
            profileEssentialComplete: true,
            profileExtendedComplete: false,
            archetype: 'corgi',
            bio: '',
          }),
        ),
      ).toBe(70)
    })

    it('returns 30 for archetype only', () => {
      expect(getProfileCompletion(makeUser({ archetype: 'fox' }))).toBe(30)
    })
  })

  describe('getXiaoyueGreeting', () => {
    it('prompts personality test when archetype is missing', () => {
      expect(getXiaoyueGreeting('User', null, 0, false)).toBe(
        '先测测你是哪种社交原型？',
      )
    })

    it('welcomes first-time visitors with city and archetype', () => {
      expect(getXiaoyueGreeting('User', '开心柯基', 100, true, '深圳')).toBe(
        '欢迎来到你的 JoyJoin 基地，在深圳的开心柯基',
      )
    })

    it('nudges completion when profile is incomplete', () => {
      expect(getXiaoyueGreeting('User', '开心柯基', 70, false)).toBe(
        '开心柯基，完成资料，让更多人找到你',
      )
    })

    it('defaults to exploration prompt for complete profiles', () => {
      expect(getXiaoyueGreeting('User', '开心柯基', 100, false)).toBe(
        '开心柯基，和悦聚玩家们一起探索吧',
      )
    })
  })

  describe('milestone catalog', () => {
    it('lists milestones in ascending threshold order', () => {
      const thresholds = MILESTONES.map((m) => m.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
    })

    it('has a family name for every supported archetype', () => {
      const archetypes = ['corgi', 'rooster', 'fox', 'koala', 'cat']
      archetypes.forEach((id) => {
        expect(ARCHETYPE_FAMILY_NAME[id]).toBeTruthy()
      })
    })
  })
})
