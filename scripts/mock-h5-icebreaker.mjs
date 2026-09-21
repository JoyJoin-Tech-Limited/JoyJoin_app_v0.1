/**
 * Icebreaker-session mock fixtures + state builder.
 * Extracted verbatim from mock-h5-server.mjs to keep that file under the
 * 1500-line harness gate limit. Exports are consumed by the route handlers there.
 */

const IB_HOST_ID = 'user-screenshot-001'

// Minimal AIGC meta fixture — lets the screenshot gate verify the disclosure
// rows (mirrors the shared AIResponseMeta shape).
export function mockAigcMeta(promptVersion) {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: 'deepseek',
    fallbackUsed: false,
    promptVersion,
    aigc: { aiGenerated: true, labelType: 'ai-generated' },
  }
}
const IB_PARTICIPANTS = [
  { userId: IB_HOST_ID, displayName: '悦仔测试', archetype: '社牛柯基', isActive: true },
  { userId: 'ib-p2', displayName: '小鹿', archetype: '寻宝狐', isActive: true },
  { userId: 'ib-p3', displayName: '阿澈', archetype: '机灵海豚', isActive: true },
  { userId: 'ib-p4', displayName: '桃桃', archetype: '夸夸仓鼠', isActive: true },
  { userId: 'ib-p5', displayName: '老周', archetype: '靠谱大象', isActive: true },
  { userId: 'ib-p6', displayName: '眠眠', archetype: '树洞考拉', isActive: true },
]

const IB_LIE_STATEMENTS = [
  { index: 0, text: '我小时候拿过全省少儿围棋冠军' },
  { index: 1, text: '我从来不喝咖啡，一喝就睡不着' },
  { index: 2, text: '我曾经在沙漠里住过一个月的帐篷' },
]

// ─── Wave 2 / Wave 4 flag-gated preview fixtures (2026-09-18) ─────
// Shapes mirror packages/shared/src/socialIcebreaker.ts exactly:
// AuctionLotResult { lotIndex, lotId, title, winnerUserId|null,
// winningAmount|null, bidCount, wasAllIn }; recapSnapshot.glow
// { tiers: Record<userId, 'ember'|'warm'|'blazing'>, medals, tableLine }.

const AUCTION_V2_LOTS = [
  { id: 'v2-lot-1', title: '当众唱一句儿歌', teaser: '跑调也要唱完，大家投票打分', emoji: '🎤' },
  { id: 'v2-lot-2', title: '爆料一个自己的小怪癖', teaser: '越具体越好笑', emoji: '🤫' },
  { id: 'v2-lot-3', title: '请全桌喝一杯', teaser: '今晚的豪气担当就是你', emoji: '🍜' },
]

const AUCTION_V2_FINALE_LOTS = [
  ...AUCTION_V2_LOTS,
  { id: 'v2-lot-4', title: '模仿主持人说一句绕口令', teaser: '嘴瓢也算节目效果', emoji: '🎭' },
]

// Four awards computable: biggest_spend (桃桃 85), bargain (小鹿 25),
// hottest (《爆料一个自己的小怪癖》 5 bids), steadiest (老周, no wins + 100
// remaining). Lot 4 is 流拍 (winnerUserId: null) — the honest unsold row.
const AUCTION_V2_FINALE_LOT_RESULTS = [
  { lotIndex: 0, lotId: 'v2-lot-1', title: '当众唱一句儿歌', winnerUserId: 'ib-p4', winningAmount: 85, bidCount: 4, wasAllIn: false },
  { lotIndex: 1, lotId: 'v2-lot-2', title: '爆料一个自己的小怪癖', winnerUserId: 'ib-p3', winningAmount: 80, bidCount: 5, wasAllIn: true },
  { lotIndex: 2, lotId: 'v2-lot-3', title: '请全桌喝一杯', winnerUserId: 'ib-p2', winningAmount: 25, bidCount: 2, wasAllIn: false },
  { lotIndex: 3, lotId: 'v2-lot-4', title: '模仿主持人说一句绕口令', winnerUserId: null, winningAmount: null, bidCount: 0, wasAllIn: false },
]

function AUCTION_V2_FINALE_BID_HISTORY(now) {
  return [
    { userId: 'ib-p2', amount: 40, at: now - 16 * 60_000, lotIndex: 0 },
    { userId: 'ib-p4', amount: 85, at: now - 15 * 60_000, lotIndex: 0 },
    { userId: 'ib-p2', amount: 30, at: now - 12 * 60_000, lotIndex: 1 },
    { userId: IB_HOST_ID, amount: 55, at: now - 11 * 60_000, lotIndex: 1 },
    { userId: 'ib-p3', amount: 80, at: now - 10 * 60_000, lotIndex: 1, isAllIn: true },
    { userId: 'ib-p2', amount: 25, at: now - 7 * 60_000, lotIndex: 2 },
  ]
}

const RECAP_SUMMARY_FIXTURE = {
  headline: '今晚到这儿，刚刚好',
  closingLine: '悦仔的任务完成啦，接下来的故事，你们当面接着讲～',
  moments: ['小鹿猜中了阿澈的谎言，全场惊呼', '桃桃拍下了「请全桌喝一杯」，豪气拉满', '悦仔测试接梗三连，桌上的笑声没停过'],
}


export function buildIcebreakerState(sessionId) {
  const variant = sessionId.replace('mock-', '')
  const now = Date.now()
  const base = {
    socialSessionId: sessionId,
    icebreakerSessionId: sessionId,
    hostUserId: IB_HOST_ID,
    hostDisplayName: '悦仔测试',
    playerCount: 6,
    activePlayerCount: 6,
    phaseStartedAt: now - 90_000,
    sessionStartedAt: now - 20 * 60_000,
    completedPhases: ['warmup'],
    eventTier: 'glow',
    eventType: '饭局',
    vibe: 'balanced',
    autoAdvanceEnabled: true,
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'speed_friending'],
    joinedParticipants: IB_PARTICIPANTS,
    archetypeMixText: '柯基 × 狐狸 × 海豚 × 仓鼠 × 大象 × 考拉',
  }

  switch (variant) {
    case 'micro_challenge':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-1',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
          visualHint: '越真诚越好',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2'],
        currentChallengeMeta: mockAigcMeta('social-micro-challenge-v1'),
      }
    case 'micro_challenge_optout':
      // W3 (AC-W3.3): viewer (host) has NOT completed and not opted out → the
      // honest opt-out affordance (只想听 / 换一个) should render.
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-optout',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
          visualHint: '越真诚越好',
        },
        challengeCompletedBy: ['ib-p2'],
        phaseRosterSnapshot: IB_PARTICIPANTS.map((p) => p.userId),
        phaseOptOutUserIds: [],
        phaseSilentCompletedUserIds: [],
      }
    case 'micro_challenge_opted_out':
      // W3 (AC-W3.3): viewer opted out → the opt_out state should render.
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-opted',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
          visualHint: '越真诚越好',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2'],
        phaseRosterSnapshot: IB_PARTICIPANTS.map((p) => p.userId),
        phaseOptOutUserIds: [IB_HOST_ID],
        phaseSilentCompletedUserIds: [],
      }
    case 'fuse':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-2',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
        },
        challengeCompletedBy: IB_PARTICIPANTS.map((p) => p.userId),
        autoAdvanceScheduledAt: now + 6_000,
        advanceFuseKind: 'all_ready',
      }
    case 'stall':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-3',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2'],
        stallNudgeAt: now - 30_000,
      }
    case 'lie_detective':
      return {
        ...base,
        currentPhase: 'lie_detective',
        lieDetectiveMode: 'v1',
        lieDetectivePlayers: IB_PARTICIPANTS.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          statements: IB_LIE_STATEMENTS,
        })),
        currentLieDetectivePlayerIndex: 1,
        votes: [],
        lieDetectiveStatementsMeta: mockAigcMeta('social-lie-detective-v1'),
      }
    case 'auction':
      return {
        ...base,
        currentPhase: 'auction',
        auctionLots: [
          { id: 'lot-1', title: '当众唱一句儿歌', teaser: '跑调也要唱完，大家投票打分', emoji: '🎤' },
          { id: 'lot-2', title: '爆料一个自己的小怪癖', teaser: '越具体越好笑', emoji: '🤫' },
          { id: 'lot-3', title: '请全桌喝一杯', teaser: '今晚的豪气担当就是你', emoji: '🍜' },
        ],
        auctionCurrentLotIndex: 0,
        auctionBalances: { [IB_HOST_ID]: 120, 'ib-p2': 75 },
        auctionHighBid: { userId: 'ib-p2', amount: 45 },
        auctionLotStartedAt: now - 10_000,
        auctionAllLotsClosed: false,
        auctionLotsMeta: mockAigcMeta('social-auction-lots-v1'),
        auctionBidHistory: [
          { userId: IB_HOST_ID, amount: 20, at: now - 60_000, lotIndex: 0 },
          { userId: 'ib-p2', amount: 45, at: now - 30_000, lotIndex: 0 },
        ],
      }
    case 'auction-v2-live':
    case 'auction-v2-live-host': {
      // Wave 2 (AC-11/AC-12): live V2 bidding, mid-lot (2/3), one all-in
      // badge case. `-live` is the PARTICIPANT view (host = 老周, so the
      // viewer sees the 3-tier ladder); `-live-host` keeps the default host
      // viewer (close-lot CTA + host all-in hint, no ladder).
      const participantView = variant === 'auction-v2-live'
      return {
        ...base,
        hostUserId: participantView ? 'ib-p5' : IB_HOST_ID,
        hostDisplayName: participantView ? '老周' : base.hostDisplayName,
        currentPhase: 'auction',
        auctionV2Enabled: true,
        auctionLots: AUCTION_V2_LOTS,
        auctionCurrentLotIndex: 1,
        auctionLotResults: [
          { lotIndex: 0, lotId: 'v2-lot-1', title: '当众唱一句儿歌', winnerUserId: 'ib-p4', winningAmount: 30, bidCount: 3, wasAllIn: false },
        ],
        auctionBalances: {
          [IB_HOST_ID]: 100,
          'ib-p2': 75,
          'ib-p3': 0, // 阿澈 went all-in on the current lot
          'ib-p4': 70,
          'ib-p5': 100,
          'ib-p6': 95,
        },
        // All-in badge case: 阿澈 committed their full spendable balance.
        auctionHighBid: { userId: 'ib-p3', amount: 80, isAllIn: true },
        auctionLotStartedAt: now - 10_000,
        auctionAllLotsClosed: false,
        auctionLotsMeta: mockAigcMeta('social-auction-lots-v1'),
        auctionBidHistory: [
          { userId: 'ib-p2', amount: 15, at: now - 5 * 60_000, lotIndex: 0 },
          { userId: 'ib-p4', amount: 30, at: now - 4 * 60_000, lotIndex: 0 },
          { userId: IB_HOST_ID, amount: 45, at: now - 40_000, lotIndex: 1 },
          { userId: 'ib-p3', amount: 80, at: now - 15_000, lotIndex: 1, isAllIn: true },
        ],
      }
    }
    case 'auction-v2-finale':
      // Wave 2 (AC-13): two-act finale. auctionLotResults drives all four
      // awards (今晚最敢花=桃桃 85 / 捡漏王=小鹿 25 / 全场最热=《爆料…》 5 bids /
      // 最稳的手=老周 100 remaining) + one 流拍 lot; the bill lists the five
      // bidders (host excluded by the view-model).
      return {
        ...base,
        currentPhase: 'auction',
        auctionV2Enabled: true,
        auctionLots: AUCTION_V2_FINALE_LOTS,
        auctionCurrentLotIndex: AUCTION_V2_FINALE_LOTS.length - 1,
        auctionHighBid: null,
        auctionAllLotsClosed: true,
        auctionLotsMeta: mockAigcMeta('social-auction-lots-v1'),
        auctionLotResults: AUCTION_V2_FINALE_LOT_RESULTS,
        auctionBalances: {
          [IB_HOST_ID]: 100,
          'ib-p2': 50,
          'ib-p3': 0,
          'ib-p4': 15,
          'ib-p5': 100,
          'ib-p6': 40,
        },
        auctionBidHistory: AUCTION_V2_FINALE_BID_HISTORY(now),
      }
    case 'recap-glow': {
      // Wave 4 (AC-12/AC-13): 4-player table, mixed tiers, 3 data medals.
      // recapSnapshot.glow is the dual-write canon (medals === glow.medals);
      // glowPoints carries ONLY the viewer's own breakdown (server trims the
      // rest, AC-09) so the self card renders the collapsed source detail.
      const roster = IB_PARTICIPANTS.slice(0, 4)
      const medals = [
        { emoji: '🎤', title: '接梗王', recipientDisplayName: '悦仔测试', description: '接住的每个梗都让这桌更热了一点' },
        { emoji: '💗', title: '暖心雷达', recipientDisplayName: '小鹿', description: '总能看见同桌身上的闪光点' },
        { emoji: '🔨', title: '豪气担当', recipientDisplayName: '桃桃', description: '出手果断，把喜欢的那件拍回家' },
      ]
      return {
        ...base,
        playerCount: 4,
        activePlayerCount: 4,
        joinedParticipants: roster,
        archetypeMixText: '柯基 × 狐狸 × 海豚 × 仓鼠',
        currentPhase: 'recap',
        completedPhases: ['warmup', 'micro_challenge', 'quip_battle', 'auction', 'group_mirror'],
        lastAdvanceTrigger: 'auto_all_ready',
        sessionGlowEnabled: true,
        glowPoints: {
          [IB_HOST_ID]: { quip: 3, mirror: 0, auction: 1, miniscript: 0, undercover: 0, challenge: 2, dice: 1, lie: 0 },
        },
        recapSnapshot: {
          recapSummary: RECAP_SUMMARY_FIXTURE,
          medals,
          meta: mockAigcMeta('social-recap-summary-v1'),
          glow: {
            tiers: {
              [IB_HOST_ID]: 'blazing',
              'ib-p2': 'warm',
              'ib-p3': 'ember',
              'ib-p4': 'warm',
            },
            medals,
            tableLine: '这桌今晚越走越热，高光一个接一个',
          },
        },
      }
    }
    case 'recap-glow-zero': {
      // Wave 4 (AC-12, spec D5): honest all-zero table — every card on the
      // 微光 floor, zero medals, quiet table line + 静静发光也是光 floor line.
      // Viewer breakdown is all zeros → no detail toggle (no fabrication).
      const roster = IB_PARTICIPANTS.slice(0, 4)
      return {
        ...base,
        playerCount: 4,
        activePlayerCount: 4,
        joinedParticipants: roster,
        archetypeMixText: '柯基 × 狐狸 × 海豚 × 仓鼠',
        currentPhase: 'recap',
        completedPhases: ['warmup', 'micro_challenge'],
        lastAdvanceTrigger: 'auto_all_ready',
        sessionGlowEnabled: true,
        glowPoints: {
          [IB_HOST_ID]: { quip: 0, mirror: 0, auction: 0, miniscript: 0, undercover: 0, challenge: 0, dice: 0, lie: 0 },
        },
        recapSnapshot: {
          recapSummary: RECAP_SUMMARY_FIXTURE,
          medals: [],
          meta: mockAigcMeta('social-recap-summary-v1'),
          glow: {
            tiers: {
              [IB_HOST_ID]: 'ember',
              'ib-p2': 'ember',
              'ib-p3': 'ember',
              'ib-p4': 'ember',
            },
            medals: [],
            tableLine: '今晚这桌更像静静相处的一桌',
          },
        },
      }
    }
    case 'personality_dice':
      return {
        ...base,
        currentPhase: 'personality_dice',
        personalityDiceChallenges: IB_PARTICIPANTS.map((p, i) => ({
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
          challengeEmoji: ['🎤', '📷', '🕺', '💌', '🎭', '🌟'][i],
          challengeTitle: ['模仿一种动物叫声', '和左边的人自拍一张', '即兴跳10秒舞', '夸右边的人三个优点', '用方言自我介绍', '分享一个童年糗事'][i],
          challengeBody: '放轻松，大家陪你一起玩',
          passLine: '喝杯茶压压惊',
        })),
        currentDicePlayerIndex: 1,
        diceCompletedBy: [],
        dicePassedBy: [],
        personalityDiceChallengesMeta: mockAigcMeta('social-personality-dice-v1'),
      }
    case 'speed_friending':
      return {
        ...base,
        currentPhase: 'speed_friending',
        speedFriendingPairs: [
          { userIdA: IB_HOST_ID, userIdB: 'ib-p2', displayNameA: '悦仔测试', displayNameB: '小鹿', roundIndex: 0 },
          { userIdA: 'ib-p3', userIdB: 'ib-p4', displayNameA: '阿澈', displayNameB: '桃桃', roundIndex: 0 },
          { userIdA: 'ib-p5', userIdB: 'ib-p6', displayNameA: '老周', displayNameB: '眠眠', roundIndex: 0 },
        ],
        speedFriendingCurrentRound: 0,
        speedFriendingTotalRounds: 3,
        speedFriendingRoundStartedAt: now - 3 * 60_000,
        speedFriendingAllRoundsComplete: false,
      }
    case 'recap':
      return {
        ...base,
        currentPhase: 'recap',
        completedPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice'],
        lastAdvanceTrigger: 'auto_all_ready',
      }
    case 'warmup-mood':
      // Host with no topics yet → mood grid (host_no_topics).
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-generating':
      // Same entry state; the /topics mock for this session hangs so the
      // generating shimmer is capturable after a mood tap.
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-error':
      // /topics 500s for this session → client topicsError → error card.
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-topic':
      // Topic dealt, partial ready — ember rim + count + ready CTA.
      return {
        ...base,
        currentPhase: 'warmup',
        completedPhases: [],
        selectedMood: 'funny',
        warmupTopics: [
          { id: 'wt-1', question: '最近一次让你笑出来的小事是什么？', mood: 'funny', emoji: '😄', category: '轻松开场', depthLevel: 1, promptStyle: 'experiential', safety: 'gentle' },
          { id: 'wt-2', question: '如果你要给今晚这桌起个队名，会叫什么？', mood: 'funny', emoji: '🎲', category: '桌面气氛', depthLevel: 1, promptStyle: 'reflective', safety: 'gentle' },
          { id: 'wt-3', question: '你朋友最常用哪句话吐槽你？', mood: 'funny', emoji: '🍌', category: '熟人视角', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
        ],
        warmupTopicsMeta: mockAigcMeta('social-warmup-topics-v1'),
        currentTopicIndex: 0,
        warmupReadyUserIds: [IB_HOST_ID, 'ib-p2', 'ib-p3'],
      }
    // ─── WaitingBeat emotional-layer fixtures (2026-09-17 pre-ship renders) ──
    // Viewer is a PARTICIPANT (hostUserId swapped to 老周) so the waiting
    // branches render: the default auth user (user-screenshot-001) is the
    // roster host and would see host controls instead.
    case 'waiting-beat-auction':
      // 拍卖未生成 → 等待主持人 (variant 'host')
      return {
        ...base,
        hostUserId: 'ib-p5',
        hostDisplayName: '老周',
        currentPhase: 'auction',
        auctionLots: [],
      }
    case 'waiting-beat-micro-done':
      // 已完成挑战 → 等待其他玩家 (variant 'peers')
      return {
        ...base,
        hostUserId: 'ib-p5',
        hostDisplayName: '老周',
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-waiting',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
          visualHint: '越真诚越好',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2', 'ib-p3'],
      }
    case 'waiting-beat-lie-round':
      // Viewer已提交陈述、其他人未提交 → 「你的陈述已提交，等待其他玩家完成」
      // (variant 'peers'). hasGeneratedStatements derives from the VIEWER's own
      // player entry carrying statements; everyoneGenerated stays false so the
      // waiting branch renders instead of the turn-rotation branches.
      return {
        ...base,
        hostUserId: 'ib-p5',
        hostDisplayName: '老周',
        currentPhase: 'lie_detective',
        // NOTE: players[] entries are treated as statement-ready by the view
        // (generatedUserIds = every player's userId), so include ONLY the
        // viewer — 5 empty-statement peers would flip everyoneGenerated to
        // true and route into the turn-rotation branches.
        lieDetectivePlayers: [
          { userId: IB_HOST_ID, displayName: '悦仔测试', statements: IB_LIE_STATEMENTS },
        ],
        currentLieDetectivePlayerIndex: 0,
        votes: [],
      }
    case 'waiting-beat-fallback':
      // 未注册 phase (king_game) → FallbackPhaseView 的 WaitingBeat
      return {
        ...base,
        hostUserId: 'ib-p5',
        hostDisplayName: '老周',
        currentPhase: 'king_game',
      }
    default:
      return { ...base, currentPhase: 'warmup' }
  }
}