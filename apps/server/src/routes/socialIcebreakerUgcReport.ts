/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report, contract §3/§4) —
 * `POST /api/social-icebreaker/:socialSessionId/report-content`
 *
 * In-session UGC report loop: a participant long-presses another member's
 * visible content (quip answer / undercover description / lie statement /
 * displayName; group-mirror reason and miniscript vote note are server-ready
 * kinds without a client mount point yet) → the server takes an INSTANT
 * snapshot of the original text from session state / the participants roster
 * → writes the existing `reports` table (`category='inappropriate_content'`)
 * → the existing admin moderation queue (`/api/admin/moderation/reports`)
 * sees it with zero admin-side changes.
 *
 * Hard rules honored here:
 *  - G4 evidence integrity: the snapshot text NEVER passes through the
 *    content filter (otherwise the report would 400 itself and destroy the
 *    evidence). Only the reporter's free-text `note` is gated via
 *    `validateContentSafeAsync` (same rule as routes/domains/reports.ts).
 *  - REL-02: the session is read via `getSessionWithExpiry` BARE READ — never
 *    `resolveSession`, whose `processAutoAdvance` write side-effects do not
 *    belong on a report path.
 *  - Rate limit: 3 reports per reporter per session per hour
 *    (`createRateLimiter` + `keyResolver`, 429 carries `retryAfterSeconds` +
 *    `Retry-After` header).
 *  - `relatedEventId` comes from the session's `eventPoolGroups.eventId`
 *    lookup (icebreakerSessionId IS the eventPoolGroups.id) — NEVER
 *    `resolveCanonicalEventId(socialSessionId)`: that helper only resolves
 *    the events / blind_box_events / event_pools id families, and a social
 *    session id is none of them (verifier R1 correction). Group lookup
 *    failure degrades to NULL — it must never sink the report.
 */
import type { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { eventPoolGroups, reports } from '@shared/schema';
import { icebreakerUgcReportBodySchema, UGC_REPORT_CATEGORY } from '@shared/api';
import { createRateLimiter } from '../rateLimiter';
import { getParticipant, getSessionWithExpiry } from '../lib/socialIcebreakerStore';
import { contentViolationResponse, validateContentSafeAsync } from '../lib/contentSafety';
import { recordViolation } from '../abuseDetection';
import { logger } from '../lib/logger';
import {
  buildIcebreakerUgcDescription,
  snapshotIcebreakerUgc,
} from '../lib/icebreakerUgcReport';

const ugcReportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 reports per reporter per session per window
  keyPrefix: 'ugc-report',
  keyResolver: (req) => {
    const actor = (req as any).session?.userId || 'anonymous';
    return `${actor}:${req.params.socialSessionId ?? 'unknown'}`;
  },
  errorCode: 'UGC_REPORT_RATE_LIMITED',
});

/** Best-effort group→event resolution; never throws into the request path. */
async function resolveGroupEventId(icebreakerSessionId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ eventId: eventPoolGroups.eventId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.id, icebreakerSessionId))
      .limit(1);
    return row?.eventId ?? null;
  } catch (error) {
    logger.warn('[SocialIcebreaker] UGC report group-event lookup failed; inserting without relatedEventId', {
      icebreakerSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function registerUgcReportRoutes(router: Router): void {
  router.post('/:socialSessionId/report-content', ugcReportLimiter, async (req: any, res) => {
    const { socialSessionId } = req.params;
    const userId: string | undefined = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const parsed = icebreakerUgcReportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid report body',
        code: 'INVALID_BODY',
        details: parsed.error.flatten(),
      });
    }
    const { phase, targetUserId, contentRef, note } = parsed.data;

    try {
      // REL-02: bare read (no auto-advance write side-effects on a report path).
      const { state, expired } = await getSessionWithExpiry(socialSessionId);
      if (!state) {
        if (expired) {
          return res.status(410).json({ error: 'SESSION_EXPIRED', code: 'SESSION_EXPIRED', expired: true });
        }
        return res.status(404).json({ error: 'Social session not found', code: 'SESSION_NOT_FOUND' });
      }

      // SEC-01: reporter must be a participant of THIS session (precedent:
      // socialIcebreakerExtended.ts NOT_A_PARTICIPANT).
      const reporterParticipant = await getParticipant(socialSessionId, userId);
      if (!reporterParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session', code: 'NOT_A_PARTICIPANT' });
      }

      // SEC-01: the reported user must be a member of the same session.
      const targetParticipant = await getParticipant(socialSessionId, targetUserId);
      if (!targetParticipant) {
        return res.status(403).json({ error: 'Reported user is not in this session', code: 'TARGET_NOT_A_PARTICIPANT' });
      }

      // The reporter's free-text note is the ONLY client-supplied text and
      // must pass the content gate (same rule as POST /api/reports).
      if (note) {
        const noteSafety = await validateContentSafeAsync(note, 'ugcReportNote', { userId });
        if (!noteSafety.safe && noteSafety.violation) {
          await recordViolation(userId, noteSafety.violation.type, noteSafety.violation.severity);
          return res.status(400).json(contentViolationResponse(noteSafety.violation).body);
        }
      }

      // Instant snapshot of the reported content — UNFILTERED on purpose (G4).
      const snapshot = snapshotIcebreakerUgc(
        state,
        [
          { userId, displayName: reporterParticipant.displayName },
          { userId: targetUserId, displayName: targetParticipant.displayName },
        ],
        contentRef,
        targetUserId,
      );

      const relatedEventId = await resolveGroupEventId(state.icebreakerSessionId);

      const description = buildIcebreakerUgcDescription({
        phase,
        kind: contentRef.kind,
        targetUserId,
        snapshot,
        note,
      });

      const [report] = await db
        .insert(reports)
        .values({
          reporterId: userId,
          reportedUserId: targetUserId,
          category: UGC_REPORT_CATEGORY,
          description,
          relatedEventId,
          status: 'pending',
        })
        .returning();

      // OBS-01: log shape carries {phase, kind} and NEVER the raw text.
      logger.info('[SocialIcebreaker] UGC report created', {
        request_id: req.requestId,
        reportId: report.id,
        socialSessionId,
        reporterId: userId,
        targetUserId,
        phase,
        kind: contentRef.kind,
        degraded: !snapshot.found,
      });

      return res.status(201).json({
        id: report.id,
        category: report.category,
        status: report.status,
        degraded: !snapshot.found,
      });
    } catch (error) {
      logger.error('[SocialIcebreaker] UGC report failed', {
        request_id: req.requestId,
        socialSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to create report', code: 'UGC_REPORT_FAILED' });
    }
  });
}
