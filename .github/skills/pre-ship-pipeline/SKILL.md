---
name: pre-ship-pipeline
description: >
  Thin orchestrator that sequences JoyJoin's full pre-ship quality chain end-to-end:
  code review → post-implementation review swarm → UI layout/design/completeness audits
  → performance audit → fix → polish. Does no auditing itself — it orders the existing
  skills, hands off between them, and replaces their five separate grill-me interviews
  with ONE consolidated end-of-pipeline stress-test. Use before calling any non-trivial
  change "done" or merging a PR. Trigger phrases: "pre-ship pipeline", "full quality
  pipeline", "run the whole review chain", "ship readiness pipeline", "review then fix
  then polish", "end-to-end quality gate", "ready to ship".
---

# Pre-Ship Pipeline

**Core rule:** This skill does **zero** auditing itself. It sequences the existing audit skills in the right order, hands off between them, and collapses their five separate grill-me interviews into a **single** consolidated end-of-pipeline stress-test. Each individual skill keeps full authority over its own domain — this only owns the ORDER and the final gate.

## When to use this skill

- Before calling a non-trivial change "done" or merging a PR
- When you would otherwise manually chain code review → QA → design/completeness/perf audits → fix → polish
- Pre-launch readiness on a new page, flow, or feature

**Do NOT use for:** a one-line typo fix (run `harness-completion-gate` only), or a single-skill audit (load that skill directly — its own grill-me then applies).

## The sequence

Run steps in order; skip a step only when that skill's own "when NOT to use" applies. Design/perf steps apply to user-facing (mini-program) surfaces only.

| # | Step | Skill | Output / gate |
|---|------|-------|---------------|
| 1 | Code review | `code-review` | correctness + 5-pillar verdict; loads domain skills |
| 2 | Review swarm | `post-implementation-review` | PASS / PARTIAL / FAIL (blocking-only fix loop) |
| 3 | Design audit | `ui-layout-audit` → `frontend-design-audit` → `completeness-audit` (Pipeline Mode) | 完成度 score + ROI gap register; Class A visual defects block |
| 4 | Performance | `performance-audit` | PASS / WARN / BLOCK |
| 5 | Fix | `process-systematic-debugging` (non-obvious bugs) | all BLOCKING / P0 / Class A resolved |
| 6 | Polish | `wow-elements` (only if completeness dim 5 ≤2) | key emotional moment crafted |
| 7 | Final gate | `harness-completion-gate` | `npm run harness:gate` green |

**Fix-loop rule (prevents over-polishing):** only **BLOCKING / P0 / Class A correctness** items trigger a fix loop. CONCERN / craft / NIT findings are logged, not blocking — the same severity discipline as `post-implementation-review` and the Rendered-Truth Visual Gate.

## Consolidated grill-me (replaces the 5 separate interviews)

Each audit skill mandates its own grill-me when run **standalone**. Inside this pipeline, do **not** run all five — run **one** cross-domain stress-test after step 5, one question per turn, covering the highest-risk assumption per domain:

1. **Correctness:** "What input or state breaks the happy path, and where is the test for it?"
2. **Visual truth:** "Was the screen actually rendered and vision-reviewed, or is this a code-read guess? Any Class A defect?"
3. **Completeness:** "Which of the 11 dimensions scored ≤2, and is it Q1 (do-first)?"
4. **Performance:** "Which dimension scored <8, and what is the primary-tier device evidence?"
5. **Polish:** "Is the single polished moment the most emotionally significant one — and is it reduced-motion safe?"
6. **Ship decision:** "Name the one thing that would make you roll this back in production."

If any answer is a guess, route back to that skill for its full standalone grill-me.

## Quick example

**New onboarding step (mini-program):** code-review (loads `onboarding-state-architecture`) → swarm PASS → Pipeline Mode 31/44 坚稳 → perf PASS → fix 1 blocking (missing error state) → wow-elements on the completion moment → consolidated grill-me → `npm run harness:gate` green → ship.

## Troubleshooting

- **A step's skill says "when NOT to use"** → skip it and note why (e.g., a backend-only change skips steps 3, 4, and 6).
- **Grill-me fatigue** → you are running the per-skill interviews inside the pipeline; use the single consolidated one above instead.
- **Conflicting verdicts** (swarm PASS but a design audit flags Class A) → the stricter gate wins; Class A correctness always blocks.
- **Pipeline takes longer than the change** → for trivial changes, run only steps 1, 5 (if needed), and 7.

## Review checklist

- [ ] Steps run in order; any skipped step justified by that skill's own "when NOT to use"
- [ ] Fix loop triggered ONLY on BLOCKING / P0 / Class A correctness items
- [ ] Exactly ONE consolidated grill-me ran (not five separate interviews)
- [ ] Any guessed grill-me answer routed back to that skill's standalone grill-me
- [ ] CONCERN / craft / NIT findings logged but non-blocking
- [ ] `npm run harness:gate` green before declaring done
