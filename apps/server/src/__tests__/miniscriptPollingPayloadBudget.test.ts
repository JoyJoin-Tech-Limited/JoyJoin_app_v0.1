/**
 * MiniScript V2 P3 · C2 polling payload budget (max-load mini_script slice).
 *
 * The icebreaker session poll ships `sanitizeStateForClient(state)` every ~3s
 * to every member. P2 added presentedEvidence reactionText entries, per-round
 * ballots, and two-step player results to the mini_script slice — this test
 * ratchets the slice size so future fields cannot silently bloat the poll.
 *
 * P3 note (2026-08-28): `reactionText` is optional on the wire — sanitize
 * omits it for non-presenters until the 8s server-side window or
 * `readConfirmedAt` (see socialIcebreakerHelpers). The fixture's entries are
 * 60s old, so every reaction is visible and the measured bound is unchanged;
 * a fresh `readConfirmedAt` field adds ≤~15B per entry, well inside headroom.
 *
 * Max-load fixture (documented bound):
 *  - 6 players (host + 5), all role-assigned
 *  - 2 evidence-bearing acts × 6 players × 2 presents (AC-02c budget) = 24
 *    presentedEvidence entries, each with a realistic 40-char CJK reactionText
 *  - 12 ballots (6 suspect + 6 motive), 6 revealed clues, 6 two-step results
 *  - full public framework (6 characters, 3 acts, evidence, motiveOptions)
 *
 * Measured 2026-08-28: player = 10,578B, host = 10,627B (UTF-8 JSON of all
 * `miniScript*` fields post-sanitize). Budget = 12KB (~13% headroom over the
 * realistic max — a deliberate ratchet: it fails on real slice growth, and
 * the saturation test below fails if the fixture shrinks instead).
 * At a 3s poll cadence this is ≈3.5 KB/s per member — comfortable on 4G.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SocialSessionState,
  MiniScriptPresentedEvidence,
} from '@shared/socialIcebreaker';
import type { MiniScriptStoryFrameworkPublic } from '@shared/miniscriptStoryFramework';
import { logger } from '../lib/logger';

const { testSessions } = vi.hoisted(() => ({
  testSessions: new Map<string, SocialSessionState>(),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: false,
  }),
  updateSession: async (socialSessionId: string, state: SocialSessionState) => {
    testSessions.set(socialSessionId, state);
  },
  listParticipants: async () => [],
  savePhaseMetric: async () => {},
}));

const { sanitizeStateForClient } = await import('../routes/socialIcebreakerHelpers');

/** Documented bound — see the file header for the fixture + measurement. */
export const MINISCRIPT_SLICE_BUDGET_BYTES = 12 * 1024;

const PLAYER_IDS = ['host-user', 'p1', 'p2', 'p3', 'p4', 'p5'] as const;

const REACTION_TEXT = '这个反应文本是四十个汉字的模拟长度用来估算真实的轮询负载大小喔。'; // 40 CJK chars

function makeMaxLoadFramework(): MiniScriptStoryFrameworkPublic {
  return {
    schemaVersion: 2,
    style: 'modern_urban',
    genres: ['light_reasoning'],
    title: '茶水间悬案',
    premise: '茶水间的燕麦奶不见了，监控只拍到半个身影，六个人都有嫌疑。',
    characters: [
      { slotIndex: 0, roleLabel: '设计师', sinHook: '嘴硬', alibi: '一直在工位改图，没离开过。' },
      { slotIndex: 1, roleLabel: '实习生', sinHook: '心软', alibi: '在会议室参加入职培训。' },
      { slotIndex: 2, roleLabel: '产品经理', sinHook: '逞强', alibi: '整天都在开需求评审会。' },
      { slotIndex: 3, roleLabel: '运维', sinHook: '逃避', alibi: '在机房处理服务器告警。' },
      { slotIndex: 4, roleLabel: '前台', sinHook: '好奇', alibi: '在前台接待访客和快递。' },
      { slotIndex: 5, roleLabel: '访客', sinHook: '拘谨', alibi: '在会客区等朋友下楼。' },
    ],
    act_flow: [
      {
        actNumber: 1,
        title: '开场',
        beats: ['介绍场景和各自的位置', '每人一句话描述自己看到了什么'],
        evidence: [
          { id: 'e1', name: '撕掉的便利贴', description: '垃圾桶里撕掉一半的便利贴，字迹潦草。', iconKey: '纸条' },
          { id: 'e2', name: '空燕麦奶盒', description: '水槽边没有冲洗的空盒子，盒口朝下。', iconKey: '盒子' },
        ],
      },
      {
        actNumber: 2,
        title: '线索',
        beats: ['交换信息，找出矛盾点', '自由讨论谁的时间线对不上'],
        evidence: [
          { id: 'e3', name: '监控截图', description: '茶水间门口的模糊身影，看不清脸。', iconKey: '照片' },
          { id: 'e4', name: '打卡记录', description: '下午三点到四点之间的门禁打卡列表。', iconKey: '文件' },
        ],
      },
      { actNumber: 3, title: '投票', beats: ['共识表决', '揭晓真相'] },
    ],
    ending: { resolutionSummary: '真相是一场乌龙：大家都以为自己闯了祸。', confessionMechanic: '每人认领一个自己的小秘密。' },
    voteOptions: { what: ['喝了燕麦奶', '写了纸条', '只是误会'], why: ['善意', '胆怯', '好面子'] },
    motiveOptions: ['太渴了顺手拿的', '想开个玩笑活跃气氛', '拿错了别人的盒子'],
  } as MiniScriptStoryFrameworkPublic;
}

function makeMaxLoadSession(): SocialSessionState {
  const now = Date.now();
  const presentedEvidence: MiniScriptPresentedEvidence[] = [];
  // AC-02c budget: ≤2 presents per player per act, over the 2 evidence acts.
  for (const actNo of [1, 2]) {
    for (const userId of PLAYER_IDS) {
      for (let i = 0; i < 2; i += 1) {
        presentedEvidence.push({
          evidenceId: actNo === 1 ? (i === 0 ? 'e1' : 'e2') : (i === 0 ? 'e3' : 'e4'),
          targetRoleSlot: (PLAYER_IDS.indexOf(userId) % 6) + 1,
          presentedBy: userId,
          actNo,
          presentedAt: now - 60_000,
          reactionText: REACTION_TEXT,
        });
      }
    }
  }

  return {
    socialSessionId: 'budget-session',
    icebreakerSessionId: 'ice-budget-session',
    currentPhase: 'mini_script',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: now - 1_800_000,
    sessionStartedAt: now - 3_600_000,
    completedPhases: ['warmup'],
    enabledPhases: ['mini_script', 'recap'],
    joinedParticipants: PLAYER_IDS.map((userId, index) => ({
      userId,
      displayName: `玩家${index + 1}`,
      joinedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      lastSeenAt: new Date(Date.UTC(2026, 0, 1, 1, index)).toISOString(),
      isActive: true,
    })),
    miniScriptFramework: makeMaxLoadFramework(),
    miniScriptV2Enabled: true,
    miniScriptRoleAssignments: Object.fromEntries(PLAYER_IDS.map((id, i) => [id, i])),
    miniScriptPlayerRuntimeViews: Object.fromEntries(
      PLAYER_IDS.map((id, i) => [
        id,
        {
          slotIndex: i,
          roleLabel: `角色${i + 1}`,
          sinHook: '嘴上不承认',
          alibi: '有完整的不在场证明。',
          secretAgenda: '其实我偷偷藏了一个小秘密没有告诉大家。',
        },
      ]),
    ),
    miniScriptCurrentAct: 3,
    miniScriptRevealedClues: Array.from({ length: 6 }, (_, i) => ({
      clueId: `c${i + 1}`,
      text: `第${i + 1}条线索的内容，大约二十个汉字左右的长度模拟。`,
      revealedInAct: (i % 3) + 1,
    })),
    miniScriptVotes: [
      ...PLAYER_IDS.map((userId, i) => ({
        userId,
        voteRound: 1 as const,
        suspectRoleSlot: (i % 6) + 1,
        votedAt: now - 30_000,
      })),
      ...PLAYER_IDS.map((userId, i) => ({
        userId,
        voteRound: 2 as const,
        motiveChoice: i % 3,
        votedAt: now - 10_000,
      })),
    ],
    miniScriptVoteOpenedAt: now - 120_000,
    miniScriptMotiveVoteOpenedAt: now - 60_000,
    miniScriptVoteRound: 2,
    miniScriptPresentedEvidence: presentedEvidence,
    miniScriptSolutionRevealed: true,
    miniScriptRevealedSolution: { who: '运维', what: '喝了燕麦奶', why: '太渴了顺手拿的', whoSlot: 4 },
    miniScriptRevealedResolutionSummary: '真相是一场乌龙：大家都以为自己闯了祸。',
    miniScriptRevealedPlayerResults: PLAYER_IDS.map((userId, i) => ({
      userId,
      round1Correct: i % 2 === 0,
      round2Correct: i % 3 === 0,
    })),
    miniScriptPlayerReady: Object.fromEntries(PLAYER_IDS.map((id) => [id, true])),
    miniScriptDeductionHints: [
      { stepNumber: 1, conclusion: '空盒子说明有人打开过燕麦奶。' },
      { stepNumber: 2, conclusion: '打卡记录排除了前台和访客。' },
      { stepNumber: 3, conclusion: '便利贴的字迹属于运维。' },
    ],
  } as SocialSessionState;
}

function miniscriptSliceBytes(client: SocialSessionState): number {
  const slice: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client)) {
    if (key.startsWith('miniScript') && value !== undefined) {
      slice[key] = value;
    }
  }
  return Buffer.byteLength(JSON.stringify(slice), 'utf8');
}

beforeEach(() => {
  testSessions.clear();
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('miniscript polling payload budget (C2)', () => {
  it('keeps the max-load miniscript slice within the documented byte budget', () => {
    const state = makeMaxLoadSession();

    const playerBytes = miniscriptSliceBytes(sanitizeStateForClient(state, 'p1'));
    const hostBytes = miniscriptSliceBytes(sanitizeStateForClient(state, 'host-user'));

    expect(playerBytes).toBeLessThanOrEqual(MINISCRIPT_SLICE_BUDGET_BYTES);
    expect(hostBytes).toBeLessThanOrEqual(MINISCRIPT_SLICE_BUDGET_BYTES);
  });

  it('saturates the fixture (guards against an accidentally empty max load)', () => {
    const state = makeMaxLoadSession();
    const client = sanitizeStateForClient(state, 'host-user');
    // 24 presented entries at the AC-02c budget — the dominant slice field.
    expect(client.miniScriptPresentedEvidence).toHaveLength(24);
    expect(client.miniScriptVotes).toHaveLength(12);
    expect(client.miniScriptRevealedPlayerResults).toHaveLength(6);
    expect(client.miniScriptMotiveVoteProgress?.votedCount).toBe(6);
    // A trivially-small payload means the fixture regressed, not the budget.
    expect(miniscriptSliceBytes(client)).toBeGreaterThan(4 * 1024);
  });
});
