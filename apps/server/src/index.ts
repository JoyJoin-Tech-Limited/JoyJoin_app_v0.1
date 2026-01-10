import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { perfStorage } from "./perf";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// RID + Performance Tracking Middleware
app.use((req, res, next) => {
  const rid = randomUUID().substring(0, 8);
  const startTime = process.hrtime();
  const metrics = { rid, dbCount: 0, dbMs: 0, dbMax: 0, startTime };

  perfStorage.run(metrics, () => {
    res.on("finish", () => {
      const diff = process.hrtime(startTime);
      const totalMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      const m = metrics as any;
      console.log(`[RID:${rid}] [${req.method}] ${req.url} - ${res.statusCode} (Total: ${totalMs}ms) | DB Metrics: { count: ${m.dbCount}, total: ${m.dbMs.toFixed(2)}ms, max: ${m.dbMax.toFixed(2)}ms }`);
    });
    next();
  });
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    // @ts-ignore
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  } else {
    // In production, we don't import vite.js as it contains dev-only dependencies
    // and TS types that fail at runtime in pure ESM.
    // Static file serving is handled by serveStatic which we'll inline or refactor.
    const path = await import("path");
    const fs = await import("fs");
    const express = (await import("express")).default;
    const distPath = path.resolve(process.cwd(), "dist", "public");

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      console.warn("Static build directory not found. Running as pure API server.");
    }
  }

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reuseAddr: true,
  }, () => {
    console.log(`serving on port ${port}`);
  });
})();
