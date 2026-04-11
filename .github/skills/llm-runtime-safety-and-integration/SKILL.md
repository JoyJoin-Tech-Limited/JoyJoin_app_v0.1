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

This skill covers the runtime safety rules for LLM-backed features that are already
in the live JoyJoin stack. It keeps model calls observable, fail-safe, and clearly
separated from deterministic product authority.

## When to use this skill

Use this skill when you are:

- adding or changing a live model call in the server
- wiring provider routing, fallback behavior, or shadow-mode execution
- adding `promptVersion`, `fromCache`, `generatedAt`, or `fallbackUsed` metadata
- instrumenting `logAITrace(...)` for an AI-backed feature
- reviewing whether an AI feature respects the current architecture guardrails

## Core rules

1. Start from the current-state AI architecture, not the roadmap.
   Read `docs/ai-agent-harness-separation-strategy.md` first for what is live today.
   Use `docs/AI_INTEGRATION_PLAN.md` for rollout sequencing and future gates only.

2. Keep deterministic authority deterministic.
   Matching scores, onboarding routing, auth gates, and server-owned phase transitions
   must not become partially AI-owned by accident.

3. Route model calls through the approved runtime surface.
   Use the existing router or service boundary such as `socialModelRouter.ts`,
   `creativeModelRouter.ts`, or the owning AI service instead of instantiating an ad-hoc client.

4. Make the execution observable.
   AI calls should emit non-PII trace metadata such as provider, latency, success,
   `fallbackUsed`, `fromCache`, and `promptVersion` when available.

5. Design the failure path before the happy path.
   Schema rejection, provider failure, timeout, or missing credentials should degrade to
   a safe fallback or a clearly handled failure state, not silent partial output.

6. Keep prompt metadata and cache metadata explicit.
   If the response depends on caching or prompt revisions, return or persist the metadata
   needed to understand what produced the output.

## Current repo anchors

- `apps/server/src/ai/socialModelRouter.ts` is the main routed entry for social-experience AI calls.
- `apps/server/src/lib/aiTraceLogger.ts` defines the current non-PII structured trace shape.
- `apps/server/src/matchExplanationService.ts` and `apps/server/src/socialIcebreakerAIService.ts`
  already implement live generator-plus-fallback patterns.
- `apps/server/src/inference/runtimeLLMFallback.ts` and `apps/server/src/inference/llmFallbackInference.ts`
  show shadow-mode and prompt-version patterns for runtime inference.

## Quick examples

- **Add a new AI explanation call**: route it through the owning AI service, log `logAITrace(...)`,
  and keep the deterministic business decision outside the generated text.
- **Add prompt version tagging**: thread `promptVersion` through the response or cache metadata so
  future debugging can distinguish old and new prompt templates.
- **Add shadow-mode inference**: keep it non-authoritative, traceable, and isolated from the live
  deterministic output until the rollout gate is cleared.

## Troubleshooting

**The AI feature works locally but has no trace data**
Check that the call site uses `logAITrace(...)` and that the trace fields stay non-PII.

**The implementation uses the roadmap doc as if the feature is already live**
Stop and re-check `docs/ai-agent-harness-separation-strategy.md`. The roadmap is not runtime authority.

**A model call is influencing deterministic matching or routing logic**
That is a boundary violation. Move the AI output to explanation, enrichment, or shadow-only evaluation.

**Fallback content is vague or inconsistent**
Treat fallback as a first-class path. Curated or deterministic fallback must be explicit and reviewable.

## Review checklist

- [ ] The change starts from current shipped AI behavior, not roadmap-only assumptions
- [ ] Deterministic product authority remains outside the LLM call path
- [ ] Provider routing uses the approved runtime surface instead of ad-hoc clients
- [ ] Trace metadata is non-PII and includes provider and latency
- [ ] `promptVersion`, `fromCache`, `generatedAt`, or `fallbackUsed` are carried when relevant
- [ ] Failure and fallback paths are explicit and safe

## Related files

- `docs/ai-agent-harness-separation-strategy.md`
- `docs/AI_INTEGRATION_PLAN.md`
- `apps/server/src/ai/socialModelRouter.ts`
- `apps/server/src/ai/creativeModelRouter.ts`
- `apps/server/src/lib/aiTraceLogger.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/profileTaglineService.ts`
- `apps/server/src/inference/runtimeLLMFallback.ts`