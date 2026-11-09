/**
 * Read-only pre-generation coverage audit.
 *
 * Answers one question with one number: **did the content for a phase already
 * exist before the host opened it?** Definition, exclusions and the
 * insufficient-sample rule live in `lib/preGenerationCoverage.ts` — this script
 * only formats them.
 *
 * Run:
 *   npm run audit:pre-generation-coverage -w @joyjoin/server -- --days=30
 *   npm run audit:pre-generation-coverage -w @joyjoin/server -- --days=30 --json
 *   npm run audit:pre-generation-coverage -w @joyjoin/server -- --include-test
 */

import { pool } from "../db";
import { resolveAdminRange } from "../lib/adminMetrics";
import { loadPreGenerationCoverage } from "../lib/preGenerationCoverage";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const parsed = Number(raw.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const days = Math.min(readNumberArg("days", 30), 400);
  const includeTest = process.argv.includes("--include-test");
  const json = process.argv.includes("--json");

  const range = resolveAdminRange({ days });
  const report = await loadPreGenerationCoverage(range, { includeTest });

  if (json) {
    console.log(JSON.stringify({ range: { from: range.from, to: range.to }, ...report }, null, 2));
    return;
  }

  console.log(`Pre-generation coverage — last ${days} days${includeTest ? " (incl. test sessions)" : ""}`);
  console.log(
    `status=${report.status} sessions=${report.sessionCount} measuredPhaseUses=${report.measuredPhaseUses}`,
  );
  console.log(
    `excluded: firstPhase=${report.excludedFirstPhaseUses} recap=${report.excludedNonGeneratableUses} unmeasured=${report.excludedUnmeasuredUses}`,
  );
  console.log(
    `strict on-time ${pct(report.strictOnTimeRate)} | open-ready(${report.openGraceMs / 1000}s) ${pct(
      report.openReadyRate,
    )} | eventual ${pct(report.eventualCoverageRate)}`,
  );
  console.log(
    `session full coverage ${pct(report.sessionFullCoverageRate)} (${report.sessionsWithFullCoverage} sessions)`,
  );
  console.log(
    `jobs: ${Object.entries(report.jobCounts)
      .map(([status, count]) => `${status}=${count}`)
      .join(" ") || "none"} | completion ${pct(report.jobCompletionRate)}`,
  );
  if (report.jobFailureCodes.length > 0) {
    console.log(
      `failure codes: ${report.jobFailureCodes.map((row) => `${row.code}=${row.count}`).join(", ")}`,
    );
  }
  console.log(
    `live content share ${pct(report.liveContentShare)} of ${report.storedResultCount} stored results`,
  );

  if (report.phases.length > 0) {
    console.log("per phase:");
    for (const row of report.phases) {
      console.log(
        `  ${row.phase.padEnd(18)} used=${String(row.used).padStart(3)} strict=${pct(
          row.strictOnTimeRate,
        ).padStart(6)} open=${pct(row.openReadyRate).padStart(6)} eventual=${pct(
          row.eventualCoverageRate,
        ).padStart(6)} fallback=${row.fallback}`,
      );
    }
  }

  if (report.status === "INSUFFICIENT_DATA") {
    console.log(
      `\nINSUFFICIENT_DATA: ${report.measuredPhaseUses}/${report.minSample} measured phase-uses. Do not quote a rate yet.`,
    );
  }
  console.log(`\n${report.definition}`);
}

// Guarded so tests can import helpers without opening a DB pool.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error(
        "[PreGenerationCoverage] failed",
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => undefined);
    });
}
