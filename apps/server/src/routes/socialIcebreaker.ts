import { Router } from 'express';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  LieDetectivePlayer,
  LieDetectiveVote,
  PulseCheckResult,
} from '@shared/socialIcebreaker';
import { MVP_PHASES, getNextPhase } from '@shared/socialIcebreaker';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generateXiaoYueComment,
  generateRecapSummary,
} from '../socialIcebreakerAIService';

const router = Router();

// In-memory store for MVP (no DB needed)
const socialSessions = new Map<string, SocialSessionState>();
// Map: icebreakerSessionId -> socialSessionId
const sessionIndex = new Map<string, string>();
// Store lie statements server-side (isLie hidden from clients)
const lieStatements = new Map<string, Map<string, Array<{ index: number; text: string; isLie: boolean }>>>();

function getSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

// POST /api/social-icebreaker/start
router.post('/start', async (req: any, res) => {
  const { sessionId, userId, displayName } = req.body;

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId and userId are required' });
  }

  const socialSessionId = getSocialSessionId(sessionId);
  const existing = socialSessions.get(socialSessionId);

  if (existing) {
    // Already started — return existing state
    return res.json({
      socialSessionId,
      hostUserId: existing.hostUserId,
      hostDisplayName: existing.hostDisplayName,
      currentPhase: existing.currentPhase,
      state: sanitizeStateForClient(existing, userId),
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
  };

  socialSessions.set(socialSessionId, newState);
  sessionIndex.set(sessionId, socialSessionId);

  return res.json({
    socialSessionId,
    hostUserId: newState.hostUserId,
    hostDisplayName: newState.hostDisplayName,
    currentPhase: newState.currentPhase,
    state: sanitizeStateForClient(newState, userId),
  });
});

// GET /api/social-icebreaker/:socialSessionId
router.get('/:socialSessionId', (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.query.userId as string;

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  return res.json(sanitizeStateForClient(state, userId));
});

// POST /api/social-icebreaker/:socialSessionId/topics
router.post('/:socialSessionId/topics', async (req: any, res) => {
  const { socialSessionId } = req.params;
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

  try {
    const topics = await generateWarmupTopics({
      mood,
      eventType,
      participantCount,
      avoidTopics,
    });

    // Store topics in session
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
  const { userId, currentPhase } = req.body as {
    userId: string;
    currentPhase: SocialIcebreakerPhase;
  };

  if (!userId || !currentPhase) {
    return res.status(400).json({ error: 'userId and currentPhase are required' });
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

  // Determine next phase
  const nextPhase = getNextPhase(currentPhase, MVP_PHASES);
  const resolvedNextPhase: SocialIcebreakerPhase = nextPhase === 'recap' ? 'recap' : nextPhase;

  // Auto-skip lie_detective if not enough players
  const effectiveNextPhase =
    resolvedNextPhase === 'lie_detective' && state.playerCount < 3
      ? 'recap'
      : resolvedNextPhase;

  // Mark current phase as completed
  if (!state.completedPhases.includes(currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  state.currentPhase = effectiveNextPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  socialSessions.set(socialSessionId, state);

  // Pre-generate content for new phase
  let content: any = null;
  if (effectiveNextPhase === 'micro_challenge') {
    try {
      const challenges = await generateMicroChallenges({
        eventType: '活动',
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
    state: sanitizeStateForClient(state, userId),
  });
});

// POST /api/social-icebreaker/:socialSessionId/pulse-check
router.post('/:socialSessionId/pulse-check', (req: any, res) => {
  const { socialSessionId } = req.params;
  const { userId, vibe } = req.body as { userId: string; vibe: 1 | 2 | 3 };

  if (!userId || !vibe) {
    return res.status(400).json({ error: 'userId and vibe are required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  // Record pulse check
  const pulseChecks = state.pulseChecks || [];
  const existingIdx = pulseChecks.findIndex((p: PulseCheckResult) => p.userId === userId);
  if (existingIdx >= 0) {
    pulseChecks[existingIdx].vibe = vibe;
  } else {
    pulseChecks.push({ userId, vibe });
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

// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const { userId, displayName, archetype, interests } = req.body as {
    userId: string;
    displayName: string;
    archetype?: string;
    interests?: string[];
  };

  if (!userId || !displayName) {
    return res.status(400).json({ error: 'userId and displayName are required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  try {
    const statements = await generateLieDetectiveStatements({
      userId,
      displayName,
      archetype,
      interests,
    });

    // Store full statements (with isLie) server-side
    if (!lieStatements.has(socialSessionId)) {
      lieStatements.set(socialSessionId, new Map());
    }
    lieStatements.get(socialSessionId)!.set(userId, statements);

    // Register player in session
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
  const { voterId, targetUserId, guessedStatementIndex } = req.body as LieDetectiveVote;

  if (!voterId || !targetUserId || !guessedStatementIndex) {
    return res.status(400).json({ error: 'voterId, targetUserId, and guessedStatementIndex are required' });
  }

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
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

  // Check if all players have voted for this target
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

// GET /api/social-icebreaker/:socialSessionId/recap
router.get('/:socialSessionId/recap', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = socialSessions.get(socialSessionId);
  if (!state) {
    return res.status(404).json({ error: 'Social session not found' });
  }

  const durationMinutes = Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000);

  try {
    const players = state.lieDetectivePlayers || [];
    const summary = await generateRecapSummary({
      participants: players.map((p: LieDetectivePlayer) => ({ displayName: p.displayName })),
      topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
      challengesCompleted: state.challengeCompletedBy?.length || 0,
      durationMinutes,
    });

    return res.json({ summary, state: sanitizeStateForClient(state, '') });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate recap' });
  }
});

// Helper: sanitize state before sending to client (hide isLie)
function sanitizeStateForClient(state: SocialSessionState, _userId: string): SocialSessionState {
  return {
    ...state,
    // lieDetectivePlayers already has isLie stripped (stored without it)
  };
}

export default router;
