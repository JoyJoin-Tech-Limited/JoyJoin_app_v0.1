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
    return false;
  }

  app.use(express.static(distPath));

  app.use("*", (req, res, next) => {
    if (String(req.path).startsWith("/api")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
  
  return true;
}
