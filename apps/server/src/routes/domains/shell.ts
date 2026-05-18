/**
 * Shell Domain Router — Predictive Shell composite endpoints
 *
 * Why composite?
 *   Each tab currently makes multiple parallel round-trips. On 4G each
 *   round-trip costs 50–150 ms RTT, so the slowest request bounds perceived
 *   latency at 200–500 ms. Collapsing all data into a single payload removes
 *   RTTs and lets the mini-program prefetch the entire screen, cutting TTFB
 *   to ~50 ms on a warm cache.
 *
 * Architecture:
 *   - Route handler: HTTP concerns only (auth, headers, caching, metrics).
 *   - shellRepository.ts: all DB access, bulk queries, N+1-free.
 *   - ShellCache: shared singleton (apps/server/src/lib/shellCache.ts).
 *     Future Redis migration is a one-file change.
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { getDiscoverShellData, getProfileShellData, getEventsShellData, getConnectionsShellData } from "../../repositories/shellRepository";
import { shellCache } from "../../lib/shellCache";
import { logger } from "../../lib/logger";
import {
  DiscoverShellQuerySchema,
  type DiscoverShellResponse,
  type ProfileShellResponse,
  type EventsShellResponse,
  type ConnectionsShellResponse,
} from "@shared/api";

/** Exposed for test hygiene only. */
export function _clearShellCacheForTest(): void {
  shellCache.flushAll();
}

const CACHE_CONTROL_HEADER = "private, max-age=60, stale-while-revalidate=300";

export function registerShellRoutes(app: Express): void {
  app.get("/api/shell/discover", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      // Same 401 shape as /api/auth/user (REL-01)
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const queryParse = DiscoverShellQuerySchema.safeParse(req.query);
      const { cursor: rawCursor, limit: rawLimit } = queryParse.success ? queryParse.data : {};
      const limit = Number.isFinite(rawLimit) && rawLimit! > 0 ? rawLimit : undefined;

      const cacheKey = `shell-discover-${userId}-${rawCursor ?? "0"}-${limit ?? 20}`;
      let cacheHit = false;
      let payload: DiscoverShellResponse | undefined = shellCache.get(cacheKey);

      if (payload) {
        cacheHit = true;
      } else {
        const dbResult = await getDiscoverShellData({
          userId,
          cursor: rawCursor,
          limit,
        });

        payload = {
          user: dbResult.user,
          pools: dbResult.pools,
          myRegistrations: dbResult.myRegistrations,
          meta: dbResult.meta,
        };

        shellCache.set(cacheKey, payload);
      }

      const durationMs = Date.now() - startMs;

      // Observability: shell.discover metric with duration and cache hit (OBS-01)
      logger.info("shell.discover", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        cache_hit: cacheHit,
        pool_count: payload.pools.items.length,
        has_more: payload.pools.hasMore,
      });

      // Response time header (OBS-03)
      res.setHeader("X-Response-Time", `${durationMs}ms`);
      // Private cache — never store user-scoped data in shared caches (SEC-03)
      res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

      return res.json(payload);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("shell.discover failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      // REL-02: client will fall back to the 3-request pattern on 500.
      // We still return a consistent JSON error shape.
      return res.status(500).json({ message: "Failed to load Discover shell" });
    }
  });

  // ── Profile Predictive Shell ─────────────────────────────────────────────
  app.get("/api/shell/profile", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const cacheKey = `shell-profile-${userId}`;
      let cacheHit = false;
      let payload: ProfileShellResponse | undefined = shellCache.get(cacheKey);

      if (payload) {
        cacheHit = true;
      } else {
        const dbResult = await getProfileShellData({ userId });
        payload = dbResult;
        shellCache.set(cacheKey, payload);
      }

      const durationMs = Date.now() - startMs;

      logger.info("shell.profile", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        cache_hit: cacheHit,
      });

      res.setHeader("X-Response-Time", `${durationMs}ms`);
      res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

      return res.json(payload);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("shell.profile failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({ message: "Failed to load Profile shell" });
    }
  });

  // ── Events Predictive Shell ──────────────────────────────────────────────
  app.get("/api/shell/events", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const cacheKey = `shell-events-${userId}`;
      let cacheHit = false;
      let payload: EventsShellResponse | undefined = shellCache.get(cacheKey);

      if (payload) {
        cacheHit = true;
      } else {
        const dbResult = await getEventsShellData({ userId });
        payload = dbResult;
        shellCache.set(cacheKey, payload);
      }

      const durationMs = Date.now() - startMs;

      logger.info("shell.events", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        cache_hit: cacheHit,
        event_count: payload.joinedEvents.length,
      });

      res.setHeader("X-Response-Time", `${durationMs}ms`);
      res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

      return res.json(payload);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("shell.events failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({ message: "Failed to load Events shell" });
    }
  });

  // ── Connections Predictive Shell ─────────────────────────────────────────
  app.get("/api/shell/connections", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const cacheKey = `shell-connections-${userId}`;
      let cacheHit = false;
      let payload: ConnectionsShellResponse | undefined = shellCache.get(cacheKey);

      if (payload) {
        cacheHit = true;
      } else {
        const dbResult = await getConnectionsShellData({ userId });
        payload = dbResult;
        shellCache.set(cacheKey, payload);
      }

      const durationMs = Date.now() - startMs;

      logger.info("shell.connections", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        cache_hit: cacheHit,
        connection_count: payload.connections.length,
        pending_count: payload.pendingRequests.length,
      });

      res.setHeader("X-Response-Time", `${durationMs}ms`);
      res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

      return res.json(payload);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("shell.connections failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({ message: "Failed to load Connections shell" });
    }
  });
}
