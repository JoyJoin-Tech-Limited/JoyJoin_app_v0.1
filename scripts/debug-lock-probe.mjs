// Debug: probe PostgreSQL locks (used by CI deploy SSH script)
// Usage: node scripts/debug-lock-probe.mjs
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

try {
  await client.connect();
  const r = await client.query(`
    select pid, usename, state, wait_event_type, wait_event, left(query, 140) as query
    from pg_stat_activity
    where datname = current_database()
      and state <> 'idle'
    order by query_start asc
    limit 12
  `);
  console.log(JSON.stringify({ activeSessions: r.rows }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ lockProbeError: error?.message ?? String(error) }));
} finally {
  try { await client.end(); } catch { /* ignore */ }
}
