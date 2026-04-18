# Repo Memory

This directory holds JoyJoin's repo-owned memory substrate. It is intentionally separate from `.git/.orchestration/` and `.git/.auto-eval/`, which remain operational state only.

**Non-technical decision guide (CEO / product owner):** [`docs/repo-memory-decisions-for-leaders.md`](../docs/repo-memory-decisions-for-leaders.md) — plain-English choices: draft vs official, when to review, automation boundaries.

## Why this exists (and how it differs from orchestration state)

| Surface | Role |
|--------|------|
| **`.github/`** (agents, skills, `orchestration.yaml`) | **Control plane** — routing, policy, validation. Changes go through review and `orchestration:validate`. |
| **`.git/.orchestration/`, `.git/.auto-eval/`** | **Operational plane** — session-scoped context, fingerprints, hooks. Not a substitute for reusable lessons. |
| **`repo-memory/`** | **Durable memory plane (file-backed)** — curated, reviewable notes that survive sessions: **candidates** (staging) → **promoted** (indexed). |

Orchestration tells *how* work runs; **repo-memory** holds *validated repo truths* you do not want every session to rediscover (constraints, strategies, “we decided X”).

## Self-iteration and agents

- **Self-iteration** in this repo means: agents and humans improve workflow using **governed** artifacts (skills, proposals, **memory notes**), not by rewriting policy silently.
- **Candidate notes** (`candidates/`) are the safe place to land **Supervisor- or human-identified gaps** before promotion (see `.github/agents/supervisor.agent.md` graduated skills policy).
- **Promotion** (`memory:promote`) is the fail-closed step that publishes durable memory and refreshes `generated/promoted-index.json` for advisory retrieval.
- **Operational** turn JSON under `.git/.orchestration/` remains ephemeral relative to **promoted** facts in `repo-memory/promoted/`.

## Layout

- `schema/` defines the expected frontmatter metadata for promoted and candidate notes.
- `examples/` holds JSON specs for `npm run memory:draft-candidate` (optional).
- `candidates/` holds reviewable candidate notes staged from a reviewed markdown draft before promotion.
- `promoted/` holds active, stale, or archived notes that have already passed review.
- `generated/promoted-index.json` is a deterministic index built from active promoted notes only.

## Rules

- Memory notes are Markdown files with a small, deterministic frontmatter subset.
- Promoted notes must point back to authoritative files already present in the repo.
- The build script fails closed on invalid notes instead of guessing how to repair metadata.
- The orchestration runtime reads `generated/promoted-index.json` only as advisory retrieval input; durable memory still lives under `repo-memory/` rather than `.git/.orchestration/`.
- Advisory retrieval can mark promoted hits as stale when `lastValidatedAt` exceeds the orchestration freshness threshold, or conflicted when current workflow-relevant changed paths intersect a note's sources, related paths, or note path. Those warnings are fail-open guidance only; they do not publish, block, or rewrite durable memory by themselves.
- Local journals, runtime scratch state, and future session-only artifacts belong under `.joyjoin/`, which is gitignored and not authoritative.

## Agent-assisted automation

- Use the **`Repo Memory Steward`** agent ([`.github/agents/repo-memory-steward.agent.md`](../.github/agents/repo-memory-steward.agent.md)) to turn session lessons into **`memory:draft-candidate`** JSON, run **`memory:query`** for deduplication, and **`memory:validate`** before opening a PR.

### One-shot draft + promote (no separate `promote` command)

If you want **one automated step** after the agent builds a valid JSON spec (no second `memory:promote` invocation):

```bash
JOYJOIN_MEMORY_AUTO_LAND=1 npm run memory:auto-land -- path/to/spec.json
```

This runs **`memory:draft-candidate`** then **`memory:promote`** in sequence. It still requires **`JOYJOIN_MEMORY_AUTO_LAND=1`** so promotion never happens accidentally.

**Why not fully unattended (e.g. cron, silent CI promote)?** Durable memory becomes **retrieval truth** for orchestration and agents. Promoting wrong or stale facts without any review pollutes the repo for everyone. The minimum safety line is: **explicit opt-in** (`JOYJOIN_MEMORY_AUTO_LAND`) and/or **PR review** of the committed files. Fully hands-off promotion is intentionally **not** the default.

## Commands

- `npm run memory:validate`
- `npm run memory:draft-candidate -- repo-memory/examples/your-spec.json` — **agent-friendly:** writes a **schema-valid** candidate from JSON (`relatedPaths` / `sources` must exist). See [`examples/draft-candidate.example.json`](examples/draft-candidate.example.json).
- `JOYJOIN_MEMORY_AUTO_LAND=1 npm run memory:auto-land -- <spec.json>` — **draft + promote** in one command (see above).
- `npm run memory:build-index`
- `npm run memory:query -- "runtime state truthfulness"`
- `npm run memory:stage-candidate -- .joyjoin/reviewed-note.md repo-memory/candidates/reviewed-note.md`
- `npm run memory:promote -- repo-memory/candidates/reviewed-note.md`