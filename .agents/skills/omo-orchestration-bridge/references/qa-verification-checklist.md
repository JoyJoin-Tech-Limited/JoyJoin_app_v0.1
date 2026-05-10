# QA Verification Checklist — `omo-orchestration-bridge`

> **Skill:** `.agents/skills/omo-orchestration-bridge/`  
> **Purpose:** Bridge Oh My OpenAgent (OMO) workflow patterns into Kimi Code CLI actions  
> **Verifier:** QA Agent (this checklist)  
> **Version:** v1.0 — 2026-05-09  

---

## Executive Summary

| Risk Area | Severity | Check Section |
|-----------|----------|---------------|
| Misrepresentation — OMO is OpenCode-only; Kimi cannot install OMO plugins | 🔴 Critical | §1.1–1.3 |
| State corruption — `boulder.json` schema drift or overwrite | 🔴 Critical | §2.1–2.5 |
| Context overload — parallel subagent limits | 🟡 High | §3.1–3.3 |
| Stale mappings — `.github/agents/` changed out from under skill | 🟡 High | §4.1–4.3 |
| Reference integrity — missing or broken `references/*.md` | 🟡 High | §5.1–5.4 |

---

## §1. Automated Checks — Runtime Compatibility & Misrepresentation

### §1.1 Truth-in-advertising: OMO plugin availability
- **Tool:** `ReadFile` on `SKILL.md`, then `Grep` for `"OMO plugin"` or `"OpenCode"` in skill directory
- **Method:**
  1. Read `SKILL.md` lines 1–20
  2. Verify the skill **never** claims OMO/OpenCode can be installed in Kimi
  3. Verify line ~14 contains explicit disclaimer: *"OMO is an OpenCode plugin; Kimi Code CLI is a different runtime"*
- **Expected result:**
  - Skill states OMO **cannot** be installed as a plugin
  - Skill positions itself as a **translation layer**, not a runtime
  - No instructions to run `opencode` CLI commands
- **Evidence format:** Screenshot or verbatim quote of disclaimer + grep results
- **Pass criteria:** ✅ Disclaimer present and unambiguous; ❌ Missing → BLOCK

### §1.2 Subagent type validity mapping
- **Tool:** `Grep` across skill files for `subagent_type=`
- **Method:**
  1. List every `subagent_type` value the skill recommends (`plan`, `coder`, `explore`)
  2. Cross-reference against Kimi documentation — verify `explore` (not `explorer`) is valid
  3. Verify `plan` subagent type exists in Kimi CLI
- **Expected result:**
  - Only Kimi-valid `subagent_type` values are used
  - No references to OpenCode-specific tools (e.g., `opencode://`, LSP hash-anchors)
- **Evidence format:** Table of all `subagent_type` occurrences + Kimi-valid flag
- **Pass criteria:** ✅ All values Kimi-native; ❌ Any OpenCode-specific → BLOCK

### §1.3 Tool boundary audit — no OpenCode-isms leak into instructions
- **Tool:** `Grep` in skill directory for opencode-specific terms
- **Method:**
  ```bash
  grep -riE "opencode|open.?code|hash.?anchor|lsp://|@file:|#L[0-9]+" \
    .agents/skills/omo-orchestration-bridge/ || true
  ```
  (Run via Shell tool equivalent)
- **Expected result:** Zero hits for OpenCode runtime mechanics; only contextual mentions (e.g., "OMO is an OpenCode plugin") allowed
- **Evidence format:** Grep output with hit count = 0 for runtime terms
- **Pass criteria:** ✅ 0 runtime-ism hits; ❌ >0 → BLOCK

---

## §2. Automated Checks — `boulder.json` State Safety

### §2.1 Schema compliance with live `boulder.json`
- **Tool:** `ReadFile` on `.sisyphus/boulder.json` + `ReadFile` on `references/boulder-protocol.md`
- **Method:**
  1. Read live `boulder.json`
  2. Verify every key in live file has a documented schema entry in `boulder-protocol.md`
  3. Verify no undocumented keys exist in live file
  4. Verify all required keys from schema exist in live file
- **Expected result:**
  - Schema in skill matches actual state file structure
  - No schema drift (e.g., `task_sessions` fields match)
- **Evidence format:** Side-by-side table — schema key ↔ live value type
- **Pass criteria:** ✅ Perfect match; ⚠️ Minor extra keys → WARN; ❌ Missing required keys → BLOCK

### §2.2 Idempotency rule enforcement in skill text
- **Tool:** `Grep` in `references/boulder-protocol.md` for overwrite/delete rules
- **Method:**
  1. Search for `"append"` (not overwrite) for `session_ids`
  2. Search for `"delete boulder.json"` — must only occur post-Oracle approval
  3. Search for `"mark checkbox"` — must not rewrite task specs
- **Expected result:**
  - Rule 2: *"Never overwrite `session_ids` — always append"*
  - Rule 4: *"Mark checkboxes … do not modify task specs"*
  - Rule 5: Delete only when "fully complete, merged, and Oracle approves"
- **Evidence format:** Verbatim quotes of rules 2, 4, 5 from protocol file
- **Pass criteria:** ✅ All three rules present and explicit; ❌ Missing → BLOCK

### §2.3 Append-only semantics for `session_ids`
- **Tool:** `ReadFile` on `.sisyphus/boulder.json`
- **Method:**
  1. Check `session_ids` array contains ≥1 entries
  2. Check `session_origins` has entries for each session ID
  3. Verify no `session_ids` value is duplicated (basic sanity)
- **Expected result:** Array format matches schema; origins map is 1:1 with IDs
- **Evidence format:** `session_ids` length + `session_origins` key count
- **Pass criteria:** ✅ Length ≥ 1, origins count matches; ⚠️ Empty array on fresh repo → OK if documented

### §2.4 `task_sessions` key format consistency
- **Tool:** `Grep` in `boulder.json` for `"todo:`
- **Method:**
  1. Verify all task keys follow `todo:N` pattern
  2. Verify each entry has all required fields: `task_key`, `task_label`, `task_title`, `session_id`, `agent`, `category`, `status`, `updated_at`
- **Expected result:** 100% of entries have all required fields; no malformed keys
- **Evidence format:** Sample of 3 task entries with field presence checklist
- **Pass criteria:** ✅ All required fields present; ❌ Missing fields → BLOCK

### §2.5 State mutation guardrail — skill never instructs blind overwrite
- **Tool:** `Grep` in `SKILL.md` + `references/discipline-workflows.md` for `"overwrite"`
- **Method:**
  1. Search for `"overwrite"` context — must be negative ("Never overwrite")
  2. Search for `"write boulder.json"` — must include "read first, then merge"
- **Expected result:** No instruction to blindly write/overwrite `boulder.json`; always read-merge-write
- **Evidence format:** Grep hit lines with context (-C 2)
- **Pass criteria:** ✅ No blind overwrite instructions; ❌ Found → BLOCK

---

## §3. Automated Checks — Parallel Subagent Safety

### §3.1 Parallel agent limit enforcement
- **Tool:** `Grep` in skill files for `"parallel"`, `"background"`, `"max"`
- **Method:**
  1. Find all mentions of parallel agents
  2. Verify explicit limit stated (e.g., "Max 4 parallel background agents")
  3. Verify limit is ≤ 4
- **Expected result:**
  - `references/agent-registry.md` line 125: "Limit: Max 4 parallel background agents"
  - `SKILL.md` line ~62: "Limit to 3-4 parallel subagents"
- **Evidence format:** Verbatim quotes with line numbers
- **Pass criteria:** ✅ Explicit limit ≤ 4 documented in ≥2 places; ❌ Missing or >4 → BLOCK

### §3.2 Context overload warning in troubleshooting
- **Tool:** `ReadFile` on `SKILL.md` lines 50–70 (troubleshooting section)
- **Method:** Check for warning about parallel agents overloading context
- **Expected result:** `SKILL.md` contains: *"Parallel agents overload context"* with mitigation (use `TaskOutput` to poll)
- **Evidence format:** Quote of troubleshooting entry
- **Pass criteria:** ✅ Warning + mitigation present; ❌ Missing → WARN

### §3.3 `TaskOutput` polling pattern documented
- **Tool:** `Grep` in `references/discipline-workflows.md` for `"TaskOutput"`
- **Method:**
  1. Verify Team Mode emulation shows `while any incomplete: TaskOutput(id, block=false)` pattern
  2. Verify `run_in_background=true` is paired with `TaskOutput` polling
- **Expected result:** Code block in §5 shows proper polling loop
- **Evidence format:** Copy of the polling pattern block
- **Pass criteria:** ✅ Polling loop documented; ❌ Missing → WARN

---

## §4. Automated Checks — Stale Agent Mapping Resilience

### §4.1 Referenced agent definitions exist
- **Tool:** `Shell` — `ls .github/agents/*.agent.md`
- **Method:**
  1. Collect all agent names referenced in skill files: Prometheus, Atlas, Sisyphus, Oracle, Momus, Metis, Hephaestus
  2. Verify each has a corresponding `.github/agents/{name}.agent.md` file
- **Expected result:**
  - prometheus.agent.md ✅
  - atlas.agent.md ✅
  - oracle.agent.md ✅
  - momus---plan-critic.agent.md ✅ (note: mapped as "momus")
  - metis---plan-consultant.agent.md ✅ (note: mapped as "metis")
- **Evidence format:** Table of agent name → file path → exists?
- **Pass criteria:** ✅ All referenced agents have files; ⚠️ Hephaestus missing → WARN if not referenced as primary; ❌ Core 4 missing → BLOCK

### §4.2 Agent description drift detection
- **Tool:** `ReadFile` on `SKILL.md` + `ReadFile` on `.github/agents/atlas.agent.md` and `prometheus.agent.md`
- **Method:**
  1. Compare skill's description of Atlas ("read plans/state; does not edit") with actual agent definition
  2. Compare skill's description of Prometheus ("generate plans only") with actual agent definition
  3. Flag any contradiction in scope or constraints
- **Expected result:**
  - Atlas actual: tools include `[read, search, edit, execute, agent, task]` — skill says "explore" (read-only). **⚠️ MISMATCH**
  - Prometheus actual: "DO NOT start executing tasks" — skill says same. ✅ MATCH
- **Evidence format:** Side-by-side comparison table
- **Pass criteria:** ⚠️ Atlas mismatch flagged; must be documented as known limitation or fixed

### §4.3 `manifest.json` cross-reference
- **Tool:** `ReadFile` on `.github/agents/manifest.json` (first 50 lines)
- **Method:** Verify manifest lists all agents the skill references
- **Expected result:** `manifest.json` contains entries for Prometheus, Atlas, Oracle, Sisyphus
- **Evidence format:** `grep` results from manifest for each agent name
- **Pass criteria:** ✅ All core agents in manifest; ❌ Missing → WARN

---

## §5. Automated Checks — Reference File Integrity

### §5.1 All linked references exist
- **Tool:** `Shell` — `ls .agents/skills/omo-orchestration-bridge/references/`
- **Method:** Verify three files from `SKILL.md` "Related files" exist:
  - `references/agent-registry.md`
  - `references/boulder-protocol.md`
  - `references/discipline-workflows.md`
- **Expected result:** All three files exist and are non-empty (>100 bytes)
- **Evidence format:** `ls -la` output with file sizes
- **Pass criteria:** ✅ All three present; ❌ Missing → BLOCK

### §5.2 Cross-reference link validity
- **Tool:** `Grep` in references for relative paths (`.github/agents/`, `.sisyphus/`)
- **Method:**
  1. Find every relative path referenced in skill files
  2. Verify each path exists on disk
- **Expected result:**
  - `.github/agents/prometheus.agent.md` → exists ✅
  - `.github/agents/oracle.agent.md` → exists ✅
  - `.github/agents/sisyphus.agent.md` → **verify**
  - `.sisyphus/plans/` → directory exists ✅
  - `.sisyphus/evidence/` → directory exists ✅
- **Evidence format:** Path → exists? table
- **Pass criteria:** ✅ All referenced paths exist; ⚠️ Missing non-critical path → WARN

### §5.3 Example plan file exists and matches schema
- **Tool:** `Shell` — `ls .sisyphus/plans/*.md | head -5`
- **Method:**
  1. Verify at least one example plan exists
  2. Check that it contains required sections from schema (TL;DR, Context, Work Objectives, TODOs, etc.)
- **Expected result:**
  - `wire-3-tier-run-plans.md` or similar exists
  - Contains `## TL;DR`, `## TODOs`, `- [ ]` checkboxes
- **Evidence format:** `head -30` of example plan showing structure
- **Pass criteria:** ✅ Example plan exists and follows schema; ❌ No example → WARN (schema unvalidated)

### §5.4 No circular self-references
- **Tool:** `Grep` in skill files for `"omo-orchestration-bridge"` or `"SKILL.md"`
- **Method:** Verify skill does not instruct loading itself recursively or referencing its own file as a dependency
- **Expected result:** Zero self-referential instructions (except trivial "this skill" mentions)
- **Evidence format:** Grep hit count
- **Pass criteria:** ✅ No recursive self-load instructions; ❌ Found → WARN

---

## §6. Smoke Tests — Quick Validation

### §6.1 Skill loads without syntax error
- **Tool:** `ReadFile` on `SKILL.md`
- **Method:** Read the entire file; YAML frontmatter parses; Markdown body renders
- **Expected result:** No malformed YAML, no unclosed code blocks, no broken tables
- **Evidence format:** File read success + line count (85 lines as of v1)
- **Pass criteria:** ✅ Clean read, no parse errors; ❌ Syntax error → BLOCK

### §6.2 Trigger phrase coverage
- **Tool:** `Grep` in `SKILL.md` frontmatter for `"Trigger"` or trigger phrase list
- **Method:** Verify all claimed triggers from description are actually actionable in skill body
- **Claimed triggers:** `ultrawork`, `/start-work`, `resume boulder`, `omo`, `atlas`, `prometheus`, `sisyphus`, `oracle`, `team mode`, `parallel agents`, `boulder workflow`, `plan execution`
- **Expected result:** Each trigger maps to a concrete instruction in skill body (e.g., "When user says `resume boulder` → read `boulder.json` → find next unchecked task")
- **Evidence format:** Table of trigger → skill body section → action described
- **Pass criteria:** ✅ ≥80% of claimed triggers have concrete actions; ❌ <50% → BLOCK

### §6.3 Happy-path workflow coherence
- **Tool:** Manual trace through skill files
- **Method:**
  1. User says `ultrawork` → skill triggers IntentGate → if standard/deep → Prometheus plan
  2. Prometheus saves plan → Atlas reads plan + boulder state → delegates to Sisyphus
  3. Sisyphus executes → saves evidence → updates boulder → next task
  4. All tasks done → Oracle audit → delete boulder
- **Expected result:** Workflow is a closed loop with no dead ends; each handoff has explicit next step
- **Evidence format:** Flow diagram or step trace (can be text-based)
- **Pass criteria:** ✅ Closed loop, all handoffs defined; ❌ Dead end or missing handoff → BLOCK

---

## §7. Manual Checks — Human Judgment Required

### §7.1 Semantic accuracy of OMO→Kimi translation
- **Method:** Ask a human who knows both OMO and Kimi to review:
  - Does `subagent_type="plan"` reasonably emulate Prometheus?
  - Does `subagent_type="coder"` reasonably emulate Sisyphus?
  - Is the "Team Mode" emulation actually achievable with Kimi background agents?
- **Expected result:** Expert confirms translation is semantically reasonable, even if not 1:1
- **Evidence format:** Human sign-off comment or PR review
- **Pass criteria:** ✅ Expert approves; ❌ Expert flags fundamental misalignment → BLOCK

### §7.2 Usability for non-OMO users
- **Method:** Ask a Kimi-only user (never used OMO) to read the skill and explain what it does
- **Expected result:** User can understand the skill without OMO knowledge; skill stands on its own
- **Evidence format:** User comprehension test results
- **Pass criteria:** ✅ User can explain core workflow; ❌ User confused → REWRITE

### §7.3 Blast radius assessment — what breaks if skill is wrong?
- **Method:** Review the "Review checklist" in `SKILL.md` lines 67–77
- **Expected result:** Checklist covers: state accuracy, checkbox sync, evidence, session reuse, Oracle audit, Ralph Loop, parallel cleanup
- **Evidence format:** Blast radius matrix (see §8 below)
- **Pass criteria:** ✅ Comprehensive guardrails; ❌ Missing key safety check → WARN

### §7.4 Skill-authoring-governance compliance
- **Method:** Read `skill-authoring-governance` skill requirements; compare against this skill
- **Expected result:**
  - Consistent metadata (name, description, trigger phrases)
  - Progressive disclosure (frontmatter → quick examples → deep workflows → troubleshooting)
  - Clear triggerability (multiple entry points)
  - Technical correctness (no false claims about runtime capabilities)
- **Evidence format:** Governance skill checklist filled out
- **Pass criteria:** ✅ Compliant; ❌ Non-compliant → WARN with remediation items

---

## §8. Regression Risk Matrix

If this skill is **wrong or stale**, the following break:

| Downstream Surface | Failure Mode | Severity | Detection |
|-------------------|--------------|----------|-----------|
| `.sisyphus/boulder.json` | Corrupted state → lost task progress, duplicate work | 🔴 Critical | §2.1, §2.2 |
| `.sisyphus/plans/*.md` | Plan files rewritten instead of checkbox-only → spec drift | 🔴 Critical | §2.5 |
| Subagent sessions | `session_ids` overwritten → orphaned background tasks | 🟡 High | §2.3 |
| Parallel agent launches | >4 background agents → context thrashing, dropped tasks | 🟡 High | §3.1 |
| Agent mappings | Atlas described as read-only but agent def allows edit → permission confusion | 🟡 High | §4.2 |
| Evidence collection | Missing evidence path → Oracle audits fail, sign-off blocked | 🟡 High | §5.2 |
| Plan schema | Stale example plan → Prometheus generates non-compliant plans | 🟠 Medium | §5.3 |
| Self-references | Recursive skill load → infinite loop in agent orchestration | 🟠 Medium | §5.4 |

---

## §9. Sign-off Block

| # | Checkpoint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | §1.1–1.3 — No OMO runtime misrepresentation | ☐ | |
| 2 | §2.1–2.5 — `boulder.json` safety rules enforced | ☐ | |
| 3 | §3.1–3.3 — Parallel agent limits documented | ☐ | |
| 4 | §4.1–4.3 — Agent mappings exist and are accurate | ☐ | |
| 5 | §5.1–5.4 — Reference files intact and cross-validated | ☐ | |
| 6 | §6.1–6.3 — Smoke tests pass | ☐ | |
| 7 | §7.1–7.4 — Manual review complete | ☐ | |
| 8 | §8 — Regression risks acknowledged and mitigated | ☐ | |

**Overall Verdict:** ☐ PASS  ☐ PASS WITH WARNINGS  ☐ BLOCK

**Blocker details (if any):**

---

*End of checklist. Save execution artifacts to `.sisyphus/evidence/omo-bridge-qa/`.*
