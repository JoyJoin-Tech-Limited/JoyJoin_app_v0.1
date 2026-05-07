# JoyJoin MCP Server Configuration

> Model Context Protocol (MCP) servers extend AI assistants with external tools — database queries, browser automation, WeChat DevTools control, and more.
> This document covers the MCP servers configured for the JoyJoin monorepo.

---

## Quick Start

### Claude Code (`.mcp.json`)

Claude Code automatically loads `.mcp.json` from the project root. Environment variables are exported in `~/.zshrc` (auto-configured). Reload your shell:

```bash
source ~/.zshrc
```

Then restart Claude Code in the project directory.

### VS Code (`.vscode/mcp.json`)

VS Code MCP servers are configured in `.vscode/mcp.json`. The PostgreSQL server uses a launcher script that reads from `.env` automatically. For GitHub and Context7, VS Code will prompt for credentials on first use and store them securely.

---

## Server Catalog

### 1. `github` — GitHub Platform Integration
**Package:** `@modelcontextprotocol/server-github`

| Tool | JoyJoin Use Case |
|------|-----------------|
| `create_or_update_file` | Automated PRs for schema changes |
| `create_pull_request` | Open PRs from agent branches |
| `search_issues` | Triage bugs by label/milestone |
| `create_issue` | File bugs from agent findings |
| `list_commits` | Review recent changes before deploy |

**Setup:** Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo`, `workflow`, and `read:org` scopes.

---

### 2. `postgres` — PostgreSQL Database Access
**Package:** `.mcp.json` uses `@modelcontextprotocol/server-postgres`; VS Code uses `@1Levick3/postgresql-mcp-server`

| Tool | JoyJoin Use Case |
|------|-----------------|
| `query` / `execute_sql` | Inspect user/event/pool data during debugging |
| `describe_table` | Verify Drizzle schema matches DB state |
| `list_tables` | Explore schema for new developers |

**✅ Already Configured:** A read-only user `joyjoin_mcp_readonly` was automatically created for MCP access. The connection string is stored in `.env` as `MCP_DATABASE_URL`.

**⚠️ Security Warning:**
- The official Anthropic PostgreSQL server (v0.6.2) has known SQL injection vulnerabilities. **Never give it write access.**
- The MCP launcher (`scripts/mcp-launchers/postgres.sh`) automatically uses the read-only connection.
- If you need to recreate the read-only user:
  ```sql
  CREATE USER joyjoin_mcp_readonly WITH PASSWORD 'secure_password';
  GRANT CONNECT ON DATABASE neondb TO joyjoin_mcp_readonly;
  GRANT USAGE ON SCHEMA public TO joyjoin_mcp_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO joyjoin_mcp_readonly;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO joyjoin_mcp_readonly;
  ```

---

### 3. `playwright` — Browser Automation
**Package:** `@executeautomation/playwright-mcp-server`

| Tool | JoyJoin Use Case |
|------|-----------------|
| `navigate` | Test onboarding flows (`/onboarding/setup` → `/discover`) |
| `click_element` | Simulate CTA interactions |
| `fill_input` | Test form submissions (registration, payment) |
| `screenshot` | Visual regression checks |
| `get_page_content` | Verify DOM state after interactions |

**Tip:** For the official Microsoft Playwright MCP (`@modelcontextprotocol/server-playwright`), swap the package name. It uses accessibility trees instead of screenshots — faster and more deterministic.

---

### 4. `wechat-devtools` — WeChat Mini-Program Automation
**Package:** `wechat-dev-mcp`

| Tool | JoyJoin Use Case |
|------|-----------------|
| `launch` | Open `apps/mini-program` in WeChat DevTools |
| `navigate_to` | Jump to `/pages/index/index`, `/pages/discover/discover`, etc. |
| `get_page_data` | Inspect Taro page state |
| `tap_element` | Simulate taps on blind-box cards |
| `call_method` | Trigger mini-program methods |
| `evaluate` | Run JS in AppService context |

**Prerequisites:**
1. Install [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. Enable automation: **Settings → Security Settings → Service Port**
3. Update the CLI path in config if DevTools is not in the default macOS location:
   ```json
   {
     "env": {
       "WECHAT_DEVTOOLS_CLI_PATH": "/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
     }
   }
   ```
   **Windows:** `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`

**Workflow Example:**
```
> Launch the mini-program project at apps/mini-program
> Navigate to /pages/discover/discover
> Take a screenshot
> Tap the first event card
> Verify the page navigated to the detail page
```

---

### 5. `observability` — JoyJoin Custom Health & Metrics
**Source:** `packages/e2e/mcp-servers/observability.mjs` (project-local)

| Tool | JoyJoin Use Case |
|------|-----------------|
| `joyjoin_health_check` | `GET /api/health` |
| `joyjoin_readiness_check` | `GET /api/readyz` |
| `joyjoin_metrics_query` | `GET /api/metrics` (Prometheus format) |
| `joyjoin_synthetic_probe` | Run `scripts/synthetic/happy-path-probe.mjs` |
| `joyjoin_deployment_health` | Comprehensive multi-endpoint check |
| `joyjoin_audit_logs_query` | `GET /api/admin/audit-logs` |

**Env vars:**
```bash
JOYJOIN_API_URL=http://localhost:5000
JOYJOIN_ADMIN_USERNAME=admin
JOYJOIN_ADMIN_PASSWORD=...
PROBE_TIMEOUT_MS=5000
```

---

### 6. `context7` — Library Documentation Search
**Package:** `@upstash/context7-mcp`

Queries up-to-date documentation for libraries JoyJoin uses: React, Drizzle, Taro, Express, etc.

**Setup:** Get a free API key at [context7.com](https://context7.com/).

---

### 7. `sequential-thinking` — Multi-Step Reasoning
**Package:** `@modelcontextprotocol/server-sequential-thinking`

Enables the agent to think through complex tasks step-by-step — useful for:
- Architecture decisions (should this go in `shared/` or `server/`?)
- Refactoring plans across multiple workspaces
- Debugging multi-step matching algorithm issues

No setup required.

---

### 8. `filesystem` — Project File Operations
**Package:** `@modelcontextprotocol/server-filesystem`

Scoped to the project root. Allows the agent to:
- Read source files across workspaces
- Write new components or service files
- Search file contents
- List directory structures

**Note:** The path is set to `${PWD}` (Claude Code) or `${workspaceFolder}` (VS Code). Ensure this resolves to the repo root.

---

### 9. `agentMemory` — Persistent Agent Context
**Package:** `@adamrdrew/agent-memory-mcp`

Stores project-specific knowledge across sessions: coding conventions, past decisions, bug fixes.

**Data location:** `.joyjoin/agent-memory-db` (already gitignored)

---

### 10. `hermes` — Hermes MCP Bridge
**Command:** `hermes mcp serve`

Requires local Hermes installation. Used for advanced agent orchestration.

---

## Optional / Advanced Servers

These require additional setup and are not enabled by default.

### Grafana MCP (`grafana/mcp-grafana`)
Connects to your local Grafana instance (runs in Docker via `infra/docker-compose.observability.yml`).

**Docker setup:**
```bash
# Ensure Grafana is running
cd infra && docker-compose -f docker-compose.observability.yml up -d

# Create a service account token in Grafana UI: Administration → Service Accounts
export GRAFANA_URL="http://localhost:3000"
export GRAFANA_API_KEY="glsa_..."
```

Add to `.mcp.json`:
```json
{
  "grafana": {
    "command": "docker",
    "args": ["run", "-i", "--rm", "-e", "GRAFANA_URL=${GRAFANA_URL}", "-e", "GRAFANA_API_KEY=${GRAFANA_API_KEY}", "grafana/mcp-grafana"],
    "env": {}
  }
}
```

### Redis MCP (`redis/mcp-redis`)
If you migrate from `node-cache` to Redis for distributed caching.

**Install:** `pip install mcp-redis` (Python-based)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npx: command not found` | Ensure Node.js 20+ and npm 10+ are installed |
| `postgres: connection refused` | Verify PostgreSQL is running and `DATABASE_URL` is correct |
| `wechat-devtools: connection refused` | Open WeChat DevTools and enable **Service Port** in Security Settings |
| `playwright: browser not found` | Run `npx playwright install` to download browser binaries |
| `github: 401 Unauthorized` | Regenerate your GitHub PAT with correct scopes |
| VS Code prompts repeatedly | Credentials are stored in VS Code's SecretStorage; reload window if stuck |

---

## Team Onboarding Checklist

- [ ] Install Node.js 20+, npm 10+, WeChat DevTools (if working on mini-program)
- [ ] Generate GitHub PAT with `repo`, `workflow`, `read:org`
- [ ] Create PostgreSQL read-only user for MCP (do not use admin credentials)
- [ ] Set `DATABASE_URL` and `GITHUB_PERSONAL_ACCESS_TOKEN` env vars
- [ ] (Optional) Get Context7 API key
- [ ] (Optional) Start observability stack for `grafana` MCP
- [ ] Restart your AI client (Claude Code / VS Code) after config changes

---

## Security Notes

1. **Never commit credentials.** `.mcp.json` uses `${VAR}` interpolation; actual secrets live in your shell env or VS Code secure storage.
2. **Read-only DB access.** The PostgreSQL MCP server should only have `SELECT` privileges.
3. **Filesystem scoping.** The `filesystem` server is restricted to the project root — do not broaden this.
4. **Audit logs.** The `joyjoin_audit_logs_query` tool requires admin credentials — handle with care.

---

*Last updated: 2026-04-22*

---

## Agent & Skill Integration Map

> This section documents how MCP servers are wired into JoyJoin's native agent orchestration and skill system.

### Agent Integration

| Agent | MCP Server | Integration Point |
|-------|-----------|-------------------|
| **Backend Engineer** | `postgres` | Schema verification during route/repository design — query live DB tables, indexes, and row shapes before trusting `schema.ts` assumptions |
| **Database Schema & Migration Auditor** | `postgres` | Pre-migration live schema inspection — verify table structures, constraints, and row counts before planning migrations |
| **Expert React Frontend Engineer** | `playwright` | E2E journey validation — automate browser interaction, screenshots, and navigation flow checks on `apps/user-client` |
| **Taro Mini-Program Frontend Engineer** | `wechat-devtools` | Automated mini-program verification — launch DevTools, navigate pages, inspect WXML, and capture screenshots for pixel-precision validation |
| **Taro Mini-Program Frontend Engineer** | `context7` | Library docs lookup — verify Taro 4 APIs, WeChat `wx.*` APIs, and React 18 hooks behavior |
| **QA Agent** | `github` | CI reality check — cross-reference local test claims against actual GitHub Actions workflow runs and PR check statuses |
| **QA Agent** | `playwright` | Browser-based smoke tests — automate critical user journeys end-to-end |
| **QA Agent** | `observability` | Pre-approval health validation — run `/api/health`, `/api/readyz`, and synthetic probes before signing off |
| **Auto-Eval** | `github` | PR context enrichment — check CI status and mergeability when evaluating a branch |
| **Auto-Eval** | `observability` | Local API health validation — run synthetic probes as part of the quality gate |
| **Planner** | `sequential-thinking` | Complex plan decomposition — work through multi-domain dependencies, failure modes, and sequencing constraints step-by-step |
| **Launch Readiness Agent** | `github` | Release readiness — verify CI workflow status, PR review state, and mergeability |
| **Launch Readiness Agent** | `observability` | Pre-deploy health checks — run deployment health and synthetic probes against the target environment |
| **DevOps / SRE** | `observability` | Infrastructure validation — query health endpoints and metrics before and after infra changes |

### Skill Integration

| Skill | MCP Server | Integration Point |
|-------|-----------|-------------------|
| `server-domain-architecture` | `postgres` | Verify live DB schema matches code assumptions when adding routes or repositories |
| `database-migration-safety` | `postgres` | Inspect live schema (tables, columns, constraints, row counts) before writing migration scripts |
| `mini-program-frontend-excellence` | `wechat-devtools` | Mandatory pre-merge UI validation — launch, navigate, screenshot, and verify pixel precision |
| `testing-and-regression-guardrails` | `playwright`, `wechat-devtools` | MCP-assisted regression coverage for browser and mini-program journeys |
| `e2e-test-runner` | `playwright`, `wechat-devtools` | Ad-hoc E2E validation without writing full test scripts |
| `frontend-component-architecture` | `filesystem` | Cross-workspace component scaffolding — create files consistently across `packages/shared/` and client apps |
| `platform-observability-and-ops` | `observability` | On-demand health checks, metrics queries, and synthetic probes |
| `code-review` | `github`, `postgres`, `playwright` | Live CI status checks, schema alignment verification, and critical-path journey validation during review |

### Manifest Updates

9 agents updated from `toolingStatus: sufficient` → `enhanced` to reflect MCP capability additions:
- Backend Engineer, Database Schema & Migration Auditor, Expert React Frontend Engineer, Taro Mini-Program Frontend Engineer, QA Agent, Auto-Eval, Planner, Launch Readiness Agent, DevOps / SRE

---

*Last updated: 2026-04-22*

---

## Kimi Code Auto-Approval

Kimi Code does not support per-tool or per-MCP-server granular auto-approval (unlike Claude Code's `alwaysAllow` array). Approval is **all-or-nothing** via **YOLO mode**.

### How it works

| Mode | Behavior |
|------|----------|
| **Default** | Every file edit, shell command, and MCP tool call requires explicit confirmation |
| **YOLO mode** | All operations are auto-approved, including MCP tools |

### Enabling YOLO mode

**For a single session:**
```bash
# Toggle during runtime
/yolo
```

**At startup:**
```bash
kimi --yolo
```

**Permanently** (edit `~/.kimi/config.toml`):
```toml
default_yolo = true
```

> ⚠️ **Security warning:** YOLO mode skips ALL confirmations. MCP operations (database queries, browser automation, DevTools control, GitHub mutations) execute immediately. Only enable this in trusted local environments. Always review `git diff` before committing.

### Current state

Your `~/.kimi/mcp.json` now includes all 9 JoyJoin MCP servers:
- `context7`, `github`, `playwright`, `observability`, `postgres`, `wechat-devtools`, `sequential-thinking`, `filesystem`, `agentMemory`

If you enable YOLO mode, all of these will execute without prompting.

---

## Deep WeChat DevTools MCP Integration

### What's been added

1. **Agent workflow mandate:** `Taro Mini-Program Frontend Engineer` now has a **mandatory WeChat DevTools MCP checkpoint** in its delivery workflow. No UI work is complete without launching DevTools, navigating to the affected page, and capturing screenshots.

2. **Kimi Code config:** `wechat-devtools` is registered in `~/.kimi/mcp.json` so Kimi Code can directly control WeChat DevTools.

3. **Local verification script:** `scripts/mcp-launchers/weapp-verify.sh` provides a quick check that DevTools is running and prints the exact MCP commands to run.

4. **Pre-commit hook:** The pre-commit hook now includes an **opt-in reminder** (`MINI_PROGRAM_MCP_VERIFY=1`) that prompts you to run WeChat DevTools MCP verification when mini-program files are staged.

### Usage patterns

**Pattern 1: Quick page verification (AI prompt)**
```
Use the wechat-devtools MCP server to launch the mini-program,
navigate to /pages/discover/discover, and take a screenshot.
```

**Pattern 2: Full state validation (AI prompt)**
```
Launch the JoyJoin mini-program via wechat-devtools MCP,
navigate to the onboarding setup page, get the page data,
tap the submit button, and verify the page navigates to /onboarding/extended.
```

**Pattern 3: Pre-commit verification (terminal)**
```bash
# Enable the reminder
export MINI_PROGRAM_MCP_VERIFY=1

# Now commits will remind you to verify
scripts/mcp-launchers/weapp-verify.sh /pages/discover/discover
```

### CI limitation

WeChat DevTools MCP **cannot run in GitHub Actions** (Ubuntu runners don't support the WeChat DevTools GUI). The verification remains a **local pre-merge gate**. The `taro-weapp-build.yml` workflow continues to verify the build compiles; visual/behavioral validation happens via MCP before merge.

### Recommended workflow

1. Make mini-program changes
2. Build: `npm run build:weapp -w mini-program`
3. **MCP verify:** Prompt AI to use `wechat-devtools` MCP to navigate and screenshot
4. Fix any pixel-precision or interaction issues
5. Commit and push

---

*Last updated: 2026-04-22*
