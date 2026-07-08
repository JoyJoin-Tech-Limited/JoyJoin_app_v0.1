# Approval-First Execution Plan: Compliance, Positioning & Matching Operator Review

## Mission in one sentence
Deliver PRC AIGC and product-positioning compliance across user-facing copy, AI-generated content, and the matching state machine, while introducing a default-off operator-review gate for group matching that preserves the existing automated flow. Positioning reframe: “兴趣活动驱动的轻社交” — activities are the primary container; natural connection is the user-valued outcome.

## Assumptions and gaps
- The 5 AI/algorithm mentions and the listed positioning-sensitive terms are the primary high-risk occurrences; deeper scans may surface more.
- Phase 3 requires additive schema changes to `event_pools` and `pool_groups`.
- `matchingOperatorReviewEnabled` will be a DB-backed kill switch (default `false`).
- AIGC surfaces are Mini-Program primary; the web client is archived.
- Post-generation moderation reuses the existing `validateContentSafe()` authority.
- Terms update is Chinese-only for v0.1; legal review is a launch blocker.
- Product positioning reframe: "兴趣活动驱动的轻社交" — not a pure signup tool, not a dating app.
- Add conversion instrumentation before Phase 1 ships to measure intent-distribution and onboarding impact.

## Lane & tier rationale
- **Tier 3 / Harness Runtime Controller** because this touches: (a) deterministic matching authority/state machine, (b) AIGC compliance with content moderation, (c) admin RBAC/audit, (d) cross-workspace changes.
- The scope is already approved and decomposed; we proceed with a **Sprint Contract + domain specialists** rather than running a full chamber before any coding.

## Critical path
1. Lock the banned-word list and safe-copy replacements (Phase 1 + 4).
2. Add the feature flag and matching state-machine changes with a deterministic off-path (Phase 3).
3. Wrap all AI outputs with post-generation moderation + labels (Phase 2).
4. Update terms and CI guardrails (Phase 4).

## Phased execution order

| Phase | Name | Owner Specialist | Depends On | Files |
|-------|------|------------------|------------|-------|
| 1 | User-facing copy remediation | Taro Mini-Program Frontend Engineer (mini-program) + Backend Engineer (server copy) | — | `apps/mini-program/src/lib/utils/loadingWhispers.ts`, `apps/mini-program/src/pages/event-detail/index.tsx`, `apps/server/src/routes/domains/aiServices.ts`, `apps/server/src/inference/smartInference.ts`, `apps/mini-program/src/pages/pool-registration/components/intentFeedback.ts`, `packages/shared/src/constants.ts`, `apps/mini-program/src/pages/onboarding/essential-data/index.tsx`, `apps/mini-program/src/pages/blind-box-payment/lib/paymentRitualCopy.ts`, `apps/mini-program/src/lib/matching/chemistryPayoff.ts`, `apps/mini-program/src/pages/event-feedback/index.tsx`, `apps/mini-program/src/pages/icebreaker-session/index.tsx`, `apps/mini-program/src/pages/icebreaker-session/components/SpeedFriendingPhaseView.tsx`, `apps/mini-program/src/lib/utils/momentsPosterFactory.ts`, `apps/mini-program/src/pages/matching-status/index.tsx`, `docs/proposals/*`, `PRODUCT_REQUIREMENTS.md` |
| 2 | AIGC compliance hardening | AI Engineer + Backend Engineer + Taro Mini-Program Frontend Engineer | Phase 1 | All AI service files under `apps/server/src/ai/`, `apps/server/src/inference/`, `apps/server/src/services/`, `apps/server/src/socialIcebreaker*AI.ts`, `apps/server/src/lib/contentSafety.ts`, new moderation helper, `apps/mini-program/src/components/ai-content/AIGCLabel.tsx` (new), `apps/mini-program/src/components/report/*` (new/extend), `packages/shared/src/legal/joyjoinTermsZh.ts`, `packages/shared/src/schema.ts` (reports), `apps/server/src/routes/domains/reports.ts` |
| 3 | Operator-review gate for matching | Backend Engineer (matching + admin API) + Taro Mini-Program Frontend Engineer (client states) + Admin Client Frontend (admin UI) | Phase 1, Phase 2 patterns, schema decision | `packages/shared/src/schema.ts`, `packages/shared/src/api.ts`, `apps/server/src/lib/featureFlags.ts`, `apps/server/src/lib/buildAuthUserResponse.ts`, `apps/server/src/poolMatchingService.ts`, `apps/server/src/poolRealtimeMatchingService.ts`, `apps/server/src/routes/domains/adminMatchingReview.ts` (new), `apps/server/src/repositories/matchingReviewRepo.ts` (new), `apps/admin-client/src/pages/admin/AdminEventPoolsPage.tsx`, `apps/mini-program/src/pages/matching-status/index.tsx`, `apps/mini-program/src/pages/squad-unboxing/index.tsx` |
| 4 | Guardrails & docs | Backend Engineer / General + docs-sync | Phases 1–3 | `scripts/check/check-guardrails.mjs` (or new script), `AGENTS.md`, `PRODUCT_REQUIREMENTS.md`, `docs/copy/brand-copy-strategy.md`, `docs/LAUNCH_CONFIG.md` |

## Per-phase details

### Phase 1 — User-facing copy remediation
- **Goal:** Remove the 5 AI/algorithm mentions and reframe positioning-sensitive terms to activity-first / small-group framing.
- **Specialist:** Taro Mini-Program Frontend Engineer (mini-program surfaces) + Backend Engineer (server-side copy surfaces).
- **Model:** DeepSeek V4 Pro (1.00x) — sufficient for multi-file copy replacement with type-check discipline.
- **Estimated premium cost:** ~1.0x.
- **Key constraints:**
  - Replace `romance` intent option in `INTENT_OPTIONS` with an activity-first option (e.g., `尝鲜体验` / `试试新玩法` or `慢热友好` / `节奏柔和，不赶场`). Do not keep the `romance` value with a vibe label — that is deceptive framing.
  - Maintain `XIAOYUE_CRAFT_PRINCIPLES` for any replacement Xiaoyue copy.
  - Do not introduce new banned words.
- **Verification:**
  - `npm run guardrails` passes.
  - `npm run typecheck -w mini-program` and `npm run typecheck -w @joyjoin/server` pass.
  - `rg` scan on changed files for 🔴 banned words returns 0 occurrences: `陌生人`, `陌生人社交`, `约会`, `心动`, `浪漫`, `缘分`, `脱单`, `婚恋`, `邂逅`, `相亲`, `处CP`, `暧昧`, `同城交友`, `附近的人`, `速配`, `配对成功`, `牵线`, `红线`, `荷尔蒙`, `桃花`, `交友平台`, `AI 匹配`, `AI 算法`, `AI 推荐`, `匹配算法`, `智能匹配`, `算法匹配`.
- **Rollback:** Revert the phase commit; original strings remain in git history.

### Phase 2 — AIGC compliance hardening
- **Goal:** Add AIGC labels, post-generation moderation, reporting channel, and terms clauses.
- **Specialist:** AI Engineer (server moderation wrap) + Backend Engineer (reports/terms) + Taro Mini-Program Frontend Engineer (labels + reporting UI).
- **Model:** DeepSeek V4 Pro with high reasoning for server moderation; Kimi K2.6 for cross-surface UI coordination.
- **Estimated premium cost:** ~1.5x combined.
- **Key constraints:**
  - Moderation must use `validateContentSafe()` from `contentSafety.ts`.
  - Deterministic fallback must be safe (no AI-generated text) and on-brand.
  - AIGC label primary copy: `AI 生成内容`. Use `AI 辅助生成` only where output clearly augments user-provided content (e.g., profession reaction built on user text).
  - Reporting category `ai_content` must be added to shared schema and report API.
- **Verification:**
  - Unit tests: every AI service returns `AIGC` meta label; moderation failure triggers fallback.
  - `npm run test -w @joyjoin/server` passes.
  - Manual UI checklist: labels appear on personality analysis, match analysis, icebreaker topics/challenges, profession reactions, recap, event themes, profile tagline.
- **Rollback:** Gate new UI labels and moderation passes behind a single `AIGC_LABELS_ENABLED` kill-switch defaulting to off; the server fallback path is always safe.

### Phase 3 — Operator-review gate for matching
- **Goal:** Add `matchingOperatorReviewEnabled` flag, new pool/group states, and admin review flow while preserving auto-match when disabled.
- **Specialist:** Backend Engineer (matching state machine + admin API) + Taro Mini-Program Frontend Engineer (pending-review copy) + Admin Client Frontend (review UI).
- **Model:** DeepSeek V4 Pro for matching state machine changes + Kimi K2.6 for cross-workspace client/admin coordination.
- **Estimated premium cost:** ~2.0x combined.
- **Key constraints:**
  - Default flag value `false` → existing `confirmed` flow unchanged.
  - When flag `true`: `saveMatchResults()` writes groups with `status: "pending_review"` and `pool.status: "review_required"`, skipping notifications and venue assignment.
  - Admin approve: atomically updates group to `confirmed`, pool to `matched`, fires notifications, runs venue assignment.
  - Admin reject: requires a reason, resets pool to `active`, revokes pending groups, and notifies registered users. Store reason on the pool record.
  - Admin endpoints behind `requireOperatorOrAbove` and emit `logAdminAudit(...)`.
- **Verification:**
  - `poolMatchingService.test.ts` covers both flag states.
  - `npm run test -w @joyjoin/server` passes.
  - Admin API integration tests for approve/reject.
  - Mini-program pending-review states render correctly.
- **Rollback:** Toggle `matchingOperatorReviewEnabled=false` restores auto-match; DB migration is additive only.

### Phase 4 — Guardrails & docs
- **Goal:** CI-enforce the banned positioning word list and update canonical docs.
- **Specialist:** Backend Engineer / General.
- **Model:** DeepSeek V4 Flash for dictionary/script additions; DeepSeek V4 Pro for doc updates.
- **Estimated premium cost:** ~0.5x.
- **Key constraints:**
  - Guardrail targets user-facing copy directories: `apps/mini-program/src/`, `packages/shared/src/copy/`, `docs/copy/`, `packages/shared/src/legal/`.
  - 🔴 Always banned in user-facing product copy: `陌生人`, `陌生人社交`, `约会`, `心动`, `浪漫`, `缘分`, `脱单`, `婚恋`, `邂逅`, `相亲`, `处CP`, `暧昧`, `同城交友`, `附近的人`, `速配`, `配对成功`, `牵线`, `红线`, `荷尔蒙`, `桃花`, `交友平台`, `AI 匹配`, `AI 算法`, `AI 推荐`, `匹配算法`, `智能匹配`, `算法匹配`.
  - 🟠 Allowed only in explicit contexts: `AI` (AIGC labels/terms only), `算法` (admin/technical docs, code comments, data-science occupations), `匹配` (e.g., `匹配偏好`, `匹配设置`, `默契匹配`, but never mechanism description), `推荐` (only personified as `悦仔推荐`), `社交` (allowed in isolation as brand vocabulary; banned in combinations like `陌生人社交`, `交友社交`).
  - Docs updates reflect “兴趣活动驱动的轻社交” terminology. Do not claim “纯报名工具.”
- **Verification:**
  - `npm run guardrails` fails on a test commit containing a banned word.
  - `npm run guardrails` passes after all copy changes.
  - Docs updated and reviewed.
- **Rollback:** Revert guardrail script or dictionary commit.

## PM scope amendments (applied to this plan)
- **Romance intent:** Do not keep `romance` value with a vibe label. Replace it in `INTENT_OPTIONS` with an activity-first option (e.g., `尝鲜体验` / `试试新玩法` or `慢热友好` / `节奏柔和，不赶场`).
- **AIGC label copy:** Primary label is `AI 生成内容`. `AI 辅助生成` is allowed only where output augments user-provided content.
- **Banned-word list:** Expanded and scoped to user-facing copy directories. Bare `AI` / `算法` / `匹配` / `推荐` / `社交` allowed only in explicit contexts.
- **Positioning reframe:** Lock to “兴趣活动驱动的轻社交” — not a pure signup tool, not a dating app.
- **Operator-review gate:** Reject requires a reason stored on the pool record.
- **Legal review:** Required before merging terms update.
- **Conversion instrumentation:** Baseline captured before Phase 1; weekly metrics for 4 weeks post-ship.

## Deferred scope
- Historical AI content back-labeling.
- Multi-language terms localization.
- Polished admin review dashboard beyond minimum queue.
- New LLM judge beyond `validateContentSafe()`.
- Removing core social features (connections tab, WeChat exchange, blind-box reveal); this refactor changes copy, not feature set.

## Risk and rollback plan

| Risk | Mitigation | Rollback |
|------|------------|----------|
| Copy changes break UI tests or type checks | Type-check each phase before proceeding | Revert the phase commit |
| AIGC moderation adds latency or false positives | Fallback path is deterministic and cached; start with non-blocking post-generation check | Disable `AIGC_LABELS_ENABLED` flag |
| Matching flag on causes pools to stall in `review_required` | Flag defaults off; admin review UI ships in same PR; document manual recovery | Toggle flag off; script to auto-approve pending groups |
| Admin approve/reject race conditions | Use transaction + `FOR UPDATE` on pool/group rows; idempotent approve | Revert matching-service commit; keep DB columns additive |
| Terms update is legally insufficient | Flag as "legal review required" blocker; do not ship until legal ACK | Revert terms commit |
| Romance intent reframe hurts conversion or confuses users | A/B test or pre/post measurement; use clear activity-first label | Revert intent option change |
| Banned-word guardrail false positives | Restrict scan to user-facing copy directories only | Revert guardrail dictionary or scope |
| Positioning over-reframe (“signup tool”) contradicts product | Lock to “兴趣活动驱动的轻社交” in docs and copy | Revert doc/copy commits |

## Model Recommendation for Execution

| Phase | Recommended Model | Justification | Est. Premium Cost |
|-------|-------------------|-------------|-------------------|
| 1 | DeepSeek V4 Pro | Multi-file copy replacement; moderate blast radius; needs type-check discipline | 1.0x |
| 2 | DeepSeek V4 Pro (server) + Kimi K2.6 (UI) | Moderation wrap needs reasoning; UI labels/report entry touch multiple mini-program surfaces | 1.5x combined |
| 3 | DeepSeek V4 Pro + Kimi K2.6 | Matching state machine is high-stakes; cross-workspace client/admin coordination | 2.0x combined |
| 4 | DeepSeek V4 Flash / Pro | Script/docs work is lower complexity; Flash sufficient for dictionary additions | 0.5x |

**Total estimated premium request cost:** ~5.0x DeepSeek V4 Pro equivalent units.
