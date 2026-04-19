# JoyJoin Monorepo

This is the JoyJoin application monorepo, managed with **npm workspaces**.

## Repository structure

```
/
├── apps/
│   ├── user-client/     # React 18 + Vite PWA (user-facing, port 5001)
│   ├── admin-client/    # React 18 + Vite admin portal (port 5002, deployed to admin.yuejuapp.com)
│   └── server/          # Node.js + Express API server (recommended local port 5000 via PORT env)
├── packages/
│   └── shared/          # @joyjoin/shared — internal shared library
├── scripts/             # Repo-wide tooling scripts (guardrails, migration helpers)
├── docs/                # Architecture and feature documentation
├── deployment/          # Docker / Nginx deployment configs
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

## 5-Minute Quick Start (Minimum Requirements)

If you only want to boot the project locally as fast as possible (API + admin portal), follow these steps.

### Minimum requirements

- Node.js 20+
- npm 10+
- A reachable PostgreSQL database (local or hosted)

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env`

```bash
cp .env.example .env
```

Set at least these values in `.env`:

- `PORT=5000`
- `DATABASE_URL=postgresql://...`
- `SESSION_SECRET=<random-long-secret>`
- `ADMIN_CREATE_SECRET_KEY=<internal-cli-secret>`

### 3) Push schema (safe mode)

```bash
npm run db:push
```

If prompted with destructive options (`truncate`, `remove table/columns`, `data loss`), choose **No**.

### 4) Create your first admin account

```bash
npm run admin:create -- <username> <password> "$ADMIN_CREATE_SECRET_KEY" super_admin "Local Admin"
```

### 5) Start services in two terminals

Terminal A:

```bash
npm run dev:server
```

Terminal B:

```bash
npm run dev:admin
```

Open the admin URL printed by Vite (`Local:`), for example:

- `http://localhost:5002/admin/login`
- or `http://localhost:5007/admin/login` (if 5002 is occupied)

Log in with the admin credentials created in step 4.

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

Copy the template file and create your local environment file for the server and CLI tools:

```bash
cp .env.example .env
```

The repo-root `.env` is loaded by the API server and the bootstrap CLIs. For the split local setup in this README, start from these values in `.env`:

```bash
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000
DATABASE_URL=postgresql://<db-user>:<db-password>@<db-host>/<db-name>?sslmode=require
SESSION_SECRET=<replace-with-a-strong-random-secret>
WECHAT_APPID=<replace-with-wechat-app-id>
WECHAT_SECRET=<replace-with-wechat-secret>
ADMIN_CREATE_SECRET_KEY=<replace-with-internal-cli-secret>
COOKIE_DOMAIN=
```

Frontend Vite variables are different:

- `VITE_ADMIN_PORTAL_URL` should be set in `apps/user-client/.env.local` (or exported in the shell before `npm run dev:user`)
- `VITE_API_URL` is optional/advanced and should only be set in `apps/admin-client/.env.local`, `apps/user-client/.env.local`, or the shell for the app you are starting if you intentionally want a non-default API target

Example user-client override file:

```bash
echo 'VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin' >> apps/user-client/.env.local
```

Generate secure secrets with:

```bash
openssl rand -hex 32
```

The repo uses the following environment variables in active local and optional feature paths:

| Variable | Description | Required For |
|----------|-------------|--------------|
| `NODE_ENV` | Runtime mode; use `development` locally | Both |
| `PORT` | API server port; recommended local value is `5000`; defaults to `5001` when unset | Both |
| `APP_URL` | Base app URL used by some auth/payment flows | Both |
| `DATABASE_URL` | PostgreSQL connection string | Both |
| `SESSION_SECRET` | Express session secret; use a long random value | Both |
| `WECHAT_APPID` | WeChat Mini Program App ID | Both |
| `WECHAT_SECRET` | WeChat Mini Program secret | Both |
| `ADMIN_CREATE_SECRET_KEY` | Secret required by the admin/user bootstrap CLIs and local dev tools | Dev bootstrap tooling (admin + user seed/bypass) |
| `VITE_API_URL` | Optional: custom API base URL for frontend builds. See note below for usage guidance. | Both (optional advanced config) |
| `COOKIE_DOMAIN` | Cookie domain override; leave blank for localhost | Both (optional) |
| `VITE_ADMIN_PORTAL_URL` | Where the user app redirects admin links; set `http://localhost:5002/admin` locally in `apps/user-client/.env.local` or via shell export before starting Vite | User app only |
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

Template-only / legacy variables still present in `.env.example`:

- `JWT_SECRET`: retained in the template for deployment/ops compatibility and secret-rotation guidance, but not referenced by the current server codebase
- `CORS_ORIGINS`: retained in the template from older setup guidance, but not consumed by the current API server code for local CORS handling

`VITE_API_URL` guidance: leave it unset for normal local development so the Vite `/api` proxy keeps requests same-origin and points to `http://localhost:5000`. Only set it if you intentionally need a custom or cross-origin API target and have added API-side CORS support.

> This repo does **not** use an `ADMIN_API_KEY` for normal admin requests. Admin access is session-based after logging in at `/api/admin/login`. `ADMIN_CREATE_SECRET_KEY` is for CLI bootstrap and local dev tooling only.

### 4. Database setup

Push the Drizzle schema to your database:

```bash
npm run db:push
```

If your database already contains production-like data, **do not accept destructive prompts** in `db:push`:

- For prompts like `truncate table?` → choose **No, add the constraint without truncating**
- For prompts like `THIS ACTION WILL CAUSE DATA LOSS` → choose **No, abort**

For first-time local bootstrap on an existing database, prefer non-destructive setup first (create admin table / seed account), then plan schema cleanup separately.

Create the first admin account. This step is **mandatory** if you want to access the admin portal:

```bash
npm run admin:create -- <username> <password> <secretKey> [role] [displayName]
```

Parameter meaning:

- `username`: admin login username
- `password`: admin login password
- `secretKey`: must equal `.env` value `ADMIN_CREATE_SECRET_KEY` (this is CLI authorization key, not login password)
- `role` (optional): `super_admin` / `operator` / `viewer`
- `displayName` (optional): name shown in admin UI

Example:

```bash
npm run admin:create -- admin StrongPass123 "$ADMIN_CREATE_SECRET_KEY" super_admin "Local Admin"
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

Notes:

- Keep `dev:server` and `dev:admin` in separate terminals and keep both running.
- If `5000` is occupied, `dev:server` will fail with `EADDRINUSE`; stop old process before restarting.
- If `5002` is occupied, Vite will auto-pick the next port (`5003`, `5004`, ...). Always use the exact `Local:` URL shown in terminal.

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
3. If you also want admin links from the user app to stay local, set `VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin` in `apps/user-client/.env.local` (or export it before running `npm run dev:user`).
4. Create an admin account if you have not done so already:

```bash
npm run admin:create -- <username> <password> "$ADMIN_CREATE_SECRET_KEY"
```

5. Open the admin `Local:` URL printed in terminal (for example `http://localhost:5002/admin/login`, `http://localhost:5007/admin/login`, etc.).
6. Log in with the username and password created by `npm run admin:create`.
7. Expected result: you land on the admin `Local:` URL `/admin` route and can open admin-only screens such as user management, subscriptions, venues, and event pools.

### 6. Verification steps

Verify the local setup for both roles:

- **Regular user**
  1. Visit `http://localhost:5001`.
  2. Log in.
  3. Open `http://localhost:5001/profile`.
  4. Confirm your profile loads without a 401/500 error.

- **Admin**
  1. Visit the admin `Local:` URL printed by `npm run dev:admin` (for example `http://localhost:5002/admin/login`).
  2. Log in with the seeded admin credentials.
  3. Open `/admin/users` on the same host/port.
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
  - Fix:
    - for normal local development, keep API requests relative (for example, `/api/...`) so the admin app can use the Vite `/api` proxy instead of requiring browser CORS
    - if you changed `VITE_API_URL`, point it back to the local proxied path or remove the override, then restart the admin Vite process
    - if you intentionally need cross-origin requests, add CORS support on the API server first; `CORS_ORIGINS`-style settings alone currently have no effect

- **Admin dashboard shows “加载失败 / 无法加载数据”**
  - Symptom: login succeeds, but `/api/admin/stats` returns 500.
  - Fix: this usually means DB schema drift (missing columns in `users` table). Run non-destructive migration steps first and avoid destructive `db:push` options on existing data.

- **User app redirects admin links to production**
  - Symptom: clicking an admin link from the user app sends you to `https://admin.yuejuapp.com`.
  - Fix: set `VITE_ADMIN_PORTAL_URL=http://localhost:5002/admin` in `apps/user-client/.env.local` (or export it in the shell before `npm run dev:user`), then restart the user app.

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

## Documentation map

Start with these files in order when you are new to the repo or touching an unfamiliar area:

1. [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) — canonical engineering guardrails, active-flow rules, and monorepo quick start
2. [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md) — product canon, terminology, and active feature expectations
3. [`docs/README.md`](./docs/README.md) — topic index for architecture, onboarding, AI, observability, platform coordination, and design docs
4. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contributor workflow, validation checklist, skills, agents, and review expectations

## Further documentation

- [`DEVELOPER_QUICK_REFERENCE.md`](./DEVELOPER_QUICK_REFERENCE.md) — canonical developer guide
- [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md) — product canon and active terminology
- [`docs/README.md`](./docs/README.md) — docs index by audience and topic
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contributor workflow and validation checklist
- [`.github/skills/README.md`](./.github/skills/README.md) — reusable engineering/domain skills
- [`.github/agents/README.md`](./.github/agents/README.md) — focused custom agents for recurring workflows
- [`apps/server/src/README.md`](./apps/server/src/README.md) — server domain ownership and file placement
- [`packages/shared/src/README.md`](./packages/shared/src/README.md) — shared package boundary rules
