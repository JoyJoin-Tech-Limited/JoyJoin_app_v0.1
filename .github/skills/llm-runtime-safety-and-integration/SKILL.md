---
name: llm-runtime-safety-and-integration
description: >-
  Safe runtime integration for LLM-backed features: provider routing, prompt versioning,
  fallback behavior, cache metadata, trace logging, and separation from deterministic
  product authority. Use when adding or changing runtime AI calls, shadow-mode inference,
  AI explanation flows, or AI observability. Trigger phrases: "add an LLM call",
  "promptVersion", "AITrace", "shadow mode", "fallbackUsed", "socialModelRouter".
---

# LLM Runtime Safety and Integration

## Purpose

Runtime safety rules for LLM-backed features in the live JoyJoin stack. Keeps model
calls observable, fail-safe, and separated from deterministic product authority.

## When to use this skill

- Adding or changing a live model call in the server
- Wiring provider routing, fallback behavior, or shadow-mode execution
- Adding `promptVersion`, `fromCache`, `generatedAt`, or `fallbackUsed` metadata
- Instrumenting `logAITrace(...)` for an AI-backed feature
- Reviewing whether an AI feature respects architecture guardrails

## Core rules

1. **Start from current-state AI architecture.** Read
   `docs/ai-agent-harness-separation-strategy.md` first for what is live today.
2. **Keep deterministic authority deterministic.** Matching scores, onboarding
   routing, auth gates, and server-owned phase transitions must not become
   partially AI-owned by accident.
3. **Route through approved runtime surfaces.** Use `socialModelRouter.ts`,
   `creativeModelRouter.ts`, or the owning AI service — not ad-hoc clients.
4. **Make execution observable.** Emit non-PII trace metadata: provider, latency,
   success, `fallbackUsed`, `fromCache`, `promptVersion`.
5. **Design the failure path first.** Schema rejection, provider failure, timeout,
   or missing credentials should degrade to a safe fallback or handled failure state.
6. **Keep prompt and cache metadata explicit.** Return or persist metadata needed
   to understand what produced the output.

For prompt-versioning specifics, AITrace logging format, shadow-mode setup, cache
metadata rules, and router configs, see [`references/llm-ops.md`](./references/llm-ops.md).

## Current repo anchors

- `apps/server/src/ai/socialModelRouter.ts`
- `apps/server/src/lib/aiTraceLogger.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/inference/runtimeLLMFallback.ts`

## Quick examples

- **Add a new AI explanation call** → route through the owning AI service, log
  `logAITrace(...)`, and keep the deterministic decision outside the generated text.
- **Add prompt version tagging** → thread `promptVersion` through response or cache
  metadata so future debugging can distinguish prompt templates.
- **Add shadow-mode inference** → keep it non-authoritative, traceable, and isolated
  from live deterministic output until the rollout gate is cleared.

## Troubleshooting

**AI feature works locally but has no trace data**
→ Check that the call site uses `logAITrace(...)` and fields stay non-PII.

**Implementation uses the roadmap doc as if the feature is already live**
→ Re-check `docs/ai-agent-harness-separation-strategy.md`. Roadmap is not runtime
   authority.

**Model call is influencing deterministic matching or routing logic**
→ Boundary violation. Move AI output to explanation, enrichment, or shadow-only.

**Fallback content is vague or inconsistent**
→ Treat fallback as a first-class path. Curated fallback must be explicit and reviewable.

## Review checklist

- [ ] Change starts from current shipped AI behavior, not roadmap-only assumptions
- [ ] Deterministic product authority remains outside the LLM call path
- [ ] Provider routing uses the approved runtime surface
- [ ] Trace metadata is non-PII and includes provider and latency
- [ ] `promptVersion`, `fromCache`, `generatedAt`, or `fallbackUsed` are carried
- [ ] Failure and fallback paths are explicit and safe

## Related files

- `docs/ai-agent-harness-separation-strategy.md`
- `docs/AI_INTEGRATION_PLAN.md`
- `apps/server/src/ai/socialModelRouter.ts`
- `apps/server/src/ai/creativeModelRouter.ts`
- `apps/server/src/lib/aiTraceLogger.ts`
- [`references/llm-ops.md`](./references/llm-ops.md)
