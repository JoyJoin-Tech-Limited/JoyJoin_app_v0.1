# JoyJoin Development Tools - CLI and Browser Console

> **Status:** Local/developer tooling reference; last verified 2026-04-11 against `apps/server/src/auth/policy.ts`, `apps/server/src/cli/`, and `apps/user-client/src/App.tsx`.

## ⚠️ Security Warning

The auth/debug tooling posture has changed since this document was first written:

- Server auth/debug surfaces fail closed in production by default.
- Non-production auth/debug tooling requires explicit opt-in via `ENABLE_DEV_AUTH_TOOLS=1`.
- Production auth/debug overrides require `ALLOW_PRODUCTION_AUTH_DEBUG=1` and should only be used for short-lived, audited emergency sessions.
- Browser console dev tools load only in local dev builds when both `import.meta.env.DEV` and `VITE_ENABLE_DEV_TOOLS=1` are true.
- Privileged bootstrap CLIs still rely on `ADMIN_CREATE_SECRET_KEY` and should be treated as controlled operational tooling.

Never share the secret key publicly, and rotate it after any emergency or high-risk use.

---

## Overview

JoyJoin provides comprehensive development tools for rapid testing and account creation through:

1. **CLI Tools** - Command-line scripts for server-side operations
2. **Browser Console Functions** - Interactive JavaScript console commands
3. **API Endpoints** - REST APIs supporting both CLI and browser tools

These tools enable developers to:
- Quickly create admin and user accounts
- Bypass personality tests for testing
- Set up test data without going through the full onboarding flow
- Debug authentication and user flows

The source of truth for auth-adjacent gating is `apps/server/src/auth/policy.ts`.

---

## Prerequisites

### 1. Environment Setup

Add the secret key to your `.env` file:

```bash
# Development Tools Secret Key
ADMIN_CREATE_SECRET_KEY=$ADMIN_CREATE_SECRET_KEY
```

⚠️ **Important**: This key must be set for all tools to work. The tools will fail with a clear error if the key is missing.

### 2. Dependencies

All required dependencies are already installed:
- `bcrypt` - For password hashing
- `readline` - For CLI interactive prompts
- TypeScript/tsx - For running CLI scripts

---

## CLI Tools

### Installation

All CLI scripts are already configured in `package.json`. Run from the repository root:

```bash
# View available scripts
npm run

# The dev tools are:
npm run admin:create
npm run user:create
npm run user:bypass
```

---

### 1. Create Admin Account

**Command:**
```bash
npm run admin:create <phoneNumber> <password> <secretKey>
```

**Description:**
Creates an admin account with full access to the admin panel. If the phone number already exists, updates that user to be an admin.

**Features:**
- Bypasses personality test automatically
- Hashes password with bcrypt
- Updates existing users to admin
- Sets default archetype (气氛组柯基)

**Example:**
```bash
npm run admin:create +8613800138000 $ADMIN_PASSWORD $ADMIN_CREATE_SECRET_KEY
```

**Output:**
```
🔧 Creating admin account...
📞 Phone: +8613800138000
✅ Created new admin account

🎉 Success! Admin account ready:
   User ID: clm1234567890
   Phone: +8613800138000
   Login at: /admin/login
   Use phone + password to login
```

**Use Cases:**
- Set up admin accounts for testing
- Grant admin access to existing users
- Quickly create accounts for QA team

---

### 2. Create User Account (Interactive)

**Command:**
```bash
npm run user:create
```

**Description:**
Interactive CLI tool that walks you through creating a complete user account with all required profile data.

**Interactive Prompts:**

1. **Secret Key** - Verify authorization
2. **Phone Number** - 11 digits or +86 format
3. **Password** - Account password
4. **Display Name** - User's display name
5. **Archetype** - Select from 12 options (numbered menu)
6. **Gender** - Select from 3 options: 男性, 女性, 不透露
7. **City** - Select from 5 cities: 香港, 深圳, 广州, 北京, 上海
8. **Age** - Optional, press Enter to skip
9. **Industry** - Optional, press Enter to skip
10. **Interests** - Optional, comma-separated

**Features:**
- Fully interactive with numbered menus
- Validates all inputs
- Updates existing users if phone exists
- Bypasses personality test
- Shows comprehensive summary at end

**Example Session:**
```bash
$ npm run user:create

🔧 JoyJoin User Account Creator
================================

🔐 Enter secret key: $ADMIN_CREATE_SECRET_KEY
✅ Secret key verified

📞 Enter phone number (11 digits): 13900139000
🔑 Enter password: user123
👤 Enter display name: 测试用户

🎭 Select archetype:
  1. 气氛组柯基
  2. 情绪稳定鸡
  3. 捧场王仓鼠
  4. 探宝雷达狐
  5. 读空气海豚
  6. 社交裁缝蛛
  7. 情绪树洞考拉
  8. 脑洞喷泉章鱼
  9. 追问猫头鹰
  10. 定海神针大象
  11. 慢半拍龟
  12. 静音模式猫

Enter number: 1

⚧️ Select gender:
  1. 男性
  2. 女性
  3. 不透露

Enter number: 1

🌆 Select city:
  1. 香港
  2. 深圳
  3. 广州
  4. 北京
  5. 上海

Enter number: 2

🎂 Enter age (optional, press Enter to skip): 28
💼 Enter industry (optional, press Enter to skip): 科技
❤️ Enter interests (comma-separated, optional, press Enter to skip): 编程,旅游,美食

⏳ Creating user account...
✅ Created new user account

🎉 Success! User account ready:
================================
   User ID: clm9876543210
   Phone: +8613900139000
   Display Name: 测试用户
   Archetype: 气氛组柯基
   Gender: 男性
   City: 深圳
   Age: 28
   Industry: 科技
   Interests: 编程,旅游,美食

   Login at: /login
   Use phone + verification code (demo: 666666)
```

**Use Cases:**
- Create test users with complete profiles
- Set up users with specific archetypes for matching tests
- Populate database with sample users
- Test user flows without manual onboarding

---

### 3. Bypass Personality Test

**Command:**
```bash
npm run user:bypass <phoneNumber> <secretKey>
```

**Description:**
Bypasses the personality test requirement for an existing user. Sets a default archetype if the user doesn't have one.

**Features:**
- Works on existing users only
- Sets default archetype (气氛组柯基) if needed
- Marks personality test as complete

**Example:**
```bash
npm run user:bypass +8613900139000 $ADMIN_CREATE_SECRET_KEY
```

**Output:**
```
🔧 Bypassing personality test...
📞 Phone: +8613900139000

✅ Success! Personality test bypassed:
   User ID: clm9876543210
   Phone: +8613900139000
   Display Name: 测试用户
   Archetype: 气氛组柯基

   User can now access the app without completing the personality test
```

**Use Cases:**
- Skip personality test for existing test accounts
- Debug flows that require completed profiles
- Test post-onboarding features quickly

---

## Browser Console Functions

### Accessing Dev Tools

1. Open your browser's developer console (F12 or Cmd+Option+J)
2. The dev tools are automatically loaded as `window.dev`
3. Type `window.dev.help()` to see all available commands

**Console Message:**
```
🔧 Dev tools loaded! Type window.dev.help() for commands
```

---

### Available Functions

#### `window.dev.help()`

**Description:** Shows comprehensive help with all available commands and examples.

**Example:**
```javascript
window.dev.help()
```

**Output:**
```
🔧 JoyJoin Development Tools
============================

Available Commands:
------------------
window.dev.help()           - Show this help message
window.dev.archetypes()     - List all 12 archetypes
window.dev.createAdmin()    - Create admin account (interactive)
window.dev.createUser()     - Create user account (interactive)
window.dev.bypassTest()     - Bypass personality test for current user

...
```

---

#### `window.dev.archetypes()`

**Description:** Lists all 12 archetypes with their Chinese names.

**Example:**
```javascript
window.dev.archetypes()
```

**Output:**
```
🎭 JoyJoin 12 Archetypes:
========================

1. 气氛组柯基
2. 情绪稳定鸡
3. 捧场王仓鼠
4. 探宝雷达狐
5. 读空气海豚
6. 社交裁缝蛛
7. 情绪树洞考拉
8. 脑洞喷泉章鱼
9. 追问猫头鹰
10. 定海神针大象
11. 慢半拍龟
12. 静音模式猫

Use these names when creating accounts or selecting archetypes.
```

**Use Cases:**
- Quick reference for archetype names
- Copy names for account creation
- Learn the 12 personality types

---

#### `window.dev.createAdmin()`

**Description:** Interactive console function to create an admin account.

**Interactive Flow:**

1. Prompts for secret key
2. Prompts for phone number
3. Prompts for password
4. Creates admin account via API
5. Shows success message

**Example:**
```javascript
window.dev.createAdmin()
```

**Console Interaction:**
```
🔧 Create Admin Account
=====================

[Prompt] 🔐 Enter secret key:
> $ADMIN_CREATE_SECRET_KEY

[Prompt] 📞 Enter phone number (e.g., +8613800138000):
> +8613800138000

[Prompt] 🔑 Enter password:
> $ADMIN_PASSWORD

⏳ Creating admin account...

✅ Success! Admin account created:
   User ID: clm1234567890
   Phone: +8613800138000

   Login at: /admin/login
   Use phone + password to login
```

**Use Cases:**
- Create admin accounts from browser
- Test admin login flow
- Quick admin setup during development

---

#### `window.dev.createUser()`

**Description:** Interactive console function to create a user account with full profile.

**Interactive Flow:**

1. Prompts for secret key
2. Prompts for phone number
3. Prompts for password
4. Prompts for display name
5. Shows numbered archetype menu
6. Shows numbered gender menu
7. Shows numbered city menu
8. Prompts for optional age
9. Prompts for optional industry
10. Prompts for optional interests
11. Creates user via API
12. Shows success message

**Example:**
```javascript
window.dev.createUser()
```

**Console Interaction:**
```
🔧 Create User Account
====================

[Prompt] 🔐 Enter secret key:
> $ADMIN_CREATE_SECRET_KEY

[Prompt] 📞 Enter phone number (e.g., +8613900139000):
> +8613900139000

[Prompt] 🔑 Enter password:
> user123

[Prompt] 👤 Enter display name:
> 测试用户

🎭 Select archetype:
  1. 气氛组柯基
  2. 情绪稳定鸡
  3. 捧场王仓鼠
  4. 探宝雷达狐
  5. 读空气海豚
  6. 社交裁缝蛛
  7. 情绪树洞考拉
  8. 脑洞喷泉章鱼
  9. 追问猫头鹰
  10. 定海神针大象
  11. 慢半拍龟
  12. 静音模式猫

[Prompt] Enter number:
> 1

⚧️ Select gender:
  1. 男性
  2. 女性
  3. 不透露

[Prompt] Enter number:
> 1

🌆 Select city:
  1. 香港
  2. 深圳
  3. 广州
  4. 北京
  5. 上海

[Prompt] Enter number:
> 2

[Prompt] 🎂 Enter age (optional, press Cancel/ESC to skip):
> 28

[Prompt] 💼 Enter industry (optional, press Cancel/ESC to skip):
> 科技

[Prompt] ❤️ Enter interests (comma-separated, optional, press Cancel/ESC to skip):
> 编程,旅游,美食

⏳ Creating user account...

✅ Success! User account created:
   User ID: clm9876543210
   Phone: +8613900139000
   Display Name: 测试用户
   Archetype: 气氛组柯基

   Login at: /login
   Use phone + verification code (demo: 666666)
```

**Use Cases:**
- Create test users from browser console
- Quickly populate test data
- Test user flows without leaving browser
- Useful when server CLI isn't accessible

---

#### `window.dev.bypassTest()`

**Description:** Bypasses the personality test for the currently logged-in user.

**Interactive Flow:**

1. Prompts for secret key
2. Bypasses test via API
3. Automatically redirects to /discover

**Example:**
```javascript
window.dev.bypassTest()
```

**Console Interaction:**
```
🔧 Bypass Personality Test
========================

[Prompt] 🔐 Enter secret key:
> $ADMIN_CREATE_SECRET_KEY

⏳ Bypassing personality test...

✅ Success! Personality test bypassed
   Archetype: 气氛组柯基

   Redirecting to discover page...
```

**Use Cases:**
- Skip personality test during development
- Test post-onboarding flows quickly
- Debug user flows without completing test
- Speed up testing iterations

---

## API Endpoints

All tools use these internal API endpoints. They can also be called directly via curl or Postman.

### POST `/api/dev/admin/create`

**Description:** Creates or updates an admin account.

**Request Body:**
```json
{
  "phoneNumber": "+8613800138000",
  "password": "$ADMIN_PASSWORD",
  "secretKey": "$ADMIN_CREATE_SECRET_KEY"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Admin account created/updated successfully",
  "userId": "clm1234567890",
  "phoneNumber": "+8613800138000"
}
```

**Response (Error - Invalid Secret):**
```json
{
  "message": "Invalid secret key or ADMIN_CREATE_SECRET_KEY not configured"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5001/api/dev/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+8613800138000",
    "password": "$ADMIN_PASSWORD",
    "secretKey": "$ADMIN_CREATE_SECRET_KEY"
  }'
```

---

### POST `/api/dev/user/create`

**Description:** Creates or updates a user account with full profile.

**Request Body:**
```json
{
  "phoneNumber": "+8613900139000",
  "password": "user123",
  "secretKey": "$ADMIN_CREATE_SECRET_KEY",
  "displayName": "测试用户",
  "archetype": "气氛组柯基",
  "gender": "男性",
  "city": "深圳",
  "age": "28",
  "industry": "科技",
  "topInterests": "编程,旅游,美食"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User account created/updated successfully",
  "userId": "clm9876543210",
  "phoneNumber": "+8613900139000",
  "displayName": "测试用户",
  "archetype": "气氛组柯基"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5001/api/dev/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+8613900139000",
    "password": "user123",
    "secretKey": "$ADMIN_CREATE_SECRET_KEY",
    "displayName": "测试用户",
    "archetype": "气氛组柯基",
    "gender": "男性",
    "city": "深圳"
  }'
```

---

### POST `/api/dev/personality-test/bypass`

**Description:** Bypasses the personality test for the authenticated user.

**Authentication:** Requires active session (user must be logged in)

**Request Body:**
```json
{
  "secretKey": "$ADMIN_CREATE_SECRET_KEY"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Personality test bypassed successfully",
  "archetype": "气氛组柯基"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:5001/api/dev/personality-test/bypass \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "secretKey": "$ADMIN_CREATE_SECRET_KEY"
  }'
```

---

## Common Use Cases

### 1. Quick Admin Setup

**Scenario:** Need to access admin panel to test event management.

**Solution:**
```bash
# CLI method (fastest)
npm run admin:create +8613800138000 $ADMIN_PASSWORD $ADMIN_CREATE_SECRET_KEY

# Then login at /admin/login with phone + password
```

---

### 2. Create Multiple Test Users

**Scenario:** Need 5 users with different archetypes for matching algorithm testing.

**Solution:**
```bash
# Run interactive tool 5 times with different data
npm run user:create
# Select different archetypes each time

# Or write a bash script:
for i in {1..5}; do
  phone="+861380013800$i"
  npm run admin:create $phone "pass$i" $ADMIN_CREATE_SECRET_KEY
done
```

---

### 3. Test User Flow Without Onboarding

**Scenario:** Testing the discover page but don't want to complete personality test.

**Solution:**
```javascript
// In browser console after login
window.dev.bypassTest()
// Automatically redirects to /discover
```

---

### 4. Debug Authentication Issues

**Scenario:** Need to quickly create accounts to test login flow.

**Solution:**
```javascript
// In browser console
window.dev.createUser()
// Follow prompts, then test login with created credentials
```

---

### 5. Populate Test Database

**Scenario:** Need realistic test data with diverse profiles.

**Solution:**
```bash
# Use CLI interactive tool for controlled data
npm run user:create

# Enter varied data for each account:
# - Different archetypes
# - Different cities
# - Different ages/industries
# - Different interests
```

---

## Troubleshooting

## Troubleshooting Secret Key Issues

### Error: "Invalid secret key or ADMIN_CREATE_SECRET_KEY not configured"

**Steps to debug:**

1. Test the secret key:
   ```javascript
   window.dev.checkSecretKey()
   // Enter: $ADMIN_CREATE_SECRET_KEY
   ```

2. Check server environment:
   - Make sure `.env` file has: `ADMIN_CREATE_SECRET_KEY=$ADMIN_CREATE_SECRET_KEY`
   - Restart server after adding env variable
   - Check server logs for startup message about secret key

3. Verify exact match:
   - Secret key is case-sensitive
   - No extra spaces
   - Exact value: `$ADMIN_CREATE_SECRET_KEY`

4. For controlled staging or emergency production use:
  - Confirm whether the surface you need is actually allowed by `apps/server/src/auth/policy.ts`
  - Set only the minimum required override flags for the session
  - Rotate `ADMIN_CREATE_SECRET_KEY` after the session if exposure risk changed

---

### Error: "ADMIN_CREATE_SECRET_KEY not set in environment"

**Problem:** The secret key environment variable is missing.

**Solution:**
```bash
# Add to .env file
echo "ADMIN_CREATE_SECRET_KEY=$ADMIN_CREATE_SECRET_KEY" >> .env

# Restart the server
npm run dev
```

---

### Error: "Invalid secret key"

**Problem:** The secret key you entered doesn't match the one in `.env`.

**Solution:**
1. Check the `.env` file for the correct key
2. Copy the exact key (case-sensitive)
3. Try again with the correct key

---

### CLI Tool Not Found

**Problem:** `npm run admin:create` returns "script not found".

**Solution:**
```bash
# Verify scripts are in package.json
cat package.json | grep "admin:create"

# If missing, add to package.json scripts:
"admin:create": "node --env-file=.env --import tsx/esm apps/server/src/cli/createAdminAccount.ts"
```

---

### Browser Console Functions Not Available

**Problem:** `window.dev` is undefined.

**Solution:**
1. Check browser console for errors
2. Verify the app has loaded completely
3. Refresh the page and wait for the loading message:
   ```
   🔧 Dev tools loaded! Type window.dev.help() for commands
   ```
4. If still not working, check `apps/user-client/src/App.tsx` has the useEffect hook

---

### API Returns 403 Forbidden

**Problem:** API endpoint returns "Invalid secret key".

**Solution:**
1. Verify `.env` has `ADMIN_CREATE_SECRET_KEY`
2. Check that the server was restarted after adding the key
3. Ensure the secret key in request matches exactly
4. Check server logs for detailed error messages

---

### Phone Number Already Exists

**Problem:** CLI shows error "Phone number already exists".

**Solution:**
This is actually fine! The tools automatically update existing users:
- Admin creation will upgrade the user to admin
- User creation will update the user's profile
- No action needed - the operation succeeded

---

### Bypass Test Doesn't Redirect

**Problem:** `window.dev.bypassTest()` succeeds but doesn't redirect.

**Solution:**
1. Wait 1 second for the automatic redirect
2. If it doesn't redirect, manually navigate to `/discover`
3. Verify the test was bypassed by checking your profile
4. Check browser console for JavaScript errors

---

## Security Best Practices

### Development Environment

✅ **Safe Practices:**
- Store secret key in `.env` (not committed to git)
- Use strong passwords for test accounts
- Rotate the secret key periodically
- Use different secret keys for dev/staging/prod

❌ **Avoid:**
- Hardcoding the secret key in source code
- Sharing the secret key in chat/email
- Using the same secret key across environments
- Committing `.env` file to version control

---

### Production posture

⚠️ **Current source-of-truth behavior:**

1. Browser console tools are not registered in production builds because the client only loads them when `import.meta.env.DEV` and `VITE_ENABLE_DEV_TOOLS=1` are both true.
2. Auth-adjacent debug surfaces are governed by `apps/server/src/auth/policy.ts`:
  - Non-production: require `ENABLE_DEV_AUTH_TOOLS=1`
  - Production: require `ALLOW_PRODUCTION_AUTH_DEBUG=1` and should be audited/temporary
3. `createUserAccount` and `bypassLogin` explicitly enforce that production override policy.
4. Bootstrap scripts such as `admin:create` still depend on `ADMIN_CREATE_SECRET_KEY`; they should remain tightly controlled and should not be treated as routine production workflows.

✅ **Operational guidance:**

- Keep `ADMIN_CREATE_SECRET_KEY` unique per environment.
- Rotate the key after emergency debugging or privileged account bootstrap sessions.
- Treat any production override as an audited exception, not a normal path.

---

## Quick Reference Card

### CLI Commands
```bash
# Create admin
npm run admin:create <phone> <password> <secret>

# Create user (interactive)
npm run user:create

# Bypass test
npm run user:bypass <phone> <secret>
```

### Browser Console
```javascript
// Show help
window.dev.help()

// List archetypes
window.dev.archetypes()

// Create admin
window.dev.createAdmin()

// Create user
window.dev.createUser()

// Bypass test
window.dev.bypassTest()
```

### Secret Key
```
$ADMIN_CREATE_SECRET_KEY
```

### Demo Login Credentials
```
Phone verification code: 666666
```

---

## Implementation Details

### File Structure

```
apps/server/src/
├── cli/
│   ├── createAdminAccount.ts    # CLI admin creation
│   ├── createUserAccount.ts     # CLI user creation (interactive)
│   └── bypassLogin.ts           # CLI bypass test
├── routes.ts                    # API endpoints

apps/user-client/src/
├── utils/
│   └── devTools.ts              # Browser console functions
└── App.tsx                      # Dev tools initialization

docs/
└── CLI_TOOLS.md                 # This documentation

.env
└── ADMIN_CREATE_SECRET_KEY      # Secret key for authentication
```

### Technology Stack

**CLI Tools:**
- TypeScript with tsx
- Node.js readline for prompts
- bcrypt for password hashing
- Direct database access via storage layer

**Browser Tools:**
- TypeScript
- Browser native `prompt()` API
- Fetch API for HTTP requests
- Session-based authentication

**API Layer:**
- Express.js endpoints
- JSON request/response
- bcrypt password hashing
- Session authentication for bypass test

---

## Future Enhancements

### Planned Features

1. **Bulk User Creation**
   - CSV import for multiple users
   - Random profile generation
   - Archetype distribution control

2. **User Management**
   - Delete test accounts
   - Reset user progress
   - Clone user profiles

3. **Advanced Bypass Options**
   - Skip specific onboarding steps
   - Set custom completion states
   - Mock assessment results

4. **Audit Logging**
   - Log all dev tool operations
   - Track who created which accounts
   - Export audit reports

5. **GUI Admin Panel**
   - Web interface for dev tools
   - Visual account management
   - Batch operations

---

## Support

### Getting Help

1. **Check this documentation first**
2. **Use `window.dev.help()` for quick reference**
3. **Check server logs for API errors**
4. **Review the troubleshooting section**
5. **Contact the development team**

### Reporting Issues

When reporting issues, include:
- Command or function used
- Full error message
- Environment (dev/staging/prod)
- Steps to reproduce
- Server logs if applicable

---

## Changelog

### v1.0.0 (2026-02-12)
- Initial release
- CLI tools for admin/user creation
- Browser console interactive functions
- API endpoints with secret key authentication
- Comprehensive documentation
- Interactive prompts with numbered menus

---

## License

Internal development tools for JoyJoin. Not for public distribution.

---

**Last Updated:** 2026-02-12  
**Maintained By:** JoyJoin Development Team
