import type { Express, Request, Response } from "express";
import { insertEventGroupOutcomeSchema } from "@shared/schema";
import { logAITrace } from "../../lib/aiTraceLogger";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { eventGroupOutcomesRepo } from "../../repositories/eventGroupOutcomesRepo";

const GROUP_OUTCOME_ROUTE = "/api/event-pools/:poolId/group-outcome";
const DUPLICATE_SUBMISSION_STRATEGY = "replace";

function normalizeFreeTextSignal(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getInvalidConnectionRadarTargets(
  connectionRadar: Record<string, number>,
  memberUserIds: string[],
  submittedBy: string,
): string[] {
  const memberSet = new Set(memberUserIds);

  // Connection radar captures perceived chemistry with other attendees only.
  return Object.keys(connectionRadar).filter(
    (targetUserId) => targetUserId === submittedBy || !memberSet.has(targetUserId),
  );
}

export function registerEventGroupOutcomeRoutes(app: Express): void {
  app.post(GROUP_OUTCOME_ROUTE, async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const reqLogger = logger.child({
      request_id: req.requestId,
      route: GROUP_OUTCOME_ROUTE,
      poolId: req.params.poolId,
    });

    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) {
      reqLogger.info("Rejected event group outcome submission: unauthenticated");
      return;
    }

    try {
      const parsed = insertEventGroupOutcomeSchema.safeParse(req.body);
      if (!parsed.success) {
        reqLogger.info("Rejected event group outcome submission: invalid payload");
        return res.status(400).json({
          message: "Invalid group outcome submission",
          errors: parsed.error.flatten(),
        });
      }

      const { groupId, ...payload } = parsed.data;
      const membershipContext = await eventGroupOutcomesRepo.getGroupMembershipContext(
        req.params.poolId,
        groupId,
        userId,
      );

      if (!membershipContext) {
        reqLogger.info("Rejected event group outcome submission: group not found", { groupId });
        return res.status(404).json({ message: "Group not found for this event pool" });
      }

      if (!membershipContext.isMember) {
        reqLogger.info("Rejected event group outcome submission: non-member", { groupId });
        return res.status(403).json({ message: "Not a member of this group" });
      }

      const invalidRadarTargets = getInvalidConnectionRadarTargets(
        payload.connectionRadar,
        membershipContext.memberUserIds,
        userId,
      );

      if (invalidRadarTargets.length > 0) {
        reqLogger.info("Rejected event group outcome submission: invalid connection radar", {
          groupId,
          invalidTargetCount: invalidRadarTargets.length,
        });
        return res.status(400).json({
          message: "Connection radar must only reference other members of this group",
        });
      }

      const { outcome, replacedExisting } =
        await eventGroupOutcomesRepo.upsertEventGroupOutcome({
          poolId: req.params.poolId,
          groupId,
          submittedBy: userId,
          atmosphereScore: payload.atmosphereScore,
          wouldMeetAgain: payload.wouldMeetAgain,
          connectionRadar: payload.connectionRadar,
          icebreakerRatings: payload.icebreakerRatings,
          freeTextSignal: normalizeFreeTextSignal(payload.freeTextSignal),
        });

      reqLogger.info("Stored event group outcome submission", {
        groupId,
        replacedExisting,
      });

      logAITrace({
        domain: "event_group_outcomes",
        feature: "submitGroupOutcome",
        provider: null,
        latencyMs: Date.now() - startedAt,
        success: true,
        fallbackUsed: false,
        fromCache: false,
      });

      return res.status(replacedExisting ? 200 : 201).json({
        message: replacedExisting ? "Group outcome updated" : "Group outcome submitted",
        duplicateSubmissionStrategy: DUPLICATE_SUBMISSION_STRATEGY,
        replacedExisting,
        outcomeId: outcome.id,
        submittedAt: outcome.submittedAt,
      });
    } catch (error) {
      reqLogger.error("Failed to submit event group outcome", {
        error: error instanceof Error ? error.message : String(error),
      });

      logAITrace({
        domain: "event_group_outcomes",
        feature: "submitGroupOutcome",
        provider: null,
        latencyMs: Date.now() - startedAt,
        success: false,
        fallbackUsed: false,
        fromCache: false,
        errorCode: "submission_failed",
      });

      return res.status(500).json({ message: "Failed to submit group outcome" });
    }
  });
}
