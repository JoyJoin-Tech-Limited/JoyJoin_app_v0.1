import { describe, expect, it } from 'vitest'
import {
  buildDeckPillAriaLabel,
  buildDeckPillStripModel,
  buildEventBriefDate,
  buildFaceDownCardAriaLabel,
  buildFocusedMemberBubbleText,
  buildFocusedNarrativeModel,
  buildInterestHookText,
  buildPairKeyMemberMap,
  buildRevealChipLabel,
  buildSelfCardBubbleText,
  buildSquadSoulBubbleText,
  buildTableDiagnosis,
  computeActionDockState,
  computeBestPartnerUserId,
  DECK_PILL_STRIP_CAP,
  getChemistryWord,
  getDeckPillChemistryClass,
  getEventTypeLabel,
  getPairChemistryWord,
  getSelfSquadRoleLabel,
  getSquadChemistryTokens,
  resolveCardFocusInteraction,
  shortenConnectionPointForPill,
  SQUAD_BURST_COMPLETION_BUBBLE_TEXT,
  SQUAD_SELF_CARD_BUBBLE_TEXT,
  SQUAD_TEASE_BUBBLE_TEXT,
  stripConnectionPointParens,
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

  it('buildFocusedMemberBubbleText degrades through connection points, intro angle, and a dignity-floored fallback (2026-07-24 P0)', () => {
    expect(buildFocusedMemberBubbleText('豆沙', '', ['独立电影', '城市漫步'])).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。你们都对独立电影、城市漫步感兴趣，见面可以从这里聊起。',
    )
    expect(buildFocusedMemberBubbleText('豆沙', null, [], '问问最近看过的好电影！')).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。悦仔也给你们留了个开场：问问最近看过的好电影。',
    )
    expect(buildFocusedMemberBubbleText('豆沙')).toBe(
      '先认识一下豆沙：这是今晚会和你同桌的新伙伴。TA的气质和你正好互补——不妨先聊聊最近各自遇到的一件有趣小事。',
    )
  })

  it('buildFocusedMemberBubbleText never concedes "没找到共同点" (dignity floor, 2026-07-24 P0)', () => {
    const cases = [
      buildFocusedMemberBubbleText('豆沙'),
      buildFocusedMemberBubbleText('雪花', null, [], null, {
        userId: 'bot-4',
        archetype: 'octopus',
        topInterests: ['攀岩'],
      }),
      buildFocusedMemberBubbleText('草原', '悦仔还在整理你和草原的连接线索。', [], null, {
        userId: 'bot-5',
        topInterests: ['社区营造'],
      }),
    ]
    for (const text of cases) {
      expect(text).not.toContain('共同点还没显出来')
      expect(text).not.toContain('还没找到')
    }
  })

  it('buildFocusedMemberBubbleText introduces a rich member even when viewer data is empty', () => {
    expect(buildFocusedMemberBubbleText('雪花', null, [], null, {
      userId: 'bot-4',
      archetype: 'octopus',
      industryNicheLabel: '服务机器人研发',
      topInterests: ['攀岩', '科幻小说', '硬件制作'],
      hometownRegionCity: '陕西西安',
    })).toBe(
      '先认识一下雪花：在服务机器人研发领域，喜欢攀岩、科幻小说、硬件制作，来自陕西西安。TA身上脑洞章鱼的气质，和你正好互补——今晚从攀岩聊起，说不定能互相打开新话题。',
    )
  })

  it('buildFocusedMemberBubbleText replaces an unhelpful connection-search explanation', () => {
    expect(buildFocusedMemberBubbleText('草原', '悦仔还在整理你和草原的连接线索，见面后也许会有新的惊喜。', [], null, {
      userId: 'bot-5',
      topInterests: ['社区营造'],
    })).toBe(
      '先认识一下草原：喜欢社区营造。TA的气质和你正好互补——今晚从社区营造聊起，说不定能互相打开新话题。',
    )
  })

  it('buildFocusedMemberBubbleText inserts the education clause right after industry (2026-07-16)', () => {
    expect(buildFocusedMemberBubbleText('艾米丽', null, [], null, {
      userId: 'u1',
      industryNicheLabel: '互联网产品',
      educationLevel: '本科',
      topInterests: ['城市摄影', '独立电影'],
      hometownRegionCity: '广东深圳',
    })).toBe(
      '先认识一下艾米丽：在互联网产品领域，本科学历，喜欢城市摄影、独立电影。TA的气质和你正好互补——今晚从城市摄影聊起，说不定能互相打开新话题。',
    )
  })

  it('buildFocusedMemberBubbleText omits the education clause when education is privacy-hidden', () => {
    expect(buildFocusedMemberBubbleText('艾米丽', null, [], null, {
      userId: 'u1',
      industryNicheLabel: '互联网产品',
      educationLevel: '本科',
      educationVisible: false,
      topInterests: ['城市摄影'],
    })).toBe(
      '先认识一下艾米丽：在互联网产品领域，喜欢城市摄影。TA的气质和你正好互补——今晚从城市摄影聊起，说不定能互相打开新话题。',
    )
  })

  it('buildFocusedMemberBubbleText introduces an education-only member gracefully', () => {
    expect(buildFocusedMemberBubbleText('豆沙', null, [], null, {
      userId: 'u1',
      educationLevel: '硕士',
    })).toBe(
      '先认识一下豆沙：硕士学历。TA的气质和你正好互补——不妨先聊聊最近各自遇到的一件有趣小事。',
    )
  })

  describe('buildInterestHookText (row-4 fallback hook, 2026-07-16)', () => {
    it('returns the first non-empty trimmed interest', () => {
      expect(buildInterestHookText({ userId: 'u1', topInterests: ['脱口秀', '攀岩'] })).toBe('脱口秀')
      expect(buildInterestHookText({ userId: 'u1', topInterests: ['   ', '攀岩'] })).toBe('攀岩')
      expect(buildInterestHookText({ userId: 'u1', topInterests: ['  脱口秀  '] })).toBe('脱口秀')
    })

    it('returns an empty string when the member has no usable interest (row 4 collapses)', () => {
      expect(buildInterestHookText({ userId: 'u1', topInterests: [] })).toBe('')
      expect(buildInterestHookText({ userId: 'u1', topInterests: ['   '] })).toBe('')
      expect(buildInterestHookText({ userId: 'u1' })).toBe('')
      expect(buildInterestHookText(null)).toBe('')
      expect(buildInterestHookText(undefined)).toBe('')
    })
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

  describe('tap-to-reveal copy builders (AC-01/04/05/11/18)', () => {
    it('ships a fixed self-card narration for the auto-flipped 我 card', () => {
      expect(SQUAD_SELF_CARD_BUBBLE_TEXT).toBe(
        '这张是你的桌友卡。悦仔把你放进这桌，也把属于你的视角带进了今晚。',
      )
    })

    it('ships a single group-completion line for the reveal-all burst', () => {
      expect(SQUAD_BURST_COMPLETION_BUBBLE_TEXT).toBe('全员揭晓，今晚这桌，慢慢认识。')
    })

    it('ships the resting tease line shown while face-down cards remain (C1)', () => {
      expect(SQUAD_TEASE_BUBBLE_TEXT).toBe('桌友卡都扣好了，轻点翻开，看看今晚和谁一桌。')
    })

    it('builds the hint-chip label with the live unflipped count + explicit tap verb', () => {
      expect(buildRevealChipLabel(3)).toBe('还有 3 位桌友未揭晓 · 轻点全部翻开')
      expect(buildRevealChipLabel(1)).toBe('还有 1 位桌友未揭晓 · 轻点全部翻开')
    })

    it('labels face-down cards with reveal-invitation semantics, self without a name', () => {
      expect(buildFaceDownCardAriaLabel('豆沙', false)).toBe('豆沙的桌友卡，还未翻开，轻点揭晓')
      expect(buildFaceDownCardAriaLabel('豆沙', true)).toBe('我的桌友卡，还未翻开')
      expect(buildFaceDownCardAriaLabel('', false)).toBe('这位桌友的桌友卡，还未翻开，轻点揭晓')
    })

    it('computeBestPartnerUserId picks the highest viewer pair score with a strict roster tie-break', () => {
      const members = [
        { userId: 'me' },
        { userId: 'a' },
        { userId: 'b' },
      ] as never
      const pairs = new Map<string, { chemistryScore: number } | null>([
        ['a', { chemistryScore: 88 }],
        ['b', { chemistryScore: 88 }],
      ])
      // Strict `>` keeps the first (roster-order) member on ties.
      expect(computeBestPartnerUserId(members, 'me', pairs as never)).toBe('a')
      pairs.set('b', { chemistryScore: 92 })
      expect(computeBestPartnerUserId(members, 'me', pairs as never)).toBe('b')
      expect(computeBestPartnerUserId(members, 'me', new Map())).toBeNull()
      expect(computeBestPartnerUserId(members, null, pairs as never)).toBe('b')
    })
  })

  describe('stripConnectionPointParens (A3)', () => {
    it('strips one pair of wrapping full-width parens', () => {
      expect(stripConnectionPointParens('（都偏内向细腻）')).toBe('都偏内向细腻')
      expect(stripConnectionPointParens('（都偏内向细腻，但聊到兴头会很投入）')).toBe('都偏内向细腻，但聊到兴头会很投入')
    })

    it('leaves unwrapped text untouched (trim only)', () => {
      expect(stripConnectionPointParens('都爱在咖啡馆里发呆')).toBe('都爱在咖啡馆里发呆')
      expect(stripConnectionPointParens('  聊天节奏偏慢热  ')).toBe('聊天节奏偏慢热')
    })

    it('leaves inner parens and unbalanced pairs untouched', () => {
      expect(stripConnectionPointParens('都爱看展（尤其当代）')).toBe('都爱看展（尤其当代）')
      expect(stripConnectionPointParens('（只开了头')).toBe('（只开了头')
      expect(stripConnectionPointParens('没收尾）')).toBe('没收尾）')
    })

    it('handles empty and degenerate input safely', () => {
      expect(stripConnectionPointParens('')).toBe('')
      expect(stripConnectionPointParens('（）')).toBe('')
    })
  })

  describe('pocket-the-deck pill view models (AC-03/04/09)', () => {
    const members = [
      { userId: 'me' },
      { userId: 'a' },
      { userId: 'b' },
      { userId: 'c' },
      { userId: 'd' },
      { userId: 'e' },
      { userId: 'f' },
    ] as never

    it('buildDeckPillAriaLabel counts the full roster', () => {
      expect(buildDeckPillAriaLabel(6)).toBe('展开卡组，查看你的6位桌友')
      expect(buildDeckPillAriaLabel(1)).toBe('展开卡组，查看你的1位桌友')
    })

    it('caps the strip at DECK_PILL_STRIP_CAP and carries the rest as overflow', () => {
      const model = buildDeckPillStripModel(members, {
        flippedIds: new Set<string>(),
        allRevealed: false,
        bestPartnerUserId: null,
        currentUserId: 'me',
      })
      expect(model.items).toHaveLength(DECK_PILL_STRIP_CAP)
      expect(model.items.map((item) => item.member.userId)).toEqual(['me', 'a', 'b', 'c', 'd'])
      expect(model.overflowCount).toBe(2)
      expect(model.totalCount).toBe(7)
    })

    it('derives face-up from the controller flip set (spoiler gating) and flags me/best-partner', () => {
      const model = buildDeckPillStripModel(members, {
        flippedIds: new Set(['me', 'b']),
        allRevealed: false,
        bestPartnerUserId: 'b',
        currentUserId: 'me',
      })
      const byId = new Map(model.items.map((item) => [item.member.userId, item]))
      expect(byId.get('me')).toMatchObject({ faceUp: true, isCurrentUser: true, isBestPartner: false })
      expect(byId.get('b')).toMatchObject({ faceUp: true, isCurrentUser: false, isBestPartner: true })
      // a/c/d are face-down → the pill renders card-back chips, never avatars.
      expect(byId.get('a')?.faceUp).toBe(false)
      expect(byId.get('c')?.faceUp).toBe(false)
    })

    it('allRevealed forces every mini face-up regardless of the flip set', () => {
      const model = buildDeckPillStripModel(members, {
        flippedIds: new Set<string>(),
        allRevealed: true,
        bestPartnerUserId: null,
        currentUserId: null,
      })
      expect(model.items.every((item) => item.faceUp)).toBe(true)
    })

    it('overflow never goes negative at or below the cap', () => {
      const four = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }, { userId: 'd' }] as never
      const model = buildDeckPillStripModel(four, {
        flippedIds: new Set<string>(),
        allRevealed: false,
        bestPartnerUserId: null,
      })
      expect(model.items).toHaveLength(4)
      expect(model.overflowCount).toBe(0)
      expect(model.totalCount).toBe(4)
    })

    it('getDeckPillChemistryClass mirrors the chemistry-chip token family', () => {
      expect(getDeckPillChemistryClass('fire')).toBe('squad-unboxing__deck-pill--fire')
      expect(getDeckPillChemistryClass('warm')).toBe('squad-unboxing__deck-pill--warm')
      expect(getDeckPillChemistryClass('cold')).toBe('squad-unboxing__deck-pill--cold')
      expect(getDeckPillChemistryClass('mild')).toBe('squad-unboxing__deck-pill--fallback')
      expect(getDeckPillChemistryClass(null)).toBe('squad-unboxing__deck-pill--fallback')
      expect(getDeckPillChemistryClass(undefined)).toBe('squad-unboxing__deck-pill--fallback')
    })
  })

  describe('buildTableDiagnosis (桌型诊断, 2026-07-24 P0)', () => {
    it('counts deterministic role buckets in hype→deep→warm order', () => {
      const members = [
        { userId: 'a', archetype: 'corgi' },
        { userId: 'b', archetype: 'rooster' },
        { userId: 'c', archetype: 'owl' },
        { userId: 'd', archetype: 'koala' },
        { userId: 'e', archetype: 'turtle' },
        { userId: 'f', archetype: 'cat' },
      ] as never
      expect(buildTableDiagnosis(members)).toEqual([
        { key: 'hype', label: '气氛组', count: 2 },
        { key: 'deep', label: '深度派', count: 1 },
        { key: 'warm', label: '暖心派', count: 3 },
      ])
    })

    it('drops zero-count segments and resolves legacy nameCn forms', () => {
      const members = [
        { userId: 'a', archetype: '社牛柯基' },
        { userId: 'b', archetype: '小太阳鸡' },
      ] as never
      expect(buildTableDiagnosis(members)).toEqual([
        { key: 'hype', label: '气氛组', count: 2 },
      ])
    })

    it('returns empty when no archetype resolves', () => {
      const members = [
        { userId: 'a', archetype: null },
        { userId: 'b' },
      ] as never
      expect(buildTableDiagnosis(members)).toEqual([])
    })
  })

  describe('buildFocusedNarrativeModel (结构化同频分析卡, 2026-07-24 P1)', () => {
    const richPair = {
      pairKey: 'me-a',
      chemistryScore: 88,
      connectionPoints: ['（都偏内向细腻）', '爵士乐', '旧书店'],
      explanation: '你们都偏好深度的一对一交流。',
      introAngle: '问问TA最近单曲循环的一张专辑',
    } as never

    it('structures verdict → evidence → opener from a rich pair', () => {
      const model = buildFocusedNarrativeModel(richPair, { isBestPartner: false })
      expect(model).not.toBeNull()
      expect(model!.verdict).toBe('你们俩大概率一见如故')
      expect(model!.evidence).toEqual(['都偏内向细腻', '爵士乐', '旧书店'])
      expect(model!.opener).toBe('问问TA最近单曲循环的一张专辑')
    })

    it('leads with the jackpot verdict for the best partner', () => {
      const model = buildFocusedNarrativeModel(richPair, { isBestPartner: true })
      expect(model!.verdict).toBe('这是今晚和你最同频的人')
      expect(model!.isBestPartner).toBe(true)
    })

    it('falls back to an evidence-derived opener when introAngle is absent', () => {
      const pair = { pairKey: 'me-b', chemistryScore: 72, connectionPoints: ['城市摄影'] } as never
      const model = buildFocusedNarrativeModel(pair, { isBestPartner: false })
      expect(model!.verdict).toBe('你们俩大概率聊得来')
      expect(model!.opener).toBe('见面可以先从城市摄影聊起')
    })

    it('reads cold chemistry honestly but constructively', () => {
      const pair = { pairKey: 'me-c', chemistryScore: 40, connectionPoints: ['早起'] } as never
      const model = buildFocusedNarrativeModel(pair, { isBestPartner: false })
      expect(model!.verdict).toBe('你们俩是互补型同桌')
    })

    it('returns null for missing or empty pairs so the caller falls back to prose', () => {
      expect(buildFocusedNarrativeModel(null, { isBestPartner: false })).toBeNull()
      expect(buildFocusedNarrativeModel(undefined, { isBestPartner: false })).toBeNull()
      expect(buildFocusedNarrativeModel({ pairKey: 'me-d', chemistryScore: 60 } as never, { isBestPartner: false })).toBeNull()
    })

    it('still structures when only an explanation exists (no points, no angle)', () => {
      const pair = { pairKey: 'me-e', chemistryScore: 63, explanation: '你们都看重稳定的节奏。' } as never
      const model = buildFocusedNarrativeModel(pair, { isBestPartner: false })
      expect(model).not.toBeNull()
      expect(model!.verdict).toBe('你们俩有不少可聊的点')
      expect(model!.evidence).toEqual([])
      expect(model!.opener).toBe('')
    })
  })

  describe('self role + self narration (自我关联, 2026-07-24)', () => {
    it('getSelfSquadRoleLabel maps archetypes to self-addressed roles', () => {
      expect(getSelfSquadRoleLabel('corgi')).toBe('气氛担当')
      expect(getSelfSquadRoleLabel('社牛柯基')).toBe('气氛担当')
      expect(getSelfSquadRoleLabel('owl')).toBe('深度担当')
      expect(getSelfSquadRoleLabel('koala')).toBe('暖心担当')
      expect(getSelfSquadRoleLabel(null)).toBe('')
      expect(getSelfSquadRoleLabel('unknown-thing')).toBe('')
    })

    it('buildSelfCardBubbleText positions the viewer in the table', () => {
      expect(buildSelfCardBubbleText('气氛担当')).toBe(
        '这张是你的桌友卡。你是这桌的气氛担当——悦仔把你放进来，就是要你把这份能量带上桌。',
      )
      expect(buildSelfCardBubbleText('')).toBe(
        '这张是你的桌友卡。悦仔把你放进这桌，也把属于你的视角带进了今晚。',
      )
    })
  })

  describe('shortenConnectionPointForPill (card-pill copy budget, 2026-07-24)', () => {
    it('strips filler prefixes so the semantic core survives the ellipsis', () => {
      expect(shortenConnectionPointForPill('（都爱在咖啡馆里发呆）')).toBe('咖啡馆里发呆')
      expect(shortenConnectionPointForPill('都爱在咖啡馆里发呆')).toBe('咖啡馆里发呆')
      expect(shortenConnectionPointForPill('都喜欢动手做东西')).toBe('动手做东西')
      expect(shortenConnectionPointForPill('都偏内向细腻')).toBe('内向细腻')
      expect(shortenConnectionPointForPill('阅读习惯相似')).toBe('阅读习惯相似')
      expect(shortenConnectionPointForPill('都相信长期主义')).toBe('长期主义')
    })

    it('never returns an empty pill', () => {
      expect(shortenConnectionPointForPill('都爱')).toBe('都爱')
      expect(shortenConnectionPointForPill('')).toBe('')
    })
  })
})
