# Mini-program cleanup & iterative upgrades — implementation plan

**Status:** **Approved** (2026-04-19). All phases (0–5) cleared to proceed iteratively; still execute in order with phase gates—approval is not a mandate to parallelize dependent work.

**Framing:** [First-principles velocity](../../.github/skills/first-principles-velocity/SKILL.md) — one **mission**, explicit **constraints**, a named **bottleneck**, **smallest validating proof** per phase, **ruthless deletion** where safe, **escalation with evidence** when blocked.

---

## 1. Mission (one sentence)

**Reduce structural risk and cycle time** on the launch-primary WeChat mini-program by **quarantining or removing** duplicate paths and **incrementally extracting** testable ownership boundaries—**without** breaking auth, payments, onboarding authority, or matching truth.

---

## 2. Hard constraints (before any solution)

| Constraint | Implication |
|------------|-------------|
| **WeChat runtime** | Subpackages, `preloadRule`, native tab bar, Skyline caveats — refactors must not assume web-only React patterns blindly. |
| **Server authority** | Onboarding `nextStep`, match status, payments — client is **thin**; no new “source of truth” on device. See [`onboarding-state-architecture`](../../.github/skills/onboarding-state-architecture/SKILL.md), [`payment-entitlement-authority`](../../.github/skills/payment-entitlement-authority/SKILL.md). |
| **Sibling surfaces** | Shared contracts live in `packages/shared`; coordinate with web per [`docs/reference/reference/PLATFORM_COORDINATION.md`](../reference/PLATFORM_COORDINATION.md) and [`platform-coordination-protocol`](../../.github/skills/platform-coordination-protocol/SKILL.md). |
| **Blast radius** | `matching-status`, payments, icebreaker — treat as **high**; use stronger review / smaller PRs. |

---

## 3. Problem statement (inversion)

**What fails even if pixels are perfect:** subtle **desync** between WebSocket events, React Query cache, and local UI state; **unreviewable** 800+ line pages; **duplicate** navigation or merge logic for theme/group data. Failures manifest as **wrong screen, stale theme, double navigation**—not TypeScript errors.

**Bottleneck:** **Orchestration density** in the heaviest flows (especially `matching-status`) — one file owns too much of the critical path.

---

## 4. Guiding principles

1. **Vertical slice ownership** — one PR owns API contract + MP consumer + tests for a slice when the slice changes behavior.
2. **Smallest validating proof** — tests or manual runbook steps **before** large moves; no “big bang” rewrite.
3. **Delete / quarantine** — remove dead flags, duplicate CTAs, unused imports; quarantine legacy with explicit comments + issue link if Product has not blessed removal.
4. **No parallel dependent work** — e.g. do not “also” redesign squad-unboxing in the same PR as matching-status extraction.

---

## 5. Phased plan

### Phase 0 — Baseline & guardrails (no user-visible behavior change)

**Goal:** Lock invisibility before edits; give a **single command** checklist for regressions.

| Action | Done when |
|--------|-----------|
| Confirm `npm run typecheck -w mini-program` in CI / pre-push habit | Green on `main` |
| Extend or run [`docs/runbooks/mini-program-ai-smoke.md`](../runbooks/mini-program-ai-smoke.md) for touched AI surfaces | Checklist signed for release candidate |
| Document current **query key** conventions for pool registration / group analysis / matching (`['mini-program', ...]`) in MP README or a short `docs/mini-program-data-fetching.md` | New doc or README section merged |
| Optional: snapshot **bundle / page list** for subpackage boundaries (reference [`docs/reference/reference/perf.md`](../reference/perf.md)) | Baseline noted |

**Exit:** Team agrees “what green looks like” for Phases 1–2.

---

### Phase 1 — Cleanup (low risk, high drag reduction)

**Goal:** Remove confusion and duplicate entrypoints **without** architectural rewrites.

| Track | Examples | Verification |
|-------|----------|--------------|
| **Navigation** | Single helper for “open matched journey” / pool detail; audit `Taro.navigateTo` vs `switchTab` for tab rules | Manual smoke on matched + pending paths |
| **Dead code** | Unused imports, orphaned components, deprecated flags (grep + Product confirm) | Typecheck + lint |
| **Logging** | Consistent `logInfo` / `logError` prefixes for matching WS handlers | DevTools log review |
| **Styles** | Split only if a file blocks reviews; prefer no drive-by full SCSS rewrites | Visual spot-check |

**Exit:** Smaller diffs on the next feature PR; no new user-facing regressions.

---

### Phase 2 — Extract matching-status controller (high value, controlled blast radius)

**Goal:** Move **orchestration** out of `pages/matching-status/index.tsx` into a dedicated module.

| Deliverable | Notes |
|-------------|--------|
| `useMatchingStatusController(registrationId)` **or** `matchingStatusFlow.ts` | Owns: React Query queries, WS subscription setup/teardown, `liveStage` transitions, invalidation of `pool-registration`, `pool-group`, `pool-group-analysis` as today |
| **Page file** | Layout, hero, composition, router params only — target **&lt;400 lines** over time |
| **`matchingStatusViewModels.ts`** | Keep pure helpers; avoid growing the hook with copy strings |
| **Tests** | Extend [`composition.test.ts`](../../apps/mini-program/src/pages/matching-status/composition.test.ts) pattern; add **unit tests** for reducer / transition table if introduced |

**Non-goals in the same PR:** Squad-unboxing redesign; server API changes.

**Exit:** Matching journey behavior **parity** with a written test + runbook checklist.

---

### Phase 3 — Theme & group summary: single merge policy

**Goal:** One function (and one doc block) for **precedence**: WS theme reveal vs `getMyPoolRegistrations` vs `getPoolGroupDetails`.

| Deliverable | Notes |
|-------------|--------|
| `resolvePersistedThemeSummary(...)` (name illustrative) | Pure function + tests for ordering |
| Comments at call sites | “Why this wins over that” |
| Optional | Align field names with [`docs/reference/reference/PLATFORM_COORDINATION.md`](../reference/PLATFORM_COORDINATION.md) |

**Exit:** No contradictory theme lines in dev; fewer “which field is live?” questions in review.

---

### Phase 4 — Secondary heavy flows (iterative, after Phase 2 stabilizes)

**Goal:** Apply the **same pattern** where complexity is high.

| Page / area | Approach |
|-------------|----------|
| `squad-unboxing` | Extract flow hook if file size / WS overlap justifies |
| `icebreaker-session` | Phase table + `phaseViews` already split; reduce prop drilling if painful |
| `pool-registration` | Flow config + validation in one module (already partial via `flowConfig.ts`) |

**Exit:** Each merge has its own **small** test or runbook delta.

---

### Phase 5 — DevEx & vertical slice smoke (optional, not blocking product)

**Goal:** Faster **human** confidence on the hardest path.

| Idea | Notes |
|------|--------|
| Script or Makefile target | Documented sequence: start server, seed or use test account, open DevTools path — even if partially manual |
| Align with [`docs/runbooks/matching-stress-simulation.md`](../runbooks/matching-stress-simulation.md) | Server-side CPU stress is **not** a substitute for MP E2E |

**Exit:** New contributor can run “happy path” in &lt;15 minutes **with** docs.

---

## 6. Verification gates (each phase)

- [ ] `npm run typecheck -w mini-program`
- [ ] Relevant runbook section updated if user-visible behavior or flags change
- [ ] If shared types or API contracts change: **`docs/reference/reference/PLATFORM_COORDINATION.md`** or sibling client noted
- [ ] Orchestration / agents unchanged unless `.github/` edited — then `npm run orchestration:validate`

---

## 7. Risks & rollback

| Risk | Mitigation |
|------|------------|
| WS timing regressions | Feature flag **not** required for extraction if behavior is parity-tested; keep commits revertible |
| Merge conflicts on large pages | Phase 2 in **one** focused PR; rebase often |
| Scope creep | **Reject** “while we’re here” redesigns — separate issues |

**Rollback:** Git revert of the extraction PR; Phase 0 baseline proves pre-change behavior.

---

## 8. Ownership (suggested)

| Phase | Primary owner |
|-------|----------------|
| 0 | Any MP contributor + QA checklist |
| 1–2 | Taro / mini-program engineer (see [`.github/agents/taro-mini-program-frontend-engineer.agent.md`](../../.github/agents/taro-mini-program-frontend-engineer.agent.md)) |
| 3 | Same + brief server/web consult if contract changes |
| 4 | Per-page as prioritized by Product |
| 5 | Platform / DX owner |

**Escalation:** Blocked on Product (copy, flags) or ambiguous precedence — **one** message with repro + file paths (per skill theme 5).

---

## 9. Anti-patterns (do not)

- Rewriting three pages at once “for consistency”
- Skipping tests because “refactor only” (matching path is **not** trivial)
- Duplicating server business rules on the client
- Premium model spend on mechanical-only edits; **stronger** review for Phase 2–3 shape

---

## 10. Relationship to other docs

- [`apps/mini-program/README.md`](../../apps/mini-program/README.md) — entrypoints and tab bar truth
- [`docs/mini-program-ai-roadmap-handoff.md`](../mini-program-ai-roadmap-handoff.md) — AI track; **orthogonal** unless merge logic touches AI surfaces
- This proposal — **structural** cleanup and iteration; close or update when Phases 0–2 are done

---

## 11. Approval

| Role | Sign-off |
|------|----------|
| Product | **Approved** — Phases 2–3 user-visible scope (2026-04-19) |
| Engineering | **Approved** — phase ordering, gates, Phase 2 ownership model (2026-04-19) |

**Recorded decision:** Full plan (Phases 0–5) approved as one backlog; phases stay **sequential** by default—do not parallelize dependent work without an explicit follow-up decision.

**Note:** Formal sign-off may be updated with owner names in your process; the dated approval above reflects **go-ahead to execute** the proposal as written.

**Next action:** Start **Phase 0** (baseline & guardrails), then **Phase 1** in the same or following sprint; assign an owner for **Phase 2** (`matching-status` extraction) before starting heavy refactors.
