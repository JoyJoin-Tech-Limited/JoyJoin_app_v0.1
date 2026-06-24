// Load environment variables from .env file (MUST be first)
import "dotenv/config";

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

import express, { type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { warmTTSCache } from "./ai/minimaxTTSService";
import { startPoolCardCopyWorker } from "./ai/workers/poolCardCopyWorker";
import { validateConfig } from "./lib/configValidation";
import { globalErrorHandler } from "./lib/errorResponse";
import { logger } from "./lib/logger";
import { validateDbSchema } from "./db";
import { ensureVirtualUsers } from "./services/singleTestService";
import { isSingleTestMode } from "./lib/isSingleTestMode";
import { detectTestBotRowsInProduction } from "./services/matchingTestService";
import { requestIdMiddleware } from "./middleware/requestId";
import { metricsMiddleware } from "./middleware/metrics";
import compression from "compression";

// Keep liveness reachable even when config is incomplete; readiness reports the failure.
validateConfig({ exitOnFatal: false });

const app = express();

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// ── Compression ────────────────────────────────────────────────────────────
// Why: JSON payloads (especially pool lists) compress 60–80%.  This is
// streaming zlib — it does NOT buffer the full response, satisfying SCL-03.
// Threshold=0 ensures the pilot verification curl sees Content-Encoding: gzip
// even on small local-dev datasets; production payloads are always >1 KB.
app.use(compression({ threshold: 0 }));

// ── Observability middleware ───────────────────────────────────────────────
// 1. Attach a unique correlation ID to every request.
app.use(requestIdMiddleware);
// 2. Collect Prometheus-style metrics for every request.
app.use(metricsMiddleware);

// Body parsing middleware
// Capture the original signed bytes for WeChat Pay webhook verification before
// JSON parsing consumes the request stream.
app.use(express.json({
  verify: (req: Request, _res, buf) => {
    const url = req.originalUrl ?? req.url ?? "";
    if (url === "/api/webhooks/wechat-pay" || url.startsWith("/api/webhooks/wechat-pay?")) {
      if (buf.length <= 1024 * 1024) {
        req.rawBody = buf.toString("utf8");
      }
    }
  },
}));
app.use(express.urlencoded({ extended: false }));

// Request logging middleware — emits structured JSON instead of plain text
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") && path !== "/api/metrics") {
      logger.info("HTTP request", {
        request_id: req.requestId,
        method: req.method,
        path,
        status_code: res.statusCode,
        duration_ms: duration,
      });
    }
  });

  next();
});

(async () => {
  try {
    // Validate database schema before accepting traffic.
    await validateDbSchema();

    // Production sentinel: abort startup if any test-bot rows are present.
    if (process.env.APP_MODE === 'production') {
      const testBotCount = await detectTestBotRowsInProduction();
      if (testBotCount > 0) {
        logger.error('[Startup] Production environment contains test-bot rows', { testBotCount });
        process.exit(1);
      }
    }

    // Register all API routes and get HTTP server
    const server = await registerRoutes(app);

    // Auto-seed virtual users in single-test mode (pool created on first session start)
    if (isSingleTestMode()) {
      try {
        await ensureVirtualUsers();
        logger.info('[Startup] Virtual users seeded for single-test mode');
      } catch (seedErr) {
        logger.warn('[Startup] Failed to auto-seed test data (non-fatal)', {
          error: seedErr instanceof Error ? seedErr.message : String(seedErr),
        });
      }
    }

    // Error handling middleware (must be after routes)
    app.use(globalErrorHandler);

    // Setup Vite in development or serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server
    const PORT = parseInt(process.env.PORT || "5001", 10);
    server.listen(PORT, "0.0.0.0", () => {
      logger.info("JoyJoin Server started", {
        port: PORT,
        environment: process.env.NODE_ENV ?? "development",
        app_mode: process.env.APP_MODE ?? "production",
        admin_key_configured: Boolean(process.env.ADMIN_CREATE_SECRET_KEY),
        run_plan_templates_enabled: process.env.RUN_PLAN_TEMPLATES_ENABLED === 'true',
      });

      // Warm TTS cache non-blocking (no-op if MINIMAX keys not configured)
      if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID) {
        warmTTSCache().catch(err => logger.warn('[startup] TTS cache warmup failed (non-fatal)', { error: String(err) }));
      }

      // Start pool card AI copy worker (catch-up cron every 5 min)
      startPoolCardCopyWorker(5);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: String(error) });
    process.exit(1);
  }
})();
