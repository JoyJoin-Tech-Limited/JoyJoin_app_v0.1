# JoyJoin Profile C Memory Layer RFC

**Author:** Engineering / Product Architecture  
**Date:** April 14, 2026  
**Status:** Proposal for review  
**Scope:** Repo workflow architecture, durable memory-plane design, and staged rollout for JoyJoin's AI-assisted delivery system

> **Proposal only.** This document is the first PR artifact for a future memory-plane rollout. It does not describe shipped behavior and does not replace the current-state authority of `.github/ORCHESTRATION.md`, `.github/AI_WORKFLOW_POLICY.md`, `.github/ORCHESTRATION_GOVERNANCE.md`, or `docs/ai-agent-harness-separation-strategy.md`.
>
> **Update (2026-04):** A first **file-backed** durable notes layer now lives under [`repo-memory/`](../repo-memory/README.md) (candidates → promoted, schema-validated). This RFC still describes the fuller **Profile C** vision (retrieval, SelfIteration publish path, richer planes); see also [`docs/proposals/README.md`](./README.md) for triage.

## Executive Summary

JoyJoin already has a strong control plane for AI-assisted delivery. The repo can register agents, define handoff graphs, document policy, govern workflow changes, and persist truthful advisory runtime state. What it does not yet have is a durable memory plane.

Today, long-lived knowledge about recurring repo truths, workflow constraints, and validated lessons is either re-discovered from code and docs each session or left implicit. The persisted state under `.git/.orchestration/` and `.git/.auto-eval/` is operational, fingerprint-bound, and session-scoped. It is not a reusable memory layer.

This RFC proposes JoyJoin's first deliberate move toward a true Profile C memory-layer system. In this RFC, **Profile C** means JoyJoin operates with three clearly separated planes:

1. a control plane for routing, policy, and governance
2. an operational plane for truthful session state
3. a memory plane for durable, reviewable, retrievable knowledge

The recommendation is deliberately practical: file-backed first, lexical retrieval first, fail-closed governance for durable publication, and support-lane-only `SelfIteration` initially. The first implementation step after this RFC should add a separate memory plane outside `.git`, not reinterpret `.git` operational state as durable memory.

## Current State

JoyJoin's current repo workflow already has clear control-plane and operational-plane surfaces.

| Surface | Current role | Why it is not a durable memory plane |
| --- | --- | --- |
| `.github/agents/manifest.json` | Registry of active, kickoff, and support-lane agents, with skills, handoffs, and tooling status. | Inventory and routing metadata are durable control-plane inputs, not retrievable memory artifacts for future task context. |
| `.github/orchestration.yaml` | Machine-readable orchestration contract for kickoff behavior, handoff graph, hooks, workflows, and tooling sufficiency. | Governs execution flow, but does not store validated lessons or reusable repo knowledge. |
| `.github/ORCHESTRATION.md` | Human-readable explanation of the native handoff graph, support lanes, runtime surfaces, and validation expectations. | Documents how the control plane works; it is not a memory publication system. |
| `.github/AI_WORKFLOW_POLICY.md` | Contributor policy for lane selection, escalation rules, and approval boundaries. | Defines operating rules, not a mechanism for storing reusable session learnings. |
| `.github/ORCHESTRATION_GOVERNANCE.md` | Governance for changing agents, skills, hooks, orchestration contracts, and truthful runtime-state handling. | Protects workflow integrity, but does not provide a durable retrieval layer. |
| `.github/hooks/README.md` | Explains hook behavior, runtime logging, pass-cache behavior, and manual recovery. | Describes operational hooks and caches; not intended for durable knowledge capture. |
| `docs/agents/SelfIteration.md` | Defines `SelfIteration-lite` as a docs-only, proposal-only workflow that can emit a `Memory Candidate` in a reviewer packet. | It explicitly lacks publish authority and remains a support-lane procedure rather than a memory plane. |
| `.git/.orchestration/context.json` | Truthful advisory session state for kickoff recommendations, current prompt context, changed-file scope, and workflow metadata. | Session-scoped operational context under `.git`; may be cleared, replaced, or become stale as the session changes. |
| `.git/.orchestration/events.jsonl` | Append-only operational event log for hook and workflow activity. | Useful telemetry, but raw event history is not curated memory and should not be treated as durable repo truth. |
| `.git/.auto-eval/pass-state.json` | Exact-fingerprint cache for guarded-tool pass state. | A quality-gate cache tied to a specific dirty-worktree fingerprint, not reusable knowledge. |

### Current-state assessment

JoyJoin's current control plane is strong. The repo can recommend `Researcher` -> `Planner`, route through `Supervisor`, enforce dirty-worktree discipline with `Auto-Eval`, and keep advisory runtime state truthful. The gap is that none of those surfaces publish durable memory that survives beyond a single session, fingerprint, or raw operational log.

## Problem Statement

JoyJoin does not yet have a first-class way to capture, review, retrieve, and retire durable workflow memory.

That creates four concrete problems:

1. repeated repo truths are rediscovered from scratch across sessions
2. validated lessons have no governed promotion path from session insight into reusable repo memory
3. `SelfIteration-lite` can propose `Memory Candidate` outputs, but the repo has no memory plane into which those candidates can safely land
4. the only persisted runtime state today lives under `.git`, which is the correct home for operational truth but the wrong home for durable memory

The result is a repo with a solid control plane but no durable memory plane. JoyJoin can orchestrate work well, but it cannot yet remember well.

## Goals

1. Add a separate memory plane for durable JoyJoin workflow knowledge without weakening the existing control plane.
2. Keep memory artifacts file-backed, human-reviewable, and easy to diff.
3. Start with lexical retrieval and explicit file reads rather than embeddings or opaque ranking.
4. Make durable publication fail closed: no reviewed provenance, no publish.
5. Keep `SelfIteration` support-lane-only and proposal-only in the initial rollout.
6. Preserve the current role of `.git/.orchestration/*` and `.git/.auto-eval/pass-state.json` as operational state only.

## Non-Goals

1. Replacing code, tests, or active docs as the source of truth.
2. Reusing `.git/.orchestration/*` or `.git/.auto-eval/pass-state.json` as durable memory storage.
3. Shipping vector databases, embeddings, or autonomous background memory synthesis in the first rollout.
4. Promoting `SelfIteration` into the core orchestration graph or giving it publish authority.
5. Changing JoyJoin's shipped runtime AI product behavior described in `docs/ai-agent-harness-separation-strategy.md`.

## Proposed Target State

Nothing in this section is live today.

JoyJoin should evolve toward a three-plane workflow model:

| Plane | Purpose | Owned surfaces |
| --- | --- | --- |
| Control plane | Define agent portfolio, routing, policy, governance, and hook contracts. | `.github/agents/manifest.json`, `.github/orchestration.yaml`, `.github/ORCHESTRATION.md`, `.github/AI_WORKFLOW_POLICY.md`, `.github/ORCHESTRATION_GOVERNANCE.md`, `.github/hooks/README.md` |
| Operational plane | Hold truthful, session-scoped state about the current worktree, prompt, and evaluation state. | `.git/.orchestration/context.json`, `.git/.orchestration/events.jsonl`, `.git/.auto-eval/pass-state.json` |
| Memory plane | Store durable, reviewed, retrievable repo knowledge that should survive across sessions. | Separate file-backed memory surfaces outside `.git` |

The critical architectural rule is separation: **the memory plane must not be implemented by reusing `.git` operational state.** Operational state exists to be truthful about the current session. Memory exists to persist validated lessons across sessions. Those are related concerns, but they are not the same artifact type and should not share storage semantics.

In the target state, JoyJoin can do all of the following without confusing workflow control with memory durability:

1. route work using the current control plane
2. preserve session truth in the operational plane
3. retrieve prior validated repo knowledge from a separate memory plane before starting repeated work
4. stage new memory candidates safely without publishing them automatically

## Proposed Memory Architecture

### 1. Storage model

The initial memory plane should be file-backed and scoped by purpose.

| Surface | Path | Purpose | Initial write policy |
| --- | --- | --- | --- |
| Promoted repo memory | `repo-memory/promoted/` | Durable JoyJoin-specific knowledge: workflow truths, domain conventions, known boundaries, and validated operating patterns. | Human-reviewed publication only |
| Reviewable candidate memory | `repo-memory/candidates/` | Candidate notes that are intentionally checked into the repo for review, promotion, or retirement decisions. | Review-only until explicitly promoted |
| Schema docs | `repo-memory/schema/` | Deterministic metadata rules for promoted and candidate notes. | Updated through normal code review |
| Generated promoted index | `repo-memory/generated/promoted-index.json` | Built, read-only lexical index over active promoted notes. | Generated only by script |
| Local workspace scratch | `.joyjoin/` | Ignored local journals, runtime scratch state, and future session-only artifacts that should not become repo truth automatically. | Local-only and never authoritative |

The first rollout should focus on repo-owned promoted memory, deterministic validation, and a generated lexical index. The `.joyjoin/` workspace area is reserved for future local scratch state, but it is intentionally outside the reviewed repo-memory publication path.

### 2. Artifact format

Each durable repo memory note should be a small Markdown file with machine-readable frontmatter and concise human-readable content.

Suggested minimum fields:

```md
---
id: repo.orchestration.runtime-state-truthfulness
title: Runtime State Truthfulness
status: active
owner: workflow-platform
lastValidatedAt: 2026-04-14
confidence: high
triggerTerms:
  - runtime state truthfulness
  - advisory runtime state
sources:
  - .github/ORCHESTRATION_GOVERNANCE.md
  - .github/ORCHESTRATION.md
tags:
  - orchestration
  - runtime-state
  - governance
relatedPaths:
  - .github/ORCHESTRATION_GOVERNANCE.md
  - scripts/orchestration/orchestration-supervisor.mjs
---

- Runtime state under `.git/.orchestration/` is advisory and must not overstate certainty.
- Treat stale scope as unknown rather than preserving it as current truth.
```

Format rules for the first rollout:

1. one stable concept per file
2. short notes over long essays
3. every durable note must point back to current code or current docs
4. no secrets, credentials, or private user data

### 3. Retrieval model

Retrieval should stay lexical and transparent in phase one.

Recommended retrieval order:

1. infer task scope from prompt, changed files, and current lane
2. build a deterministic promoted index from active notes in `repo-memory/promoted/`
3. match indexed promoted notes by file name, exact terms, tags, trigger terms, and `relatedPaths`
4. read the top relevant repo memory notes directly
5. if no confident hit exists, fall back to code and current docs
6. surface uncertainty explicitly rather than fabricating memory

Phase one should not require embeddings, semantic indexing, or opaque retrieval scoring. JoyJoin already has a strong control plane; the first memory-plane goal is durable recall, not retrieval sophistication. The first index can stay fully file-backed and transparent, with lexical scoring that explains why a note ranked where it did.

### 4. Write and promotion flow

The publication path should be explicit and reviewable.

1. A contributor, specialist, or support lane drafts local scratch state under `.joyjoin/` or prepares a reviewable candidate note under `repo-memory/candidates/`.
2. The candidate points to source files, evidence, and validation status.
3. A human reviewer or designated owner approves promotion.
4. The approved note is published into `repo-memory/promoted/` and the generated promoted index is rebuilt.
5. If the note describes a hard rule, the follow-up action is to update canonical docs or add a validator, not to let memory become the only guardrail.

### 5. Relationship to `SelfIteration`

`docs/agents/SelfIteration.md` already defines a safe proposal-only pattern. The initial memory architecture should keep that boundary intact:

1. `SelfIteration` remains support-lane-only
2. it can produce memory candidates for later review, but not auto-publish them into repo memory
3. it cannot publish durable repo memory directly
4. it cannot change its own approval boundaries

This preserves the current governance model while creating a real landing zone for validated memory proposals.

## Governance and Safety Model

The memory plane should adopt the following safety rules from day one.

| Rule | Required behavior |
| --- | --- |
| Code and active docs stay authoritative | Memory summarizes and points to source truth; it never outranks code, tests, or active docs. |
| Durable publication fails closed | Missing provenance, missing validation, or unresolved conflicts block publication. |
| Retrieval may fall back safely | If memory is missing, unreadable, or low confidence, contributors continue from code and docs without durable writes. |
| `.git` stays operational | `.git/.orchestration/*` and `.git/.auto-eval/pass-state.json` remain session and cache surfaces, not memory publication targets. |
| Memory must be attributable | Durable notes need an owner, source links, last validation date, and confidence level. |
| Memory conflicts must quarantine | If a note conflicts with current code or current docs, treat the note as stale until revalidated. |
| Sensitive content is excluded | No secrets, tokens, credentials, private user data, or hidden chain-of-thought artifacts in durable memory. |

Fail-closed governance here should apply most strongly to **durable publication and conflict resolution**. JoyJoin should not block ordinary repo work just because memory retrieval is unavailable, but it should block unreviewed durable writes.

## Milestones and PR Plan

| PR | Goal | Expected outcome |
| --- | --- | --- |
| PR0 | Publish the RFC and docs entrypoint update. | Align the team on terms, boundaries, and rollout shape without changing runtime behavior. |
| PR1 | Add repo-owned file-backed memory scaffolding outside `.git`. | Introduce `repo-memory/`, schema docs, a small seed set of reviewed promoted notes, and deterministic validation/build/query scripts. |
| PR2 | Add lexical retrieval integration. | Load repo memory by exact terms, tags, and related paths before repeated workflow tasks; keep retrieval transparent and read-only. |
| PR3 | Add governance and evaluation guardrails. | Validate memory schema, provenance, freshness markers, and fail-closed publication flow. |
| PR4 | Pilot `SelfIteration` as a support-lane memory candidate producer. | Allow proposal-only candidate generation into `.joyjoin/` or `repo-memory/candidates/`, with reviewer approval required for promotion. |
| PR5 | Reassess whether retrieval needs to grow beyond lexical search. | Only consider hybrid or embedding-backed retrieval after JoyJoin has usage evidence and eval data. |

## First PR Scope

The first safe implementation slice for this initiative is intentionally narrow.

Included:

1. add a repo-owned `repo-memory/` scaffold with schema docs, promoted notes, candidate guidance, and a generated promoted index
2. add deterministic validation, index-build, and query scripts under `scripts/`
3. add a gitignored `.joyjoin/` workspace area for future local journals and runtime scratch state
4. keep retrieval manual and read-only rather than wiring it into orchestration or hooks

Explicitly out of scope:

1. modifying `.github/orchestration.yaml`, hook behavior, or agent manifests
2. changing `SelfIteration` behavior or approval boundaries
3. auto-publishing candidate notes into durable repo memory
4. shipping any runtime AI product behavior or hidden local-memory side effects

## Success Metrics and Evals

The rollout should only expand if it can pass concrete, repo-relevant checks.

| Area | Target | Evaluation |
| --- | --- | --- |
| Retrieval usefulness | On a fixed benchmark of repeated JoyJoin workflow prompts, at least 80% of cases load at least one correct repo-memory note before planning or implementation. | Curated benchmark set spanning orchestration, governance, docs, and support-lane tasks. |
| Retrieval safety | Conflicting or stale repo-memory notes appear in fewer than 5% of benchmark retrievals. | Conflict-injection benchmark using intentionally stale notes. |
| Publication safety | 0 durable repo-memory notes are published without owner, provenance, and `lastValidatedAt`. | Schema validator plus PR checklist. |
| Fail-closed durability | 100% of publication attempts with missing provenance or unresolved conflicts are rejected. | Negative tests against the publication flow. |
| Degraded-mode safety | 100% of simulated missing-memory cases fall back to code and active docs without accidental writes to durable memory. | Read-path failure tests. |
| `SelfIteration` boundary integrity | 0 auto-published memory notes during the initial pilot. | Workflow audit over the support-lane pilot. |

## Risks and Rollback

### Primary risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Stale memory drift | Durable notes can become misleading if the codebase changes. | Require `lastValidatedAt`, owner fields, and quarantine-on-conflict behavior. |
| Duplicate authority | Contributors may treat memory as a substitute for canonical docs or code. | Keep explicit source links and document that memory never outranks active docs or code. |
| Noise in the memory plane | Too many low-signal notes reduce retrieval quality. | One stable concept per file, human-reviewed publication, and lexical-first retrieval. |
| Governance bypass | Automated publication would let unverified notes accumulate quickly. | Fail-closed durable publication and no autonomous writes in the first rollout. |
| Storage ambiguity | The team may blur local workspace memory with repo-managed knowledge. | Decide the storage ownership model before PR1 and document it clearly. |

### Rollback plan

If the memory-plane rollout creates more noise than value, JoyJoin should roll back in the smallest possible way:

1. disable retrieval integration
2. stop promotion of new durable memory notes
3. leave the current control plane and `.git` operational plane unchanged
4. preserve any published files for review, but treat them as inactive until the design is corrected

Because the initial design is file-backed and separate from `.git`, rollback should be operationally simple.

## Open Questions

1. Should local draft capture eventually default to `.joyjoin/` and require explicit promotion into `repo-memory/candidates/`?
2. Which role should own repo-memory review: workflow maintainer, domain owner, or a shared reviewer rotation?
3. What freshness policy should trigger mandatory revalidation of a repo-memory note?
4. Which note types should remain memory-only, and which should immediately graduate into canonical docs or deterministic validators?
5. At what benchmark threshold would JoyJoin consider moving beyond lexical retrieval?

## Recommendation

Approve this RFC as the architectural basis for the first repo-owned memory slice, then keep retrieval transparent, lexical, and reviewable until JoyJoin has evidence that deeper integration is useful and governable. Keep `SelfIteration` in the support lane until the memory plane has a stable promotion path and clear ownership.