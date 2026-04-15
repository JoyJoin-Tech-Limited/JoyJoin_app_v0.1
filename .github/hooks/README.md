# Auto-Eval Hooks

This workspace uses hooks for deterministic auto-eval enforcement and for lightweight orchestration runtime logging.

## What runs

- `SessionStart` runs `node scripts/auto-eval-hook.mjs session-start`
- `PreToolUse` runs `node scripts/auto-eval-hook.mjs pre-tool-use`
- `SessionStart` also runs `node scripts/orchestration-supervisor.mjs copilot-hook session-start`
- `UserPromptSubmit` runs `node scripts/orchestration-supervisor.mjs copilot-hook user-prompt-submit`
- `PostToolUse` runs `node scripts/orchestration-supervisor.mjs copilot-hook post-tool-use`

## What they do

- `SessionStart` checks whether the git worktree is dirty. If it is, it runs the fast auto-eval path and reports the result in a system message.
- `PreToolUse` only guards edit and execute style tools. It denies those tools when the current dirty-worktree fingerprint has not passed auto-eval.
- The orchestration hook keeps a runtime context file under `.git/.orchestration/context.json`, including an advisory top-level `memoryContext`, `sessionId`, and bounded `turnSummaryState`, appends non-blocking event logs under `.git/.orchestration/events.jsonl`, and recommends the `Researcher` -> `Planner` kickoff path for broad prompts.
- Explicit `record-summary` calls from agents remain the authoritative source for turn-end summaries. Hooks capture supporting runtime context, not the final summary truth.
- `SessionStart` builds advisory repo-memory context only from changed files under `.github/`, `scripts/`, and `repo-memory/`.
- `UserPromptSubmit` queries the promoted repo-memory index only when the prompt is meaningful enough to avoid trivial-noise matches, then surfaces a concise relevant-memory summary when useful hits exist.
- Repo-memory hits now carry deterministic lifecycle warnings. If a note is stale against the configured validation-age threshold or conflicts with the current workflow-relevant changed paths, the hook still surfaces it but marks it with explicit caution text.
- Read and search style tools remain allowed so investigation is still possible.
- Auto-Eval self-check commands are exempt, so contributors can always rerun the evaluator manually.

## Source of truth

The shared evaluator lives in `scripts/auto-eval-core.mjs`.

- `scripts/auto-eval.mjs --mode manual-report` prints the human-readable report.
- `scripts/auto-eval-hook.mjs` translates evaluator results into the hook input and output contract.
- `scripts/orchestration-supervisor.mjs` is the runtime entrypoint for Copilot hooks, local git hooks, and the GitHub orchestration workflow.
- `scripts/orchestration-supervisor.mjs record-summary` is the explicit recorder path for agent and supervisor turn summaries, and it accepts stdin, `--json`, or `--file` payload input.
- `scripts/memory-lib.mjs` provides the shared repo-memory substrate for note validation, indexing, and lexical retrieval.
- `.github/agents/manifest.json` is the machine-readable inventory for canonical agent names and subagent allowlists.
- `.github/orchestration.yaml` is the machine-readable contract for orchestrated agents, support agents, skill bindings, and tooling sufficiency notes.
- `.vscode/settings.json` enables nested subagent invocation for the authored second-level Taro support lanes.
- `repo-memory/generated/promoted-index.json` is the read-only retrieval source the orchestration hook uses when it is available.
- `.github/agents/researcher.agent.md` and `.github/agents/planner.agent.md` define the approval-first kickoff lane that the orchestration hook recommends.

## Pass cache

Passing results are cached by exact dirty-worktree fingerprint under `.git/.auto-eval/pass-state.json`.

The cache is only valid when all of these still match:

- the current fingerprint
- the current rubric version
- the current thresholds

Any file change invalidates the pass for guarded tools until auto-eval passes again.

## Failure behavior

- Real evaluation failures are fail-closed for guarded tools.
- Repo-memory retrieval is fail-open. If `repo-memory/generated/promoted-index.json` is missing or unreadable, the hook continues without memory hits.
- Hook infrastructure errors and timeouts fail open with an explicit warning so the workspace does not deadlock silently.

## Manual recovery

If a guarded tool is blocked, rerun Auto-Eval manually and fix the reported findings:

```bash
node scripts/auto-eval.mjs --mode manual-report
```

You can also invoke the `Auto-Eval` custom agent from the workspace agent picker.

If repo-memory summaries are unexpectedly absent after a retrieval-related change, rebuild the generated index first:

```bash
npm run memory:build-index
```

For broader multi-agent routing, start with `Researcher` and `Planner` for broad tasks, then use the `Supervisor` custom agent for explicit downstream routing. See `.github/ORCHESTRATION.md` for the current kickoff flow, graph, support-agent audit, and tooling recommendations.
