---
name: screen-design-critique
description: >
  Designer-seat critique of rendered JoyJoin screens across seven dimensions —
  visual hierarchy, brand consistency, composition, typography, colour,
  affordance, information density — each rated pass / minor issue / major issue
  with Observation → Problem → Fix evidence and P0/P1/P2 routing to the owning
  skill. Use when reviewing a rendered screen before ship, critiquing the UI
  diff of a PR, or giving in-flight design direction during implementation.
  Trigger phrases: "designer review", "critique this screen", "UIUX review",
  "visual designer pass", "screen critique", "does this look designed",
  "UI 走查", "设计评审", "review this UI during implementation",
  "is this composition right".
---

# Screen Design Critique

**Core rule:** Judge every screen from the designer's seat — with rendered evidence, never code alone — and route every fix to the skill that owns it.

## When to use this skill

- A rendered screen (H5 build or WeChat DevTools capture) needs a design review before merge
- A PR touches UI and you want the designer pass alongside engineering review
- During implementation: the engineer wants in-flight direction ("does this composition work? where should this pill sit?")
- A screen is functional but feels generic, crowded, flat, cold, or off-brand and nobody can name why

## Do not use when

- No render can be produced — defer, or run an explicit read-only code review and say render sign-off is missing
- The question is pixel/token rule enforcement → `ui-layout-audit`; user emotion and retention → `user-satisfaction-audit`; ship completeness → `completeness-audit`; asset creation → `lovart-design-workflow` (Visual Designer agent); full scored audit → `frontend-design-audit`

## Render-first mandate

Code-reading is blind to hierarchy, overlap, and density — those exist only in the render. Before critiquing:

1. **Render** — `npm run audit:visual -- --url "<h5 route>" --screenshot /tmp/<page>.png`, or the WeChat DevTools capture path in `mini-program-screenshot-workflow` for platform-only surfaces.
2. **Capture every interactive state** — loading / empty / error / success / disabled — not just the happy path. Critique the state set, not one frame.
3. **Label every finding** `Seen-in-render` or `Read-in-code`. Never claim visual sign-off without a render.

## The seven dimensions

| # | Dimension | Core question | Fixes route to |
|---|-----------|---------------|----------------|
| 1 | Visual hierarchy | Does attention land on the right thing first and flow to the CTA? | `wow-elements`, `frontend-hook-engine` |
| 2 | Brand consistency | Could this screen only be JoyJoin? | `joyjoin-brand-guidelines` |
| 3 | Composition | Does the layout breathe, group, and balance? | `ui-layout-audit` |
| 4 | Typography | Does type carry a clear scale with readable measure? | `design-system-governance`, `ui-layout-audit` |
| 5 | Colour | Is colour semantic, contrast-legal, and on-palette? | `design-system-governance`, `joyjoin-brand-guidelines` |
| 6 | Affordance | Does every tappable thing look tappable, in every state? | `mini-program-frontend-excellence` |
| 7 | Information density | Does one screen do one job at one glance? | `frontend-hook-engine`, `first-principles-velocity` |

Full rubric per dimension: [`references/critique-dimensions.md`](./references/critique-dimensions.md). JoyJoin-specific visual law (CTA rules, spacing rhythm, platform traps): [`references/joyjoin-visual-canon.md`](./references/joyjoin-visual-canon.md).

## How to run

1. **Scope** — name the surface, the single user job this screen serves, and the render set (which states were captured).
2. **Critique** — walk all seven dimensions. Per finding: **Observation** (neutral, from the render) → **Problem** (why it breaks the user job) → **Fix** (one specific change). Rate each dimension `pass` / `minor issue` / `major issue`.
3. **Prioritise** — merge findings: **P0** breaks usability, brand law, or platform law; Class A visual-gate defects are automatic P0 → **P1** degrades craft or consistency, fix this sprint → **P2** polish.
4. **Route** — every fix names its owning skill and the file path it lives in; never prescribe outside the designer's seat.
5. **Verdict** — one paragraph: strongest dimension, weakest dimension, ship / fix-then-ship / no-ship.

## Implementation mode (in-flight guidance)

When invoked mid-build rather than at review:

- Answer the narrow question asked ("is this card hierarchy right?") — do not audit the whole page unprompted.
- Give direction as **design intent + an acceptance check the engineer can verify in a render** ("exactly one emphasis zone; the CTA must outweigh the card title by ≥1.5× in visual weight") — not pixel dictation (that is `ui-layout-audit`'s seat).
- Offer one re-critique of the new render after the change. One round-trip, not a lecture.

## Quick examples

- **Review mode** — "Critique the event-detail render." → Step 0 render; walk 7 dimensions; find the 已评价 done-state CTA invisible white-on-white (Affordance, major — the platform disabled-colour trap); fix: re-assert colour from an ancestor selector per `mini-program-frontend-excellence`; route P0.
- **Implementation mode** — "Building the matched carousel — should the chemistry pill sit above or below the name?" → Above: it is the differentiation signal. Acceptance: pill is the highest-contrast element after the avatar; exactly one emphasis zone per card. Re-render to confirm.

## Troubleshooting

- **"It looks fine to me"** — you rendered only the happy path; capture loading / empty / error and re-judge density and hierarchy there.
- **Findings feel subjective** — tie each to a dimension rubric line and the canon law it breaks; if no law breaks, it is taste — log P2, not P0.
- **Too many P0s** — you are scoring craft preferences as blockers; only usability, brand/platform law, and Class A render defects are P0.
- **Conflict with a `ui-layout-audit` spacing call** — their token table wins on values; you win on composition intent. Record both, escalate to `design-system-governance` only if unresolved.
- **WeChat-only state can't render on H5** — use the DevTools capture path in `mini-program-screenshot-workflow`; if still blocked, mark the finding `Read-in-code` and downgrade certainty.

## Review checklist

- [ ] Every finding has Observation → Problem → Fix and a pass / minor / major rating
- [ ] Every finding is labelled `Seen-in-render` or `Read-in-code`
- [ ] All interactive states were captured, not just the happy path
- [ ] Every fix names an owning skill and file path — nothing outside the designer's seat
- [ ] P0 set contains only usability / brand-law / platform-law / Class-A-render defects
- [ ] Verdict names strongest and weakest dimension with an explicit ship stance
- [ ] Implementation mode: answered the narrow question only, with a render-verifiable acceptance check
