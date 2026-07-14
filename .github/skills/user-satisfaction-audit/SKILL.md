---
name: user-satisfaction-audit
description: >
  First-person user-perspective critical audit for frontend changes. Walks the
  screen or flow as a discerning real user, scores six critical satisfaction
  angles (0–24), and issues a user verdict: would they share it, return
  tomorrow, recommend it, and pay because of it. Use after UI implementation,
  during PR review, or when a screen is complete but not lovable. Trigger
  phrases: "user satisfaction audit", "user perspective review", "walk the
  screen as a user", "would users love this", "is this delightful enough",
  "will users come back", "does this trigger sentimental value", "用户视角审计".
---

# User Satisfaction Audit

**Core rule:** A screen can pass code review, design audit, and completeness audit and still lose the user in three seconds. This audit asks the only question that decides retention and lifecycle: **would a real, slightly impatient user love this enough to come back?** The auditor is adversarial by default — argue *against* shipping until the experience earns the user's next 30 seconds.

## When to use this skill

- Post-implementation review of any user-facing frontend change (mini-program or web)
- PR review where the diff touches a screen real users see
- A screen is functionally complete but "feels fine, not great"
- Before shipping an emotional peak (match reveal, squad unboxing, onboarding completion, payment success)
- Drop-off or churn signals point at a specific screen

**Do not use when:** pixel-level spacing issues (→ `ui-layout-audit`), brand-craft scoring (→ `frontend-design-audit`), functional gaps (→ `completeness-audit`), speed/jank (→ `performance-audit`), interaction diagnosis (→ `frontend-hook-engine`), or product strategy (→ `pm-sin-mapper`). This skill assumes those pass and critiques purely from the **user's seat**.

## Prerequisites

| Prerequisite | Feeds | Mapping |
|---|---|---|
| Rendered-Truth Visual Gate (`frontend-design-audit` Step 0) | Angles 1–3 evidence | Any Class A correctness defect (overlap, clipping, unreadable contrast) → automatic **劝退** verdict; craft findings inform scores |
| [`docs/reference/emotional-value-rubric.md`](../../../docs/reference/emotional-value-rubric.md) | Angle 4 (Emotional resonance) | 情绪价值 composite ÷ 6 → 0–4 |
| Persona from [`references/personas.md`](references/personas.md) | All angles | Pick one (first-time / returning / invited guest / power user) before scoring; never audit as "generic user" |

## Method

1. **Render & inspect** — run the Visual Gate (`npm run audit:visual` + vision review). Never audit from code alone; comprehension and cleanliness only exist in the render.
2. **Persona walk** — narrate the journey in first person using [`references/journey-narration-template.md`](references/journey-narration-template.md): *"I land here… I see… I wonder… I feel… I tap…"* Mark every hesitation, re-read, scroll hunt, and dead end.
3. **Score six angles** (0–4 each; full rubric in [`references/angle-rubric.md`](references/angle-rubric.md)):

| # | Angle | Core question |
|---|-------|---------------|
| 1 | 3-second clarity | Do I instantly know what this screen is for and what to do next? |
| 2 | Cognitive smoothness | Can I read and comprehend without effort, backtracking, or decoding? |
| 3 | Holistic cleanliness | Does the screen as a whole feel calm, coherent, and intentionally composed? |
| 4 | Emotional resonance | Are there wow moments with real sentimental value (归属感 / 仪式感 / 惊喜感)? |
| 5 | Return hooks | Does this give me a reason to come back — identity, progress, people, streaks? |
| 6 | Share-worthiness | Would I screenshot this and send it to a friend without embarrassment? |

4. **User verdict** — answer the four verdict questions with evidence: *Would I share it? Return tomorrow? Recommend it? Pay because of it?*
5. **Prescribe fixes** — every gap routes to the owning skill: delight → `wow-elements`; cleanliness → `ui-layout-audit`; states → `completeness-audit`; comprehension → `frontend-hook-engine`; brand voice → `joyjoin-brand-guidelines`; motion → `wow-elements` + `frontend-performance-and-loading`.

## Bands

- **20–24 爱不释手 (Can't put it down):** ship and study it — this is the bar.
- **15–19 愿意回来 (Willing to return):** fix every angle scoring ≤2 before ship.
- **9–14 用完即走 (Use and leave):** significant emotional work needed; never ship an emotional peak in this state.
- **4–8 划走 (Swipe away):** redesign from the user's seat.
- **0–3 劝退 (Repelling):** rebuild.

## Grill-me stress-test

Any angle scored **4** must survive one grill-me challenge ("prove the wow moment exists — where exactly does the user smile?"). Any angle scored **≤2** must cite the exact narration beat where the persona hesitated.

## Quick example

**Squad unboxing reveal:** the persona smiles at the card-fan deal (angle 4: 4) but re-reads the venue row twice because `场地已确定` sits next to an ambiguous time line (angle 2: 2). Verdict: share-worthy, return-likely. **19/24 愿意回来** — fix the meta-line comprehension, then ship. Full breakdown in [`references/examples.md`](references/examples.md).

## Troubleshooting

- **All angles score 4 but it still feels flat** → the persona is wrong; re-walk as a first-time user who has never seen the brand. Familiarity inflates scores.
- **Findings duplicate the design audit** → this audit owns the *felt experience*, not token discipline; cite design-audit findings as evidence, don't re-derive them.
- **Can't render the surface** → audit from the H5 build or a WeChat DevTools screenshot; if neither exists, say so — never narrate a journey you didn't walk.

## Review checklist

- [ ] Visual Gate run; Class A defects listed (automatic 劝退 if any)
- [ ] Persona named; journey narrated in first person with hesitation beats marked
- [ ] All six angles scored with evidence; 情绪价值 rubric used for angle 4
- [ ] Four verdict questions answered with yes/no + why
- [ ] Every gap routed to an owning skill; band and ship/no-ship verdict stated
- [ ] Grill-me challenge completed for every 4 and every ≤2
