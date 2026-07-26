import type {
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';
import { getDaresForArchetype } from '@shared/personalityDiceDares';
import {
  buildPersonalityDicePrompt,
  buildPersonalityDicePromptV4,
  PERSONALITY_DICE_PROMPT_VERSION,
  PERSONALITY_DICE_CHOOSE_PROMPT_VERSION,
} from './ai/socialIcebreakerPrompts';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildAIGCMeta,
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { moderateGeneratedContent, toModerationChecksFromArray, type ModerationCheck } from './lib/aiContentModeration';
import { buildArchetypeContext } from './lib/contextInjector';
import { logger } from './lib/logger';
import { fireAndForgetQualityGate, raceWithTimeout, RACE_LLM_TIMEOUT_MS, type AIServiceResult } from './socialIcebreakerAICore';

type DominantTrait = 'A' | 'C' | 'E' | 'O' | 'X' | 'P';

function getDominantTrait(traitScores?: Record<string, number>): DominantTrait {
  if (!traitScores) return 'P';
  const traits: DominantTrait[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  let best: DominantTrait = 'P';
  let bestScore = -Infinity;
  for (const t of traits) {
    const score = traitScores[t] ?? traitScores[t.toLowerCase()] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function personalityDiceChallengeChecks(c: PersonalityDiceChallenge): ModerationCheck[] {
  return [
    { field: 'challengeTitle', text: c.challengeTitle },
    { field: 'challengeBody', text: c.challengeBody },
    { field: 'passLine', text: c.passLine },
    { field: 'passConsequence', text: c.passConsequence },
  ];
}

function personalityDiceChallengesChecks(challenges: PersonalityDiceChallenge[]): ModerationCheck[] {
  return challenges.flatMap((c, i) =>
    personalityDiceChallengeChecks(c).map((check) => ({ ...check, field: `[${i}].${check.field}` })),
  );
}

function personalityDiceChallengeGroupsChecks(groups: PersonalityDiceChallengeGroup[]): ModerationCheck[] {
  return groups.flatMap((g, gi) =>
    g.options.flatMap((option, oi) =>
      personalityDiceChallengeChecks(option).map((check) => ({
        ...check,
        field: `[${gi}].options[${oi}].${check.field}`,
      })),
    ),
  );
}

function attachAIGC<T>(result: AIServiceResult<T>): AIServiceResult<T> {
  return {
    data: result.data,
    meta: {
      ...result.meta,
      aigc: buildAIGCMeta({ fallbackUsed: result.meta.fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

function moderateAndAttachAIGC<T>(
  result: AIServiceResult<T>,
  options: {
    provider: AIProvider | null;
    model?: string;
    latencyMs: number;
    promptVersion: string;
    aiCorrelationId: string;
    feature: string;
    fallbackData: T;
    checks: ModerationCheck[];
  },
): AIServiceResult<T> {
  if (result.meta.fallbackUsed) {
    return attachAIGC(result);
  }
  const moderation = moderateGeneratedContent(options.checks, {
    domain: 'icebreaker',
    feature: options.feature,
    provider: options.provider,
    model: options.model,
    latencyMs: options.latencyMs,
    promptVersion: options.promptVersion,
    traceId: options.aiCorrelationId,
  });
  if (!moderation.safe) {
    return attachAIGC({
      data: options.fallbackData,
      meta: buildFallbackAIMeta('content_safety', options.promptVersion, options.aiCorrelationId),
    });
  }
  return attachAIGC(result);
}

/** Build archetype-specific fallback using the v2 curated dare bank. */
function buildArchetypeFallback(
  p: { userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> },
): PersonalityDiceChallenge {
  const trait = getDominantTrait(p.traitScores);
  const dares = getDaresForArchetype(p.archetype || 'corgi');
  const dare = dares[Math.floor(Math.random() * dares.length)];
  return {
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
    dominantTrait: trait,
    challengeTitle: dare.title,
    challengeBody: dare.body,
    challengeEmoji: dare.emoji,
    difficulty: dare.difficulty === 'easy' ? 'easy' : dare.difficulty === 'medium' ? 'medium' : 'hard',
    passLine: dare.passLine,
    passConsequence: dare.passConsequence,
  };
}

function isPersonalityDiceLlmEnabled(): boolean {
  const v = process.env.SOCIAL_PERSONALITY_DICE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generatePersonalityDiceChallenges(params: {
  participants: Array<{
    userId: string;
    displayName: string;
    archetype?: string;
    traitScores?: Record<string, number>;
  }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<PersonalityDiceChallenge[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { participants } = params;
  // Build archetype-aware v2 fallbacks first
  const fallbacks: PersonalityDiceChallenge[] = participants.map(p => buildArchetypeFallback(p));

  const sessionContext = buildArchetypeContext(participants);
  if (sessionContext?.mixText) {
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
  }

  // If AI is disabled, return curated fallback immediately
  if (!isPersonalityDiceLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbacks, meta });
  }

  const { client, model, provider } = getClientForFunction('generatePersonalityDiceChallenges');
  const t0 = Date.now();
  try {
    const participantList = participants.map((p) => ({
      displayName: p.displayName,
      archetype: p.archetype || '未知',
      dominantTrait: getDominantTrait(p.traitScores),
    }));

    const prompt = buildPersonalityDicePrompt({ participants: participantList, _refinementHint: params._refinementHint, sessionContext });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 400,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', PERSONALITY_DICE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbacks, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`);
      const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbacks, meta });
    }
    if (Array.isArray(parsed) && parsed.length === participants.length) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_personality_dice', aiCorrelationId, 'personality_dice');
      const liveChallenges: PersonalityDiceChallenge[] = participants.map((p, i) => ({
        userId: p.userId,
        displayName: p.displayName,
        archetype: p.archetype,
        dominantTrait: getDominantTrait(p.traitScores),
        challengeTitle: parsed[i].challengeTitle || fallbacks[i].challengeTitle,
        challengeBody: parsed[i].challengeBody || fallbacks[i].challengeBody,
        challengeEmoji: parsed[i].challengeEmoji || fallbacks[i].challengeEmoji,
        difficulty: parsed[i].difficulty || fallbacks[i].difficulty,
        passLine: parsed[i].passLine || fallbacks[i].passLine,
        passConsequence: parsed[i].passConsequence || fallbacks[i].passConsequence,
      }));
      return moderateAndAttachAIGC(
        { data: liveChallenges, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: PERSONALITY_DICE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generatePersonalityDiceChallenges',
          fallbackData: fallbacks,
          checks: personalityDiceChallengesChecks(liveChallenges),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape (expected ${participants.length} items), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbacks, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generatePersonalityDiceChallenges error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbacks, meta });
  }
}

// ─── Personality Dice V4 (Choose-Your-Prompt) ─────────────────────────────────

/** Build group fallback using the v2 curated dare bank — all 3 dares per archetype. */
function buildArchetypeFallbackGroup(
  p: { userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> },
): PersonalityDiceChallengeGroup {
  const trait = getDominantTrait(p.traitScores);
  const dares = getDaresForArchetype(p.archetype || 'corgi');
  const options: PersonalityDiceChallenge[] = dares.map((dare) => ({
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
    dominantTrait: trait,
    challengeTitle: dare.title,
    challengeBody: dare.body,
    challengeEmoji: dare.emoji,
    difficulty: dare.difficulty === 'easy' ? 'easy' : dare.difficulty === 'medium' ? 'medium' : 'hard',
    passLine: dare.passLine,
    passConsequence: dare.passConsequence,
  }));
  return {
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
    dominantTrait: trait,
    options,
  };
}

const EXPECTED_DIFFICULTIES: ['easy', 'medium', 'hard'] = ['easy', 'medium', 'hard'];

function validateDiceV4Groups(
  parsed: unknown,
  participantCount: number,
): parsed is Array<Array<Record<string, unknown>>> {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length !== participantCount) return false;
  for (const group of parsed) {
    if (!Array.isArray(group)) return false;
    if (group.length !== 3) return false;
    const difficulties = group.map((item: any) => item?.difficulty);
    if (
      difficulties[0] !== EXPECTED_DIFFICULTIES[0] ||
      difficulties[1] !== EXPECTED_DIFFICULTIES[1] ||
      difficulties[2] !== EXPECTED_DIFFICULTIES[2]
    ) {
      return false;
    }
  }
  return true;
}

export async function generatePersonalityDiceChallengeGroups(params: {
  participants: Array<{
    userId: string;
    displayName: string;
    archetype?: string;
    traitScores?: Record<string, number>;
  }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<PersonalityDiceChallengeGroup[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { participants } = params;

  // Build archetype-aware fallbacks first (3 dares per player from curated bank)
  const fallbacks: PersonalityDiceChallengeGroup[] = participants.map((p) =>
    buildArchetypeFallbackGroup(p),
  );

  const sessionContext = buildArchetypeContext(participants);
  if (sessionContext?.mixText) {
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'contextInjector',
      provider: null,
      model: 'n/a',
      latencyMs: 0,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: 'context-injector-v1',
      extra: {
        mixText: sessionContext.mixText,
        diversityScore: sessionContext.diversityScore,
      },
    });
  }

  // If AI is disabled, return curated fallback immediately
  if (!isPersonalityDiceLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', PERSONALITY_DICE_CHOOSE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generatePersonalityDiceChallengeGroups',
      provider: null,
      model: 'n/a',
      latencyMs: 0,
      success: true,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: fallbacks, meta });
  }

  const { client, model, provider } = getClientForFunction('generatePersonalityDiceChallengeGroups');
  const t0 = Date.now();
  try {
    const participantList = participants.map((p) => ({
      displayName: p.displayName,
      archetype: p.archetype || '未知',
      dominantTrait: getDominantTrait(p.traitScores),
    }));

    const prompt = buildPersonalityDicePromptV4({
      participants: participantList,
      _refinementHint: params._refinementHint,
      sessionContext,
    });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 800,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', PERSONALITY_DICE_CHOOSE_PROMPT_VERSION);
      logAITrace({
        domain: 'icebreaker',
        feature: 'generatePersonalityDiceChallengeGroups',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: fallbacks, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(
        `[SocialIcebreakerAI] generatePersonalityDiceChallengeGroups provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`,
      );
      const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_CHOOSE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generatePersonalityDiceChallengeGroups',
        provider,
        model,
        latencyMs,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: fallbacks, meta });
    }

    // Validate: correct number of groups, each with exactly 3 diff-ordered options
    if (validateDiceV4Groups(parsed, participants.length)) {
      const latencyMs = Date.now() - t0;
      logger.info(
        `[SocialIcebreakerAI] generatePersonalityDiceChallengeGroups provider=${provider} latency=${latencyMs}ms`,
      );
      const meta = buildLiveAIMeta(provider, PERSONALITY_DICE_CHOOSE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generatePersonalityDiceChallengeGroups',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: meta.promptVersion,
      });
      fireAndForgetQualityGate(
        content,
        'icebreaker_personality_dice',
        aiCorrelationId,
        'personality_dice',
      );

      const result: PersonalityDiceChallengeGroup[] = participants.map((p, i) => {
        const group = (parsed as Array<Array<Record<string, unknown>>>)[i];
        const fallbackGroup = fallbacks[i];
        return {
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
          dominantTrait: getDominantTrait(p.traitScores),
          options: group.map((item: Record<string, unknown>, j: number) => ({
            userId: p.userId,
            displayName: p.displayName,
            archetype: p.archetype,
            dominantTrait: getDominantTrait(p.traitScores),
            challengeTitle: String(item.challengeTitle ?? fallbackGroup.options[j].challengeTitle),
            challengeBody: String(item.challengeBody ?? fallbackGroup.options[j].challengeBody),
            challengeEmoji: String(item.challengeEmoji ?? fallbackGroup.options[j].challengeEmoji),
            difficulty: (['easy', 'medium', 'hard'] as const)[j],
            passLine: item.passLine != null ? String(item.passLine) : fallbackGroup.options[j].passLine,
            passConsequence:
              item.passConsequence != null
                ? String(item.passConsequence)
                : fallbackGroup.options[j].passConsequence,
          })),
        };
      });
      return moderateAndAttachAIGC(
        { data: result, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: PERSONALITY_DICE_CHOOSE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generatePersonalityDiceChallengeGroups',
          fallbackData: fallbacks,
          checks: personalityDiceChallengeGroupsChecks(result),
        },
      );
    }

    const latencyMs = Date.now() - t0;
    logger.warn(
      `[SocialIcebreakerAI] generatePersonalityDiceChallengeGroups provider=${provider} latency=${latencyMs}ms: invalid response shape (expected ${participants.length} groups × 3), using fallback`,
    );
    const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_CHOOSE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generatePersonalityDiceChallengeGroups',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: fallbacks, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(
      `[SocialIcebreakerAI] generatePersonalityDiceChallengeGroups error provider=${provider} latency=${latencyMs}ms:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    const meta = buildFallbackAIMeta('llm_error', PERSONALITY_DICE_CHOOSE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generatePersonalityDiceChallengeGroups',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: fallbacks, meta });
  }
}
