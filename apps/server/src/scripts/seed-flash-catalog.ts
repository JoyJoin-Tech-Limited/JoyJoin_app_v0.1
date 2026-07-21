import { pool } from "../db";
import {
  getFlashReadiness,
  isFlashSchemaReady,
  seedBuiltinFlashCatalog,
} from "../repositories/flashRepo";

async function main() {
  if (!(await isFlashSchemaReady())) {
    throw new Error(
      "FLASH_SCHEMA_NOT_READY: inspect the live database and deploy the additive Flash schema before running seed:flash",
    );
  }
  const seeded = await seedBuiltinFlashCatalog();
  const readiness = await getFlashReadiness();
  process.stdout.write(`${JSON.stringify({ seeded, readiness }, null, 2)}\n`);
  if (readiness.reviewedTasks < 30) {
    process.stdout.write(
      "The 30 seeded tasks remain pending_review and inactive. An operator must explicitly approve them in the admin portal.\n",
    );
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
