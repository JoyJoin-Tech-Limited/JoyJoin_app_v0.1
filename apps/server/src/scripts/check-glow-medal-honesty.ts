/**
 * Glow medal honesty check — Wave 4 health metric (gameplay-depth roadmap
 * Wave 5 gate: "medal honesty rate = 100%, P1 if <100").
 *
 * READ-ONLY. SELECTs only; never writes.
 *
 * For every `sessionGlowEnabled === true` session with a glow recap payload,
 * verifies that every medal persisted in `state_json.recapSnapshot.glow.medals`
 * is backed by data that survives phase cleanup:
 *
 *   接梗王      → glowPoints[uid].quip    >= 4   (persisted in state_json)
 *   暖心雷达    → glowPoints[uid].mirror  >= 4   (persisted in state_json)
 *   豪气担当    → auctionLotResults has winnerUserId = uid (survives cleanup)
 *   全勤小可爱  → hasFullGlowAttendance(state, uid) (glowParticipation persisted)
 *   挑战先锋    → challengeCompletedBy includes uid (survives cleanup)
 *   话题王      → social_icebreaker_phase_pulse_checks row exists for uid
 *   最佳侦探    → PARTIAL floor: glowPoints[uid].lie >= 1. The full weight
 *                 chain (votes / currentLieDetectiveReveal /
 *                 lieDetectiveCompletedUserIds) is WIPED by
 *                 cleanupPhaseStateForNextPhase on lie_detective exit, so the
 *                 exact "top weight" claim is not auditable from persisted
 *                 state. The floor proves the recipient actually completed a
 *                 detective turn.
 *
 * Also verifies structural invariants:
 *   - dual-write: glow.medals === recapSnapshot.medals (same computation,
 *     contract AC-07 / verifier N5)
 *   - <= 4 medals per session, distinct recipients
 *   - every roster member's persisted tier === deriveGlowTier(glowTotal(...))
 *   - flag-on sessions with a recapSnapshot MUST carry a glow payload
 *
 * Usage (from apps/server):
 *   node --env-file=../../.env --import tsx/esm src/scripts/check-glow-medal-honesty.ts [--days 30]
 *
 * Exit 0 = honesty 100% or no flag-on sessions in window (NO_DATA notice).
 * Exit 1 = any violation found.
 */
import { sql } from "drizzle-orm";
import {
  socialIcebreakerParticipants,
  socialIcebreakerPhasePulseChecks,
  socialIcebreakerSessions,
} from "@shared/schema";
import type { Medal, SocialSessionState } from "@joyjoin/shared/socialIcebreaker";
import { db } from "../db";
import {
  deriveGlowTier,
  glowTotal,
  hasFullGlowAttendance,
} from "../lib/sessionGlow";

interface Violation {
  socialSessionId: string;
  kind: string;
  detail: string;
}

const KNOWN_MEDAL_TITLES = new Set([
  "接梗王",
  "暖心雷达",
  "豪气担当",
  "全勤小可爱",
  "最佳侦探",
  "挑战先锋",
  "话题王",
]);

function parseDaysArg(): number {
  const idx = process.argv.indexOf("--days");
  if (idx >= 0) {
    const parsed = Number.parseInt(process.argv[idx + 1] ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 30;
}

async function main(): Promise<void> {
  const days = parseDaysArg();
  const violations: Violation[] = [];
  let totalMedals = 0;
  let honestMedals = 0;
  let partialMedals = 0;

  console.log(`\n=== Glow medal honesty check (last ${days} days) ===\n`);

  const rows = await db
    .select({
      id: socialIcebreakerSessions.id,
      stateJson: socialIcebreakerSessions.stateJson,
      createdAt: socialIcebreakerSessions.createdAt,
    })
    .from(socialIcebreakerSessions)
    .where(
      sql`${socialIcebreakerSessions.createdAt} > now() - (${days}::text || ' days')::interval
          AND ${socialIcebreakerSessions.stateJson}->>'sessionGlowEnabled' = 'true'
          AND ${socialIcebreakerSessions.stateJson}->'recapSnapshot' IS NOT NULL`,
    );

  if (rows.length === 0) {
    console.log(
      `NO_DATA: zero sessionGlowEnabled sessions with a recapSnapshot in the last ${days} days.\n` +
        `The health metric has no signal yet — re-run after \`sessionGlowEnabled\` goes live.`,
    );
    process.exit(0);
  }

  console.log(`Found ${rows.length} flag-on session(s) with a recap snapshot.\n`);

  for (const row of rows) {
    const state = row.stateJson as unknown as SocialSessionState;
    const glow = state.recapSnapshot?.glow;

    // Structural: flag-on + recapSnapshot implies glow payload (AC-07).
    if (!glow) {
      violations.push({
        socialSessionId: row.id,
        kind: "MISSING_GLOW_PAYLOAD",
        detail: "sessionGlowEnabled=true and recapSnapshot present, but recapSnapshot.glow is absent",
      });
      continue;
    }

    const roster = await db
      .select({
        userId: socialIcebreakerParticipants.userId,
        displayName: socialIcebreakerParticipants.displayName,
      })
      .from(socialIcebreakerParticipants)
      .where(sql`${socialIcebreakerParticipants.socialSessionId} = ${row.id}`);

    // Dual-write integrity (contract AC-07, verifier N5).
    const legacyMedals = state.recapSnapshot?.medals ?? [];
    if (JSON.stringify(glow.medals) !== JSON.stringify(legacyMedals)) {
      violations.push({
        socialSessionId: row.id,
        kind: "DUAL_WRITE_DIVERGENCE",
        detail: "recapSnapshot.glow.medals !== recapSnapshot.medals",
      });
    }

    if (glow.medals.length > 4) {
      violations.push({
        socialSessionId: row.id,
        kind: "MEDAL_CAP_EXCEEDED",
        detail: `${glow.medals.length} medals (cap 4)`,
      });
    }

    // Tier consistency: persisted tier must equal the deterministic derivation.
    for (const entry of roster) {
      const persisted = glow.tiers?.[entry.userId];
      const derived = deriveGlowTier(glowTotal(state.glowPoints?.[entry.userId]));
      if (persisted !== derived) {
        violations.push({
          socialSessionId: row.id,
          kind: "TIER_MISMATCH",
          detail: `user ${entry.userId}: persisted=${persisted ?? "<absent>"} derived=${derived}`,
        });
      }
    }

    const seenRecipients = new Set<string>();

    for (const medal of glow.medals as Medal[]) {
      totalMedals += 1;
      const recipients = roster.filter(
        (r: { userId: string; displayName: string }) => r.displayName === medal.recipientDisplayName,
      );
      if (recipients.length !== 1) {
        violations.push({
          socialSessionId: row.id,
          kind: "RECIPIENT_UNRESOLVABLE",
          detail: `medal "${medal.title}" recipient "${medal.recipientDisplayName}" matched ${recipients.length} roster entries`,
        });
        continue;
      }
      const uid = recipients[0].userId;
      if (seenRecipients.has(uid)) {
        violations.push({
          socialSessionId: row.id,
          kind: "DUPLICATE_RECIPIENT",
          detail: `user ${uid} received multiple medals`,
        });
        continue;
      }
      seenRecipients.add(uid);

      if (!KNOWN_MEDAL_TITLES.has(medal.title)) {
        violations.push({
          socialSessionId: row.id,
          kind: "UNKNOWN_MEDAL_TITLE",
          detail: `title "${medal.title}" is not in the known medal taxonomy`,
        });
        continue;
      }

      const breakdown = state.glowPoints?.[uid];
      let honest = false;
      let partial = false;

      switch (medal.title) {
        case "接梗王":
          honest = (breakdown?.quip ?? 0) >= 4;
          break;
        case "暖心雷达":
          honest = (breakdown?.mirror ?? 0) >= 4;
          break;
        case "豪气担当":
          honest = (state.auctionLotResults ?? []).some((r) => r.winnerUserId === uid);
          break;
        case "全勤小可爱":
          honest = hasFullGlowAttendance(state, uid);
          break;
        case "挑战先锋":
          honest = (state.challengeCompletedBy ?? []).includes(uid);
          break;
        case "话题王": {
          const pulse = await db
            .select({ id: socialIcebreakerPhasePulseChecks.id })
            .from(socialIcebreakerPhasePulseChecks)
            .where(
              sql`${socialIcebreakerPhasePulseChecks.socialSessionId} = ${row.id}
                  AND ${socialIcebreakerPhasePulseChecks.userId} = ${uid}`,
            )
            .limit(1);
          honest = pulse.length > 0;
          break;
        }
        case "最佳侦探":
          // PARTIAL: full weight chain wiped at cleanup; floor = completed turn.
          honest = (breakdown?.lie ?? 0) >= 1;
          partial = true;
          break;
      }

      if (honest) {
        honestMedals += 1;
        if (partial) partialMedals += 1;
      } else {
        violations.push({
          socialSessionId: row.id,
          kind: "MEDAL_WITHOUT_DATA",
          detail: `medal "${medal.title}" awarded to ${medal.recipientDisplayName} (${uid}) with no backing data${
            partial ? " (floor check)" : ""
          }`,
        });
      }
    }
  }

  const honestyRate = totalMedals === 0 ? null : honestMedals / totalMedals;

  console.log(`Sessions checked : ${rows.length}`);
  console.log(`Medals checked   : ${totalMedals} (${partialMedals} partial-audit: 最佳侦探 floor only)`);
  console.log(
    `Honesty rate     : ${honestyRate === null ? "n/a (no medals)" : `${(honestyRate * 100).toFixed(1)}%`}`,
  );
  console.log(`Violations       : ${violations.length}`);
  for (const v of violations) {
    console.log(`  ❌ [${v.kind}] session=${v.socialSessionId} — ${v.detail}`);
  }

  // Machine-readable trailer for ops log scraping.
  console.log(
    `\nGLOW_HONESTY_SUMMARY ${JSON.stringify({
      days,
      sessions: rows.length,
      totalMedals,
      honestMedals,
      partialMedals,
      honestyRate,
      violations: violations.length,
    })}`,
  );

  if (violations.length > 0) {
    console.error("\nFAIL: medal honesty rate < 100% — treat as P1 per roadmap Wave 5.");
    process.exit(1);
  }
  console.log("\nPASS: all audited medals are backed by persisted data.");
  process.exit(0);
}

main().catch((error) => {
  console.error("check-glow-medal-honesty failed:", error);
  process.exit(2);
});
