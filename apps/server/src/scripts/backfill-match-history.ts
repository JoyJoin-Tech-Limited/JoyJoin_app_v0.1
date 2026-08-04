/**
 * Backfill `match_history` from `event_group_outcomes` (Magnetism Engine
 * Phase 0 / W1).
 *
 * Iterates every group that has at least one submitted outcome and runs the
 * same derivation as the real-time post-submission trigger, then refreshes
 * `archetype_pair_feedback_stats` once at the end (W3). Fully idempotent —
 * safe to re-run; re-runs update existing pair rows in place and never
 * duplicate them.
 *
 * Usage:
 *   npm run backfill:match-history -w @joyjoin/server                # full backfill
 *   npm run backfill:match-history -w @joyjoin/server -- --dry-run   # plan only, no writes
 *   npm run backfill:match-history -w @joyjoin/server -- --help
 *
 * Reads DATABASE_URL via --env-file=../../.env (wired in the npm script).
 */
import { pool } from "../db";
import { refreshArchetypePairCalibrationMap } from "../archetypeChemistryCalibration";
import { listGroupIdsWithSubmittedOutcomes } from "../repositories/matchHistoryRepo";
import {
  derivePairRowsForGroup,
  planPairRowsForGroup,
} from "../services/matchHistoryDerivation";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

function printUsage(): void {
  process.stdout.write(
    [
      "backfill-match-history — derive match_history pair rows from event_group_outcomes",
      "",
      "Options:",
      "  --dry-run   Plan every group and report what would be written; no DB writes,",
      "              no calibration-stats refresh.",
      "  --help, -h  Show this message.",
      "",
    ].join("\n"),
  );
}

async function main() {
  if (args.has("--help") || args.has("-h")) {
    printUsage();
    return;
  }

  const groupIds = await listGroupIdsWithSubmittedOutcomes();

  const summary = {
    dryRun,
    groupsFound: groupIds.length,
    derived: 0,
    skipped: 0,
    failed: 0,
    pairsPlanned: 0,
    pairsInserted: 0,
    pairsUpdated: 0,
    calibrationRefreshed: false,
    failures: [] as Array<{ groupId: string; error: string }>,
  };

  for (const groupId of groupIds) {
    try {
      if (dryRun) {
        const plan = await planPairRowsForGroup(groupId);
        if (plan.status === "ready") {
          summary.derived += 1;
          summary.pairsPlanned += plan.pairs.length;
        } else {
          summary.skipped += 1;
        }
        continue;
      }

      const result = await derivePairRowsForGroup(groupId);
      if (result.status === "derived") {
        summary.derived += 1;
        summary.pairsInserted += result.insertedCount;
        summary.pairsUpdated += result.updatedCount;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // W3: one full re-aggregate + upsert of archetype_pair_feedback_stats after
  // all groups are derived (per-group refreshes would be redundant work).
  if (!dryRun && summary.derived > 0) {
    await refreshArchetypePairCalibrationMap();
    summary.calibrationRefreshed = true;
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.failed > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
