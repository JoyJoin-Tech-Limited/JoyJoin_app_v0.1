import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getReadinessConfigErrors } from "./lib/configValidation";

export interface ReadinessResponseBody {
  status: "ready" | "not_ready";
  checks: {
    database: "ok" | "error";
    config: "ok" | "error";
  };
  timestamp: string;
}

export async function evaluateReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ status: number; body: ReadinessResponseBody }> {
  const checks: ReadinessResponseBody["checks"] = {
    database: "ok",
    config: "ok",
  };
  let ready = true;

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.database = "error";
    ready = false;
  }

  if (getReadinessConfigErrors(env).length > 0) {
    checks.config = "error";
    ready = false;
  }

  return {
    status: ready ? 200 : 503,
    body: {
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
  };
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/readyz", async (_req, res) => {
    const readiness = await evaluateReadiness();
    res.status(readiness.status).json(readiness.body);
  });

  app.get("/readyz", (_req, res) => {
    res.redirect("/api/readyz");
  });
}
