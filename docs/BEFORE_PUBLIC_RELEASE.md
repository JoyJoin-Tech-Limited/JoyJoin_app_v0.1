# Security Checklist - Before Public Release

## 🚨 MANDATORY CHANGES

### 1. Remove Hardcoded Secrets

**Files to update:**
- [ ] `apps/server/src/routes.ts` - Remove hardcoded `BYPASSSECRET12345678`
- [ ] `apps/server/src/cli/createAdminAccount.ts` - Remove fallback secret
- [ ] `apps/server/src/cli/createUserAccount.ts` - Remove fallback secret
- [ ] `apps/server/src/cli/bypassLogin.ts` - Remove fallback secret

**Search for:**
```bash
grep -r "BYPASSSECRET12345678" .
grep -r "TODO: REMOVE BEFORE PUBLIC RELEASE" .
```

### 2. Add Production Restrictions

**Add to `apps/server/src/routes.ts`:**
```typescript
// Block dev endpoints in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/dev/*', (req, res) => {
    res.status(403).json({ error: 'Dev tools disabled in production' });
  });
}
```

### 3. Remove Browser Console Access

**Update `apps/user-client/src/App.tsx`:**
```typescript
// Only load dev tools in development
if (import.meta.env.DEV) {
  import('./utils/devTools').then(module => {
    (window as any).dev = module.devTools;
  });
}
```

### 4. Environment Variables

**Set in production:**
```bash
ADMIN_CREATE_SECRET_KEY=<generate-strong-random-secret>
NODE_ENV=production
```

**Generate strong secret:**
```bash
# Use a strong random generator
openssl rand -hex 32
# Or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Remove Hardcoded Secret from routes.ts

**Current code (TO BE REMOVED):**
```typescript
// TODO: REMOVE BEFORE PUBLIC RELEASE
const DEV_SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY || 'BYPASSSECRET12345678';

function verifySecretKey(secretKey: string) {
  const EXPECTED_SECRET = 'BYPASSSECRET12345678';
  // ...
}
```

**Replace with:**
```typescript
function verifySecretKey(secretKey: string): { valid: boolean; error?: string; hint?: string } {
  const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
  
  if (!expectedKey) {
    console.error('[DEV TOOLS] ADMIN_CREATE_SECRET_KEY not set in environment');
    return { 
      valid: false, 
      error: 'ADMIN_CREATE_SECRET_KEY not configured on server',
      hint: 'Contact system administrator to configure secret key'
    };
  }
  
  if (secretKey !== expectedKey) {
    console.error('[DEV TOOLS] Secret key mismatch');
    return { 
      valid: false, 
      error: 'Invalid secret key',
      hint: 'Contact system administrator for correct secret key'
    };
  }
  
  return { valid: true };
}
```

### 6. Update CLI Scripts

**Remove hardcoded fallback from all CLI scripts:**

```typescript
// REMOVE THIS:
const SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY || 'BYPASSSECRET12345678';

// REPLACE WITH:
const SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ Error: ADMIN_CREATE_SECRET_KEY not set in environment');
  process.exit(1);
}
```

### 7. Update Documentation

**Remove hardcoded secret references from:**
- [ ] `docs/CLI_TOOLS.md` - Remove security warnings about hardcoded secret
- [ ] `apps/user-client/src/utils/devTools.ts` - Remove hardcoded secret from help text

### 8. Add Rate Limiting (Recommended)

**Add rate limiting to dev endpoints:**
```typescript
import rateLimit from 'express-rate-limit';

const devToolsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/dev/*', devToolsLimiter);
```

### 9. Audit Logging (Recommended)

**Add audit logging for dev tool usage:**
```typescript
function logDevToolUsage(action: string, userId: string | undefined, metadata: any) {
  console.log('[DEV TOOLS AUDIT]', {
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'anonymous',
    ip: metadata.ip,
    userAgent: metadata.userAgent
  });
}
```

### 10. Disable Dev Tools in Production

**Add environment check at the top of dev endpoints:**
```typescript
// Block all dev endpoints in production
if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEV_TOOLS) {
  console.log('[DEV TOOLS] Dev tools disabled in production environment');
  app.use('/api/dev/*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  return; // Skip registering dev endpoints
}
```

---

## Verification Steps

### 1. Search for Hardcoded Secrets
```bash
cd /path/to/joyjoin
grep -r "BYPASSSECRET12345678" . --exclude-dir=node_modules
grep -r "TODO: REMOVE BEFORE PUBLIC RELEASE" . --exclude-dir=node_modules
```

**Expected result:** No matches (except in this checklist file)

### 2. Test Environment Variable Check
```bash
# Remove ADMIN_CREATE_SECRET_KEY from .env
# Attempt to use dev tools
# Should fail with "not configured" error
```

### 3. Test Production Mode
```bash
NODE_ENV=production npm start
# Attempt to access /api/dev/* endpoints
# Should return 403 or 404
```

### 4. Test Browser Console
```bash
# Open browser console in production build
# Type: window.dev
# Should be undefined
```

### 5. Verify CLI Scripts
```bash
# Remove ADMIN_CREATE_SECRET_KEY from .env
npm run admin:create test test test
# Should fail with "not set in environment" error
```

---

## Deployment Checklist

### Before Deployment
- [ ] All hardcoded secrets removed
- [ ] Environment variables properly configured
- [ ] Production restrictions added
- [ ] Browser console dev tools disabled in production
- [ ] CLI scripts require environment variable
- [ ] Rate limiting added (optional)
- [ ] Audit logging added (optional)
- [ ] Documentation updated

### After Deployment
- [ ] Verify dev endpoints return 403/404 in production
- [ ] Verify browser console has no `window.dev`
- [ ] Verify environment variable is set correctly
- [ ] Test that legitimate admin tools still work
- [ ] Monitor logs for any dev tool access attempts

---

## Emergency Response

If hardcoded secret is accidentally deployed to production:

1. **Immediate Actions:**
   - Rotate the secret immediately
   - Deploy fix to remove hardcoded secret
   - Review logs for unauthorized access
   - Invalidate any compromised sessions

2. **Investigation:**
   - Check who accessed dev tools using hardcoded secret
   - Review what actions were performed
   - Assess potential data breach

3. **Prevention:**
   - Add pre-commit hooks to detect hardcoded secrets
   - Implement code review process
   - Use secret scanning tools
   - Add automated tests for production restrictions

---

## Contact

For questions about this security checklist, contact:
- Security Team: security@joyjoin.com
- Development Lead: dev@joyjoin.com

---

**Last Updated:** 2026-02-17
**Status:** Active - Hardcoded secrets present in codebase
**Next Review:** Before production deployment
