import { describe, expect, it } from 'vitest'
import type { PoolGroupMemberSummary } from '@shared/api'
import {
  CHEMISTRY_TIER_EMOJI,
  buildInterestHookText,
  buildPairKeyMemberMap,
  getPairChemistryTier,
  getPairChemistryWord,
  shortenConnectionPointForPill,
  stripConnectionPointParens,
} from '../pairChemistry'

describe('pairChemistry', () => {
  describe('getPairChemistryWord', () => {
    it('maps numeric scores to temperature words and never returns a number', () => {
      expect(getPairChemistryWord(92)).toBe('超级火花')
      expect(getPairChemistryWord(85)).toBe('超级火花')
      expect(getPairChemistryWord(70)).toBe('暖意融融')
      expect(getPairChemistryWord(55)).toBe('相聊甚欢')
      expect(getPairChemistryWord(40)).toBe('慢慢发现')
    })

    it('falls back to a warm word for missing or invalid scores', () => {
      expect(getPairChemistryWord(null)).toBe('今晚有戏')
      expect(getPairChemistryWord(undefined)).toBe('今晚有戏')
      expect(getPairChemistryWord(Number.NaN)).toBe('今晚有戏')
    })
  })

  describe('getPairChemistryTier', () => {
    it('returns the correct tier for boundary scores', () => {
      expect(getPairChemistryTier(85)).toBe('fire')
      expect(getPairChemistryTier(70)).toBe('warm')
      expect(getPairChemistryTier(55)).toBe('mild')
      expect(getPairChemistryTier(40)).toBe('cold')
    })

    it('returns null for missing or invalid scores', () => {
      expect(getPairChemistryTier(null)).toBeNull()
      expect(getPairChemistryTier(undefined)).toBeNull()
      expect(getPairChemistryTier(Number.NaN)).toBeNull()
    })
  })

  describe('stripConnectionPointParens', () => {
    it('strips one pair of wrapping full-width parens', () => {
      expect(stripConnectionPointParens('（都偏内向细腻）')).toBe('都偏内向细腻')
      expect(stripConnectionPointParens('（都爱在咖啡馆里发呆）')).toBe('都爱在咖啡馆里发呆')
    })

    it('leaves non-wrapping or unbalanced parens untouched', () => {
      expect(stripConnectionPointParens('都爱看展（尤其当代）')).toBe('都爱看展（尤其当代）')
      expect(stripConnectionPointParens('（只开了头')).toBe('（只开了头')
      expect(stripConnectionPointParens('没收尾）')).toBe('没收尾）')
    })

    it('handles empty or whitespace input', () => {
      expect(stripConnectionPointParens('')).toBe('')
      expect(stripConnectionPointParens('   ')).toBe('')
      expect(stripConnectionPointParens('（）')).toBe('')
    })
  })

  describe('shortenConnectionPointForPill', () => {
    it('strips wrapping parens and leading filler words', () => {
      expect(shortenConnectionPointForPill('（都爱在咖啡馆里发呆）')).toBe('咖啡馆里发呆')
      expect(shortenConnectionPointForPill('都爱在咖啡馆里发呆')).toBe('咖啡馆里发呆')
      expect(shortenConnectionPointForPill('都喜欢动手做东西')).toBe('动手做东西')
      expect(shortenConnectionPointForPill('都偏内向细腻')).toBe('内向细腻')
      expect(shortenConnectionPointForPill('阅读习惯相似')).toBe('阅读习惯相似')
      expect(shortenConnectionPointForPill('都相信长期主义')).toBe('长期主义')
    })

    it('falls back to the stripped original when the result would be empty', () => {
      expect(shortenConnectionPointForPill('（都爱）')).toBe('都爱')
      expect(shortenConnectionPointForPill('')).toBe('')
    })
  })

  describe('buildInterestHookText', () => {
    it('returns the first non-empty trimmed interest', () => {
      const member: PoolGroupMemberSummary = {
        userId: 'u1',
        topInterests: ['   ', '攀岩'],
      }
      expect(buildInterestHookText(member)).toBe('攀岩')
    })

    it('returns empty string when no usable interests exist', () => {
      expect(buildInterestHookText({ userId: 'u1', topInterests: [] })).toBe('')
      expect(buildInterestHookText({ userId: 'u1', topInterests: ['   '] })).toBe('')
      expect(buildInterestHookText(null)).toBe('')
    })
  })

  describe('buildPairKeyMemberMap', () => {
    it('creates sorted pair keys for every unique pair', () => {
      const members = [{ userId: 'u3' }, { userId: 'u1' }, { userId: 'u2' }]
      const map = buildPairKeyMemberMap(members)

      expect(map.size).toBe(3)
      expect(map.get('u1-u2')).toEqual([{ userId: 'u1' }, { userId: 'u2' }])
      expect(map.get('u1-u3')).toEqual([{ userId: 'u3' }, { userId: 'u1' }])
      expect(map.get('u2-u3')).toEqual([{ userId: 'u3' }, { userId: 'u2' }])
    })
  })

  describe('CHEMISTRY_TIER_EMOJI', () => {
    it('covers every chemistry tier with a chemistry-icon-tier emoji key', () => {
      expect(Object.keys(CHEMISTRY_TIER_EMOJI).sort()).toEqual(['cold', 'fire', 'mild', 'warm'])
      // The emoji keys must match the shared iconSystem CHEMISTRY_BADGE_MAP
      // entries (🔥 fire / ✨ warm / 🌱 mild / 💬 cold).
      expect(CHEMISTRY_TIER_EMOJI[getPairChemistryTier(92) ?? 'cold'].emoji).toBe('🔥')
      expect(CHEMISTRY_TIER_EMOJI[getPairChemistryTier(75) ?? 'cold'].emoji).toBe('✨')
      expect(CHEMISTRY_TIER_EMOJI[getPairChemistryTier(60) ?? 'cold'].emoji).toBe('🌱')
      expect(CHEMISTRY_TIER_EMOJI[getPairChemistryTier(20) ?? 'cold'].emoji).toBe('💬')
    })
  })
})
