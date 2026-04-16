# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

JoyJoin is an npm workspaces monorepo with 4 apps and 1 shared package. See `README.md` for full structure and commands.

| Workspace | Port | Purpose |
|---|---|---|
| `apps/server` | 5000 | Express API + WebSocket server |
| `apps/user-client` | 5001 | User-facing React PWA (mobile-first) |
| `apps/admin-client` | 5002 | Admin portal React SPA |
| `apps/mini-program` | 10086 (H5) | Taro 4 + React WeChat Mini Program |
| `packages/shared` | — | Shared types, schema, constants |

### Database (local PostgreSQL + neon wsproxy)

The server uses `@neondatabase/serverless` which requires a WebSocket proxy to connect to local PostgreSQL. A Docker container running `ghcr.io/neondatabase/wsproxy` must be running on port 5433:

```bash
# Start PostgreSQL (if not running)
sudo pg_ctlcluster 16 main start

# Start Docker daemon (if not running)
sudo dockerd &>/tmp/dockerd.log &

# Start the neon wsproxy container (if not running)
sudo docker run -d --name wsproxy -p 5433:80 \
  --add-host=host.docker.internal:host-gateway \
  -e ALLOW_ADDR_REGEX=".*" \
  ghcr.io/neondatabase/wsproxy:latest
```

The server and CLI tools must be started with the neon local config preload:

```bash
# Start server with neon local config
cd apps/server && node --env-file=../../.env --import ../../neon-local-config.mjs --import tsx/esm src/index.ts

# Run CLI tools (e.g., admin:create) with neon local config
cd apps/server && node --env-file=../../.env --import ../../neon-local-config.mjs --import tsx/esm src/cli/createAdminAccount.ts <args>
```

The `npm run dev:server` script does NOT include the neon preload, so you must start the server manually using the command above (or modify the script).

### Starting services

1. Ensure PostgreSQL is running: `pg_isready`
2. Ensure Docker/wsproxy is running: `sudo docker ps | grep wsproxy`
3. Start API server (in its own terminal with the neon preload command above)
4. Start user client: `npm run dev:user`
5. Start admin client: `npm run dev:admin`

### Dev auth and admin access

- **Phone login**: Use demo verification code `666666` in development mode.
- **Admin account creation** (requires neon preload):
  ```bash
  cd apps/server && node --env-file=../../.env --import ../../neon-local-config.mjs --import tsx/esm src/cli/createAdminAccount.ts <username> <password> "$ADMIN_CREATE_SECRET_KEY" super_admin "Display Name"
  ```
- Admin login at `http://localhost:5002/admin/login`

### Validation commands

See `README.md` § "Validation commands" for full list. Key commands:

- `npm run guardrails` — env files, secrets, import boundary checks
- `npm run typecheck` — TypeScript across all workspaces
- `npm run test` — tests across all workspaces (vitest for server)
- `npm run lint` — lint all workspaces (currently aliased to typecheck)

### WeChat Mini Program (`apps/mini-program`)

Built with Taro 4.1.11 + React. See `apps/mini-program/README.md` for the full reference.

**Build targets:**
- `npm run build:weapp -w mini-program` — WeChat weapp (output in `apps/mini-program/dist/`)
- `npm run build:h5 -w mini-program` — H5 web build
- `npm run dev:h5 -w mini-program` — H5 dev server on port 10086
- `npm run dev:weapp -w mini-program` — weapp watch mode (requires WeChat DevTools to preview)

**Typecheck:** `npm run typecheck -w mini-program`

**Tests:** `npx vitest run` from `apps/mini-program/` (no test script in package.json; vitest is hoisted). 13/17 test files pass; 4 failures are pre-existing (`@shared/api` alias not resolved by vitest, and api.test.ts assertion mismatches).

**WeChat DevTools:** The weapp target requires WeChat DevTools (macOS/Windows only) to preview the native mini-program. In headless Cloud Agent VMs, use `build:weapp` to verify the build succeeds and `dev:h5` for live browser preview of the H5 rendition.

**API base URL:** The mini-program resolves its API target from `TARO_APP_API_BASE_URL` > `API_URL` > `APP_URL` > `http://localhost:5001` (default). In local dev, the H5 mode connects to the user-client Vite proxy on 5001, which proxies `/api` to the server on 5000.

### Known issues in current codebase

- `apps/user-client` has pre-existing TypeScript errors in `MatchingStatusPage.tsx` (null vs undefined type narrowing).
- One server test (`orchestrationKickoff.test.ts`) expects `.vscode/settings.json` which may not exist.
- The user client root page (`/`) may show a blank page due to a pre-existing runtime error in `DiscoverPage.tsx`; other routes like `/personality-test` render correctly.
- Mini-program vitest: 3 payment-related test files fail due to unresolved `@shared/api` alias; `api.test.ts` has 2 assertion mismatches.
