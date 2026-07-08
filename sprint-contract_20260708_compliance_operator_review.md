---
{
  "sprintId": "sprint_20260708_compliance_operator_review",
  "parentPlanId": "plan_20260708_compliance_operator_review",
  "generatorAgent": "Planner",
  "contractEvaluator": "Verifier",
  "sprintEvaluator": "QA Agent",
  "status": "accepted",
  "tier": 3,
  "createdAt": "2026-07-08T12:00:00Z",
  "acceptedAt": "2026-07-08T14:00:00Z",
  "maxEvaluatorIterations": 3,
  "goal": "Make JoyJoin compliant with AIGC and product-positioning requirements and add a default-off operator-review gate for matching group formation."
}
---

# Sprint Contract: Compliance, Positioning & Matching Operator Review

## 1. Goal
Deliver PRC AIGC and product-positioning compliance across user-facing copy, AI-generated content, and the matching state machine, while introducing a default-off operator-review gate for group matching that preserves existing automated behavior when disabled. Positioning reframe: “兴趣活动驱动的轻社交” — activities are the primary container; natural connection is the valued outcome.

## 2. Acceptance Criteria (testable)

| ID | Criterion | Verification Method | Threshold |
|----|-----------|---------------------|-----------|
| AC-01 | The following 5 AI/algorithm user-facing mentions are removed or reframed: (1) `匹配算法已经喝了三杯咖啡，精神得很。` in `loadingWhispers.ts`; (2) `加入我们的智能客服` in `event-detail/index.tsx`; (3) `我们的算法已初步读懂你的社交画像` in `aiServices.ts`; (4) `这些答案会帮助算法找到和你气场相合的小伙伴。` in `smartInference.ts`; (5) `悦仔会把这个方向写进匹配公式。` in `intentFeedback.ts` | `rg` scan on changed files + manual review | 0 occurrences of the 5 strings |
| AC-02 | `romance` intent option is removed from the user-facing intent grid or replaced with an activity-first option (e.g., `尝鲜体验` or `慢热友好`); it is not merely renamed to `轻松氛围` | Read `packages/shared/src/constants.ts` + mini-program intent grid | No `romance` value in user-facing `INTENT_OPTIONS` or label is clearly activity-first |
| AC-03 | All positioning-sensitive terms in the listed files are reframed to activity-first / small-group copy. Banned in user-facing product copy (🔴): `陌生人`, `陌生人社交`, `约会`, `心动`, `浪漫`, `缘分`, `脱单`, `婚恋`, `邂逅`, `相亲`, `处CP`, `暧昧`, `同城交友`, `附近的人`, `速配`, `配对成功`, `牵线`, `红线`, `荷尔蒙`, `桃花`, `交友平台`, `AI 匹配`, `AI 算法`, `AI 推荐`, `匹配算法`, `智能匹配`, `算法匹配`. Scan scoped to `apps/mini-program/src/`, `packages/shared/src/copy/`, `docs/copy/`, `packages/shared/src/legal/` | `rg` scan for banned words + PM review | 0 occurrences of 🔴 words in target directories |
| AC-04 | Every AI-generated text surface returned to users carries an explicit `AI 生成内容` label; `AI 辅助生成` is allowed only where output augments user-provided content. Surfaces: personality analysis, match/group analysis, icebreaker topics/challenges, profession reactions, recap summaries, event themes, profile tagline, AI-generated share-card copy | UI checklist + server response inspection | Labels present on all listed surfaces; label copy matches rule |
| AC-05 | Every AI service calls `validateContentSafe()` on generated output before returning content, with deterministic fallback on failure | Code review + unit tests | 100% coverage of AI service files; tests pass |
| AC-06 | A new `ai_content` report category exists, with UI entry points on AI-generated cards/sheets | Schema review + mini-program UI checklist | Category present; entry points reachable |
| AC-07 | `packages/shared/src/legal/joyjoinTermsZh.ts` includes AIGC clauses | Diff review + legal sign-off tracked | Clauses present |
| AC-08 | `matchingOperatorReviewEnabled` flag defaults to `false` and is resolved via canonical feature-flag resolver | Read `lib/featureFlags.ts` + `buildAuthUserResponse.ts` | Default false; admin toggleable |
| AC-09 | When flag is enabled, `saveMatchResults()` writes `pending_review` groups and `review_required` pool state, skipping notifications and venue assignment | `poolMatchingService.test.ts` + integration test | Tests pass |
| AC-10 | Admin approve/reject endpoints exist behind correct RBAC with audit logs; reject requires a reason stored on the pool record | Code review + API tests | Approve writes `confirmed` + triggers notifications/venue; reject resets pool to `active` with reason |
| AC-11 | Mini-program matching-status and squad-unboxing show warm pending-review copy when group is `pending_review` | UI review + test render | Copy renders correctly |
| AC-12 | CI guardrail catches the banned positioning word list | Test commit with banned word + `npm run guardrails` | Guardrail fails |
| AC-13 | `AGENTS.md` and `PRODUCT_REQUIREMENTS.md` reflect new positioning | Diff review | Docs updated |
| AC-14 | Legal review sign-off is obtained before the terms update is merged | Legal approval tracked in PR / contract | Signed off |
| AC-15 | Conversion instrumentation is in place before Phase 1 ships: baseline metrics captured (intent-selection distribution, onboarding completion rate, registration-to-discovery conversion, payment conversion); post-ship tracking via `intent_selection_changed`, `onboarding_completed`, `pool_registration_completed`, `payment_initiated`, `payment_completed` events; weekly metric review for 4 weeks | Analytics review + event schema review | Baseline captured; events instrumented; weekly review scheduled |
| AC-16 | `AIGC_LABELS_ENABLED` feature flag exists, defaults to `false`, and is resolved via the canonical feature-flag resolver; labels are only rendered when flag is enabled | Read `lib/featureFlags.ts` + `buildAuthUserResponse.ts` + UI conditional | Flag default false; labels gated |
| AC-17 | All schema changes for operator review (`event_pools`, `pool_groups`, reports) and AIGC reports are additive and non-destructive | Migration file review + `npm run db:verify` | No destructive migrations; additive columns only |
| AC-18 | `AGENTS.md` and `PRODUCT_REQUIREMENTS.md` use the positioning phrase “兴趣活动驱动的轻社交” and avoid “纯报名工具” framing | Diff review | Phrase present; no “纯报名工具” claims |

## 3. Harness Pillar Criteria

### Reliability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| REL-01 | Matching operator-review state changes are atomic (transaction + row locks) and idempotent | `poolMatchingService.test.ts` + integration tests | PASS |
| REL-02 | AIGC moderation fallback is deterministic and never returns unmoderated AI text | Unit tests for each AI service | PASS |
| REL-03 | Feature-flag default is safe (`matchingOperatorReviewEnabled=false`) and flag resolution is cached/validated | `featureFlags.ts` tests + startup validation | PASS |

### Scalability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SCA-01 | Post-generation moderation does not add >100ms p99 latency to AI calls (cached/short-circuit) | Local benchmark or manual timing | ≤100ms |
| SCA-02 | Admin review list endpoint is paginated and indexed | Code review | Pagination + DB index |

### Security
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| SEC-01 | Admin approve/reject routes are behind `requireOperatorOrAbove` and emit `logAdminAudit(...)` | Code review + audit log test | PASS |
| SEC-02 | Report category `ai_content` is protected against spam/abuse | Rate limit + `validateContentSafe()` on report body | PASS |

### Observability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| OBS-01 | AIGC moderation failures are logged with `fallbackUsed` and content source | Log inspection / `logAITrace` | PASS |
| OBS-02 | Matching operator-review state transitions emit structured logs | Log inspection | PASS |

### Maintainability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| MAINT-01 | AIGC label is a shared component reused across surfaces | Code review | Shared component used |
| MAINT-02 | New admin matching-review routes follow `routes/domains/` ownership | Code review | Routes in `routes/domains/adminMatchingReview.ts` |
| MAINT-03 | Guardrail banned-word list is centralized and documented; scan targets only user-facing copy directories | Code review + config review | Dictionary file or centralized array; directories scoped |

## 4. Out-of-Scope
- Web client (`apps/user-client`) changes; it is archived.
- Re-architecting the matching algorithm or scoring weights.
- Full legal review of terms; this PR drafts clauses and flags legal review as a launch blocker.
- Multi-language terms localization.
- Automated content moderation beyond the existing `validateContentSafe()` filter (no new LLM judge).
- Backfill of historical AI-generated content with labels.
- Polished admin review dashboard beyond the minimum approve/reject queue.
- Removing core social features (connections tab, mutual WeChat exchange, blind-box reveal) — this is a copy and compliance refactor, not a feature rewrite.

## 5. Verification Method Summary
- `npm run guardrails`
- `npm run typecheck` for affected workspaces
- `npm run test -w @joyjoin/server`
- `rg` scans for banned words
- Manual UI checklist for AIGC labels and pending-review states
- Admin API integration tests for approve/reject
- QA Agent Sprint Evaluation against this contract

## 6. Negotiation Log
- **[2026-07-08T12:00:00Z]** Planner proposed initial draft.
- **[2026-07-08T12:30:00Z]** Product Manager reviewed scope: APPROVE WITH AMENDMENTS — romance intent must be removed/replaced (not merely renamed), AIGC label uses `AI 生成内容`, banned-word list expanded and scoped to user-facing copy directories, positioning locked as “兴趣活动驱动的轻社交,” operator-review reject requires reason, legal review and conversion instrumentation added as gates.
- **[2026-07-08T13:00:00Z]** Verifier reviewed amended contract: ACK WITH AMENDMENTS — embedded the 5 AI mentions, banned-word list, AI-generated surfaces, conversion instrumentation, AIGC label kill-switch, additive migration, and positioning-doc criteria. PM amendment cycle is treated as the Tier-3 deliberation equivalent; a lightweight HRC sanity check will be run before Phase 3 begins.
- **[2026-07-08T14:00:00Z]** Verifier final sign-off: **ACK**. Contract accepted and ready to implement.
