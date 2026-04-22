# JoyJoin Security & Performance Audit Report

**Date:** 2026-04-21
**Auditor:** Kimi Code CLI (manual audit)
**Scope:** Full stack — `apps/server`, `apps/user-client`, `apps/mini-program`, `apps/admin-client`, dependency tree

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 — Critical** | 3 | Active SQL injection, unauthenticated WebSocket, 61 npm audit vulnerabilities (7 critical) |
| **P1 — High** | 7 | Missing security middleware, weak bcrypt rounds, XSS vector, 435 console.log statements, in-memory rate limiter |
| **P2 — Medium** | 4 | Dead code (328 unused exports), large assets, DEV tool info leakage, sql.raw anti-pattern |
| **P3 — Low** | 2 | Verbose error messages, minor path traversal risk |

---

## P0 — CRITICAL (Fix Immediately)

### 1. SQL Injection in `saveMatchingResult` (`legacyStorageRepo.ts:3037`)

**File:** `apps/server/src/repositories/legacyStorageRepo.ts`
**Line:** 3037

```typescript
const userIdsLiteral = `ARRAY[${userIdsArray.map((id: string) => `'${id}'`).join(',')}]::text[]`;
// ...
${sql.raw(userIdsLiteral)},
```

**Risk:** User-controlled UUIDs are directly interpolated into SQL without parameterization. An attacker who controls `result.userIds` can inject arbitrary SQL.

**Fix:** Use parameterized arrays via Drizzle:
```typescript
import { arrayContains } from 'drizzle-orm';
// Or use sql`${sql.array(userIdsArray)}::text[]` if supported
// Or iterate and build a proper parameterized query
```

**Affected:** `matching_results.user_ids` insertion.

---

### 2. npm Audit — 61 Vulnerabilities (7 Critical, 25 High)

**Command:** `npm audit`
**Summary:**
```json
{ "critical": 7, "high": 25, "moderate": 27, "low": 2 }
```

**Most Critical:**

| Package | Severity | CVE / Advisory | Fix Status |
|---------|----------|----------------|------------|
| `drizzle-orm <0.45.2` | **HIGH** | GHSA-gpj5-g38j-94v9 — SQL injection via improperly escaped SQL identifiers | Fixable (`npm audit fix --force`) |
| `express ^4.21.2` | **HIGH** | Multiple vulnerabilities in 4.x range | Fixable |
| `@tarojs/components` | **CRITICAL** | Prototype pollution in swiper dependency | Fixable (semVer major) |
| `@tarojs/components-react` | **CRITICAL** | Prototype pollution | **NO FIX** available |
| `@tarojs/plugin-platform-h5` | **CRITICAL** | Unknown | **NO FIX** available |
| `@tarojs/plugin-platform-harmony-hybrid` | **CRITICAL** | Unknown | **NO FIX** available |
| `swiper` (via taro) | **CRITICAL** | Prototype pollution | Fixable |
| `lodash-es <=4.17.23` | **HIGH** | Multiple CVEs | Check for patch |
| `serialize-javascript <=7.0.4` | **HIGH** | XSS / arbitrary code execution | Check for patch |

**Recommendation:**
1. Run `npm audit fix` for all auto-fixable vulnerabilities.
2. For `drizzle-orm`, upgrade to `>=0.45.2` (note: may be breaking).
3. For `@tarojs/*` packages with no fix, evaluate if they are actively used in production builds or if they can be isolated.
4. Consider `npm audit --omit=dev` to separate runtime vs build-time risks.

---

### 3. WebSocket — Zero Authentication on Connection

**File:** `apps/server/src/wsService.ts`
**Lines:** 69–107 (connection handler)

```typescript
this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  console.log('[WS] New client connected');
  ws.isAlive = true;
  // ... no auth check ...
});
```

**Risk:** Anyone can open a WebSocket connection to `/ws`. Authentication only happens lazily when a `join` message is sent with a `userId` — but there is no validation that the `userId` belongs to the connecting client. An attacker can:
- Subscribe to any event's real-time updates
- Listen to icebreaker/king game state changes
- Potentially impersonate other users

**Fix:** Authenticate at connection time using the `req` object's session/cookies:
```typescript
this.wss.on('connection', async (ws, req) => {
  const session = await getSessionFromRequest(req); // or parse cookie
  if (!session?.userId) {
    ws.close(1008, 'Authentication required');
    return;
  }
  ws.userId = session.userId;
  // ...
});
```

---

## P1 — HIGH (Fix Within 1 Week)

### 4. Multiple `sql.raw()` Anti-Patterns in UPDATE Queries

**Files:**
- `apps/server/src/repositories/legacyStorageRepo.ts` (lines 1573, 1650, 1757, 1960, 2076, 2356, 2409)
- `apps/server/src/repositories/paymentsRepo.ts` (lines 122, 205, 354)

**Pattern:**
```typescript
const query = sql.raw(`UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`);
```

**Current Risk:** LOW for direct injection (column names are hardcoded), but HIGH for maintenance risk. If any future refactor makes `setClauses` dynamic based on user input, this becomes immediately injectable.

**Fix:** Use Drizzle's type-safe builder:
```typescript
await db.update(subscriptions)
  .set({ isActive: updates.isActive, autoRenew: updates.autoRenew })
  .where(eq(subscriptions.id, id))
  .returning();
```

---

### 5. Missing CORS Configuration

**Finding:** No `cors` middleware or configuration found in `apps/server/src/`.

**Risk:** Without explicit CORS configuration, the Express default behavior may allow cross-origin requests in some deployments, or block legitimate ones. More critically, API endpoints that rely on cookies/session may be vulnerable to CSRF if CORS is misconfigured.

**Fix:** Add explicit CORS middleware:
```typescript
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
```

---

### 6. Missing Security Headers (Helmet Not Installed)

**Finding:** `helmet` is not installed or used.

**Risk:** Missing protections against:
- XSS (`X-XSS-Protection`, `Content-Security-Policy`)
- Clickjacking (`X-Frame-Options`)
- MIME sniffing (`X-Content-Type-Options`)
- HTTPS enforcement (`Strict-Transport-Security`)

**Fix:**
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### 7. Weak Bcrypt Salt Rounds

**Files:** `apps/server/src/routes.ts:12037`, `apps/server/src/routes.ts:12135`, `apps/server/src/cli/createUserAccount.ts:117`

**Finding:** `bcrypt.hash(password, 10)` — 10 rounds is below OWASP's current recommendation of 12+.

**Note:** `createAdminAccount.ts:67` already uses 12 rounds. Apply consistently.

**Fix:** Change all `bcrypt.hash(password, 10)` to `bcrypt.hash(password, 12)`.

---

### 8. Potential XSS via `dangerouslySetInnerHTML` in `chart.tsx`

**File:** `apps/user-client/src/components/ui/chart.tsx`
**Line:** 81

```tsx
<style dangerouslySetInnerHTML={{
  __html: Object.entries(THEMES)
    .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] { ... }
`)
}} />
```

**Risk:** The `id` prop is interpolated directly into CSS selector syntax without escaping. If a parent component passes a malicious `id` like `foo"]{background-image:url("//evil.com")}/*`, it could inject arbitrary CSS (and potentially JS in older browsers).

**Fix:** Sanitize/escape the `id` before interpolation, or use CSS custom properties via React state instead of raw `<style>` injection.

---

### 9. 435 Console Statements in `routes.ts`

**File:** `apps/server/src/routes.ts`

**Finding:** 435 `console.log` / `console.error` / `console.warn` statements.

**Risk:**
- Sensitive data leakage (secret key lengths, user IDs, debug info)
- Performance overhead in high-throughput endpoints
- Log noise makes real incidents harder to detect

**Notable leaks:**
- Line 172–173: Logs whether `ADMIN_CREATE_SECRET_KEY` is configured and its length
- Line 12019, 12108, 12212: Logs whether secret key was provided in DEV endpoints
- Line 12270–12274: Logs detailed secret key comparison debug info

**Fix:** Replace with structured logger (e.g., `pino`) that supports log levels. Strip debug logs in production:
```typescript
const logger = process.env.NODE_ENV === 'production'
  ? pino({ level: 'warn' })
  : pino({ level: 'debug' });
```

---

### 10. In-Memory Rate Limiter (No Horizontal Scaling)

**File:** `apps/server/src/rateLimiter.ts`

**Finding:** Rate limits are stored in a `Map<string, RateLimitEntry>` in process memory.

**Risk:** In a multi-instance deployment (Kubernetes, multiple VMs), rate limits are per-process. A distributed attacker can bypass limits by hitting different instances.

**Fix:** Use Redis-backed rate limiting (e.g., `rate-limit-redis`) or move to API gateway-level rate limiting.

---

## P2 — MEDIUM (Fix Within 1 Month)

### 11. Dead Code — 328 Unused Exports

**user-client:** 235 modules with unused exports  
**mini-program:** 93 modules with unused exports

**Impact:** Increased bundle size, longer build times, confusion for developers.

**Fix:** Run `ts-unused-exports` as part of CI. Remove confirmed dead code. For shared components that are part of a design system, mark them with `// @ts-unused-exports keep` or export from an index file.

---

### 12. Large Static Assets

**Finding:** Multiple assets >500KB in both source and `dist` folders:

```
apps/mini-program/src/assets/empty-state/center-empty-illustration.png
apps/mini-program/src/assets/promo/banner-ai-match-*.png (×3)
apps/user-client/src/assets/xiaoyue_default.png
apps/user-client/src/assets/xiaoyue_thinking.png
apps/user-client/src/assets/generated_images/*.png (×3)
apps/user-client/dist/assets/dusk_skyline_fades_to_cozy_dinner-YdMqPXXW.mp4
```

**Impact:** Mini-program bundle size directly affects download time and WeChat's 2MB single-package limit. User-client images affect LCP (Largest Contentful Paint).

**Fix:**
- Convert PNGs to WebP/AVIF
- Run images through `squoosh` or `sharp`
- Lazy-load below-fold images
- Move video to CDN

---

### 13. DEV Endpoint Information Disclosure

**File:** `apps/server/src/routes.ts` (lines ~11988–12285)

**Finding:** Admin creation DEV endpoints and `/api/dev/check-secret` return verbose error messages:
- "Server has key: Yes/No"
- "Key length: X"
- "Provided key length: Y"
- "Match: true/false"

**Risk:** Information leakage aids brute-force attacks.

**Fix:** Return generic 403 for all secret key failures. Log details server-side only.

---

### 14. `sql.raw()` in Analytics (Low Risk but Pattern Issue)

**File:** `apps/server/src/analytics/registrationFunnelAnalytics.ts` (lines 328, 334, 379, 385)

```typescript
.where(sql`"${sql.raw(field)}" IS NOT NULL AND ...`)
```

**Current Risk:** LOW — `field` comes from hardcoded `L1_FIELDS` array, not user input.

**Fix:** Still worth refactoring to use Drizzle's column references for type safety.

---

## P3 — LOW (Nice to Have)

### 15. Path Traversal in Static File Serving

**File:** `apps/server/src/vite.ts`

**Finding:** `serveStatic()` uses `express.static(distPath)` and falls back to `res.sendFile(path.resolve(distPath, "index.html"))`.

**Risk:** LOW — `path.resolve` with a fixed `distPath` prevents traversal. The Vite dev server path also uses a fixed `clientTemplate`.

---

### 16. WeChat OAuth Redirect URI Construction

**File:** `apps/server/src/wechatAuth.ts`

**Finding:** Redirect URIs are constructed with string concatenation.

**Risk:** LOW — The `appUrl` comes from environment config, not user input. The `redirect_uri` parameter is `encodeURIComponent`-wrapped.

---

## Immediate Action Plan

| Priority | Task | Owner | Est. Time |
|----------|------|-------|-----------|
| **P0** | Fix `userIdsLiteral` SQL injection in `legacyStorageRepo.ts` | Backend | 1h |
| **P0** | Run `npm audit fix` and review remaining vulnerabilities | DevOps | 2h |
| **P0** | Add WebSocket connection-time authentication | Backend | 4h |
| **P1** | Replace `sql.raw()` UPDATE patterns with Drizzle builder | Backend | 4h |
| **P1** | Add CORS + Helmet middleware | Backend | 1h |
| **P1** | Upgrade bcrypt rounds to 12 | Backend | 30m |
| **P1** | Sanitize `chart.tsx` `id` prop | Frontend | 1h |
| **P1** | Replace console.log with structured logger in `routes.ts` | Backend | 4h |
| **P1** | Document/plan Redis-backed rate limiting | Backend | 2h |
| **P2** | Clean up unused exports in user-client & mini-program | Frontend | 4h |
| **P2** | Optimize static assets (WebP conversion, lazy loading) | Frontend | 3h |

---

## Appendix: Audit Commands Used

```bash
# SQL injection scan
grep -rn "sql\.raw" apps/server/src/ --include="*.ts" -B 2 -A 3

# npm audit
npm audit --json

# Dead code detection
npx ts-unused-exports apps/user-client/tsconfig.json
npx ts-unused-exports apps/mini-program/tsconfig.json

# Large assets
find apps/ -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.mp4" \) -size +500k

# Console statements
grep -cn "console\." apps/server/src/routes.ts

# Auth middleware review
grep -rn "requireAdmin\|requireOperator" apps/server/src/ -B 1 -A 8

# Secret key leakage
grep -rn "DEV_SECRET_KEY" apps/server/src/routes.ts -B 2 -A 3
```

---

*Report generated by Kimi Code CLI — manual audit (background agent swarm failed).*
