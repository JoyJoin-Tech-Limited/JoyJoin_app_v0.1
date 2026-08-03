import { storage } from "../storage";

/**
 * Rebuilds the shared adaptive engine state for an assessment session by
 * replaying all stored answers. Used by the V4 assessment routes (to compute
 * current matches) and by the Xiaoyue analysis prefetch (to derive the
 * mid-test profile server-side without trusting client-supplied scores).
 *
 * Returns the replayed engine state plus the raw stored answers.
 */
export async function restoreEngineState(session: any, assessmentConfig: any) {
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
