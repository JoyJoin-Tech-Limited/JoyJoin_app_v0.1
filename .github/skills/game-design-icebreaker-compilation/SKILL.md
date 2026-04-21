---
name: game-design-icebreaker-compilation
description: >-
  Compile post-match, pre-event Social Icebreaker run plans: psychological safety gates, energy arc,
  timeboxing, cohort personalization, and handoff JSON for shipped UI phase templates. Use when
  designing IcebreakerRunPlan segments, curating mechanics for pool groups, scoring peer pressure,
  or producing dev-ready state-machine drafts. Trigger phrases: icebreaker run plan, Game Design Agent,
  compile icebreaker flow, PressureGauge, FlowCurator, TemplateMatcher, post-match icebreaker,
  minimal peer pressure icebreaker plan.
---

# Game design — icebreaker compilation

## Purpose

Turn **match-complete context** (group size, pool type, theme metadata, safe profile signals) into a **validated `IcebreakerRunPlan`** (see `packages/shared/src/icebreakerRunPlan.ts`) that only references **shipped phase templates** realisable on **WeChat mini-program (Taro)** first (`apps/mini-program/src/pages/icebreaker-session/phaseViews.tsx`), with **web** registry (`socialIcebreakerPhaseRegistry.tsx`) kept in naming parity, unless an explicit **novelty flag** documents a gap for a release-track follow-up.

**Production rule:** the compile worker outputs **JSON + hash**, not executable code. Novel mechanics ship via **Game Development Agent** in normal PRs.

Pair with:

- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md) — phase order, host authority, lie-detective secrecy; **mini-program first** client policy
- [`lie-detective-icebreaker`](../lie-detective-icebreaker/SKILL.md) — `lie_detective` mechanics + secrecy when compiling that segment
- [`personality-dice-icebreaker`](../personality-dice-icebreaker/SKILL.md) — `personality_dice` roster + tone when compiling that segment
- [`icebreaker-auction-phase`](../icebreaker-auction-phase/SKILL.md) — `auction` virtual-coin constraints when compiling that segment
- [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md) — sibling web + mini-program when touching both surfaces
- [`event-pool-and-matching-operations`](../event-pool-and-matching-operations/SKILL.md) — group row semantics after match
- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md) — when LLMs fill template slots
- [`first-principles-velocity`](../first-principles-velocity/SKILL.md) — constraints before options; smallest proof plans

---

## When to use this skill

- Authoring or reviewing **`IcebreakerRunPlan`** JSON for a matched group
- Enforcing **low peer pressure** and **opt-out** semantics in a proposed flow
- Sequencing phases for an **energy arc** (warm → peak → cool-down)
- Mapping designed flows to **existing React phase panels** (registry)
- Emitting **handoff artifacts** for implementation (`TemplateMatcher`, `StateMachineDraft`, `NoveltyFlag`)

---

## Core workflow (aligns with product)

1. **Compilation** — produce ordered `segments[]` + `context` (bounded fields only).
2. **Optimization** — single objective: bonding with minimal pressure; reject or downgrade high-pressure segments.
3. **Customization** — use pool/group metadata and optional archetype tags; never embed secrets or cross-user private fields without entitlement review.
4. **Handoff** — emit plan JSON + rationale + test matrix row (optional `StateMachineDraft` in handoff appendix per `references/design-modules.md`).
5. **Execution boundary** — `NoveltyFlag: true` means **no registry template**; stop at spec and route to Game Development Agent (PR), not production codegen.

---

## Modular sub-routines (callable checklists)

Detailed steps, scoring rubrics, and JSON snippets live in:

- [`references/design-modules.md`](./references/design-modules.md) — `PressureGauge`, `OptOutShield`, `IntrovertFriendlyFilter`, `MechanicsLibrary`, `FlowCurator`, `TimeBoxOptimizer`, `CohortAnalyzer`, `PersonaMapper`, `LocaleInjector`, `TemplateMatcher`, `StateMachineDraft`, `NoveltyFlag`

Load the relevant subsection **before** finalizing a plan.

---

## Quick examples

- **Too hot:** Flow starts with `personality_dice` hard dares → run `FlowCurator` + `PressureGauge`; move dice after micro-challenge or drop `energyWeight`.
- **Corporate dinner:** Run `CohortAnalyzer` → prefer `warmup` + `micro_challenge` + shorter `lie_detective`; cap total segments with `TimeBoxOptimizer`.
- **No template:** User asks for “AR scavenger hunt” → `NoveltyFlag: true`, `TemplateMatcher` documents gap; hand off to Game Development Agent for a **new phase** behind a feature flag.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Plan references unknown phase id | Restrict to keys in `SOCIAL_ICEBREAKER_PHASE_REGISTRY` until server adds the phase |
| Lie-detective in 2-person plan | Enforce `memberCount >= 3` or rely on server `getNextEligiblePhase` skip; document in rationale |
| LLM invented a new mechanic | Re-parse with Zod; strip non-schema keys; rerun with slot-only prompt per `llm-runtime-safety-and-integration` |
| Venue/theme missing at first compile | Mark `context` fields optional; schedule **re-compile** when `event_pool_groups` updates |

---

## Review checklist

- [ ] `parseIcebreakerRunPlan` would accept the output (version + segments + strict context)
- [ ] Every `segment.phase` exists in mini-program `phaseViews` / session flow **and** web `SOCIAL_ICEBREAKER_PHASE_REGISTRY` **or** `NoveltyFlag` is true with a written gap analysis
- [ ] Pressure and opt-out rules applied (`references/design-modules.md`)
- [ ] Energy arc is monotonic or explicitly justified
- [ ] Timebox fits event window (`TimeBoxOptimizer`)
- [ ] No `isLie`, phone numbers, or raw DMs in JSON
- [ ] Handoff includes test matrix rows for 2, 3, 4, 6 players
- [ ] `social-icebreaker-domain` invariants (host advance, min players) still respected by server when plan executes
