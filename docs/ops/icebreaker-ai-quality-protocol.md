# Social Icebreaker AI — human quality protocol

This document defines how JoyJoin assesses **in-event AI-assisted icebreaker content** for clarity, fun, appropriateness, and memorability — and how that ties to `promptVersion`, [`AIResponseMeta`](../../packages/shared/src/types/aiMeta.ts) (including `aiCorrelationId`), and persisted feedback.

**Related:** [icebreaker-ai-systems/observability.md](./icebreaker-ai-systems/observability.md), [production-ai-surfaces.md](../../.github/skills/social-icebreaker-domain/references/production-ai-surfaces.md).

## Principles

- **Server authority:** Session phase progression and game rules stay deterministic; AI output is presentation-only ([`docs/ai/ai/ai-agent-harness-separation-strategy.md`](../ai/ai-agent-harness-separation-strategy.md)).
- **Terminology:** Use **memorable** or **rejoin intent** in copy and rubrics — avoid framing goals as “addictive” engagement.
- **Privacy:** `aiCorrelationId` is an opaque UUID; it must not embed PII. Feedback rows store no prompt text or user-generated content by default.

## Dimensions (conceptual)

| Dimension | What it captures | Maps to shipping signal |
|-----------|------------------|-------------------------|
| Clarity | Instructions and copy are easy to follow in the room | `helpful` vs `neutral` vs `awkward` |
| Fun / energy | Group reacts positively; appropriate for the phase | Same scale |
| Appropriateness | Safe for mixed company; fits venue and culture | Same scale + host skip |
| Memorability | Would people mention this moment later (“memorable”) | Same scale |

Per-phase emphasis (examples):

- **warmup:** Low-stakes, inclusive; clarity first.
- **lie_detective:** Playful tension without humiliation; fairness of statements.
- **mini_script:** Narrative coherence and host-lock parameters respected.
- **recap:** Warm closure without overlong copy.

## Human ratings (product)

Participants submit **one** of `helpful | neutral | awkward` per feedback row, keyed by:

- `socialSessionId`
- `phase` ([`SocialIcebreakerPhase`](../../packages/shared/src/socialIcebreaker.ts))
- `promptVersion` (matches generator constant, e.g. `social-warmup-topics-v1`)
- `aiCorrelationId` (matches `[AITrace].traceId` for that generation)

API: `POST /api/social-icebreaker/:socialSessionId/ai-feedback` (authenticated; roster membership required).

## Async LLM-as-judge (deferred / P3)

A separate **sampled**, **offline** judge (see [`docs/ai/ai/AI_INTEGRATION_PLAN.md`](../ai/AI_INTEGRATION_PLAN.md) — Evaluator Usage Policy) may score anonymized or hashed content for calibration against human ratings. It **never** runs on the user-facing critical path; batch or queue only; no PII in judge inputs.

**Status:** Not implemented in application code; operate via future job + governance review before enabling in production.

## Sampling policy (when LLM judge ships)

- Sample **1–5%** of generations in stable environments; higher only during prompt bake-off windows.
- **Never** block UX on judge completion; write results asynchronously to an internal store for analysis.

## Dashboards

- Admin: `GET /api/admin/icebreaker-ai-feedback/summary` — aggregates by `phase`, `promptVersion`, and rating (see implementation).
- Metrics: continue using `joyjoin_ai_*` from [icebreaker-ai-systems/observability.md](./icebreaker-ai-systems/observability.md) for technical health; combine with human aggregates for end-to-end quality.
