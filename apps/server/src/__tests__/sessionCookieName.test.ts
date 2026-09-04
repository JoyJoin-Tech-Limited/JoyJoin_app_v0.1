// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("session cookie name isolation (2026-09-03 staging admin login incident)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps connect.sid in production", async () => {
    vi.stubEnv("APP_MODE", "production");
    const { SESSION_COOKIE_NAME } = await import("../lib/sessionCookieName");
    expect(SESSION_COOKIE_NAME).toBe("connect.sid");
  });

  it("keeps connect.sid when APP_MODE is unset", async () => {
    vi.stubEnv("APP_MODE", undefined);
    const { SESSION_COOKIE_NAME } = await import("../lib/sessionCookieName");
    expect(SESSION_COOKIE_NAME).toBe("connect.sid");
  });

  it("uses connect.sid_stg under APP_MODE=staging", async () => {
    vi.stubEnv("APP_MODE", "staging");
    const { SESSION_COOKIE_NAME } = await import("../lib/sessionCookieName");
    expect(SESSION_COOKIE_NAME).toBe("connect.sid_stg");
  });

  it("session middleware, X-Session-Token injection, WebSocket auth, and both logouts all use SESSION_COOKIE_NAME", () => {
    // A hardcoded connect.sid anywhere in these paths re-introduces the
    // production-vs-staging cookie collision: express-session restored the
    // wrong (domain-scoped) cookie and every staging admin login 401'd on
    // GET /api/admin/me right after a 200 login.
    const routes = readRepoFile("apps/server/src/routes.ts");
    expect(routes).toContain("name: SESSION_COOKIE_NAME");
    expect(routes).not.toContain('req.headers.cookie = `connect.sid=');

    const wsService = readRepoFile("apps/server/src/wsService.ts");
    expect(wsService).toContain("cookies[SESSION_COOKIE_NAME]");

    const adminAuth = readRepoFile("apps/server/src/adminAuth.ts");
    expect(adminAuth).toContain("res.clearCookie(SESSION_COOKIE_NAME)");

    const auth = readRepoFile("apps/server/src/routes/domains/auth.ts");
    expect(auth).toContain("res.clearCookie(SESSION_COOKIE_NAME)");
  });
});
