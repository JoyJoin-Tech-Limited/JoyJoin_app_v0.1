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
    default:
      return { ...base, currentPhase: 'warmup' }
  }
}