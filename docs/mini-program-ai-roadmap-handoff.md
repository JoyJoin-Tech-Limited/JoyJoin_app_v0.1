# Mini-program AI — deeper integration handoff

This note ties **mini-program AI work** to the repo’s **governed planning lane** and the long-range roadmap. It is not a runtime authority document; pair it with [`AI_INTEGRATION_PLAN.md`](./AI_INTEGRATION_PLAN.md) and [`ai-agent-harness-separation-strategy.md`](./ai-agent-harness-separation-strategy.md).

**For sequenced work packages and acceptance criteria**, see [`mini-program-ai-further-execution-plan.md`](./mini-program-ai-further-execution-plan.md).

## When to use the kickoff lane

Use **Supervisor → Researcher → Planner** (see [`.github/AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md)) when:

- You are changing **provider routing**, **prompt versioning strategy**, **shadow / non-authoritative inference**, or **evaluation metrics** across server + mini-program.
- You need **approval-first** scope for instrumentation, A/B buckets, or predictive layers that might touch matching semantics.

After approval, route implementation to **AI Engineer** (server AI surfaces) and **Taro Mini-Program Frontend Engineer** (MP UX), then **QA Agent** / **Verifier**.

## Roadmap slices (aligned with `AI_INTEGRATION_PLAN.md`)

| Tranche | Focus | Guardrail |
|--------|--------|-----------|
| Instrumentation | Stronger traces/metrics for `matchExplanationService` and `socialIcebreakerAIService` | Deterministic matching and onboarding authority unchanged |
| Prompt / model rollout | Server-side experiment buckets + `promptVersion` discipline | No client-only “AI truth” |
| Shadow expansion | Patterns from `llmFallbackInference` / predictive rerank telemetry | Non-authoritative until gates pass |
| MP UX | Optional display of safe metadata (`fromCache`, etc.) only if product wants trust cues | No clutter on WeChat |

## Canonical MP inventory

See [`AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md) for **mini-program-visible** AI features and fallbacks.

## Theme reveal + cache consistency

On `EVENT_THEME_TITLE_REVEALED`, the matching-status page invalidates:

- `['mini-program', 'pool-registration', registrationId]`
- `['mini-program', 'my-pool-registrations']`
- `['mini-program', 'pool-group', groupId]` when `groupId` is present on the event payload

So registration, discover-level lists, and group details stay aligned after async AI theme generation.
