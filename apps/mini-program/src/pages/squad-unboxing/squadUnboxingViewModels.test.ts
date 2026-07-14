import { describe, expect, it } from 'vitest'
import {
  buildEventBriefDate,
  buildFocusedMemberBubbleText,
  buildPairKeyMemberMap,
  buildSquadSoulBubbleText,
  computeActionDockState,
  getChemistryWord,
  getEventTypeLabel,
  getPairChemistryWord,
  getSquadChemistryTokens,
  resolveCardFocusInteraction,
} from './squadUnboxingViewModels'

describe('squadUnboxingViewModels', () => {
  it('resolves first tap, fast-forward tap, dismissal, and revisits consistently', () => {
    expect(resolveCardFocusInteraction(-1, 2, false, false)).toEqual({
      nextIndex: 2,
      animateNarration: true,
      action: 'focus',
    })
    expect(resolveCardFocusInteraction(2, 2, true, true)).toEqual({
      nextIndex: 2,
      animateNarration: false,
      action: 'complete',
    })
    expect(resolveCardFocusInteraction(2, 2, true, false)).toEqual({
      nextIndex: -1,
      animateNarration: false,
      action: 'dismiss',
    })
    expect(resolveCardFocusInteraction(1, 2, true, false)).toEqual({
      nextIndex: 2,
      animateNarration: false,
      action: 'focus',
    })
  })

  it('computeActionDockState follows reveal state only', () => {
    expect(computeActionDockState('ready')).toBe('hidden')
    expect(computeActionDockState('shaking')).toBe('hidden')
    expect(computeActionDockState('revealed')).toBe('ready')
  })

  it('buildPairKeyMemberMap creates sorted keys for every pair', () => {
    const members = [
      { userId: 'u3' },
      { userId: 'u1' },
      { userId: 'u2' },
    ]

    const map = buildPairKeyMemberMap(members)

    expect(map.size).toBe(3)
    expect(map.get('u1-u2')).toEqual([{ userId: 'u1' }, { userId: 'u2' }])
    expect(map.get('u1-u3')).toEqual([{ userId: 'u3' }, { userId: 'u1' }])
    expect(map.get('u2-u3')).toEqual([{ userId: 'u3' }, { userId: 'u2' }])
  })

  it('getSquadChemistryTokens maps overall chemistry', () => {
    expect(getSquadChemistryTokens('fire').chipClassName).toContain('fire')
    expect(getSquadChemistryTokens('warm').iconRef).toBe('warm')
    expect(getSquadChemistryTokens('cold').iconRef).toBe('cold')
    expect(getSquadChemistryTokens('mild').iconRef).toBe('mild')
    expect(getSquadChemistryTokens(undefined).title).toBe('今晚有戏')
    expect(getSquadChemistryTokens(undefined).iconRef).toBe('mild')
  })

  it('getChemistryWord returns a temperature word and never a number', () => {
    expect(getChemistryWord('fire')).toBe('超级火花')
    expect(getChemistryWord('warm')).toBe('暖意融融')
    expect(getChemistryWord('mild')).toBe('相聊甚欢')
    expect(getChemistryWord('cold')).toBe('慢慢发现')
    expect(getChemistryWord(undefined)).toBe('今晚有戏')
    expect(getChemistryWord(null)).toBe('今晚有戏')
  })

  it('getPairChemistryWord maps numeric scores to temperature words (no naked integer)', () => {
    expect(getPairChemistryWord(92)).toBe('超级火花')
    expect(getPairChemistryWord(85)).toBe('超级火花')
    expect(getPairChemistryWord(70)).toBe('暖意融融')
    expect(getPairChemistryWord(55)).toBe('相聊甚欢')
    expect(getPairChemistryWord(40)).toBe('慢慢发现')
    expect(getPairChemistryWord(null)).toBe('今晚有戏')
    expect(getPairChemistryWord(undefined)).toBe('今晚有戏')
  })

  it('getEventTypeLabel maps raw event types to display labels (parity with OracleCard)', () => {
    expect(getEventTypeLabel('dining')).toBe('饭局')
    expect(getEventTypeLabel('dinner')).toBe('饭局')
    expect(getEventTypeLabel('bar')).toBe('酒局')
    expect(getEventTypeLabel('drinks')).toBe('酒局')
    expect(getEventTypeLabel('饭局')).toBe('饭局')
    expect(getEventTypeLabel('酒局')).toBe('酒局')
    expect(getEventTypeLabel('other')).toBe('其他')
    expect(getEventTypeLabel('unknown-type')).toBe('其他')
    expect(getEventTypeLabel(null)).toBe('其他')
    expect(getEventTypeLabel(undefined)).toBe('其他')
  })

  it('buildSquadSoulBubbleText inserts the mix clause with a comma when mix is present', () => {
    expect(buildSquadSoulBubbleText('这一桌集齐了开心柯基和太阳鸡两种能量', '今晚这桌会聊得很开')).toBe(
      '人到齐了！这一桌集齐了开心柯基和太阳鸡两种能量，今晚这桌会聊得很开。',
    )
  })

  it('buildSquadSoulBubbleText omits the mix clause when mix is empty (no stranded ！，)', () => {
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开')).toBe('人到齐了！今晚这桌会聊得很开。')
    expect(buildSquadSoulBubbleText('   ', '今晚这桌会聊得很开')).toBe('人到齐了！今晚这桌会聊得很开。')
  })

  it('buildSquadSoulBubbleText strips trailing punctuation on the companion line', () => {
    expect(buildSquadSoulBubbleText('', '悦仔觉得这桌会聊得很自然。')).toBe(
      '人到齐了！悦仔觉得这桌会聊得很自然。',
    )
    expect(buildSquadSoulBubbleText('这一桌凝聚了开心柯基的一种能量', '今晚超期待！')).toBe(
      '人到齐了！这一桌凝聚了开心柯基的一种能量，今晚超期待。',
    )
  })

  it('buildSquadSoulBubbleText falls back to mascot copy when companion is empty', () => {
    expect(buildSquadSoulBubbleText('', '')).toBe('人到齐了！悦仔觉得这桌会聊得很自然。')
    expect(buildSquadSoulBubbleText('', null)).toBe('人到齐了！悦仔觉得这桌会聊得很自然。')
    expect(buildSquadSoulBubbleText('', undefined)).toBe('人到齐了！悦仔觉得这桌会聊得很自然。')
  })

  it('buildSquadSoulBubbleText folds group dynamics in as a follow-on beat', () => {
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', '两个内向三个外向，节奏会很舒服')).toBe(
      '人到齐了！今晚这桌会聊得很开。两个内向三个外向，节奏会很舒服。',
    )
  })

  it('buildSquadSoulBubbleText dedupes dynamics identical to the companion line', () => {
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', '今晚这桌会聊得很开')).toBe(
      '人到齐了！今晚这桌会聊得很开。',
    )
  })

  it('buildSquadSoulBubbleText omits dynamics when empty or null', () => {
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', '')).toBe('人到齐了！今晚这桌会聊得很开。')
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', null)).toBe('人到齐了！今晚这桌会聊得很开。')
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', undefined)).toBe('人到齐了！今晚这桌会聊得很开。')
  })

  it('buildSquadSoulBubbleText strips trailing punctuation on the dynamics beat', () => {
    expect(buildSquadSoulBubbleText('', '今晚这桌会聊得很开', '气氛会很松弛！')).toBe(
      '人到齐了！今晚这桌会聊得很开。气氛会很松弛。',
    )
  })

  it('buildFocusedMemberBubbleText gives the pair explanation a concise Xiaoyue voice', () => {
    expect(buildFocusedMemberBubbleText('豆沙', '你们都喜欢从不同视角理解一件事。', [], null, {
      userId: 'bot-1',
      industryNicheLabel: '纪录片摄影',
      topInterests: ['城市摄影', '独立电影'],
    })).toBe(
      '先认识一下豆沙：在纪录片摄影领域，喜欢城市摄影、独立电影。你们之间还有个连接点：你们都喜欢从不同视角理解一件事。',
    )
  })

  it('buildFocusedMemberBubbleText degrades through connection points, intro angle, and a safe fallback', () => {
    expect(buildFocusedMemberBubbleText('豆沙', '', ['独立电影', '城市漫步'])).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。你们都对独立电影、城市漫步感兴趣，见面可以从这里聊起。',
    )
    expect(buildFocusedMemberBubbleText('豆沙', null, [], '问问最近看过的好电影！')).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。悦仔也给你们留了个开场：问问最近看过的好电影。',
    )
    expect(buildFocusedMemberBubbleText('豆沙')).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。你们的共同点还没显出来，不妨先聊聊最近各自遇到的一件有趣小事。',
    )
  })

  it('buildFocusedMemberBubbleText introduces a rich member even when viewer data is empty', () => {
    expect(buildFocusedMemberBubbleText('雪花', null, [], null, {
      userId: 'bot-4',
      archetype: 'octopus',
      industryNicheLabel: '服务机器人研发',
      topInterests: ['攀岩', '科幻小说', '硬件制作'],
      hometownRegionCity: '陕西西安',
    })).toBe(
      '先认识一下雪花：在服务机器人研发领域，喜欢攀岩、科幻小说、硬件制作，来自陕西西安。你们的共同点还没显出来，不妨先问问攀岩背后的故事。',
    )
  })

  it('buildFocusedMemberBubbleText replaces an unhelpful connection-search explanation', () => {
    expect(buildFocusedMemberBubbleText('草原', '悦仔还在整理你和草原的连接线索，见面后也许会有新的惊喜。', [], null, {
      userId: 'bot-5',
      topInterests: ['社区营造'],
    })).toBe(
      '先认识一下草原：喜欢社区营造。你们的共同点还没显出来，不妨先问问社区营造背后的故事。',
    )
  })

  describe('buildEventBriefDate', () => {
    it('breaks a valid datetime into day / month / weekday / time', () => {
      // 2026-07-18 is a Saturday.
      const brief = buildEventBriefDate('2026-07-18T19:30:00+08:00')
      expect(brief).not.toBeNull()
      expect(brief?.day).toBe('18')
      expect(brief?.month).toBe('7月')
      expect(brief?.time).toMatch(/^\d{2}:\d{2}$/)
      expect(brief?.weekday).toMatch(/^周[一二三四五六日]$/)
    })

    it('returns null for missing or invalid input (sparse-state collapse)', () => {
      expect(buildEventBriefDate(null)).toBeNull()
      expect(buildEventBriefDate(undefined)).toBeNull()
      expect(buildEventBriefDate('')).toBeNull()
      expect(buildEventBriefDate('not-a-date')).toBeNull()
    })
  })
})
