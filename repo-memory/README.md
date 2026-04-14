# Repo Memory

This directory holds JoyJoin's repo-owned memory substrate. It is intentionally separate from `.git/.orchestration/` and `.git/.auto-eval/`, which remain operational state only.

## Layout

- `schema/` defines the expected frontmatter metadata for promoted and candidate notes.
- `candidates/` holds reviewable candidate notes staged from a reviewed markdown draft before promotion.
- `promoted/` holds active, stale, or archived notes that have already passed review.
- `generated/promoted-index.json` is a deterministic index built from active promoted notes only.

## Rules

- Memory notes are Markdown files with a small, deterministic frontmatter subset.
- Promoted notes must point back to authoritative files already present in the repo.
- The build script fails closed on invalid notes instead of guessing how to repair metadata.
- The orchestration runtime reads `generated/promoted-index.json` only as advisory retrieval input; durable memory still lives under `repo-memory/` rather than `.git/.orchestration/`.
- Local journals, runtime scratch state, and future session-only artifacts belong under `.joyjoin/`, which is gitignored and not authoritative.

## Commands

- `npm run memory:validate`
- `npm run memory:build-index`
- `npm run memory:query -- "runtime state truthfulness"`
- `npm run memory:stage-candidate -- .joyjoin/reviewed-note.md repo-memory/candidates/reviewed-note.md`
- `npm run memory:promote -- repo-memory/candidates/reviewed-note.md`