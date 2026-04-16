# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

JoyJoin is an npm workspaces monorepo with 4 apps and 1 shared package. See `README.md` for full structure and commands.

| Workspace | Port | Purpose |
|---|---|---|
| `apps/server` | 5000 | Express API + WebSocket server |
| `apps/user-client` | 5001 | User-facing React PWA (mobile-first) |
| `apps/admin-client` | 5002 | Admin portal React SPA |
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

### Known issues in current codebase

- `apps/user-client` has pre-existing TypeScript errors in `MatchingStatusPage.tsx` (null vs undefined type narrowing).
- One server test (`orchestrationKickoff.test.ts`) expects `.vscode/settings.json` which may not exist.
- The user client root page (`/`) may show a blank page due to a pre-existing runtime error in `DiscoverPage.tsx`; other routes like `/personality-test` render correctly.
