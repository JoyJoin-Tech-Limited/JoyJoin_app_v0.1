# Test Mode Operations Guide

> How to set up and use JoyJoin's test mode for QA testing, both locally and on production.

---

## Overview

The test mode system has two independent concerns:

| Component | Local (`APP_MODE=test`) | Production |
|-----------|------------------------|------------|
| Test Admin API endpoints | Available (super_admin) | Available (super_admin only) |
| Local password login | Phone + password available | Not available |
| WeChat auth (mini-program) | Bypassed | Normal flow |
| Test database isolation | Separate `TEST_DATABASE_URL` | N/A |

---

## A. Local Test Mode (Developer)

### Prerequisites

- PostgreSQL running locally (Docker: `docker exec -it joyjoin-postgres ...`)
- `.env` configured (see below)

### Setup

**1. Environment variables**

Edit `apps/server/.env`:

```ini
# --- Test Mode ---
APP_MODE=test
TEST_DATABASE_URL=postgres://joyjoin:your_password@localhost:5432/joyjoin_test
```

**2. Create test database**

```bash
# With Docker:
docker exec -it joyjoin-postgres psql -U joyjoin -c "CREATE DATABASE joyjoin_test;"

# Or with local psql:
psql -h localhost -U joyjoin -c "CREATE DATABASE joyjoin_test;"
```

**3. Push schema**

```bash
npm run db:push
# When prompted about destructive changes, select "No" (don't drop tables).
```

**4. Seed test data**

```bash
npm run seed:test-data
```

Creates:

- **8 test users** — diverse profiles (genders, cities, archetypes, completion states)
- **1 test admin** — `test_admin_seed` / `TestAdmin123!` (super_admin)
- **1 test event pool** — "QA 测试饭局 — 周五夜聊" (Shenzhen, active)
- **Feature flags** — beta flags configured (see §C for list)

**5. Start the server**

```bash
npm run dev:server
# Expected: "Server running on port 5000 | app_mode: test"
```

### Test Users (Local)

| Phone | Nickname | Gender | City | Archetype | Completeness |
|-------|----------|--------|------|-----------|--------------|
| `+8613800000001` | 完整资料_小柯 | Female | Shenzhen | 开心柯基 | Complete |
| `+8613800000002` | 未完成_小阳 | Male | Hong Kong | 太阳鸡 | Incomplete |
| `+8613800000003` | 新用户_小新 | Prefer not | Guangzhou | — | Fresh |
| `+8613800000004` | 深聊_小考 | Female | Shenzhen | 树洞考拉 | Complete |
| `+8613800000005` | 效率_小象 | Male | Shenzhen | 靠谱大象 | Complete |
| `+8613800000006` | 创意_小章 | Female | Guangzhou | 脑洞章鱼 | Complete |
| `+8613800000007` | 社交_小海 | Male | Hong Kong | 机灵海豚 | Complete |
| `+8613800000008` | 探索_小阳二 | Female | Guangzhou | 太阳鸡 | Complete |

**Common password:** `$TEST_USER_PASSWORD` (set via `TEST_USER_PASSWORD` env var)

### Verify Setup

```bash
# Login via local auth
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+8613800000001","password":"$TEST_USER_PASSWORD"}'

# Check test status
curl http://localhost:5000/api/test/admin/status \
  -b "<session_cookie_from_above>"
```

---

## B. Production Test Admin (for QA/Operations)

### Endpoint Reference

All endpoints are gated by `requireSuperAdmin`. Call them with a super_admin session cookie.

| Method | Path | Description | Required Body |
|--------|------|-------------|---------------|
| GET | `/api/test/admin/status` | View test data counts | — |
| POST | `/api/test/admin/users` | Create a test user | `{ phone, password, displayName?, gender?, city?, archetype? }` |
| POST | `/api/test/admin/event-pools` | Create a test event pool | `{ title, createdBy, ... }` |
| POST | `/api/test/admin/registrations` | Register user to pool | `{ userId, poolId }` |
| POST | `/api/test/admin/reset` | Delete all test data | — |

### Usage Examples

```bash
# Login as super_admin:
curl -X POST https://joyjoinapp.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin_seed","password":"$TEST_ADMIN_PASSWORD"}' \
  -c cookies.txt

# Check test status:
curl https://joyjoinapp.com/api/test/admin/status -b cookies.txt

# Create a test user:
curl -X POST https://joyjoinapp.com/api/test/admin/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"phone":"+8613800000100","password":"$TEST_USER_PASSWORD","displayName":"QA_张三","gender":"男性","city":"深圳"}'

# Create an event pool (createdBy = some user ID from the response above):
curl -X POST https://joyjoinapp.com/api/test/admin/event-pools \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"QA 测试活动","createdBy":"<user-id>","city":"深圳","minGroupSize":4,"maxGroupSize":6}'

# Register user to pool:
curl -X POST https://joyjoinapp.com/api/test/admin/registrations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"userId":"<user-id>","poolId":"<pool-id>"}'

# Reset test data (deletes users with phone prefix +861380000):
curl -X POST https://joyjoinapp.com/api/test/admin/reset -b cookies.txt
```

### Reset Behavior

The reset endpoint deletes:

- **Users** whose phone number starts with `+861380000`
- **Event pools** whose title starts with `QA 测试`
- **Registrations** associated with those users
- **Admin account** `test_admin_seed`

After reset, re-run `npm run seed:test-data` locally to recreate.

### Security Notes

- Only `super_admin` can access these endpoints
- All operations are logged to `admin_audit_logs`
- The `/reset` endpoint is intentionally powerful — it does **NOT** require a confirmation param (designed for QA convenience). Use with care.

---

## C. Feature Flags (Seeded)

The seed script configures these feature flags:

| Key | Default | Purpose |
|-----|---------|---------|
| `personalityShareEnabled` | `true` | Personality share poster generation |
| `personalitySlotAnimationEnabled` | `true` | Slot machine reveal animation |
| `matchingLiveReveal` | `true` | Real-time matching results |
| `promoBannerEnabled` | `true` | Hero promo banner on Discover |
| `smartProfession` | `true` | AI profession classification |
| `restartOnboarding` | `false` | Allow returning users to restart onboarding |
| `onboardingForceSkip` | `false` | Skip onboarding entirely *(dangerous)* |
| `socialIcebreakerClientForceEnd` | `false` | Force-end icebreaker from client *(dangerous)* |
| `runPlanTemplatesEnabled` | `false` | Icebreaker run plan templates |
| `paymentsEnabled` | `false` | Payment features *(requires WeChat Pay config)* |

Adjust via the admin portal at `/admin/feature-flags` or via API as a super_admin:

```bash
curl -X PUT https://joyjoinapp.com/api/admin/feature-flags/paymentsEnabled \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"true"}'
```

---

## D. Mini-Program Experience Version (体验版)

### What Is It

WeChat's 体验版 (trial version) allows up to 100 whitelisted users to access your mini-program without going through review / launch. It connects to the **same server** as the production version — no separate backend needed.

### Setup Steps

**1.** Go to [微信公众平台](https://mp.weixin.qq.com/) → your mini-program

**2.** Add test users:
   - Menu: **管理 → 体验成员**
   - Click **"添加"** and enter the tester's WeChat ID
   - Max 100 users

**3.** Promote a build to 体验版:
   - Menu: **版本管理 → 开发版本**
   - Find the latest auto-uploaded build
   - Click **"选为体验版"**
   - Optionally set a 过期时间 (expiry)

### How Testers Access

- **QR code**: Scan the 体验版 QR code from the management console
- **Search**: Search the mini-program name in WeChat → tap the **"体验版"** badge
- **Direct link**: Share the mini-program path with `/体验版` parameter

### Auto-Upload Pipeline

Every push to `main` triggers `.github/workflows/taro-weapp-build.yml`:

1. Builds the mini-program (TypeScript → WeChat dist)
2. Uploads as **开发版** via `miniprogram-ci` (robot 1)
3. Version: `1.0.YYYYMMDD.HHMM`

The 体验版 assignment is **manual** — no CI step automatically sets it. A human picks which development version becomes the trial version.

### Test Users for Experience Version

For QA testers using the 体验版 on production:

- They sign in with **WeChat一键登录** (normal flow)
- To test specific scenarios, use the Test Admin API (as super_admin) to create users matching test requirements
- E.g., create a user with specific archetype, city, then ask the tester to sign in as that user (via dev-login / session manipulation)

> **Note:** The local password login (`POST /api/auth/login`) is **NOT available on production** — it is guarded by `APP_MODE=test`. Testers on 体验版 always use WeChat auth.

---

## E. Bulk Data Generation

### Local (via CLI)

```bash
# Generate 20 users + 3 event pools (default)
npm run seed:mock-data

# Generate 100 users + 5 pools
npm run seed:mock-data 100 5

# Generate 500 users + 10 pools (for load testing)
npm run seed:mock-data 500 10
```

Idempotent: already-existing users (same phone prefix `+861380000`) are skipped.

### Production (via Test Admin API)

Use the POST `/api/test/admin/users` and `/api/test/admin/event-pools` endpoints (see §B) to bulk-create on production. For large batches, call multiple times from a script.

---

## G. Staging Environment for 体验版 Test Pricing

JoyJoin supports a same-server staging API (`staging.joyjoinapp.com`) that lets the WeChat 体验版 charge ¥0.01 test prices without affecting production data or real pricing.

### How it works

- `APP_MODE=staging` keeps WeChat auth active (unlike `APP_MODE=test`, which switches to local phone+password and breaks 体验版 login).
- `TEST_PAYMENT_PRICE_IN_CENTS=1` overrides event registration, subscription, and event-pack prices to ¥0.01.
- The override is gated by `APP_MODE !== "production"`, so production always uses real prices.

### Server setup

See `deployment/README.md` §“同服务器 staging（体验版测试价）” for the full steps. Short version:

```bash
cd ~/JoyJoin/deployment
docker compose -f docker-compose.staging.yml up -d --build
# apply migrations manually; staging does not auto-run DDL
```

### Mini-program build

Set the staging origin before building:

```bash
# apps/mini-program/.env.local
TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com
```

```bash
npm run build:weapp --workspace=mini-program
```

Upload the result as a 体验版 and add these domains in the WeChat admin console:

- `https://staging.joyjoinapp.com`
- `wss://staging.joyjoinapp.com`

### Verifying test pricing

After logging into the 体验版, start any paid flow (event registration, subscription, event pack). The price should show ¥0.01 and create a real WeChat Pay order for ¥0.01. Webhook fulfillment still runs normally against the staging database.

---

## F. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Login fails: "user not found" | User doesn't exist in db | Run `npm run seed:test-data` |
| Test admin returns 404 | Not logged in as admin | Login first, check session cookie |
| Test admin returns 401 | Not super_admin | Use `test_admin_seed` account |
| Can't create test database | PostgreSQL not running | Start Docker container / local PG |
| db:push prompts to reset | Schema drift from prod | Select "No" — don't reset |
| Type check fails in CI | Missing env vars | Ensure `.env` file is present |
| Mini-program won't upload | Missing WECHAT_PRIVATE_KEY | Set in GitHub Actions secrets |
