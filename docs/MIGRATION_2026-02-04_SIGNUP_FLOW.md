# Migration Guide: Post-Test Signup Flow (2026-02-04)

> 📜 **HISTORICAL DOCUMENT — For Reference Only**
>
> This document describes the migration that introduced the anonymous-test-first, WeChat post-test signup flow (implemented 2026-02-04). The changes described here are **complete and in production**. This document is retained as a historical implementation record.
>
> For the **current active onboarding architecture**, refer to:
> - `docs/onboarding-flow.md` — full flow documentation
> - `DEVELOPER_QUICK_REFERENCE.md` — developer reference
> - `.github/copilot-instructions.md` → Onboarding Flow Architecture section

---

## What Changed

### Before (Old Flow)
```
Landing → Login/SMS → Personality Test → Onboarding → Discover
```

### After (New Flow - Option B)
```
Landing → Personality Test (Anonymous) → Login (WeChat) → Onboarding → Discover
```

---

## Breaking Changes

### For Developers

#### 1. Personality Test Is Now Public

**What changed:**
- Route `/personality-test` is now accessible without authentication
- Test results stored in localStorage until login
- Anonymous session ID managed client-side

**Impact:**
- `PersonalityTestPageV4` must handle both authenticated and unauthenticated states
- Test answers saved to `joyjoin_v4_presignup_answers` localStorage key

**Migration:**
```typescript
// Old: Test required authentication
if (!isAuthenticated) {
  redirect('/login');
}

// New: Test allowed without authentication
// No redirect needed - test is publicly accessible
```

---

#### 2. New WeChat Authentication Endpoint

**New endpoint added:**
```typescript
POST /api/auth/wechat/login-with-test
```

**Required environment variables:**
```bash
WECHAT_APPID=your_wechat_mini_program_appid
WECHAT_SECRET=your_wechat_mini_program_secret
```

**Request payload:**
```json
{
  "code": "string",              // WeChat login code
  "anonymousSessionId": "string", // UUID from localStorage
  "testAnswers": [               // Array of test answers
    {
      "questionId": "string",
      "selectedOption": "string",
      "traitScores": { "A": 5, "C": -3, ... }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "string",
    "hasCompletedPersonalityTest": true,
    "archetype": "气氛组柯基"
  }
}
```

---

#### 3. Database Schema Additions

**New fields in `users` table:**
```typescript
wechatOpenId: text("wechat_open_id").unique()
wechatSessionKey: text("wechat_session_key")
wechatNickname: text("wechat_nickname")
wechatAvatarUrl: text("wechat_avatar_url")
```

**Updated field:**
```typescript
phoneNumber: varchar("phone_number").unique()  // Now optional (not .notNull())
```

**Migration:**
Run `npm run db:push` to sync schema changes to database.

---

#### 4. Routing Changes

**Updated unauthenticated routes in `App.tsx`:**
```typescript
// Old: Redirect to onboarding
<Route path="/registration" component={DuolingoOnboardingPage} />

// New: Redirect to personality test
<Route path="/registration" component={PersonalityTestPageV4} />
```

**Landing page CTA updated:**
```typescript
// Old: Go to onboarding
setLocation('/onboarding');

// New: Go to personality test
setLocation('/personality-test');
```

---

#### 5. PersonalityTestResultPage Changes

**New features:**
- Detects if user is authenticated via `useAuth()`
- Shows WeChat login CTA for unauthenticated users after 3 seconds
- Calls `/api/auth/wechat/login-with-test` with stored test answers
- Clears localStorage after successful login

**Code added:**
```typescript
const { isAuthenticated } = useAuth();
const [showLoginCTA, setShowLoginCTA] = useState(false);

// Show login CTA after 3 seconds for unauthenticated users
useEffect(() => {
  if (!isAuthenticated && animationPhase === 'results') {
    const timer = setTimeout(() => setShowLoginCTA(true), 3000);
    return () => clearTimeout(timer);
  }
}, [isAuthenticated, animationPhase]);
```

---

### For Users

**No breaking changes** - existing users keep their data and flow unchanged.

---

## Deprecated Fields

The following fields are **NO LONGER** collected in onboarding:

| Field | Status | Notes |
|-------|--------|-------|
| `languagesComfort` | Moved to profile edit only | Can be set in `/profile/edit/personal` |
| `activityTimePreference` | Removed | Not used in matching algorithm |
| `socialFrequency` | Removed | Not used in matching algorithm |
| `groupSizeComfort` | Removed | Never collected, can be safely ignored |
| `hometownCountry` | Removed | Only `hometownRegionCity` used for matching |

**Database impact:**
- Fields are commented out in `schema.ts` but NOT dropped from database
- Existing data is preserved for backward compatibility
- Frontend UI no longer collects these fields

---

## Rollback Plan

If conversion rate drops or issues arise:

### 1. Revert Routing Changes (Quick - 5 min)

**File: `apps/user-client/src/App.tsx`**
```typescript
// Revert to old routing
<Route path="/registration" component={DuolingoOnboardingPage} />
```

**File: `apps/user-client/src/pages/LandingPage.tsx`**
```typescript
// Revert landing page CTA
setLocation('/onboarding');
```

### 2. Disable WeChat Login CTA (Quick - 2 min)

**File: `apps/user-client/src/pages/PersonalityTestResultPage.tsx`**
```typescript
// Force showLoginCTA to false
const [showLoginCTA, setShowLoginCTA] = useState(false);
// Comment out the useEffect that sets it to true
```

### 3. Require Login Before Test (Moderate - 10 min)

**File: `apps/user-client/src/App.tsx`**
```typescript
// Remove personality test from unauthenticated routes
if (!isAuthenticated) {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="*" component={LandingPage} />
    </Switch>
  );
}
```

### 4. Full Rollback (If needed - 30 min)

```bash
# Revert all code changes
git revert <commit-hash>

# Push revert commit
git push origin main

# Monitor metrics for 24 hours
```

---

## Metrics to Monitor

### Expected Improvements
- Landing → Test start: **70%** (was 40%)
- Test completion: **85%** (was 80%)
- Results → Login: **65%** (new metric, no baseline)
- Login → Essential data: **80%** (was 75%)
- **Overall conversion: 38%** (was 32%)

### Key Metrics Dashboard

Monitor these for 2 weeks post-launch:

| Metric | Before | Target | Current | Status |
|--------|--------|--------|---------|--------|
| Landing → Test | 40% | 70% | Not backfilled | 🟡 |
| Test completion | 80% | 85% | Not backfilled | 🟡 |
| Results → Login | N/A | 65% | Not backfilled | 🟡 |
| Overall conversion | 32% | 38% | Not backfilled | 🟡 |

**Action threshold:** If overall conversion drops below 30%, trigger rollback plan.

The original migration record was not backfilled with measured post-launch values; the `Current` column is preserved only as historical planning context.

---

## Testing Checklist

### Manual Testing
- [ ] Landing page → Personality test (no login required)
- [ ] Complete test anonymously
- [ ] See results without login
- [ ] Login CTA appears after 3 seconds
- [ ] Click WeChat login CTA (mock flow in dev)
- [ ] Test results linked to user account
- [ ] Essential data collection works
- [ ] Interest carousel works
- [ ] Discover page shows events

### Automated Testing
- [ ] Unit tests for WeChat auth endpoint
- [ ] Integration tests for anonymous test session
- [ ] E2E test for full signup flow

### Analytics Validation
- [ ] Track: Landing → Test start rate
- [ ] Track: Test completion rate
- [ ] Track: Results → Login rate
- [ ] Track: Overall funnel conversion
- [ ] Set up alerts for conversion drop

---

## Environment Variables

Add to `.env`:

```bash
# WeChat Mini Program Authentication (Required for production)
WECHAT_APPID=your_wechat_mini_program_appid
WECHAT_SECRET=your_wechat_mini_program_secret
```

**Development mode:**
- WeChat auth uses mock implementation
- Code is used as mock openid
- No actual WeChat API calls

**Production mode:**
- Replace mock with actual WeChat API call
- Endpoint: `https://api.weixin.qq.com/sns/jscode2session`
- See comments in `apps/server/src/routes.ts` for implementation details

---

## Timeline

### Phase 1: Backend (Week 1)
- [x] Add WeChat auth endpoint
- [x] Update database schema
- [x] Test with Postman/curl

### Phase 2: Frontend (Week 1-2)
- [x] Anonymous test session
- [x] Results page login CTA
- [x] Routing updates
- [x] Component cleanup

### Phase 3: Documentation (Week 2)
- [x] Update onboarding-flow.md
- [x] Update DEVELOPER_QUICK_REFERENCE.md
- [x] Create migration guide

### Phase 4: Launch (Week 2)
- [ ] Deploy to staging
- [ ] QA testing
- [ ] Deploy to production
- [ ] Monitor analytics

---

## Support & Troubleshooting

### Common Issues

**Issue:** "WeChat login fails"
- **Cause:** Missing environment variables
- **Fix:** Add `WECHAT_APPID` and `WECHAT_SECRET` to `.env`

**Issue:** "Test results not linked after login"
- **Cause:** localStorage cleared before login
- **Fix:** Ensure `joyjoin_v4_presignup_answers` persists until login success

**Issue:** "Login CTA doesn't appear"
- **Cause:** User is already authenticated
- **Fix:** Clear session cookies and retry in incognito mode

---

## References

- [Original Problem Statement](../problem-statement.md)
- [Onboarding Flow Documentation](./onboarding-flow.md)
- [Developer Quick Reference](../DEVELOPER_QUICK_REFERENCE.md)
- [Soul App Benchmark](https://www.soulapp.cn/) (60% signup rate)
- [16Personalities](https://www.16personalities.com/) (55% signup rate)

---

**Last Updated:** 2026-02-04  
**Author:** Engineering Team  
**Reviewers:** Product, QA, DevOps
