import { db } from "../db";
import { eventPools, eventPoolRegistrations, users } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { performance } from "perf_hooks";

async function measure(label, fn) {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;
  console.log(`${label}: ${duration.toFixed(0)} ms`);
  return duration;
}

async function main() {
  console.log("Measuring individual query latency to remote Neon DB...\n");

  const now = new Date();

  // Q1: Simple pool select (what existing endpoint does)
  await measure("Q1: Pool select (21 rows)", () =>
    db
      .select({ id: eventPools.id })
      .from(eventPools)
      .where(sql`${eventPools.status} = 'active' AND ${eventPools.registrationDeadline} > ${now}`)
      .orderBy(eventPools.dateTime)
      .limit(21)
  );

  // Q2: Window function
  await measure("Q2: Window function (sample archetypes)", () =>
    db.execute(sql`
      SELECT pool_id, user_id,
        row_number() OVER (PARTITION BY pool_id ORDER BY registered_at) AS rn
      FROM event_pool_registrations
      LIMIT 5
    `)
  );

  // Q3: Join aggregation
  await measure("Q3: Join aggregation (top archetypes)", () =>
    db
      .select({
        poolId: eventPoolRegistrations.poolId,
        count: sql`count(*)::int`,
      })
      .from(eventPoolRegistrations)
      .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
      .groupBy(eventPoolRegistrations.poolId)
      .limit(5)
  );

  // Q4: AI headlines
  await measure("Q4: AI headlines select", () =>
    db
      .select({ poolId: sql<string>`pool_id`, headline: sql<string>`headline` })
      .from(sql`pool_ai_copy`)
      .limit(5)
  );

  console.log("\nDone.");
  await db.$client.end?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
