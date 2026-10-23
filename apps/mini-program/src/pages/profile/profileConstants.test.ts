import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  getProfileCompletion,
  getProfileGrowthSummary,
  getProfilePersonalityActionLabel,
  getProfileV17DataPolicy,
  isProfileV17Enabled,
  MILESTONES,
  ARCHETYPE_FAMILY_NAME,
  ARCHETYPE_GREETINGS,
  getDailyGreeting,
  getStreakMilestoneTeaser,
  getStreakContinuationTarget,
  getNextUpcomingRegistration,
  getEventDayGreeting,
  formatChapterDate,
  stripChapterDatePrefix,
  getBadgeProximity,
  PROFILE_STORY_ARTWORK_PATH,
} from './profileConstants'
import type { PoolRegistrationSummary } from '@shared/api'
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
  it('keeps the Profile story artwork in the main package', () => {
    expect(PROFILE_STORY_ARTWORK_PATH).toMatch(/^\/assets\//)
    expect(PROFILE_STORY_ARTWORK_PATH).not.toContain('/pages/alang/')
    expect(existsSync(resolve(process.cwd(), 'src', PROFILE_STORY_ARTWORK_PATH.slice(1)))).toBe(true)
    expect(readFileSync(resolve(process.cwd(), 'config/index.ts'), 'utf8'))
      .toContain('dist/assets/lovart/alang-result-candidate.webp')
    expect(readFileSync(resolve(process.cwd(), 'scripts/clean-cdn-assets.mjs'), 'utf8'))
      .toContain("'alang-result-candidate.webp'")
  })

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
      }))).toEqual({
        gamificationEnabled: false,
        equipmentEnabled: false,
        personalStoryEnabled: false,
      })
    })

    it('keeps pixel inventory and personal story on independent server flags', () => {
      const user = makeUser({
        features: {
          profileRedesignEnabled: true,
          profilePixelAvatarEnabled: true,
          personalStoryEnabled: true,
        },
      })

      expect(getProfileV17DataPolicy(user)).toEqual({
        gamificationEnabled: true,
        equipmentEnabled: true,
        personalStoryEnabled: true,
      })
    })
  })

  describe('getProfilePersonalityActionLabel', () => {
    it('keeps the personality result entry in compact rollback mode', () => {
      expect(getProfilePersonalityActionLabel('corgi')).toBe('回看氛围报告')
    })

    it('keeps the personality test entry before an archetype is available', () => {
      expect(getProfilePersonalityActionLabel(null)).toBe('完成氛围测试')
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

describe('getDailyGreeting (P0-3, 2026-10-22)', () => {
  it('returns a greeting from the archetype pool', () => {
    const greeting = getDailyGreeting('corgi', new Date('2026-10-22T08:00:00'))
    expect(greeting).not.toBeNull()
    expect(ARCHETYPE_GREETINGS.corgi).toContain(greeting)
  })

  it('is deterministic within a day and rotates across days', () => {
    const morning = new Date('2026-10-22T08:00:00')
    const evening = new Date('2026-10-22T20:00:00')
    expect(getDailyGreeting('fox', morning)).toBe(getDailyGreeting('fox', evening))
    // +1 day always shifts dayOfYear % pool.length by one → a different pool entry.
    const nextDay = new Date('2026-10-23T08:00:00')
    expect(getDailyGreeting('fox', nextDay)).not.toBe(getDailyGreeting('fox', morning))
  })

  it('returns null for unknown or missing archetypes', () => {
    expect(getDailyGreeting('nope')).toBeNull()
    expect(getDailyGreeting(null)).toBeNull()
    expect(getDailyGreeting(undefined)).toBeNull()
  })

  it('every family-named archetype also has a greeting pool', () => {
    for (const key of Object.keys(ARCHETYPE_FAMILY_NAME)) {
      expect(ARCHETYPE_GREETINGS[key]?.length).toBeGreaterThan(0)
    }
  })

  it('keeps pool depth at 5 per archetype (2026-10-23 re-audit a3) and copy-safe', () => {
    const banned = ['匹配', '社交', '灵魂', 'AI', '会员', 'VIP', '诱导']
    for (const [key, pool] of Object.entries(ARCHETYPE_GREETINGS)) {
      expect(pool.length, `${key} pool depth`).toBe(5)
      for (const line of pool) {
        for (const token of banned) {
          expect(line, `${key}: "${line}" contains banned token ${token}`).not.toContain(token)
        }
      }
    }
  })
})

describe('getStreakMilestoneTeaser (P0-4, 2026-10-22)', () => {
  it('fires exactly one week before each ladder rung (3/6/12 → +200/+500/+1000)', () => {
    expect(getStreakMilestoneTeaser(2)).toEqual({ weeks: 3, xp: 200 })
    expect(getStreakMilestoneTeaser(5)).toEqual({ weeks: 6, xp: 500 })
    expect(getStreakMilestoneTeaser(11)).toEqual({ weeks: 12, xp: 1000 })
  })

  it('stays quiet off-rung — including N=8, where the naive 3-(N%3)===1 check misfires', () => {
    expect(getStreakMilestoneTeaser(0)).toBeNull()
    expect(getStreakMilestoneTeaser(1)).toBeNull()
    expect(getStreakMilestoneTeaser(3)).toBeNull()
    expect(getStreakMilestoneTeaser(7)).toBeNull()
    expect(getStreakMilestoneTeaser(8)).toBeNull()
    expect(getStreakMilestoneTeaser(12)).toBeNull()
    expect(getStreakMilestoneTeaser(-1)).toBeNull()
  })
})

// ---- Full-marks Wave A (2026-10-23, PM plan) -------------------------------

function makeRegistration(partial: Partial<PoolRegistrationSummary>): PoolRegistrationSummary {
  return {
    id: 'reg-1',
    matchStatus: 'pending',
    poolDateTime: '2026-10-25T11:30:00.000Z',
    finalDateTime: null,
    poolDistrict: null,
    ...partial,
  } as PoolRegistrationSummary
}

describe('getStreakContinuationTarget (A5-1)', () => {
  // Server truth (gamificationService.updateStreak): UTC 'YYYY-MM-DD'
  // lastActivityDate; gap 0 → no increment (safe), 1 → +1, 2 + freeze → +1,
  // else reset. All fixtures below pin UTC ISO weeks.
  const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0)) // Wed 2026-10-21, ISO W43

  it('returns null when the streak is zero or the date is missing/invalid', () => {
    expect(getStreakContinuationTarget(0, '2026-10-14', false, NOW)).toBeNull()
    expect(getStreakContinuationTarget(3, null, false, NOW)).toBeNull()
    expect(getStreakContinuationTarget(3, 'not-a-date', false, NOW)).toBeNull()
  })

  it('returns null when the user already attended this week (gap 0 — safe)', () => {
    expect(getStreakContinuationTarget(3, '2026-10-19', false, NOW)).toBeNull() // Mon W43
    expect(getStreakContinuationTarget(3, '2026-10-21', false, NOW)).toBeNull() // same day
  })

  it('returns streak + 1 when last week was the last attendance (gap 1)', () => {
    expect(getStreakContinuationTarget(3, '2026-10-14', false, NOW)).toBe(4) // Wed W42
  })

  it('returns streak + 1 at gap 2 only while a freeze card covers the skip', () => {
    expect(getStreakContinuationTarget(3, '2026-10-07', true, NOW)).toBe(4) // W41 + freeze
    expect(getStreakContinuationTarget(3, '2026-10-07', false, NOW)).toBeNull()
  })

  it('returns null when the server would already have reset (gap ≥ 3)', () => {
    expect(getStreakContinuationTarget(3, '2026-09-30', true, NOW)).toBeNull()
    expect(getStreakContinuationTarget(3, '2026-09-01', false, NOW)).toBeNull()
  })

  it('handles the ISO year boundary like the server (2025-W52 → 2026-W01 = gap 1)', () => {
    const newYear = new Date(Date.UTC(2025, 11, 30, 12, 0, 0)) // Tue 2025-12-30, ISO 2026-W01
    expect(getStreakContinuationTarget(5, '2025-12-28', false, newYear)).toBe(6) // Sun 2025-W52
  })
})

describe('getNextUpcomingRegistration (A5-2)', () => {
  const NOW = new Date('2026-10-22T10:00:00.000Z')

  it('returns null for empty input, past events, and non-upcoming statuses', () => {
    expect(getNextUpcomingRegistration(null, NOW)).toBeNull()
    expect(getNextUpcomingRegistration([], NOW)).toBeNull()
    expect(
      getNextUpcomingRegistration(
        [makeRegistration({ poolDateTime: '2026-10-20T11:00:00.000Z' })],
        NOW,
      ),
    ).toBeNull()
    expect(
      getNextUpcomingRegistration(
        [
          makeRegistration({ matchStatus: 'completed', poolDateTime: '2026-10-25T11:00:00.000Z' }),
          makeRegistration({ matchStatus: 'unmatched', poolDateTime: '2026-10-25T11:00:00.000Z' }),
        ],
        NOW,
      ),
    ).toBeNull()
  })

  it('picks the soonest pending/matched registration', () => {
    const soon = makeRegistration({ id: 'soon', matchStatus: 'matched', poolDateTime: '2026-10-23T11:00:00.000Z' })
    const later = makeRegistration({ id: 'later', poolDateTime: '2026-10-26T11:00:00.000Z' })
    expect(getNextUpcomingRegistration([later, soon], NOW)?.id).toBe('soon')
  })

  it('prefers finalDateTime over poolDateTime (matched reveal time wins)', () => {
    // reg's poolDateTime (23rd 11:00) is earlier than other's (23rd 12:00),
    // but its finalDateTime (24th 11:00) is LATER — so finalDateTime
    // precedence means `other` must win. Without precedence reg would win.
    const reg = makeRegistration({
      id: 'final-wins',
      matchStatus: 'matched',
      poolDateTime: '2026-10-23T11:00:00.000Z',
      finalDateTime: '2026-10-24T11:00:00.000Z',
    })
    const other = makeRegistration({ id: 'other', poolDateTime: '2026-10-23T12:00:00.000Z' })
    expect(getNextUpcomingRegistration([reg, other], NOW)?.id).toBe('other')
  })
})

describe('getEventDayGreeting (A4-3)', () => {
  it('greets with time + district when an event happens today', () => {
    const now = new Date(2026, 9, 22, 10, 0, 0) // local 2026-10-22 10:00
    const tonight = new Date(2026, 9, 22, 19, 30, 0).toISOString()
    const reg = makeRegistration({ matchStatus: 'matched', poolDateTime: tonight, poolDistrict: '南山区' })
    expect(getEventDayGreeting([reg], now)).toBe('今天 19:30 有局 · 南山区见')
  })

  it('omits the district suffix when none is known', () => {
    const now = new Date(2026, 9, 22, 7, 0, 0) // local 07:00 — event still upcoming
    const thisMorning = new Date(2026, 9, 22, 8, 5, 0).toISOString()
    expect(getEventDayGreeting([makeRegistration({ poolDateTime: thisMorning })], now))
      .toBe('今天 08:05 有局')
  })

  it('returns null for tomorrow / yesterday / nothing upcoming', () => {
    const now = new Date(2026, 9, 22, 10, 0, 0)
    const tomorrow = new Date(2026, 9, 23, 19, 30, 0).toISOString()
    const yesterday = new Date(2026, 9, 21, 19, 30, 0).toISOString()
    expect(getEventDayGreeting([makeRegistration({ poolDateTime: tomorrow })], now)).toBeNull()
    expect(getEventDayGreeting([makeRegistration({ poolDateTime: yesterday })], now)).toBeNull()
    expect(getEventDayGreeting([], now)).toBeNull()
    expect(getEventDayGreeting(null, now)).toBeNull()
  })
})

describe('formatChapterDate (A2-3)', () => {
  it('formats an ISO timestamp as M月D日', () => {
    const iso = new Date(2026, 8, 9, 20, 0, 0).toISOString() // local 2026-09-09
    expect(formatChapterDate(iso)).toBe('9月9日')
  })

  it('returns null for missing or unparseable input', () => {
    expect(formatChapterDate(null)).toBeNull()
    expect(formatChapterDate(undefined)).toBeNull()
    expect(formatChapterDate('garbage')).toBeNull()
  })
})

describe('stripChapterDatePrefix (P0, re-audit #3)', () => {
  it('strips the server canonical YYYY.MM.DD prefix (real production format)', () => {
    expect(stripChapterDatePrefix('2026.07.15 · 闪现')).toBe('闪现')
    expect(stripChapterDatePrefix('2026.10.18 · 深夜食堂局')).toBe('深夜食堂局')
  })

  it('passes date-free titles through unchanged', () => {
    expect(stripChapterDatePrefix('深夜食堂局')).toBe('深夜食堂局')
    expect(stripChapterDatePrefix('2026 年的第一场局')).toBe('2026 年的第一场局')
  })

  it('handles null/empty and falls back when nothing would remain', () => {
    expect(stripChapterDatePrefix(null)).toBeNull()
    expect(stripChapterDatePrefix(undefined)).toBeNull()
    expect(stripChapterDatePrefix('2026.07.15 · ')).toBe('2026.07.15 · ')
  })
})

describe('getBadgeProximity (A5-3)', () => {
  it('surfaces the next milestone when it is ≤ 3 events away', () => {
    expect(getBadgeProximity(0)).toEqual({ label: '初次见面', remaining: 1 })
    expect(getBadgeProximity(2)).toEqual({ label: '三场连击', remaining: 1 })
    expect(getBadgeProximity(4)).toEqual({ label: '渐入佳境', remaining: 1 })
    expect(getBadgeProximity(7)).toEqual({ label: '悦聚常客', remaining: 3 })
    expect(getBadgeProximity(17)).toEqual({ label: '城市传说', remaining: 3 })
  })

  it('stays quiet when the next milestone is far away or everything is unlocked', () => {
    expect(getBadgeProximity(6)).toBeNull() // 4 away from 10
    expect(getBadgeProximity(20)).toBeNull()
    expect(getBadgeProximity(25)).toBeNull()
  })
})
