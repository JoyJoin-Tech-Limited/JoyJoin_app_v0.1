# Tooling Gap Registry

> Canonical record of agent tooling gaps identified in `.github/orchestration.yaml` `tooling_assessment` sections, plus the MCP and integration servers currently wired in the repo.
> Last updated: 2026-04-22

---

## Currently Wired MCP Servers

| Server | Config | IDE | Purpose | Bound To Agents? |
|--------|--------|-----|---------|-----------------|
| **`context7`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | Library/framework docs (Taro, React, etc.) | ✅ Yes — bound to Taro Mini-Program Frontend Engineer, Taro Migration Specialist, Game Development Agent |
| **`hermes`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | External agent messaging/session bridge (Nous Hermes) | N/A — intentionally external; no JoyJoin agent uses it |
| **`agentMemory`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | IDE-side long-term recall (LanceDB-style store) | ✅ Yes — bound to Repo Memory Steward as complementary recall layer |
| **`github`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | GitHub PR status, CI checks, workflow reads | ✅ Yes — bound to Launch Readiness Agent, Principal SWE, QA Agent |
| **`playwright`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | Browser automation for e2e journey verification | ✅ Yes — bound to QA Agent |
| **`observability`** | `.mcp.json`, `.vscode/mcp.json` | Cursor, VS Code/Copilot | Health checks, readiness, metrics, synthetic probes | ✅ Yes — bound to Admin Operations Advisor |

**Configuration docs:** See `.github/AI_TOOLING_UNIFIED_BRAIN.md` §Context7 MCP, §Hermes Agent MCP, §Agent memory MCP.

---

## Active Tooling Gaps (by Agent)

### QA Agent — `partial` → `sufficient` (Playwright MCP + seed script wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| Browser / Playwright MCP for end-to-end journey verification | ✅ Closed | Wired `@executeautomation/playwright-mcp-server` as `playwright` MCP. E2E test suite in `packages/e2e/`. Agent prompt updated. |
| Stable test-environment metadata or seeded-data helpers | ✅ Closed | Created `apps/server/src/scripts/seed-test-data.ts` with known test users (`+8613800000001`, `+8613800000002`), test admin (`test_admin_seed`), and test event pool. Run via `npm run seed:test-data`. Agent prompt updated. |

**MCP:** `playwright` — `@executeautomation/playwright-mcp-server`

---

### Launch Readiness Agent — `partial` → `sufficient` (GitHub MCP + deployment health wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| GitHub status-check / workflow-read MCP | ✅ Closed | Wired `@modelcontextprotocol/server-github` as `github` MCP. Agent prompt updated. |
| Observability / deployment-surface read access | ✅ Closed | Extended `observability` MCP with `joyjoin_deployment_health` tool — comprehensive check across health, readiness, metrics, and auth endpoints. Supports environment labels (local/staging/production) via `JOYJOIN_API_URL`. Agent prompt updated. |

**MCP:** `github` — `@modelcontextprotocol/server-github`

---

### Admin Operations Advisor — `partial` → `sufficient` (Observability MCP + audit log API wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| Observability access (health, metrics, synthetic probes) | ✅ Closed | Wired custom `observability` MCP server (`packages/e2e/mcp-servers/observability.mjs`) with `joyjoin_health_check`, `joyjoin_readiness_check`, `joyjoin_metrics_query`, `joyjoin_synthetic_probe`. Agent prompt updated. |
| Read-only audit-log / admin-ops API integration | ✅ Closed | Added `admin_audit_logs` table to schema, `adminAuditLogsRepo` repository, and `GET /api/admin/audit-logs` endpoint. Extended `observability` MCP with `joyjoin_audit_logs_query` tool. `logAdminAudit` now dual-writes to stdout + DB. Agent prompt updated. |
| Live log/traces access (Loki/Grafana) | ⚠️ Open (Low) | No Loki/Grafana MCP. Requires running observability stack (`infra/docker-compose.observability.yml`). Not critical for local dev. |

**MCP:** `observability` — custom lightweight stdio server in `packages/e2e/mcp-servers/observability.mjs`

---

### Database Schema & Migration Auditor — `sufficient` (optional gap)

| Gap | Severity | Blocked On | Workaround Today |
|-----|----------|-----------|-----------------|
| No live database schema introspection | Low | No DB read-only MCP | Schema reviews are code-only from Drizzle definitions |

**Recommended path:** Optional. Current code-based schema review is sufficient. Add only if live drift analysis becomes a regular operational need.

---

### Mini-Program Parity Auditor — `sufficient` (screenshot parity wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| Screenshot / image-diff tooling | ✅ Closed | Created `packages/e2e/tests/parity-screenshots.spec.ts` with Playwright baseline capture for web + manual mini-program comparison checklist. Playwright MCP (`playwright`) can capture web baselines on demand. Agent prompt updated with tolerance rules. |

**MCP:** `playwright` — `@executeautomation/playwright-mcp-server`

---

### Taro Mini-Program Frontend Engineer — `sufficient` (screenshot parity wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| Visual-diff / screenshot capture | ✅ Closed | Playwright MCP + `packages/e2e/tests/parity-screenshots.spec.ts` provides web baseline capture. WeChat DevTools manual capture for mini-program side. |

**MCP:** `playwright` — `@executeautomation/playwright-mcp-server`

---

### Taro Migration Specialist — `sufficient` (screenshot parity wired 2026-04-22)

| Gap | Status | Resolution |
|-----|--------|-----------|
| Screenshot capture for source-vs-target comparison | ✅ Closed | Playwright MCP + parity screenshot spec provides web baseline capture. Mini-program comparison via WeChat DevTools. |

**MCP:** `playwright` — `@executeautomation/playwright-mcp-server`

---

## How to Close a Gap

1. **Identify the need** — Is this gap causing real delivery friction or quality issues?
2. **Choose the integration type** — MCP server (preferred for IDE-native tools) or direct HTTP/API call (preferred for repo-internal endpoints).
3. **Update configs** — Add to `.mcp.json` (Cursor) and `.vscode/mcp.json` (VS Code/Copilot) with secret-free paths.
4. **Bind to agents** — Update the agent's `.agent.md` prompt to instruct when and how to use the new tool/MCP.
5. **Update this runbook** — Mark the gap as closed and note the date.
6. **Update orchestration.yaml** — Move `tooling_assessment.status` from `partial` → `sufficient` and clear or update `recommended_extensions`.
7. **Update skill-authoring-governance** — If a skill now depends on the new MCP, document it in the skill's `SKILL.md` and `routing.yml`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Initial registry created. Context7 bound to 3 Taro agents. agentMemory bound to Repo Memory Steward. |
| 2026-04-22 | **Phase 1:** GitHub MCP wired (`@modelcontextprotocol/server-github`). Bound to Launch Readiness Agent, Principal SWE, QA Agent. |
| 2026-04-22 | **Phase 2:** Playwright MCP wired (`@executeautomation/playwright-mcp-server`). E2E workspace `packages/e2e/` created with 4 critical-path test suites. Bound to QA Agent. |
| 2026-04-22 | **Phase 3:** Observability MCP wired (custom `packages/e2e/mcp-servers/observability.mjs`). Bound to Admin Operations Advisor. |
| 2026-04-22 | **Remaining gaps closed:** Test seed script (`npm run seed:test-data`), admin audit-log DB table + `GET /api/admin/audit-logs` endpoint + `joyjoin_audit_logs_query` MCP tool, deployment health check (`joyjoin_deployment_health`), screenshot parity spec (`parity-screenshots.spec.ts`). All `partial` tooling assessments in orchestration.yaml now resolved. |
