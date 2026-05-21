# Frontend Sin Mapping Reference

## Detailed sin definitions

| Sin | Meaning | Frontend-specific evidence to inspect |
| --- | --- | --- |
| **Blindness** | No evidence that the screen solves a real user task or pain | No clear user goal stated; screen exists because "we need a settings page" rather than a task |
| **Vanity** | Visual trend, AI novelty, or aesthetic flourish leads instead of the user task | Decorative gradient that obscures readability; animation that delays the primary action; copied Dribbble pattern that ignores context |
| **Clutter** | Too many elements, weak hierarchy, noisy copy, or unclear primary action | More than one primary CTA; no visual weight difference between primary and secondary; information density too high for the moment |
| **Misfit** | Wrong interaction pattern for the device, context, or journey step | Hover-dependent UI on touch devices; modal for a simple confirmation; multi-step wizard for a single field |
| **Isolation** | Designed without usability feedback, engineering constraints, or adjacent-state thinking | No empty or error states; ignores loading latency; assumes perfect network |
| **Disrespect** | Inaccessible UI, manipulative behavior, hidden costs, or trust-breaking copy | Dark patterns (forced continuity, hidden fees); low contrast text; no screen-reader labels; manipulative urgency copy |
| **Myopia** | Happy path is polished but loading, empty, error, retry, or post-action states are weak | Beautiful default state, skeleton is a generic spinner, error is "something went wrong" with no retry |

## CTA hierarchy audit steps

1. Identify the **one primary action** the user is most likely to want on this screen.
2. Verify it is visually dominant (size, color, position).
3. Identify secondary actions and verify they are visually subordinate.
4. Check for **competing primary actions** — two or more buttons fighting for attention is a Clutter sin.
5. Verify the primary action is reachable without scrolling on common viewports.

## Screen audit worksheet

Use this when auditing a specific screen:

| Check | Evidence | Sin risk |
|-------|----------|----------|
| User task is stated in one sentence | | Blindness |
| Primary CTA is obvious within 2 seconds | | Clutter |
| Loading state is designed, not a generic spinner | | Myopia |
| Empty state teaches the next action | | Myopia |
| Error state offers a recovery path | | Myopia |
| Touch targets ≥ 44×44 rpx (or 44pt) | | Disrespect |
| Contrast ratio ≥ 4.5:1 for body text | | Disrespect |
| No decorative motion that delays interaction | | Vanity |
| Copy explains the benefit, not just the feature | | Blindness |

## Virtuous Sins: When Apparent Sin Serves the Product

The Seven Deadly Sins are a **diagnostic heuristic**, not a moral framework. A "sin" in the audit is only a sin if it harms the user task. Some interfaces deliberately embrace patterns that *look* like sins because they serve the product's core value. Learn to distinguish sin from virtue.

### Clutter → Density (Information-Rich Moments)

**When it's virtuous:** Result pages, dashboards, and reveal screens where the user came to see "everything at once." The sin is not density — it's *lack of hierarchy within that density*.

**Evidence of virtue:**
- Users scroll back up to re-read details (they value the density)
- Share rate is high (people want to show off the rich result)
- Every element has a clear visual weight; the primary CTA still dominates

**Audit rule:** If removing an element makes the screen feel *empty* rather than *clear*, the density was virtuous. Fix the hierarchy, not the density.

### Vanity → Signature (Brand-Differentiating Visuals)

**When it's virtuous:** The visual flourish **IS** the product hook. Collectible card holography, rarity glow, achievement sparkles — these are not decorative; they are the *reason users share*.

**Evidence of virtue:**
- Users screenshot and share the "vanity" element
- The element communicates value that text cannot (rarity, exclusivity, craftsmanship)
- Removing it would make the product interchangeable with competitors

**Audit rule:** If the flourish obscures information or delays the primary action, it's sin. If the flourish **is** the information (holographic sheen = "this is special"), it's virtue.

### Myopia → Graceful Degradation (Intentional Simplification)

**When it's virtuous:** The non-happy path is deliberately simple because the user is unlikely to encounter it, and explicit complexity would add confusion. A silent fallback with a subtle indicator can be better than a full error state.

**Evidence of virtue:**
- Error rate is <1% for that path
- The fallback is genuinely useful (not just "try again")
- The user can still complete their task without noticing the degradation

**Audit rule:** If the user is stuck or confused when the edge case hits, it's sin. If the user barely notices and continues smoothly, it's virtue.

### How to apply in audit reports

When a sin maps to virtue:
1. **Name it explicitly:** "This reads as Clutter in the heuristic, but functions as virtuous Density."
2. **State the evidence:** What user behavior or product metric justifies the pattern?
3. **Redirect the fix:** Don't say "remove elements." Say "strengthen hierarchy within the density."
4. **Score accordingly:** A screen with virtuous density scores high on Brand Fidelity and user task fit, even if it looks "busy" at first glance.

---

## Mode-specific deliverables

### Brainstorm mode

Goal: generate stronger interface directions without inheriting predictable UX sins.

Required deliverables:

- Direction table: | Direction | Interaction hook | Strongest UX value | Biggest sin risk | Fastest mock or test |
- Recommendation: one direction to pursue, one backup, and one pattern to avoid
- Code params: surface, platform, userGoal, primaryCTA, secondaryCTA, constraints, visualPriority, trustSignals, guardrails
- Pseudocode:
  - define the user goal and screen moment
  - propose 3 interface directions
  - map each direction against 7 sins
  - reject High Clutter and High Disrespect
  - rank remaining directions by clarity, trust, and conversion potential
  - recommend the top direction and first prototype test

### Execute mode

Goal: turn a chosen UI direction into an implementation-ready frontend plan.

Required deliverables:

- Component table: | Component or section | Purpose | Sin to watch | Acceptance check |
- State table: | State | User message | Primary action | Failure risk |
- Recommendation: smallest build slice, highest-risk state, and what to simplify
- Code params: surface, components, states, interactions, dataInputs, validationRules, trackingEvents, accessibilityChecks, performanceChecks, constraints
- Pseudocode:
  - define layout hierarchy
  - define components and props
  - define loading, empty, error, success, and retry states
  - wire primary and secondary actions
  - add accessibility and tracking checks
  - verify the screen avoids Clutter, Misfit, Disrespect, and Myopia

### Debug mode

Goal: diagnose why an interface or flow is failing and identify the smallest credible repair.

Required deliverables:

- Debug table: | Symptom | Likely sin | Evidence to inspect | Root cause hypothesis | Fix |
- Recommendation: most likely UX root cause, quickest proof, and safest repair
- Code params: surface, symptom, reproSteps, suspectComponents, suspectStates, signalsToInspect, rollbackOption, validationChecks
- Pseudocode:
  - define symptom and repro path
  - map likely sins
  - inspect hierarchy, copy, state transitions, and event signals
  - rank root-cause hypotheses
  - propose the smallest safe UI fix
  - define post-fix validation checks
