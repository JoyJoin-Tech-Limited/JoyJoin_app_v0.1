import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
export const db = drizzle({ client: pool, schema });

// Warmup database connection on startup to prevent autosuspend issues
export async function warmupDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection warmed up successfully');
  } catch (error) {
    console.error('Database warmup failed:', error);
    // Try again after a short delay
    setTimeout(async () => {
      try {
        await pool.query('SELECT 1');
        console.log('Database connection warmed up successfully (retry)');
      } catch (retryError) {
        console.error('Database warmup retry failed:', retryError);
      }
    }, 2000);
  }
}
