# JoyJoin Monorepo

This is the JoyJoin application monorepo, managed with **npm workspaces**.

## Repository structure

```
/
├── apps/
│   ├── user-client/     # React 18 + Vite PWA (user-facing, port 5001)
│   ├── admin-client/    # React 18 + Vite admin portal (port 5002, deployed to admin.yuejuapp.com)
│   └── server/          # Node.js + Express API server (default port 5001, configurable via PORT env)
├── packages/
│   └── shared/          # @joyjoin/shared — internal shared library
├── scripts/             # Repo-wide tooling scripts (guardrails, migration helpers)
├── docs/                # Architecture and feature documentation
├── deployment/          # Docker / Caddy deployment configs
├── tsconfig.base.json   # Shared TypeScript compiler options (extended by all workspaces)
└── tsconfig.json        # Solution-style TypeScript references file (root typecheck)
```

## Workspace purposes

| Workspace | Package name | Purpose |
|-----------|-------------|---------|
| `apps/user-client` | `@joyjoin/user-client` | User-facing React PWA |
| `apps/admin-client` | `@joyjoin/admin-client` | Internal admin portal |
| `apps/server` | `@joyjoin/server` | Express API, WebSocket, DB |
| `packages/shared` | `@joyjoin/shared` | Types, schemas, constants, domain logic shared across apps |

## Where shared code belongs

| Code type | Location |
|-----------|----------|
| Database schema (Drizzle) | `packages/shared/src/schema.ts` |
| WebSocket event contracts | `packages/shared/src/wsEvents.ts` |
| Personality / archetype engine | `packages/shared/src/personality/` |
| Shared constants and vocabularies | `packages/shared/src/constants.ts`, `districts.ts`, `occupations.ts`, etc. |
| UI primitives used by both clients | `packages/shared/src/ui/` |
| User-client-only components/hooks | `apps/user-client/src/` |
| Admin-client-only components/hooks | `apps/admin-client/src/` |
| API routes, services, DB queries | `apps/server/src/` |

**Import rule:** apps must import shared code via `@joyjoin/shared` (package name) or the `@shared/*` path alias. Direct imports from `shared/` (top-level legacy directory) are banned and enforced by the guardrails script.

## Environment Setup

### 1. Prerequisites

Install the following before you start:

- **Git** 2.40+
- **Node.js** 20+
- **npm** 10+
- **PostgreSQL** 15+ or a hosted PostgreSQL database such as Neon
- **WeChat Mini Program credentials** if you need the real WeChat login flow (`WECHAT_APPID`, `WECHAT_SECRET`)
- **Optional:** WeChat Pay merchant credentials if you need local payment testing
- **Optional:** DeepSeek / OpenAI keys if you need AI-powered features locally

Check your versions:

```bash
git --version
node --version
npm --version
```

### 2. Clone and install dependencies

Clone the repository and install all workspace dependencies from the repo root:

```bash
git clone https://github.com/JoyJoin-Tech-Limited/JoyJoin_app_v0.1.git
cd JoyJoin_app_v0.1
npm install
```

### 3. Environment variables configuration

Copy the template file and create your local environment file:

```bash
cp .env.example .env
```

For the split local setup in this README, start from these values in `.env`:

```bash
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000
DATABASE_URL=postgresql://<db-user>:<db-password>@<db-host>/<db-name>?sslmode=require
SESSION_SECRET=<replace-with-a-strong-random-secret>
JWT_SECRET=<replace-with-a-strong-random-secret>
WECHAT_APPID=<replace-with-wechat-app-id>
WECHAT_SECRET=<replace-with-wechat-secret>
ADMIN_CREATE_SECRET_KEY=<replace-with-internal-cli-secret>
VITE_API_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:5000,http://localhost:5001,http://localhost:5002
COOKIE_DOMAIN=
VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin
```

Generate secure secrets with:

```bash
openssl rand -hex 32
```

The repo uses the following environment variables in active local and optional feature paths:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `NODE_ENV` | Runtime mode; use `development` locally | Both |
| `PORT` | API server port; default local API port is `5000` | Both |
| `APP_URL` | Base app URL used by some auth/payment flows | Both |
| `DATABASE_URL` | PostgreSQL connection string | Both |
| `SESSION_SECRET` | Express session secret; use a long random value | Both |
| `JWT_SECRET` | JWT signing secret; use a long random value | Both |
| `WECHAT_APPID` | WeChat Mini Program App ID | Both |
| `WECHAT_SECRET` | WeChat Mini Program secret | Both |
| `ADMIN_CREATE_SECRET_KEY` | Secret required by the admin/user bootstrap CLIs and local dev tools | **Admin Only** |
| `VITE_API_URL` | API base URL used by the admin client and local Vite proxies | Both when running split frontend/backend locally |
| `CORS_ORIGINS` | Comma-separated allowed browser origins; include `5001` and `5002` for local user/admin clients | Both when running split frontend/backend locally |
| `COOKIE_DOMAIN` | Cookie domain override; leave blank for localhost | Both (optional) |
| `VITE_ADMIN_PORTAL_URL` | Where the user app redirects admin links; set `http://localhost:5002/admin` locally | User app only |
| `ENABLE_DEV_AUTH_TOOLS` | Enables non-production auth/debug helper routes | Both (optional local debugging) |
| `DEBUG_AUTH` | Enables extra auth logging in non-production | Both (optional local debugging) |
| `VITE_ENABLE_DEV_TOOLS` | Enables client-side dev tools in the user app when `import.meta.env.DEV` is true | User app only (optional) |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI-backed features | Both (optional AI features) |
| `OPENAI_API_KEY` | OpenAI API key used by the embedding client when present | Both (optional AI features) |
| `EMBEDDING_TIMEOUT_MS` | Embedding request timeout in milliseconds | Both (optional AI tuning) |
| `EMBEDDING_MAX_RETRIES` | Embedding request retry count | Both (optional AI tuning) |
| `ENABLE_SEMANTIC_SIMILARITY` | Enables the optional semantic matching dimension | Both (optional matching experiment) |
| `ENABLE_EVENT_THEME_TITLE_GENERATION` | Toggles AI-generated event theme titles | Both (optional AI feature) |
| `DEEPSEEK_TIMEOUT_MS` | Timeout for AI event-title requests in milliseconds | Both (optional AI tuning) |
| `AMAP_API_KEY` | Gaode Maps API key used by admin venue tooling | **Admin Only** (optional venue tooling) |
| `AMAP_SECURITY_KEY` | Gaode Maps security key used by admin venue tooling | **Admin Only** (optional venue tooling) |
| `PAYMENTS_ENABLED` | Set to `true` to enable WeChat Pay validation and routes | Both (optional payments) |
| `WECHAT_PAY_APP_ID` | WeChat Pay app ID | Both (payments only) |
| `WECHAT_PAY_MCH_ID` | WeChat Pay merchant ID | Both (payments only) |
| `WECHAT_PAY_SERIAL_NO` | WeChat Pay certificate serial number | Both (payments only) |
| `WECHAT_PAY_PRIVATE_KEY` | WeChat Pay private key (PEM) | Both (payments only) |
| `WECHAT_PAY_APIV3_KEY` | WeChat Pay API v3 key; must be exactly 32 bytes | Both (payments only) |
| `WECHAT_PAY_PLATFORM_CERT` | WeChat Pay platform certificate/public key PEM | Both (payments only) |
| `WECHAT_PAY_NOTIFY_URL` | Public payment webhook URL; if unset, the server falls back to `APP_URL` | Both (payments only) |

> This repo does **not** use an `ADMIN_API_KEY` for normal admin requests. Admin access is session-based after logging in at `/api/admin/login`. `ADMIN_CREATE_SECRET_KEY` is for CLI bootstrap and local dev tooling only.

### 4. Database setup

Push the Drizzle schema to your database:

```bash
npm run db:push
```

Create the first admin account. This step is **mandatory** if you want to access the admin portal:

```bash
npm run admin:create <username> <password> <secretKey> [role] [displayName]
```

Example:

```bash
npm run admin:create admin StrongPass123 "$ADMIN_CREATE_SECRET_KEY" super_admin "Local Admin"
```

You can optionally create test user data with the interactive CLI:

```bash
npm run user:create
```

You can also bypass the login flow for an existing phone number in local testing:

```bash
npm run user:bypass <phoneNumber> "$ADMIN_CREATE_SECRET_KEY"
```

### 5. Running the application

Start each process in its own terminal from the repo root:

```bash
npm run dev:server
npm run dev:user
npm run dev:admin
```

#### 5.1 Running as a regular user

1. Start the API server with `npm run dev:server`.
2. Start the user-facing app with `npm run dev:user`.
3. Open `http://localhost:5001`.
4. Sign in with the normal user flow.
   - In local non-production development, phone login uses the demo verification code `666666`.
   - If you need a fully prepared test user, run `npm run user:create` first.
5. Expected result: you can log in and use non-admin features such as discovery, onboarding, and the profile pages.

#### 5.2 Running as an admin

JoyJoin runs the admin experience as a **separate frontend app** plus the shared API server.

1. Start the API server with `npm run dev:server`.
2. Start the admin portal with `npm run dev:admin`.
3. Make sure `VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin` is set in `.env` if you also want admin links from the user app to stay local.
4. Create an admin account if you have not done so already:

```bash
npm run admin:create <username> <password> "$ADMIN_CREATE_SECRET_KEY"
```

5. Open `http://localhost:5002/admin/login`.
6. Log in with the username and password created by `npm run admin:create`.
7. Expected result: you land on `http://localhost:5002/admin` and can open admin-only screens such as user management, subscriptions, venues, and event pools.

### 6. Verification steps

Verify the local setup for both roles:

- **Regular user**
  1. Visit `http://localhost:5001`.
  2. Log in.
  3. Open `http://localhost:5001/profile`.
  4. Confirm your profile loads without a 401/500 error.

- **Admin**
  1. Visit `http://localhost:5002/admin/login`.
  2. Log in with the seeded admin credentials.
  3. Open `http://localhost:5002/admin/users`.
  4. Confirm the user list loads successfully.

### 7. Troubleshooting common issues

- **`ADMIN_CREATE_SECRET_KEY` not set**
  - Symptom: `npm run admin:create`, `npm run user:create`, or `npm run user:bypass` fails immediately.
  - Fix: add `ADMIN_CREATE_SECRET_KEY=<your-secret>` to `.env`, then rerun the command.

- **Database connection refused / schema push fails**
  - Symptom: `npm run db:push` or `npm run dev:server` cannot connect to PostgreSQL.
  - Fix: verify `DATABASE_URL`, start your local database or cloud database, then rerun `npm run db:push`.

- **Admin app cannot reach the API or keeps failing auth**
  - Symptom: the admin portal at `:5002` shows network/CORS/session issues.
  - Fix: set `VITE_API_URL=http://localhost:5000`, include `http://localhost:5002` in `CORS_ORIGINS`, and restart both the server and admin Vite process.

- **User app redirects admin links to production**
  - Symptom: clicking an admin link from the user app sends you to `https://admin.yuejuapp.com`.
  - Fix: set `VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin` in `.env`, then restart the user app.

## Validation commands

Run these from the repo root before pushing:

```bash
npm run guardrails  # env files, secrets, legacy identifiers, import boundary checks
npm run typecheck   # TypeScript across all workspaces
npm run lint        # lint all workspaces
npm run test        # run tests across all workspaces
npm run check       # guardrails + typecheck (combined)
npm run dep-check   # verify workspace dependency ownership (root must have no deps)
```

## Dependency ownership rules

- **Root `package.json`** is orchestration-only — it contains **no `dependencies` or `devDependencies`**.
- Each workspace owns its own runtime and dev dependencies.
- Packages shared across workspaces are deduplicated automatically by npm workspace hoisting.

Run `npm run dep-check` to verify ownership is correct.

## Cross-app import rules

- Apps **must not** import source files from other apps.
- Reusable logic must live in `packages/shared`.
- These rules are enforced by `npm run guardrails`.

## Adding new shared code

1. Add the file under `packages/shared/src/`.
2. Export it from `packages/shared/src/index.ts` or add a named subpath export in `packages/shared/package.json`.
3. Import in apps via `@joyjoin/shared` or `@shared/your-module`.

## CI/CD

The GitHub Actions pipeline (`.github/workflows/cicd.yml`) runs on push to `main`:

1. **Guardrails** — env files, secrets, legacy identifiers, import boundaries
2. **Typecheck** — TypeScript for user-client, admin-client, and server
3. **AI simulation test** — runs 100 AI simulation iterations
4. **Deploy** — SSH deployment with Docker Compose + schema push

## Further documentation

- [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) — canonical developer guide
- [`docs/`](./docs/) — architecture and feature documentation
- [`packages/shared/src/README.md`](./packages/shared/src/README.md) — shared package boundary rules
