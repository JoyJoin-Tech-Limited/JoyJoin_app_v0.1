import { db } from "../db.js";
import { users } from "@shared/schema/_definitions.js";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

/**
 * Idempotent backfill: maps legacy users.workMode values to the canonical
 * users.lifeStage vocabulary. Only writes lifeStage when it is currently null
 * and workMode has a known mapping.
 *
 * Mapping:
 *   founder         -> 创业中
 *   self_employed   -> 自由职业
 *   employed        -> 职场老手 (best-effort; loses "新人" distinction)
 *   student         -> 学生党
 *   transitioning   -> 职场新人
 *   caregiver_retired -> null (out of scope for v0.1 vocabulary)
 *   successor       -> null (out of scope for v0.1 vocabulary)
 */
const WORK_MODE_TO_LIFE_STAGE: Record<string, string | null> = {
  founder: "创业中",
  self_employed: "自由职业",
  employed: "职场老手",
  student: "学生党",
  transitioning: "职场新人",
  caregiver_retired: null,
  successor: null,
};

export async function backfillLifeStage(options: { dryRun?: boolean } = {}): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  const dryRun = options.dryRun ?? false;

  const rows = await db
    .select({
      id: users.id,
      workMode: users.workMode,
      lifeStage: users.lifeStage,
    })
    .from(users)
    .where(sql`${users.workMode} IS NOT NULL AND ${users.lifeStage} IS NULL`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const target = row.workMode ? WORK_MODE_TO_LIFE_STAGE[row.workMode] : null;
    if (!target) {
      skipped++;
      logger.info("[BackfillLifeStage] Skipping user with unmapped workMode", {
        userId: row.id,
        workMode: row.workMode,
      });
      continue;
    }

    if (!dryRun) {
      await db
        .update(users)
        .set({ lifeStage: target })
        .where(sql`${users.id} = ${row.id}`);
    }
    updated++;
    logger.info("[BackfillLifeStage] Backfilled lifeStage", {
      userId: row.id,
      workMode: row.workMode,
      lifeStage: target,
      dryRun,
    });
  }

  logger.info("[BackfillLifeStage] Complete", {
    scanned: rows.length,
    updated,
    skipped,
    dryRun,
  });

  return { scanned: rows.length, updated, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  backfillLifeStage({ dryRun })
    .then((result) => {
      console.log("Backfill result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
