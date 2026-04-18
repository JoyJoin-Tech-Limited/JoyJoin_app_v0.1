# Proposals index (triage)

Long-form **design / workflow RFCs** live here. They are **not** validated `repo-memory` notes until promoted via `npm run memory:promote` after review.

| Proposal | Status | Triage / next action |
|----------|--------|----------------------|
| [`supervisor-turn-report-usability-bundle.md`](./supervisor-turn-report-usability-bundle.md) | **Open backlog** | UX polish for Supervisor visible notes (Done / Waiting / Blocked). Canonical turn shape remains [`.github/skills/orchestration-turn-reporting/SKILL.md`](../.github/skills/orchestration-turn-reporting/SKILL.md) and [`.github/agents/AGENT_TURN_VISIBLE_FORMAT.md`](../.github/agents/AGENT_TURN_VISIBLE_FORMAT.md). Implement as a bundled pass when orchestration UX is in scope. |
| [`participation-framework-v2.md`](./participation-framework-v2.md) | **Open strategic** | Large north-star product/architecture doc. **Not** a single memory note. When executing, split into tractable issues or small promoted notes (e.g. queue-state UX, discovery patterns). |
| [`profile-c-memory-layer-rfc.md`](./profile-c-memory-layer-rfc.md) | **Partially realized** | **File-backed durable notes** are now [`repo-memory/`](../repo-memory/README.md) (candidates → promoted, schema, index). Full **Profile C** (rich memory plane, retrieval, SelfIteration publish path) remains future work per RFC; treat this RFC as roadmap, `repo-memory/` as shipped first step. |
| [`mini-program-cleanup-and-upgrade-plan.md`](./mini-program-cleanup-and-upgrade-plan.md) | **Approved** (2026-04-19) | Execute Phase 0 → 1 → 2 in order; Phases 3–5 as prioritized. See doc §11. |

## Relationship to `repo-memory/`

- **Proposals** = exploratory / approval-first artifacts.
- **Candidates** = reviewable, schema’d notes under `repo-memory/candidates/` ready for promotion.
- **Promoted** = durable repo memory under `repo-memory/promoted/` consumed by advisory tooling (`generated/promoted-index.json`).
