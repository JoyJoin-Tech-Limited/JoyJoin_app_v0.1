import { pool } from "../db";
import { getFlashFeatureReadiness } from "../services/flashService";

async function main() {
  const readiness = await getFlashFeatureReadiness();
  process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`);
  if (!readiness.ready) process.exitCode = 2;
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
