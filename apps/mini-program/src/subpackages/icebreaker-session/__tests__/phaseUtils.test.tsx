import { describe, expect, it } from 'vitest'
import type { AtmosphereMood } from '@shared/socialIcebreaker'

import {
  getPhaseLabel,
  getMoodLabel,
  MOOD_OPTIONS,
  type SessionPhase,
} from '../phaseUtils'

// ── getPhaseLabel ──────────────────────────────────────────────────────
describe('getPhaseLabel', () => {
  it('returns 等待中 for waiting', () => {
    expect(getPhaseLabel('waiting')).toBe('等待中')
  })

  it('returns 话题卡 for warmup', () => {
    expect(getPhaseLabel('warmup')).toBe('话题卡')
  })

  it('returns 挑战 for micro_challenge', () => {
    expect(getPhaseLabel('micro_challenge')).toBe('挑战')
  })

  it('returns 谎言侦探 for lie_detective', () => {
    expect(getPhaseLabel('lie_detective')).toBe('谎言侦探')
  })

  it('returns 人格骰子 for personality_dice', () => {
    expect(getPhaseLabel('personality_dice')).toBe('人格骰子')
  })

  it('returns 拍卖 for auction', () => {
    expect(getPhaseLabel('auction')).toBe('拍卖')
  })

  it('returns 机智对决 for quip_battle', () => {
    expect(getPhaseLabel('quip_battle')).toBe('机智对决')
  })

  it('returns 谁是卧底 for undercover_word', () => {
    expect(getPhaseLabel('undercover_word')).toBe('谁是卧底')
  })

  it('returns 群像镜像 for group_mirror', () => {
    expect(getPhaseLabel('group_mirror')).toBe('群像镜像')
  })

  it('returns 迷你剧本杀 for mini_script', () => {
    expect(getPhaseLabel('mini_script')).toBe('迷你剧本杀')
  })

  it('returns 回顾 for recap', () => {
    expect(getPhaseLabel('recap')).toBe('回顾')
  })

  it('returns 已结束 for ended', () => {
    expect(getPhaseLabel('ended' as SessionPhase)).toBe('已结束')
  })

  it('returns the phase value itself for unknown phases', () => {
    expect(getPhaseLabel('unknown_phase' as SessionPhase)).toBe('unknown_phase')
  })

  it('every defined SessionPhase has a non-empty label', () => {
    const phases: SessionPhase[] = [
      'waiting',
      'warmup',
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'auction',
      'quip_battle',
      'undercover_word',
      'group_mirror',
      'mini_script',
      'recap',
      'ended',
    ]
    for (const p of phases) {
      expect(getPhaseLabel(p).length).toBeGreaterThan(0)
    }
  })
})

// ── getMoodLabel ───────────────────────────────────────────────────────
describe('getMoodLabel', () => {
  it('returns 搞笑 for funny', () => {
    expect(getMoodLabel('funny')).toBe('搞笑')
  })

  it('returns 生活 for life', () => {
    expect(getMoodLabel('life')).toBe('生活')
  })

  it('returns 轻松 for relaxed', () => {
    expect(getMoodLabel('relaxed')).toBe('轻松')
  })

  it('returns 情感 for emotional', () => {
    expect(getMoodLabel('emotional')).toBe('情感')
  })

  it('returns 待选择 for null', () => {
    expect(getMoodLabel(null)).toBe('待选择')
  })

  it('returns 待选择 for undefined', () => {
    expect(getMoodLabel(undefined)).toBe('待选择')
  })

  it('returns 待选择 for unknown mood value', () => {
    expect(getMoodLabel('unknown' as AtmosphereMood)).toBe('待选择')
  })

  it('returns a non-empty string for every known mood', () => {
    const moods: AtmosphereMood[] = ['funny', 'life', 'relaxed', 'emotional']
    for (const m of moods) {
      expect(getMoodLabel(m).length).toBeGreaterThan(0)
    }
  })
})

// ── MOOD_OPTIONS ───────────────────────────────────────────────────────
describe('MOOD_OPTIONS', () => {
  it('has exactly 4 mood options', () => {
    expect(MOOD_OPTIONS).toHaveLength(4)
  })

  it('has unique mood values', () => {
    const moods = MOOD_OPTIONS.map((o) => o.mood)
    expect(new Set(moods).size).toBe(moods.length)
  })

  it('has unique labels', () => {
    const labels = MOOD_OPTIONS.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('every option has a non-empty label', () => {
    for (const opt of MOOD_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0)
    }
  })

  it('every option has a non-empty asset path', () => {
    for (const opt of MOOD_OPTIONS) {
      expect(opt.asset.length).toBeGreaterThan(0)
      expect(opt.asset.startsWith('/assets/')).toBe(true)
    }
  })

  it('covers all AtmosphereMood values', () => {
    const coveredMoods = new Set(MOOD_OPTIONS.map((o) => o.mood))
    expect(coveredMoods.has('funny')).toBe(true)
    expect(coveredMoods.has('life')).toBe(true)
    expect(coveredMoods.has('relaxed')).toBe(true)
    expect(coveredMoods.has('emotional')).toBe(true)
  })
})
