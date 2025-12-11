import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { warmupDatabase } from "./db";
import { subscriptionService } from "./subscriptionService";
import { wsService } from "./wsService";
import { scanAllActivePools } from "./poolRealtimeMatchingService";

// Detect if running on Replit infra (where reusePort is supported/needed)
const IS_REPLIT =
  !!process.env.REPL_ID ||
  process.env.REPLIT_ENV === "true" ||
  process.env.REPL_OWNER != null;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0";

  const listenOptions: any = {
    port,
    host,
  };

  // On Replit, we can enable reusePort; on local dev (macOS, etc.) it may cause ENOTSUP,
  // so we keep it off by default there.
  if (IS_REPLIT) {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);

    // In development, Vite already uses its own WebSocket server for HMR on this port.
    // To avoid protocol conflicts (e.g. "Invalid frame header" from Vite's client),
    // we only start our own wsService WebSocket server in non-development environments.
    if (app.get("env") !== "development") {
      wsService.initialize(server);
      log(`WebSocket server ready at ws://0.0.0.0:${port}/ws`);
    } else {
      log(`[WS] Skipping wsService in development to avoid conflict with Vite HMR`);
    }

    // Warmup database connection to prevent autosuspend issues
    warmupDatabase();

    // Start subscription expiry checker (runs every hour)
    subscriptionService.startExpiryChecker();

    // Start realtime matching scheduler (runs every hour)
    const MATCHING_SCAN_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    setInterval(() => {
      scanAllActivePools().catch((err) => {
        console.error("[Matching Scheduler] Error scanning pools:", err);
      });
    }, MATCHING_SCAN_INTERVAL);

    log(`Realtime matching scheduler started (scanning every 60 minutes)`);
  });
})();
