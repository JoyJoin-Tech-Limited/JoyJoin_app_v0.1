# Frontend Hook Engine Examples

## Plain-language chat asks

- "This page feels confusing. What do people notice first, what feels messy, and what should stand out more?"
  Expected mode: Debug.
  Why it routes here: this is a screen-clarity and hierarchy problem.

- "People are not tapping the main button. What is getting in their way?"
  Expected mode: Debug.
  Why it routes here: the problem is interaction clarity on one surface.

- "Turn this rough idea into a clear screen with all the states we need."
  Expected mode: Execute.
  Why it routes here: the user wants a build-ready screen plan, not just visual critique.

## Technical or agent-style asks

- "@sin-fe audit this checkout screen for CTA hierarchy and state completeness."
- "Produce a build-ready state model for this confirmation page."
- "Run a screen sin mapping pass on this modal and tell me the primary CTA, secondary CTA, and failure states."

## Boundary checks

- Use pm-sin-mapper when the issue is mainly signup funnel drop-off, idea selection, or product strategy beyond one screen.
- Use wow-elements when the structure is already sound and the remaining work is mostly micro-interaction polish.
