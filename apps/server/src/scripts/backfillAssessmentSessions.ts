import { eq, sql, isNull, or, and } from "drizzle-orm";
import { db } from "../db";
import { assessmentSessions, assessmentAnswers } from "@shared/schema";
import { storage } from "../storage";
import { logger } from "../lib/logger";

/**
 * Backfills assessment sessions that are completed but are missing fields
 * that were not persisted before the Workstream A fix:
 *   - totalQuestions
 *   - traitScores
 *   - complete finalResult (primaryArchetype, isDecisive, traitScores, confidences)
 *
 * Usage:
 *   node --env-file=../../.env --import tsx/esm src/scripts/backfillAssessmentSessions.ts [userId?]
 *
 * If a userId is provided, only that user's latest completed session is touched.
 * If no userId is provided, all completed sessions with missing data are touched.
 */

async function backfillSession(session: any): Promise<{ sessionId: string; updated: boolean; reason?: string }> {
  const {
    DEFAULT_ASSESSMENT_CONFIG,
    V2_ASSESSMENT_CONFIG,
    getFinalResult,
  } = await import("@shared/personality");

  const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === "true";
  const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;

  const answers = await storage.getAssessmentAnswers(session.id);
  if (!answers || answers.length === 0) {
    return { sessionId: session.id, updated: false, reason: "no answers" };
  }

  const userSecondaryData = (session.preSignupData as any)?.secondaryData ?? {};

  // Reconstruct engine state by replaying answers.
  const restoreResult = await restoreEngineState(session, assessmentConfig);
  const engineState = restoreResult.engineState;

  const finalResult = getFinalResult(engineState, userSecondaryData);
  const primaryArchetype = finalResult.primaryArchetype;
  if (!primaryArchetype) {
    return { sessionId: session.id, updated: false, reason: "no primary archetype" };
  }

  const needsUpdate =
    session.totalQuestions == null ||
    session.traitScores == null ||
    !session.finalResult ||
    session.finalResult.traitScores == null ||
    session.finalResult.primaryArchetype == null;

  if (!needsUpdate) {
    return { sessionId: session.id, updated: false, reason: "already complete" };
  }

  await storage.updateAssessmentSession(session.id, {
    totalQuestions: answers.length,
    traitScores: finalResult.traitScores,
    traitConfidences: engineState.traitConfidences,
    topArchetypes: engineState.currentMatches,
    finalResult,
    primaryArchetype,
    isDecisive: finalResult.isDecisive,
  });

  return { sessionId: session.id, updated: true };
}

async function restoreEngineState(session: any, assessmentConfig: any) {
  const {
    questionsV4,
    initializeEngineState,
    processAnswer,
  } = await import("@shared/personality");

  const answers = await storage.getAssessmentAnswers(session.id);
  let engineState = initializeEngineState(assessmentConfig);

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

async function run() {
  const targetUserId = process.argv[2];

  const conditions = [
    sql`${assessmentSessions.completedAt} IS NOT NULL`,
    or(
      isNull(assessmentSessions.totalQuestions),
      isNull(assessmentSessions.traitScores),
      isNull(assessmentSessions.finalResult)
    ),
  ];

  if (targetUserId) {
    conditions.push(eq(assessmentSessions.userId, targetUserId));
  }

  const sessions = await db
    .select()
    .from(assessmentSessions)
    .where(and(...conditions));

  logger.info(`[BackfillAssessmentSessions] Found ${sessions.length} session(s) to backfill`, {
    targetUserId: targetUserId ?? "all",
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    try {
      const result = await backfillSession(session);
      if (result.updated) {
        updatedCount += 1;
        logger.info("[BackfillAssessmentSessions] Updated session", { sessionId: result.sessionId });
      } else {
        skippedCount += 1;
        logger.info("[BackfillAssessmentSessions] Skipped session", {
          sessionId: result.sessionId,
          reason: result.reason,
        });
      }
    } catch (err) {
      logger.error("[BackfillAssessmentSessions] Failed to backfill session", {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("[BackfillAssessmentSessions] Done", { updatedCount, skippedCount });
  process.exit(0);
}

run().catch((err) => {
  logger.error("[BackfillAssessmentSessions] Fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
