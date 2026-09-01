---
name: frontend-design-audit
description: >
  Systematic design-quality audits on JoyJoin frontend surfaces. Scores 5
  dimensions, detects AI slop, and produces actionable fix lists. Use during PR
  review, before shipping UI, or when a screen feels off-brand. Triggers:
  "audit this screen", "design review", "check for AI slop", "does this feel premium".
---

# Frontend Design Audit

**Core rule:** Every shipped JoyJoin surface should pass a design audit before merge.

## When to use this skill

- Reviewing a PR that touches UI (mini-program or admin-client — the live surfaces; the archived web client is historical parity reference only)
- A shipped screen feels generic, cheap, or off-brand
- Before calling a UI task "done" — run as a final quality pass
- Onboarding a new screen: audit the first implementation
- Retroactively auditing existing screens for a quality uplift sprint

## Prerequisites

| Prerequisite | Feeds | Mapping |
|---|---|---|
| [`references/visual-correctness-gate.md`](./references/visual-correctness-gate.md) | Step 0 + Dim 4 (Responsive & Safety) | Scanner blocking violations = Class A correctness defects (auto-P0). Craft findings feed Dim 1. A surface with any Class A defect is not shippable regardless of dimension scores. |
| [`docs/reference/emotional-value-rubric.md`](../../../docs/reference/emotional-value-rubric.md) | Dim 1 (Brand Fidelity) emotional depth | Score 6 sub-dimensions → 0–24. A screen can be token-correct and emotionally vacant. Low 归属感 or 身份认同 scores override any Brand Fidelity score. |

## Do not use when

- Task is purely backend with no UI surface
- Generating designs from scratch (use `lovart-design-workflow`)

## Grill-me stress-test

After scoring all 5 dimensions, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that defends every score with evidence. Converts vibe-based scoring into defendable audit results.

## How to run an audit

### Step 0 — Render & Inspect (mandatory for user-facing surfaces)

Code-reading is blind to overlap, overflow, clipping, and cramped spacing — those only exist in the render. Run the **Rendered-Truth Visual Gate** (full two-class rubric, scanner + vision layers, and the Step 0 procedure: [`references/visual-correctness-gate.md`](./references/visual-correctness-gate.md)):

1. **Render + scan:** `npm run audit:visual -- --url "<h5 route>" --wait "<selector>" --screenshot /tmp/<page>.png --pretty`; record Class A (correctness) violations.
2. **Vision review** the screenshot (`multimodal-looker`) with the gate's rubric.
3. **Merge + classify** each finding **correctness (blocking)** / **craft (advisory)**, labelled **Seen-in-render** vs **Read-in-code**. Non-renderable surfaces: use the gate's documented fallback (WeChat DevTools / browser screenshot + vision review) and note why the scanner was skipped — never claim visual sign-off without a render.

### Agent-mode (during implementation / PR review)
1. **Step 0 first** (above): render, scan, vision-inspect, classify.
2. Identify the target (page/component/flow) and score all 5 dimensions below (0–4 each), using scanner output as evidence for Dimension 4
3. List specific anti-patterns with file paths / line numbers, each tagged Seen-in-render or Read-in-code
4. Generate a ranked fix list (P0 = ship-blocking, P1 = should fix, P2 = polish; **Class A defect = automatic P0**) and report health score + rating band

### Human-mode (CLI)
```bash
npm run design:audit apps/mini-program/src/pages/discover
```

> `design:audit` catches source-level violations but cannot see the render; pair with `npm run audit:visual` (rendered correctness) + a vision review (hierarchy, copy, resonance) — see Step 0.

## The 5 Dimensions

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Brand Fidelity & Anti-Patterns | ? | |
| 2 | State Completeness | ? | |
| 3 | Theming & Token Discipline | ? | |
| 4 | Responsive & Platform Safety | ? | |
| 5 | Performance & Motion Hygiene | ? | |
| **Total** | | **??/20** | |

**Rating bands:**
- **18–20 Excellent:** Minor polish only; safe to ship.
- **14–17 Good:** Address weak dimensions before merge.
- **10–13 Acceptable:** Significant work needed; do not ship without fixes.
- **6–9 Poor:** Major overhaul required.
- **0–5 Critical:** Rebuild recommended.

See [`references/audit-framework.md`](./references/audit-framework.md) for full scoring rubrics, anti-pattern checklist, Fix Priority Matrix, and platform-specific addenda.

## Troubleshooting

- **"I can't tell if this is on-brand"** → Compare against `joyjoin-brand-guidelines` and the Anti-Slop Checklist in `references/audit-framework.md`.
- **"The screen scores well but still feels off"** → Check copy warmth, mascot presence, and emotional resonance — these are subjective but critical.
- **"Lovart-generated illustration looks off-brand in implementation"** → Lovart output is exploratory; implementation must follow `design-system-governance` and `mini-program-frontend-excellence`.

## Review checklist

- [ ] **Step 0 done:** page rendered, `npm run audit:visual` scan read, screenshot vision-reviewed (user-facing surfaces)
- [ ] Every finding classified **correctness (blocking)** or **craft (advisory)** and labelled Seen-in-render / Read-in-code
- [ ] All Class A (correctness) defects listed as P0 — surface is not shippable until fixed
- [ ] All 5 dimensions scored with specific evidence; anti-patterns linked to file paths/lines
- [ ] Fix list ranked P0/P1/P2; health score + rating band stated
- [ ] Mini-program checked vs Taro constraints; admin-client checked vs token + accessibility (ops tier)
- [ ] 情绪价值 scored via `docs/reference/emotional-value-rubric.md` if user-facing (not admin/ops)
- [ ] Grill-me interview completed for any dimension scoring < 4 (see `references/grill-me-checklist.md`)

## Quick example

**Auditing a web onboarding step:** Dim 1 mascot + conversational copy → 4; Dim 2 all states handled → 4; Dim 3 all tokens → 4; Dim 4 works at 320px → 3; Dim 5 modest motion → 4. **19/20 (Excellent)** → minor polish, safe to ship. A contrasting poor-score example (mini-program profile, 9/20) and the full breakdown live in [`references/examples.md`](references/examples.md).
