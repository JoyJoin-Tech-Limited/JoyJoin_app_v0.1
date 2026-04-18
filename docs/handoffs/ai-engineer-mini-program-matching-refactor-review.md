# AI Engineer handoff — mini-program matching / reveal refactor (review)

**Purpose:** Optional **AI Engineer** pass after Phases 0–4 of [`docs/proposals/mini-program-cleanup-and-upgrade-plan.md`](../proposals/mini-program-cleanup-and-upgrade-plan.md). Client refactors should **not** change server AI behavior; this handoff asks you to **confirm boundaries** and flag any **follow-ups** if the MP surfaces still align with runtime AI safety expectations.

**Load first:** [`.github/agents/ai-engineer.agent.md`](../../.github/agents/ai-engineer.agent.md), [`.cursor/skills/llm-runtime-safety-and-integration/SKILL.md`](../../.cursor/skills/llm-runtime-safety-and-integration/SKILL.md) (or `.github/skills/` mirror if present).

---

## What shipped (client; no intentional server AI edits in this track)

| Area | Change | AI-adjacent surface |
|------|--------|---------------------|
| Matching status | `useMatchingStatusController`, `resolvePersistedThemeSummary`, shared query keys `['mini-program', …]` | Still uses `getPoolGroupAnalysis` via React Query; invalidation paths preserved |
| Squad unboxing | `useSquadUnboxingController`, view models | Same analysis + group detail queries as before |
| Pool / icebreaker | Form module + `icebreakerSessionModel` | No LLM paths |

**Canonical navigation / URLs:** [`apps/mini-program/src/lib/matchingNavigation.ts`](../../apps/mini-program/src/lib/matchingNavigation.ts).

---

## What we need from AI Engineer (refinement / risk review)

1. **Deterministic vs AI authority** — Confirm nothing in the refactor implies client-side ownership of match scores, group formation, or analysis truth (still server + cache as before).
2. **Group analysis consumption** — Review how MP reads `pool-group-analysis` and related types (`fromCache`, `generatedAt`, fallbacks in UI). Flag if **display** changes could misrepresent cache vs fresh generation without server changes.
3. **Observability parity** — If analysis or explanation flows are triggered differently (e.g. fewer refetches), note whether **server-side** `AITrace` / product metrics remain representative (client-only refactors usually **no change**; call out if you see a gap).
4. **No new ad-hoc model paths** — Confirm MP did not add any new LLM or embedding calls as part of this work (it should not have).

---

## Repo anchors to skim (server + shared)

- `apps/server` — group analysis / match explanation owning services (e.g. patterns in `matchExplanationService`, routers under `apps/server/src/ai/` per skill doc).
- `packages/shared` — contracts for pool group analysis and WS events if you verify end-to-end semantics.
- MP: `apps/mini-program/src/pages/matching-status/useMatchingStatusController.ts`, `.../matchingStatusViewModels.ts` (`resolvePersistedThemeSummary`).

---

## Paste-ready prompt (for AI Engineer session)

```text
You are AI Engineer for JoyJoin. Read docs/handoffs/ai-engineer-mini-program-matching-refactor-review.md and perform a refinement / risk review (not a full re-implementation).

Focus: deterministic authority vs LLM-backed analysis display, cache metadata honesty, and whether the recent mini-program refactor (matching-status controller, theme merge helper, squad-unboxing hook, pool-registration form module) left any accidental gap for AI safety or observability.

Deliverable: short structured note per .github/agents/ai-engineer.agent.md (runtime boundary, safety/fallback, observability, validation). Call out only actionable follow-ups; if no server or contract change is required, say so explicitly.
```

---

## Suggested next agents (only if you find gaps)

- **QA Agent** — if you recommend E2E or regression checks on analysis refresh after WS events.
- **Taro Mini-Program Frontend Engineer** — if issues are purely MP UX/copy.

**Recorded:** 2026-04-19 — handoff template for optional AI Engineer review after mini-program structural phases.

**Follow-up implemented:** `EVENT_THEME_TITLE_REVEALED` in `useMatchingStatusController` now also invalidates `['mini-program', 'pool-group-analysis', groupId]` when `groupId` is present (keeps AI analysis refetch aligned with theme/group updates).
