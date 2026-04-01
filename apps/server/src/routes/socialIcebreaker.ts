import { Router } from 'express';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  LieDetectivePlayer,
  LieDetectiveVote,
  PulseCheckResult,
  PersonalityDiceChallenge,
} from '@shared/socialIcebreaker';
import { getNextEligiblePhase } from '@shared/socialIcebreaker';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generateXiaoYueComment,
  generateRecapSummary,
  generatePersonalityDiceChallenges,
} from '../socialIcebreakerAIService';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';

const router = Router();

// In-memory store for MVP (no DB needed)
const socialSessions = new Map<string, SocialSessionState>();
// Map: icebreakerSessionId -> socialSessionId
const sessionIndex = new Map<string, string>();
// Store lie statements server-side (isLie hidden from clients)
const lieStatements = new Map<string, Map<string, Array<{ index: number; text: string; isLie: boolean }>>>();
// Track unique joined users per session for accurate playerCount
const sessionJoinedUsers = new Map<string, Set<string>>();

// ============ TTL / MEMORY CLEANUP ============
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SOCIAL_SESSIONS = 1000;

function deleteSocialSession(socialSessionId: string): void {
  socialSessions.delete(socialSessionId);
  lieStatements.delete(socialSessionId);
  sessionJoinedUsers.delete(socialSessionId);
  for (const [icebreakerSessionId, mapped] of sessionIndex.entries()) {
    if (mapped === socialSessionId) {
      sessionIndex.delete(icebreakerSessionId);
    }
  }
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, state] of socialSessions.entries()) {
    if (now - (state.sessionStartedAt || 0) > SESSION_TTL_MS) {
      deleteSocialSession(id);
    }
  }
  if (socialSessions.size > MAX_SOCIAL_SESSIONS) {
    const byAge = Array.from(socialSessions.entries()).sort(
      ([, a], [, b]) => (a.sessionStartedAt || 0) - (b.sessionStartedAt || 0),
    );
    const excess = socialSessions.size - MAX_SOCIAL_SESSIONS;
    for (let i = 0; i < excess; i++) {
      deleteSocialSession(byAge[i][0]);
    }
  }
}

const sweepInterval = setInterval(cleanupStaleSessions, SESSION_SWEEP_INTERVAL_MS);
sweepInterval.unref?.();

function getSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

// Helper: sanitize state before sending to client (hide isLie)
function sanitizeStateForClient(state: SocialSessionState): SocialSessionState {
  return { ...state };
}

// Helper: update playerCount from joined user set
function syncPlayerCount(socialSessionId: string, state: SocialSessionState): void {
  const joined = sessionJoinedUsers.get(socialSessionId);
  if (joined) {
    state.playerCount = joined.size;
  }
}

// POST /api/social-icebreaker/start
router.post('/start', async (req: any, res) => {
  // Use authenticated session user; fall back to body only for display name
  const userId: string = req.session?.userId;
  const { sessionId, displayName, eventType } = req.body;

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId and authenticated userId are required' });
  }

  const socialSessionId = getSocialSessionId(sessionId);
  const existing = socialSessions.get(socialSessionId);

  // Track this user as joined
  if (!sessionJoinedUsers.has(socialSessionId)) {
    sessionJoinedUsers.set(socialSessionId, new Set());
  }
  sessionJoinedUsers.get(socialSessionId)!.add(userId);

  if (existing) {
    syncPlayerCount(socialSessionId, existing);
    ensureSessionEnabledPhases(existing);
    socialSessions.set(socialSessionId, existing);
    return res.json({
      socialSessionId,
      hostUserId: existing.hostUserId,
      hostDisplayName: existing.hostDisplayName,
      currentPhase: existing.currentPhase,
      state: sanitizeStateForClient(existing),
    });
  }

  // Create new social session — first caller becomes host
  const newState: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: sessionId,
    currentPhase: 'warmup',
    hostUserId: userId,
    hostDisplayName: displayName || '主持人',
    playerCount: 1,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    eventType,
    enabledPhases: getServerEnabledPhases(),
  };

  socialSessions.set(socialSessionId, newState);
  sessionIndex.set(sessionId, socialSessionId);

  return res.json({
    socialSessionId,
    hostUserId: newState.hostUserId,
    hostDisplayName: newState.hostDisplayName,
    currentPhase: newState.currentPhase,
    state: sanitizeStateForClient(newState),
  });
});

// GET /api/social-icebreaker/:socialSessionId
router.get('/:socialSessionId', (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  ensureSessionEnabledPhases(state);

  // Track this user as joined (polling counts as presence)
  if (userId) {
    if (!sessionJoinedUsers.has(socialSessionId)) {
      sessionJoinedUsers.set(socialSessionId, new Set());
    }
    sessionJoinedUsers.get(socialSessionId)!.add(userId);
    syncPlayerCount(socialSessionId, state);
    socialSessions.set(socialSessionId, state);
  }

  return res.json(sanitizeStateForClient(state));
});

// POST /api/social-icebreaker/:socialSessionId/topics
// Only the host can refresh/change topics (shared session-level state)
router.post('/:socialSessionId/topics', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { mood, eventType = '活动', participantCount = 4, avoidTopics } = req.body as {
    mood: AtmosphereMood;
    eventType?: string;
    participantCount?: number;
    avoidTopics?: string[];
  };

  if (!mood) {
    return res.status(400).json({ error: 'mood is required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can change topics' });
  }

  try {
    const topics = await generateWarmupTopics({
      mood,
      eventType,
      participantCount: state.playerCount || participantCount,
      avoidTopics,
    });

    // Store topics in session so pollers see them too
    state.warmupTopics = topics;
    state.selectedMood = mood;
    state.currentTopicIndex = 0;
    socialSessions.set(socialSessionId, state);

    return res.json({ topics });
  } catch (error) {
    console.error('[SocialIcebreaker] topics error:', error);
    return res.status(500).json({ error: 'Failed to generate topics' });
  }
});

// POST /api/social-icebreaker/:socialSessionId/advance
router.post('/:socialSessionId/advance', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { currentPhase } = req.body as { currentPhase: SocialIcebreakerPhase };

  if (!currentPhase) {
    return res.status(400).json({ error: 'currentPhase is required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can advance phases' });
  }

  if (state.currentPhase !== currentPhase) {
    return res.status(400).json({ error: 'Phase mismatch' });
  }

  const resolvedEnabledPhases = ensureSessionEnabledPhases(state);
  const effectiveNextPhase = getNextEligiblePhase(currentPhase, resolvedEnabledPhases, state.playerCount);

  if (!state.completedPhases.includes(currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  cleanupPhaseStateForNextPhase(state, currentPhase);
  state.currentPhase = effectiveNextPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  socialSessions.set(socialSessionId, state);

  let content: any = null;
  if (effectiveNextPhase === 'micro_challenge') {
    try {
      const challenges = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
      });
      state.currentChallenge = challenges[0];
      state.challengeCompletedBy = [];
      socialSessions.set(socialSessionId, state);
      content = { challenge: state.currentChallenge };
    } catch {
      // fallback silently handled in AI service
    }
  }

  const comment = await generateXiaoYueComment({
    phase: effectiveNextPhase,
    event: 'phase_start',
  }).catch(() => '');

  return res.json({
    nextPhase: effectiveNextPhase,
    content,
    xiaoYueComment: comment,
    state: sanitizeStateForClient(state),
  });
});

// POST /api/social-icebreaker/:socialSessionId/pulse-check
router.post('/:socialSessionId/pulse-check', (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { vibe } = req.body as { vibe: number };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (typeof vibe !== 'number' || ![1, 2, 3].includes(vibe)) {
    return res.status(400).json({ error: 'vibe must be 1, 2, or 3' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  const pulseChecks = state.pulseChecks || [];
  const existingIdx = pulseChecks.findIndex((p: PulseCheckResult) => p.userId === userId);
  const vibeValue = vibe as 1 | 2 | 3;
  if (existingIdx >= 0) {
    pulseChecks[existingIdx].vibe = vibeValue;
  } else {
    pulseChecks.push({ userId, vibe: vibeValue });
  }
  state.pulseChecks = pulseChecks;
  socialSessions.set(socialSessionId, state);

  const voteCount = pulseChecks.length;
  const averageVibe = pulseChecks.reduce((sum: number, p: PulseCheckResult) => sum + p.vibe, 0) / voteCount;

  return res.json({
    voteCount,
    averageVibe: Math.round(averageVibe * 10) / 10,
    allVoted: voteCount >= state.playerCount,
  });
});

// POST /api/social-icebreaker/:socialSessionId/micro-challenge/complete
router.post('/:socialSessionId/micro-challenge/complete', (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  const completedBy = state.challengeCompletedBy || [];
  if (!completedBy.includes(userId)) {
    completedBy.push(userId);
    state.challengeCompletedBy = completedBy;
    socialSessions.set(socialSessionId, state);
  }

  return res.json({
    completedBy: state.challengeCompletedBy,
    completedCount: completedBy.length,
    totalCount: state.playerCount,
  });
});

// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { displayName, archetype, interests } = req.body as {
    displayName: string;
    archetype?: string;
    interests?: string[];
  };

  if (!userId || !displayName) {
    return res.status(400).json({ error: 'Authentication and displayName are required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  // F3: Wrong-phase guard — statement generation is only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  try {
    const statements = await generateLieDetectiveStatements({
      userId,
      displayName,
      archetype,
      interests,
    });

    if (!lieStatements.has(socialSessionId)) {
      lieStatements.set(socialSessionId, new Map());
    }
    lieStatements.get(socialSessionId)!.set(userId, statements);

    const players: LieDetectivePlayer[] = state.lieDetectivePlayers || [];
    const existingPlayer = players.findIndex((p: LieDetectivePlayer) => p.userId === userId);
    const sanitizedStatements = statements.map(s => ({ index: s.index, text: s.text }));

    if (existingPlayer >= 0) {
      players[existingPlayer].statements = sanitizedStatements;
    } else {
      players.push({ userId, displayName, statements: sanitizedStatements });
    }

    state.lieDetectivePlayers = players;
    if (state.currentLieDetectivePlayerIndex === undefined) {
      state.currentLieDetectivePlayerIndex = 0;
    }
    state.votes = state.votes || [];
    socialSessions.set(socialSessionId, state);

    return res.json({ statements: sanitizedStatements });
  } catch (error) {
    console.error('[SocialIcebreaker] lie-detective/generate error:', error);
    return res.status(500).json({ error: 'Failed to generate statements' });
  }
});

// POST /api/social-icebreaker/:socialSessionId/lie-detective/vote
router.post('/:socialSessionId/lie-detective/vote', (req: any, res) => {
  const { socialSessionId } = req.params;
  const voterId: string = req.session?.userId;
  const { targetUserId, guessedStatementIndex } = req.body as {
    targetUserId: string;
    guessedStatementIndex: number;
  };

  if (!voterId || !targetUserId || guessedStatementIndex === undefined || guessedStatementIndex === null) {
    return res.status(400).json({ error: 'Authentication, targetUserId, and guessedStatementIndex are required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  const votes: LieDetectiveVote[] = state.votes || [];
  const existingVoteIdx = votes.findIndex(
    (v: LieDetectiveVote) => v.voterId === voterId && v.targetUserId === targetUserId
  );
  if (existingVoteIdx >= 0) {
    votes[existingVoteIdx].guessedStatementIndex = guessedStatementIndex;
  } else {
    votes.push({ voterId, targetUserId, guessedStatementIndex });
  }
  state.votes = votes;
  socialSessions.set(socialSessionId, state);

  const targetPlayers = state.lieDetectivePlayers || [];
  const otherPlayerCount = targetPlayers.filter((p: LieDetectivePlayer) => p.userId !== targetUserId).length;
  const votesForTarget = votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId).length;
  const isRevealed = votesForTarget >= otherPlayerCount && otherPlayerCount > 0;

  let lieIndex: number | undefined;
  if (isRevealed) {
    const sessionLies = lieStatements.get(socialSessionId);
    const playerStatements = sessionLies?.get(targetUserId);
    lieIndex = playerStatements?.find(s => s.isLie)?.index;
  }

  return res.json({
    votes: votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId),
    isRevealed,
    lieIndex,
  });
});

// POST /api/social-icebreaker/:socialSessionId/personality-dice/generate
router.post('/:socialSessionId/personality-dice/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { participants } = req.body as {
    participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>;
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can generate dice challenges' });
  }

  try {
    const challenges = await generatePersonalityDiceChallenges(participants || []);
    state.personalityDiceChallenges = challenges;
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = [];
    socialSessions.set(socialSessionId, state);

    return res.json({ challenges });
  } catch (error) {
    console.error('[SocialIcebreaker] personality-dice/generate error:', error);
    return res.status(500).json({ error: 'Failed to generate dice challenges' });
  }
});

// POST /api/social-icebreaker/:socialSessionId/personality-dice/complete
router.post('/:socialSessionId/personality-dice/complete', (req: any, res) => {
  const { socialSessionId } = req.params;
  // F2: Derive the acting user from the authenticated session — never trust body userId
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  const diceCompletedBy = state.diceCompletedBy || [];
  if (!diceCompletedBy.includes(userId)) {
    diceCompletedBy.push(userId);
    state.diceCompletedBy = diceCompletedBy;
  }

  // Advance currentDicePlayerIndex if the current player just completed
  const challenges = state.personalityDiceChallenges || [];
  const currentIdx = state.currentDicePlayerIndex ?? 0;
  if (challenges[currentIdx]?.userId === userId) {
    state.currentDicePlayerIndex = Math.min(currentIdx + 1, challenges.length - 1);
  }

  socialSessions.set(socialSessionId, state);

  const allCompleted = challenges.length > 0 && diceCompletedBy.length >= challenges.length;

  return res.json({
    diceCompletedBy,
    currentDicePlayerIndex: state.currentDicePlayerIndex,
    allCompleted,
  });
});

// GET /api/social-icebreaker/:socialSessionId/recap
router.get('/:socialSessionId/recap', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  const durationMinutes = Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000);

  // ── Compute medals ──────────────────────────────────────────────────────────
  interface Medal {
    emoji: string;
    title: string;
    recipientDisplayName: string;
    description: string;
  }
  const medals: Medal[] = [];

  // 🕵️ 最佳侦探: most correct lie guesses
  const sessionLieMap = lieStatements.get(socialSessionId);
  if (sessionLieMap && (state.votes || []).length > 0) {
    const correctByVoter: Record<string, number> = {};
    for (const vote of state.votes || []) {
      const playerStmts = sessionLieMap.get(vote.targetUserId);
      const lieStmt = playerStmts?.find(s => s.isLie);
      if (lieStmt && vote.guessedStatementIndex === lieStmt.index) {
        correctByVoter[vote.voterId] = (correctByVoter[vote.voterId] || 0) + 1;
      }
    }
    const topVoter = Object.entries(correctByVoter).sort((a, b) => b[1] - a[1])[0];
    if (topVoter && topVoter[1] > 0) {
      const allPlayers = [
        ...(state.lieDetectivePlayers || []),
        { userId: state.hostUserId, displayName: state.hostDisplayName },
      ];
      const recipient = allPlayers.find(p => p.userId === topVoter[0]);
      if (recipient) {
        medals.push({
          emoji: '🕵️',
          title: '最佳侦探',
          recipientDisplayName: recipient.displayName,
          description: `猜对了 ${topVoter[1]} 个谎言`,
        });
      }
    }
  }

  // ⚡ 挑战先锋: first person in challengeCompletedBy
  if (state.challengeCompletedBy && state.challengeCompletedBy.length > 0) {
    const firstUserId = state.challengeCompletedBy[0];
    const allPlayersForChallenge = [
      ...(state.lieDetectivePlayers || []),
      { userId: state.hostUserId, displayName: state.hostDisplayName },
    ];
    const recipient = allPlayersForChallenge.find(p => p.userId === firstUserId);
    if (recipient) {
      medals.push({
        emoji: '⚡',
        title: '挑战先锋',
        recipientDisplayName: recipient.displayName,
        description: '第一个完成挑战',
      });
    }
  }

  // 💬 话题王: host gets credit if at least 3 topics were reached (currentTopicIndex is 0-indexed)
  const MIN_TOPICS_FOR_MEDAL = 3;
  if ((state.currentTopicIndex ?? 0) >= MIN_TOPICS_FOR_MEDAL - 1) {
    medals.push({
      emoji: '💬',
      title: '话题王',
      recipientDisplayName: state.hostDisplayName,
      description: '带领大家聊了多个精彩话题',
    });
  }

  try {
    const players = state.lieDetectivePlayers || [];
    const summary = await generateRecapSummary({
      participants: players.map((p: LieDetectivePlayer) => ({ displayName: p.displayName })),
      topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
      challengesCompleted: state.challengeCompletedBy?.length || 0,
      durationMinutes,
    });

    return res.json({ summary, medals, state: sanitizeStateForClient(state) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate recap' });
  }
});

export default router;
