import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
};

if (process.env.DATABASE_URL.includes('neon.tech')) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });

export async function warmupDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection warmed up successfully');
  } catch (error) {
    console.error('Database warmup failed:', error);
    // Retry after delay
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await pool.query('SELECT 1');
      console.log('Database connection warmed up successfully (retry)');
    } catch (retryError) {
      console.error('Database warmup retry failed:', retryError);
      // Both attempts failed, connection will be attempted on first query
    }
  }
}
