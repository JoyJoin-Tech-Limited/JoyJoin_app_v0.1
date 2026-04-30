---
name: frontend-hook-engine
description: >-
  Audit screens, components, and frontend flows with a normalized Seven Deadly
  Sins heuristic, then route the response into Brainstorm, Execute, or Debug
  mode with concrete UI deliverables. Use when evaluating CTA hierarchy,
  component states, interaction clarity, or a screen-level product problem.
  Trigger phrases: @sin-fe, /7sins-fe, Frontend Hook Engine, screen sin mapping,
  audit this interface, CTA hierarchy, this page feels confusing, what should
  people click first.
---
# Frontend Hook Engine
**Core rule:** Use the Seven Deadly Sins framework as a normalized heuristic for screen and interaction quality. Do not treat it as a fixed doctrine, and do not rely on visual novelty as evidence of success.
## When to use this skill
- Exploring a new screen, interaction, or conversion surface
- Auditing CTA hierarchy, state design, or information density on a UI surface
- Turning a UI direction into a build-ready screen or component plan
- Diagnosing a confusing interaction, broken state path, or weak UI conversion
- Helping a non-technical user ask plain-language questions such as "this page feels confusing"
- Explicitly asked for frontend sin mapping or a Seven Deadly Sins interface review
Do not use for shared component placement (`frontend-component-architecture`), tokens/variants (`design-system-governance`), motion polish without broader diagnosis (`wow-elements`), or funnel strategy beyond one screen (`pm-sin-mapper`).
## The seven sins
| Sin | Meaning |
| --- | --- |
| Blindness | No evidence that the screen solves a real user task or pain |
| Vanity | Visual trend, AI novelty, or aesthetic flourish leads instead of the user task |
| Clutter | Too many elements, weak hierarchy, noisy copy, or unclear primary action |
| Misfit | Wrong interaction pattern for the device, context, or journey step |
| Isolation | Designed without usability feedback, engineering constraints, or adjacent-state thinking |
| Disrespect | Inaccessible UI, manipulative behavior, hidden costs, or trust-breaking copy |
| Myopia | Happy path is polished but loading, empty, error, retry, or post-action states are weak |
## Language rule
- In normal chat, use plain wording such as "what do people notice first", "what feels messy", "what should stand out more".
- Keep the structured response format, but explain CTA hierarchy and states in everyday language if the user is non-technical.
- In routing or agent-only contexts, technical phrases such as CTA hierarchy, state model, visual priority, and failure states are fine.
## Dispatch logic
Route the request to one primary mode:
- **Brainstorm:** exploring a new page, visual hook, layout direction, or conversion concept
- **Execute:** wants a build-ready screen plan, component breakdown, state model, or UI implementation slice
- **Debug:** diagnosing a confusing flow, weak conversion, broken interaction, or poor state behavior
Mixed requests: Brainstorm first + compact Execute handoff for ideation+ship; Debug first + compact Execute handoff for diagnosis+fix. Default to Brainstorm if ambiguous. Ask at most 3 clarifying questions, only when target screen, user goal, platform, or observed issue is missing.
## Shared output contract
Every response must include, in this order: Mode, Sin mapping, Recommendation, Deliverables, Code params, Pseudocode. Always start Sin mapping with this table:
| Sin | Severity (Low/Med/High) | Evidence | UX impact | Correction |
If evidence is weak or incomplete, label it as an assumption. See [`references/sin-mapping.md`](./references/sin-mapping.md) for detailed sin definitions, CTA hierarchy audit steps, screen audit worksheet, and mode-specific deliverable specs.
## Working rules
- Start from the user task, not the visual trick.
- Prefer clear hierarchy over decorative density.
- Call out weak loading, empty, error, retry, and success states directly.
- Treat accessibility and trust as hard constraints, not polish.
- Name the tradeoff when recommending more motion, more copy, or fewer actions.
- Do not confuse visual novelty with usability.
## Handoff guidance
- Shared-component placement → `frontend-component-architecture`
- Tokens, variants, or CSS custom properties → `design-system-governance`
- Motion polish or premium emotional finishing → `wow-elements`
- Funnel strategy, idea selection, or product prioritization → `pm-sin-mapper`
- Prompt weakness → recommend prompt-engineering refinement pass
## Quick examples
- "This page feels confusing. What do people notice first, what feels messy, and what should stand out more?"
- "People are not tapping the main button. What is getting in their way?"
- "Turn this rough idea into a clear screen with all the states we need."
- For more examples, see [`references/examples.md`](./references/examples.md).
## Troubleshooting
**The output focuses only on aesthetics** — Reset to the user goal, CTA hierarchy, and state model. If those are missing, the diagnosis is incomplete.
**The screen plan ignores non-happy-path states** — Re-run Execute mode and require loading, empty, error, retry, and success states in the State table.
**The user is not technical** — Describe hierarchy and state problems in everyday language before naming the formal UX lens.
**The wrong skill is being used for token or placement work** — Hand off to `design-system-governance` for tokens and variants, `frontend-component-architecture` for structure, or `pm-sin-mapper` for broader funnel and product strategy problems.
## Review checklist
- [ ] Brainstorm, Execute, and Debug dispatch logic is explicit
- [ ] Every mode requires Sin mapping, concrete UI tables, Code params, and Pseudocode
- [ ] The skill explicitly covers non-happy-path states
- [ ] The guidance treats Seven Deadly Sins as a normalized heuristic, not a canonical doctrine
- [ ] The skill includes plain-language examples for normal chat and technical triggers for routing
- [ ] Handoff guidance points to the correct neighboring frontend skills
