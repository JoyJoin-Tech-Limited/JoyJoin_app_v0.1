/**
 * Read-only M1.2a profile-context audit.
 *
 * Answers the question the plan gates on: is the profile pipeline actually
 * producing usable context on real sessions?
 * - mixText non-empty rate (canonical archetype composition)
 * - participant profile non-null rate
 * - shared-interest anchor count / coverage
 * - generic politeness anchor share (咖啡/旅行/电影/美食/健身)
 *
 * Writes nothing. Prints aggregate counts only — no names, user ids, interests
 * or session ids. Run:
 *   npm run audit:icebreaker-profile-context -w @joyjoin/server -- --days=30 --limit=30
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { socialIcebreakerSessions } from '@shared/schema';
import { db, pool } from '../db';
import { listParticipants, preloadRosterInterestLabels } from '../lib/socialIcebreakerStore';
import { buildArchetypeContext } from '../lib/contextInjector';
import { buildSharedInterestAnchors } from '../lib/icebreakerRosterSignals';
import { getFeatureFlag } from '../lib/featureFlags';
import { logger } from '../lib/logger';
import { TABLE_PERSONA_ANCHOR_LIMIT, TABLE_PERSONA_LARGE_ROSTER } from '../lib/tablePersona';

interface SessionAudit {
  mixTextPresent: boolean;
  profileCount: number;
  participantCount: number;
  effectiveAnchorCount: number;
  effectiveGenericCount: number;
  potentialAnchorCount: number;
  potentialGenericCount: number;
}

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const parsed = Number(raw.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * FU-05: mirror the anchor threshold `deriveTablePersona` uses (see
 * `lib/tablePersona.ts:217-220` — a larger table needs a third of the table,
 * minimum 3 members, behind an anchor; a small table needs 2).
 *
 * The audit previously hardcoded `minMembers: 2`, so it overstated "potential
 * anchors" for 6+ member tables — the exact tables where the live prompt
 * requires 3. Importing `TABLE_PERSONA_LARGE_ROSTER` keeps this on the shared
 * constant instead of a second copy of `6`, and
 * `__tests__/auditIcebreakerProfileContext.test.ts` asserts parity with
 * `deriveTablePersona` so a future rule change fails loudly here.
 */
export function resolveAuditAnchorMinMembers(rosterSize: number): number {
  return rosterSize >= TABLE_PERSONA_LARGE_ROSTER ? 3 : 2;
}

async function auditSession(socialSessionId: string, matchingAware: boolean): Promise<SessionAudit> {
  const participants = await listParticipants(socialSessionId);
  const roster = participants.map((participant) => ({
    archetype: participant.archetype,
    primaryArchetype: participant.primaryArchetype,
    interests: participant.interests,
  }));

  // Effective = what the live prompt would receive with today's flag posture.
  // Threshold + limit come from the shared table-persona rule (FU-05), not a
  // local copy of the numbers.
  const anchorOptions = {
    minMembers: resolveAuditAnchorMinMembers(roster.length),
    limit: TABLE_PERSONA_ANCHOR_LIMIT,
  };
  const effectiveAnchors = buildSharedInterestAnchors(roster, anchorOptions);

  // Potential = what the same table would produce if matching-aware enrichment
  // were on. This distinguishes "flag off" from "data missing".
  let potentialAnchors = effectiveAnchors;
  if (!matchingAware && participants.length > 0) {
    const labelsByUser = await preloadRosterInterestLabels(participants.map((p) => p.userId));
    potentialAnchors = buildSharedInterestAnchors(
      roster.map((member, index) => ({
        ...member,
        interests: labelsByUser.get(participants[index].userId) ?? member.interests,
      })),
      anchorOptions,
    );
  }

  return {
    mixTextPresent: buildArchetypeContext(roster).mixText.trim().length > 0,
    profileCount: participants.filter((participant) => participant.profile != null).length,
    participantCount: participants.length,
    effectiveAnchorCount: effectiveAnchors.length,
    effectiveGenericCount: effectiveAnchors.filter((anchor) => anchor.generic).length,
    potentialAnchorCount: potentialAnchors.length,
    potentialGenericCount: potentialAnchors.filter((anchor) => anchor.generic).length,
  };
}

async function main(): Promise<void> {
  const days = readNumberArg('days', 30);
  const limit = Math.min(readNumberArg('limit', 30), 200);
  const includeTest = process.argv.includes('--include-test');
  const json = process.argv.includes('--json');

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const conditions = [gte(socialIcebreakerSessions.createdAt, cutoff)];
  if (!includeTest) conditions.push(eq(socialIcebreakerSessions.isTestSession, false));

  const sessions = await db
    .select({ id: socialIcebreakerSessions.id, createdAt: socialIcebreakerSessions.createdAt })
    .from(socialIcebreakerSessions)
    .where(and(...conditions))
    .orderBy(desc(socialIcebreakerSessions.createdAt))
    .limit(limit);

  const flag = await getFeatureFlag('icebreakerMatchingAwareEnabled', true).catch(() => false);

  const audits: SessionAudit[] = [];
  for (const session of sessions) {
    try {
      audits.push(await auditSession(session.id, flag));
    } catch (error) {
      logger.warn('[AuditProfileContext] session skipped', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const sessionCount = audits.length;
  const participants = audits.reduce((sum, audit) => sum + audit.participantCount, 0);
  const profiles = audits.reduce((sum, audit) => sum + audit.profileCount, 0);
  const effectiveAnchors = audits.reduce((sum, audit) => sum + audit.effectiveAnchorCount, 0);
  const effectiveGeneric = audits.reduce((sum, audit) => sum + audit.effectiveGenericCount, 0);
  const potentialAnchors = audits.reduce((sum, audit) => sum + audit.potentialAnchorCount, 0);
  const potentialGeneric = audits.reduce((sum, audit) => sum + audit.potentialGenericCount, 0);

  const report = {
    status: sessionCount === 0 ? 'INSUFFICIENT_DATA' : 'OK',
    windowDays: days,
    sessionLimit: limit,
    includeTest,
    matchingAwareFlag: flag,
    sessionsScanned: sessionCount,
    participants: participants,
    rates: {
      sessionMixTextPresent: rate(audits.filter((audit) => audit.mixTextPresent).length, sessionCount),
      participantProfilePresent: rate(profiles, participants),
      sessionWithEffectiveAnchor: rate(
        audits.filter((audit) => audit.effectiveAnchorCount > 0).length,
        sessionCount,
      ),
      sessionWithPotentialAnchor: rate(
        audits.filter((audit) => audit.potentialAnchorCount > 0).length,
        sessionCount,
      ),
      effectiveGenericAnchorShare: rate(effectiveGeneric, effectiveAnchors),
      potentialGenericAnchorShare: rate(potentialGeneric, potentialAnchors),
    },
    anchors: {
      effectiveTotal: effectiveAnchors,
      effectiveSessionsWithAnchor: audits.filter((audit) => audit.effectiveAnchorCount > 0).length,
      potentialTotal: potentialAnchors,
      potentialSessionsWithAnchor: audits.filter((audit) => audit.potentialAnchorCount > 0).length,
    },
    note: 'Aggregate-only; no names, user ids, interests or session ids are printed.',
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Icebreaker profile-context audit (M1.2a)');
    console.log(`status=${report.status} sessions=${sessionCount} participants=${participants}`);
    console.log(`matchingAwareFlag=${flag}`);
    console.log(`mixText non-empty: ${(report.rates.sessionMixTextPresent * 100).toFixed(1)}%`);
    console.log(`participant profile present: ${(report.rates.participantProfilePresent * 100).toFixed(1)}%`);
    console.log(`effective anchors: ${effectiveAnchors} across ${report.anchors.effectiveSessionsWithAnchor} sessions`);
    console.log(`potential anchors: ${potentialAnchors} across ${report.anchors.potentialSessionsWithAnchor} sessions`);
    console.log(`generic anchor share: effective=${(report.rates.effectiveGenericAnchorShare * 100).toFixed(1)}% potential=${(report.rates.potentialGenericAnchorShare * 100).toFixed(1)}%`);
    console.log(report.note);
  }
}

// Guarded so tests can import `resolveAuditAnchorMinMembers` without running the
// audit (which opens a DB pool and calls `pool.end()`). Same pattern as
// `backfill-legacy-event-credits.ts` / `backfillLifeStage.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error('[AuditProfileContext] failed', error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => undefined);
    });
}
