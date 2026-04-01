// Load environment variables from .env file (MUST be first)
import "dotenv/config";

import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { warmTTSCache } from "./ai/minimaxTTSService";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middleware/requestId";
import { metricsMiddleware } from "./middleware/metrics";

const app = express();

// ── Observability middleware (must be first) ───────────────────────────────
// 1. Attach a unique correlation ID to every request.
app.use(requestIdMiddleware);
// 2. Collect Prometheus-style metrics for every request.
app.use(metricsMiddleware);

// Body parsing middleware
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl.startsWith("/api/webhooks/wechat-pay") || req.url.startsWith("/api/webhooks/wechat-pay")) {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
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
    // Register all API routes and get HTTP server
    const server = await registerRoutes(app);

    // Error handling middleware (must be after routes)
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      logger.error("Unhandled request error", {
        request_id: req.requestId,
        status,
        message,
        stack: err.stack,
      });
      res.status(status).json({ message });
    });

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
        admin_key_configured: Boolean(process.env.ADMIN_CREATE_SECRET_KEY),
      });

      // Warm TTS cache non-blocking (no-op if MINIMAX keys not configured)
      if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID) {
        warmTTSCache().catch(err => logger.warn('[startup] TTS cache warmup failed (non-fatal)', { error: String(err) }));
      }
    });
  } catch (error) {
    logger.error("Failed to start server", { error: String(error) });
    process.exit(1);
  }
})();
