# JoyJoin Automations System

AI-powered background automations that analyze code, find bugs, update documentation, and notify the team — similar to [Cursor Automations](https://cursor.com/automations), but triggered via GitHub Actions and WeCom (企业微信).

---

## Overview

| Automation | Schedule | Script | Workflow |
|------------|----------|--------|----------|
| **Auto-Debug** | Daily 04:00 UTC | `scripts/auto-debug.mjs` | `.github/workflows/auto-debug.yml` |
| **Auto-Docs** | Daily 05:00 UTC | `scripts/auto-docs.mjs` | `.github/workflows/auto-docs.yml` |
| **Auto-Digest** | Daily 06:00 UTC | `scripts/auto-digest.mjs` | `.github/workflows/auto-digest.yml` |
| **Auto-Test** | Daily 07:00 UTC | `scripts/auto-test.mjs` | `.github/workflows/auto-test.yml` |
| **Auto-CI-Fix** | On CI failure | `scripts/auto-ci-fix.mjs` | `.github/workflows/auto-ci-fix.yml` |
| **Auto-Prune** | Weekly Wed 01:00 UTC | `scripts/auto-prune.mjs` | `.github/workflows/auto-prune.yml` |
| **Auto-Triage** | PR/issue open + every 4h | `scripts/auto-triage.mjs` | `.github/workflows/auto-triage.yml` |
| **WeCom Trigger** | On demand | — | `.github/workflows/wecom-trigger.yml` |

Each automation:
1. Analyzes recent code changes
2. Applies heuristics / pattern matching
3. Opens a PR with findings (if anything actionable found)
4. Sends a WeCom group notification

---

## 1. Auto-Debug (Bug Finding)

**Goal:** Inspect recent commits for high-severity bugs that escaped review.

### What it checks

| Check | Severity | Description |
|-------|----------|-------------|
| Null dereference | HIGH | Property access on nullable values without guard |
| Missing await | HIGH | Promise-like call without `await` in async function |
| Unhandled promise | HIGH | `.then()` chain without `.catch()` |
| Empty catch block | HIGH | `catch(e) {}` silently swallows errors |
| Missing auth check | CRITICAL | Admin/payment route without auth middleware |
| SQL injection risk | CRITICAL | String interpolation in raw SQL queries |
| Side-effect in getter | HIGH | Getter performs mutation (should be idempotent) |
| Shared mutable state | HIGH | Module-level mutable variable in async context |
| Unclosed connection | HIGH | DB/client connection opened without guaranteed cleanup |

### Run locally

```bash
# Analyze last 10 commits
node scripts/auto-debug.mjs

# Analyze more commits
node scripts/auto-debug.mjs --commits 30

# Analyze a specific range
node scripts/auto-debug.mjs --range HEAD~5..HEAD

# Create PR + WeCom notification
WECOM_BOT_KEY=your-key GITHUB_TOKEN=your-token \
  node scripts/auto-debug.mjs --commits 20 --pr --wecom

# Verbose output
node scripts/auto-debug.mjs --verbose
```

### Output

- **No bugs found:** Logs `✅ No critical bugs found` — expected outcome most days
- **Bugs found (PR mode):** Creates PR with analysis report at `reports/auto-debug-*.md`
- **WeCom:** Sends formatted markdown message with severity breakdown

### Confidence bar

- Must describe a concrete trigger scenario — not theoretical
- If unsure, report in WeCom without opening PR
- No PR = no action needed (expected state most days)

---

## 2. Auto-Docs (Documentation)

**Goal:** Keep technical documentation current as the codebase evolves.

### What it checks

1. **Doc coverage by subsystem** — maps source directories to expected doc paths:
   - `apps/server/src/routes/` → `apps/server/src/routes/README.md`
   - `packages/shared/src/personality/` → `packages/shared/src/personality/README.md`
   - `apps/server/src/middleware/` → `apps/server/src/middleware/README.md`
   - _(full mapping in the script)_

2. **Canonical docs check** — verifies required root docs exist and are non-trivial
3. **JSDoc coverage** — flags barrel `index.ts` files where most exports lack JSDoc

### Run locally

```bash
# Analyze last 20 commits
node scripts/auto-docs.mjs

# Full codebase scan
node scripts/auto-docs.mjs --scan-all

# Create PR + WeCom
WECOM_BOT_KEY=your-key GITHUB_TOKEN=your-token \
  node scripts/auto-docs.mjs --commits 30 --pr --wecom

# Print checklist only
node scripts/auto-docs.mjs --checklist
```

### Generated docs

When auto-docs creates a README for a domain directory, it:
- Lists all `.ts` source files
- Extracts first-line descriptions from JSDoc comments
- Adds usage examples and cross-references

---

## 3. Auto-Digest (Daily Engineering Report)

**Goal:** Produce a concise, high-signal summary of what changed in the last 24 hours.

### How it works

1. Collects commits (last 24h) + merged PRs
2. Computes stats (top dirs, authors, file types)
3. Sends data to **DeepSeek Flash** for LLM clustering and summarization
4. Outputs a structured digest with:
   - **3-7 key bullets** covering the most important changes
   - **Watchlist** of 1-3 risks or pending follow-ups
   - Commit hash / PR number references
5. Falls back to template-based digest when LLM unavailable

### Run locally

```bash
# Last 24 hours
node scripts/auto-digest.mjs

# Custom window
node scripts/auto-digest.mjs --hours 48

# Since a specific date
node scripts/auto-digest.mjs --since "2026-04-28"

# With WeCom notification
GITHUB_TOKEN=ghp_xxx DEEPSEEK_API_KEY=sk-xxx \
  node scripts/auto-digest.mjs --wecom

npm run auto:digest
npm run auto:digest:wecom     # + WeCom notification
```

### Output example

```
## 📋 JoyJoin 工程日报 2026-04-30

**覆盖时段:** last 24h | **提交:** 23 | **PR:** 2 | **作者:** 4 | **变更文件:** ~900

### 关键变更
- [连接揭示功能上线] 为小程序匹配状态实现统一连接揭示 (bd0d6b99)
- [Icebreaker 系统大修] 新增 LLM 增强分析、自动化系统及 WeCom 集成 (b78c9541)
- [CI/CD 优化] Qulucas 完成 14 次 cicd.yml 迭代，稳定性增强

### Watchlist
- ⚠️ CI/CD 14 次快速迭代可能暗示部署不稳定
- ⚠️ 三个大提交（831 文件改动）合并时可能引入冲突
```

---

## 4. Auto-Prune (Weekly Cleanup)

**Goal:** Keep the repository clean — delete stale branches, old CI artifacts, expired repo-memory candidates, and old reports.

### What it cleans

| Target | Threshold | Description |
|--------|-----------|-------------|
| Local branches | >14 days | Merged-to-main branches with no recent activity |
| Remote branches | >14 days | Stale branches via GitHub API (merged PRs) |
| Workflow artifacts | >30 days | CI build artifacts from old workflow runs |
| Memory candidates | >14 days | Candidate files in `repo-memory/candidates/` already promoted |
| Old reports | >60 days | Expired report files in `reports/` (preserves digests, audits) |

### Run locally

```bash
# Dry run — preview only (safe, always start here)
node scripts/auto-prune.mjs
npm run auto:prune

# Live execution — actually deletes
node scripts/auto-prune.mjs --live
npm run auto:prune:live

# Live + WeCom notification
node scripts/auto-prune.mjs --live --wecom
npm run auto:prune:wecom

# Scope to specific targets
node scripts/auto-prune.mjs --branches --live
node scripts/auto-prune.mjs --artifacts --live
```

### Safety

- Never deletes `main` or `feat/mini-program-foundation` branches
- Requires explicit `--live` flag for any deletions
- Dry run is the default — reports what would be deleted without acting
- WeCom report shows deleted items by category

---

## 5. Auto-Triage (Automatic Labeler)

**Goal:** Automatically label PRs and issues so nothing falls through the cracks.

### What it labels

**Area labels** (from changed file paths):
- `area:server` — `apps/server/` changes
- `area:mini-program` — `apps/mini-program/` changes
- `area:web` — `apps/user-client/` or web changes
- `area:admin` — `apps/admin-client/` changes
- `area:shared` — `packages/shared/` changes
- `area:docs` — `docs/` or `.md` changes
- `area:ci` — `.github/`, `scripts/`, Docker/CI files
- `area:automations` — `repo-memory/` changes

**Type labels** (from title/body keywords):
- `bug` — fix, regression, broke
- `enhancement` — feat, add, new, implement
- `documentation` — docs, readme
- `refactor` — refactor, clean, reorganize
- `test` — test, spec
- `dependencies` — deps, bump, upgrade
- `performance` — perf, speed, optimize
- `security` — security, vulnerability

**Annotation labels** (from specific file patterns):
- `migration`, `payments`, `admin-audit`, `personality`, `icebreaker`, `onboarding`, `matching`

### Run locally

```bash
# Scan all open PRs and issues
node scripts/auto-triage.mjs
npm run auto:triage

# Dry run — preview without applying
node scripts/auto-triage.mjs --dry-run
npm run auto:triage:dry

# Only PRs or only issues
node scripts/auto-triage.mjs --prs
node scripts/auto-triage.mjs --issues

# Scan one specific PR/issue
node scripts/auto-triage.mjs --number 42 --type pr

# With WeCom notification
node scripts/auto-triage.mjs --wecom
npm run auto:triage:wecom
```

### Triggers

- **On PR open:** Auto-labels immediately when a new PR is created
- **On issue open:** Auto-labels immediately when a new issue is created
- **Every 4 hours:** Batch scan to catch any missed items
- **On demand:** Via `workflow_dispatch` or WeCom trigger

### Labels created automatically

Auto-triage creates missing labels on first run. Label colors follow JoyJoin conventions and GitHub defaults.

---

## 6. WeCom Integration

### Setup

1. **Create a WeCom group bot:**
   - Open your WeCom group chat → `...` → Group Bot → Add
   - Copy the webhook URL (looks like `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx`)
   - The `key` query parameter is your `WECOM_BOT_KEY`

2. **Add to GitHub Secrets:**
   - `WECOM_BOT_KEY` — the key from the bot webhook URL
   - `AUTO_DEBUG_TOKEN` — GitHub PAT with `contents:write` and `pull-requests:write`

3. **Test the connection:**
   ```bash
   WECOM_BOT_KEY=your-key node scripts/wecom-notify.mjs --markdown "## 🚀 Test\nAutomation system online."
   ```

### Notification format

Auto-Debug sends:
```
## 🔴 Auto-Debug 发现 Bug

**扫描范围:** 最近 20 个提交
**发现:** 3 个 (严重: 2)

**关键发现:**
- [CRITICAL] `apps/server/src/routes/admin.ts:45` — Route handler does not check authentication
- [HIGH] `apps/server/src/services/payment.ts:120` — Missing await in async function
```

Auto-Docs sends:
```
## 📚 Auto-Docs 文档更新报告

**扫描范围:** 最近 30 个提交
**发现文档缺口:** 2 个

**需要补充的文档:**
- [❌] `apps/server/src/repositories/README.md` — Database Repositories
- [⚠️] `packages/shared/src/personality/README.md` — Personality Engine
```

### Triggering automations from WeCom

Using the **WeCom Automation Trigger** workflow (`.github/workflows/wecom-trigger.yml`):

**Option A: GitHub CLI**
```bash
# Trigger auto-debug
gh workflow run wecom-trigger.yml -f action=auto-debug -f commits=20

# Trigger auto-docs with full scan
gh workflow run wecom-trigger.yml -f action=auto-docs -f scan_all=true
```

**Option B: GitHub API (for automated relay)**
```bash
curl -X POST https://api.github.com/repos/<owner>/<repo>/actions/workflows/wecom-trigger.yml/dispatches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main","inputs":{"action":"auto-debug"}}'
```

**Option C: Direct workflow dispatch**
Each workflow (`auto-debug.yml`, `auto-docs.yml`) supports `workflow_dispatch` directly from the GitHub Actions UI.

### Full webhook relay (WeCom → GitHub)

For a fully automated flow where a WeCom bot message triggers the right automation:

1. Deploy a lightweight relay (e.g. Cloudflare Worker, Vercel function)
2. The relay receives WeCom webhook → parses the message → calls GitHub API
3. See `scripts/auto-debug.mjs` for the API call pattern

Example Cloudflare Worker skeleton:

```js
// WeCom → GitHub Actions relay
export default {
  async fetch(request) {
    const body = await request.json();
    const action = parseWeComMessage(body);  // "auto-debug" or "auto-docs"

    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/wecom-trigger.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { action, commits: '20' },
        }),
      }
    );

    return new Response('OK');
  }
};
```

---

## 7. Utility Scripts

### `scripts/wecom-notify.mjs`

Send WeCom messages from command line or scripts.

```bash
# Text message
node scripts/wecom-notify.mjs --text "Build failed: check logs"

# Markdown message
node scripts/wecom-notify.mjs --markdown "# Report\n- Item 1\n- Item 2"

# From stdin
echo "# Automated report" | node scripts/wecom-notify.mjs
```

Environment: `WECOM_BOT_KEY` (required), `WECOM_BOT_TIMEOUT_MS` (optional, default 10000)

Exit codes: 0 = sent, 1 = config error, 2 = API error

---

## 8. Adding New Automations

To add a new automation:

1. **Create the analysis script** at `scripts/auto-<name>.mjs`
   - Accept `--pr`, `--wecom`, `--range`, `--commits`, `--verbose` flags
   - Exit 0 = no issues, 1 = issues found, 2 = error
   - Use `process.env.GITHUB_TOKEN`, `GITHUB_REPOSITORY` for PR creation

2. **Create the workflow** at `.github/workflows/auto-<name>.yml`
   - Schedule + `workflow_dispatch` triggers
   - `contents: write` + `pull-requests: write` permissions
   - Pass `GITHUB_TOKEN` and `WECOM_BOT_KEY` to the script

3. **Add to WeCom trigger** — update `.github/workflows/wecom-trigger.yml`
   - Add the new action option to the `action` input dropdown
   - Add a dispatch step for the new action

4. **Register in this docs** — update this README

---

## Security Notes

- `WECOM_BOT_KEY` is a non-secret identifier (not a password), but keep it in GitHub Secrets
- `AUTO_DEBUG_TOKEN` should be a fine-grained PAT with minimal scope: `contents:write`, `pull-requests:write`
- Never commit tokens or keys to the repository
- PRs created by automations should be reviewed by a human before merging
- The auto-debug confidence bar is intentionally high — it should not create noise

---

## Related

- [Developer Quick Reference](../DEVELOPER_QUICK_REFERENCE.md) — canonical engineering guardrails
- [CI/CD Pipeline](../../.github/workflows/cicd.yml) — main production pipeline
- [Synthetic Monitoring](../../.github/workflows/synthetic-probe.yml) — uptime probes
- [Agent Orchestration](../../.github/workflows/orchestrate.yml) — AI agent coordination
