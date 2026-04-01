// Load environment variables from .env file (MUST be first)
import "dotenv/config";

import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { warmTTSCache } from "./ai/minimaxTTSService";
import { validateConfig } from "./lib/configValidation";
import { globalErrorHandler } from "./lib/errorResponse";

// Validate required configuration early — exits in production if critical vars are missing
validateConfig();

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
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

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Register all API routes and get HTTP server
    const server = await registerRoutes(app);

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
      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      console.log(`\n🎉 JoyJoin Server Started Successfully!`);
      console.log(`⏰ Time: ${formattedTime}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`📍 API available at http://localhost:${PORT}/api`);
      console.log(`🔑 Admin secret key: ${process.env.ADMIN_CREATE_SECRET_KEY ? "✅ Configured" : "❌ Missing"}`);
      console.log(`\n`);

      // Warm TTS cache non-blocking (no-op if MINIMAX keys not configured)
      if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID) {
        warmTTSCache().catch(err => console.warn('[startup] TTS cache warmup failed (non-fatal):', err));
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();