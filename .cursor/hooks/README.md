# Cursor hooks adapter

Project-level Cursor hooks live in [`hooks.json`](../hooks.json) and delegate to the same Node entrypoints as [GitHub Copilot hooks](../../.github/hooks/README.md), via [`cursor-hook-adapter.mjs`](./cursor-hook-adapter.mjs). Paths below are relative to the repository root unless noted.

## Design: do not block normal Cursor usage

By default this repo’s **Cursor** `hooks.json` **does not register `preToolUse`**. That avoids per-tool Auto-Eval runs (CPU + noise) and avoids any **deny** path when `JOYJOIN_AUTO_EVAL_STRICT=1` is set in the environment. GitHub Copilot configs under [`.github/hooks/`](../../.github/hooks/) may still use `PreToolUse`; that is separate.

- **Auto-Eval soft vs strict** (when `preToolUse` is wired in): [`scripts/auto-eval-hook.mjs`](../../scripts/auto-eval-hook.mjs) uses a **soft gate** by default (warns on failure, still allows tools). **Hard deny** only if `JOYJOIN_AUTO_EVAL_STRICT=1`.
- **Session start**: `sessionStart` runs **orchestration only** by default (fast). Set **`CURSOR_SESSION_AUTO_EVAL=1`** if you also want the session-start Auto-Eval message (can be slow on dirty trees).

### Optional: strict Auto-Eval on every tool (Cursor)

Add a `preToolUse` entry to [`hooks.json`](../hooks.json) pointing at `node .cursor/hooks/cursor-hook-adapter.mjs preToolUse`, and only if you really want gating. Prefer relying on CI and `node scripts/auto-eval.mjs` for quality checks instead of blocking the agent locally.

## Event mapping

| Cursor hook | Adapter argv | Delegates to |
|-------------|----------------|--------------|
| `sessionStart` | `sessionStart` | `orchestration-supervisor.mjs copilot-hook session-start`; optional Auto-Eval session message if `CURSOR_SESSION_AUTO_EVAL=1` |
| `beforeSubmitPrompt` | `beforeSubmitPrompt` | `orchestration-supervisor.mjs copilot-hook user-prompt-submit` |
| `postToolUse` | `postToolUse` | `orchestration-supervisor.mjs copilot-hook post-tool-use` (stdin enriched with `toolName` from `tool_name`) |
| `preToolUse` | `preToolUse` *(not in default hooks.json)* | `auto-eval-hook.mjs pre-tool-use` — add manually if needed |

## Stdout shape differences

- **Copilot** scripts emit `{ continue, systemMessage?, hookSpecificOutput? }` and use `hookSpecificOutput.permissionDecision` for edit guards.
- **Cursor** [`preToolUse`](https://cursor.com/docs/agent/hooks) expects top-level `{ permission: "allow" \| "deny", user_message?, agent_message? }`. The adapter translates auto-eval output accordingly.
- **Cursor** `sessionStart` prefers `additional_context` (and optional `env`) instead of Copilot’s `systemMessage`; the adapter merges messages into `additional_context`.

## Single source of truth

- Hook behavior and policies remain in [`scripts/auto-eval-hook.mjs`](../../scripts/auto-eval-hook.mjs), [`scripts/orchestration/orchestration-supervisor.mjs`](../../scripts/orchestration/orchestration-supervisor.mjs), and [`.github/orchestration.yaml`](../../.github/orchestration.yaml).
- [`.github/hooks/*.json`](../../.github/hooks/) configures **Copilot** event names (`SessionStart`, `PreToolUse`, …). Do not copy those JSON files here; use [`hooks.json`](../hooks.json) for Cursor.
