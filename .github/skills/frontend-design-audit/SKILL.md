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

- Reviewing a PR that touches UI (mini-program or web)
- A shipped screen feels generic, cheap, or off-brand
- Before calling a UI task "done" — run as a final quality pass
- Onboarding a new screen: audit the first implementation
- Retroactively auditing existing screens for a quality uplift sprint

## Do not use when

- Task is purely backend with no UI surface
- Generating designs from scratch (use `stitch-design-workflow` or `lovart-design-workflow`)

## How to run an audit

### Agent-mode (during implementation / PR review)
1. Identify the target: specific page, component, or flow
2. Score all 5 dimensions below (0–4 each)
3. List specific anti-patterns with file paths / line numbers
4. Generate a ranked fix list (P0 = ship-blocking, P1 = should fix, P2 = polish)
5. Report health score and rating band

### Human-mode (CLI)
```bash
npm run design:audit apps/mini-program/src/pages/discover
```

> CLI catches obvious violations but cannot judge hierarchy, emotional resonance, or copy quality — those require agent-mode visual review.

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
- **"Stitch-generated screen looks different from implementation"** → Stitch is exploratory; implementation must follow `design-system-governance` and `mini-program-frontend-excellence`.

## Review checklist

- [ ] All 5 dimensions scored with specific evidence
- [ ] Anti-patterns linked to file paths / line numbers
- [ ] Fix list ranked P0/P1/P2
- [ ] Health score and rating band stated
- [ ] Mini-program screens checked against Taro-specific constraints
- [ ] Web screens checked against token and accessibility constraints

## Quick examples

**Auditing a mini-program profile screen:**
1. Dimension 1: Mascot placement feels random → Score 2
2. Dimension 2: Missing error state for photo upload failure → Score 2
3. Dimension 3: Four hard-coded colors instead of tokens → Score 2
4. Dimension 4: Touch targets below 44×44 rpx on action row → Score 2
5. Dimension 5: Heavy blur filter on scroll → Score 1
**Health Score: 9/20 (Poor)** → P0: fix touch targets and upload error state before merge.

**Auditing a web onboarding step:**
1. Dimension 1: Warm beige background, mascot present, copy is conversational → Score 4
2. Dimension 2: Loading, empty, and error states all handled → Score 4
3. Dimension 3: All colors from tokens, no hard-coded values → Score 4
4. Dimension 4: Works down to 320 px without horizontal scroll → Score 3
5. Dimension 5: No layout thrashing, modest entrance animation → Score 4
**Health Score: 19/20 (Excellent)** → Minor polish only; safe to ship.
