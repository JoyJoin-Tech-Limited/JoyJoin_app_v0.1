import type { Express } from "express";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { storage } from "../../storage";
import { determineSubtype, generateInsights } from "./assessment";
import type { ArchetypeName } from "../../archetypeConfig";
import { ARCHETYPE_NAMES } from "../../archetypeConfig";
import { prefetchAnalysisIfReady } from "../../xiaoyueAnalysisService";
import { annotateOptionsWithCommentary } from "@shared/personality";
import { captureLocationSnapshot } from "../../lib/captureLocationSnapshot";

/** Validates that the matcher produced a sane final result before we persist it. */
function validateFinalResult(finalResult: any): { valid: boolean; primaryArchetype: string; error?: string } {
  if (!finalResult || typeof finalResult !== 'object') {
    return { valid: false, primaryArchetype: 'corgi', error: 'finalResult is null or not an object' };
  }
  const primary = finalResult.primaryArchetype;
  if (!primary || typeof primary !== 'string') {
    return { valid: false, primaryArchetype: 'corgi', error: `primaryArchetype is missing or not a string: ${primary}` };
  }
  if (!ARCHETYPE_NAMES.includes(primary)) {
    return { valid: false, primaryArchetype: 'corgi', error: `primaryArchetype '${primary}' is not a valid archetype` };
  }
  return { valid: true, primaryArchetype: primary };
}

function shuffleOptions(options: any[]): any[] {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function annotatedShuffleOptions(questionId: string, options: any[]): any[] {
  const annotated = annotateOptionsWithCommentary(questionId, options);
  return shuffleOptions(annotated);
}

async function restoreEngineState(session: any, assessmentConfig: any) {
  const {
    questionsV4,
    initializeEngineState,
    processAnswer,
  } = await import('@shared/personality');

  const answers = await storage.getAssessmentAnswers(session.id);
  let engineState = initializeEngineState(assessmentConfig);

  // Rehydrate skip state so swapped questions (and their variants) stay excluded
  // when the engine is rebuilt from stored answers.
  const skippedIds: string[] = (session.skippedQuestionIds as string[]) || [];
  for (const skippedId of skippedIds) {
    engineState.skippedQuestionIds.add(skippedId);
  }
  engineState.skipCount = session.skipCount || 0;

  for (const answer of answers) {
    const q = questionsV4.find((quest: any) => quest.id === answer.questionId);
    if (q) {
      engineState = processAnswer(engineState, q, answer.selectedOption);
    }
  }

  return { engineState, answers };
}

export function registerAssessmentV4Routes(app: Express): void {
  app.post('/api/assessment/v4/start', async (req: any, res) => {
    try {
      const { preSignupAnswers, sessionId: existingSessionId, forceNew } = req.body;
      const userId = req.session?.userId || null;
      
      logger.info("[Assessment V4 Start] Called with", {
        existingSessionId,
        userId,
        forceNew,
        preSignupAnswersCount: preSignupAnswers?.length || 0,
        hasSession: !!req.session,
      });
      
      // Import adaptive engine
      const { 
        initializeEngineState,
        processAnswer,
        selectNextQuestion,
        shouldTerminate,
        getClosingQuestionsRemaining,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      let session;
      let engineState;
      
      // Determine if this is an explicit restart request vs automatic forceNew from presignup flow
      // forceNew + preSignupAnswers = automatic (post-login, should resume existing session)
      // forceNew + NO preSignupAnswers = explicit restart (user wants fresh start)
      const isExplicitRestart = forceNew && (!preSignupAnswers || preSignupAnswers.length === 0);
      
      // PRIORITY 1: For logged-in users, check for existing session first
      // Resume existing session UNLESS user explicitly wants to restart
      if (userId && !isExplicitRestart) {
        const existingUserSession = await storage.getAssessmentSessionByUser(userId);
        logger.info("[V4 Start] Checked for existing user session", {
          userId,
          foundSession: !!existingUserSession,
          sessionId: existingUserSession?.id,
          isCompleted: existingUserSession?.completedAt ? true : false,
        });
        
        if (existingUserSession && !existingUserSession.completedAt) {
          // Resume existing session - it was created by presignup-sync
          session = existingUserSession;
          
          // Reconstruct engine state from session data (answers + skipped questions)
          const restoreResult = await restoreEngineState(session, assessmentConfig);
          engineState = restoreResult.engineState;
          const answers = restoreResult.answers;
          
          logger.info("[V4 Start] Resuming existing session for user", { userId, answerCount: answers.length });
        } else if (existingUserSession && existingUserSession.completedAt) {
          // User has a completed session - start fresh
          logger.info('[V4 Start] User has completed session, creating new one');
        } else {
          logger.info("[V4 Start] No existing session found for user", { data: userId });
        }
      } else if (userId && isExplicitRestart) {
        logger.info("[V4 Start] Explicit restart requested for user", { data: userId });
      }
      
      // If resuming by session ID (anonymous pre-signup flow)
      if (!session && existingSessionId && !forceNew) {
        logger.info("[V4 Start] Attempting to resume by sessionId", { data: existingSessionId });
        session = await storage.getAssessmentSession(existingSessionId);
        if (!session) {
          logger.error("[V4 Start] Session not found by sessionId", { error: String(existingSessionId) });
          return res.status(404).json({ message: 'Session not found' });
        }
        
        logger.info("[V4 Start] Found session by sessionId", {
          sessionId: session.id,
          userId: session.userId,
          phase: session.phase,
        });
        
        // Reconstruct engine state from session data (answers + skipped questions)
        const restoreResult = await restoreEngineState(session, assessmentConfig);
        engineState = restoreResult.engineState;
        const answers = restoreResult.answers;
        
        logger.info('[V4 Start] Replayed answers for session', { count: answers.length, sessionId: existingSessionId });
      }
      
      // Stale session guard: if we resumed an incomplete session but all questions are answered,
      // the session row is stale (complete but not marked). Discard it so a fresh session is created.
      if (session && !session.completedAt && engineState) {
        const staleCheckNext = selectNextQuestion(engineState);
        if (staleCheckNext === null) {
          logger.warn('[V4 Start] Stale incomplete session detected (all answered, no next question); starting fresh', {
            sessionId: session.id,
            userId,
          });
          // Mark the stale session as completed to prevent future hits and fix nextStep gap.
          // NOTE: These two operations are not atomically guarded by a DB transaction
          // because the storage facade does not yet expose tx support. In practice,
          // if markPersonalityTestComplete fails, the session is still marked complete
          // and a fresh session is created, so the user is unblocked. The inconsistency
          // (session complete but user flag false) is harmless because the stale guard
          // will fire again on the next /start and retry the flag sync.
          try {
            const userSecondaryData = (session.preSignupData as any)?.secondaryData ?? {};
            const { getFinalResult } = await import('@shared/personality');
            const finalResult = getFinalResult(engineState, userSecondaryData);
            const validation = validateFinalResult(finalResult);
            if (!validation.valid) {
              finalResult.primaryArchetype = validation.primaryArchetype;
            }

            await storage.updateAssessmentSession(session.id, {
              phase: 'completed',
              currentQuestionIndex: engineState.answeredQuestionIds.size,
              totalQuestions: engineState.answeredQuestionIds.size,
              traitConfidences: engineState.traitConfidences,
              topArchetypes: engineState.currentMatches,
              finalResult,
              traitScores: finalResult.traitScores,
              primaryArchetype: finalResult.primaryArchetype,
              isDecisive: finalResult.isDecisive,
              completedAt: new Date(),
            });
            // Also sync the user flag so nextStep doesn't loop back to personality-test
            if (userId) {
              await storage.markPersonalityTestComplete(userId);
            }
          } catch (syncErr) {
            logger.error('[V4 Start] Stale session cleanup failed', {
              sessionId: session.id,
              userId,
              error: syncErr instanceof Error ? syncErr.message : String(syncErr),
            });
            // Continue to create a fresh session — don't block the user
          }
          session = undefined;
          engineState = undefined;
        }
      }
      
      // Create new session if none exists
      if (!session) {
        // Create new session - fresh start
        session = await storage.createAssessmentSession({
          userId,
          phase: userId ? 'post_signup' : 'pre_signup',
          preSignupAnswers: preSignupAnswers || null,
        });
        
        engineState = initializeEngineState(assessmentConfig);
        
        // If we have pre-signup answers, process them (only for new session)
        if (preSignupAnswers && Array.isArray(preSignupAnswers)) {
          const { questionsV4 } = await import('@shared/personality');
          
          // Defensive deduplication: keep only the latest answer per questionId
          const dedupedAnswers = new Map<string, typeof preSignupAnswers[0]>();
          for (const ans of preSignupAnswers) {
            dedupedAnswers.set(ans.questionId, ans);
          }
          const uniqueAnswers = Array.from(dedupedAnswers.values());
          
          for (const ans of uniqueAnswers) {
            const question = questionsV4.find(q => q.id === ans.questionId);
            if (question) {
              engineState = processAnswer(engineState, question, ans.selectedOption);
              
              // Save answer to database
              await storage.createAssessmentAnswer({
                sessionId: session.id,
                questionId: ans.questionId,
                questionLevel: question.level,
                selectedOption: ans.selectedOption,
                traitScores: question.options.find(o => o.value === ans.selectedOption)?.traitScores || {},
              });
            }
          }
        }
      }
      
      // Ensure engineState is initialized (should always be by this point)
      if (!engineState) {
        logger.info('[V4 Start] Engine state was not initialized, initializing now');
        engineState = initializeEngineState(assessmentConfig);
      }
      
      // Ensure session exists by this point
      if (!session) {
        logger.error('[V4 Start] No session available after all checks - this should not happen');
        return res.status(500).json({ message: 'Failed to create or find session' });
      }
      
      // Get next question
      const nextQuestion = selectNextQuestion(engineState);
      
      logger.info("[Assessment V4 Start] Engine state", {
        answeredCount: engineState.answeredQuestionIds.size,
        skipCount: engineState.skipCount,
        phase: session.phase,
        hasNextQuestion: !!nextQuestion,
        nextQuestionId: nextQuestion?.id,
      });
      
      const response = {
        sessionId: session.id,
        phase: session.phase,
        currentQuestionIndex: engineState.answeredQuestionIds.size,
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          level: nextQuestion.level,
          category: nextQuestion.category,
          scenarioText: nextQuestion.scenarioText,
          questionText: nextQuestion.questionText,
          options: annotatedShuffleOptions(nextQuestion.id, nextQuestion.options),
          questionType: nextQuestion.questionType,
          sliderConfig: nextQuestion.sliderConfig,
        } : null,
        progress: {
          answered: engineState.answeredQuestionIds.size,
          minQuestions: engineState.config.minQuestions,
          softMaxQuestions: engineState.config.softMaxQuestions,
          hardMaxQuestions: engineState.config.hardMaxQuestions,
          estimatedRemaining: shouldTerminate(engineState)
            ? getClosingQuestionsRemaining(engineState)
            : Math.max(0, engineState.config.minQuestions - engineState.answeredQuestionIds.size) + getClosingQuestionsRemaining(engineState),
        },
        currentMatches: engineState.currentMatches.slice(0, 3),
        isComplete: nextQuestion === null,
      };
      
      logger.info("[Assessment V4 Start] Response", {
        sessionId: response.sessionId,
        phase: response.phase,
        answered: response.progress.answered,
        hasNextQuestion: !!response.nextQuestion,
        isComplete: response.isComplete,
      });
      
      res.json(response);
    } catch (error: any) {
      logger.error("[Assessment V4 Start] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to start assessment', error: error.message });
    }
  });
  app.post('/api/assessment/v4/:sessionId/answer', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId, selectedOption } = req.body;
      
      logger.info("[Assessment V4 Answer] Called with", {
        sessionId,
        questionId,
        selectedOption,
      });
      
      if (!questionId || !selectedOption) {
        return res.status(400).json({ message: 'questionId and selectedOption are required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        logger.error("[Assessment V4 Answer] Session not found", { error: String(sessionId) });
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Import modules
      const { 
        questionsV4, 
        selectNextQuestion,
        shouldTerminate,
        isAssessmentComplete,
        getClosingQuestionsRemaining,
        getFinalResult,
        getOptionFeedback,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG,
        SECONDARY_QUESTION_MAP,
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Find the question
      const question = questionsV4.find(q => q.id === questionId);
      if (!question) {
        return res.status(400).json({ message: 'Invalid question ID' });
      }
      
      // Validate option
      const option = question.options.find(o => o.value === selectedOption);
      if (!option) {
        return res.status(400).json({ message: 'Invalid option selected' });
      }

      // Detect playful secondary questions and persist the decoded value
      if (SECONDARY_QUESTION_MAP[questionId]) {
        const { field, valueMap } = SECONDARY_QUESTION_MAP[questionId];
        const secondaryValue = valueMap[selectedOption];
        if (secondaryValue) {
          const currentPreSignup = session.preSignupData as any;
          const existingSecondary =
            currentPreSignup && !Array.isArray(currentPreSignup)
              ? currentPreSignup.secondaryData ?? {}
              : {};
          const newPreSignupData = Array.isArray(currentPreSignup)
            ? currentPreSignup
            : {
                ...(currentPreSignup ?? {}),
                secondaryData: { ...existingSecondary, [field]: secondaryValue },
              };
          await storage.updateAssessmentSession(sessionId, {
            preSignupAnswers: newPreSignupData,
          });
        }
      }
      
      // Save answer
      await storage.createAssessmentAnswer({
        sessionId,
        questionId,
        questionLevel: question.level,
        selectedOption,
        traitScores: option.traitScores,
      });
      
      // Rebuild engine state (answers + skipped questions)
      const restoreResult = await restoreEngineState(session, assessmentConfig);
      let engineState = restoreResult.engineState;
      const answers = restoreResult.answers;

      // Check if complete (adaptive phase done AND all universal closing questions answered)
      const isComplete = isAssessmentComplete(engineState);
      
      if (isComplete) {
        // Load secondary data accumulated from playful questions (re-fetch to pick up any update above)
        const freshSession = await storage.getAssessmentSession(sessionId);
        const userSecondaryData = (freshSession?.preSignupData as any)?.secondaryData ?? {};

        // Generate final result
        const finalResult = getFinalResult(engineState, userSecondaryData);
        const validation = validateFinalResult(finalResult);
        if (!validation.valid) {
          logger.error('[Assessment V4] finalResult validation failed', {
            sessionId,
            error: validation.error,
            finalResult: JSON.stringify(finalResult),
          });
          // Fall back to live top match so the user still gets a result
          finalResult.primaryArchetype = validation.primaryArchetype;
        }

        // Analytics: measure expectation mismatch between live top match and final result
        const liveTopArchetype = engineState.currentMatches[0]?.archetype;
        if (liveTopArchetype && liveTopArchetype !== finalResult.primaryArchetype) {
          logger.warn('[Assessment V4] currentMatches[0] diverges from finalResult', {
            sessionId,
            liveTopArchetype,
            finalArchetype: finalResult.primaryArchetype,
            topScores: engineState.currentMatches.slice(0, 3).map(m => ({ archetype: m.archetype, score: m.score })),
            algorithmVersion: finalResult.algorithmVersion,
          });
        }
        
        // Update session
        await storage.updateAssessmentSession(sessionId, {
          phase: 'completed',
          currentQuestionIndex: answers.length,
          totalQuestions: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
          finalResult,
          traitScores: finalResult.traitScores,
          primaryArchetype: finalResult.primaryArchetype,
          isDecisive: finalResult.isDecisive,
          completedAt: new Date(),
        });

        // Best-effort geolocation capture at onboarding completion.
        captureLocationSnapshot(req, "onboarding_complete", session.userId ?? null).catch(() => {});

        // Sync V4 result to role_results table (overwrite any previous results)
        if (session.userId) {
          const primaryArchetype = finalResult.primaryArchetype;
          const secondaryArchetype = finalResult.secondaryArchetype || null;
          const roleSubtype = determineSubtype(primaryArchetype, {});
          const insights = generateInsights(primaryArchetype, secondaryArchetype);
          
          // Use actual archetype match scores from engineState
          const primaryMatchScore = engineState.currentMatches[0]?.score || 80;
          const secondaryMatchScore = engineState.currentMatches[1]?.score || 70;
          
          await storage.saveRoleResult(session.userId, {
            userId: session.userId,
            primaryArchetype: primaryArchetype as any,
            primaryArchetypeScore: Math.round(primaryMatchScore),
            secondaryArchetype: secondaryArchetype as any,
            secondaryArchetypeScore: secondaryArchetype ? Math.round(secondaryMatchScore) : 0,
            roleSubtype,
            roleScores: {},
            affinityScore: finalResult.traitScores?.A || 50,
            opennessScore: finalResult.traitScores?.O || 50,
            conscientiousnessScore: finalResult.traitScores?.C || 50,
            emotionalStabilityScore: finalResult.traitScores?.E || 50,
            extraversionScore: finalResult.traitScores?.X || 50,
            positivityScore: finalResult.traitScores?.P || 50,
            ...insights,
            testVersion: 4,
          });
          
          // Mark personality test as complete
          await storage.markPersonalityTestComplete(session.userId);

          // Warm xiaoyue analysis cache for discover page
          const confidenceValues = Object.values(finalResult.confidences ?? {}) as number[];
          const avgConfidence = confidenceValues.length > 0
            ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
            : 0.85;
          prefetchAnalysisIfReady(
            {
              archetype: primaryArchetype as string,
              secondaryArchetype: secondaryArchetype as string | null | undefined,
              traitScores: {
                affinity: finalResult.traitScores?.A || 50,
                openness: finalResult.traitScores?.O || 50,
                conscientiousness: finalResult.traitScores?.C || 50,
                emotionalStability: finalResult.traitScores?.E || 50,
                extraversion: finalResult.traitScores?.X || 50,
                positivity: finalResult.traitScores?.P || 50,
              },
            },
            avgConfidence
          );
          
          // Log algorithm version and match details for A/B testing
          const algorithmVersion = finalResult.algorithmVersion || 'v1.0';
          const isDecisive = finalResult.isDecisive ?? true;
          logger.info('[Assessment V4] Algorithm result', { algorithmVersion, primaryArchetype, primaryMatchScore, isDecisive, userId: session.userId });
        }
        
        const commentary = getOptionFeedback(questionId, selectedOption);
        res.json({
          isComplete: true,
          result: finalResult,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
          },
          commentary,
        });
      } else {
        // Get next question
        const nextQuestion = selectNextQuestion(engineState);
        
        // Generate milestone encouragement if applicable
        let encouragement = null;
        const { getMilestoneMessage } = await import('@shared/personality');
        const milestoneMsg = getMilestoneMessage(answers.length);
        if (milestoneMsg) {
          encouragement = milestoneMsg.message;
        }
        
        // Update session progress
        await storage.updateAssessmentSession(sessionId, {
          currentQuestionIndex: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
        });
        
        const commentary = getOptionFeedback(questionId, selectedOption);
        res.json({
          isComplete: false,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.id,
            level: nextQuestion.level,
            category: nextQuestion.category,
            scenarioText: nextQuestion.scenarioText,
            questionText: nextQuestion.questionText,
            options: annotatedShuffleOptions(nextQuestion.id, nextQuestion.options),
            questionType: nextQuestion.questionType,
            sliderConfig: nextQuestion.sliderConfig,
          } : null,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
            // After adaptive phase, only closing questions remain; during adaptive,
            // add the 2 closing questions to the estimate so the progress bar doesn't
            // jump at the adaptive→closing transition.
            estimatedRemaining: shouldTerminate(engineState)
              ? getClosingQuestionsRemaining(engineState)
              : Math.max(0, engineState.config.minQuestions - answers.length) + getClosingQuestionsRemaining(engineState),
          },
          currentMatches: engineState.currentMatches.slice(0, 3),
          encouragement,
          commentary,
        });
        
        logger.info("[Assessment V4 Answer] Response", {
          isComplete: false,
          hasNextQuestion: !!nextQuestion,
          nextQuestionId: nextQuestion?.id,
          answered: answers.length,
        });
      }
    } catch (error: any) {
      logger.error("[Assessment V4 Answer] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to submit answer', error: error.message });
    }
  });
  // ── Lightweight in-memory rate limiter for PUT /answer replacements ──
  const putRateLimitStore = new Map<string, { count: number; resetTime: number }>();
  const PUT_RATE_LIMIT_MAX = 5;
  const PUT_RATE_LIMIT_WINDOW_MS = 60000;

  function checkPutRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const entry = putRateLimitStore.get(sessionId);
    if (!entry || now > entry.resetTime) {
      putRateLimitStore.set(sessionId, { count: 1, resetTime: now + PUT_RATE_LIMIT_WINDOW_MS });
      return true;
    }
    if (entry.count >= PUT_RATE_LIMIT_MAX) {
      return false;
    }
    entry.count++;
    putRateLimitStore.set(sessionId, entry);
    return true;
  }

  app.put('/api/assessment/v4/:sessionId/answer', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId, selectedOption } = req.body;
      const userId = req.session?.userId || null;

      logger.info('[Assessment V4 PutAnswer] Called with', {
        sessionId,
        questionId,
        selectedOption,
        userId,
      });

      if (!questionId || !selectedOption) {
        logger.warn('[Assessment V4 PutAnswer] Missing fields', { sessionId, questionId, selectedOption, userId, code: 400 });
        return res.status(400).json({ message: 'questionId and selectedOption are required' });
      }

      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        logger.warn('[Assessment V4 PutAnswer] Session not found', { sessionId, questionId, userId, code: 404 });
        return res.status(404).json({ message: 'Session not found' });
      }

      // Session ownership check (SEC-01)
      if (session.userId) {
        if (!userId) {
          logger.warn('[Assessment V4 PutAnswer] Unauthenticated access to owned session', { sessionId, questionId, userId, code: 401 });
          return res.status(401).json({ message: 'Unauthorized' });
        }
        if (userId !== session.userId) {
          logger.warn('[Assessment V4 PutAnswer] Forbidden access to another user session', { sessionId, questionId, userId, sessionUserId: session.userId, code: 403 });
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      if (session.phase === 'completed' || session.completedAt) {
        logger.warn('[Assessment V4 PutAnswer] Session already completed', { sessionId, questionId, userId, code: 409 });
        return res.status(409).json({ message: 'Assessment session already completed' });
      }

      // Rate limit check (SEC-04)
      if (!checkPutRateLimit(sessionId)) {
        logger.warn('[Assessment V4 PutAnswer] Rate limit exceeded', { sessionId, questionId, userId, code: 429 });
        return res.status(429).json({ message: 'Too many replacements, please try again later' });
      }

      const {
        questionsV4,
        selectNextQuestion,
        shouldTerminate,
        isAssessmentComplete,
        getClosingQuestionsRemaining,
        getFinalResult,
        getOptionFeedback,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG,
        SECONDARY_QUESTION_MAP,
      } = await import('@shared/personality');

      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;

      const question = questionsV4.find(q => q.id === questionId);
      if (!question) {
        logger.warn('[Assessment V4 PutAnswer] Invalid question ID', { sessionId, questionId, userId, code: 400 });
        return res.status(400).json({ message: 'Invalid question ID' });
      }

      const option = question.options.find(o => o.value === selectedOption);
      if (!option) {
        logger.warn('[Assessment V4 PutAnswer] Invalid option selected', { sessionId, questionId, selectedOption, userId, code: 400 });
        return res.status(400).json({ message: 'Invalid option selected' });
      }

      // Detect playful secondary questions and persist the decoded value
      if (SECONDARY_QUESTION_MAP[questionId]) {
        const { field, valueMap } = SECONDARY_QUESTION_MAP[questionId];
        const secondaryValue = valueMap[selectedOption];
        if (secondaryValue) {
          const currentPreSignup = session.preSignupData as any;
          const existingSecondary =
            currentPreSignup && !Array.isArray(currentPreSignup)
              ? currentPreSignup.secondaryData ?? {}
              : {};
          const newPreSignupData = Array.isArray(currentPreSignup)
            ? currentPreSignup
            : {
                ...(currentPreSignup ?? {}),
                secondaryData: { ...existingSecondary, [field]: secondaryValue },
              };
          await storage.updateAssessmentSession(sessionId, {
            preSignupAnswers: newPreSignupData,
          });
        }
      }

      // Upsert answer (onConflictDoUpdate is handled by createAssessmentAnswer in legacyStorageRepo)
      await storage.createAssessmentAnswer({
        sessionId,
        questionId,
        questionLevel: question.level,
        selectedOption,
        traitScores: option.traitScores,
      });

      // Rebuild engine state by replaying all answers (including skipped state)
      const restoreResult = await restoreEngineState(session, assessmentConfig);
      let engineState = restoreResult.engineState;
      const answers = restoreResult.answers;

      const isComplete = isAssessmentComplete(engineState);

      if (isComplete) {
        const freshSession = await storage.getAssessmentSession(sessionId);
        const userSecondaryData = (freshSession?.preSignupData as any)?.secondaryData ?? {};
        const finalResult = getFinalResult(engineState, userSecondaryData);
        const validation = validateFinalResult(finalResult);
        if (!validation.valid) {
          logger.error('[Assessment V4] finalResult validation failed', {
            sessionId,
            error: validation.error,
            finalResult: JSON.stringify(finalResult),
          });
          finalResult.primaryArchetype = validation.primaryArchetype;
        }

        // Analytics: measure expectation mismatch between live top match and final result
        const liveTopArchetype = engineState.currentMatches[0]?.archetype;
        if (liveTopArchetype && liveTopArchetype !== finalResult.primaryArchetype) {
          logger.warn('[Assessment V4] currentMatches[0] diverges from finalResult', {
            sessionId,
            liveTopArchetype,
            finalArchetype: finalResult.primaryArchetype,
            topScores: engineState.currentMatches.slice(0, 3).map(m => ({ archetype: m.archetype, score: m.score })),
            algorithmVersion: finalResult.algorithmVersion,
          });
        }

        await storage.updateAssessmentSession(sessionId, {
          phase: 'completed',
          currentQuestionIndex: answers.length,
          totalQuestions: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
          finalResult,
          traitScores: finalResult.traitScores,
          primaryArchetype: finalResult.primaryArchetype,
          isDecisive: finalResult.isDecisive,
          completedAt: new Date(),
        });

        if (session.userId) {
          const primaryArchetype = finalResult.primaryArchetype;
          const secondaryArchetype = finalResult.secondaryArchetype || null;
          const roleSubtype = determineSubtype(primaryArchetype, {});
          const insights = generateInsights(primaryArchetype, secondaryArchetype);
          const primaryMatchScore = engineState.currentMatches[0]?.score || 80;
          const secondaryMatchScore = engineState.currentMatches[1]?.score || 70;

          await storage.saveRoleResult(session.userId, {
            userId: session.userId,
            primaryArchetype: primaryArchetype as any,
            primaryArchetypeScore: Math.round(primaryMatchScore),
            secondaryArchetype: secondaryArchetype as any,
            secondaryArchetypeScore: secondaryArchetype ? Math.round(secondaryMatchScore) : 0,
            roleSubtype,
            roleScores: {},
            affinityScore: finalResult.traitScores?.A || 50,
            opennessScore: finalResult.traitScores?.O || 50,
            conscientiousnessScore: finalResult.traitScores?.C || 50,
            emotionalStabilityScore: finalResult.traitScores?.E || 50,
            extraversionScore: finalResult.traitScores?.X || 50,
            positivityScore: finalResult.traitScores?.P || 50,
            ...insights,
            testVersion: 4,
          });

          await storage.markPersonalityTestComplete(session.userId);

          const confidenceValues = Object.values(finalResult.confidences ?? {}) as number[];
          const avgConfidence = confidenceValues.length > 0
            ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
            : 0.85;
          prefetchAnalysisIfReady(
            {
              archetype: primaryArchetype as string,
              secondaryArchetype: secondaryArchetype as string | null | undefined,
              traitScores: {
                affinity: finalResult.traitScores?.A || 50,
                openness: finalResult.traitScores?.O || 50,
                conscientiousness: finalResult.traitScores?.C || 50,
                emotionalStability: finalResult.traitScores?.E || 50,
                extraversion: finalResult.traitScores?.X || 50,
                positivity: finalResult.traitScores?.P || 50,
              },
            },
            avgConfidence
          );

          const algorithmVersion = finalResult.algorithmVersion || 'v1.0';
          const isDecisive = finalResult.isDecisive ?? true;
          logger.info('[Assessment V4 PutAnswer] Algorithm result', { algorithmVersion, primaryArchetype, primaryMatchScore, isDecisive, userId: session.userId });
        }

        const commentary = getOptionFeedback(questionId, selectedOption);
        logger.info('[Assessment V4 PutAnswer] Completed', { sessionId, questionId, userId, answered: answers.length });
        res.json({
          isComplete: true,
          result: finalResult,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
          },
          commentary,
        });
      } else {
        const nextQuestion = selectNextQuestion(engineState);

        let encouragement = null;
        const { getMilestoneMessage } = await import('@shared/personality');
        const milestoneMsg = getMilestoneMessage(answers.length);
        if (milestoneMsg) {
          encouragement = milestoneMsg.message;
        }

        await storage.updateAssessmentSession(sessionId, {
          currentQuestionIndex: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
        });

        const commentary = getOptionFeedback(questionId, selectedOption);
        logger.info('[Assessment V4 PutAnswer] Success', { sessionId, questionId, userId, answered: answers.length, nextQuestionId: nextQuestion?.id });
        res.json({
          isComplete: false,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.id,
            level: nextQuestion.level,
            category: nextQuestion.category,
            scenarioText: nextQuestion.scenarioText,
            questionText: nextQuestion.questionText,
            options: annotatedShuffleOptions(nextQuestion.id, nextQuestion.options),
            questionType: nextQuestion.questionType,
            sliderConfig: nextQuestion.sliderConfig,
          } : null,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
            estimatedRemaining: shouldTerminate(engineState)
              ? getClosingQuestionsRemaining(engineState)
              : Math.max(0, engineState.config.minQuestions - answers.length) + getClosingQuestionsRemaining(engineState),
          },
          currentMatches: engineState.currentMatches.slice(0, 3),
          encouragement,
          commentary,
        });
      }
    } catch (error: any) {
      logger.error('[Assessment V4 PutAnswer] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to replace answer', error: error.message });
    }
  });

  app.post('/api/assessment/v4/:sessionId/skip', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId } = req.body;
      
      logger.info("[Assessment V4 Skip] Called with", {
        sessionId,
        questionId,
      });
      
      if (!questionId) {
        return res.status(400).json({ message: 'questionId is required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        logger.error("[Assessment V4 Skip] Session not found", { error: String(sessionId) });
        return res.status(404).json({ message: 'Session not found' });
      }
      
      const { 
        skipQuestion,
        MAX_SKIP_COUNT,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Get current skip count from session
      const currentSkipCount = session.skipCount || 0;
      const skippedQuestionIds: string[] = (session.skippedQuestionIds as string[]) || [];
      
      if (currentSkipCount >= MAX_SKIP_COUNT) {
        return res.status(400).json({ 
          success: false,
          message: 'Maximum skip limit reached',
          skipCount: currentSkipCount,
          canSkip: false,
          remainingSkips: 0,
        });
      }
      
      // Rebuild engine state with skipped questions, then skip current question
      const { engineState } = await restoreEngineState(session, assessmentConfig);

      // Skip current question
      const skipResult = skipQuestion(engineState, questionId);
      
      if (!skipResult) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot skip question',
          skipCount: currentSkipCount,
          canSkip: false,
          remainingSkips: 0,
        });
      }
      
      // Update session with new skip info
      const newSkippedIds = [...skippedQuestionIds, questionId];
      await storage.updateAssessmentSession(sessionId, {
        skipCount: skipResult.newState.skipCount,
        skippedQuestionIds: newSkippedIds,
      });
      
      const newQuestion = skipResult.newQuestion;
      
      res.json({
        success: true,
        newQuestion: newQuestion ? {
          id: newQuestion.id,
          level: newQuestion.level,
          category: newQuestion.category,
          scenarioText: newQuestion.scenarioText,
          questionText: newQuestion.questionText,
          options: annotatedShuffleOptions(newQuestion.id, newQuestion.options),
          questionType: newQuestion.questionType,
          sliderConfig: newQuestion.sliderConfig,
        } : null,
        skipCount: skipResult.newState.skipCount,
        canSkip: skipResult.newState.skipCount < MAX_SKIP_COUNT,
        remainingSkips: MAX_SKIP_COUNT - skipResult.newState.skipCount,
      });
    } catch (error: any) {
      logger.error("[Assessment V4 Skip] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to skip question', error: error.message });
    }
  });
  app.get('/api/assessment/v4/:sessionId/result', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      if (session.phase !== 'completed') {
        return res.status(400).json({ message: 'Assessment not yet completed' });
      }

      const validation = validateFinalResult(session.finalResult);
      if (!validation.valid) {
        logger.error('[Assessment V4 Result] Session has invalid finalResult', {
          sessionId,
          error: validation.error,
        });
        return res.status(500).json({ message: 'Result data is incomplete. Please retake the assessment.' });
      }
      
      res.json({
        sessionId: session.id,
        completedAt: session.completedAt,
        result: session.finalResult,
        traitConfidences: session.traitConfidences,
        topArchetypes: session.topArchetypes,
      });
    } catch (error: any) {
      logger.error("[Assessment V4 Result] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to get result', error: error.message });
    }
  });
  app.post('/api/assessment/v4/:sessionId/link-user', requireAuth, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = getAuthenticatedUserId(req) as string;
      
      logger.info("[Assessment V4 Link] Called with", {
        sessionId,
        userId,
      });
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        logger.error("[Assessment V4 Link] Session not found", { error: String(sessionId) });
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Update session with user ID
      await storage.updateAssessmentSession(sessionId, {
        userId,
        phase: 'post_signup',
      });
      
      // Import adaptive engine to get next question
      const { 
        selectNextQuestion,
        shouldTerminate,
        getClosingQuestionsRemaining,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Reconstruct engine state from session answers (including skipped state)
      const { engineState } = await restoreEngineState(session, assessmentConfig);

      // Get next question
      const nextQuestion = selectNextQuestion(engineState);
      
      // Return success with next question data
      const responseData = { 
        success: true,
        phase: 'post_signup',
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          level: nextQuestion.level,
          category: nextQuestion.category,
          scenarioText: nextQuestion.scenarioText,
          questionText: nextQuestion.questionText,
          options: annotatedShuffleOptions(nextQuestion.id, nextQuestion.options),
          questionType: nextQuestion.questionType,
          sliderConfig: nextQuestion.sliderConfig,
        } : null,
        progress: {
          answered: engineState.answeredQuestionIds.size,
          minQuestions: engineState.config.minQuestions,
          softMaxQuestions: engineState.config.softMaxQuestions,
          hardMaxQuestions: engineState.config.hardMaxQuestions,
          estimatedRemaining: shouldTerminate(engineState)
            ? getClosingQuestionsRemaining(engineState)
            : Math.max(0, engineState.config.minQuestions - engineState.answeredQuestionIds.size) + getClosingQuestionsRemaining(engineState),
        },
        currentMatches: engineState.currentMatches.slice(0, 3),
      };
      
      logger.info("[Assessment V4 Link] Response", {
        success: true,
        hasNextQuestion: !!nextQuestion,
        nextQuestionId: nextQuestion?.id,
        answered: engineState.answeredQuestionIds.size,
      });
      
      res.json(responseData);
    } catch (error: any) {
      logger.error("[Assessment V4 Link] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to link user', error: error.message });
    }
  });
  app.get('/api/assessment/v4/anchor-questions', async (req: any, res) => {
    try {
      const { getAnchorQuestions } = await import('@shared/personality');
      const anchors = getAnchorQuestions();
      
      res.json({
        questions: anchors.map(q => ({
          id: q.id,
          level: q.level,
          category: q.category,
          scenarioText: q.scenarioText,
          questionText: q.questionText,
          options: annotatedShuffleOptions(q.id, q.options),
        })),
        count: anchors.length,
      });
    } catch (error: any) {
      logger.error("[Assessment V4 Anchors] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to get anchor questions', error: error.message });
    }
  });
  app.post('/api/assessment/v4/presignup-sync', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        logger.warn('[Presignup Sync] No userId in session - session may not be ready yet');
        return res.status(401).json({ message: 'Unauthorized - must be logged in' });
      }

      const { preSignupAnswers } = req.body;
      if (!preSignupAnswers || !Array.isArray(preSignupAnswers) || preSignupAnswers.length === 0) {
        return res.status(400).json({ message: 'No pre-signup answers provided' });
      }

      logger.info('[Presignup Sync] Syncing answers for user', { count: preSignupAnswers.length, userId });

      // Import adaptive engine
      const { 
        initializeEngineState, 
        processAnswer,
        questionsV4,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');

      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;

      // Check if user already has an active session
      let session = await storage.getAssessmentSessionByUser(userId);
      
      if (session) {
        // Merge answers instead of skipping
        const existingAnswers = await storage.getAssessmentAnswers(session.id);
        const existingQuestionIds = new Set(existingAnswers.map(a => a.questionId));
        
        // Deduplicate incoming answers and filter out ones already in DB
        const dedupedIncoming = new Map<string, typeof preSignupAnswers[0]>();
        for (const ans of preSignupAnswers) {
          dedupedIncoming.set(ans.questionId, ans);
        }
        
        const newAnswers = Array.from(dedupedIncoming.values()).filter(ans => !existingQuestionIds.has(ans.questionId));
        
        if (newAnswers.length === 0) {
          logger.info("[Presignup Sync] No new answers to sync for session", { data: session.id });
          return res.json({ 
            sessionId: session.id, 
            message: 'All answers already synced',
            totalCount: existingAnswers.length,
            syncedCount: 0
          });
        }

        logger.info('[Presignup Sync] Syncing new answers to existing session', { count: newAnswers.length, sessionId: session.id });
        
        // Reconstruct engine state for full session (existing + new) to update current matches
        const allUniqueAnswers = [...existingAnswers.map(a => ({ questionId: a.questionId, selectedOption: a.selectedOption })), ...newAnswers];
        let engineState = initializeEngineState(assessmentConfig);
        
        const { questionsV4 } = await import('@shared/personality');

        // Save new answers and build engine state
        for (const ans of newAnswers) {
          const question = questionsV4.find(q => q.id === ans.questionId);
          await storage.createAssessmentAnswer({
            sessionId: session.id,
            questionId: ans.questionId,
            questionLevel: question?.level || 1,
            selectedOption: ans.selectedOption,
            traitScores: question?.options.find(o => o.value === ans.selectedOption)?.traitScores || {}
          });
        }

        // Replay ALL answers to ensure trait scores and matches are correct
        for (const ans of allUniqueAnswers) {
          const question = questionsV4.find(q => q.id === ans.questionId);
          if (question) {
            engineState = processAnswer(engineState, question, ans.selectedOption);
          }
        }

        const traitScoresObj: Record<string, number> = {};
        const traitConfidencesObj: Record<string, number> = {};
        for (const [trait, conf] of Object.entries(engineState.traitConfidences)) {
          traitScoresObj[trait] = conf.score;
          traitConfidencesObj[trait] = conf.confidence;
        }

        // Phase validation: Only mark anchor phase complete if we have 8 unique answers
        const uniqueAnsweredIds = new Set(allUniqueAnswers.map(a => a.questionId));
        const currentPhase = uniqueAnsweredIds.size >= 8 ? 'adaptive' : 'anchor';

        await storage.updateAssessmentSession(session.id, {
          phase: currentPhase,
          traitScores: traitScoresObj,
          traitConfidences: traitConfidencesObj,
          topArchetypes: engineState.currentMatches.slice(0, 3).map(m => m.archetype),
          answeredQuestionIds: Array.from(engineState.answeredQuestionIds),
        });

        return res.json({
          sessionId: session.id,
          syncedCount: newAnswers.length,
          totalCount: engineState.answeredQuestionIds.size
        });
      } else {
        // Create new session for logged-in user
        session = await storage.createAssessmentSession({
          userId,
          phase: 'post_signup',
          preSignupAnswers: preSignupAnswers,
        });
        logger.info("[Presignup Sync] Created new session", { data: session.id });
      }

      // Initialize engine state and process pre-signup answers
      let engineState = initializeEngineState(assessmentConfig);
      
      // Deduplicate answers - keep only latest answer per question
      const dedupedAnswers = new Map<string, typeof preSignupAnswers[0]>();
      for (const ans of preSignupAnswers) {
        dedupedAnswers.set(ans.questionId, ans);
      }
      const uniqueAnswers = Array.from(dedupedAnswers.values());
      
      // Process and save each answer
      for (const ans of uniqueAnswers) {
        const question = questionsV4.find(q => q.id === ans.questionId);
        if (question) {
          engineState = processAnswer(engineState, question, ans.selectedOption);
          
          // Save answer to database
          await storage.createAssessmentAnswer({
            sessionId: session.id,
            questionId: ans.questionId,
            questionLevel: question.level,
            selectedOption: ans.selectedOption,
            traitScores: question.options.find(o => o.value === ans.selectedOption)?.traitScores || {},
          });
        }
      }

      // Update session with current state
      const traitScoresObj: Record<string, number> = {};
      const traitConfidencesObj: Record<string, number> = {};
      for (const [trait, conf] of Object.entries(engineState.traitConfidences)) {
        traitScoresObj[trait] = conf.score;
        traitConfidencesObj[trait] = conf.confidence;
      }

      await storage.updateAssessmentSession(session.id, {
        phase: 'post_signup',
        currentQuestionIndex: uniqueAnswers.length,
        traitScores: traitScoresObj,
        traitConfidences: traitConfidencesObj,
        topArchetypes: engineState.currentMatches.slice(0, 3).map(m => m.archetype),
        answeredQuestionIds: Array.from(engineState.answeredQuestionIds),
      });

      logger.info('[Presignup Sync] Synced answers to session', { count: uniqueAnswers.length, sessionId: session.id });

      res.json({ 
        sessionId: session.id, 
        totalCount: uniqueAnswers.length,
        syncedCount: uniqueAnswers.length,
        message: 'Pre-signup answers synced successfully'
      });
    } catch (error: any) {
      logger.error("[Presignup Sync] Error", { error: String(error) });
      res.status(500).json({ message: 'Failed to sync pre-signup answers', error: error.message });
    }
  });
}
