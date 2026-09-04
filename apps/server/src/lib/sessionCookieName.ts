/**
 * Session cookie name for this deployment.
 *
 * Production sets COOKIE_DOMAIN to the apex domain (joyjoinapp.com), so a
 * browser that has ever logged into the production admin portal holds a
 * domain-wide `connect.sid` that it also sends to same-host staging vhosts
 * (staging.admin.joyjoinapp.com / staging.joyjoinapp.com). When staging
 * reused the same cookie name, requests arrived with two same-name cookies
 * (domain-scoped + host-only) and express-session could not restore the
 * session — staging admin logins returned 200 on POST /api/admin/login and
 * then 401 on GET /api/admin/me on every attempt (2026-09-03 incident).
 * Staging therefore uses a distinct name so the two cookie scopes can never
 * collide.
 *
 * Consumers: routes.ts (session middleware + X-Session-Token injection),
 * wsService.ts (WebSocket upgrade auth), adminAuth.ts and auth.ts (logout
 * clearCookie), devTools.ts (cookie diagnostics).
 */
export const SESSION_COOKIE_NAME =
  (process.env.APP_MODE ?? "production") === "staging" ? "connect.sid_stg" : "connect.sid";
