import { describe, it, expect } from 'vitest'
import {
  getProfileCompletion,
  getXiaoyueGreeting,
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
