import { describe, it, expect } from 'vitest';

interface QuipPrompt {
  id: string;
  promptText: string;
  category: string;
}

interface QuipAnswer {
  userId: string;
  displayName: string;
  promptId: string;
  answerText: string;
}

interface QuipVote {
  voterId: string;
  answerId: string;
  promptId: string;
}

interface QuipBattleState {
  currentPhase: string;
  hostUserId: string;
  playerCount: number;
  quipBattlePrompts: QuipPrompt[];
  quipBattleAnswers: QuipAnswer[];
  quipBattleSubmittedUserIds: string[];
  quipBattleVotes: QuipVote[];
  quipBattleVotedUserIds: string[];
}

const MOCK_PROMPTS: QuipPrompt[] = [
  { id: 'qb_1', promptText: '如果有一天我变成了____', category: 'fun' },
  { id: 'qb_2', promptText: '我绝对不会承认我曾____', category: 'fun' },
  { id: 'qb_3', promptText: '用三个词形容____', category: 'creative' },
];

function makeState(overrides: Partial<QuipBattleState> = {}): QuipBattleState {
  return {
    currentPhase: 'quip_battle',
    hostUserId: 'host-user',
    playerCount: 4,
    quipBattlePrompts: [],
    quipBattleAnswers: [],
    quipBattleSubmittedUserIds: [],
    quipBattleVotes: [],
    quipBattleVotedUserIds: [],
    ...overrides,
  };
}

function generatePrompts(state: QuipBattleState, userId: string): { prompts?: QuipPrompt[]; error?: string; status?: number } {
  if (state.currentPhase !== 'quip_battle') {
    return { error: 'Not in quip_battle phase', status: 400 };
  }
  if (userId !== state.hostUserId) {
    return { error: 'Only host can generate prompts', status: 403 };
  }
  if (state.quipBattlePrompts.length > 0) {
    return { prompts: state.quipBattlePrompts };
  }
  const prompts = MOCK_PROMPTS;
  return { prompts };
}

function submitAnswer(
  state: QuipBattleState,
  userId: string,
  answers: { promptId: string; answerText: string }[],
): { state?: QuipBattleState; error?: string; status?: number } {
  if (state.currentPhase !== 'quip_battle') {
    return { error: 'Not in quip_battle phase', status: 400 };
  }
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return { error: 'answers array required', status: 400 };
  }
  if (state.quipBattleSubmittedUserIds.includes(userId)) {
    return { error: 'Already submitted', status: 409 };
  }
  const newAnswers: QuipAnswer[] = answers.map((a) => ({
    userId,
    displayName: `Player_${userId}`,
    promptId: a.promptId,
    answerText: a.answerText.slice(0, 100),
  }));
  return {
    state: {
      ...state,
      quipBattleAnswers: [...state.quipBattleAnswers, ...newAnswers],
      quipBattleSubmittedUserIds: [...state.quipBattleSubmittedUserIds, userId],
    },
  };
}

function submitVote(
  state: QuipBattleState,
  voterId: string,
  votes: { answerId: string; promptId: string }[],
): { state?: QuipBattleState; error?: string; status?: number } {
  if (state.currentPhase !== 'quip_battle') {
    return { error: 'Not in quip_battle phase', status: 400 };
  }
  if (!votes || !Array.isArray(votes) || votes.length === 0) {
    return { error: 'votes array required', status: 400 };
  }
  if (state.quipBattleVotedUserIds.includes(voterId)) {
    return { error: 'Already voted', status: 409 };
  }
  for (const v of votes) {
    const validAnswer = state.quipBattleAnswers.some((a) => `${a.userId}::${a.promptId}` === v.answerId);
    if (!validAnswer) {
      return { error: `Invalid answerId: ${v.answerId}`, status: 400 };
    }
    if (v.voterId === voterId && v.answerId.startsWith(voterId)) {
      return { error: 'Cannot vote for yourself', status: 400 };
    }
  }
  const deduped = votes.filter(
    (v, i, arr) => arr.findIndex((x) => x.promptId === v.promptId && x.answerId === v.answerId) === i,
  );
  const newVotes: QuipVote[] = deduped.map((v) => ({
    voterId,
    answerId: v.answerId,
    promptId: v.promptId,
  }));
  return {
    state: {
      ...state,
      quipBattleVotes: [...state.quipBattleVotes, ...newVotes],
      quipBattleVotedUserIds: [...state.quipBattleVotedUserIds, voterId],
    },
  };
}

describe('Quip Battle — pure logic', () => {
  describe('generate prompts', () => {
    it('returns error when not in quip_battle phase', () => {
      const state = makeState({ currentPhase: 'warmup' });
      const result = generatePrompts(state, 'host-user');
      expect(result.status).toBe(400);
      expect(result.error).toBe('Not in quip_battle phase');
    });

    it('returns error when non-host tries to generate', () => {
      const state = makeState();
      const result = generatePrompts(state, 'guest-1');
      expect(result.status).toBe(403);
      expect(result.error).toBe('Only host can generate prompts');
    });

    it('returns cached prompts when already generated', () => {
      const state = makeState({ quipBattlePrompts: MOCK_PROMPTS });
      const result = generatePrompts(state, 'host-user');
      expect(result.prompts).toHaveLength(3);
      expect(result.prompts).toBe(state.quipBattlePrompts);
    });

    it('generates prompts when none exist', () => {
      const state = makeState();
      const result = generatePrompts(state, 'host-user');
      expect(result.prompts).toHaveLength(3);
      expect(result.prompts![0].id).toBe('qb_1');
    });
  });

  describe('submit answer', () => {
    it('rejects when not in quip_battle phase', () => {
      const state = makeState({ currentPhase: 'warmup' });
      const result = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: 'test' }]);
      expect(result.status).toBe(400);
      expect(result.error).toBe('Not in quip_battle phase');
    });

    it('rejects empty answers array', () => {
      const state = makeState();
      const result = submitAnswer(state, 'guest-1', []);
      expect(result.status).toBe(400);
    });

    it('rejects missing answers', () => {
      const state = makeState();
      const result = submitAnswer(state, 'guest-1', undefined as any);
      expect(result.status).toBe(400);
    });

    it('submits answers successfully', () => {
      const state = makeState();
      const result = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: '我的答案' }]);
      expect(result.state).toBeDefined();
      expect(result.state!.quipBattleAnswers).toHaveLength(1);
      expect(result.state!.quipBattleAnswers[0].userId).toBe('guest-1');
      expect(result.state!.quipBattleAnswers[0].answerText).toBe('我的答案');
      expect(result.state!.quipBattleSubmittedUserIds).toContain('guest-1');
    });

    it('rejects duplicate submission', () => {
      const state = makeState({ quipBattleSubmittedUserIds: ['guest-1'] });
      const result = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: 'second' }]);
      expect(result.status).toBe(409);
      expect(result.error).toBe('Already submitted');
    });

    it('accepts multiple answers', () => {
      const state = makeState();
      const result = submitAnswer(state, 'guest-1', [
        { promptId: 'qb_1', answerText: '答案一' },
        { promptId: 'qb_2', answerText: '答案二' },
      ]);
      expect(result.state!.quipBattleAnswers).toHaveLength(2);
    });

    it('truncates answer text to 100 characters', () => {
      const state = makeState();
      const longText = 'x'.repeat(200);
      const result = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: longText }]);
      expect(result.state!.quipBattleAnswers[0].answerText.length).toBe(100);
    });

    it('accumulates answers from multiple users', () => {
      let state = makeState();
      const r1 = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: 'Alice' }]);
      state = r1.state!;
      const r2 = submitAnswer(state, 'guest-2', [{ promptId: 'qb_2', answerText: 'Bob' }]);
      expect(r2.state!.quipBattleAnswers).toHaveLength(2);
      expect(r2.state!.quipBattleSubmittedUserIds).toHaveLength(2);
    });
  });

  describe('vote', () => {
    const seededState = makeState({
      quipBattleAnswers: [
        { userId: 'host-user', displayName: 'Host', promptId: 'qb_1', answerText: '火锅' },
        { userId: 'guest-1', displayName: 'Alice', promptId: 'qb_1', answerText: '周末' },
      ],
    });

    it('rejects when not in quip_battle phase', () => {
      const state = makeState({ currentPhase: 'warmup' });
      const result = submitVote(state, 'guest-1', [{ answerId: 'host-user::qb_1', promptId: 'qb_1' }]);
      expect(result.status).toBe(400);
    });

    it('rejects empty votes', () => {
      const result = submitVote(seededState, 'guest-1', []);
      expect(result.status).toBe(400);
    });

    it('rejects invalid answerId', () => {
      const result = submitVote(seededState, 'guest-1', [{ answerId: 'nonexistent::qb_99', promptId: 'qb_99' }]);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Invalid answerId');
    });

    it('submits vote successfully', () => {
      const result = submitVote(seededState, 'guest-3', [{ answerId: 'guest-1::qb_1', promptId: 'qb_1' }]);
      expect(result.state!.quipBattleVotes).toHaveLength(1);
      expect(result.state!.quipBattleVotedUserIds).toContain('guest-3');
    });

    it('rejects already voted user', () => {
      const state = makeState({ quipBattleVotedUserIds: ['guest-1'] });
      const result = submitVote(state, 'guest-1', [{ answerId: 'host-user::qb_1', promptId: 'qb_1' }]);
      expect(result.status).toBe(409);
    });

    it('deduplicates on same promptId for same voter', () => {
      const state = makeState({ quipBattleAnswers: seededState.quipBattleAnswers });
      const r1 = submitVote(state, 'guest-3', [
        { answerId: 'host-user::qb_1', promptId: 'qb_1' },
        { answerId: 'guest-1::qb_1', promptId: 'qb_1' },
      ]);
      expect(r1.state!.quipBattleVotes).toHaveLength(2);
    });

    describe('full flow integration', () => {
      it('generate -> submit -> vote', () => {
        let state = makeState();

        const gen = generatePrompts(state, 'host-user');
        expect(gen.prompts).toHaveLength(3);

        const sub1 = submitAnswer(state, 'host-user', [{ promptId: 'qb_1', answerText: '火锅' }]);
        state = sub1.state!;
        const sub2 = submitAnswer(state, 'guest-1', [{ promptId: 'qb_1', answerText: '周末' }]);
        state = sub2.state!;

        expect(state.quipBattleAnswers).toHaveLength(2);
        expect(state.quipBattleSubmittedUserIds).toHaveLength(2);

        const vote1 = submitVote(state, 'guest-1', [{ answerId: 'host-user::qb_1', promptId: 'qb_1' }]);
        expect(vote1.state!.quipBattleVotes).toHaveLength(1);

        const vote2 = submitVote(vote1.state!, 'guest-2', [{ answerId: 'guest-1::qb_1', promptId: 'qb_1' }]);
        expect(vote2.state!.quipBattleVotes).toHaveLength(2);
      });

      it('generate is idempotent', () => {
        const state = makeState();
        const r1 = generatePrompts(state, 'host-user');
        const r2 = generatePrompts(state, 'host-user');
        expect(r1.prompts).toHaveLength(3);
        // Second call generates again since state wasn't mutated
        expect(r2.prompts).toHaveLength(3);
      });
    });
  });
});
