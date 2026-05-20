import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";

// Add this helper at the top of the file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(_app: Express, _server: Server) {
  // No-op: user-client workspace has been archived.
  // Development server now runs as pure API only.
  return;
}

// Returns true if static files were found and served, false if running as pure API
export function serveStatic(app: Express): boolean {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn("Static build directory not found. Running as pure API server.");
  } else {
    app.use(express.static(distPath));

    app.use("*", (req, res, next) => {
      if (String(req.path).startsWith("/api")) return next();
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // CDN static assets (mascot, xiaoyue, illustrations) — served at /static/
  const cdnPath = "/static";
  if (fs.existsSync(cdnPath)) {
    app.use("/static", express.static(cdnPath, {
      maxAge: "30d",
      immutable: true,
    }));
    console.log(`CDN static assets served from ${cdnPath}`);
  } else {
    // Fallback: try deployment directory
    const deployCdn = path.resolve(__dirname, "..", "static");
    if (fs.existsSync(deployCdn)) {
      app.use("/static", express.static(deployCdn, {
        maxAge: "30d",
        immutable: true,
      }));
      console.log(`CDN static assets served from ${deployCdn}`);
    }
  }

  return fs.existsSync(distPath);
}

  app.use(express.static(distPath));

  app.use("*", (req, res, next) => {
    if (String(req.path).startsWith("/api")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
  
  return true;
}
