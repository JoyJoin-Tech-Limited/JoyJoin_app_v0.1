# Auto-Eval Hooks

This workspace uses hooks for deterministic auto-eval enforcement.

## What runs

- `SessionStart` runs `node scripts/auto-eval-hook.mjs session-start`
- `PreToolUse` runs `node scripts/auto-eval-hook.mjs pre-tool-use`

## What they do

- `SessionStart` checks whether the git worktree is dirty. If it is, it runs the fast auto-eval path and reports the result in a system message.
- `PreToolUse` only guards edit and execute style tools. It denies those tools when the current dirty-worktree fingerprint has not passed auto-eval.
- Read and search style tools remain allowed so investigation is still possible.
- Auto-Eval self-check commands are exempt, so contributors can always rerun the evaluator manually.

## Source of truth

The shared evaluator lives in `scripts/auto-eval-core.mjs`.

- `scripts/auto-eval.mjs --mode manual-report` prints the human-readable report.
- `scripts/auto-eval-hook.mjs` translates evaluator results into the hook input and output contract.

## Pass cache

Passing results are cached by exact dirty-worktree fingerprint under `.git/.auto-eval/pass-state.json`.

The cache is only valid when all of these still match:

- the current fingerprint
- the current rubric version
- the current thresholds

Any file change invalidates the pass for guarded tools until auto-eval passes again.

## Failure behavior

- Real evaluation failures are fail-closed for guarded tools.
- Hook infrastructure errors and timeouts fail open with an explicit warning so the workspace does not deadlock silently.

## Manual recovery

If a guarded tool is blocked, rerun Auto-Eval manually and fix the reported findings:

```bash
node scripts/auto-eval.mjs --mode manual-report
```

You can also invoke the `Auto-Eval` custom agent from the workspace agent picker.
