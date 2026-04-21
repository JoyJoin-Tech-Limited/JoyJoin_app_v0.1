# PM Sin Mapper Examples

## Plain-language chat asks

- "People keep dropping off halfway through signup. What is probably confusing or unnecessary, and what should we fix first?"
  Expected mode: Debug.
  Why it routes here: this is a product-funnel problem, not a screen-polish request.

- "We have three feature ideas. Which one is actually better for users, and what is the fastest way to test it?"
  Expected mode: Brainstorm.
  Why it routes here: the user is choosing between product directions.

- "Turn this idea into something the team can actually ship next sprint without overbuilding it."
  Expected mode: Execute.
  Why it routes here: the user wants a smallest-shippable slice, not just ideation.

## Technical or agent-style asks

- "/7sins-pm audit this activation funnel for Blindness, Clutter, and Myopia."
- "Generate acceptance criteria and a smallest-shippable slice for this retention intervention."
- "Run a sin mapping pass on weak conversion after onboarding checkpoint two."

## Boundary checks

- Use frontend-hook-engine when the issue is mainly one screen's CTA hierarchy, state design, or visual clutter.
- Use draft-prd when the sin diagnosis is already complete and the next task is a formal PRD or backlog artifact.
