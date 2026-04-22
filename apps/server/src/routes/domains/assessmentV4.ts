import type { Express } from "express";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { storage } from "../../storage";
import { determineSubtype, generateInsights } from "./assessment";

function shuffleOptions(options: any[]): any[] {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function registerAssessmentV4Routes(app: Express): void {
  app.post('/api/assessment/v4/start', async (req: any, res) => {
    try {
      const { preSignupAnswers, sessionId: existingSessionId, forceNew } = req.body;
      const userId = req.session?.userId || null;
      
      console.log('[Assessment V4 Start] Called with:', {
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
        console.log('[V4 Start] Checked for existing user session:', {
          userId,
          foundSession: !!existingUserSession,
          sessionId: existingUserSession?.id,
          isCompleted: existingUserSession?.completedAt ? true : false,
        });
        
        if (existingUserSession && !existingUserSession.completedAt) {
          // Resume existing session - it was created by presignup-sync
          session = existingUserSession;
          
          // Reconstruct engine state from session data
          const answers = await storage.getAssessmentAnswers(session.id);
          engineState = initializeEngineState(assessmentConfig);
          
          // Replay answers to rebuild state
          for (const answer of answers) {
            const question = (await import('@shared/personality')).questionsV4.find(
              q => q.id === answer.questionId
            );
            if (question) {
              engineState = processAnswer(engineState, question, answer.selectedOption);
            }
          }
          
          console.log('[V4 Start] Resuming existing session for user:', userId, 'with', answers.length, 'answers');
        } else if (existingUserSession && existingUserSession.completedAt) {
          // User has a completed session - start fresh
          console.log('[V4 Start] User has completed session, creating new one');
        } else {
          console.log('[V4 Start] No existing session found for user:', userId);
        }
      } else if (userId && isExplicitRestart) {
        console.log('[V4 Start] Explicit restart requested for user:', userId);
      }
      
      // If resuming by session ID (anonymous pre-signup flow)
      if (!session && existingSessionId && !forceNew) {
        console.log('[V4 Start] Attempting to resume by sessionId:', existingSessionId);
        session = await storage.getAssessmentSession(existingSessionId);
        if (!session) {
          console.error('[V4 Start] Session not found by sessionId:', existingSessionId);
          return res.status(404).json({ message: 'Session not found' });
        }
        
        console.log('[V4 Start] Found session by sessionId:', {
          sessionId: session.id,
          userId: session.userId,
          phase: session.phase,
        });
        
        // Reconstruct engine state from session data
        const answers = await storage.getAssessmentAnswers(existingSessionId);
        engineState = initializeEngineState(assessmentConfig);
        
        // Replay answers to rebuild state
        for (const answer of answers) {
          const question = (await import('@shared/personality')).questionsV4.find(
            q => q.id === answer.questionId
          );
          if (question) {
            engineState = processAnswer(engineState, question, answer.selectedOption);
          }
        }
        
        console.log('[V4 Start] Replayed', answers.length, 'answers for session:', existingSessionId);
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
        console.log('[V4 Start] Engine state was not initialized, initializing now');
        engineState = initializeEngineState(assessmentConfig);
      }
      
      // Ensure session exists by this point
      if (!session) {
        console.error('[V4 Start] No session available after all checks - this should not happen');
        return res.status(500).json({ message: 'Failed to create or find session' });
      }
      
      // Get next question
      const nextQuestion = selectNextQuestion(engineState);
      
      console.log('[Assessment V4 Start] Engine state:', {
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
          options: shuffleOptions(nextQuestion.options),
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
      
      console.log('[Assessment V4 Start] Response:', {
        sessionId: response.sessionId,
        phase: response.phase,
        answered: response.progress.answered,
        hasNextQuestion: !!response.nextQuestion,
        isComplete: response.isComplete,
      });
      
      res.json(response);
    } catch (error: any) {
      console.error('[Assessment V4 Start] Error:', error);
      res.status(500).json({ message: 'Failed to start assessment', error: error.message });
    }
  });
  app.post('/api/assessment/v4/:sessionId/answer', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId, selectedOption } = req.body;
      
      console.log('[Assessment V4 Answer] Called with:', {
        sessionId,
        questionId,
        selectedOption,
      });
      
      if (!questionId || !selectedOption) {
        return res.status(400).json({ message: 'questionId and selectedOption are required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Answer] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Import modules
      const { 
        questionsV4, 
        initializeEngineState, 
        processAnswer, 
        selectNextQuestion,
        shouldTerminate,
        isAssessmentComplete,
        getClosingQuestionsRemaining,
        getFinalResult,
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
      
      // Rebuild engine state
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      for (const answer of answers) {
        const q = questionsV4.find(quest => quest.id === answer.questionId);
        if (q) {
          engineState = processAnswer(engineState, q, answer.selectedOption);
        }
      }
      
      // Check if complete (adaptive phase done AND all universal closing questions answered)
      const isComplete = isAssessmentComplete(engineState);
      
      if (isComplete) {
        // Load secondary data accumulated from playful questions (re-fetch to pick up any update above)
        const freshSession = await storage.getAssessmentSession(sessionId);
        const userSecondaryData = (freshSession?.preSignupData as any)?.secondaryData ?? {};

        // Generate final result
        const finalResult = getFinalResult(engineState, userSecondaryData);
        
        // Update session
        await storage.updateAssessmentSession(sessionId, {
          phase: 'completed',
          currentQuestionIndex: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
          finalResult,
          primaryArchetype: finalResult.primaryArchetype,
          isDecisive: finalResult.isDecisive,
          completedAt: new Date(),
        });
        
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
            primaryArchetype,
            primaryArchetypeScore: Math.round(primaryMatchScore),
            secondaryArchetype,
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
          
          // Log algorithm version and match details for A/B testing
          const algorithmVersion = finalResult.algorithmVersion || 'v1.0';
          const isDecisive = finalResult.isDecisive ?? true;
          console.log(`[Assessment V4] Algorithm: ${algorithmVersion} | Result: ${primaryArchetype} (score: ${primaryMatchScore}) | Decisive: ${isDecisive} | User: ${session.userId}`);
        }
        
        res.json({
          isComplete: true,
          result: finalResult,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
          },
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
        
        res.json({
          isComplete: false,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.id,
            level: nextQuestion.level,
            category: nextQuestion.category,
            scenarioText: nextQuestion.scenarioText,
            questionText: nextQuestion.questionText,
            options: shuffleOptions(nextQuestion.options),
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
        });
        
        console.log('[Assessment V4 Answer] Response:', {
          isComplete: false,
          hasNextQuestion: !!nextQuestion,
          nextQuestionId: nextQuestion?.id,
          answered: answers.length,
        });
      }
    } catch (error: any) {
      console.error('[Assessment V4 Answer] Error:', error);
      res.status(500).json({ message: 'Failed to submit answer', error: error.message });
    }
  });
  app.post('/api/assessment/v4/:sessionId/skip', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId } = req.body;
      
      console.log('[Assessment V4 Skip] Called with:', {
        sessionId,
        questionId,
      });
      
      if (!questionId) {
        return res.status(400).json({ message: 'questionId is required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Skip] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      const { 
        questionsV4, 
        initializeEngineState, 
        processAnswer, 
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
      
      // Rebuild engine state with skipped questions
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      // Add previously skipped questions to state
      for (const skippedId of skippedQuestionIds) {
        engineState.skippedQuestionIds.add(skippedId);
      }
      engineState.skipCount = currentSkipCount;
      
      // Process previous answers
      for (const answer of answers) {
        const q = questionsV4.find(quest => quest.id === answer.questionId);
        if (q) {
          engineState = processAnswer(engineState, q, answer.selectedOption);
        }
      }
      
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
          options: shuffleOptions(newQuestion.options),
          questionType: newQuestion.questionType,
          sliderConfig: newQuestion.sliderConfig,
        } : null,
        skipCount: skipResult.newState.skipCount,
        canSkip: skipResult.newState.skipCount < MAX_SKIP_COUNT,
        remainingSkips: MAX_SKIP_COUNT - skipResult.newState.skipCount,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Skip] Error:', error);
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
      
      res.json({
        sessionId: session.id,
        completedAt: session.completedAt,
        result: session.finalResult,
        traitConfidences: session.traitConfidences,
        topArchetypes: session.topArchetypes,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Result] Error:', error);
      res.status(500).json({ message: 'Failed to get result', error: error.message });
    }
  });
  app.post('/api/assessment/v4/:sessionId/link-user', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.id;
      
      console.log('[Assessment V4 Link] Called with:', {
        sessionId,
        userId,
      });
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Link] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Update session with user ID
      await storage.updateAssessmentSession(sessionId, {
        userId,
        phase: 'post_signup',
      });
      
      // Import adaptive engine to get next question
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
      
      // Reconstruct engine state from session answers
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      // Replay answers to rebuild state
      for (const answer of answers) {
        const question = (await import('@shared/personality')).questionsV4.find(
          q => q.id === answer.questionId
        );
        if (question) {
          engineState = processAnswer(engineState, question, answer.selectedOption);
        }
      }
      
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
          options: shuffleOptions(nextQuestion.options),
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
      
      console.log('[Assessment V4 Link] Response:', {
        success: true,
        hasNextQuestion: !!nextQuestion,
        nextQuestionId: nextQuestion?.id,
        answered: engineState.answeredQuestionIds.size,
      });
      
      res.json(responseData);
    } catch (error: any) {
      console.error('[Assessment V4 Link] Error:', error);
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
          options: shuffleOptions(q.options),
        })),
        count: anchors.length,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Anchors] Error:', error);
      res.status(500).json({ message: 'Failed to get anchor questions', error: error.message });
    }
  });
  app.post('/api/assessment/v4/presignup-sync', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        console.warn('[Presignup Sync] No userId in session - session may not be ready yet');
        return res.status(401).json({ message: 'Unauthorized - must be logged in' });
      }

      const { preSignupAnswers } = req.body;
      if (!preSignupAnswers || !Array.isArray(preSignupAnswers) || preSignupAnswers.length === 0) {
        return res.status(400).json({ message: 'No pre-signup answers provided' });
      }

      console.log('[Presignup Sync] Syncing', preSignupAnswers.length, 'answers for user:', userId);

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
          console.log('[Presignup Sync] No new answers to sync for session:', session.id);
          return res.json({ 
            sessionId: session.id, 
            message: 'All answers already synced',
            totalCount: existingAnswers.length,
            syncedCount: 0
          });
        }

        console.log('[Presignup Sync] Syncing', newAnswers.length, 'new answers to existing session:', session.id);
        
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
        console.log('[Presignup Sync] Created new session:', session.id);
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

      console.log('[Presignup Sync] Synced', uniqueAnswers.length, 'answers to session:', session.id);

      res.json({ 
        sessionId: session.id, 
        totalCount: uniqueAnswers.length,
        syncedCount: uniqueAnswers.length,
        message: 'Pre-signup answers synced successfully'
      });
    } catch (error: any) {
      console.error('[Presignup Sync] Error:', error);
      res.status(500).json({ message: 'Failed to sync pre-signup answers', error: error.message });
    }
  });
}
