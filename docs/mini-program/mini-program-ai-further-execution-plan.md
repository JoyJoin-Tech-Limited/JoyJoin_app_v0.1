# Mini-program and platform AI — further implementation plan (execution)

**Status:** In execution — WP1 metrics + embedding defaults landed; admin Trace Viewer UI still future.  
**Last updated:** 2026-04-19  
**Scope:** Next engineering tranches after the MP AI inventory parity work (tagline, group analysis on detail, theme cache invalidation, doc sync).

## How this relates to other docs

| Document | Role |
|----------|------|
| [`ai/AI_INTEGRATION_PLAN.md`](./ai/AI_INTEGRATION_PLAN.md) | Product AI phases A–E, gates, admin modules, trace schema — **source of truth for capability sequencing** |
| [`ai/ai-agent-harness-separation-strategy.md`](./ai/ai-agent-harness-separation-strategy.md) | Runtime invariants — AI must not own deterministic matching or onboarding authority |
| [`mini-program-ai-roadmap-handoff.md`](./mini-program-ai-roadmap-handoff.md) | **When** to use Supervisor → Researcher → Planner + MP inventory pointer |
| [`ai/AI_FEATURE_INVENTORY.md`](./ai/AI_FEATURE_INVENTORY.md) | What the mini-program actually calls today |

This plan turns the handoff **tranches** into **sequenced work packages** with owners, outputs, and verification. It does **not** replace `ai/AI_INTEGRATION_PLAN.md`; it aligns MP and server execution with phases **A → C** first (observability + shadow), **D–E** only after gates.

## Delivery lane

- **Kickoff (recommended):** Supervisor → Researcher → Planner → approval → implementation ([`.github/AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md)).
- **Implementation:** **AI Engineer** (`apps/server` routers, services, metrics), **Backend Engineer** (flags, storage for traces), **Taro Mini-Program Frontend Engineer** (MP surfaces), **QA Agent** / **Verifier** (sign-off).
- **Domain skills:** `matching-domain`, `onboarding-state-architecture`, `social-icebreaker-domain` under [`.github/skills/`](../.github/skills/README.md); runtime AI boundaries in [`ai/ai-agent-harness-separation-strategy.md`](./ai/ai-agent-harness-separation-strategy.md).

---

## Phase 0 — Complete (baseline)

- MP uses `getPoolGroupAnalysis` on matching-status, squad-unboxing, pool-group-detail (shared query key).
- MP profile review uses `getProfileTagline`.
- Theme reveal invalidates registration, `my-pool-registrations`, and `pool-group` caches on matching-status.
- [`ai/AI_FEATURE_INVENTORY.md`](./ai/AI_FEATURE_INVENTORY.md) reflects current behavior.

**No further work** unless regression tests or product copy changes are requested.

---

## Work package 1 — Instrumentation and trace completeness (aligns with `AI_INTEGRATION_PLAN` Phase A / §10.4)

**Goal:** Every production AI path used by the mini-program is measurable with consistent metadata and operable logs.

| # | Task | Output | Acceptance |
|---|------|--------|------------|
| 1.1 | Audit `matchExplanationService.ts` and `socialIcebreakerAIService.ts` for full `AIResponseMeta` / inline parity with [`packages/shared/src/types/aiMeta.ts`](../packages/shared/src/types/aiMeta.ts) | Gap list + small PRs | All MP-invoked features log `promptVersion`, `provider`, `fallbackUsed`, `fromCache` where applicable |
| 1.2 | Ensure `logAITrace` / structured logs cover MP-critical features: group analysis, icebreaker phases, profile tagline, creative theme | Uniform `feature` / `callerTag` naming | Logs grep-clean in staging; no PII in trace fields |
| 1.3 | Wire **Prometheus or existing metrics** for: call count, p95 latency, fallback rate per feature (minimum: match explanation + social icebreaker) | **`joyjoin_ai_calls_total`** + **`joyjoin_ai_call_latency_ms`** on `/api/metrics` (fed by `logAITrace`) | Alerts optional; **smoke:** [`runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) |
| 1.4 | **Admin / ops:** Minimum viable **Trace Viewer** or export path per §10.4 (even if admin UI lags, **structured log + query** is acceptable MVP) | Trace record shape aligned with plan’s `AICallTrace` sketch | On-call can answer “why fallback?” for a `groupId` / time window |

**Exit:** Stakeholder can see volume, latency, fallback rate, and cache hit rate for MP-touched AI features without reading raw server stdout only.

---

## Work package 2 — Prompt registry and server-side rollout (aligns with Phase A–B)

**Goal:** Change prompts and model routing **without** client releases; version discipline everywhere.

| # | Task | Output | Acceptance |
|---|------|--------|------------|
| 2.1 | Centralize or document **prompt IDs** for: group analysis, icebreaker generators, profile tagline (extend existing `promptVersion` fields) | Table in code or `docs/` + registry file if not using admin CRUD yet | Every prompt change bumps version string |
| 2.2 | **Feature-flag / env** kill-switch audit: `ENABLE_EVENT_THEME_TITLE_GENERATION`, `SOCIAL_AI_PROVIDER`, semantic similarity, predictive rerank — documented in one internal matrix | `docs/` or admin runbook | Kill-switch tested in staging |
| 2.3 | (Optional) Server-side **experiment bucket** hook (header or user hash) for future A/B — **stub only** unless Product approves an experiment | Design doc + no-op or shadow flag | No change to deterministic scores |

**Exit:** Safe rollback and version attribution for any prompt edit affecting MP-visible copy.

---

## Work package 3 — Matching intelligence: shadow path (aligns with Phase C)

**Goal:** **Measure** AI rerank / richer explanations **before** any live influence on group order.

| # | Task | Output | Acceptance |
|---|------|--------|------------|
| 3.1 | **Intro angles / richer pair explanation** — extend `generatePairExplanation` (or adjacent) per plan §10.3 Phase C; **single cached call** where possible | API + cache keys updated | MP or web consumes same contract; no extra blocking latency on `matchEventPool` |
| 3.2 | **Shadow rerank** job or post-hook: log deterministic order vs model-suggested order, **no persistence** to user-facing assignment | Logs + optional admin table | Meets plan exit: ≥10 events with delta distribution **before** Phase D discussion |
| 3.3 | MP: **no requirement** unless Product wants to show “why this table” — if so, use existing `GroupAnalysisResponse` fields only | Parity with web | No new authority on device |

**Exit:** Data exists to justify or reject bounded rerank (Phase D) on evidence.

---

## Work package 4 — Mini-program UX (optional, product-gated)

**Goal:** Improve trust and clarity **without** clutter.

**Status (implemented):** Dev shows a one-line debug hint for group analysis (`fromCache` / `generatedAt`); production requires `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1` at build to enable. QA matrix lives in [`docs/runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) §WP4 and [`apps/mini-program/README.md`](../apps/mini-program/README.md) §Manual QA.

| # | Task | Output | Acceptance |
|---|------|--------|------------|
| 4.1 | **Subtle “fresh vs cached”** for group analysis (e.g. single line in dev or beta only) | `GroupAnalysisSourceHint` + `groupAnalysisDebug.ts`; `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG` in `config/index.ts` | Off by default in production WeChat |
| 4.2 | **QA checklist:** profile tagline, pool detail AI card, theme after WS, icebreaker session | [`runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) + MP README | Manual sign-off path |

**Exit:** Product decides what ships; engineering provides flags and checklist.

---

## Work package 5 — Gated phases (D–E) — **do not start** until gates met

- **Phase D (bounded rerank):** Only after shadow data and statistical gate in [`ai/AI_INTEGRATION_PLAN.md`](./ai/AI_INTEGRATION_PLAN.md) §10.3 Phase D.
- **Phase E (host/admin icebreaker console):** User-facing MP stays **non-autonomous**; host tools live in admin / host surfaces per plan.

**Exit:** Explicit go/no-go from Product + metrics review.

---

## Suggested timeline (indicative)

| Horizon | Focus |
|---------|--------|
| **Sprint 1–2** | WP1 instrumentation + trace MVP |
| **Sprint 2–3** | WP2 prompt registry + flags |
| **Sprint 3+** | WP3 shadow + explanation enrichments (parallel server tracks) |
| **As needed** | WP4 MP polish |

Adjust to team capacity; **do not** parallelize WP3 shadow analysis with ungated live rerank.

---

## Verification commands (per change)

- `npm run orchestration:validate` — if `.github/orchestration.yaml` or agents change
- `apps/mini-program`: `npm run typecheck`
- Server: targeted tests for touched services (`matchExplanationService`, icebreaker routes)
- `npm run orchestration:validate` **not** required for MP-only UI if orchestration untouched

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| LLM latency hurts MP UX | Async + cache + fallbacks; never block pool matching |
| Prompt drift without visibility | WP1 + WP2 versioning |
| Over-trusting model order | Shadow first; deterministic authority preserved |
| Doc drift | Update [`ai/AI_FEATURE_INVENTORY.md`](./ai/AI_FEATURE_INVENTORY.md) when MP calls change |
