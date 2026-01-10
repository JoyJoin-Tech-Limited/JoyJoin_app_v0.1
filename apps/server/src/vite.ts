import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export async function setupVite(app: Express, server: Server) {
  if (process.env.NODE_ENV === "production") return;
  const vite = await import("vite");
  const viteConfigModule = await import("../../../vite.config.js");
  const viteConfig = viteConfigModule.default;
  const nanoidModule = await import("nanoid");
  const nanoid = nanoidModule.nanoid;
  
  const viteLogger = vite.createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const viteServer = await vite.createServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: { error?: Error | null }) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(viteServer.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "user-client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await viteServer.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      viteServer.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Returns true if static files were found and served, false if running as pure API
export function serveStatic(app: Express): boolean {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn("Static build directory not found. Running as pure API server.");
    return false;
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
  
  return true;
}
