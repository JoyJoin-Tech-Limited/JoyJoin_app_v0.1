# Skills iteration roadmap (latest status)

**Purpose:** Prioritized follow-ups for JoyJoin `.github/skills/` and agent-facing presentation—aligned with orchestration, `turnStatus`, Supervisor model hints, and executive briefing—without auto-editing skills from sessions.

## Near term (highest leverage)

1. **Roll out executive briefing** — Treat [orchestration-turn-reporting](./orchestration-turn-reporting/SKILL.md) as canonical. **Contributor harness pointer:** [CONTRIBUTOR_AGENT_HARNESS.md](../CONTRIBUTOR_AGENT_HARNESS.md); shared turn narrative: [AGENT_TURN_VISIBLE_FORMAT.md](../agents/AGENT_TURN_VISIBLE_FORMAT.md). Agents under `.github/agents/` include a **Turn visible note (orchestration)** subsection aligned to that contract.
2. **Regression guard for recorder** — **Done:** [`scripts/orchestration-turn-summary.test.mjs`](../../scripts/orchestration-turn-summary.test.mjs) (`npm run orchestration:test`); runs in [`.github/workflows/orchestrate.yml`](../../.github/workflows/orchestrate.yml) after `orchestration:validate`.
3. **Single source for model catalog** — **Done:** [`.github/agents/MODEL_CATALOG.md`](../agents/MODEL_CATALOG.md); policy and Planner/Supervisor link to it.
4. **code-review skill** — **Done:** [Author-facing summary (optional)](./code-review/SKILL.md#author-facing-summary-optional) cross-links [orchestration-turn-reporting](./orchestration-turn-reporting/SKILL.md) executive briefing.

## Medium term

5. **Routing coverage** — Run `node scripts/test-skill-routing.mjs` after material `routing.yml` edits; extend triggers for new surfaces (mini-program, AI runtime) as those skills stabilize.
6. **mini-program-frontend-excellence + wow-elements** — Ensure `routing.yml` and README index stay aligned when thresholds or paths change.
7. **Superpowers integration doc** — Keep [AI_TOOLING_UNIFIED_BRAIN.md](../AI_TOOLING_UNIFIED_BRAIN.md) / [SUPERPOWERS_JOYOIN_INTEGRATION.md](../SUPERPOWERS_JOYOIN_INTEGRATION.md) in sync when Cursor/Copilot glue changes.

## Governance (ongoing)

8. **Skill authoring** — New or materially changed skills: follow [skill-authoring-governance](./skill-authoring-governance/SKILL.md); run `validate-skill-routing` + test script.
9. **Proposals over silent edits** — Durable lessons → `docs/proposals/`, `repo-memory/candidates/`, or PRs—not autonomous skill file writes from chat.

## Explicitly out of scope (unless product decides otherwise)

- **Unsupervised agents committing to `.github/skills/`** — blocked by design; see orchestration-turn-reporting skill.
