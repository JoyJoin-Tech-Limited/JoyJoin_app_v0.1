---
name: docs-sync
description: >
  Knowledge-base editor for JoyJoin. Reconciles agent memory, AGENTS.md, and docs/
  against the active codebase so nothing rots. Use when user says "update docs",
  "sync up", "tidy up", "/sync", "/neat", "同步一下", "整理文档", "整理一下",
  "更新记忆", "收尾", or after significant code changes.
---

# Docs Sync

**Core rule:** Only document the active codebase. Never revive legacy.

**Secondary rule:** You are a **knowledge editor**, not a recorder.

**Requires:** MCP `agentMemory` server for memory-layer reconciliation.

## Three layers of knowledge

| Layer | Audience | Location |
|-------|----------|----------|
| Agent memory | Future sessions | MCP `agentMemory` |
| `AGENTS.md` | Any AI in this project | `AGENTS.md` |
| `docs/` + `README.md` | Humans & downstream devs | `docs/`, `README.md` |

Audiences must not mix. `AGENTS.md` never copies full `docs/` sections.
See [`references/workflow.md`](./references/workflow.md) for editing principles.

## When to use this skill

- A PR merged and its changes are not yet documented
- An API, route, data model, or flow changed and reference docs are stale
- User asks to sync, tidy, or clean up docs or memory
- After significant architecture, component, or config changes

## Do not use when

- Writing new product requirements
- Purely internal refactor with no API/flow impact
- Docs are already accurate

## Execution flow (5 steps)

1. **Inventory** — Query agent memory (MCP `recall`/`search`), list all docs, read `AGENTS.md`, `README.md`, every `docs/*.md`
2. **Impact analysis** — Map each code change to layers using [`references/mapping.md`](./references/mapping.md). **Fallback rule:** if a doc was read in Step 1 but mapping.md doesn't list it, add it to the impact list anyway if it describes a modified feature, flow, or platform-parity table. See `references/workflow.md` §Step 2 for full fallback criteria.
3. **Edit** — `docs/` → `AGENTS.md` → agent memory. Merge > append. Delete > keep. Absolute dates only.
4. **Self-checklist** — Mandatory gate. See [`references/checklist.md`](./references/checklist.md)
5. **Summary** — Memory + docs + unhandled. See [`references/workflow.md`](./references/workflow.md)

## Quick examples

**Adding a photo-upload onboarding step:**
Inventory → impact (new `nextStep`, flag, route, page) → edit all layers → checklist → summary.
See [`references/example.md`](./references/example.md) for the full worked example.

**Renaming a route:**
Search docs and agent memory for the old path, update every occurrence, confirm canonical references reflect the change.

## Troubleshooting

- Doc disagrees with code? **Trust code; update doc.**
- Multiple docs stale? Update **canonical** first, then derivatives.
- User wants to document old flow? **Decline.** Legacy belongs in git history.
- Memory contradicts docs? Update or delete the memory; docs are authoritative.

## Review checklist

- [ ] All Required updates applied before Recommended/Optional
- [ ] Agent memory reconciled with docs (no contradictions)
- [ ] No relative time strings remain (absolute dates only)
- [ ] Cross-project downstream docs checked
- [ ] Only active-flow documented; no legacy revived
