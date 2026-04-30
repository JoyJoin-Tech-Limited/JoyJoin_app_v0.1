# Docs-Sync Detailed Workflow

This reference expands the 5-step execution flow from `SKILL.md` with full editing principles, special cases, priority classification, summary format, and commit conventions.

---

## Step 1: Inventory (mandatory — no skipping)

**Do `ls` before judgment.**

1. **Agent memory layer** — Use MCP `agentMemory` tools:
   - `recall` with topics from this session
   - `list_recent` to see what memories exist
   - `search` for keywords related to changed code
2. **Project root** — for each project touched:
   - `ls` root → confirm structure
   - `ls docs/` → **enumerate every doc** (confirm if empty)
   - `find . -maxdepth 2 -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"` → catch stray markdown
   - Read `README.md`, `AGENTS.md`, every `docs/*.md`
   - **Explicitly read `PRODUCT_REQUIREMENTS.md`** — it is the canonical product doc and is frequently missed because it lives at repo root, not inside `docs/`
3. **Global config** — read any global agent config if present
4. **Review session** — skim the full conversation for code changes, decisions, and reversals

**Output an internal file list** (not shown to user). Tag each item: `[assessed / needs-edit / skip]`. **Missing one is the most common failure mode of this skill.**

**Critical inventory reminder:** `PRODUCT_REQUIREMENTS.md` and `docs/mini-program-product-reference.md` are the two most frequently missed documentation targets. They must be explicitly assessed in every sync, even when the changed code does not obviously touch product requirements.

---

## Step 2: Impact analysis — use the Change-Impact Matrix

**Don't just look at what changed; look at which knowledge layers it touches.**

Common patterns:

| Code change | Agent memory | `AGENTS.md` | `docs/` + `README.md` |
|-------------|-------------|-------------|----------------------|
| New API / route | Cache invalidation if route was memorized | Route list, env vars | `DEVELOPER_QUICK_REFERENCE.md`, `docs/api/`, architecture routes |
| New / renamed env var | Update if cached | Env var table | `docs/runbooks/`, `DEVELOPER_QUICK_REFERENCE.md` |
| New DB table | — | Data model note | `docs/architecture/current-state.md` data-model section |
| New major feature (cross-file) | Update related facts | All affected sections | Architecture new chapter + handoff completion list |
| Cross-project change | Check downstream facts | Downstream notes | **Both projects' docs** |
| Decision reversal | Update or delete stale fact | Remove reversed rule | Remove reversed guidance |

For JoyJoin-specific mappings, see [`mapping.md`](./mapping.md).

**Critical check:** Was this session **cross-project**? If project A changed and project B depends on it (shared package, API contract, env var), **project B's docs must also be checked.** This is the #1 cause of missed syncs.

**Fallback rule — "Read but not mapped":**
After applying `mapping.md`, review your internal file list from Step 1. If any doc was **read** but `mapping.md` does not list it as a target for the changes in this session, add it to the impact list anyway and ask:
1. *Does this doc describe a feature, screen, or flow that was modified?*
2. *Does this doc contain a platform-parity table that should reflect the change?*
3. *Does this doc reference code paths that were renamed or removed?*

If the answer to any question is **yes**, add the doc to the impact list and propose a `mapping.md` update so future syncs do not miss it. This is the #2 cause of missed syncs.

**Key discipline for memory:**
- Relative time → absolute date (`2026-04-30`, never "today")
- Outdated facts → update or delete
- Duplicates → merge
- Completed todos → delete

---

## Step 3: Edit (use tools — don't just describe)

You must **actually modify files** with `WriteFile`, `StrReplaceFile`, or agent-memory MCP (`store`, `update`, `delete`). Describing intended changes is not completion.

**Edit order:** `docs/` first (highest external impact) → `AGENTS.md` → agent memory last. If interrupted, the most important layer is already correct.

**Editing principles:**

- **合并优于追加** (merge over append): new info updates existing entries; don't add duplicates
- **删除优于保留** (delete over keep): remove completed temp plans, overturned decisions, expired context
- **精确优于冗长** (precise over verbose): one fact per entry
- **绝对时间 only**: `2026-04-30`, never "today", "yesterday", "recently", "上周"
- **面向读者** (reader-first): `docs/` readers have 5 minutes and zero prior context
- **受众不混** (no audience mixing): `AGENTS.md` is for AIs; `docs/` is for humans; memory is for cross-session persistence

**Agent memory editing (direct MCP):**
- Use `search` or `recall` to find memories that may be stale
- Use `update` to correct existing memories with new facts, absolute dates, or revised context
- Use `store` or `store_batch` to add new memories for non-obvious decisions
- Use `delete` to remove memories that are overturned, completed, or obsolete
- Never let agent memory contradict `AGENTS.md` or `docs/`

**`AGENTS.md` editing:**
- Keep it concise — route lists, env var tables, red lines
- Never copy full `docs/` sections
- Global agent config (`~/.claude/CLAUDE.md`, etc.) is **extremely conservative**: only update if the user explicitly stated a cross-project principle. Daily project details stay in project-level `AGENTS.md`.

**`docs/` editing:**
When adding a capability, update all four external perspectives:
1. **Integration / usage** — *how to use* (curl / SDK examples / error codes) → `DEVELOPER_QUICK_REFERENCE.md`, `docs/api/`
2. **Architecture** — *how it works* (data flow, state machine, design trade-offs) → `docs/architecture/current-state.md`
3. **Runbook** — *how to operate* (smoke commands, troubleshooting, env vars) → `docs/runbooks/`
4. **Handoff** — *what's done* → `docs/handoffs/`

API quick-reference tables, env var tables, and glossary entries must be **"what you see is current"**.

---

## Step 4: Self-checklist (mandatory gate)

Go through every item. If an item fails, **go back and fix it**. Do not ship because "it's close enough."

See [`checklist.md`](./checklist.md) for the full 10-step validation checklist.

---

## Step 5: Change summary

After all edits (not before), present a concise summary:

```markdown
## Sync complete

### Memory changes
- Update: … (reason)
- New: …
- Delete: … (reason)

### Documentation changes (group by project)
- `AGENTS.md` — …
- `docs/architecture/current-state.md` — …
- `DEVELOPER_QUICK_REFERENCE.md` — …
- `<project-B>/docs/…` — …

### Unhandled
- … (why, e.g. needs user confirmation)
```

Only list items that actually changed. Unchanged items are omitted.

---

## Priority classification

| Priority | When | Example |
|----------|------|---------|
| **Required** | Canonical docs are wrong and will cause active mistakes | Route renamed but `DEVELOPER_QUICK_REFERENCE.md` still references old path |
| **Recommended** | Docs are incomplete but not actively misleading | New shared component exists but not listed in `packages/shared/src/README.md` |
| **Optional** | Minor accuracy improvement with low usage impact | Inline code comment in a skill example references a renamed variable |

Always address **Required** updates first. Present **Recommended** updates for confirmation. Offer **Optional** updates but do not apply without explicit approval.

---

## Common documentation impact patterns

See [`mapping.md`](./mapping.md) for the full source-to-doc mapping guide including:
- New API route → `DEVELOPER_QUICK_REFERENCE.md`, `docs/api/`, relevant domain skill
- Route renamed/removed → Update all occurrences; mark removed routes
- New `nextStep` onboarding value → `docs/onboarding-flow.md`, `onboarding-state-architecture` skill
- New shared component → `packages/shared/src/README.md`, `frontend-component-architecture` skill
- New design token → `design-system-governance` skill
- New env var → `.env.example` comment, `DEVELOPER_QUICK_REFERENCE.md`
- New banned legacy identifier → `DEVELOPER_QUICK_REFERENCE.md` guardrail list, `scripts/check-guardrails.mjs`
- New domain in `routes/domains/` → `server-domain-architecture` skill, `apps/server/src/README.md`
- Matching weight or signal change → `matching-domain` skill
- Icebreaker phase or action change → `social-icebreaker-domain` skill
- New Prometheus metric → `platform-observability-and-ops` skill, `docs/observability.md`
- Drizzle schema change → `backend-models-standards` notes, migration docs

---

## If no documentation target exists

If a code change has clear doc impact but no existing doc section covers it:

1. Identify the closest canonical doc as the best home (prefer `DEVELOPER_QUICK_REFERENCE.md` or `docs/architecture/current-state.md`)
2. Propose a new section with a suggested heading and short content
3. Ask for explicit approval before creating the new section
4. If the change warrants an entirely new doc file, propose the path and structure but do not create it without approval

Never silently create new doc files. New docs require intentional decision, not automatic generation.

---

## Special cases

**Project has no `README` or `AGENTS.md`:**
- If the project has runnable code → create them.
- If still in vibe-coding stage → skip, but mention in the summary.

**Session produced no new facts:**
- Still run Step 1 and Step 4. Reviewing existing memory and docs for staleness / conflicts / relative time has value on its own.

**Memory contains contradictions that can't be auto-resolved:**
- List under **Unhandled** and let the user decide. **This is the only situation that requires user input.** Everything else, you decide.

**Cross-project session:**
- Run Step 1 for every project touched. Do not assume project A's docs are sufficient. Especially check upstream-downstream integration docs (SDK docs, API contracts, env var sharing).

**Discovering a past sync was missed:**
- Fix it. Do not say "that wasn't this session" — you are the project's continuous editor, and past gaps are yours to close.

---

## Commit and approval

- Documentation impact summary was presented for confirmation before changes were applied
- All Required updates are applied; Recommended updates were either applied or explicitly deferred
- Commit message follows `docs: sync [area] after [change]` pattern
- If orchestration or skill `routing.yml` changed, `npm run orchestration:validate` and `node scripts/validate-skill-routing.mjs` were run
