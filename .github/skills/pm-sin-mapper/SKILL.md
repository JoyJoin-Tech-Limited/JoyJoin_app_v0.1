---
name: pm-sin-mapper
description: >-
  Diagnose product ideas, funnels, and feature directions with a normalized
  Seven Deadly Sins product-design heuristic, then route the response into
  Brainstorm, Execute, or Debug mode with concrete PM deliverables. Use when
  auditing onboarding, monetization, activation, retention, or a new feature
  concept through a sin-mapping lens. Trigger phrases: /7sins-pm, PM Sin Mapper,
  why are users dropping off, which idea is better for users, what should we
  change first.
---
# PM Sin Mapper
**Core rule:** Treat Seven Deadly Sins Product Design as a practical heuristic, not a canonical doctrine. Public variants differ, so use the normalized seven lenses below and label assumptions honestly.
## When to use this skill
Use this skill when you are:
- evaluating a new feature concept before implementation
- comparing product directions or experiments
- auditing onboarding, monetization, activation, retention, or conversion flows
- diagnosing product confusion, low adoption, or funnel drop-off
- turning a product diagnosis into structured tables, code params, and pseudocode
- helping a non-technical user ask plain-language questions such as "why are people dropping off here?"
- explicitly asked for sin mapping or a Seven Deadly Sins product-design review
Do not use this skill when:
- the task is mainly standard requirements writing without a sin-mapping lens; use draft-prd
- the task is mainly about one screen's CTA hierarchy, page clutter, or state clarity; use frontend-hook-engine
- the task is mainly implementation detail or code review rather than product diagnosis
## The seven sins
| Sin | Meaning |
| --- | --- |
| Blindness | No validated user pain, job, or behavioral evidence |
| Vanity | Trend, AI novelty, internal preference, or aesthetics leads before the problem |
| Clutter | Too many choices, weak prioritization, or an overloaded path to value |
| Misfit | Wrong solution for the user, channel, journey step, or market reality |
| Isolation | Designed without feedback, critique, research, or delivery constraints |
| Disrespect | Manipulative, inaccessible, confusing, or trust-eroding decisions |
| Myopia | Launch-only thinking with weak lifecycle, retention, or operational discipline |
## Language rule
- In normal chat, prefer plain wording such as "what feels confusing", "where are people dropping off", "which idea is better", and "what should we change first".
- Keep the structured response format, but do not assume the user knows PM jargon or the seven-sins framework.
- In routing or agent-only contexts, technical phrases such as activation funnel, retention, acceptance criteria, and product surface are fine.
## Dispatch logic
Route the request to one primary mode:
- **Brainstorm:** exploring a feature idea, growth lever, UX concept, positioning direction, or experiment options
- **Execute:** wants a scoped brief, acceptance criteria, rollout slice, metric plan, or issue-ready product artifact
- **Debug:** diagnosing drop-off, low conversion, poor activation, weak retention, or a confusing flow
Mixed requests: Brainstorm first + compact Execute handoff for ideation+planning; Debug first + compact Execute handoff for diagnosis+fix. Default to Brainstorm if ambiguous. Ask at most 3 clarifying questions, only when target user, funnel, business goal, or observed problem is missing.
## Shared output contract
Every response must include, in this order: Mode, Sin mapping, Recommendation, Deliverables, Code params, Pseudocode. Always start Sin mapping with this table:
| Sin | Severity (Low/Med/High) | Evidence | Product impact | Correction |
If evidence is weak or incomplete, label it as an assumption. See [`references/pm-mapping.md`](./references/pm-mapping.md) for detailed sin definitions for PM context, funnel audit steps, and mode-specific deliverable specs.
## Working rules
- Prioritize user truth over stakeholder enthusiasm.
- Separate evidence from inference.
- Prefer the smallest validating move over a broad redesign.
- Call out manipulation, trust damage, and accessibility failures directly.
- Name the tradeoff when recommending scope cuts or launch sequencing.
- Do not confuse feature activity with user value.
- If the user is non-technical, translate PM terms into plain language before giving the recommendation.
## Handoff guidance
- Requirements artifact → `draft-prd`
- One screen's CTA hierarchy, state clarity, or page clutter → `frontend-hook-engine`
- Prompt wording, instruction hierarchy, or example quality weakness → recommend prompt-engineering refinement pass
- Reusable skill packaging, triggerability, or routing metadata → `skill-authoring-governance`
## Quick examples
- "People keep leaving halfway through signup. What is probably confusing or unnecessary, and what should we fix first?"
- "We have three feature ideas. Which one is most likely to help users, and what is the fastest way to test it?"
- "Turn this idea into something the team can actually ship next sprint without overbuilding it."
- For more examples, see [`references/examples.md`](./references/examples.md).
## Troubleshooting
**The framework feels subjective** — Separate evidence from assumption in the Sin mapping table. Do not assign severity without saying what evidence supports it.
**The output became generic** — Re-run the response with the required tables, Code params, and Pseudocode. If those are missing, the output is incomplete.
**The wrong mode was selected** — If the user mixes diagnosis and planning, do Debug first and end with a compact Execute handoff. If they mix ideation and planning, do Brainstorm first.
**The user is not technical** — Keep the framework in the structure of the answer, but explain the recommendation in everyday language.
**The response invents an official Seven Sins canon** — Reset to the normalized seven-lens model above and state that public taxonomies vary.
## Review checklist
- [ ] Brainstorm, Execute, and Debug dispatch logic is explicit
- [ ] Every mode requires Sin mapping, concrete tables, Code params, and Pseudocode
- [ ] Evidence is clearly separated from assumptions
- [ ] The skill treats Seven Deadly Sins as a normalized heuristic, not a canonical doctrine
- [ ] The skill includes plain-language examples for normal chat and technical triggers for routing
- [ ] Handoff guidance points to the right neighboring skills when the task changes shape
