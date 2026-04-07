# Branch Cleanup Runbook

**Audience:** JoyJoin repository maintainers  
**Workflow file:** `.github/workflows/delete-merged-branches.yml`  
**Last updated:** 2026-04-07

---

## Overview

The **Branch Cleanup** workflow (`delete-merged-branches.yml`) handles two things:

1. **Automatic cleanup** — deletes the head branch of any PR the moment it is merged.
2. **Bulk cleanup** — a manually triggered job for cleaning up large numbers of stale branches (e.g. the `copilot/*` branches created by GitHub Copilot coding agent sessions).

---

## Automatic cleanup on PR merge

The workflow listens for `pull_request` events with type `closed`. When a PR is merged, it automatically deletes the head branch unless it is on the always-keep list.

**Always-kept branches** (never deleted automatically):

```
main
feat/mini-program-foundation
```

No further action is needed for day-to-day PR work — merged branches are cleaned up automatically.

---

## Bulk cleanup (manual trigger)

Use this when you need to delete many stale branches at once, for example after accumulating a large number of `copilot/*` branches.

### Step 1 — Dry run (required first)

1. Go to **Actions → Branch Cleanup** in the GitHub repository UI.
2. Click **Run workflow**.
3. Leave `dry_run` set to **true** (the default).
4. Leave `confirm` empty.
5. Optionally set `delete_prefix` — default is `copilot/`, which targets all Copilot-created branches.
6. Click **Run workflow** and wait for it to finish.
7. Open the job log and review the output:
   - **[DRY RUN]** lines: branches that *would* be deleted.
   - **[MANUAL REVIEW]** lines: stale branches that do not match the prefix and should be reviewed individually before any deletion.

### Step 2 — Live deletion

> ⚠️ This is destructive. Deleted branches cannot be recovered from the UI. Verify the dry-run output first.

1. Go to **Actions → Branch Cleanup** → **Run workflow**.
2. Set `dry_run` to **false**.
3. Set `confirm` to exactly `DELETE_BRANCHES` (the value must match precisely).
4. Confirm `delete_prefix` is correct (default: `copilot/`).
5. Click **Run workflow**.

The workflow will:
- Skip all branches in the always-keep list.
- Skip all branches that have an **open pull request**.
- Skip all branches marked as **protected** in repository settings.
- Delete remaining branches that match the prefix, with automatic retry on rate-limit errors.
- Enable the repository setting **"Automatically delete head branches"** so future merged PRs are cleaned up without manual intervention (requires admin token scope; the step is non-fatal if the token lacks that permission).

---

## Safety guarantees

| Protection | How it works |
|---|---|
| Default branch (`main`) never deleted | Listed in `ALWAYS_KEEP` env var |
| Protected branches never deleted | `!b.protected` filter on every branch |
| Open-PR branches never deleted | Paginated open-PR list built before any deletion |
| Live deletion requires confirmation | `confirm` input must equal `DELETE_BRANCHES` |
| Default mode is dry run | `dry_run` input defaults to `true` |
| Rate-limit resilience | `deleteBranchWithRetry` retries up to 4× with backoff |

---

## Troubleshooting

**"Live deletion requires confirm=DELETE_BRANCHES"**  
Set the `confirm` input to exactly `DELETE_BRANCHES` and re-run with `dry_run=false`.

**"The delete_prefix input must not be empty"**  
Always supply a non-empty `delete_prefix`. Use `copilot/` to target Copilot branches.

**Branch still exists after the workflow ran**  
The branch either has an open PR, is in the always-keep list, or is marked as protected. Check the job log for a `[MANUAL REVIEW]` line for that branch.

**"Could not set delete_branch_on_merge automatically"**  
The `GITHUB_TOKEN` used in the workflow run does not have admin scope. Enable the setting manually under **Settings → General → "Automatically delete head branches"**.
