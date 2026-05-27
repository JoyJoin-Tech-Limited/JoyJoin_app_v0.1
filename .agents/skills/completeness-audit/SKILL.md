---
name: completeness-audit
description: >
  Multi-dimensional completeness audit (完成度审计) for mini-program implementations.
  Scores 11 user-outcome dimensions (0–44), identifies functional and experiential gaps,
  and produces ROI-ranked strategic recommendations via 2-axis scatter (User Impact × Engineering Hours).
  Consumes ui-layout-audit and frontend-design-audit scores as baseline for visual finish and brand soul dimensions.
  Use post-build, pre-launch, or during PR review to catch what code review and tests miss.
  Supports Pipeline Mode: single trigger "完成度全流程" / "full audit pipeline" / "completeness pipeline"
  chains ui-layout-audit → frontend-design-audit → completeness-audit in sequence.
  Trigger phrases: "完成度 audit", "completeness audit", "gap analysis", "polish gaps",
  "is this ready to ship", "ship readiness", "what should we fix before launch", "pre-launch audit",
  "how complete is this", "does this feel done", "完成度全流程", "full audit pipeline", "completeness pipeline".
---

# 完成度 Audit (Completeness Audit)

**Core rule:** Catch what code review and tests miss — the gap between "it works" and "it feels complete."

## Pipeline Mode

Trigger `"完成度全流程"` / `"full audit pipeline"` / `"completeness pipeline"` to auto-sequence: `ui-layout-audit → frontend-design-audit → completeness-audit`. Each step feeds the next — do not skip.

## When to use this skill

- Post-build quality pass on a new page, component, or flow
- Pre-launch readiness check — "is this ready for users?"

## Prerequisites

Run these first (or Pipeline Mode auto-sequences them):

| Prerequisite | Feeds dimension | Mapping |
|---|---|---|
| `ui-layout-audit` | #9 Visual finish | Checklist score ÷ 17 × 4 → 0–4 |
| `frontend-design-audit` | #10 Brand soul | Dim 1 (Brand Fidelity) score → 0–4 |

If not run, score manually via `references/dimension-rubric.md`.

## The 11 Dimensions (0–4 each, total 0–44)

Full scoring criteria per dimension in [`references/dimension-rubric.md`](references/dimension-rubric.md).

| # | Dimension | What it audits | Auto-source |
|---|---|---|---|
| 1 | Functional completeness | Happy path + edge cases + error recovery | Manual |
| 2 | State completeness | Loading, empty, error, success, disabled, busy | Manual |
| 3 | Copy completeness | Microcopy, placeholders, confirmations, tooltips | Manual |
| 4 | Interaction completeness | Press feedback, transitions, gesture safety | Manual |
| 5 | Delight completeness | Key emotional moments crafted or flat? → fix with `wow-elements` | Manual |
| 6 | Flow completeness | Journey smooth entry→action→result→aftermath? | Manual |
| 7 | Accessibility completeness | Touch ≥88rpx, reduced-motion, safe areas | Manual |
| 8 | Taro discipline | ScrollView, subpackage, runtime safety | Manual |
| 9 | Visual finish | Spacing, typography, tokens, alignment | `ui-layout-audit` |
| 10 | Brand soul | Feels like JoyJoin? Mascot? Voice? | `frontend-design-audit` |
| 11 | Operational completeness | Blast radius, admin wiring, audit trail, kill switch | Manual |

**Scoring:** 4=Exceptional, 3=Solid, 2=Partial gaps, 1=Significant gaps, 0=Absent/broken · **Bands:** 完美 39–44 · 坚稳 29–38 · 可行 18–28 · 不足 9–17 · 残缺 0–8

## ROI Prioritization Layer

For every gap flagged (scores ≤2), assign two values:
- **User Impact (1–5):** How many users affected? Severity of degradation?
- **Engineering Hours (1–5):** Effort to fix (1 = minutes, 5 = days)

| Quadrant | Action | Meaning |
|---|---|---|
| Q1: ↑Impact ↓Effort | **Do first** | High pain, low cost — immediate wins |
| Q2: ↑Impact ↑Effort | **Schedule** | Critical but costly — next sprint |
| Q3: ↓Impact ↓Effort | **Low-hanging** | Nice-to-have when time allows |
| Q4: ↓Impact ↑Effort | **Skip** | Not worth the cost |

## Report Card

Use [`references/report-card-template.md`](references/report-card-template.md). Output must include: dimension scores, gap register ranked by quadrant, ROI scatter, band, and ship/no-ship verdict. For delight gaps (dim 5 ≤2), explicitly recommend running `wow-elements` to implement the missing emotional moments.

## Quick examples

- **Pipeline on onboarding step:** Trigger `"完成度全流程"`. Agent chains all three. Dim 9 auto-derived 3.0, dim 10 auto 3. Flag "no loading state on submit" (dim 2, impact 4, effort 1 → Do first). Total 31/44 (坚稳) → fix 1 item, ship.

- **Ad-hoc on discover page:** Prerequisites run. Dim 10 scores 1 (no mascot) → Schedule. Dim 11 scores 2 (no kill switch) → Do first. Total 28/44 (可行) → fix dim 11, ship, schedule dim 10.

## Troubleshooting

- **Prerequisites not run** → Score dims 9–10 manually using `references/dimension-rubric.md`. Note in report.
- **Too many gaps** → Strictly prioritize by quadrant. Q1 items are non-negotiable; Q2 is next sprint; Q3/Q4 deferred.
- **Score feels harsh** → 0–4 is about completeness, not aesthetics. Functioning-but-unpolished surfaces score 2–3, not 0–1.
- **All 4s but feels off** → Run user test. The audit covers known dimensions; it can't replace real human feedback.
- **Delight gaps found (dim 5 ≤2)** → Run `wow-elements` to implement the missing moments. Completeness-audit finds the gap; wow-elements fills it.

## Review checklist

- [ ] `ui-layout-audit` and `frontend-design-audit` scores collected (or manual fallback noted)
- [ ] All 11 dimensions scored with specific evidence per gap
- [ ] Gaps linked to file paths or component names
- [ ] Each gap has User Impact + Engineering Hours assigned
- [ ] Gap register ranked by quadrant (Do first → Schedule → Low-hanging → Skip)
- [ ] Rating band stated
- [ ] Verdict includes explicit ship/no-ship recommendation
