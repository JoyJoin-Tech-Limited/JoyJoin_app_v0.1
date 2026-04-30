# PM Sin Mapping Reference

## Detailed sin definitions for PM context

| Sin | Meaning | Product evidence to inspect |
| --- | --- | --- |
| **Blindness** | No validated user pain, job, or behavioral evidence | No user research, no behavioral data, no support tickets; feature exists because "competitors have it" |
| **Vanity** | Trend, AI novelty, internal preference, or aesthetics leads before the problem | Building with AI because it is trendy; prioritizing a feature the CEO likes but users do not need |
| **Clutter** | Too many choices, weak prioritization, or an overloaded path to value | Onboarding with 12 steps; three CTAs on one screen; feature bloat without clear primary use case |
| **Misfit** | Wrong solution for the user, channel, journey step, or market reality | Desktop-first feature for a mobile-first user base; complex enterprise feature for a consumer app |
| **Isolation** | Designed without feedback, critique, research, or delivery constraints | No user testing before launch; no engineering feasibility check; no competitive analysis |
| **Disrespect** | Manipulative, inaccessible, confusing, or trust-eroding decisions | Dark patterns; misleading metrics; hiding cancellation; ignoring accessibility |
| **Myopia** | Launch-only thinking with weak lifecycle, retention, or operational discipline | No onboarding for new users after launch; no monitoring; no plan for support volume |

## Funnel audit steps

1. Identify the **target user** and the **job they are hiring the product to do**.
2. Map the **funnel stage** (awareness → activation → retention → revenue → referral).
3. Identify the **one primary action** that moves the user to the next stage.
4. Verify the path to that action is clear and uncluttered.
5. Check for **drop-off points** — where do users abandon the flow?
6. For each drop-off, map the likely sin (Blindness, Clutter, Misfit, etc.).
7. Propose the **smallest intervention** that would improve the metric.

## Brainstorm mode deliverables

Goal: turn a fuzzy product idea into strong options without inheriting predictable sins.

Required deliverables:

- Concept options table: | Option | Core user value | Biggest sin risk | Fastest validation test |
- Recommendation: one winner, one runner-up, and one option to avoid
- Code params: targetUser, userJob, surface, coreMoment, businessGoal, northStarMetric, constraints, assumptions, guardrails
- Pseudocode:
  - identify target user and job
  - generate 3 options
  - map each option against 7 sins
  - reject High Blindness and High Disrespect
  - rank remaining options by user value, business value, and validation speed
  - recommend the top option and first experiment

## Execute mode deliverables

Goal: turn a chosen direction into a PM-ready execution slice.

Required deliverables:

- Delivery table: | Workstream | What to define | Sin to watch | Acceptance check |
- Acceptance criteria table: | Criterion | User outcome | Metric or observable proof |
- Recommendation: smallest shippable slice, biggest launch risk, and what to defer
- Code params: surface, primaryPersona, funnelStage, successMetric, guardrailMetrics, requirements, nonGoals, dependencies, trackingEvents, rolloutConstraints
- Pseudocode:
  - define the happy path
  - define failure and fallback states
  - write acceptance criteria
  - add instrumentation and guardrails
  - identify launch blocker and deferrals
  - verify the plan avoids Clutter, Disrespect, and Myopia

## Debug mode deliverables

Goal: diagnose why a funnel or feature is underperforming and identify the smallest credible fix.

Required deliverables:

- Debug table: | Symptom | Likely sin | Evidence to inspect | Root cause hypothesis | Fix |
- Recommendation: most likely root cause, quickest proof, and safest next move
- Code params: symptom, funnelStage, reproPath, segmentsToCheck, signalsToInspect, candidateRootCauses, rollbackOption, validationChecks
- Pseudocode:
  - define symptom and affected segment
  - map symptom to likely sins
  - inspect qualitative and quantitative evidence
  - rank hypotheses by confidence and impact
  - propose the smallest safe intervention
  - define before-and-after validation checks
